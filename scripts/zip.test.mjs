import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { zipDirectory } from './zip.mjs';

// Reads entries back through the central directory, the way unzip tools do.
function readZip(file) {
  const buf = fs.readFileSync(file);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26);
    const raw = buf.subarray(dataStart, dataStart + csize);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    assert.equal(zlib.crc32(data), crc, `crc mismatch for ${name}`);
    out[name] = data.toString('utf8');
    p += 46 + nameLen;
  }
  return out;
}

test('zips a nested folder with forward-slash paths and round-trips the contents', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ziptest-'));
  fs.mkdirSync(path.join(dir, 'src/sub'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'serverEntry.js'), 'console.log("hi")\n'.repeat(50));
  fs.writeFileSync(path.join(dir, 'src/sub/é.txt'), 'x');
  const out = path.join(os.tmpdir(), `ziptest-${process.pid}.zip`);
  const names = zipDirectory(dir, out);
  assert.deepEqual(names, ['serverEntry.js', 'src/sub/é.txt']);
  const back = readZip(out);
  assert.equal(back['serverEntry.js'], 'console.log("hi")\n'.repeat(50));
  assert.equal(back['src/sub/é.txt'], 'x');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(out, { force: true });
});

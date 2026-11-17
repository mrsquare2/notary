// Tiny JSON-file persistence for sessions and results. Writes go to a temp
// file first and are renamed into place, so a crash can't leave half a file.
// Fine for a single server process; swap for SQLite/MySQL if you scale out.
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS_PER_CLIENT = 200;

export class Store {
  constructor(dir) {
    this.dir = dir;
    if (dir) mkdirSync(dir, { recursive: true });
    this.sessions = new Map(this.#load('sessions.json').map((s) => [s.id, s]));
    this.results = new Map(this.#load('results.json').map((r) => [r.id, r]));
    this.#pruneSessions();
  }

  #load(name) {
    if (!this.dir) return [];
    const file = join(this.dir, name);
    if (!existsSync(file)) return [];
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      console.warn(`Ignoring unreadable ${file}`);
      return [];
    }
  }

  #save(name, map) {
    if (!this.dir) return; // in-memory mode (tests)
    const file = join(this.dir, name);
    writeFileSync(`${file}.tmp`, JSON.stringify([...map.values()]));
    renameSync(`${file}.tmp`, file);
  }

  #pruneSessions() {
    const cutoff = Date.now() - SESSION_TTL_MS;
    for (const [id, s] of this.sessions) if (Date.parse(s.createdAt) < cutoff) this.sessions.delete(id);
  }

  getSession(id) {
    return this.sessions.get(id);
  }

  saveSession(session) {
    this.#pruneSessions();
    this.sessions.set(session.id, session);
    this.#save('sessions.json', this.sessions);
  }

  getResult(id) {
    return this.results.get(id);
  }

  listResults(clientId) {
    return [...this.results.values()]
      .filter((r) => r.clientId === clientId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  saveResult(result) {
    this.results.set(result.id, result);
    const mine = this.listResults(result.clientId);
    for (const old of mine.slice(MAX_RESULTS_PER_CLIENT)) this.results.delete(old.id);
    this.#save('results.json', this.results);
  }

  deleteResult(id) {
    this.results.delete(id);
    this.#save('results.json', this.results);
  }
}

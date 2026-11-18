// Loads <app root>/.env into process.env when the file exists (Node's built-in loader, no
// dependency). Import this first: values already set by the host panel are not overwritten.
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const envFile = join(APP_ROOT, '.env');
if (existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);

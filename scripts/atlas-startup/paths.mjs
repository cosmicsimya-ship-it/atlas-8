import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @returns {string} Absolute Atlas project root */
export function getProjectRoot() {
  return resolve(__dirname, '..', '..');
}

export function getDataDir(root = getProjectRoot()) {
  return join(root, 'data');
}

export function getPidPath(service, root = getProjectRoot()) {
  return join(getDataDir(root), service.pidFile);
}

export function getPollLockPath(root = getProjectRoot()) {
  return join(getDataDir(root), 'telegram.poll.lock');
}

export function normalizePath(input) {
  return resolve(String(input)).replace(/\\/g, '/').toLowerCase();
}

export function pathsEqual(a, b) {
  return normalizePath(a) === normalizePath(b);
}

export function assertProjectRoot(root = getProjectRoot()) {
  const packageJson = join(root, 'package.json');
  const serverIndex = join(root, 'server', 'index.js');
  if (!existsSync(packageJson) || !existsSync(serverIndex)) {
    throw new Error(`Invalid Atlas project root: ${root}`);
  }
  return root;
}

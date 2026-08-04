/**
 * Local-only secret rotation + recovery file writer.
 * Never logs password or bot secret values.
 * Run: node server/scripts/rotate-founder-secrets.mjs
 */
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const envPath = join(root, '.env');
const recoveryPath = join(root, '.atlas-local-founder-credentials.txt');

function genPassword(bytes = 24) {
  // base64url ~ 1.33 chars per byte; 24 bytes => ~32 chars
  return randomBytes(bytes).toString('base64url');
}

function genSecret(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

function upsertEnv(raw, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(raw)) {
    return raw.replace(re, line);
  }
  return `${raw.trimEnd()}\n${line}\n`;
}

function removeDuplicateKeys(raw, keys) {
  const lines = raw.split(/\r?\n/);
  const seen = new Set();
  const out = [];
  // Keep last occurrence of each managed key
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (m && keys.includes(m[1])) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
    }
    out.push(line);
  }
  return out.reverse().join('\n');
}

if (!existsSync(envPath)) {
  console.error('Missing .env');
  process.exit(1);
}

let env = readFileSync(envPath, 'utf8');
const password = genPassword(24);
const botSecret = genSecret(32);
const username = 'lara';

const managed = [
  'ATLAS_FOUNDER_USERNAME',
  'ATLAS_FOUNDER_PASSWORD',
  'ATLAS_FOUNDER_USER_ID',
  'ATLAS_FOUNDER_TELEGRAM_IDS',
  'ATLAS_INTERNAL_BOT_SECRET',
  'ATLAS_CORS_ORIGINS',
  'ATLAS_SECURE_COOKIES',
];

env = removeDuplicateKeys(env, managed);
env = upsertEnv(env, 'ATLAS_FOUNDER_USERNAME', username);
env = upsertEnv(env, 'ATLAS_FOUNDER_PASSWORD', password);
env = upsertEnv(env, 'ATLAS_FOUNDER_USER_ID', 'web:founder');
env = upsertEnv(env, 'ATLAS_FOUNDER_TELEGRAM_IDS', '7142880605');
env = upsertEnv(env, 'ATLAS_INTERNAL_BOT_SECRET', botSecret);
env = upsertEnv(env, 'ATLAS_CORS_ORIGINS', 'http://localhost:5173');
env = upsertEnv(env, 'ATLAS_SECURE_COOKIES', 'false');
env = removeDuplicateKeys(env, managed);

writeFileSync(envPath, env.endsWith('\n') ? env : `${env}\n`, 'utf8');

const stamp = new Date().toISOString();
const recovery = [
  'ATLAS LOCAL FOUNDER CREDENTIALS',
  'WARNING: Local only. Never commit this file.',
  `createdAt: ${stamp}`,
  `username: ${username}`,
  `password: ${password}`,
  '',
].join('\n');

writeFileSync(recoveryPath, recovery, 'utf8');

console.log('Rotation complete.');
console.log('  .env updated (secrets not printed)');
console.log('  recovery file written (path only): .atlas-local-founder-credentials.txt');
console.log('  ATLAS_FOUNDER_USERNAME set');
console.log('  ATLAS_FOUNDER_PASSWORD rotated');
console.log('  ATLAS_INTERNAL_BOT_SECRET rotated');
console.log('  founder settings consolidated (no duplicates for managed keys)');

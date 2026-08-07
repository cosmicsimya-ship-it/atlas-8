/**
 * Write a production .env snippet containing ONLY TELEGRAM_BOT_TOKEN
 * sourced from local .env — never prints the secret.
 *
 * Usage: node scripts/write-telegram-env-snippet.mjs
 * Output: tmp/prod-telegram.env (gitignored path under tmp/)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localEnv = readFileSync(join(root, '.env'), 'utf8');
const match = localEnv.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m);
if (!match || !String(match[1]).trim()) {
  console.error('TELEGRAM_BOT_TOKEN missing in local .env');
  process.exit(1);
}
const token = String(match[1]).trim();
const outDir = join(root, 'tmp');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'prod-telegram.env');
writeFileSync(
  outPath,
  [
    '# Generated for production — Telegram only. Other secrets stay in cPanel Application Manager.',
    `TELEGRAM_BOT_TOKEN=${token}`,
    '',
  ].join('\n'),
  'utf8',
);
console.log('Wrote', outPath, '(token redacted); length=', token.length);

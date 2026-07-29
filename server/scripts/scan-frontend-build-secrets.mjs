/**
 * Scan Vite build output for local secrets without printing them.
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const envPath = join(root, '.env');
if (!existsSync(envPath)) {
  console.error(JSON.stringify({ ok: false, reason: 'env_missing' }));
  process.exit(1);
}

const env = readFileSync(envPath, 'utf8');
function get(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m?.[1]?.trim() || '';
}

const password = get('ATLAS_FOUNDER_PASSWORD');
const botSecret = get('ATLAS_INTERNAL_BOT_SECRET');
const telegramId = get('ATLAS_FOUNDER_TELEGRAM_IDS');

if (!password || !botSecret) {
  console.error(JSON.stringify({ ok: false, reason: 'env_incomplete' }));
  process.exit(1);
}

execSync('npm run build', { stdio: 'inherit', cwd: root });

const dist = join(root, 'dist');
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|css|html|map|json)$/i.test(name)) out.push(p);
  }
  return out;
}

const files = walk(dist);
let foundPassword = false;
let foundBotSecret = false;
let foundSessionTokenPattern = false;
let foundTelegramAsAuthProof = false;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (text.includes(password)) foundPassword = true;
  if (text.includes(botSecret)) foundBotSecret = true;
  // Raw session tokens are random hex; look for atlas_sid assignment literals only.
  if (/atlas_sid\s*[:=]\s*['"][a-f0-9]{32,}['"]/i.test(text)) foundSessionTokenPattern = true;
  // Telegram ID as auth proof string in client bundle is unsafe if used as credential.
  if (telegramId && new RegExp(`ATLAS_FOUNDER_TELEGRAM_IDS\\s*[:=]\\s*['"]?${telegramId}`).test(text)) {
    foundTelegramAsAuthProof = true;
  }
}

const ok = !foundPassword && !foundBotSecret && !foundSessionTokenPattern && !foundTelegramAsAuthProof;
console.log(
  JSON.stringify({
    ok,
    filesScanned: files.length,
    foundPassword,
    foundBotSecret,
    foundSessionTokenPattern,
    foundTelegramAsAuthProof,
  }),
);
process.exit(ok ? 0 : 1);

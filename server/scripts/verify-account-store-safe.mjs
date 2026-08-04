import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const accountsPath = join(root, 'data', 'auth_accounts.json');
const sessionsPath = join(root, 'data', 'auth_sessions.json');

if (!existsSync(accountsPath)) {
  console.error('FAIL: auth_accounts.json missing');
  process.exit(1);
}

const accounts = JSON.parse(readFileSync(accountsPath, 'utf8'));
const sessions = existsSync(sessionsPath)
  ? JSON.parse(readFileSync(sessionsPath, 'utf8'))
  : { sessions: {} };

const acc = Object.values(accounts.accounts || {})[0];
const checks = {
  hasAccounts: Boolean(acc),
  rolesOk:
    Array.isArray(acc?.roles) &&
    acc.roles.includes('founder') &&
    acc.roles.includes('user'),
  tgOk:
    Array.isArray(acc?.telegramBindings) &&
    acc.telegramBindings.includes('telegram:7142880605'),
  noPlainPassword: !acc?.password && !acc?.plaintextPassword,
  hashLooksBcrypt:
    typeof acc?.passwordHash === 'string' && acc.passwordHash.startsWith('$2'),
  noBotSecretKey: !JSON.stringify(accounts).includes('ATLAS_INTERNAL_BOT_SECRET'),
  noRawSessionTokenField: !Object.values(sessions.sessions || {}).some(
    (x) => x && (x.rawToken || x.token || x.sessionToken),
  ),
};

console.log(JSON.stringify(checks));
const failed = Object.entries(checks).filter(([, v]) => !v);
process.exit(failed.length ? 1 : 0);

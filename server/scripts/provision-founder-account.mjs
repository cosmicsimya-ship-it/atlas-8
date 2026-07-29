/**
 * Provision founder account from environment variables.
 *
 * Required:
 *   ATLAS_FOUNDER_USERNAME
 *   ATLAS_FOUNDER_PASSWORD
 *
 * Optional:
 *   ATLAS_FOUNDER_USER_ID          default web:founder
 *   ATLAS_FOUNDER_TELEGRAM_IDS     comma-separated numeric ids → telegram: bindings
 *   ATLAS_FOUNDER_ACCOUNT_ID       stable account id
 *
 * Usage:
 *   node server/scripts/provision-founder-account.mjs
 *
 * Never commit real credentials. Passwords are hashed with bcrypt before storage.
 */
import 'dotenv/config';
import {
  upsertAccount,
  configureAccountStore,
  getAccountStorePath,
} from '../auth/account-store.js';

const username = process.env.ATLAS_FOUNDER_USERNAME?.trim();
const password = process.env.ATLAS_FOUNDER_PASSWORD;
const userId = (process.env.ATLAS_FOUNDER_USER_ID || 'web:founder').trim();
const accountId = (process.env.ATLAS_FOUNDER_ACCOUNT_ID || 'acc_founder_primary').trim();

if (!username || !password) {
  console.error('Missing ATLAS_FOUNDER_USERNAME or ATLAS_FOUNDER_PASSWORD');
  process.exit(1);
}

if (password.length < 12) {
  console.error('ATLAS_FOUNDER_PASSWORD must be at least 12 characters');
  process.exit(1);
}

const telegramBindings = (process.env.ATLAS_FOUNDER_TELEGRAM_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => /^\d+$/.test(s))
  .map((id) => `telegram:${id}`);

// Also accept full telegram: ids in ATLAS_FOUNDER_USER_IDS
for (const part of (process.env.ATLAS_FOUNDER_USER_IDS || '').split(',')) {
  const trimmed = part.trim();
  if (/^telegram:\d+$/.test(trimmed) && !telegramBindings.includes(trimmed)) {
    telegramBindings.push(trimmed);
  }
}

try {
  const safe = await upsertAccount({
    id: accountId,
    username,
    password,
    roles: ['founder', 'user'],
    userId,
    telegramBindings,
    disabled: false,
  });

  console.log('Founder account provisioned successfully.');
  console.log(`  accountId: ${safe.id}`);
  console.log(`  username:  ${safe.username}`);
  console.log(`  userId:    ${safe.userId}`);
  console.log(`  roles:     ${safe.roles.join(', ')}`);
  console.log(`  telegram:  ${telegramBindings.join(', ') || '(none)'}`);
  console.log(`  store:     ${getAccountStorePath()}`);
  console.log('');
  console.log('Password hash stored. Plaintext password was not written to disk.');
  if (!process.env.ATLAS_INTERNAL_BOT_SECRET) {
    console.log('');
    console.log('Set ATLAS_INTERNAL_BOT_SECRET in .env for Telegram bot auth (do not commit it).');
  }
} catch (err) {
  console.error('Provisioning failed:', err.message);
  process.exit(1);
}

void configureAccountStore;

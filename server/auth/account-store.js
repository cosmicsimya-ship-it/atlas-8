// ═══════════════════════════════════════════════════════════════════════
// Account store — password hashes only; no plaintext credentials
// ═══════════════════════════════════════════════════════════════════════

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', '..', 'data', 'auth_accounts.json');

/** @type {string} */
let storePath = DEFAULT_PATH;

function emptyStore() {
  return { accounts: {} };
}

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * @param {string} [filePath]
 */
export function configureAccountStore(filePath) {
  storePath = filePath || DEFAULT_PATH;
}

export function getAccountStorePath() {
  return storePath;
}

function loadStore() {
  ensureDir(storePath);
  if (!existsSync(storePath)) {
    const empty = emptyStore();
    writeFileSync(storePath, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
  const parsed = JSON.parse(readFileSync(storePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || typeof parsed.accounts !== 'object') {
    throw new Error('corrupt_account_store');
  }
  return { accounts: { ...parsed.accounts } };
}

function saveStore(store) {
  ensureDir(storePath);
  const tmp = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tmp, storePath);
}

/**
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  return bcrypt.hash(String(password), 12);
}

/**
 * @param {string} password
 * @param {string} passwordHash
 */
export async function verifyPassword(password, passwordHash) {
  if (!passwordHash || typeof passwordHash !== 'string') return false;
  // Reject obvious plaintext storage
  if (!passwordHash.startsWith('$2') && !passwordHash.includes(':')) {
    return false;
  }
  if (passwordHash.startsWith('$2')) {
    return bcrypt.compare(String(password), passwordHash);
  }
  // Optional legacy scrypt format salt:hash
  try {
    const [salt, key] = passwordHash.split(':');
    const derived = scryptSync(String(password), salt, 64);
    const expected = Buffer.from(key, 'hex');
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * @param {string} username
 */
export function findAccountByUsername(username) {
  const store = loadStore();
  const needle = String(username ?? '').trim().toLowerCase();
  return (
    Object.values(store.accounts).find(
      (a) => String(a.username ?? '').trim().toLowerCase() === needle,
    ) ?? null
  );
}

/**
 * @param {string} accountId
 */
export function getAccountById(accountId) {
  const store = loadStore();
  return store.accounts[accountId] ?? null;
}

/**
 * @param {string} userId Memory / session user id
 */
export function findAccountByUserId(userId) {
  const store = loadStore();
  return Object.values(store.accounts).find((a) => a.userId === userId) ?? null;
}

/**
 * @param {string} telegramUserId e.g. telegram:123
 */
export function findAccountByTelegramBinding(telegramUserId) {
  const store = loadStore();
  const id = String(telegramUserId ?? '').trim();
  return (
    Object.values(store.accounts).find(
      (a) => Array.isArray(a.telegramBindings) && a.telegramBindings.includes(id),
    ) ?? null
  );
}

/**
 * Create or update an account (provisioning).
 * @param {{
 *   id?: string,
 *   username: string,
 *   password: string,
 *   roles?: string[],
 *   userId: string,
 *   telegramBindings?: string[],
 *   disabled?: boolean,
 * }} input
 */
export async function upsertAccount(input) {
  const store = loadStore();
  const id = input.id || `acc_${randomBytes(8).toString('hex')}`;
  const existing = store.accounts[id] ?? findAccountByUsername(input.username);
  const accountId = existing?.id ?? id;
  const passwordHash = await hashPassword(input.password);

  store.accounts[accountId] = {
    id: accountId,
    username: String(input.username).trim(),
    passwordHash,
    roles: Array.isArray(input.roles) ? [...input.roles] : ['user'],
    userId: input.userId,
    telegramBindings: Array.isArray(input.telegramBindings)
      ? input.telegramBindings.map(String)
      : existing?.telegramBindings ?? [],
    disabled: Boolean(input.disabled),
    updatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  saveStore(store);
  const { passwordHash: _ph, ...safe } = store.accounts[accountId];
  void _ph;
  return safe;
}

/**
 * Public-safe account view (no password hash).
 * @param {object} account
 */
export function toPublicAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    username: account.username,
    roles: [...(account.roles ?? [])],
    userId: account.userId,
    disabled: Boolean(account.disabled),
  };
}

/**
 * Detect plaintext password fields in store (tests / audit).
 */
export function accountStoreHasPlaintextPasswordField() {
  try {
    const raw = readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    for (const acc of Object.values(parsed.accounts ?? {})) {
      if (acc.password || acc.plaintextPassword) return true;
      if (typeof acc.passwordHash === 'string' && !acc.passwordHash.startsWith('$2') && !acc.passwordHash.includes(':')) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * @param {string} [filePath]
 */
export function resetAccountStoreForTests(filePath) {
  if (filePath) configureAccountStore(filePath);
  ensureDir(storePath);
  writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), 'utf8');
}

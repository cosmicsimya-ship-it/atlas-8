// ═══════════════════════════════════════════════════════════════════════
// Account store — password hashes only; no plaintext credentials
// ═══════════════════════════════════════════════════════════════════════

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { logAdminAudit } from './admin-audit.js';

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
 * @param {string|null|undefined} value
 */
export function normalizeEmail(value) {
  const s = String(value ?? '').trim().toLowerCase();
  return s || null;
}

/**
 * Lightweight email shape check (not full RFC).
 * @param {string|null|undefined} value
 */
export function isValidEmailShape(value) {
  const email = normalizeEmail(value);
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
 * Lookup by email field; falls back to username when username equals email.
 * @param {string} email
 */
export function findAccountByEmail(email) {
  const needle = normalizeEmail(email);
  if (!needle) return null;
  const store = loadStore();
  const byEmail = Object.values(store.accounts).find(
    (a) => normalizeEmail(a.email) === needle,
  );
  if (byEmail) return byEmail;
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
 * All accounts, newest first. Admin-only consumer — callers must gate
 * access with requireRole('admin') before calling this.
 */
export function listAllAccounts() {
  const store = loadStore();
  return Object.values(store.accounts).sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
  );
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
 * Password policy for public registration / password login accounts.
 * @param {string} password
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function validatePasswordPolicy(password) {
  const pw = String(password ?? '');
  if (pw.length < 8) {
    return { ok: false, code: 'weak_password', error: 'Password must be at least 8 characters' };
  }
  if (pw.length > 128) {
    return { ok: false, code: 'weak_password', error: 'Password is too long' };
  }
  if (!/[A-Za-zÀ-ÿ]/.test(pw) || !/[0-9]/.test(pw)) {
    return {
      ok: false,
      code: 'weak_password',
      error: 'Password must include at least one letter and one number',
    };
  }
  return { ok: true };
}

/**
 * @param {string} googleSub
 */
export function findAccountByGoogleSub(googleSub) {
  const sub = String(googleSub ?? '').trim();
  if (!sub) return null;
  const store = loadStore();
  return (
    Object.values(store.accounts).find((a) => String(a.googleSub ?? '').trim() === sub) ?? null
  );
}

/**
 * Create or update an account (provisioning).
 * @param {{
 *   id?: string,
 *   username: string,
 *   password?: string|null,
 *   passwordHash?: string|null,
 *   email?: string|null,
 *   roles?: string[],
 *   userId: string,
 *   telegramBindings?: string[],
 *   disabled?: boolean,
 *   displayName?: string|null,
 *   avatarUrl?: string|null,
 *   googleSub?: string|null,
 *   authProviders?: string[],
 * }} input
 */
export async function upsertAccount(input) {
  const store = loadStore();
  const id = input.id || `acc_${randomBytes(8).toString('hex')}`;
  const existing = store.accounts[id] ?? findAccountByUsername(input.username);
  const accountId = existing?.id ?? id;
  let passwordHash = existing?.passwordHash ?? null;
  if (input.passwordHash !== undefined) {
    passwordHash = input.passwordHash;
  } else if (input.password != null && String(input.password).length > 0) {
    passwordHash = await hashPassword(input.password);
  }
  const emailInput =
    input.email !== undefined ? normalizeEmail(input.email) : normalizeEmail(existing?.email);

  const providers = Array.isArray(input.authProviders)
    ? [...new Set(input.authProviders.map(String))]
    : existing?.authProviders
      ? [...existing.authProviders]
      : passwordHash
        ? ['password']
        : [];

  store.accounts[accountId] = {
    id: accountId,
    username: input.username !== undefined ? String(input.username).trim() : existing?.username,
    email: emailInput,
    passwordHash,
    roles: Array.isArray(input.roles) ? [...input.roles] : existing?.roles ?? ['user'],
    userId: input.userId !== undefined ? input.userId : existing?.userId,
    telegramBindings: Array.isArray(input.telegramBindings)
      ? input.telegramBindings.map(String)
      : existing?.telegramBindings ?? [],
    disabled: input.disabled !== undefined ? Boolean(input.disabled) : Boolean(existing?.disabled),
    displayName:
      input.displayName !== undefined
        ? input.displayName
          ? String(input.displayName).trim().slice(0, 120)
          : null
        : existing?.displayName ?? null,
    avatarUrl:
      input.avatarUrl !== undefined
        ? input.avatarUrl
          ? String(input.avatarUrl).trim().slice(0, 500)
          : null
        : existing?.avatarUrl ?? null,
    googleSub:
      input.googleSub !== undefined
        ? input.googleSub
          ? String(input.googleSub).trim()
          : null
        : existing?.googleSub ?? null,
    authProviders: providers,
    updatedAt: new Date().toISOString(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  saveStore(store);
  const { passwordHash: _ph, ...safe } = store.accounts[accountId];
  void _ph;
  return safe;
}

/**
 * Public email/password registration. Does not merge anonymous chat memory.
 * @param {{
 *   email: string,
 *   password: string,
 *   displayName?: string|null,
 * }} input
 */
export async function registerAccount(input) {
  const email = normalizeEmail(input.email);
  if (!email || !isValidEmailShape(email)) {
    const err = new Error('invalid_email');
    err.code = 'invalid_email';
    throw err;
  }
  const policy = validatePasswordPolicy(input.password);
  if (!policy.ok) {
    const err = new Error(policy.error);
    err.code = policy.code;
    throw err;
  }
  if (findAccountByEmail(email) || findAccountByUsername(email)) {
    const err = new Error('duplicate_email');
    err.code = 'duplicate_email';
    throw err;
  }

  const passwordHash = await hashPassword(input.password);
  const userId = `web:${randomBytes(12).toString('hex')}`;
  const displayName = input.displayName
    ? String(input.displayName).trim().slice(0, 120)
    : email.split('@')[0];

  return upsertAccount({
    username: email,
    email,
    passwordHash,
    password: null,
    roles: ['user'],
    userId,
    displayName,
    authProviders: ['password'],
  });
}

// Primary-owner bootstrap (ATLAS Admin bridge integration). Configurable via
// env; falls back to the operator-designated owner identity if unset. This
// is not a credential — it is a plain identifier compared with
// normalizeEmail()'s exact lowercase/trim match, the same comparison every
// other email lookup in this file already uses.
const OWNER_EMAIL = normalizeEmail(process.env.ATLAS_OWNER_EMAIL || 'cosmicsimya@gmail.com');

/**
 * Ensures the ONE operator-designated owner email always carries 'owner' +
 * 'admin', added idempotently on every Google login. Deliberately narrow:
 * - Can only ever ADD these two roles, never remove any existing role.
 * - Only ever applies to an exact match against OWNER_EMAIL - every other
 *   account's roles pass through completely unchanged.
 * - Only reachable from findOrProvisionGoogleAccount(), which by this point
 *   has already required `emailVerified === true` from Google itself - this
 *   never trusts a client-supplied or unverified email.
 * - Not exposed via any HTTP route/request body - mirrors the existing
 *   "no HTTP API for self role escalation" rule enforced by
 *   server/scripts/grant-admin-role.mjs (CLI-only), just applied
 *   automatically for this one identity instead of requiring a manual
 *   CLI run every time a fresh account is provisioned.
 */
function ensureOwnerRoles(roles, email) {
  if (!OWNER_EMAIL || normalizeEmail(email) !== OWNER_EMAIL) return [...roles];
  const next = [...roles];
  for (const r of ['admin', 'owner']) {
    if (!next.includes(r)) next.push(r);
  }
  return next;
}

function auditOwnerRoleBootstrap({ rolesBefore, rolesAfter, email, userId, username }) {
  if (rolesAfter.length === rolesBefore.length) return; // nothing added, nothing to log
  logAdminAudit({
    action: 'role.grant',
    actor: 'system:owner-bootstrap',
    targetUserId: userId,
    targetEmail: email,
    targetUsername: username,
    role: 'owner+admin',
    rolesBefore,
    rolesAfter,
    result: 'ok',
    reason: 'primary_owner_email_login',
  });
}

/**
 * Find or create an account for a verified Google identity.
 * Reuses an existing account with the same verified email (no duplicate).
 * @param {{
 *   googleSub: string,
 *   email: string,
 *   emailVerified: boolean,
 *   displayName?: string|null,
 *   avatarUrl?: string|null,
 * }} input
 */
export async function findOrProvisionGoogleAccount(input) {
  const googleSub = String(input.googleSub ?? '').trim();
  const email = normalizeEmail(input.email);
  if (!googleSub) {
    const err = new Error('google_identity_missing');
    err.code = 'google_identity_missing';
    throw err;
  }
  if (!input.emailVerified) {
    const err = new Error('google_email_unverified');
    err.code = 'google_email_unverified';
    throw err;
  }
  if (!email || !isValidEmailShape(email)) {
    const err = new Error('invalid_email');
    err.code = 'invalid_email';
    throw err;
  }

  const bySub = findAccountByGoogleSub(googleSub);
  if (bySub) {
    if (bySub.disabled) {
      const err = new Error('account_disabled');
      err.code = 'account_disabled';
      throw err;
    }
    const providers = [...new Set([...(bySub.authProviders ?? []), 'google'])];
    const rolesBefore = bySub.roles ?? [];
    const rolesAfter = ensureOwnerRoles(rolesBefore, email);
    auditOwnerRoleBootstrap({ rolesBefore, rolesAfter, email, userId: bySub.userId, username: bySub.username });
    return upsertAccount({
      id: bySub.id,
      username: bySub.username,
      password: null,
      passwordHash: bySub.passwordHash ?? null,
      email: bySub.email || email,
      roles: rolesAfter,
      userId: bySub.userId,
      telegramBindings: bySub.telegramBindings,
      disabled: bySub.disabled,
      displayName: input.displayName || bySub.displayName,
      avatarUrl: input.avatarUrl || bySub.avatarUrl,
      googleSub,
      authProviders: providers,
    });
  }

  const byEmail = findAccountByEmail(email);
  if (byEmail) {
    if (byEmail.disabled) {
      const err = new Error('account_disabled');
      err.code = 'account_disabled';
      throw err;
    }
    if (byEmail.googleSub && byEmail.googleSub !== googleSub) {
      const err = new Error('google_email_conflict');
      err.code = 'google_email_conflict';
      throw err;
    }
    const providers = [...new Set([...(byEmail.authProviders ?? []), 'google'])];
    if (byEmail.passwordHash && !providers.includes('password')) providers.push('password');
    const rolesBefore = byEmail.roles ?? [];
    const rolesAfter = ensureOwnerRoles(rolesBefore, email);
    auditOwnerRoleBootstrap({ rolesBefore, rolesAfter, email, userId: byEmail.userId, username: byEmail.username });
    return upsertAccount({
      id: byEmail.id,
      username: byEmail.username,
      password: null,
      passwordHash: byEmail.passwordHash ?? null,
      email,
      roles: rolesAfter,
      userId: byEmail.userId,
      telegramBindings: byEmail.telegramBindings,
      disabled: byEmail.disabled,
      displayName: input.displayName || byEmail.displayName,
      avatarUrl: input.avatarUrl || byEmail.avatarUrl,
      googleSub,
      authProviders: providers,
    });
  }

  const userId = `web:${randomBytes(12).toString('hex')}`;
  const newAccountRoles = ensureOwnerRoles(['user'], email);
  auditOwnerRoleBootstrap({ rolesBefore: ['user'], rolesAfter: newAccountRoles, email, userId, username: email });
  return upsertAccount({
    username: email,
    email,
    password: null,
    passwordHash: null,
    roles: newAccountRoles,
    userId,
    displayName: input.displayName
      ? String(input.displayName).trim().slice(0, 120)
      : email.split('@')[0],
    avatarUrl: input.avatarUrl ? String(input.avatarUrl).trim().slice(0, 500) : null,
    googleSub,
    authProviders: ['google'],
  });
}

/**
 * Grant a role to an existing account (CLI / server-side only — no HTTP).
 * Does not accept or return password material.
 * @param {{
 *   email: string,
 *   role: string,
 *   actor?: string,
 * }} input
 */
export function grantAccountRole(input) {
  const email = normalizeEmail(input.email);
  const role = String(input.role ?? '').trim().toLowerCase();
  if (!email || !isValidEmailShape(email)) {
    const err = new Error('invalid_email');
    err.code = 'invalid_email';
    throw err;
  }
  if (!role || !/^[a-z][a-z0-9_]{1,31}$/.test(role)) {
    const err = new Error('invalid_role');
    err.code = 'invalid_role';
    throw err;
  }

  const store = loadStore();
  const account =
    Object.values(store.accounts).find((a) => normalizeEmail(a.email) === email) ??
    Object.values(store.accounts).find(
      (a) => String(a.username ?? '').trim().toLowerCase() === email,
    );

  if (!account) {
    const err = new Error('account_not_found');
    err.code = 'account_not_found';
    throw err;
  }
  if (account.disabled) {
    const err = new Error('account_disabled');
    err.code = 'account_disabled';
    throw err;
  }

  const rolesBefore = [...(account.roles ?? [])];
  const rolesAfter = rolesBefore.includes(role) ? [...rolesBefore] : [...rolesBefore, role];
  const emailToStore = normalizeEmail(account.email) || email;

  store.accounts[account.id] = {
    ...account,
    email: emailToStore,
    roles: rolesAfter,
    updatedAt: new Date().toISOString(),
  };
  saveStore(store);

  const { passwordHash: _ph, ...safe } = store.accounts[account.id];
  void _ph;
  return {
    account: safe,
    rolesBefore,
    rolesAfter,
    alreadyHadRole: rolesBefore.includes(role),
  };
}

/**
 * Public-safe account view (no password hash / provider secrets).
 * @param {object} account
 */
export function toPublicAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    username: account.username,
    email: account.email ?? null,
    displayName: account.displayName ?? null,
    avatarUrl: account.avatarUrl ?? null,
    roles: [...(account.roles ?? [])],
    userId: account.userId,
    authProviders: Array.isArray(account.authProviders) ? [...account.authProviders] : [],
    disabled: Boolean(account.disabled),
  };
}

/**
 * UI-safe session profile (no internal account id / google sub).
 * @param {object|null|undefined} account
 */
export function toSessionProfile(account) {
  if (!account) return null;
  return {
    email: account.email ?? null,
    displayName: account.displayName ?? account.username ?? null,
    avatarUrl: account.avatarUrl ?? null,
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

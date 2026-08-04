// ═══════════════════════════════════════════════════════════════════════
// Admin audit log — role grants and admin actions (no secrets / PII blobs)
// ═══════════════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', '..', 'data', 'admin_audit.json');
const MAX_EVENTS = 2000;

/** @type {string} */
let storePath = DEFAULT_PATH;

/**
 * @param {string} [filePath]
 */
export function configureAdminAuditStore(filePath) {
  storePath = filePath || DEFAULT_PATH;
}

export function getAdminAuditStorePath() {
  return storePath;
}

function emptyStore() {
  return { events: [] };
}

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadStore() {
  ensureDir(storePath);
  if (!existsSync(storePath)) {
    const empty = emptyStore();
    writeFileSync(storePath, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'));
    if (!parsed || !Array.isArray(parsed.events)) return emptyStore();
    return { events: [...parsed.events] };
  } catch {
    return emptyStore();
  }
}

function saveStore(store) {
  ensureDir(storePath);
  const tmp = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tmp, storePath);
}

/**
 * @param {{
 *   action: string,
 *   actor?: string|null,
 *   targetUserId?: string|null,
 *   targetEmail?: string|null,
 *   targetUsername?: string|null,
 *   role?: string|null,
 *   rolesBefore?: string[],
 *   rolesAfter?: string[],
 *   result?: string,
 *   reason?: string|null,
 *   meta?: Record<string, unknown>,
 * }} event
 * @returns {boolean}
 */
export function logAdminAudit(event) {
  try {
    const store = loadStore();
    const entry = {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      action: String(event.action ?? 'admin_action'),
      actor: event.actor ? String(event.actor).slice(0, 120) : 'system',
      targetUserId: event.targetUserId ? String(event.targetUserId).slice(0, 120) : null,
      targetEmail: event.targetEmail ? String(event.targetEmail).slice(0, 200).toLowerCase() : null,
      targetUsername: event.targetUsername ? String(event.targetUsername).slice(0, 120) : null,
      role: event.role ? String(event.role) : null,
      rolesBefore: Array.isArray(event.rolesBefore) ? event.rolesBefore.map(String) : undefined,
      rolesAfter: Array.isArray(event.rolesAfter) ? event.rolesAfter.map(String) : undefined,
      result: event.result ? String(event.result) : 'ok',
      reason: event.reason ? String(event.reason).slice(0, 200) : undefined,
      meta: event.meta && typeof event.meta === 'object' ? event.meta : undefined,
    };
    store.events.push(entry);
    if (store.events.length > MAX_EVENTS) {
      store.events = store.events.slice(-MAX_EVENTS);
    }
    saveStore(store);
    return true;
  } catch (err) {
    console.error('[AdminAudit] log failed (non-fatal):', err?.message ?? err);
    return false;
  }
}

/**
 * @param {string} [filePath]
 */
export function resetAdminAuditForTests(filePath) {
  if (filePath) configureAdminAuditStore(filePath);
  ensureDir(storePath);
  writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), 'utf8');
}

/**
 * @param {{ action?: string, targetUserId?: string }} [filter]
 */
export function listAdminAuditEvents(filter = {}) {
  const store = loadStore();
  return store.events.filter((e) => {
    if (filter.action && e.action !== filter.action) return false;
    if (filter.targetUserId && e.targetUserId !== filter.targetUserId) return false;
    return true;
  });
}

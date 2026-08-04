/**
 * Match text instructions with later/earlier audio files (Telegram + web).
 * File-backed so Telegram bot process and backend process share state.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_TTL_MS = 2 * 60 * 1000;
const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = join(__dirname, '..', '..', 'data', 'audio-studio-pending.json');

/** In-memory mirror for tests / same-process fast path */
/** @type {Map<string, object>} */
const pendingByKey = new Map();

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ version: 1, entries: {} }, null, 2), 'utf8');
  }
}

function readDisk() {
  ensureStore();
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { version: 1, entries: {} };
  }
}

function writeDisk(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function prune(entries) {
  const now = Date.now();
  /** @type {Record<string, object>} */
  const next = {};
  for (const [k, v] of Object.entries(entries || {})) {
    if (v && typeof v === 'object' && Number(v.expiresAt) > now) {
      next[k] = v;
    }
  }
  return next;
}

/**
 * @param {{
 *   channel?: string,
 *   userId?: string|null,
 *   chatId?: string|null,
 *   conversationId?: string|null,
 *   messageThreadId?: string|number|null,
 *   topicId?: string|number|null,
 * }} ids
 */
export function contextKey(ids = {}) {
  const channel = ids.channel || 'unknown';
  const user = ids.userId || 'anon';
  const chat = ids.chatId || ids.conversationId || 'default';
  const topic = ids.messageThreadId ?? ids.topicId;
  const topicPart =
    topic != null && String(topic).trim() !== '' ? `:topic:${String(topic).trim()}` : '';
  return `${channel}:${user}:${chat}${topicPart}`;
}

/**
 * @param {string} key
 * @param {object} entry
 */
function persistEntry(key, entry) {
  pendingByKey.set(key, entry);
  const disk = readDisk();
  disk.entries = prune(disk.entries);
  disk.entries[key] = entry;
  writeDisk(disk);
}

/**
 * @param {string} key
 */
function removeEntry(key) {
  pendingByKey.delete(key);
  const disk = readDisk();
  disk.entries = prune(disk.entries);
  delete disk.entries[key];
  writeDisk(disk);
}

/**
 * @param {string} key
 * @param {{
 *   intent: string|null,
 *   message: string,
 *   requestedOperations?: string[],
 *   displayName?: string|null,
 *   ttlMs?: number,
 * }} payload
 */
export function setPendingAudioInstruction(key, payload) {
  const ttl = payload.ttlMs ?? DEFAULT_TTL_MS;
  persistEntry(key, {
    kind: 'instruction',
    intent: payload.intent || null,
    message: payload.message || '',
    requestedOperations: payload.requestedOperations || [],
    displayName: payload.displayName || null,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttl,
  });
}

/**
 * @param {string} key
 * @param {{
 *   jobId?: string|null,
 *   fileId?: string|null,
 *   fileName?: string|null,
 *   mimeType?: string|null,
 *   mediaKind?: string|null,
 *   ttlMs?: number,
 * }} payload
 */
export function setPendingAudioFile(key, payload) {
  const ttl = payload.ttlMs ?? DEFAULT_TTL_MS;
  persistEntry(key, {
    kind: 'file',
    jobId: payload.jobId || null,
    fileId: payload.fileId || null,
    fileName: payload.fileName || null,
    mimeType: payload.mimeType || null,
    mediaKind: payload.mediaKind || null,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttl,
  });
}

/**
 * @param {string} key
 */
export function getPendingAudioContext(key) {
  const mem = pendingByKey.get(key);
  if (mem && Date.now() <= mem.expiresAt) return mem;
  if (mem) pendingByKey.delete(key);

  const disk = readDisk();
  disk.entries = prune(disk.entries);
  writeDisk(disk);
  const entry = disk.entries[key] || null;
  if (entry) pendingByKey.set(key, entry);
  return entry;
}

/**
 * @param {string} key
 */
export function clearPendingAudioContext(key) {
  removeEntry(key);
}

/**
 * Whether an inbound audio should be treated as studio material (not only STT).
 * @param {string} key
 * @param {string} [caption]
 */
export function shouldRouteAudioToStudio(key, caption = '') {
  const pending = getPendingAudioContext(key);
  if (pending?.kind === 'instruction') return true;
  if (/st[uü]dyo|mix|master|d[uü]zenle|temizle|analiz|profesyonel/i.test(String(caption || ''))) {
    return true;
  }
  return false;
}

/** Test helper */
export function _resetAudioContextStore() {
  pendingByKey.clear();
  writeDisk({ version: 1, entries: {} });
}

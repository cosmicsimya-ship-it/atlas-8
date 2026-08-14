// ═══════════════════════════════════════════════════════════════════════
// Conversation Persistence — authenticated chat history
// JSON storage, same pattern as server/analysis-archive.js.
//
// This is NOT the same thing as server/user-memory.js:
//   - user-memory.js stores extracted personal-context FACTS Atlas recalls
//   - this file stores raw CHAT TURNS (what was actually said)
// Never let one leak into the other.
//
// Guest (anonymous) users are never persisted here — that decision is
// enforced by the caller (server/index.js), not by this store, so the
// store itself stays a generic per-userId key-value structure.
// ═══════════════════════════════════════════════════════════════════════

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { isValidUserId } from './user-memory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
let CONVERSATIONS_FILE = join(DATA_DIR, 'conversations.json');

/** @type {Promise<void>} */
let writeLock = Promise.resolve();

export function configureConversationStore(filePath) {
  CONVERSATIONS_FILE = filePath;
}

export function getConversationStorePath() {
  return CONVERSATIONS_FILE;
}

/** Bounded retention — env-overridable, safe fail-safe defaults. */
export function getConversationBounds() {
  const maxConversations = Number(process.env.ATLAS_CONV_MAX_PER_USER || 30);
  const maxMessages = Number(process.env.ATLAS_CONV_MAX_MESSAGES || 200);
  const maxMessageChars = Number(process.env.ATLAS_CONV_MAX_MESSAGE_CHARS || 8000);
  return {
    maxConversationsPerUser: Number.isFinite(maxConversations) && maxConversations > 0 ? maxConversations : 30,
    maxMessagesPerConversation: Number.isFinite(maxMessages) && maxMessages > 0 ? maxMessages : 200,
    maxMessageChars: Number.isFinite(maxMessageChars) && maxMessageChars > 0 ? maxMessageChars : 8000,
  };
}

function createEmptyStore() {
  return { users: {} };
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function recoverCorruptFile(raw, err) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const corruptPath = `${CONVERSATIONS_FILE}.corrupt.${stamp}.json`;
  try {
    writeFileSync(corruptPath, raw, 'utf-8');
    console.error(`[Conversations] Corrupt file archived to ${corruptPath}: ${err.message}`);
  } catch {
    /* ignore */
  }
  return createEmptyStore();
}

export function loadConversations() {
  ensureDataDir();
  if (!existsSync(CONVERSATIONS_FILE)) {
    return createEmptyStore();
  }
  let raw;
  try {
    raw = readFileSync(CONVERSATIONS_FILE, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read conversations file: ${err.message}`);
  }
  if (!raw.trim()) {
    return createEmptyStore();
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.users || typeof parsed.users !== 'object') {
      return recoverCorruptFile(raw, new Error('Invalid conversations root'));
    }
    return parsed;
  } catch (err) {
    return recoverCorruptFile(raw, err);
  }
}

export function saveConversations(store) {
  if (!store?.users || typeof store.users !== 'object') {
    return { ok: false, error: 'Invalid conversations store' };
  }
  ensureDataDir();
  const payload = `${JSON.stringify(store, null, 2)}\n`;
  const tempPath = `${CONVERSATIONS_FILE}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tempPath, payload, 'utf-8');
    renameSync(tempPath, CONVERSATIONS_FILE);
    return { ok: true };
  } catch (err) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {
      /* ignore */
    }
    return { ok: false, error: err.message };
  }
}

async function withWriteLock(fn) {
  const run = writeLock.then(fn, fn);
  writeLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function normalizeMessage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const role = raw.role === 'assistant' ? 'assistant' : raw.role === 'user' ? 'user' : null;
  if (!role) return null;
  const { maxMessageChars } = getConversationBounds();
  const rawContent = typeof raw.content === 'string' ? raw.content : '';
  const content = rawContent.length > maxMessageChars ? rawContent.slice(0, maxMessageChars) : rawContent;
  return {
    id: String(raw.id ?? randomUUID()),
    role,
    content,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    // Never store raw base64 — presence/type metadata only. See index.js call site.
    hasImage: Boolean(raw.hasImage),
    imageMimeType: raw.hasImage && typeof raw.imageMimeType === 'string' ? raw.imageMimeType : null,
    // Retry/idempotency key from the client, when provided. Not authoritative
    // for anything security-sensitive — only used to avoid double-writing the
    // same user turn on a client-side retry.
    clientRequestId: typeof raw.clientRequestId === 'string' && raw.clientRequestId ? raw.clientRequestId : null,
  };
}

function normalizeConversation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const messages = Array.isArray(raw.messages) ? raw.messages.map(normalizeMessage).filter(Boolean) : [];
  return {
    id: String(raw.id ?? randomUUID()),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
    messages,
  };
}

function toSummary(conversation) {
  const last = conversation.messages[conversation.messages.length - 1];
  return {
    id: conversation.id,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length,
    preview: last ? last.content.slice(0, 140) : '',
  };
}

/**
 * @param {string} userId
 * @returns {Array<{id:string, createdAt:string, updatedAt:string, messageCount:number, preview:string}>}
 */
export function listUserConversations(userId) {
  if (!isValidUserId(userId)) throw new Error('Invalid user ID');
  const store = loadConversations();
  const list = store.users[userId]?.conversations;
  if (!Array.isArray(list)) return [];
  return list
    .map(normalizeConversation)
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(toSummary);
}

/**
 * Ownership-checked full read. Returns null if not found OR not owned —
 * callers must not distinguish the two in the HTTP response (avoid leaking
 * existence of other users' conversation ids).
 * @param {string} userId
 * @param {string} conversationId
 */
export function getConversation(userId, conversationId) {
  if (!isValidUserId(userId)) throw new Error('Invalid user ID');
  const store = loadConversations();
  const list = store.users[userId]?.conversations;
  if (!Array.isArray(list)) return null;
  const found = list.find((c) => c?.id === conversationId);
  return found ? normalizeConversation(found) : null;
}

/**
 * Append a message to a conversation. If conversationId is missing or not
 * owned by this user, a NEW conversation is created (never silently writes
 * into another user's conversation).
 * @param {string} userId
 * @param {string|null|undefined} conversationId
 * @param {{role:'user'|'assistant', content:string, hasImage?:boolean, imageMimeType?:string|null}} message
 * @returns {Promise<{ok:true, conversationId:string, messageId:string} | {ok:false, error:string}>}
 */
export async function appendMessage(userId, conversationId, message) {
  if (!isValidUserId(userId)) return { ok: false, error: 'Invalid user ID' };
  const normalizedMsg = normalizeMessage({ ...message, id: randomUUID() });
  if (!normalizedMsg) return { ok: false, error: 'Invalid message' };

  return withWriteLock(() => {
    const store = loadConversations();
    if (!store.users[userId]) store.users[userId] = { conversations: [] };
    if (!Array.isArray(store.users[userId].conversations)) store.users[userId].conversations = [];

    const bucket = store.users[userId].conversations;
    const bounds = getConversationBounds();
    const now = new Date().toISOString();

    let conversation = conversationId ? bucket.find((c) => c?.id === conversationId) : null;

    if (!conversation) {
      conversation = { id: randomUUID(), createdAt: now, updatedAt: now, messages: [] };
      bucket.push(conversation);
      // Bounded: drop oldest (least recently updated) conversations beyond the cap.
      if (bucket.length > bounds.maxConversationsPerUser) {
        bucket.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        while (bucket.length > bounds.maxConversationsPerUser) bucket.shift();
      }
    }

    if (!Array.isArray(conversation.messages)) conversation.messages = [];
    conversation.messages.push(normalizedMsg);
    // Bounded: keep only the most recent N messages (sliding window).
    if (conversation.messages.length > bounds.maxMessagesPerConversation) {
      conversation.messages = conversation.messages.slice(-bounds.maxMessagesPerConversation);
    }
    conversation.updatedAt = now;

    const saved = saveConversations(store);
    if (!saved.ok) return saved;
    return { ok: true, conversationId: conversation.id, messageId: normalizedMsg.id };
  });
}

/**
 * @param {string} userId
 * @param {string} conversationId
 */
export async function deleteConversation(userId, conversationId) {
  if (!isValidUserId(userId)) return { ok: false, error: 'Invalid user ID' };
  return withWriteLock(() => {
    const store = loadConversations();
    const bucket = store.users[userId]?.conversations;
    if (!Array.isArray(bucket)) return { ok: false, error: 'Conversation not found' };
    const next = bucket.filter((c) => c?.id !== conversationId);
    if (next.length === bucket.length) return { ok: false, error: 'Conversation not found' };
    store.users[userId].conversations = next;
    const saved = saveConversations(store);
    if (!saved.ok) return saved;
    return { ok: true };
  });
}

/** Privacy erase — removes ALL conversations for a user. Wired into DELETE /api/memory/:userId. */
export async function deleteAllUserConversations(userId) {
  if (!isValidUserId(userId)) return { ok: false, error: 'Invalid user ID' };
  return withWriteLock(() => {
    const store = loadConversations();
    if (!store.users[userId]) return { ok: true, deleted: 0 };
    const count = Array.isArray(store.users[userId].conversations)
      ? store.users[userId].conversations.length
      : 0;
    delete store.users[userId];
    const saved = saveConversations(store);
    if (!saved.ok) return saved;
    return { ok: true, deleted: count };
  });
}

export function resetConversationStoreForTests() {
  const saved = saveConversations(createEmptyStore());
  return saved;
}

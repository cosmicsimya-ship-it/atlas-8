// ═══════════════════════════════════════════════════════════════════════
// Privacy event logger — never stores raw private content
// ═══════════════════════════════════════════════════════════════════════

import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const EVENTS_FILE = join(DATA_DIR, 'privacy_events.json');
const MAX_EVENTS = 500;

/**
 * @param {string|null|undefined} id
 */
export function hashRequesterId(id) {
  if (!id || typeof id !== 'string') return 'redacted';
  return createHash('sha256').update(id.trim()).digest('hex').slice(0, 16);
}

function ensureStore() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(EVENTS_FILE)) {
    writeFileSync(EVENTS_FILE, JSON.stringify({ events: [] }, null, 2), 'utf-8');
  }
}

/**
 * @returns {{ events: object[] }}
 */
function loadEventsSafe() {
  try {
    ensureStore();
    const raw = readFileSync(EVENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.events)) return { events: [] };
    return parsed;
  } catch {
    return { events: [] };
  }
}

/**
 * Record a privacy/security event without storing leaked private text.
 * Logging failure must never throw to callers.
 *
 * @param {{
 *   channel?: string,
 *   requesterId?: string|null,
 *   eventType: string,
 *   action: string,
 *   requestType?: string,
 *   reason?: string,
 * }} event
 * @returns {boolean} whether logging succeeded
 */
export function logPrivacyEvent(event) {
  try {
    const store = loadEventsSafe();
    const entry = {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      channel: event.channel ?? 'api',
      requesterIdHash: hashRequesterId(event.requesterId),
      eventType: String(event.eventType ?? 'privacy_event'),
      action: String(event.action ?? 'blocked'),
      requestType: event.requestType ? String(event.requestType) : undefined,
      reason: event.reason ? String(event.reason).slice(0, 200) : undefined,
    };

    store.events.push(entry);
    if (store.events.length > MAX_EVENTS) {
      store.events = store.events.slice(-MAX_EVENTS);
    }

    ensureStore();
    writeFileSync(EVENTS_FILE, JSON.stringify(store, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[Privacy] event log failed (non-fatal):', err?.message ?? err);
    return false;
  }
}

export function getPrivacyEventsFilePath() {
  return EVENTS_FILE;
}

/**
 * Test helper — does not delete production data unless path overridden.
 * @param {string} [filePath]
 */
export function resetPrivacyEventsForTests(filePath = EVENTS_FILE) {
  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, JSON.stringify({ events: [] }, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

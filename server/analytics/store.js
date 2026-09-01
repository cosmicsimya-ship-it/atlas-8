// ═══════════════════════════════════════════════════════════════════════
// Analytics event store — minimal, privacy-safe product event tracking.
//
// This is the REAL, server-persisted analytics foundation. It is separate
// from and does not replace src/pages/Analytics.tsx (a pre-existing mock
// UI with no backing data source) or src/utils/discoverability-events.ts
// (a narrower, local-only sessionStorage ring for chat-onboarding UX).
//
// Hard rules enforced here: no PII fields, no message/response content,
// no IP address, no user-agent. Events are versioned (schemaVersion) and
// validated against a fixed vocabulary — anything else is rejected, not
// silently accepted.
//
// Same JSON-file-store shape as server/auth/admin-audit.js: atomic
// write-then-rename, fail-soft reads, bounded size (oldest events rotate
// out).
// ═══════════════════════════════════════════════════════════════════════

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '..', '..', 'data', 'analytics_events.json');
const MAX_ENTRIES = 20000;

export const SCHEMA_VERSION = 1;

export const EVENT_NAMES = [
  'login',
  'signup',
  'google_login',
  'message_sent',
  'response_generated',
  'quran_lookup',
  'dream_interpretation',
  'feedback_submitted',
  'thumbs_up',
  'thumbs_down',
  'prime_viewed',
  'pricing_viewed',
];

const MAX_PROP_KEYS = 10;
const MAX_PROP_STRING_LENGTH = 200;

/** Reject obviously PII/content-shaped keys even if a caller forgets. */
const DISALLOWED_PROP_KEYS = new Set([
  'email',
  'password',
  'ip',
  'ipaddress',
  'useragent',
  'phone',
  'message',
  'content',
  'prompt',
  'reply',
  'name',
  'fullname',
  'displayname',
  'address',
]);

/** @type {string} */
let storePath = DEFAULT_PATH;

export function configureAnalyticsStore(filePath) {
  storePath = filePath || DEFAULT_PATH;
}

export function getAnalyticsStorePath() {
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
 * Flat, bounded, PII-denylist-filtered event properties. Objects/arrays are
 * dropped rather than nested — keeps entries small and inspectable.
 */
function sanitizeProps(props) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return {};
  const out = {};
  let count = 0;
  for (const [key, value] of Object.entries(props)) {
    if (count >= MAX_PROP_KEYS) break;
    if (typeof key !== 'string' || !key) continue;
    if (DISALLOWED_PROP_KEYS.has(key.toLowerCase())) continue;
    if (value === null) {
      out[key] = null;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === 'boolean') {
      out[key] = value;
    } else if (typeof value === 'string') {
      out[key] = value.slice(0, MAX_PROP_STRING_LENGTH);
    } else {
      continue; // objects/arrays/functions: skip
    }
    count += 1;
  }
  return out;
}

/**
 * Validate + persist one analytics event. NEVER throws — analytics must
 * never break the feature that triggered it. Malformed events (unknown
 * name) are rejected with ok:false rather than silently coerced.
 *
 * @param {{ name: string, userId?: string|null, source?: string, props?: Record<string, unknown> }} input
 * @returns {{ ok: boolean, error?: string }}
 */
export function recordAnalyticsEvent(input) {
  try {
    const name = typeof input?.name === 'string' ? input.name : null;
    if (!name || !EVENT_NAMES.includes(name)) {
      return { ok: false, error: `event name must be one of: ${EVENT_NAMES.join(', ')}` };
    }
    const entry = {
      id: `ev_${randomUUID()}`,
      v: SCHEMA_VERSION,
      name,
      timestamp: new Date().toISOString(),
      userId: input?.userId ? String(input.userId).trim().slice(0, 200) || null : null,
      source: input?.source ? String(input.source).trim().slice(0, 80) || 'web' : 'web',
      props: sanitizeProps(input?.props),
    };
    const store = loadStore();
    store.events.push(entry);
    if (store.events.length > MAX_ENTRIES) {
      store.events = store.events.slice(-MAX_ENTRIES);
    }
    saveStore(store);
    return { ok: true };
  } catch (err) {
    console.error('[Analytics] record failed (non-fatal):', err?.message ?? err);
    return { ok: false, error: 'internal' };
  }
}

function withinDays(iso, days) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= days * 24 * 60 * 60 * 1000;
}

/**
 * Aggregate counts for the Admin Control Center. No raw event rows (which
 * could carry a userId) are returned here — counts only.
 */
export function getAnalyticsAggregate() {
  const store = loadStore();
  const events = store.events;

  const countsByName = {};
  for (const name of EVENT_NAMES) countsByName[name] = 0;
  for (const e of events) {
    if (countsByName[e.name] !== undefined) countsByName[e.name] += 1;
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    totalEvents: events.length,
    eventsLast24h: events.filter((e) => withinDays(e.timestamp, 1)).length,
    eventsLast7d: events.filter((e) => withinDays(e.timestamp, 7)).length,
    countsByName,
  };
}

export function resetAnalyticsStoreForTests(filePath) {
  if (filePath) configureAnalyticsStore(filePath);
  ensureDir(storePath);
  writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), 'utf8');
}

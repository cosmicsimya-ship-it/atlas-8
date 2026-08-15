// ═══════════════════════════════════════════════════════════════════════
// Prime daily check-in — minimal personal state, owner-scoped.
// Stored on the existing user-memory record (primeCheckins) so privacy
// erase via deleteUserMemory removes it with the rest of personal data.
//
// Never trusts a client-supplied userId. Never fabricates a check-in.
// Frequency is a self-reflection label derived from answers, not a
// biological measurement.
// ═══════════════════════════════════════════════════════════════════════

import { getUserMemory, updateUserMemory, isValidUserId, listStoredMemoryUserIds } from '../user-memory.js';

export const ENERGY_VALUES = Object.freeze(['low', 'steady', 'high']);
export const FOCUS_VALUES = Object.freeze(['restore', 'think', 'create', 'connect']);
export const FREQUENCY_LEVELS = Object.freeze(['LOW', 'BALANCED', 'HIGH']);
export const RECOMMENDATION_VALUES = Object.freeze(['slow_down', 'focus', 'restore', 'create', 'connect']);

export const MAX_INTENTION_LENGTH = 200;
export const MAX_HISTORY = 30;

const FORBIDDEN_AUTHORITY_FIELDS = Object.freeze([
  'userId',
  'plan',
  'role',
  'roles',
  'entitlements',
  'subscription',
  'usage',
  'isAdmin',
  'isFounder',
  'date',
]);

/**
 * Civil date in an IANA timezone. Falls back to UTC ISO date.
 * @param {string|null|undefined} timezone
 * @param {Date} [now]
 */
export function civilDateKey(timezone, now = new Date()) {
  const tz = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'Europe/Istanbul';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * @param {unknown} raw
 * @returns {null | { date: string, energy: string, focus: string, intention: string|null, createdAt: string, updatedAt: string }}
 */
export function parseCheckinRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!isIsoDate(raw.date)) return null;
  if (!ENERGY_VALUES.includes(raw.energy)) return null;
  if (!FOCUS_VALUES.includes(raw.focus)) return null;
  let intention = null;
  if (raw.intention != null) {
    if (typeof raw.intention !== 'string') return null;
    const trimmed = raw.intention.trim().slice(0, MAX_INTENTION_LENGTH);
    intention = trimmed || null;
  }
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : null;
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt;
  if (!createdAt) return null;
  return {
    date: raw.date,
    energy: raw.energy,
    focus: raw.focus,
    intention,
    createdAt,
    updatedAt: updatedAt || createdAt,
  };
}

/**
 * Validate a POST payload. userId/date/authority fields are rejected —
 * date is always bound to the server's civil today for the user timezone.
 * @param {Record<string, unknown>} body
 */
export function validateCheckinPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid payload' };
  }
  for (const key of FORBIDDEN_AUTHORITY_FIELDS) {
    if (key in body) {
      return { ok: false, error: `Field not allowed: ${key}` };
    }
  }
  if (!ENERGY_VALUES.includes(body.energy)) {
    return { ok: false, error: 'Invalid energy' };
  }
  if (!FOCUS_VALUES.includes(body.focus)) {
    return { ok: false, error: 'Invalid focus' };
  }
  if (body.intention != null && typeof body.intention !== 'string') {
    return { ok: false, error: 'Invalid intention' };
  }
  if (typeof body.intention === 'string' && body.intention.length > MAX_INTENTION_LENGTH) {
    return { ok: false, error: 'Intention too long' };
  }
  const intention =
    typeof body.intention === 'string' ? body.intention.trim().slice(0, MAX_INTENTION_LENGTH) || null : null;
  return { ok: true, value: { energy: body.energy, focus: body.focus, intention } };
}

/**
 * Self-reflection indicator. Explicitly not a medical or biological score.
 * @param {{ energy: string, focus: string } | null} checkin
 */
export function deriveFrequency(checkin) {
  if (!checkin || !ENERGY_VALUES.includes(checkin.energy)) return null;

  let level = 'BALANCED';
  if (checkin.energy === 'low') level = 'LOW';
  else if (checkin.energy === 'high') level = 'HIGH';

  /** @type {string} */
  let recommendation = 'focus';
  if (checkin.energy === 'low') {
    recommendation = checkin.focus === 'restore' ? 'restore' : 'slow_down';
  } else if (checkin.energy === 'high') {
    if (checkin.focus === 'create') recommendation = 'create';
    else if (checkin.focus === 'connect') recommendation = 'connect';
    else recommendation = 'focus';
  } else if (checkin.focus === 'restore') {
    recommendation = 'restore';
  } else if (checkin.focus === 'create') {
    recommendation = 'create';
  } else if (checkin.focus === 'connect') {
    recommendation = 'connect';
  } else {
    recommendation = 'focus';
  }

  const labels = {
    slow_down: 'Yavaşla',
    focus: 'Odaklan',
    restore: 'Toparlan',
    create: 'Üret',
    connect: 'Bağlan',
  };

  return {
    level,
    framing: 'Kendi yansıtman — biyolojik bir ölçüm değil.',
    recommendation,
    recommendationLabel: labels[recommendation] || 'Odaklan',
  };
}

function readCheckins(userId) {
  const memory = getUserMemory(userId);
  const raw = Array.isArray(memory?.primeCheckins) ? memory.primeCheckins : [];
  const parsed = [];
  for (const entry of raw) {
    const rec = parseCheckinRecord(entry);
    if (rec) parsed.push(rec);
  }
  parsed.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { timezone: memory?.profile?.timezone || null, checkins: parsed };
}

/**
 * @param {string} userId
 * @param {{ timezone?: string|null, now?: Date }} [opts]
 */
export function getTodayCheckin(userId, opts = {}) {
  if (!isValidUserId(userId)) return { ok: false, error: 'Invalid user ID' };
  const { timezone, checkins } = readCheckins(userId);
  const date = civilDateKey(opts.timezone || timezone, opts.now);
  const record = checkins.find((c) => c.date === date) || null;
  return {
    ok: true,
    date,
    checkin: record,
    frequency: deriveFrequency(record),
  };
}

/**
 * @param {string} userId
 * @param {{ limit?: number }} [opts]
 */
export function listCheckinHistory(userId, opts = {}) {
  if (!isValidUserId(userId)) return { ok: false, error: 'Invalid user ID' };
  const limit = Math.min(Math.max(Number(opts.limit) || 14, 1), MAX_HISTORY);
  const { checkins } = readCheckins(userId);
  const items = checkins.slice(-limit).reverse();
  return { ok: true, items };
}

/**
 * Previous check-in (not today), when one exists.
 * @param {string} userId
 * @param {{ timezone?: string|null, now?: Date }} [opts]
 */
export function getPreviousCheckin(userId, opts = {}) {
  if (!isValidUserId(userId)) return null;
  const { timezone, checkins } = readCheckins(userId);
  const today = civilDateKey(opts.timezone || timezone, opts.now);
  const prior = checkins.filter((c) => c.date < today);
  return prior.length ? prior[prior.length - 1] : null;
}

/**
 * Upsert today's check-in for the authenticated user.
 * @param {string} userId
 * @param {Record<string, unknown>} body
 * @param {{ timezone?: string|null, now?: Date }} [opts]
 */
export async function saveTodayCheckin(userId, body, opts = {}) {
  if (!isValidUserId(userId)) return { ok: false, error: 'Invalid user ID' };
  const validated = validateCheckinPayload(body);
  if (!validated.ok) return validated;

  const { timezone, checkins } = readCheckins(userId);
  const date = civilDateKey(opts.timezone || timezone, opts.now);
  const nowIso = (opts.now || new Date()).toISOString();
  const existing = checkins.find((c) => c.date === date);
  const record = {
    date,
    energy: validated.value.energy,
    focus: validated.value.focus,
    intention: validated.value.intention,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };

  const next = checkins.filter((c) => c.date !== date);
  next.push(record);
  next.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const bounded = next.slice(-MAX_HISTORY);

  const saved = await updateUserMemory(userId, { primeCheckins: bounded });
  if (!saved.ok) return saved;

  return {
    ok: true,
    checkin: record,
    frequency: deriveFrequency(record),
  };
}

/**
 * Count check-ins on a civil date across stored memories. Aggregate only —
 * never returns intention text.
 * @param {string} date
 * @param {(id: string) => boolean} [userIdFilter]
 */
export function countCheckinsOnDate(date, userIdFilter) {
  if (!isIsoDate(date)) return 0;
  let n = 0;
  for (const userId of listStoredMemoryUserIds()) {
    if (userIdFilter && !userIdFilter(userId)) continue;
    const { checkins } = readCheckins(userId);
    if (checkins.some((c) => c.date === date)) n += 1;
  }
  return n;
}

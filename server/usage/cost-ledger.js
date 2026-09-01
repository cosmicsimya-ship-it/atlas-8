// ═══════════════════════════════════════════════════════════════════════
// Cost ledger — per-request model/provider usage + cost tracking.
//
// Canonical source for the Admin Costs panel. Every entry is written from
// a real callOpenAI() invocation outcome (success or failure) — nothing
// here is estimated or fabricated. When the price for a model is not known
// (not present in openai-client.js's COST_PER_1K table), the entry records
// costUsd: null rather than inventing a number; aggregates skip null-cost
// entries and report how many were skipped.
//
// Same JSON-file-store shape as server/auth/admin-audit.js and
// server/feedback/store.js: atomic write-then-rename, in-process write
// lock, fail-soft reads, bounded size (oldest entries rotate out).
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
const DEFAULT_PATH = join(__dirname, '..', '..', 'data', 'cost_ledger.json');
const MAX_ENTRIES = 20000;

/** @type {string} */
let storePath = DEFAULT_PATH;

export function configureCostLedgerStore(filePath) {
  storePath = filePath || DEFAULT_PATH;
}

export function getCostLedgerStorePath() {
  return storePath;
}

function emptyStore() {
  return { entries: [] };
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
    if (!parsed || !Array.isArray(parsed.entries)) return emptyStore();
    return { entries: [...parsed.entries] };
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

function boundedString(value, maxLength) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (!str) return null;
  return str.slice(0, maxLength);
}

function toFiniteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Record one model/provider invocation outcome. NEVER throws — a ledger
 * write failure must never block the real chat/completion response that
 * triggered it. Returns false (and logs) on failure instead.
 *
 * @param {{
 *   provider: string,
 *   model?: string|null,
 *   userId?: string|null,
 *   source?: string,
 *   inputTokens?: number|null,
 *   outputTokens?: number|null,
 *   totalTokens?: number|null,
 *   costUsd?: number|null,
 *   success: boolean,
 *   errorCode?: string|null,
 *   latencyMs?: number|null,
 * }} entryInput
 * @returns {boolean}
 */
export function recordCostLedgerEntry(entryInput) {
  try {
    const entry = {
      id: `cl_${randomUUID()}`,
      timestamp: new Date().toISOString(),
      userId: boundedString(entryInput?.userId, 200),
      provider: boundedString(entryInput?.provider, 60) || 'unknown',
      model: boundedString(entryInput?.model, 100),
      source: boundedString(entryInput?.source, 80) || 'unknown',
      inputTokens: toFiniteOrNull(entryInput?.inputTokens),
      outputTokens: toFiniteOrNull(entryInput?.outputTokens),
      totalTokens: toFiniteOrNull(entryInput?.totalTokens),
      // null = price unknown for this model. Never a fabricated fallback.
      costUsd: toFiniteOrNull(entryInput?.costUsd),
      success: Boolean(entryInput?.success),
      errorCode: boundedString(entryInput?.errorCode, 100),
      latencyMs: toFiniteOrNull(entryInput?.latencyMs),
    };
    const store = loadStore();
    store.entries.push(entry);
    if (store.entries.length > MAX_ENTRIES) {
      store.entries = store.entries.slice(-MAX_ENTRIES);
    }
    saveStore(store);
    return true;
  } catch (err) {
    console.error('[CostLedger] record failed (non-fatal):', err?.message ?? err);
    return false;
  }
}

function withinDays(iso, days) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= days * 24 * 60 * 60 * 1000;
}

function sumKnownCost(rows) {
  let total = 0;
  let hasKnown = false;
  for (const r of rows) {
    if (typeof r.costUsd === 'number') {
      total += r.costUsd;
      hasKnown = true;
    }
  }
  return hasKnown ? Math.round(total * 1_000_000) / 1_000_000 : null;
}

function sumGroupedCost(rows, keyFn) {
  const out = {};
  for (const r of rows) {
    if (typeof r.costUsd !== 'number') continue;
    const key = keyFn(r) || 'unknown';
    out[key] = (out[key] || 0) + r.costUsd;
  }
  // Round each bucket for display stability.
  for (const key of Object.keys(out)) {
    out[key] = Math.round(out[key] * 1_000_000) / 1_000_000;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Canonical aggregate, field-shape-compatible with the prior
 * getAdminCosts() stub in server/admin/control-center.js.
 */
export function getCostLedgerAggregate() {
  const store = loadStore();
  const entries = store.entries;

  const today = entries.filter((e) => withinDays(e.timestamp, 1));
  const sevenDay = entries.filter((e) => withinDays(e.timestamp, 7));
  const thirtyDay = entries.filter((e) => withinDays(e.timestamp, 30));

  const unknownPriceCount = entries.filter((e) => e.success && e.costUsd === null).length;
  const failedCount = entries.filter((e) => !e.success).length;

  return {
    authoritative: true,
    reason: 'COST_LEDGER_ACTIVE',
    message:
      entries.length === 0
        ? 'Henüz kayıtlı model çağrısı yok.'
        : unknownPriceCount > 0
          ? `${unknownPriceCount} başarılı çağrı için fiyat bilgisi (COST_PER_1K) tanımlı değil; bu çağrılar toplam maliyetten hariç tutuldu, uydurulmadı.`
          : 'Maliyet verisi cost-ledger üzerinden gerçek kayıtlardan hesaplanıyor.',
    totalEntries: entries.length,
    failedCallCount: failedCount,
    unknownPriceCount,
    todayEstimatedCost: sumKnownCost(today),
    sevenDayEstimatedCost: sumKnownCost(sevenDay),
    thirtyDayEstimatedCost: sumKnownCost(thirtyDay),
    costByProvider: sumGroupedCost(thirtyDay, (e) => e.provider),
    costByUser: sumGroupedCost(thirtyDay, (e) => e.userId || 'anonymous'),
    // No true "capability" dimension exists in the ledger yet; source (the
    // call site, e.g. chat/quran_explain/ai_complete) is the closest real
    // grouping available today, kept under this field name for API-shape
    // compatibility with earlier callers of getAdminCosts().
    costByCapability: sumGroupedCost(thirtyDay, (e) => e.source),
  };
}

export function resetCostLedgerForTests(filePath) {
  if (filePath) configureCostLedgerStore(filePath);
  ensureDir(storePath);
  writeFileSync(storePath, JSON.stringify(emptyStore(), null, 2), 'utf8');
}

/**
 * Structured request timing for Atlas message pipeline.
 * Logs durations only — never message content or PII.
 */

import { randomBytes } from 'crypto';

export const REQUEST_TIMING_VERSION = 'atlas-request-timing-v1';

/**
 * @typedef {{
 *   name: string,
 *   durationMs: number,
 *   startedAtMs: number,
 *   endedAtMs: number,
 * }} TimingPhase
 */

/**
 * @typedef {{
 *   version: string,
 *   requestId: string,
 *   conversationRef: string|null,
 *   channel: string|null,
 *   intent: string|null,
 *   engine: string|null,
 *   phases: TimingPhase[],
 *   totalDurationMs: number,
 *   llmCallCount: number,
 *   usedRetryOrFallback: boolean,
 * }} RequestTimingSnapshot
 */

/**
 * Anonymize conversation id for logs (stable short hash, not reversible PII dump).
 * @param {string|null|undefined} conversationId
 */
export function safeConversationRef(conversationId) {
  const raw = String(conversationId || '').trim();
  if (!raw) return null;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `c_${hash.toString(16).padStart(8, '0')}`;
}

/**
 * @param {{
 *   channel?: string|null,
 *   conversationId?: string|null,
 *   requestId?: string,
 * }} [opts]
 */
export function createRequestTiming(opts = {}) {
  const startedAt = performance.now();
  /** @type {Map<string, number>} */
  const open = new Map();
  /** @type {TimingPhase[]} */
  const phases = [];
  let llmCallCount = 0;
  let usedRetryOrFallback = false;

  const requestId =
    opts.requestId || `req_${randomBytes(6).toString('hex')}`;

  return {
    requestId,
    conversationRef: safeConversationRef(opts.conversationId),
    channel: opts.channel || null,

    /**
     * @param {string} name
     */
    start(name) {
      open.set(name, performance.now());
    },

    /**
     * @param {string} name
     */
    end(name) {
      const t0 = open.get(name);
      const endedAtMs = performance.now();
      const startedAtMs = t0 ?? endedAtMs;
      open.delete(name);
      phases.push({
        name,
        durationMs: Math.round((endedAtMs - startedAtMs) * 100) / 100,
        startedAtMs: Math.round(startedAtMs * 100) / 100,
        endedAtMs: Math.round(endedAtMs * 100) / 100,
      });
    },

    /**
     * Mark an instantaneous checkpoint (zero-duration phase).
     * @param {string} name
     */
    mark(name) {
      const now = performance.now();
      phases.push({
        name,
        durationMs: 0,
        startedAtMs: Math.round(now * 100) / 100,
        endedAtMs: Math.round(now * 100) / 100,
      });
    },

    noteLlmCall() {
      llmCallCount += 1;
    },

    noteRetryOrFallback() {
      usedRetryOrFallback = true;
    },

    /**
     * @param {{ intent?: string|null, engine?: string|null }} [meta]
     * @returns {RequestTimingSnapshot}
     */
    snapshot(meta = {}) {
      // Close any still-open phases
      for (const name of [...open.keys()]) {
        this.end(name);
      }
      const totalDurationMs =
        Math.round((performance.now() - startedAt) * 100) / 100;
      return {
        version: REQUEST_TIMING_VERSION,
        requestId,
        conversationRef: safeConversationRef(opts.conversationId),
        channel: opts.channel || null,
        intent: meta.intent ?? null,
        engine: meta.engine ?? null,
        phases: [...phases],
        totalDurationMs,
        llmCallCount,
        usedRetryOrFallback,
      };
    },
  };
}

/**
 * @param {RequestTimingSnapshot} snapshot
 */
export function logRequestTiming(snapshot) {
  if (!snapshot) return;
  const phaseSummary = (snapshot.phases || [])
    .map((p) => `${p.name}=${p.durationMs}ms`)
    .join(' ');
  console.log(
    `[Atlas/timing] id=${snapshot.requestId} conv=${snapshot.conversationRef || 'none'}` +
      ` channel=${snapshot.channel || 'unknown'} intent=${snapshot.intent || 'n/a'}` +
      ` engine=${snapshot.engine || 'n/a'} total=${snapshot.totalDurationMs}ms` +
      ` llmCalls=${snapshot.llmCallCount} retryOrFallback=${snapshot.usedRetryOrFallback}` +
      (phaseSummary ? ` phases{${phaseSummary}}` : ''),
  );
}

/**
 * Attach timing snapshot to a message result (mutates data, keeps reply intact).
 * @param {object} result
 * @param {ReturnType<typeof createRequestTiming>} timing
 * @returns {object}
 */
export function attachRequestTiming(result, timing) {
  if (!result || !timing) return result;
  const snap = timing.snapshot({
    intent: result.intent ?? null,
    engine: result.engine ?? null,
  });
  logRequestTiming(snap);
  const existingLatency = Number(result?.data?.latencyMs);
  return {
    ...result,
    data: {
      ...(result.data ?? {}),
      requestTiming: snap,
      latencyMs:
        Number.isFinite(existingLatency) && existingLatency > 0
          ? existingLatency
          : snap.totalDurationMs,
    },
  };
}

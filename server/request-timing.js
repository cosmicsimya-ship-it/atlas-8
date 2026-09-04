/**
 * Structured request timing for Atlas message pipeline.
 * Logs durations only — never message content or PII.
 *
 * ATLAS LAB extension (additive, dev/admin-observability only): the
 * snapshot now also carries a bounded set of routing/diagnosis fields
 * (selectedDomain, selectedTools, routingDecision, modelUsed,
 * postProcessors, contextMessageCount, userMessageSummary, ...) so a
 * developer can see WHY a turn was routed the way it was, without ever
 * capturing model chain-of-thought (there is none captured here — only
 * the same intent/engine/data fields every dispatch branch in
 * atlas-message-service.js already returns as its normal result shape).
 * Every new field is nullable and populated ONLY from data the pipeline
 * already produces; nothing here changes what is computed or returned
 * to the user — attachRequestTiming() only reads `result`, it never
 * mutates `result.reply` or `result.status`.
 */

import { randomBytes, createHash } from 'crypto';

export const REQUEST_TIMING_VERSION = 'atlas-request-timing-v2';

// Bounded, truncated summaries only — same "hash ids, truncate text"
// discipline already used by server/telegram.js's own structured traces
// (see logGroupContextTrace's textSummary). Enough to diagnose a routing
// decision; never the unbounded raw message.
const SUMMARY_MAX_CHARS = 200;

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
 *   interactionId: string,
 *   requestId: string,
 *   timestamp: string,
 *   conversationRef: string|null,
 *   userRef: string|null,
 *   channel: string|null,
 *   userMessageSummary: string|null,
 *   contextMessageCount: number|null,
 *   intent: string|null,
 *   engine: string|null,
 *   selectedDomain: string|null,
 *   selectedTools: string[],
 *   routingDecision: string|null,
 *   retrievalSources: string[],
 *   modelUsed: string|null,
 *   requestedModel: string|null,
 *   fallbackPath: string|null,
 *   postProcessors: string[],
 *   responseSummary: string|null,
 *   errorState: string|null,
 *   phases: TimingPhase[],
 *   totalDurationMs: number,
 *   llmCallCount: number,
 *   usedRetryOrFallback: boolean,
 * }} RequestTimingSnapshot
 */

function truncate(text, max = SUMMARY_MAX_CHARS) {
  const str = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!str) return null;
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

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
 * Same scheme as safeConversationRef, distinct prefix — never the raw
 * userId (which for Telegram embeds a real numeric Telegram user id).
 * @param {string|null|undefined} userId
 */
export function safeUserRef(userId) {
  const raw = String(userId || '').trim();
  if (!raw) return null;
  return `u_${createHash('sha256').update(raw).digest('hex').slice(0, 12)}`;
}

/**
 * Which known post-processors/verifiers actually ran and had an effect,
 * derived from the exact boolean flags finalizeMessageResult() already
 * sets on result.data (server/atlas-message-service.js) — no new checks,
 * just naming the ones that already exist.
 * @param {Record<string, unknown>|null|undefined} data
 */
function derivePostProcessors(data) {
  if (!data || typeof data !== 'object') return [];
  const out = [];
  if (data.healthSafetyGuarded) out.push('health-safety-guard');
  if (data.quranCitationBlocked) out.push('quran-citation-structural');
  if (data.quranCitationSemanticBlocked) out.push('quran-citation-semantic');
  return out;
}

/**
 * @param {{ status?: string|null, errorCode?: string|null, data?: Record<string, unknown>|null }} result
 */
function deriveErrorState(result) {
  if (!result) return null;
  if (result.status === 'error') return result.errorCode || 'error';
  if (result.data?.noResponse === true) return null; // deliberate silence, not an error
  return null;
}

/**
 * @param {{ status?: string|null, data?: Record<string, unknown>|null }} result
 * @param {boolean} usedRetryOrFallback
 */
function deriveFallbackPath(result, usedRetryOrFallback) {
  if (result?.data?.noResponse === true) return 'activation:no_response';
  if (result?.status === 'error') return 'user_visible_fallback';
  if (usedRetryOrFallback) return 'retry_or_fallback';
  return null;
}

/**
 * @param {{ channel?: string|null, conversationId?: string|null, requestId?: string }} [opts]
 */
export function createRequestTiming(opts = {}) {
  const startedAt = performance.now();
  const createdAtIso = new Date().toISOString();
  /** @type {Map<string, number>} */
  const open = new Map();
  /** @type {TimingPhase[]} */
  const phases = [];
  let llmCallCount = 0;
  let usedRetryOrFallback = false;
  let userMessageSummary = null;
  let contextMessageCount = null;

  const requestId = opts.requestId || `req_${randomBytes(6).toString('hex')}`;

  return {
    requestId,
    conversationRef: safeConversationRef(opts.conversationId),
    channel: opts.channel || null,

    /** @param {string} name */
    start(name) {
      open.set(name, performance.now());
    },

    /** @param {string} name */
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

    /** Mark an instantaneous checkpoint (zero-duration phase). @param {string} name */
    mark(name) {
      const now = performance.now();
      phases.push({ name, durationMs: 0, startedAtMs: Math.round(now * 100) / 100, endedAtMs: Math.round(now * 100) / 100 });
    },

    noteLlmCall() {
      llmCallCount += 1;
    },

    noteRetryOrFallback() {
      usedRetryOrFallback = true;
    },

    /**
     * Record how many prior turns were in the history array this request
     * was built from. Called once, where processAtlasMessage first reads
     * input.history — never recomputed or guessed elsewhere.
     * @param {number} count
     */
    noteContext(count) {
      contextMessageCount = Number.isFinite(count) ? count : null;
    },

    /**
     * Record a bounded, truncated summary of the user's message for
     * diagnostic display. Never the raw unbounded message; never sent
     * anywhere but this process's own dev-only trace.
     * @param {string} text
     */
    noteUserMessage(text) {
      userMessageSummary = truncate(text);
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
      const totalDurationMs = Math.round((performance.now() - startedAt) * 100) / 100;
      const result = meta.result && typeof meta.result === 'object' ? meta.result : null;
      const data = result?.data && typeof result.data === 'object' ? result.data : null;

      return {
        version: REQUEST_TIMING_VERSION,
        interactionId: requestId,
        requestId,
        timestamp: createdAtIso,
        conversationRef: safeConversationRef(opts.conversationId),
        userRef: safeUserRef(opts.userId),
        channel: opts.channel || null,
        userMessageSummary,
        contextMessageCount,
        intent: meta.intent ?? result?.intent ?? null,
        engine: meta.engine ?? result?.engine ?? null,
        // Phase 1 note: selectedDomain/selectedTools/routingDecision are
        // not yet independently tracked anywhere in the pipeline beyond
        // intent/engine — rather than invent new state, they currently
        // mirror the same intent/engine values the dispatch chain already
        // returns (the two ARE the domain/routing signal today). If a
        // future change adds a real separate routing-decision value,
        // wire it in via meta without touching this derivation.
        selectedDomain: meta.selectedDomain ?? result?.engine ?? null,
        selectedTools: Array.isArray(meta.selectedTools) ? meta.selectedTools : [],
        routingDecision: meta.routingDecision ?? result?.intent ?? null,
        retrievalSources: Array.isArray(meta.retrievalSources) ? meta.retrievalSources : [],
        modelUsed: meta.modelUsed ?? (typeof data?.model === 'string' ? data.model : null),
        requestedModel: meta.requestedModel ?? null,
        fallbackPath: meta.fallbackPath ?? deriveFallbackPath(result, usedRetryOrFallback),
        postProcessors: Array.isArray(meta.postProcessors) ? meta.postProcessors : derivePostProcessors(data),
        responseSummary: meta.responseSummary ?? (typeof result?.reply === 'string' ? truncate(result.reply) : null),
        errorState: meta.errorState ?? deriveErrorState(result),
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
 * Never alters result.reply, result.status, or any field the caller/user
 * actually sees — only adds result.data.requestTiming for observability.
 * @param {object} result
 * @param {ReturnType<typeof createRequestTiming>} timing
 * @returns {object}
 */
export function attachRequestTiming(result, timing) {
  if (!result || !timing) return result;
  const snap = timing.snapshot({
    intent: result.intent ?? null,
    engine: result.engine ?? null,
    result,
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

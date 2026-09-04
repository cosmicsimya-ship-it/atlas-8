// ═══════════════════════════════════════════════════════════════════════
// ATLAS LAB evaluator — an OBSERVATIONAL-ONLY external AI reviewer of a
// single stored trace (RequestTimingSnapshot, server/request-timing.js).
//
// Architecture: a plain OpenAI API call via the existing shared client
// (server/openai-client.js) — NOT MCP, NOT a tool the live pipeline can
// invoke. This module is never imported by atlas-message-service.js or
// any other live response path. It is manually/on-demand callable only,
// from the new admin "Evaluate interaction" action (server/index.js,
// Phase 6) — never blocking, rewriting, or retrying a real user's turn.
// A failed or slow evaluation call has zero effect on anything except
// the admin diagnostic view that requested it.
//
// Input boundary: the evaluator only ever sees fields already present in
// a persisted RequestTimingSnapshot — bounded/truncated summaries, hashed
// refs, routing labels, phase timings. It never receives raw conversation
// history, secrets, tokens, or model chain-of-thought (none of that is in
// a snapshot to begin with; see trace-store.js and request-timing.js).
// ═══════════════════════════════════════════════════════════════════════

import { callOpenAI } from '../openai-client.js';

export const EVALUATOR_CATEGORIES = /** @type {const} */ ([
  'context_contamination', // wrong/cross-conversation context bled into the response
  'routing_misfire', // wrong domain/engine/tool selected for the request
  'identity_or_authorization_error', // founder/identity claims mishandled
  'citation_or_grounding_failure', // unverified or incorrect citation/reference used
  'tone_or_persona_violation', // response breaks Atlas's defined persona/style rules
  'unnecessary_fallback_or_error', // pipeline fell back or errored when it should not have
  'privacy_or_scope_leak', // response reveals data it should not have access to
  'other',
]);

export const EVALUATOR_VERDICTS = /** @type {const} */ (['PASS', 'WARN', 'FAIL']);
export const EVALUATOR_CONFIDENCE_LEVELS = /** @type {const} */ (['high', 'medium', 'low']);

/**
 * @typedef {{
 *   verdict: 'PASS'|'WARN'|'FAIL',
 *   categories: string[],
 *   explanation: string,
 *   expectedBehavior: string,
 *   confidence: 'high'|'medium'|'low',
 * }} EvaluationVerdict
 */

const SYSTEM_PROMPT = `You are a QA reviewer auditing a single logged interaction from an AI assistant called Atlas.
You are shown ONLY bounded metadata about the turn — never a full conversation, never the assistant's internal reasoning.
Judge whether the recorded routing/behavior looks reasonable given the available fields. When a field is missing or null,
treat it as "not observed" rather than assuming a problem — do not penalize the trace for fields the pipeline does not populate yet.

Respond with ONLY a single JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "verdict": "PASS" | "WARN" | "FAIL",
  "categories": string[],   // zero or more of: ${EVALUATOR_CATEGORIES.join(', ')}
  "explanation": string,    // 1-3 sentences, concrete, grounded only in the fields you were given
  "expectedBehavior": string, // 1-2 sentences describing what should have happened instead, or "" if verdict is PASS
  "confidence": "high" | "medium" | "low"
}`;

function boundedString(value, maxLength = 4000) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (!str) return null;
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str;
}

/**
 * Builds the bounded, redacted user prompt from a stored trace. Only
 * fields already present on a RequestTimingSnapshot are ever included.
 * @param {Record<string, unknown>} trace
 */
export function buildEvaluationPrompt(trace) {
  const fields = {
    channel: trace.channel ?? null,
    intent: trace.intent ?? null,
    engine: trace.engine ?? null,
    selectedDomain: trace.selectedDomain ?? null,
    selectedTools: trace.selectedTools ?? [],
    routingDecision: trace.routingDecision ?? null,
    retrievalSources: trace.retrievalSources ?? [],
    modelUsed: trace.modelUsed ?? null,
    requestedModel: trace.requestedModel ?? null,
    fallbackPath: trace.fallbackPath ?? null,
    postProcessors: trace.postProcessors ?? [],
    errorState: trace.errorState ?? null,
    contextMessageCount: trace.contextMessageCount ?? null,
    userMessageSummary: boundedString(trace.userMessageSummary),
    responseSummary: boundedString(trace.responseSummary),
    totalDurationMs: trace.totalDurationMs ?? null,
    llmCallCount: trace.llmCallCount ?? null,
    usedRetryOrFallback: Boolean(trace.usedRetryOrFallback),
  };
  return `Trace fields (JSON):\n${JSON.stringify(fields, null, 2)}`;
}

/**
 * Validates and clamps a candidate output object to the evaluator
 * contract. Never throws — an unparseable/malformed model response
 * produces a distinct error result rather than a fabricated verdict.
 * @param {unknown} candidate
 * @returns {{ ok: true, verdict: EvaluationVerdict } | { ok: false, error: string }}
 */
export function validateEvaluationOutput(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, error: 'Evaluator output was not a JSON object' };
  }
  const c = /** @type {Record<string, unknown>} */ (candidate);
  const verdict = EVALUATOR_VERDICTS.includes(/** @type {any} */ (c.verdict)) ? c.verdict : null;
  if (!verdict) {
    return { ok: false, error: `Evaluator output had an invalid verdict: ${JSON.stringify(c.verdict)}` };
  }
  const categories = Array.isArray(c.categories)
    ? c.categories.filter((cat) => EVALUATOR_CATEGORIES.includes(/** @type {any} */ (cat)))
    : [];
  const confidence = EVALUATOR_CONFIDENCE_LEVELS.includes(/** @type {any} */ (c.confidence)) ? c.confidence : 'low';
  const explanation = boundedString(c.explanation, 1000) || '';
  const expectedBehavior = boundedString(c.expectedBehavior, 500) || '';
  return {
    ok: true,
    verdict: /** @type {EvaluationVerdict} */ ({
      verdict,
      categories,
      explanation,
      expectedBehavior,
      confidence,
    }),
  };
}

/**
 * Run an on-demand, observational evaluation of one stored trace.
 * NEVER called from the live message pipeline — callers are limited to
 * the admin "Evaluate interaction" action. Never rewrites, blocks, or
 * retries anything; a failure here only affects the diagnostic caller.
 * @param {Record<string, unknown>} trace
 * @param {{ requestedBy?: string|null }} [opts]
 * @returns {Promise<
 *   | { ok: true, verdict: EvaluationVerdict, model: string, latencyMs: number }
 *   | { ok: false, error: string, blocked?: boolean }
 * >}
 */
export async function evaluateAtlasLabTrace(trace, opts = {}) {
  if (!trace || typeof trace !== 'object') {
    return { ok: false, error: 'No trace provided' };
  }
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: 'OPENAI_API_KEY not configured', blocked: true };
  }

  try {
    const result = await callOpenAI({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildEvaluationPrompt(trace),
      temperature: 0,
      maxTokens: 500,
      requestId: typeof trace.requestId === 'string' ? trace.requestId : null,
      userId: opts.requestedBy ?? null,
      source: 'atlas-lab-evaluator',
    });

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      return { ok: false, error: 'Evaluator response was not valid JSON' };
    }
    const validated = validateEvaluationOutput(parsed);
    if (!validated.ok) return { ok: false, error: validated.error };

    return {
      ok: true,
      verdict: validated.verdict,
      model: result.model,
      latencyMs: result.latencyMs,
    };
  } catch (err) {
    return { ok: false, error: err?.message || 'Evaluator call failed' };
  }
}

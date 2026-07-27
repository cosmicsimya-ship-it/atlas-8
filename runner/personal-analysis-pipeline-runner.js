// ═══════════════════════════════════════════════════════════════════════
// Personal Analysis Pipeline Runner — ATLAS Runner (Phase 2)
//
// Implements the Personal Analysis Pipeline described in atlas-core.md:
//
//   subject profile + analysis_inputs → CORE-ENGINE → synthesis
//
// This is the personal-analysis equivalent of pipeline-runner.js's
// runFullPipeline(), but for a single-stage pipeline: core-engine is
// currently the pipeline's only stage (upstream astro/numerology/
// fate-matrix agents are not yet deployed — see core-engine.md's Notes
// on input).
//
// EXPLICITLY OUT OF SCOPE for this file:
//   - Calling atlas-core as a model (same reasoning as pipeline-runner.js:
//     routing/state-keeping is expressed as plain control-flow here, not
//     an LLM call to atlas-core.md).
//   - Any Content Pipeline logic. This file imports nothing from
//     pipeline-runner.js and knows nothing about pattern-engine,
//     reversal-engine, or any production/critic/quality agent.
//   - Assembly, persistence, server, or frontend concerns. This module
//     only calls core-engine once and reports what happened.
//
// This module has no module-level mutable state. Every call to
// runPersonalAnalysisPipeline() builds its own local objects from its
// own arguments; nothing is shared across calls or with the Content
// Pipeline.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Run the Personal Analysis Pipeline: build core-engine's Input Contract
 * from the given arguments, call core-engine exactly once, and report
 * the outcome in the shape used across this runner (ok / trace /
 * stoppedAt / result).
 *
 * stoppedAt semantics: null means the pipeline ran to completion
 * (core-engine returned "complete") — nothing stopped it. A non-null
 * stoppedAt names the stage where the pipeline failed to complete,
 * whether because the call itself failed or because core-engine
 * returned a non-"complete" status.
 *
 * Exceptions from runner.callAgent() (e.g. an unexpected synchronous
 * throw inside the provider call chain) are NOT caught here — they
 * propagate to the caller unchanged. This matches the existing
 * convention in pipeline-runner.js, where none of the stage functions
 * (runPatternStage, runReversalStage, etc.) wrap runner.callAgent() in
 * try/catch either. runner.callAgent() already returns a structured
 * { ok: false, ... } result for every expected failure mode (prompt
 * loading, provider errors, JSON extraction, envelope shape) — a thrown
 * exception past that point signals something unexpected enough that
 * silently converting it into a result object would hide a real bug.
 *
 * @param {object} args
 * @param {import('./runner.js').Runner} args.runner - existing Runner instance
 * @param {string} args.taskId
 * @param {string} args.subjectId
 * @param {object} args.subjectProfile
 * @param {object} args.analysisInputs
 * @param {string[]} [args.constraints]
 * @returns {Promise<{ok: boolean, trace: object, stoppedAt: string|null, result: object|null}>}
 */
export async function runPersonalAnalysisPipeline({
  runner,
  taskId,
  subjectId,
  subjectProfile,
  analysisInputs,
  constraints,
}) {
  // The one critical precondition: without a taskId, the envelope this
  // produces can never match core-engine's own task_id echo, and the
  // call is meaningless before it even starts. Everything else
  // (subjectProfile completeness, analysisInputs coverage) is
  // core-engine.md's own responsibility via its "insufficient_data"
  // status — re-checking it here would be a redundant validation layer.
  if (!taskId) {
    throw new Error(
      'runPersonalAnalysisPipeline requires a taskId — cannot call core-engine without one.'
    );
  }

  // core-engine.md's Input Contract field names, preserved exactly.
  const input = {
    subject_id: subjectId,
    subject_profile: subjectProfile,
    analysis_inputs: analysisInputs,
    constraints,
  };

  const trace = { taskId, stages: {} };

  const callResult = await runner.callAgent('core-engine', input, taskId);

  if (!callResult.ok) {
    trace.stages['core-engine'] = {
      agent: 'core-engine',
      status: null,
      ok: false,
      stage: callResult.stage,
      error: callResult.error,
    };
    return { ok: false, trace, stoppedAt: 'core-engine', result: null };
  }

  const envelope = callResult.envelope;

  trace.stages['core-engine'] = {
    agent: 'core-engine',
    status: envelope.status,
    ok: true,
    meta: callResult.meta,
  };

  // A non-"complete" status (insufficient_data | reject) is not success,
  // even though the call itself succeeded — per core-engine.md, only
  // "complete" represents a finished synthesis. The envelope is still
  // returned in `result` so the caller can see why (missing_data,
  // warnings, etc.), but ok is false and stoppedAt names the stage that
  // failed to complete.
  if (envelope.status !== 'complete') {
    return { ok: false, trace, stoppedAt: 'core-engine', result: envelope };
  }

  // Success: the pipeline ran to completion. stoppedAt is null because
  // nothing stopped it — core-engine finished with "complete".
  return { ok: true, trace, stoppedAt: null, result: envelope };
}
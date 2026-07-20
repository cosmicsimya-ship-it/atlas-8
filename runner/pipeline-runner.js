// ═══════════════════════════════════════════════════════════════════════
// Pipeline Runner — ATLAS v1.0 (Phase 2, scoped)
//
// Implements pipeline-flow.md's Stages 2 through 6:
//
//   Stage 2  pattern-engine        (single call)
//   Stage 3  reversal-engine       (single call)
//   Stage 4  production fan-out    (script/visual/thumbnail/seo, parallel)
//   Stage 5  critic-engine         (single call, fan-in on Stage 4)
//   Stage 6  quality-engine        (single call, fan-in on Stage 5)
//
// EXPLICITLY OUT OF SCOPE for this file (per the approved plan):
//   - Stage 1 (ATLAS-CORE as its own LLM call). ATLAS-CORE's routing
//     role — "only advance if the prior agent returned complete,"
//     "attach full lineage forward," "never assemble without a SHIP
//     verdict" — is implemented here as plain control-flow logic, the
//     way runner-architecture.md describes: the runner IS the code
//     embodiment of ATLAS-CORE's routing rules. This matches the
//     pattern already established in test-two-agent-chain.js and
//     test-fanout-chain.js, neither of which called atlas-core.md as
//     a model either.
//   - Stage 7 (persistence handoff to POST /api/assets/save)
//   - Revise-loop re-entry (revise-loop-spec.md) — a "revise" from
//     CRITIC-ENGINE does NOT loop back to Stage 4 here; it is simply
//     reported. QUALITY-ENGINE is still called next regardless of
//     CRITIC-ENGINE's verdict, per this phase's explicit instructions
//     ("pass critic-engine output to quality-engine," "do not
//     implement revise-loop yet"). The real, full pipeline-flow.md
//     behavior would loop back to Stage 4 on "revise" instead of
//     proceeding — that branching is deliberately deferred, not
//     forgotten. Every stage's actual status/verdict is preserved in
//     the trace so nothing is hidden.
//
// This module does not persist anything, does not touch the frontend,
// and does not modify agent-loader.js / envelope.js / provider-adapter.js
// / runner.js. It only calls the existing Runner.callAgent().
// ═══════════════════════════════════════════════════════════════════════

// ── Input builders (pure functions, no side effects) ───────────────────
// Each mirrors exactly the corresponding agent's Input Contract in its
// own .md file. Reused here in the same form already established and
// verified in test-two-agent-chain.js and test-fanout-chain.js.

function buildReversalInput(patternEnvelope, targetMedium, constraints) {
  return {
    task_id: patternEnvelope.task_id,
    pattern_map: patternEnvelope.payload,
    target_medium: targetMedium,
    constraints,
  };
}

function buildProductionInputs(reversalEnvelope, patternEnvelope, targetMedium, constraints) {
  const sharedCore = {
    task_id: reversalEnvelope.task_id,
    reversal_frame: reversalEnvelope.payload,
    target_medium: targetMedium,
    constraints,
  };

  return {
    'script-engine': {
      ...sharedCore,
      pattern_map: patternEnvelope.payload,
      length_constraint: '45-60 seconds spoken',
    },
    'visual-engine': { ...sharedCore },
    'thumbnail-engine': { ...sharedCore },
    'seo-engine': { ...sharedCore, pattern_map: patternEnvelope.payload },
  };
}

function buildCriticInput(taskId, reversalEnvelope, productionPayloads) {
  return {
    task_id: taskId,
    reversal_frame: reversalEnvelope.payload,
    production_outputs: {
      script: productionPayloads['script-engine'],
      visual: productionPayloads['visual-engine'],
      thumbnail: productionPayloads['thumbnail-engine'],
      seo: productionPayloads['seo-engine'],
    },
  };
}

function buildQualityInput(taskId, patternEnvelope, reversalEnvelope, productionPayloads, critiqueEnvelope) {
  return {
    task_id: taskId,
    pattern_map: patternEnvelope.payload,
    reversal_frame: reversalEnvelope.payload,
    production_outputs: {
      script: productionPayloads['script-engine'],
      visual: productionPayloads['visual-engine'],
      thumbnail: productionPayloads['thumbnail-engine'],
      seo: productionPayloads['seo-engine'],
    },
    critique_report: critiqueEnvelope.payload,
  };
}

// ── Known envelope quirk: quality-engine uses "verdict", not "status" ──
//
// Every other agent's Output Contract uses a "status" field. quality-
// engine.md's Output Contract uses "verdict": "SHIP | REVISE | REJECT"
// instead. envelope.js's validateEnvelopeShape() is generic across all
// nine agents and checks for "status" — so it will always flag a
// correctly-formed quality-engine response as invalid at the
// "envelope_validation" stage inside Runner.callAgent().
//
// Rather than modify the shared envelope.js/runner.js (out of scope —
// only new files were approved for this phase), this module re-checks
// the raw parsed output against quality-engine's ACTUAL contract shape
// before treating a Runner.callAgent() failure as a real failure.
function isValidQualityVerdictEnvelope(parsed, expectedTaskId) {
  if (typeof parsed !== 'object' || parsed === null) return false;
  if (parsed.agent !== 'quality-engine') return false;
  if (parsed.task_id !== expectedTaskId) return false;
  if (!['SHIP', 'REVISE', 'REJECT'].includes(parsed.verdict)) return false;
  if (typeof parsed.payload !== 'object' || parsed.payload === null) return false;
  if (!Array.isArray(parsed.handoff_to)) return false;
  return true;
}

// ── Stage functions ──────────────────────────────────────────────────

async function runPatternStage(runner, taskId, rawInput, targetMedium, constraints) {
  const input = { task_id: taskId, raw_input: rawInput, target_medium: targetMedium, constraints };
  return runner.callAgent('pattern-engine', input, taskId);
}

async function runReversalStage(runner, taskId, patternEnvelope, targetMedium, constraints) {
  const input = buildReversalInput(patternEnvelope, targetMedium, constraints);
  return runner.callAgent('reversal-engine', input, taskId);
}

async function runProductionStage(runner, taskId, reversalEnvelope, patternEnvelope, targetMedium, constraints) {
  const inputs = buildProductionInputs(reversalEnvelope, patternEnvelope, targetMedium, constraints);
  const agents = ['script-engine', 'visual-engine', 'thumbnail-engine', 'seo-engine'];

  const settled = await Promise.allSettled(
    agents.map((agentName) => runner.callAgent(agentName, inputs[agentName], taskId))
  );

  const results = {};
  const failures = [];

  agents.forEach((agentName, i) => {
    const outcome = settled[i];
    if (outcome.status === 'rejected') {
      failures.push({ agent: agentName, error: { type: 'unknown', message: String(outcome.reason) } });
      return;
    }
    const result = outcome.value;
    if (!result.ok) {
      failures.push({ agent: agentName, error: result.error, stage: result.stage });
      return;
    }
    results[agentName] = result;
  });

  return { ok: failures.length === 0, results, failures };
}

async function runCriticStage(runner, taskId, reversalEnvelope, productionPayloads) {
  const input = buildCriticInput(taskId, reversalEnvelope, productionPayloads);
  return runner.callAgent('critic-engine', input, taskId);
}

async function runQualityStage(runner, taskId, patternEnvelope, reversalEnvelope, productionPayloads, critiqueEnvelope) {
  const input = buildQualityInput(taskId, patternEnvelope, reversalEnvelope, productionPayloads, critiqueEnvelope);
  const result = await runner.callAgent('quality-engine', input, taskId);

  if (result.ok) {
    // Would only happen if envelope.js is later made verdict-aware.
    return { ok: true, envelope: result.envelope, meta: result.meta };
  }

  if (result.stage === 'envelope_validation' && result.parsed && isValidQualityVerdictEnvelope(result.parsed, taskId)) {
    const meta = result.raw
      ? { provider: result.raw.provider, model: result.raw.model, tokens_used: result.raw.tokens_used, latency_ms: result.raw.latency_ms }
      : null;
    return { ok: true, envelope: result.parsed, meta, note: 'accepted via verdict-shape workaround — see comment in pipeline-runner.js' };
  }

  return { ok: false, stage: result.stage, error: result.error, raw: result.raw };
}

// ── Full pipeline orchestration (Stages 2-6) ────────────────────────────

/**
 * Run the pipeline from pattern-engine through quality-engine.
 * Stops (does not proceed) as soon as any stage fails outright, or as
 * soon as pattern-engine / reversal-engine return a non-"complete"
 * status (per pipeline-flow.md, a "reject" there has nothing to hand
 * forward). Does NOT stop early on a critic-engine "revise" — see the
 * scope note at the top of this file.
 *
 * @param {object} args
 * @param {import('./runner.js').Runner} args.runner
 * @param {string} args.taskId
 * @param {string} args.rawInput
 * @param {string} args.targetMedium
 * @param {string[]} args.constraints
 * @returns {Promise<object>} a full trace of every stage plus a final ok/stoppedAt summary
 */
export async function runFullPipeline({ runner, taskId, rawInput, targetMedium, constraints }) {
  const trace = { taskId, stages: {} };

  // Stage 2 — pattern-engine
  const patternResult = await runPatternStage(runner, taskId, rawInput, targetMedium, constraints);
  trace.stages['pattern-engine'] = patternResult;
  if (!patternResult.ok) {
    return { ...trace, ok: false, stoppedAt: 'pattern-engine' };
  }
  if (patternResult.envelope.status !== 'complete') {
    return { ...trace, ok: false, stoppedAt: 'pattern-engine', reason: `status="${patternResult.envelope.status}"` };
  }

  // Stage 3 — reversal-engine
  const reversalResult = await runReversalStage(runner, taskId, patternResult.envelope, targetMedium, constraints);
  trace.stages['reversal-engine'] = reversalResult;
  if (!reversalResult.ok) {
    return { ...trace, ok: false, stoppedAt: 'reversal-engine' };
  }
  if (reversalResult.envelope.status !== 'complete') {
    return { ...trace, ok: false, stoppedAt: 'reversal-engine', reason: `status="${reversalResult.envelope.status}"` };
  }

  // Stage 4 — production fan-out
  const productionResult = await runProductionStage(
    runner, taskId, reversalResult.envelope, patternResult.envelope, targetMedium, constraints
  );
  trace.stages['production'] = productionResult;
  if (!productionResult.ok) {
    return { ...trace, ok: false, stoppedAt: 'production' };
  }

  const productionPayloads = {
    'script-engine': productionResult.results['script-engine'].envelope.payload,
    'visual-engine': productionResult.results['visual-engine'].envelope.payload,
    'thumbnail-engine': productionResult.results['thumbnail-engine'].envelope.payload,
    'seo-engine': productionResult.results['seo-engine'].envelope.payload,
  };

  // Stage 5 — critic-engine (fan-in on Stage 4)
  const criticResult = await runCriticStage(runner, taskId, reversalResult.envelope, productionPayloads);
  trace.stages['critic-engine'] = criticResult;
  if (!criticResult.ok) {
    return { ...trace, ok: false, stoppedAt: 'critic-engine' };
  }
  // NOTE: critic-engine's status ("clear" | "revise") is recorded in the
  // trace but does not gate progression to Stage 6 in this phase — see
  // the scope note at the top of this file. Revise-loop re-entry is a
  // later phase.

  // Stage 6 — quality-engine (fan-in on Stage 5)
  const qualityResult = await runQualityStage(
    runner, taskId, patternResult.envelope, reversalResult.envelope, productionPayloads, criticResult.envelope
  );
  trace.stages['quality-engine'] = qualityResult;
  if (!qualityResult.ok) {
    return { ...trace, ok: false, stoppedAt: 'quality-engine' };
  }

  return { ...trace, ok: true, stoppedAt: 'quality-engine', verdict: qualityResult.envelope.verdict };
}

export {
  buildReversalInput,
  buildProductionInputs,
  buildCriticInput,
  buildQualityInput,
  isValidQualityVerdictEnvelope,
  runPatternStage,
  runReversalStage,
  runProductionStage,
  runCriticStage,
  runQualityStage,
};

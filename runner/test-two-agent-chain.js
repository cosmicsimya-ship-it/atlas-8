// ═══════════════════════════════════════════════════════════════════════
// Phase 1.5 Test — a two-agent chain, nothing more.
//
// pattern-engine finishes → its payload becomes reversal-engine's
// `pattern_map` input field (exactly as reversal-engine.md's Input
// Contract requires) → reversal-engine runs → both results print.
//
// This is still NOT the full 9-agent pipeline. It does not implement
// pipeline-flow.md's stage map, does not fan out to production agents,
// and does not implement any revise-loop. It is a second, explicit,
// hand-wired two-step chain built the same way test-single-call.js
// was built — one deliberate step further, not a generic sequencer.
//
// Usage:
//   node runner/test-two-agent-chain.js
//
// Requires:
//   - npm install already run
//   - a .env file at the project root with OPENAI_API_KEY=sk-...
// ═══════════════════════════════════════════════════════════════════════

import { Runner } from './runner.js';

const taskId = `chain-${Date.now()}`;

// Same example input as pattern-engine.md's own "Example Task" section.
const patternInput = {
  task_id: taskId,
  raw_input:
    "People keep saying old software version numbers 'mean something' astrologically — like v2.0 releases correlating with disruptive years. Is there a real pattern here or is it numerology dressed as tech commentary?",
  target_medium: 'short-video',
  constraints: ['no direct claims of causation', 'no named real companies'],
};

/**
 * Build reversal-engine's Input Contract from pattern-engine's completed
 * output. Pure function, no side effects — the mechanical field mapping
 * runner-architecture.md describes ("PATTERN-ENGINE's output becomes
 * part of the input for REVERSAL-ENGINE... verbatim").
 */
function buildReversalInput(patternEnvelope, targetMedium, constraints) {
  return {
    task_id: patternEnvelope.task_id,
    pattern_map: patternEnvelope.payload,
    target_medium: targetMedium,
    constraints: constraints,
  };
}

function printEnvelope(label, envelope, meta) {
  console.log(`\n── ${label} ──`);
  console.log(
    `  provider: ${meta.provider} | model: ${meta.model} | ` +
    `tokens: ${meta.tokens_used ?? 'n/a'} | latency: ${meta.latency_ms}ms`
  );
  console.log(JSON.stringify(envelope, null, 2));
}

function printFailure(label, result) {
  console.log(`\n✗ FAILED at "${label}", stage: ${result.stage}`);
  console.log('Error:', JSON.stringify(result.error, null, 2));
  if (result.raw?.text) {
    console.log('\nRaw model output (for debugging):\n');
    console.log(result.raw.text);
  }
}

const runner = new Runner();

console.log(`\n[ATLAS Runner — two-agent chain test]`);
console.log(`task_id: ${taskId}`);

// ── Step 1: pattern-engine ────────────────────────────────────────────
console.log(`\nCalling agent: pattern-engine`);
const patternResult = await runner.callAgent('pattern-engine', patternInput, taskId);

if (!patternResult.ok) {
  printFailure('pattern-engine', patternResult);
  process.exit(1);
}

printEnvelope('pattern-engine result', patternResult.envelope, patternResult.meta);

// Per pattern-engine.md: status is "complete | reject". Only a "complete"
// pattern map is fit to hand to reversal-engine — a "reject" means no
// usable pattern was found, and per pipeline-flow.md that returns to the
// operator rather than proceeding.
if (patternResult.envelope.status !== 'complete') {
  console.log(
    `\npattern-engine returned status "${patternResult.envelope.status}", not "complete" — ` +
    `stopping here rather than proceeding to reversal-engine (see pipeline-flow.md, Stage 2).`
  );
  process.exit(0);
}

// ── Step 2: reversal-engine, fed automatically from pattern-engine ────
const reversalInput = buildReversalInput(
  patternResult.envelope,
  patternInput.target_medium,
  patternInput.constraints
);

console.log(`\nCalling agent: reversal-engine (input built from pattern-engine's output)`);
const reversalResult = await runner.callAgent('reversal-engine', reversalInput, taskId);

if (!reversalResult.ok) {
  printFailure('reversal-engine', reversalResult);
  process.exit(1);
}

printEnvelope('reversal-engine result', reversalResult.envelope, reversalResult.meta);

console.log('\n✓ Chain complete: pattern-engine → reversal-engine.\n');

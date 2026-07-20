// ═══════════════════════════════════════════════════════════════════════
// Phase 1 Test — core-engine, standalone smoke test.
//
// This is a manual smoke test for the Personal Analysis Pipeline's
// terminal agent, core-engine — built the same way test-single-call.js
// was built for pattern-engine, one deliberate step at a time:
//
//   Stage A — prompt loading only (no model call)
//   Stage B — mock input shape validation against core-engine.md's own
//             Input Contract (no model call)
//   Stage C — one real call via the existing Runner class (reuses
//             runner.js → provider-adapter.js as-is; no new provider
//             logic is introduced here)
//
// This file does NOT import pipeline-runner.js, does NOT touch
// server/ or src/, and does NOT know anything about the Content/Shorts
// pipeline. It exercises exactly one agent: core-engine.
//
// Usage:
//   node runner/test-core-engine-call.js
//
// Requires:
//   - npm install already run (existing project requirement)
//   - a .env file at the project root with OPENAI_API_KEY=sk-...
// ═══════════════════════════════════════════════════════════════════════

import { loadAgentPrompt } from './agent-loader.js';
import { Runner } from './runner.js';

const taskId = `core-engine-test-${Date.now()}`;

// ── Mock input — core-engine.md's own "Example Task" (lines 253-334),
// reused verbatim rather than inventing new mock data. Three analysis
// systems (astrological, numerological, fate_matrix), each with at
// least one finding, and one deliberate cross-system contradiction
// ("autonomy vs. cooperative bonding") baked into the underlying
// findings themselves so core-engine has real material to detect a
// convergence AND a contradiction from.
const input = {
  task_id: taskId,
  subject_id: 'subject-mock-014',
  subject_profile: {
    birth_data: { date: '1991-03-14', time: '06:45', place: 'Ankara, TR' },
    life_events: [
      {
        period: '2016-2018',
        description:
          'Left stable corporate role to build an independent project; income dropped for two years before partial recovery.',
      },
      {
        period: '2022-2024',
        description:
          'Repeated pattern of starting intense collaborations, then withdrawing when decision authority became shared.',
      },
    ],
    user_notes:
      'Feels caught between needing autonomy and repeatedly choosing structures that limit it.',
  },
  analysis_inputs: {
    astrological: {
      system: 'astrological',
      findings: [
        {
          id: 'astro-001',
          theme: 'autonomy pressure',
          claim:
            'Chart emphasizes self-directed initiation; Saturn contacts suggest growth through solitary responsibility rather than dependency on institutions.',
          evidence_refs: ['Aries rising', 'Saturn in 10th house', 'Mars-Saturn square'],
        },
        {
          id: 'astro-002',
          theme: 'current threshold',
          claim:
            'Transit period supports restructuring authority relationship — old external validation loops are under pressure to end.',
          evidence_refs: ['Saturn transit 10th', 'Pluto square natal Sun'],
        },
      ],
    },
    numerological: {
      system: 'numerological',
      findings: [
        {
          id: 'num-001',
          theme: 'autonomy pressure',
          claim:
            'Life Path and Expression combination favors independent path; repeated Personal Year 1 cycles correlate with self-initiated breaks from prior structure.',
          evidence_refs: ['Life Path 1', 'Expression 5', 'Personal Year 1 in 2016'],
        },
        {
          id: 'num-002',
          theme: 'partnership pull',
          claim:
            'Soul Urge 2 suggests deep need for cooperative bonding — may conflict with Life Path independence theme.',
          evidence_refs: ['Soul Urge 2', 'Life Path 1'],
        },
      ],
    },
    fate_matrix: {
      system: 'fate_matrix',
      findings: [
        {
          id: 'fm-001',
          theme: 'autonomy pressure',
          claim:
            'Central arc emphasizes self-definition through repeated exit from inherited or imposed structures.',
          evidence_refs: ['Arc 1-5-1', 'Karmic tail 19'],
        },
        {
          id: 'fm-002',
          theme: 'current threshold',
          claim:
            'Matrix cycle indicates consolidation phase — less about new breakout, more about stabilizing what was initiated in prior cycle.',
          evidence_refs: ['Cycle 6 energy', 'Age period 33-35'],
        },
      ],
    },
    ebced: null,
  },
  constraints: ['no certain future predictions', 'Turkish or English output acceptable'],
};

function printHeader(label) {
  console.log(`\n── ${label} ──`);
}

// ═══════════════════════════════════════════════════════════════════════
// Stage A — prompt loading only, no model call
// ═══════════════════════════════════════════════════════════════════════
function runStageA_promptLoading() {
  printHeader('Stage A — prompt loading (agent-loader.js only, no model call)');
  try {
    const prompt = loadAgentPrompt('core-engine');
    const nonEmpty = typeof prompt === 'string' && prompt.trim().length > 0;
    const hasIdentityMarker = prompt.includes('CORE-ENGINE') && prompt.includes('Personal Analysis Synthesis Agent');

    console.log(`  loaded: ${nonEmpty ? 'yes' : 'NO'} (${prompt.length} chars)`);
    console.log(`  identity marker found: ${hasIdentityMarker ? 'yes' : 'NO'}`);

    if (!nonEmpty || !hasIdentityMarker) {
      console.log('  ✗ Stage A FAILED — agents/core-engine.md did not load as expected.');
      return false;
    }
    console.log('  ✓ Stage A PASSED — core-engine.md loads correctly via agent-loader.js.');
    return true;
  } catch (err) {
    console.log(`  ✗ Stage A FAILED — loadAgentPrompt threw: ${err.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Stage B — mock input shape validation against core-engine.md's own
// Input Contract, no model call. Mirrors the "at least two systems
// must have non-empty findings" rule from core-engine.md's own Notes
// on input (line 127).
// ═══════════════════════════════════════════════════════════════════════
function runStageB_inputValidation(inputToCheck) {
  printHeader('Stage B — mock input shape validation (no model call)');
  const errors = [];

  if (!inputToCheck.subject_id) errors.push('missing subject_id');
  if (!inputToCheck.subject_profile?.birth_data) errors.push('missing subject_profile.birth_data');

  const systems = ['astrological', 'numerological', 'fate_matrix'];
  const systemsWithFindings = systems.filter(
    (sys) => Array.isArray(inputToCheck.analysis_inputs?.[sys]?.findings) && inputToCheck.analysis_inputs[sys].findings.length > 0
  );

  console.log(`  systems with non-empty findings: ${systemsWithFindings.join(', ')} (${systemsWithFindings.length}/3)`);

  if (systemsWithFindings.length < 2) {
    errors.push('fewer than two systems have findings — core-engine.md says this should return insufficient_data');
  }

  if (errors.length > 0) {
    console.log(`  ✗ Stage B FAILED — ${errors.join('; ')}`);
    return false;
  }
  console.log('  ✓ Stage B PASSED — input matches core-engine.md\'s Input Contract; three systems present.');
  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// Stage C — one real call via the existing Runner class. No new
// provider logic; this reuses runner.js → provider-adapter.js exactly
// as they already exist.
// ═══════════════════════════════════════════════════════════════════════
async function runStageC_realCall() {
  printHeader('Stage C — real provider call via Runner.callAgent()');
  const runner = new Runner();
  const result = await runner.callAgent('core-engine', input, taskId);

  if (!result.ok) {
    console.log(`  ✗ Stage C FAILED at stage: ${result.stage}`);
    console.log('  Error:', JSON.stringify(result.error, null, 2));
    if (result.raw?.text) {
      console.log('\n  Raw model output (for debugging):\n');
      console.log(result.raw.text);
    }
    return null;
  }

  console.log(
    `  ✓ Stage C PASSED — provider: ${result.meta.provider} | model: ${result.meta.model} | ` +
    `tokens: ${result.meta.tokens_used ?? 'n/a'} | latency: ${result.meta.latency_ms}ms`
  );
  return result.envelope;
}

// ═══════════════════════════════════════════════════════════════════════
// Output field check — the seven fields requested, read from their
// actual location per core-engine.md's Output Contract:
//   envelope.status
//   envelope.payload.synthesis
//   envelope.payload.synthesis.evidence_map
//   envelope.payload.synthesis.confidence
//   envelope.payload.synthesis.contradictions
//   envelope.payload.synthesis.missing_data
//   envelope.payload.synthesis.warnings
// ═══════════════════════════════════════════════════════════════════════
function checkOutputFields(envelope) {
  printHeader('Output field check');
  const synthesis = envelope?.payload?.synthesis;

  const checks = [
    ['status', typeof envelope?.status === 'string'],
    ['payload.synthesis', typeof synthesis === 'object' && synthesis !== null],
    ['payload.synthesis.evidence_map', Array.isArray(synthesis?.evidence_map)],
    ['payload.synthesis.confidence', typeof synthesis?.confidence === 'object' && synthesis?.confidence !== null],
    ['payload.synthesis.contradictions', Array.isArray(synthesis?.contradictions)],
    ['payload.synthesis.missing_data', Array.isArray(synthesis?.missing_data)],
    ['payload.synthesis.warnings', Array.isArray(synthesis?.warnings)],
  ];

  let allPassed = true;
  for (const [label, passed] of checks) {
    console.log(`  ${passed ? '✓' : '✗'} ${label}`);
    if (!passed) allPassed = false;
  }

  if (synthesis) {
    console.log(`\n  status: ${envelope.status}`);
    console.log(`  convergences found: ${synthesis.convergences?.length ?? 0}`);
    console.log(`  contradictions found: ${synthesis.contradictions?.length ?? 0}`);
    console.log(`  confidence.overall: ${synthesis.confidence?.overall ?? 'n/a'}`);
    console.log(`  missing_data entries: ${synthesis.missing_data?.length ?? 0}`);
    console.log(`  warnings entries: ${synthesis.warnings?.length ?? 0}`);
  }

  return allPassed;
}

// ═══════════════════════════════════════════════════════════════════════
// Run all stages in order. Stop early if a no-model-call stage fails —
// no reason to spend a real API call on input that's already known to
// be malformed.
// ═══════════════════════════════════════════════════════════════════════
console.log(`\n[ATLAS Runner — core-engine standalone smoke test]`);
console.log(`task_id: ${taskId}`);

const stageAOk = runStageA_promptLoading();
if (!stageAOk) process.exit(1);

const stageBOk = runStageB_inputValidation(input);
if (!stageBOk) process.exit(1);

const envelope = await runStageC_realCall();
if (!envelope) process.exit(1);

const fieldsOk = checkOutputFields(envelope);

console.log(`\n${fieldsOk ? '✓ ALL CHECKS PASSED' : '✗ SOME OUTPUT FIELD CHECKS FAILED'}`);
console.log('Full parsed response envelope:');
console.log(JSON.stringify(envelope, null, 2));

process.exitCode = fieldsOk ? 0 : 1;
// ═══════════════════════════════════════════════════════════════════════
// Personal Analysis Pipeline — End-to-End Test (Phase 2)
//
// Two independent layers:
//
//   Layer A — routing test, NO model/provider call.
//     Uses a FakeRunner test double to prove:
//       - task_type: 'personal-analysis' routes ONLY to core-engine
//       - unrecognized / null task_type throws, never falls back
//       - task_type key absent defaults to the Content Pipeline branch
//         (proven via a probe call, without letting the real Content
//         Pipeline run or touch the network)
//     Layer A is the ONLY layer in this file that proves no Content
//     agent was called — it does so directly, by asserting on
//     FakeRunner.calls. Layer B does not repeat or extend that proof
//     (see note in Layer B below).
//
//   Layer B — real end-to-end test through the actual provider.
//     request → routeTask() → runPersonalAnalysisPipeline() →
//     runner.callAgent('core-engine') → real OpenAI call → response.
//     Reuses the exact Runner/provider setup pattern from Phase 1's
//     test-core-engine-call.js.
//
// This file imports ONLY runner.js and task-router.js. It does not
// import pipeline-runner.js directly (task-router.js already does,
// internally, unmodified) and it makes no changes to any production
// file. It does not touch server/ or src/.
//
// Usage:
//   node runner/test-personal-analysis-e2e.js
//
// Requires (for Layer B only — Layer A needs nothing):
//   - npm install already run
//   - a .env file at the project root with OPENAI_API_KEY=sk-...
// ═══════════════════════════════════════════════════════════════════════

import { Runner } from './runner.js';
import { routeTask } from './task-router.js';

// ── Minimal test-reporting helpers (no external test framework, to stay
// consistent with the existing test-single-call.js / test-two-agent-
// chain.js convention in this repo) ─────────────────────────────────────
let totalChecks = 0;
let failedChecks = 0;

function check(label, passed) {
  totalChecks += 1;
  if (!passed) failedChecks += 1;
  console.log(`  ${passed ? '✓' : '✗'} ${label}`);
  return passed;
}

function section(label) {
  console.log(`\n── ${label} ──`);
}

// ═══════════════════════════════════════════════════════════════════════
// FakeRunner — Layer A test double.
//
// Records every callAgent invocation. If constructed with an
// `allowedAgent`, any call for a different agent name throws
// immediately (after recording it) — this is what makes a personal-
// analysis routing test fail loudly if the Content Pipeline is ever
// touched by mistake.
//
// If constructed without a `mockEnvelope`, any accepted call still
// throws (a deliberate "probe stop") — this is used to detect that the
// Content Pipeline's real runFullPipeline() was entered (it will call
// runner.callAgent('pattern-engine', ...) as its very first action)
// without letting any of it actually run past that first call, and
// without ever reaching the network. See design note above: task-
// router.js imports runFullPipeline directly, so there is no seam to
// swap it out without editing production files — this is the smallest
// safe way to prove routing without doing that.
// ═══════════════════════════════════════════════════════════════════════
class FakeRunner {
  constructor({ allowedAgent = null, mockEnvelope = null } = {}) {
    this.calls = [];
    this.allowedAgent = allowedAgent;
    this.mockEnvelope = mockEnvelope;
  }

  async callAgent(agentName, input, taskId) {
    this.calls.push({ agentName, input, taskId });

    if (this.allowedAgent !== null && agentName !== this.allowedAgent) {
      throw new Error(
        `FakeRunner: unexpected agent call "${agentName}" — only "${this.allowedAgent}" ` +
        `is permitted in this test. This means routing leaked into a pipeline it shouldn't have.`
      );
    }

    if (this.mockEnvelope) {
      return {
        ok: true,
        envelope: { ...this.mockEnvelope, task_id: taskId },
        meta: { provider: 'fake', model: 'fake-test-double', tokens_used: 0, latency_ms: 0 },
      };
    }

    throw new Error(
      `FakeRunner: no mockEnvelope configured for agent "${agentName}" — probe stop ` +
      `(this is expected when testing the content-default routing path).`
    );
  }
}

const MOCK_COMPLETE_CORE_ENGINE_ENVELOPE = {
  agent: 'core-engine',
  status: 'complete',
  payload: {
    synthesis: {
      subject_id: 'subject-mock-014',
      source_systems: ['astrological', 'numerological'],
      source_findings: [],
      convergences: [],
      contradictions: [],
      core_pattern: 'mock',
      life_architecture: 'mock',
      development_axis: 'mock',
      current_cycle: 'mock',
      potential_gates: [],
      recommended_directions: [],
      confidence: { overall: 0.5, by_finding: [] },
      evidence_map: [],
      missing_data: [],
      warnings: [],
    },
  },
  handoff_to: ['atlas-core'],
};

// ═══════════════════════════════════════════════════════════════════════
// Layer A — routing tests, no model call
// ═══════════════════════════════════════════════════════════════════════
async function runLayerA() {
  section('LAYER A — routing decision tests (no model/provider call)');

  // ── A1: personal-analysis routes only to core-engine, field mapping
  // is correct ──────────────────────────────────────────────────────────
  {
    console.log('\n  [A1] task_type: personal-analysis → core-engine, field mapping');
    const fakeRunner = new FakeRunner({
      allowedAgent: 'core-engine',
      mockEnvelope: MOCK_COMPLETE_CORE_ENGINE_ENVELOPE,
    });

    const request = {
      task_type: 'personal-analysis',
      task_id: 'a1-task-id',
      subject_id: 'a1-subject-id',
      subject_profile: { birth_data: { date: '1990-01-01', time: null, place: null }, life_events: [], user_notes: 'a1 notes' },
      analysis_inputs: {
        astrological: { system: 'astrological', findings: [{ id: 'x', theme: 't', claim: 'c', evidence_refs: [] }] },
        numerological: { system: 'numerological', findings: [{ id: 'y', theme: 't', claim: 'c', evidence_refs: [] }] },
        fate_matrix: { system: 'fate_matrix', findings: [] },
        ebced: null,
      },
      constraints: ['a1 constraint'],
    };

    try {
      const result = await routeTask(request, fakeRunner);

      check('routeTask resolved without throwing', true);
      check('exactly one agent call was made', fakeRunner.calls.length === 1);
      check('the call was to "core-engine"', fakeRunner.calls[0]?.agentName === 'core-engine');
      check('taskId passed through as task_id', fakeRunner.calls[0]?.taskId === request.task_id);

      const sentInput = fakeRunner.calls[0]?.input ?? {};
      check('input.subject_id === request.subject_id', sentInput.subject_id === request.subject_id);
      check('input.subject_profile === request.subject_profile', sentInput.subject_profile === request.subject_profile);
      check('input.analysis_inputs === request.analysis_inputs', sentInput.analysis_inputs === request.analysis_inputs);
      check('input.constraints === request.constraints', sentInput.constraints === request.constraints);

      check('result.ok === true', result.ok === true);
      check('result.stoppedAt === null (completed, not stopped)', result.stoppedAt === null);
      check(
        "trace.stages['core-engine'].agent === 'core-engine'",
        result.trace?.stages?.['core-engine']?.agent === 'core-engine'
      );
      check(
        "trace.stages['core-engine'].status === 'complete'",
        result.trace?.stages?.['core-engine']?.status === 'complete'
      );
    } catch (err) {
      check(`routeTask did not throw unexpectedly (threw: ${err.message})`, false);
    }
  }

  // ── A2: unknown task_type → explicit error, no agent ever called ──────
  {
    console.log('\n  [A2] task_type: "bogus-value" → must throw, must not call any agent');
    const fakeRunner = new FakeRunner({ allowedAgent: null, mockEnvelope: null });
    const request = { task_type: 'bogus-value', task_id: 'a2-task-id' };

    try {
      await routeTask(request, fakeRunner);
      check('routeTask threw for an unknown task_type', false);
    } catch (err) {
      check('routeTask threw for an unknown task_type', true);
      check('error message mentions "Unknown task_type"', err.message.includes('Unknown task_type'));
      check('no agent was called before the error', fakeRunner.calls.length === 0);
    }
  }

  // ── A3: task_type: null → explicit error, no agent ever called ────────
  {
    console.log('\n  [A3] task_type: null → must throw, must not call any agent');
    const fakeRunner = new FakeRunner({ allowedAgent: null, mockEnvelope: null });
    const request = { task_type: null, task_id: 'a3-task-id' };

    try {
      await routeTask(request, fakeRunner);
      check('routeTask threw for task_type: null', false);
    } catch (err) {
      check('routeTask threw for task_type: null', true);
      check('error message mentions "Unknown task_type"', err.message.includes('Unknown task_type'));
      check('no agent was called before the error', fakeRunner.calls.length === 0);
    }
  }

  // ── A4: task_type key entirely absent → defaults to Content Pipeline.
  // Proven via a probe: the real runFullPipeline() is entered (task-
  // router.js imports it directly; there is no seam to avoid this
  // without editing production files), but FakeRunner intercepts and
  // throws on its very first callAgent('pattern-engine', ...) call
  // before any real work or network I/O happens.
  //
  // NOTE — fragility: this probe assumes pattern-engine is the first
  // agent runFullPipeline() calls, which is true today (pipeline-
  // runner.js's current Content Pipeline entry order: pattern-engine →
  // reversal-engine → ...). If that entry order is ever changed in
  // pipeline-runner.js, this specific assertion (agentName ===
  // 'pattern-engine') would need updating to match the new first
  // stage — the probe itself (throwing on the first callAgent call)
  // would still correctly detect "Content Pipeline was entered", but
  // the agent-name check is tied to today's known first stage, not a
  // stage-order-independent guarantee. ───────────────────────────────────
  {
    console.log('\n  [A4] task_type key absent → defaults to Content Pipeline (probe, no real execution)');
    const fakeRunner = new FakeRunner({ allowedAgent: null, mockEnvelope: null });
    const request = {
      task_id: 'a4-task-id',
      raw_input: 'irrelevant — probe stops before this is used',
      target_medium: 'short-video',
      constraints: [],
    };
    // Note: no `task_type` key at all.

    try {
      await routeTask(request, fakeRunner);
      check('routeTask threw the expected probe stop', false);
    } catch (err) {
      const isProbeStop = err.message.includes('probe stop');
      check('routeTask entered the Content Pipeline branch (probe stop reached)', isProbeStop);
      check('exactly one agent call was attempted', fakeRunner.calls.length === 1);
      check(
        'the attempted call was to "pattern-engine" (Content Pipeline\'s current first stage), NOT "core-engine"',
        fakeRunner.calls[0]?.agentName === 'pattern-engine'
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Layer B — real end-to-end test through the actual provider
// ═══════════════════════════════════════════════════════════════════════
async function runLayerB() {
  section('LAYER B — real end-to-end test (request → routeTask → core-engine → provider)');

  const taskId = `pa-e2e-${Date.now()}`;

  // Mock data — three systems (exceeds the required minimum of two),
  // reusing the same canonical scenario as Phase 1's test-core-engine-
  // call.js (subject-mock-014), now sent through routeTask() as a full
  // operator request rather than calling core-engine directly.
  const request = {
    task_type: 'personal-analysis',
    task_id: taskId,
    subject_id: 'subject-mock-014',
    subject_profile: {
      birth_data: { date: '1991-03-14', time: '06:45', place: 'Ankara, TR' },
      life_events: [
        { period: '2016-2018', description: 'Left stable corporate role to build an independent project.' },
        { period: '2022-2024', description: 'Repeated pattern of starting collaborations then withdrawing when authority became shared.' },
      ],
      user_notes: 'Feels caught between needing autonomy and repeatedly choosing structures that limit it.',
    },
    analysis_inputs: {
      astrological: {
        system: 'astrological',
        findings: [
          { id: 'astro-001', theme: 'autonomy pressure', claim: 'Chart emphasizes self-directed initiation.', evidence_refs: ['Saturn in 10th house'] },
        ],
      },
      numerological: {
        system: 'numerological',
        findings: [
          { id: 'num-001', theme: 'autonomy pressure', claim: 'Life Path favors independent path.', evidence_refs: ['Life Path 1'] },
          { id: 'num-002', theme: 'partnership pull', claim: 'Soul Urge 2 suggests cooperative bonding need.', evidence_refs: ['Soul Urge 2'] },
        ],
      },
      fate_matrix: {
        system: 'fate_matrix',
        findings: [
          { id: 'fm-001', theme: 'autonomy pressure', claim: 'Central arc emphasizes self-definition through exit.', evidence_refs: ['Arc 1-5-1'] },
        ],
      },
      ebced: null,
    },
    constraints: ['no certain future predictions'],
  };

  const runner = new Runner();
  let result;

  try {
    result = await routeTask(request, runner);
  } catch (err) {
    console.log(`\n  ✗ routeTask threw unexpectedly: ${err.message}`);
    console.log('  This is a code-level failure, not an expected provider/env condition.');
    return false;
  }

  // ── Structural checks on the returned shape ───────────────────────────
  check('result has "ok"', 'ok' in result);
  check('result has "trace"', 'trace' in result);
  check('result has "stoppedAt"', 'stoppedAt' in result);
  check('result has "result"', 'result' in result);

  // NOTE: this only checks that trace.stages contains the single key we
  // expect ('core-engine') given how personal-analysis-pipeline-runner.js
  // is written today. It is structural evidence consistent with "no
  // Content agent was called," but it is NOT the proof that no Content
  // agent was called — this real Runner is not instrumented the way
  // FakeRunner is, so there is nothing here recording every callAgent
  // invocation to assert against. That proof belongs to Layer A only
  // (see A1-A4 above, which assert directly on FakeRunner.calls).
  const stageKeys = Object.keys(result.trace?.stages ?? {});
  check(
    "trace.stages contains only the key 'core-engine' (structural check, not a call-interception proof)",
    stageKeys.length === 1 && stageKeys[0] === 'core-engine'
  );
  check(
    "trace.stages['core-engine'].agent === 'core-engine'",
    result.trace?.stages?.['core-engine']?.agent === 'core-engine'
  );

  // ── Case: the call to core-engine itself failed (provider error,
  // missing API key, etc.) — result.result is null per the Phase 2
  // Step 2 design. Report clearly and stop; no envelope fields to check. ──
  if (result.result === null) {
    const stageInfo = result.trace?.stages?.['core-engine'];
    console.log('\n  ✗ core-engine call did not succeed — no envelope to validate.');
    console.log(`  Failure stage: ${stageInfo?.stage ?? 'unknown'}`);
    console.log(`  Error: ${JSON.stringify(stageInfo?.error, null, 2)}`);
    if (stageInfo?.stage === 'provider_call' && stageInfo?.error?.type === 'auth_error') {
      console.log('\n  → This looks like a missing or invalid OPENAI_API_KEY in your .env file,');
      console.log('    not a bug in the routing/pipeline code. Set OPENAI_API_KEY and re-run.');
    }
    check('result.ok === false when the call itself failed', result.ok === false);
    check("result.stoppedAt === 'core-engine' when the call itself failed", result.stoppedAt === 'core-engine');
    return false;
  }

  // ── Envelope field checks ──────────────────────────────────────────────
  const envelope = result.result;
  check('result.result.task_id is present', typeof envelope.task_id === 'string');
  check('result.result.status is present', typeof envelope.status === 'string');
  check('result.result.payload is present', typeof envelope.payload === 'object' && envelope.payload !== null);

  console.log(`\n  core-engine status: ${envelope.status}`);

  if (envelope.status === 'complete') {
    check('status === "complete" → result.ok === true', result.ok === true);
    check('status === "complete" → result.stoppedAt === null', result.stoppedAt === null);
  } else {
    check(`status === "${envelope.status}" → result.ok === false`, result.ok === false);
    check(`status === "${envelope.status}" → result.stoppedAt === 'core-engine'`, result.stoppedAt === 'core-engine');
  }

  console.log('\n  Full result object:');
  console.log(JSON.stringify(result, null, 2));

  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// Run both layers
// ═══════════════════════════════════════════════════════════════════════
console.log('\n[ATLAS Runner — Personal Analysis Pipeline E2E test]');

await runLayerA();
await runLayerB();

console.log(`\n${'═'.repeat(60)}`);
if (failedChecks === 0) {
  console.log(`✓ PASS — all ${totalChecks} checks passed.`);
  process.exitCode = 0;
} else {
  console.log(`✗ FAIL — ${failedChecks} of ${totalChecks} checks failed.`);
  process.exitCode = 1;
}
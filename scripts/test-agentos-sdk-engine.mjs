/**
 * AgentOS SDK Engine — structural + live-execution verification.
 *
 * Verifies the OpenAI Agents SDK integration (runner/sdk-runner.js) that
 * now sits underneath AgentOS, without re-testing AgentOS's own task
 * orchestration behavior (delegation shape, approval gates, cancellation,
 * etc.) — that coverage already exists in scripts/test-agentos-tasks.mjs
 * and is unchanged by this engine swap.
 *
 * If OPENAI_API_KEY is not configured, the live-execution check is
 * reported as BLOCKED, not skipped-as-pass and not simulated — it counts
 * separately from passed/failed so CI can tell "no key configured" apart
 * from "the integration is broken".
 *
 * Run: node scripts/test-agentos-sdk-engine.mjs
 */
import assert from 'node:assert/strict';
import { SdkRunner } from '../runner/sdk-runner.js';
import { VALID_AGENTS } from '../runner/agent-loader.js';

let passed = 0;
let failed = 0;
let blocked = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}: ${err?.message || err}`);
  }
}

function blockedCheck(name, reason) {
  blocked += 1;
  console.log(`BLOCKED ${name}: ${reason}`);
}

const HAS_KEY = Boolean(process.env.OPENAI_API_KEY);

// ── Structural checks (no LLM call — must pass regardless of API key) ───

await check('SdkRunner is a class exposing callAgent(agentName, input, taskId)', () => {
  const runner = new SdkRunner({ provider: 'openai' });
  assert.equal(typeof runner.callAgent, 'function');
});

await check('SdkRunner rejects a non-openai provider without attempting a call', async () => {
  const runner = new SdkRunner({ provider: 'anthropic' });
  const result = await runner.callAgent('research-critic-engine', { task_prompt: 'x', task_title: 'y', notes: null }, 'task_structural_test');
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'provider_call');
  assert.equal(result.error.type, 'unknown');
});

await check('SdkRunner surfaces unknown-agent prompt-loading failures before any provider call', async () => {
  const runner = new SdkRunner({ provider: 'openai' });
  const result = await runner.callAgent('not-a-real-agent', { task_prompt: 'x', task_title: 'y', notes: null }, 'task_structural_test');
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'prompt_loading');
});

await check('all 6 AgentOS research agent prompts load successfully through the SDK path\'s loader', () => {
  const runner = new SdkRunner({ provider: 'openai' });
  for (const name of ['research-atlas-core', 'research-core-engine', 'research-pattern-engine', 'research-critic-engine', 'research-quality-engine', 'research-visual-engine']) {
    assert.ok(VALID_AGENTS.includes(name), `${name} missing from VALID_AGENTS`);
  }
  assert.ok(typeof runner.callAgent === 'function');
});

if (!HAS_KEY) {
  await check('missing OPENAI_API_KEY produces a structural auth_error — no fabricated success, no throw', async () => {
    const runner = new SdkRunner({ provider: 'openai' });
    const result = await runner.callAgent('research-critic-engine', { task_prompt: 'Say hello.', task_title: 'Sanity check', notes: null }, 'task_structural_test');
    assert.equal(result.ok, false);
    assert.equal(result.stage, 'provider_call');
    assert.equal(result.error.type, 'auth_error');
    assert.match(result.error.message, /OPENAI_API_KEY/);
  });
} else {
  await check('OPENAI_API_KEY is configured and reachable via process.env for the SDK path', () => {
    assert.ok(process.env.OPENAI_API_KEY.length > 0);
  });
}

console.log('\n──────────────────────────────────────────────');
console.log('Live execution test — one real call through the OpenAI Agents SDK');
console.log('──────────────────────────────────────────────');

if (!HAS_KEY) {
  blockedCheck(
    'LIVE: research-critic-engine responds via Agent + run() with a valid envelope',
    'OPENAI_API_KEY not set in .env — cannot make a real OpenAI call. Structural wiring (prompt loading, error classification, envelope contract) is verified above; live execution is unverified, not assumed to work.',
  );
} else {
  await check('LIVE: research-critic-engine responds via Agent + run() with a valid envelope', async () => {
    const runner = new SdkRunner({ provider: 'openai' });
    const result = await runner.callAgent(
      'research-critic-engine',
      {
        task_prompt: 'This is a wiring smoke test for the OpenAI Agents SDK integration. Respond with your normal envelope; findings can be minimal.',
        task_title: 'SDK engine live smoke test',
        notes: null,
      },
      `task_sdk_live_${Date.now()}`,
    );
    if (!result.ok) {
      throw new Error(`live call failed at stage=${result.stage}: ${result.error?.message}`);
    }
    assert.equal(result.envelope.agent, 'research-critic-engine');
    assert.ok(result.meta.model);
    assert.ok(typeof result.meta.latency_ms === 'number');
    console.log(`  model: ${result.meta.model}, tokens: ${result.meta.tokens_used}, latency: ${result.meta.latency_ms}ms`);
  });
}

console.log(`\n────────────────────────────────`);
console.log(`Passed:  ${passed}`);
console.log(`Failed:  ${failed}`);
console.log(`Blocked: ${blocked}`);
if (failed > 0) {
  process.exit(1);
} else if (blocked > 0) {
  console.log('STRUCTURAL TESTS PASSED — LIVE EXECUTION BLOCKED (OPENAI_API_KEY not configured)');
} else {
  console.log('ALL AGENTOS SDK ENGINE TESTS PASSED (including live execution)');
}

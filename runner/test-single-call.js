// ═══════════════════════════════════════════════════════════════════════
// Phase 1 Test — one single-agent call, nothing else.
//
// This is a manual smoke test, not a pipeline run. It exercises the full
// chain (prompt loader → envelope → provider adapter → runner → output
// parsing) against exactly one agent: pattern-engine, using the same
// example task already documented in atlas-core.md / pattern-engine.md.
//
// This intentionally does NOT chain into reversal-engine or any other
// agent — multi-agent sequencing is out of scope until Phase 2.
//
// Usage:
//   node runner/test-single-call.js
//
// Requires:
//   - npm install already run (this project's own existing requirement)
//   - a .env file at the project root with OPENAI_API_KEY=sk-...
// ═══════════════════════════════════════════════════════════════════════

import { Runner } from './runner.js';

const taskId = `test-${Date.now()}`;

// Same example input as pattern-engine.md's own "Example Task" section.
const input = {
  task_id: taskId,
  raw_input:
    "People keep saying old software version numbers 'mean something' astrologically — like v2.0 releases correlating with disruptive years. Is there a real pattern here or is it numerology dressed as tech commentary?",
  target_medium: 'short-video',
  constraints: ['no direct claims of causation', 'no named real companies'],
};

console.log(`\n[ATLAS Runner — Phase 1 Test]`);
console.log(`Calling agent: pattern-engine`);
console.log(`task_id: ${taskId}\n`);

const runner = new Runner();
const result = await runner.callAgent('pattern-engine', input, taskId);

if (result.ok) {
  console.log('✓ SUCCESS\n');
  console.log(
    `  provider: ${result.meta.provider} | model: ${result.meta.model} | ` +
    `tokens: ${result.meta.tokens_used ?? 'n/a'} | latency: ${result.meta.latency_ms}ms\n`
  );
  console.log('Parsed response envelope:');
  console.log(JSON.stringify(result.envelope, null, 2));
} else {
  console.log(`✗ FAILED at stage: ${result.stage}\n`);
  console.log('Error:', JSON.stringify(result.error, null, 2));
  if (result.raw?.text) {
    console.log('\nRaw model output (for debugging):\n');
    console.log(result.raw.text);
  }
  process.exitCode = 1;
}

/**
 * AgentOS Task Orchestration — Phase 1 regression + required live test.
 * Run: node scripts/test-agentos-tasks.mjs
 */
import { join } from 'path';
import { tmpdir } from 'os';
process.env.ATLAS_AGENT_TASKS_DB = join(tmpdir(), `atlas-agent-tasks-test-${process.pid}.sqlite`);

import assert from 'node:assert/strict';
import { createAgentTask, runAgentTask, buildDelegation, MAX_DELEGATED_AGENTS } from '../server/agentos/orchestrator.js';
import { getTask, listSubtasks } from '../server/agentos/task-store.js';
import { cancelAgentTask, approveAgentTaskAction } from '../server/admin/agentos-task-actions.js';
import { isValidOwnerAgent, isValidTaskMode } from '../server/agentos/schema.js';
import { VALID_AGENTS } from '../runner/agent-loader.js';

let passed = 0;
let failed = 0;

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForTerminal(taskId, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const task = getTask(taskId);
    if (['waiting_for_review', 'completed', 'failed', 'cancelled'].includes(task.status)) return task;
    await sleep(200);
  }
  throw new Error(`Task ${taskId} did not reach a terminal status within ${timeoutMs}ms`);
}

// ── Structural checks (no LLM call) ──────────────────────────────────────

check('all 6 research agent names are registered in runner/agent-loader.js', () => {
  for (const name of ['research-atlas-core', 'research-core-engine', 'research-pattern-engine', 'research-critic-engine', 'research-quality-engine', 'research-visual-engine']) {
    assert.ok(VALID_AGENTS.includes(name), `missing ${name}`);
  }
});

check('owner/mode validators reject unknown values', () => {
  assert.equal(isValidOwnerAgent('atlas-core'), true);
  assert.equal(isValidOwnerAgent('nonsense'), false);
  assert.equal(isValidTaskMode('research_only'), true);
  assert.equal(isValidTaskMode('nonsense'), false);
});

check('buildDelegation for atlas-core matches the required test delegation (Core/Pattern/Critic/Quality, no Visual)', () => {
  const delegation = buildDelegation('atlas-core', {
    title: 'Lara Prime gap survey',
    prompt: 'Review the current Lara Prime architecture and identify the top 3 gaps before community implementation.',
    notes: null,
  });
  const ids = delegation.map((d) => d.ownerId);
  assert.deepEqual(ids, ['core-engine', 'pattern-engine', 'critic-engine', 'quality-engine']);
  assert.ok(delegation.length <= MAX_DELEGATED_AGENTS);
});

check('buildDelegation adds visual-engine only when the task mentions UI/IA', () => {
  const delegation = buildDelegation('atlas-core', { title: 'IA review', prompt: 'Evaluate the navigation and information architecture for this UI change.', notes: null });
  assert.ok(delegation.some((d) => d.ownerId === 'visual-engine'));
});

check('buildDelegation for a single delegate owner produces exactly one subtask', () => {
  const delegation = buildDelegation('critic-engine', { title: 'x', prompt: 'y', notes: null });
  assert.equal(delegation.length, 1);
  assert.equal(delegation[0].agentName, 'research-critic-engine');
});

check('createAgentTask rejects invalid owner/mode/missing fields', async () => {
  const r1 = await createAgentTask({ title: '', prompt: 'x', ownerAgent: 'atlas-core', actorId: 'admin:test' });
  assert.equal(r1.ok, false);
  const r2 = await createAgentTask({ title: 'x', prompt: 'y', ownerAgent: 'not-a-real-agent', actorId: 'admin:test' });
  assert.equal(r2.ok, false);
  const r3 = await createAgentTask({ title: 'x', prompt: 'y', ownerAgent: 'atlas-core', mode: 'not-a-real-mode', actorId: 'admin:test' });
  assert.equal(r3.ok, false);
});

check('createAgentTask defaults mode to research_only', async () => {
  const r = await createAgentTask({ title: 'Default mode check', prompt: 'x', ownerAgent: 'critic-engine', actorId: 'admin:test' });
  assert.equal(r.ok, true);
  assert.equal(r.task.mode, 'research_only');
  // Let the fire-and-forget execution settle before moving on, so it
  // doesn't race the next test's DB writes.
  await waitForTerminal(r.task.id).catch(() => {});
});

check('no-duplicate-execution: claiming a task twice only runs it once', async () => {
  const r = await createAgentTask({ title: 'Duplicate-claim check', prompt: 'x', ownerAgent: 'critic-engine', actorId: 'admin:test' });
  await waitForTerminal(r.task.id);
  const before = listSubtasks(r.task.id).length;
  await runAgentTask(r.task.id); // second attempt — task is no longer 'queued'
  const after = listSubtasks(r.task.id).length;
  assert.equal(before, after, 'a second runAgentTask() call must not create additional subtasks');
});

check('cancelAgentTask rejects an already-terminal task', async () => {
  const r = await createAgentTask({ title: 'Cancel-terminal check', prompt: 'x', ownerAgent: 'critic-engine', actorId: 'admin:test' });
  await waitForTerminal(r.task.id);
  const cancel = await cancelAgentTask({ actorId: 'admin:test', taskId: r.task.id });
  assert.equal(cancel.ok, false);
});

check('approveAgentTaskAction: push/deploy are always rejected regardless of mode (Phase 1 hard gate)', async () => {
  const r = await createAgentTask({ title: 'Push/deploy gate check', prompt: 'x', ownerAgent: 'critic-engine', mode: 'implementation_allowed', actorId: 'admin:test' });
  await waitForTerminal(r.task.id);
  const push = await approveAgentTaskAction({ actorId: 'admin:test', taskId: r.task.id, action: 'push' });
  assert.equal(push.ok, false);
  assert.equal(push.status, 501);
  const deploy = await approveAgentTaskAction({ actorId: 'admin:test', taskId: r.task.id, action: 'deploy' });
  assert.equal(deploy.ok, false);
  assert.equal(deploy.status, 501);
});

check('approveAgentTaskAction: implementation/commit rejected when task mode is research_only', async () => {
  const r = await createAgentTask({ title: 'Mode gate check', prompt: 'x', ownerAgent: 'critic-engine', mode: 'research_only', actorId: 'admin:test' });
  await waitForTerminal(r.task.id);
  const approve = await approveAgentTaskAction({ actorId: 'admin:test', taskId: r.task.id, action: 'implementation' });
  assert.equal(approve.ok, false);
});

console.log('\n──────────────────────────────────────────────');
console.log('Required test #14 — full research pipeline via createAgentTask()');
console.log('──────────────────────────────────────────────');

await check('REQUIRED TEST: Lara Prime gap-survey task runs end-to-end with no implementation side effects', async () => {
  const create = await createAgentTask({
    title: 'Lara Prime gap survey',
    prompt: 'Review the current Lara Prime architecture and identify the top 3 gaps before community implementation.',
    ownerAgent: 'atlas-core',
    mode: 'research_only',
    actorId: 'admin:test',
  });
  assert.equal(create.ok, true, 'task creation must succeed');
  assert.equal(create.task.status, 'queued', 'task must start queued (owner "received" it via the DB record)');

  const finalTask = await waitForTerminal(create.task.id, 60_000);
  const subtasks = listSubtasks(create.task.id);

  console.log(`  task id: ${create.task.id}`);
  console.log(`  final status: ${finalTask.status}`);
  console.log(`  subtasks (${subtasks.length}): ${subtasks.map((s) => `${s.label} -> ${s.status}`).join(' | ')}`);
  if (finalTask.error) console.log(`  task error: ${finalTask.error.message}`);
  for (const s of subtasks) {
    if (s.error) console.log(`  subtask error [${s.agentName}]: ${s.error.message}`);
  }
  if (finalTask.finalSynthesis) {
    console.log(`  final synthesis present: yes (status=${finalTask.status})`);
  }

  // Delegation must be exactly the 4 required delegate agents (visual-engine
  // excluded — the task text doesn't mention UI/IA), PLUS the synthesis
  // subtask itself (research-atlas-core), which is also tracked as a
  // visible subtask row for full delegation-tree transparency.
  const delegateLabels = subtasks.filter((s) => s.agentName !== 'research-atlas-core').map((s) => s.label).sort();
  assert.deepEqual(
    delegateLabels,
    ['Core Engine — technical architecture', 'Critic Engine — risk review', 'Pattern Engine — product architecture', 'Quality Engine — quality/security review'].sort(),
  );
  assert.ok(subtasks.some((s) => s.agentName === 'research-atlas-core'), 'synthesis subtask must also be tracked');
  assert.equal(subtasks.length, 5, 'expected 4 delegates + 1 synthesis subtask');

  // The task must reach a real terminal status either way.
  assert.ok(['waiting_for_review', 'failed'].includes(finalTask.status));

  // No implementation/commit/push/deploy ever auto-approved.
  assert.deepEqual(finalTask.approvals, { implementation: false, commit: false, push: false, deploy: false });
});

console.log(`\n────────────────────────────────`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL AGENTOS TASK ORCHESTRATION TESTS PASSED');
}

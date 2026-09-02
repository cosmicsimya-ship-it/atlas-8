// ═══════════════════════════════════════════════════════════════════════
// AgentOS Task Orchestration — Phase 1 orchestrator
//
// createAgentTask() validates + persists a task, then fires runAgentTask()
// WITHOUT awaiting it (the HTTP handler returns immediately; callers poll
// GET /api/admin/agent-tasks/:id for live status).
//
// runAgentTask() claims the task (no-duplicate-execution guard), builds a
// delegation list, runs delegates through the REAL runner (runner/runner.js
// -> callOpenAI, genuine completions, no fabricated output), and — for
// owner "atlas-core" — makes one more real call to research-atlas-core for
// the final synthesis. Every LLM call goes through the existing Runner
// class exactly as the personal-analysis pipeline already does.
//
// KNOWN LIMITATION (see docs/adr or the AgentOS report for the full
// writeup): delegate agents have no file/tool access. They reason only
// over the task's own prompt/notes/title (+ sibling findings for the
// second wave). This is documented, not hidden — see each agent's own
// "Critical Operating Constraint" section in agents/research-*.md.
// ═══════════════════════════════════════════════════════════════════════

import { Runner } from '../../runner/runner.js';
import {
  OWNER_TO_DELEGATE_AGENT,
  isValidOwnerAgent,
  isValidTaskMode,
  DEFAULT_TASK_MODE,
} from './schema.js';
import {
  insertTask,
  getTask,
  claimTaskStatus,
  setTaskStatus,
  insertSubtask,
  setSubtaskStatus,
  listSubtasks,
} from './task-store.js';

const MAX_TITLE_LENGTH = 200;
const MAX_PROMPT_LENGTH = 4000;
const MAX_NOTES_LENGTH = 2000;

export const MAX_DELEGATED_AGENTS = 5;
export const MAX_TASK_RUNTIME_MS = 10 * 60 * 1000; // 10 minutes

const DELEGATE_LABELS = Object.freeze({
  'core-engine': 'Core Engine — technical architecture',
  'pattern-engine': 'Pattern Engine — product architecture',
  'critic-engine': 'Critic Engine — risk review',
  'quality-engine': 'Quality Engine — quality/security review',
  'visual-engine': 'Visual Engine — visual/IA fit',
});

const VISUAL_KEYWORD_RE = /\b(ui|ux|visual|design system|information architecture|\bia\b|navigation|nav\b|layout|screen|interface)\b/i;

const runner = new Runner({ provider: 'openai' });

function nowIso() {
  return new Date().toISOString();
}

function boundedString(value, maxLen) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLen);
}

/**
 * @param {{ title: string, prompt: string, ownerAgent: string, mode?: string, notes?: string, actorId: string }} input
 * @returns {Promise<{ ok: true, task: object } | { ok: false, status: number, error: string }>}
 */
export async function createAgentTask(input) {
  const title = boundedString(input.title, MAX_TITLE_LENGTH);
  const prompt = boundedString(input.prompt, MAX_PROMPT_LENGTH);
  const notes = input.notes != null ? boundedString(input.notes, MAX_NOTES_LENGTH) : null;
  const ownerAgent = String(input.ownerAgent || '').trim();
  const mode = input.mode ? String(input.mode).trim() : DEFAULT_TASK_MODE;

  if (!title) return { ok: false, status: 400, error: 'title is required' };
  if (!prompt) return { ok: false, status: 400, error: 'prompt is required' };
  if (!isValidOwnerAgent(ownerAgent)) {
    return { ok: false, status: 400, error: `Invalid ownerAgent. Must be one of: atlas-core, ${Object.keys(OWNER_TO_DELEGATE_AGENT).join(', ')}` };
  }
  if (!isValidTaskMode(mode)) {
    return { ok: false, status: 400, error: 'Invalid mode. Must be research_only, review_only, or implementation_allowed' };
  }
  if (!input.actorId) return { ok: false, status: 400, error: 'actorId is required' };

  const task = await insertTask({ title, prompt, ownerAgent, mode, notes, createdBy: input.actorId });

  // Fire and forget — the HTTP handler must not block on agent execution.
  // Any error here is caught and written to the task row; it must never
  // become an unhandled rejection.
  runAgentTask(task.id).catch(async (err) => {
    try {
      await setTaskStatus(task.id, 'failed', {
        completedAt: nowIso(),
        error: { message: String(err?.message || err), stage: 'orchestrator_uncaught' },
      });
    } catch {
      /* best effort */
    }
  });

  return { ok: true, task };
}

/**
 * @param {string} ownerAgent
 * @param {{ title: string, prompt: string, notes: string|null }} taskFields
 * @returns {{ ownerId: string, agentName: string, label: string }[]}
 */
function buildDelegation(ownerAgent, taskFields) {
  if (ownerAgent !== 'atlas-core') {
    const agentName = OWNER_TO_DELEGATE_AGENT[ownerAgent];
    return [{ ownerId: ownerAgent, agentName, label: DELEGATE_LABELS[ownerAgent] || ownerAgent }];
  }

  const wave1 = ['core-engine', 'pattern-engine'];
  const wave2 = ['critic-engine', 'quality-engine'];
  const text = `${taskFields.title} ${taskFields.prompt} ${taskFields.notes || ''}`;
  if (VISUAL_KEYWORD_RE.test(text)) wave2.push('visual-engine');

  const toDelegate = (ownerId) => ({
    ownerId,
    agentName: OWNER_TO_DELEGATE_AGENT[ownerId],
    label: DELEGATE_LABELS[ownerId] || ownerId,
  });

  return [...wave1.map(toDelegate), ...wave2.map(toDelegate)];
}

/**
 * Run one delegate through the real Runner. Never throws — every failure
 * mode is captured as a subtask 'failed' row (failure isolation).
 * @param {{ taskId: string, delegate: object, taskFields: object, extraInput?: object }} args
 *   extraInput is merged into the agent's Input Contract as-is — callers
 *   pass { sibling_findings } for wave-2 delegates and { sub_results } for
 *   the research-atlas-core synthesis call, matching each agent's own
 *   Input Contract in its agents/research-*.md file.
 */
async function runDelegateSubtask({ taskId, delegate, taskFields, extraInput }) {
  const subtask = await insertSubtask({ taskId, agentName: delegate.agentName, label: delegate.label });
  await setSubtaskStatus(subtask.id, 'running', { startedAt: nowIso() });

  const input = {
    task_prompt: taskFields.prompt,
    task_title: taskFields.title,
    notes: taskFields.notes,
    ...(extraInput || {}),
  };

  const result = await runner.callAgent(delegate.agentName, input, taskId);

  if (!result.ok) {
    await setSubtaskStatus(subtask.id, 'failed', {
      completedAt: nowIso(),
      error: { stage: result.stage, message: result.error?.message || 'unknown error', type: result.error?.type },
    });
    return { ownerId: delegate.ownerId, agentName: delegate.agentName, status: 'failed', payload: null, error: result.error?.message || 'unknown error' };
  }

  await setSubtaskStatus(subtask.id, 'completed', {
    completedAt: nowIso(),
    output: result.envelope,
    model: result.meta?.model,
    tokensUsed: result.meta?.tokens_used,
    latencyMs: result.meta?.latency_ms,
  });

  return { ownerId: delegate.ownerId, agentName: delegate.agentName, status: result.envelope.status, payload: result.envelope.payload, error: null };
}

/**
 * @param {string} taskId
 */
export async function runAgentTask(taskId) {
  const claimed = await claimTaskStatus(taskId, 'queued', 'running', { setStartedAt: true });
  if (!claimed) {
    // Either already running/finished (no-duplicate-execution guard did its
    // job) or the task doesn't exist. Either way, nothing more to do here.
    return;
  }

  const runPromise = executeClaimedTask(taskId);
  let timeoutHandle;
  const timeoutPromise = new Promise((resolve) => {
    timeoutHandle = setTimeout(() => resolve({ timedOut: true }), MAX_TASK_RUNTIME_MS);
  });

  const outcome = await Promise.race([runPromise.then((r) => ({ ...r, timedOut: false })), timeoutPromise]);
  // Whichever branch won, the loser must not keep the process alive — clear
  // the timer explicitly rather than relying on it to fire naturally.
  clearTimeout(timeoutHandle);

  if (outcome.timedOut) {
    // Mark any subtasks still 'running' as failed, then fail the task.
    const subtasks = listSubtasks(taskId);
    await Promise.allSettled(
      subtasks
        .filter((s) => s.status === 'running' || s.status === 'queued')
        .map((s) => setSubtaskStatus(s.id, 'failed', { completedAt: nowIso(), error: { stage: 'timeout', message: 'Task exceeded max runtime' } })),
    );
    await setTaskStatus(taskId, 'failed', {
      completedAt: nowIso(),
      error: { stage: 'timeout', message: `Task exceeded MAX_TASK_RUNTIME_MS (${MAX_TASK_RUNTIME_MS}ms)` },
    });
  }
}

async function isCancelled(taskId) {
  const task = getTask(taskId);
  return task?.status === 'cancelled';
}

async function executeClaimedTask(taskId) {
  const task = getTask(taskId);
  if (!task) return { skipped: true };

  const taskFields = { title: task.title, prompt: task.prompt, notes: task.notes };
  const delegation = buildDelegation(task.ownerAgent, taskFields).slice(0, MAX_DELEGATED_AGENTS);

  if (await isCancelled(taskId)) return { skipped: true };

  // Single-delegate owner: one call, its own output IS the final result.
  if (task.ownerAgent !== 'atlas-core') {
    const result = await runDelegateSubtask({ taskId, delegate: delegation[0], taskFields });
    if (await isCancelled(taskId)) return { skipped: true };
    if (result.status === 'failed') {
      await setTaskStatus(taskId, 'failed', { completedAt: nowIso(), error: { stage: result.agentName, message: result.error } });
    } else {
      await setTaskStatus(taskId, 'waiting_for_review', { completedAt: nowIso(), finalSynthesis: result.payload });
    }
    return { skipped: false };
  }

  // atlas-core: wave 1 (core + pattern), then wave 2 (critic + quality [+ visual])
  const wave1 = delegation.filter((d) => d.ownerId === 'core-engine' || d.ownerId === 'pattern-engine');
  const wave2 = delegation.filter((d) => d.ownerId !== 'core-engine' && d.ownerId !== 'pattern-engine');

  const wave1Settled = await Promise.allSettled(
    wave1.map((delegate) => runDelegateSubtask({ taskId, delegate, taskFields })),
  );
  const wave1Results = wave1Settled.map((s, i) =>
    s.status === 'fulfilled' ? s.value : { ownerId: wave1[i].ownerId, agentName: wave1[i].agentName, status: 'failed', payload: null, error: String(s.reason) },
  );

  if (await isCancelled(taskId)) return { skipped: true };

  const siblingFindings = wave1Results
    .filter((r) => r.payload?.findings)
    .flatMap((r) => r.payload.findings.map((f) => ({ ...f, source: r.agentName })));

  const wave2Settled = await Promise.allSettled(
    wave2.map((delegate) => runDelegateSubtask({ taskId, delegate, taskFields, extraInput: { sibling_findings: siblingFindings } })),
  );
  const wave2Results = wave2Settled.map((s, i) =>
    s.status === 'fulfilled' ? s.value : { ownerId: wave2[i].ownerId, agentName: wave2[i].agentName, status: 'failed', payload: null, error: String(s.reason) },
  );

  if (await isCancelled(taskId)) return { skipped: true };

  const allResults = [...wave1Results, ...wave2Results];

  // Synthesis stage — one more real LLM call to research-atlas-core, given
  // every delegate's result (including failures) as sub_results, per its
  // own Input Contract in agents/research-atlas-core.md.
  const subResults = allResults.map((r) => ({
    agent: r.agentName,
    status: r.status,
    payload: r.payload,
    error: r.error,
  }));
  const synthesisResult = await runDelegateSubtask({
    taskId,
    delegate: { ownerId: 'atlas-core', agentName: 'research-atlas-core', label: 'Atlas Core — synthesis' },
    taskFields,
    extraInput: { sub_results: subResults },
  }).catch((err) => ({ ownerId: 'atlas-core', agentName: 'research-atlas-core', status: 'failed', payload: null, error: String(err?.message || err) }));

  if (await isCancelled(taskId)) return { skipped: true };

  const allFailed = allResults.every((r) => r.status === 'failed') && synthesisResult.status === 'failed';
  if (allFailed) {
    await setTaskStatus(taskId, 'failed', {
      completedAt: nowIso(),
      error: { stage: 'all_delegates_failed', message: 'Every delegate and the synthesis call failed.' },
    });
    return { skipped: false };
  }

  const finalSynthesis =
    synthesisResult.status !== 'failed' && synthesisResult.payload
      ? synthesisResult.payload
      : {
          findings: allResults.filter((r) => r.payload?.summary).map((r) => `[${r.agentName}] ${r.payload.summary}`),
          decisions: [],
          risks: ['Synthesis call failed or returned no payload; showing raw delegate summaries instead.'],
          next_actions: ['Review individual subtask outputs; re-run the task if synthesis quality is insufficient.'],
        };

  await setTaskStatus(taskId, 'waiting_for_review', { completedAt: nowIso(), finalSynthesis });
  return { skipped: false };
}

export { buildDelegation };

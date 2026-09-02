// ═══════════════════════════════════════════════════════════════════════
// AgentOS Task Actions — Admin write actions for agent tasks.
// Mirrors server/admin/write-actions.js's exact shape:
//   - reuses the task store's existing write functions (no new storage)
//   - logs a before/after SUMMARY to the audit log (never a raw payload)
//   - validates all input server-side
// ═══════════════════════════════════════════════════════════════════════

import { logAdminAudit } from '../auth/admin-audit.js';
import { getTask, setTaskStatus, listSubtasks, setSubtaskStatus } from '../agentos/task-store.js';
import { isValidApprovalAction, PHASE1_DISABLED_APPROVAL_ACTIONS } from '../agentos/schema.js';

const MAX_REASON_LENGTH = 200;

function boundedReason(reason) {
  if (reason === undefined || reason === null) return null;
  if (typeof reason !== 'string') return { error: 'Invalid reason' };
  if (reason.length > MAX_REASON_LENGTH) return { error: 'Reason too long' };
  return reason.trim() || null;
}

function audit({ actorId, action, targetTaskId, before, after, result, reason }) {
  try {
    logAdminAudit({
      action,
      actor: actorId,
      targetUserId: `agent-task:${targetTaskId}`,
      result,
      reason: reason ?? undefined,
      meta: { before, after },
    });
  } catch {
    /* audit failure must never block the actual mutation's response */
  }
}

function requireTask(taskId) {
  const task = getTask(taskId);
  if (!task) return { ok: false, status: 404, error: 'Task not found' };
  return { ok: true, task };
}

/**
 * @param {{ actorId: string, taskId: string, reason?: string }} input
 */
export async function cancelAgentTask({ actorId, taskId, reason }) {
  const found = requireTask(taskId);
  if (!found.ok) return found;

  const boundedR = boundedReason(reason);
  if (boundedR && boundedR.error) return { ok: false, status: 400, error: boundedR.error };

  const before = found.task.status;
  if (!['queued', 'running'].includes(before)) {
    audit({ actorId, action: 'agentos.task.cancel', targetTaskId: taskId, before, after: before, result: 'not_cancellable', reason: boundedR });
    return { ok: false, status: 409, error: `Cannot cancel a task in status "${before}"` };
  }

  const next = await setTaskStatus(taskId, 'cancelled', {
    completedAt: new Date().toISOString(),
    error: { stage: 'cancelled', message: `Cancelled by admin${boundedR ? `: ${boundedR}` : ''}` },
  });

  // Best-effort: mark any still-open subtasks as failed/cancelled-by-parent
  // so the delegation tree doesn't show a permanently 'running' row.
  try {
    const subtasks = listSubtasks(taskId);
    await Promise.allSettled(
      subtasks
        .filter((s) => s.status === 'queued' || s.status === 'running')
        .map((s) => setSubtaskStatus(s.id, 'failed', { completedAt: new Date().toISOString(), error: { stage: 'cancelled', message: 'Parent task cancelled' } })),
    );
  } catch {
    /* best effort */
  }

  audit({ actorId, action: 'agentos.task.cancel', targetTaskId: taskId, before, after: 'cancelled', result: 'ok', reason: boundedR });

  return { ok: true, task: next };
}

/**
 * @param {{ actorId: string, taskId: string, action: string, reason?: string }} input
 */
export async function approveAgentTaskAction({ actorId, taskId, action, reason }) {
  const found = requireTask(taskId);
  if (!found.ok) return found;

  const boundedR = boundedReason(reason);
  if (boundedR && boundedR.error) return { ok: false, status: 400, error: boundedR.error };

  if (!isValidApprovalAction(action)) {
    return { ok: false, status: 400, error: 'Invalid action. Must be one of: implementation, commit, push, deploy' };
  }

  // Phase 1 has no execution engine bound to push/deploy — always rejected,
  // regardless of task mode or status. This is a hard, structural refusal,
  // not a UI-only disable.
  if (PHASE1_DISABLED_APPROVAL_ACTIONS.includes(action)) {
    audit({ actorId, action: `agentos.task.approve.${action}`, targetTaskId: taskId, before: found.task.status, after: found.task.status, result: 'not_implemented_phase1', reason: boundedR });
    return { ok: false, status: 501, error: `"${action}" has no execution engine in Phase 1 — approval is not available yet` };
  }

  if ((action === 'implementation' || action === 'commit') && found.task.mode !== 'implementation_allowed') {
    return { ok: false, status: 409, error: `Task mode is "${found.task.mode}" — "${action}" approval requires mode "implementation_allowed"` };
  }

  if (found.task.status !== 'waiting_for_review') {
    return { ok: false, status: 409, error: `Cannot approve an action on a task in status "${found.task.status}" — must be "waiting_for_review"` };
  }

  const beforeApprovals = { ...found.task.approvals };
  const nextApprovals = { ...found.task.approvals, [action]: true };

  // Recording the approval is the ONLY effect. There is no implementation/
  // commit runner in Phase 1 to invoke — this write action never executes
  // code, never touches git, never deploys anything.
  const next = await setTaskStatus(taskId, 'completed', {
    completedAt: found.task.completedAt || new Date().toISOString(),
    approvals: nextApprovals,
  });

  audit({
    actorId,
    action: `agentos.task.approve.${action}`,
    targetTaskId: taskId,
    before: JSON.stringify(beforeApprovals),
    after: JSON.stringify(nextApprovals),
    result: 'ok',
    reason: boundedR,
  });

  return { ok: true, task: next };
}

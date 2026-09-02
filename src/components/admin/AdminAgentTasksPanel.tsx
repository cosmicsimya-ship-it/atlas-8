import { useEffect, useState } from 'react';

import { ApiError } from '../../services/api-client';
import {
  fetchAgentTasks,
  fetchAgentTaskDetail,
  createAgentTask,
  cancelAgentTask,
  approveAgentTaskAction,
  type AgentTask,
  type AgentSubtask,
  type OwnerAgent,
  type TaskMode,
  type ApprovalAction,
} from '../../services/atlas-admin-agent-tasks';

const OWNER_OPTIONS: { value: OwnerAgent; label: string }[] = [
  { value: 'atlas-core', label: 'Atlas Core (delegates to Core/Pattern/Critic/Quality)' },
  { value: 'core-engine', label: 'Core Engine' },
  { value: 'pattern-engine', label: 'Pattern Engine' },
  { value: 'critic-engine', label: 'Critic Engine' },
  { value: 'quality-engine', label: 'Quality Engine' },
  { value: 'visual-engine', label: 'Visual Engine' },
];

const MODE_OPTIONS: { value: TaskMode; label: string }[] = [
  { value: 'research_only', label: 'research_only' },
  { value: 'review_only', label: 'review_only' },
  { value: 'implementation_allowed', label: 'implementation_allowed' },
];

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  return err instanceof Error ? err.message : fallback;
}

function statusColor(status: string) {
  if (status === 'completed') return 'text-[#7fd88f]';
  if (status === 'failed') return 'text-red-300/80';
  if (status === 'cancelled') return 'text-[#8b93a3]';
  if (status === 'waiting_for_review') return 'text-[#c9b37a]/85';
  if (status === 'running') return 'text-[#8eeafa]/85';
  return 'text-[#9aa3b2]'; // queued
}

function CreateTaskForm({ onCreated }: { onCreated: (task: AgentTask) => void }) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [ownerAgent, setOwnerAgent] = useState<OwnerAgent>('atlas-core');
  const [mode, setMode] = useState<TaskMode>('research_only');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !prompt.trim()) {
      setError('Başlık ve görev metni zorunlu.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await createAgentTask({ title: title.trim(), prompt: prompt.trim(), ownerAgent, mode, notes: notes.trim() || undefined });
      onCreated(res.task);
      setTitle('');
      setPrompt('');
      setNotes('');
    } catch (err) {
      setError(errorMessage(err, 'Görev oluşturulamadı'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
      <p className="mb-3 text-[13px] font-medium text-[#e8ecf2]">Yeni Agent Task</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12px] text-[#8b93a3]">
          Başlık
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="atlas-field text-sm" maxLength={200} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[#8b93a3]">
          Owner agent
          <select value={ownerAgent} onChange={(e) => setOwnerAgent(e.target.value as OwnerAgent)} className="atlas-field text-sm">
            {OWNER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-[12px] text-[#8b93a3]">
        Görev / hedef
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="atlas-field text-sm" maxLength={4000} />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12px] text-[#8b93a3]">
          Task mode
          <select value={mode} onChange={(e) => setMode(e.target.value as TaskMode)} className="atlas-field text-sm">
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[#8b93a3]">
          Notlar / kısıtlar (opsiyonel)
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="atlas-field text-sm" maxLength={2000} />
        </label>
      </div>
      {error ? <p className="mt-2 text-[12px] text-red-300/85">{error}</p> : null}
      <button type="submit" disabled={busy} className="atlas-focus mt-3 rounded-lg border border-[#c9b37a]/40 bg-[#c9b37a]/10 px-4 py-2 text-[13px] text-[#c9b37a] disabled:opacity-50">
        {busy ? 'Oluşturuluyor…' : 'Görevi Oluştur'}
      </button>
    </form>
  );
}

function SynthesisSection({ label, items }: { label: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">{label}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] text-[#e8ecf2]">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ApproveButton({
  task,
  action,
  label,
  onApproved,
}: {
  task: AgentTask;
  action: ApprovalAction;
  label: string;
  onApproved: (task: AgentTask) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phase1Disabled = action === 'push' || action === 'deploy';
  const modeBlocks = (action === 'implementation' || action === 'commit') && task.mode !== 'implementation_allowed';
  const alreadyApproved = task.approvals[action];
  const statusBlocks = task.status !== 'waiting_for_review';
  const disabled = phase1Disabled || modeBlocks || statusBlocks || alreadyApproved || busy;

  async function click() {
    setBusy(true);
    setError(null);
    try {
      const res = await approveAgentTaskAction(task.id, action, undefined);
      onApproved(res.task);
    } catch (err) {
      setError(errorMessage(err, 'Onaylanamadı'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={click}
        disabled={disabled}
        title={phase1Disabled ? 'Phase 1\'de mevcut değil' : modeBlocks ? 'Bu görev modu implementation_allowed değil' : undefined}
        className="atlas-focus rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-[#e8ecf2] disabled:opacity-40"
      >
        {alreadyApproved ? `✓ ${label}` : label}
      </button>
      {error ? <p className="text-[11px] text-red-300/85">{error}</p> : null}
    </div>
  );
}

function TaskDetailDrawer({ taskId, onClose, onChanged }: { taskId: string; onClose: () => void; onChanged: (task: AgentTask) => void }) {
  const [task, setTask] = useState<AgentTask | null>(null);
  const [subtasks, setSubtasks] = useState<AgentSubtask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  async function refresh() {
    try {
      const res = await fetchAgentTaskDetail(taskId);
      setTask(res.task);
      setSubtasks(res.subtasks);
      onChanged(res.task);
    } catch (err) {
      setError(errorMessage(err, 'Görev yüklenemedi'));
    }
  }

  useEffect(() => {
    let cancelled = false;
    refresh();
    // Poll while the task is still in flight so status/subtask updates
    // appear without a manual refresh.
    const interval = setInterval(() => {
      if (!cancelled) refresh();
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function cancel() {
    setCancelBusy(true);
    try {
      const res = await cancelAgentTask(taskId);
      setTask(res.task);
      onChanged(res.task);
    } catch (err) {
      setError(errorMessage(err, 'İptal edilemedi'));
    } finally {
      setCancelBusy(false);
    }
  }

  const synthesis = task?.finalSynthesis as
    | { findings?: string[]; decisions?: string[]; risks?: string[]; next_actions?: string[]; summary?: string }
    | null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/60"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="h-full w-[min(100%,640px)] overflow-y-auto border-l border-white/10 bg-[#050608] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[12px] text-[#8b93a3]">{taskId}</p>
          <button type="button" onClick={onClose} aria-label="Kapat" className="atlas-focus text-[#8b93a3] hover:text-[#e8ecf2]">
            ✕
          </button>
        </div>

        {error ? <p className="mt-3 text-[12px] text-red-300/85">{error}</p> : null}

        {task ? (
          <>
            <h3 className="mt-3 text-[15px] font-medium text-[#e8ecf2]">{task.title}</h3>
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#9aa3b2]">{task.prompt}</p>

            <dl className="mt-4 space-y-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-[#8b93a3]">Owner</dt>
                <dd className="text-[#e8ecf2]">{task.ownerAgent}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#8b93a3]">Mode</dt>
                <dd className="text-[#e8ecf2]">{task.mode}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#8b93a3]">Status</dt>
                <dd className={statusColor(task.status)}>{task.status}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#8b93a3]">Created</dt>
                <dd className="text-[#9aa3b2]">{new Date(task.createdAt).toLocaleString('tr-TR')}</dd>
              </div>
              {task.startedAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8b93a3]">Started</dt>
                  <dd className="text-[#9aa3b2]">{new Date(task.startedAt).toLocaleString('tr-TR')}</dd>
                </div>
              ) : null}
              {task.completedAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8b93a3]">Completed</dt>
                  <dd className="text-[#9aa3b2]">{new Date(task.completedAt).toLocaleString('tr-TR')}</dd>
                </div>
              ) : null}
            </dl>

            {task.error ? (
              <div className="mt-4 rounded-lg border border-red-400/25 bg-red-500/[0.05] px-3 py-2">
                <p className="text-[12px] text-red-300/85">{task.error.message}</p>
              </div>
            ) : null}

            {(task.status === 'queued' || task.status === 'running') ? (
              <button
                type="button"
                onClick={cancel}
                disabled={cancelBusy}
                className="atlas-focus mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-[#e8ecf2] disabled:opacity-40"
              >
                {cancelBusy ? 'İptal ediliyor…' : 'Görevi İptal Et'}
              </button>
            ) : null}

            <p className="mt-5 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">Delegation Tree</p>
            <div className="mt-2 space-y-2">
              {subtasks.length === 0 ? <p className="text-[12px] text-[#8b93a3]">Henüz alt görev yok.</p> : null}
              {subtasks.map((s) => (
                <div key={s.id} className="rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-[#e8ecf2]">{s.label}</span>
                    <span className={`text-[12px] ${statusColor(s.status)}`}>{s.status}</span>
                  </div>
                  {s.output?.payload?.summary ? (
                    <p className="mt-1 text-[12px] text-[#9aa3b2]">{String(s.output.payload.summary)}</p>
                  ) : null}
                  {s.error ? <p className="mt-1 text-[12px] text-red-300/80">{s.error.message}</p> : null}
                  {s.model ? (
                    <p className="mt-1 text-[11px] text-[#6b7280]">
                      {s.model} · {s.tokensUsed ?? '—'} tok · {s.latencyMs ?? '—'}ms
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            {synthesis ? (
              <div className="mt-5 rounded-lg border border-[#c9b37a]/25 bg-[#c9b37a]/[0.04] px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.1em] text-[#c9b37a]/85">Final Synthesis</p>
                {synthesis.summary ? <p className="mt-1.5 text-[13px] text-[#e8ecf2]">{synthesis.summary}</p> : null}
                <SynthesisSection label="Findings" items={synthesis.findings ?? []} />
                <SynthesisSection label="Decisions" items={synthesis.decisions ?? []} />
                <SynthesisSection label="Risks" items={synthesis.risks ?? []} />
                <SynthesisSection label="Next Actions" items={synthesis.next_actions ?? []} />
              </div>
            ) : null}

            {task.status === 'waiting_for_review' ? (
              <div className="mt-5">
                <p className="text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">Approval Gate</p>
                <p className="mt-1 text-[12px] text-[#8b93a3]">
                  Onay yalnızca kararı kaydeder — Phase 1'de hiçbir onay otomatik kod değişikliği, commit, push veya deploy tetiklemez.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ApproveButton task={task} action="implementation" label="Approve implementation" onApproved={setTask} />
                  <ApproveButton task={task} action="commit" label="Approve commit" onApproved={setTask} />
                  <ApproveButton task={task} action="push" label="Approve push" onApproved={setTask} />
                  <ApproveButton task={task} action="deploy" label="Approve deploy" onApproved={setTask} />
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="animate-pulse-subtle mt-4 h-32 rounded-xl bg-white/[0.04]" />
        )}
      </div>
    </div>
  );
}

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; tasks: AgentTask[] };

export default function AdminAgentTasksPanel() {
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function refreshList() {
    try {
      const res = await fetchAgentTasks({ limit: 50 });
      setState({ status: 'ok', tasks: res.tasks });
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err, 'Görevler yüklenemedi') });
    }
  }

  useEffect(() => {
    let cancelled = false;
    refreshList();
    const interval = setInterval(() => {
      if (!cancelled) refreshList();
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <CreateTaskForm
        onCreated={(task) => {
          setState((prev) => (prev.status === 'ok' ? { status: 'ok', tasks: [task, ...prev.tasks] } : prev));
          setSelectedId(task.id);
        }}
      />

      {state.status === 'loading' ? (
        <div className="space-y-2.5" aria-busy="true" aria-live="polite">
          <div className="animate-pulse-subtle h-14 rounded-xl bg-white/[0.04]" />
          <div className="animate-pulse-subtle h-14 rounded-xl bg-white/[0.04]" style={{ animationDelay: '150ms' }} />
        </div>
      ) : null}
      {state.status === 'error' ? (
        <div className="rounded-xl border border-red-400/25 bg-red-500/[0.05] px-4 py-3">
          <p className="text-sm text-red-300/85">{state.message}</p>
        </div>
      ) : null}
      {state.status === 'ok' && state.tasks.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-8 text-center">
          <p className="text-sm text-[#8b93a3]">Henüz agent task yok.</p>
        </div>
      ) : null}

      {state.status === 'ok' && state.tasks.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">Owner</th>
                <th className="py-2 pr-4 font-medium">Mode</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {state.tasks.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className="cursor-pointer border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="max-w-[280px] truncate py-2.5 pr-4 text-[#e8ecf2]">{t.title}</td>
                  <td className="py-2.5 pr-4 text-[#9aa3b2]">{t.ownerAgent}</td>
                  <td className="py-2.5 pr-4 text-[#8b93a3]">{t.mode}</td>
                  <td className={`py-2.5 pr-4 ${statusColor(t.status)}`}>{t.status}</td>
                  <td className="py-2.5 pr-4 text-[#8b93a3]">{new Date(t.createdAt).toLocaleString('tr-TR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selectedId ? (
        <TaskDetailDrawer
          taskId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={(task) => {
            setState((prev) => (prev.status === 'ok' ? { status: 'ok', tasks: prev.tasks.map((t) => (t.id === task.id ? task : t)) } : prev));
          }}
        />
      ) : null}
    </div>
  );
}

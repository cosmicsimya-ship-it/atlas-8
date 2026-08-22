import { useEffect, useState } from 'react';

import { ApiError } from '../../services/api-client';
import {
  fetchAdminFeedbackList,
  updateAdminFeedbackNote,
  updateAdminFeedbackPriority,
  updateAdminFeedbackStatus,
  type FeedbackEntry,
} from '../../services/atlas-admin-feedback';

const STATUS_OPTIONS: FeedbackEntry['status'][] = ['new', 'reviewing', 'resolved', 'dismissed'];
const PRIORITY_OPTIONS: FeedbackEntry['priority'][] = ['low', 'normal', 'high', 'critical'];
const TYPE_OPTIONS: FeedbackEntry['type'][] = ['bug', 'suggestion', 'question', 'other'];

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  return err instanceof Error ? err.message : fallback;
}

function priorityColor(priority: FeedbackEntry['priority']) {
  if (priority === 'critical') return 'text-red-300/85';
  if (priority === 'high') return 'text-[#c9b37a]/85';
  if (priority === 'low') return 'text-[#8b93a3]';
  return 'text-[#9aa3b2]';
}

function statusColor(status: FeedbackEntry['status']) {
  if (status === 'new') return 'text-[#7fb8d8]';
  if (status === 'reviewing') return 'text-[#c9b37a]/85';
  if (status === 'resolved') return 'text-[#7fd88f]';
  return 'text-[#8b93a3]';
}

function FeedbackDetailDrawer({ entry, onClose, onUpdated }: { entry: FeedbackEntry; onClose: () => void; onUpdated: (next: FeedbackEntry) => void }) {
  const [status, setStatus] = useState(entry.status);
  const [priority, setPriority] = useState(entry.priority);
  const [note, setNote] = useState(entry.adminNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveStatus(next: FeedbackEntry['status']) {
    setBusy(true);
    setError(null);
    try {
      const res = await updateAdminFeedbackStatus(entry.id, next);
      setStatus(res.feedback.status);
      onUpdated(res.feedback);
    } catch (err) {
      setError(errorMessage(err, 'Durum güncellenemedi'));
    } finally {
      setBusy(false);
    }
  }

  async function savePriority(next: FeedbackEntry['priority']) {
    setBusy(true);
    setError(null);
    try {
      const res = await updateAdminFeedbackPriority(entry.id, next);
      setPriority(res.feedback.priority);
      onUpdated(res.feedback);
    } catch (err) {
      setError(errorMessage(err, 'Öncelik güncellenemedi'));
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    setBusy(true);
    setError(null);
    try {
      const res = await updateAdminFeedbackNote(entry.id, note);
      onUpdated(res.feedback);
    } catch (err) {
      setError(errorMessage(err, 'Not kaydedilemedi'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/60"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="h-full w-[min(100%,480px)] overflow-y-auto border-l border-white/10 bg-[#050608] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[12px] text-[#8b93a3]">{entry.id}</p>
          <button type="button" onClick={onClose} aria-label="Kapat" className="atlas-focus text-[#8b93a3] hover:text-[#e8ecf2]">
            ✕
          </button>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[#8b93a3]">Tarih</dt>
            <dd className="text-[#e8ecf2]">{new Date(entry.createdAt).toLocaleString('tr-TR')}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#8b93a3]">Kullanıcı</dt>
            <dd className="font-mono text-[12px] text-[#9aa3b2]">{entry.userId}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#8b93a3]">Tür</dt>
            <dd className="text-[#e8ecf2]">{entry.type}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#8b93a3]">Route</dt>
            <dd className="text-[#9aa3b2]">{entry.route ?? '—'}</dd>
          </div>
          {entry.conversationId ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[#8b93a3]">conversationId</dt>
              <dd className="font-mono text-[11px] text-[#8b93a3]">{entry.conversationId}</dd>
            </div>
          ) : null}
          {entry.messageId ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[#8b93a3]">messageId</dt>
              <dd className="font-mono text-[11px] text-[#8b93a3]">{entry.messageId}</dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-4 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">Mesaj</p>
        <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-white/[0.08] p-3 text-sm text-[#e8ecf2]">{entry.message}</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[12px] text-[#8b93a3]">
            Status
            <select
              value={status}
              disabled={busy}
              onChange={(e) => saveStatus(e.target.value as FeedbackEntry['status'])}
              className="atlas-field text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-[#8b93a3]">
            Priority
            <select
              value={priority}
              disabled={busy}
              onChange={(e) => savePriority(e.target.value as FeedbackEntry['priority'])}
              className="atlas-field text-sm"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-5 flex flex-col gap-1 text-[12px] text-[#8b93a3]">
          Admin Note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={4}
            className="atlas-field text-sm"
            placeholder="İç not (kullanıcıya gösterilmez)"
          />
        </label>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={saveNote}
            disabled={busy}
            className="atlas-focus rounded-md border border-[#c9b37a]/35 bg-[#c9b37a]/10 px-3 py-1.5 text-sm text-[#e8ecf2] disabled:opacity-40"
          >
            {busy ? 'Kaydediliyor…' : 'Notu Kaydet'}
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-300/80">{error}</p> : null}
      </div>
    </div>
  );
}

export default function AdminFeedbackPanel() {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [type, setType] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<FeedbackEntry | null>(null);
  const limit = 25;

  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; entries: FeedbackEntry[]; total: number }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchAdminFeedbackList({ status, priority, type, limit, offset })
      .then((res) => {
        if (!cancelled) setState({ status: 'ok', entries: res.entries, total: res.total });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(err, 'Yüklenemedi') });
      });
    return () => {
      cancelled = true;
    };
  }, [status, priority, type, offset]);

  function patchLocal(next: FeedbackEntry) {
    setState((prev) => (prev.status === 'ok' ? { ...prev, entries: prev.entries.map((e) => (e.id === next.id ? next : e)) } : prev));
    setSelected(next);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
          className="atlas-field text-sm"
          aria-label="Statüye göre filtrele"
        >
          <option value="">Tüm statüler</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            setOffset(0);
          }}
          className="atlas-field text-sm"
          aria-label="Önceliğe göre filtrele"
        >
          <option value="">Tüm öncelikler</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setOffset(0);
          }}
          className="atlas-field text-sm"
          aria-label="Türe göre filtrele"
        >
          <option value="">Tüm türler</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {state.status === 'loading' ? <p className="text-sm text-[#8b93a3]">Yükleniyor…</p> : null}
      {state.status === 'error' ? <p className="text-sm text-red-300/80">{state.message}</p> : null}
      {state.status === 'ok' && state.entries.length === 0 ? <p className="text-sm text-[#8b93a3]">Geri bildirim yok.</p> : null}

      {state.status === 'ok' && state.entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">
                <th className="py-2 pr-4 font-medium">Tarih</th>
                <th className="py-2 pr-4 font-medium">Kullanıcı</th>
                <th className="py-2 pr-4 font-medium">Tür</th>
                <th className="py-2 pr-4 font-medium">Mesaj</th>
                <th className="py-2 pr-4 font-medium">Route</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody>
              {state.entries.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className="cursor-pointer border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="py-2.5 pr-4 text-[#9aa3b2]">{new Date(e.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td className="py-2.5 pr-4 font-mono text-[11px] text-[#8b93a3]">{e.userId}</td>
                  <td className="py-2.5 pr-4 text-[#e8ecf2]">{e.type}</td>
                  <td className="max-w-[280px] truncate py-2.5 pr-4 text-[#9aa3b2]">{e.message}</td>
                  <td className="py-2.5 pr-4 text-[#8b93a3]">{e.route ?? '—'}</td>
                  <td className={`py-2.5 pr-4 ${statusColor(e.status)}`}>{e.status}</td>
                  <td className={`py-2.5 pr-4 ${priorityColor(e.priority)}`}>{e.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center gap-3 text-[12px] text-[#8b93a3]">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="atlas-focus rounded border border-white/10 px-2.5 py-1 disabled:opacity-40"
            >
              Önceki
            </button>
            <span>
              {offset + 1}–{Math.min(offset + limit, state.total)} / {state.total}
            </span>
            <button
              type="button"
              disabled={offset + limit >= state.total}
              onClick={() => setOffset(offset + limit)}
              className="atlas-focus rounded border border-white/10 px-2.5 py-1 disabled:opacity-40"
            >
              Sonraki
            </button>
          </div>
        </div>
      ) : null}

      {selected ? <FeedbackDetailDrawer entry={selected} onClose={() => setSelected(null)} onUpdated={patchLocal} /> : null}
    </div>
  );
}

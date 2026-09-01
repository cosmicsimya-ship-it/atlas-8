import { useEffect, useState } from 'react';

import { ApiError } from '../../services/api-client';
import {
  fetchAdminErrorsList,
  updateAdminErrorStatus,
  type ErrorEntry,
} from '../../services/atlas-admin-errors';

const STATUS_OPTIONS: ErrorEntry['status'][] = ['open', 'investigating', 'resolved', 'ignored'];
const SEVERITY_OPTIONS: ErrorEntry['severity'][] = ['info', 'warning', 'error', 'critical'];

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  return err instanceof Error ? err.message : fallback;
}

function severityColor(severity: ErrorEntry['severity']) {
  if (severity === 'critical') return 'text-red-300/85';
  if (severity === 'error') return 'text-red-300/70';
  if (severity === 'warning') return 'text-[#c9b37a]/85';
  return 'text-[#8b93a3]';
}

function statusColor(status: ErrorEntry['status']) {
  if (status === 'open') return 'text-red-300/80';
  if (status === 'investigating') return 'text-[#c9b37a]/85';
  if (status === 'resolved') return 'text-[#7fd88f]';
  return 'text-[#8b93a3]';
}

function ErrorDetailDrawer({ entry, onClose, onUpdated }: { entry: ErrorEntry; onClose: () => void; onUpdated: (next: ErrorEntry) => void }) {
  const [status, setStatus] = useState(entry.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveStatus(next: ErrorEntry['status']) {
    setBusy(true);
    setError(null);
    try {
      const res = await updateAdminErrorStatus(entry.id, next);
      setStatus(res.error.status);
      onUpdated(res.error);
    } catch (err) {
      setError(errorMessage(err, 'Durum güncellenemedi'));
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
            <dt className="text-[#8b93a3]">Kaynak</dt>
            <dd className="text-[#e8ecf2]">{entry.source}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#8b93a3]">Severity</dt>
            <dd className={severityColor(entry.severity)}>{entry.severity}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#8b93a3]">Code</dt>
            <dd className="font-mono text-[12px] text-[#9aa3b2]">{entry.code}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#8b93a3]">Route</dt>
            <dd className="text-[#9aa3b2]">{entry.route ?? '—'}</dd>
          </div>
          {entry.userId ? (
            <div className="flex justify-between gap-3">
              <dt className="text-[#8b93a3]">userId</dt>
              <dd className="font-mono text-[11px] text-[#8b93a3]">{entry.userId}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-[#8b93a3]">Occurrences</dt>
            <dd className="text-[#e8ecf2]">{entry.occurrenceCount}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#8b93a3]">First seen</dt>
            <dd className="text-[#9aa3b2]">{new Date(entry.firstSeen).toLocaleString('tr-TR')}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#8b93a3]">Last seen</dt>
            <dd className="text-[#9aa3b2]">{new Date(entry.lastSeen).toLocaleString('tr-TR')}</dd>
          </div>
        </dl>

        <p className="mt-4 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">Mesaj (redakte edilmiş)</p>
        <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-white/[0.08] p-3 text-sm text-[#e8ecf2]">{entry.safeMessage}</p>

        <label className="mt-5 flex flex-col gap-1 text-[12px] text-[#8b93a3]">
          Status
          <select
            value={status}
            disabled={busy}
            onChange={(e) => saveStatus(e.target.value as ErrorEntry['status'])}
            className="atlas-field text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {error ? <p className="mt-3 text-sm text-red-300/80">{error}</p> : null}
      </div>
    </div>
  );
}

export default function AdminErrorsPanel() {
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<ErrorEntry | null>(null);
  const limit = 25;

  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; entries: ErrorEntry[]; total: number }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchAdminErrorsList({ status, severity, limit, offset })
      .then((res) => {
        if (!cancelled) setState({ status: 'ok', entries: res.entries, total: res.total });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(err, 'Yüklenemedi') });
      });
    return () => {
      cancelled = true;
    };
  }, [status, severity, offset]);

  function patchLocal(next: ErrorEntry) {
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
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setOffset(0);
          }}
          className="atlas-field text-sm"
          aria-label="Ciddiyete göre filtrele"
        >
          <option value="">Tüm seviyeler</option>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {state.status === 'loading' ? (
        <div className="space-y-2.5" aria-busy="true" aria-live="polite">
          <div className="animate-pulse-subtle h-4 w-1/3 rounded-full bg-white/[0.06]" />
          <div className="animate-pulse-subtle h-14 rounded-xl bg-white/[0.04]" />
          <div className="animate-pulse-subtle h-14 rounded-xl bg-white/[0.04]" style={{ animationDelay: '150ms' }} />
        </div>
      ) : null}
      {state.status === 'error' ? (
        <div className="rounded-xl border border-red-400/25 bg-red-500/[0.05] px-4 py-3">
          <p className="text-sm text-red-300/85">{state.message}</p>
        </div>
      ) : null}
      {state.status === 'ok' && state.entries.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-8 text-center">
          <p className="text-sm text-[#8b93a3]">Kayıtlı hata/olay yok.</p>
        </div>
      ) : null}

      {state.status === 'ok' && state.entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">
                <th className="py-2 pr-4 font-medium">Last Seen</th>
                <th className="py-2 pr-4 font-medium">Severity</th>
                <th className="py-2 pr-4 font-medium">Code</th>
                <th className="py-2 pr-4 font-medium">Message</th>
                <th className="py-2 pr-4 font-medium">Route</th>
                <th className="py-2 pr-4 font-medium">Count</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {state.entries.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className="cursor-pointer border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="py-2.5 pr-4 text-[#9aa3b2]">{new Date(e.lastSeen).toLocaleString('tr-TR')}</td>
                  <td className={`py-2.5 pr-4 ${severityColor(e.severity)}`}>{e.severity}</td>
                  <td className="py-2.5 pr-4 font-mono text-[11px] text-[#9aa3b2]">{e.code}</td>
                  <td className="max-w-[280px] truncate py-2.5 pr-4 text-[#9aa3b2]">{e.safeMessage}</td>
                  <td className="py-2.5 pr-4 text-[#8b93a3]">{e.route ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-[#e8ecf2]">{e.occurrenceCount}</td>
                  <td className={`py-2.5 pr-4 ${statusColor(e.status)}`}>{e.status}</td>
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

      {selected ? <ErrorDetailDrawer entry={selected} onClose={() => setSelected(null)} onUpdated={patchLocal} /> : null}
    </div>
  );
}

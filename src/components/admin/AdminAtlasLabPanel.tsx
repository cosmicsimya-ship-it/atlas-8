import { useEffect, useState } from 'react';

import { fetchAtlasLabTraces, type AtlasLabTrace } from '../../services/atlas-lab';

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR');
  } catch {
    return iso;
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-white/[0.06] py-2">
      <p className="text-[10.5px] uppercase tracking-[0.1em] text-[#8b93a3]">{label}</p>
      <p className="mt-0.5 break-words text-[13px] text-[#e8ecf2]">
        {value === null || value === undefined || value === '' ? <span className="text-[#8b93a3]">—</span> : value}
      </p>
    </div>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  return <Field label={label} value={items && items.length > 0 ? items.join(', ') : null} />;
}

function TraceDetailPanel({ trace, onClose }: { trace: AtlasLabTrace; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/60"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="h-full w-[min(100%,560px)] overflow-y-auto border-l border-white/10 bg-[#050608] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[12px] text-[#8b93a3]">{trace.requestId}</p>
          <button type="button" onClick={onClose} aria-label="Kapat" className="atlas-focus text-[#8b93a3] hover:text-[#e8ecf2]">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4">
          <Field label="Timestamp" value={fmtTime(trace.timestamp)} />
          <Field label="Channel" value={trace.channel} />
          <Field label="Conversation / Session" value={trace.conversationRef} />
          <Field label="Context Count" value={trace.contextMessageCount} />
          <Field label="Detected Intent" value={trace.intent} />
          <Field label="Selected Domain" value={trace.selectedDomain} />
          <Field label="Routing Decision" value={trace.routingDecision} />
          <Field label="Deterministic Engine" value={trace.engine} />
          <Field label="Model" value={trace.modelUsed ?? trace.requestedModel} />
          <Field label="Latency" value={`${trace.totalDurationMs}ms`} />
          <Field label="LLM Calls" value={trace.llmCallCount} />
          <Field label="Error / Fallback" value={trace.errorState ?? trace.fallbackPath} />
        </div>

        <ListField label="Selected Tool(s)" items={trace.selectedTools} />
        <ListField label="Retrieval Sources" items={trace.retrievalSources} />
        <ListField label="Verifier / Post-Processor Results" items={trace.postProcessors} />

        <Field label="User Message (bounded summary)" value={trace.userMessageSummary} />
        <Field label="Final Response (bounded summary)" value={trace.responseSummary} />

        <div className="mt-4">
          <p className="mb-1.5 text-[10.5px] uppercase tracking-[0.1em] text-[#8b93a3]">Phase Timings</p>
          {trace.phases.length === 0 ? (
            <p className="text-[13px] text-[#8b93a3]">—</p>
          ) : (
            <ul className="space-y-1 text-[12px]">
              {trace.phases.map((p, i) => (
                <li key={`${p.name}-${i}`} className="flex justify-between border-b border-white/[0.04] py-1">
                  <span className="text-[#9aa3b2]">{p.name}</span>
                  <span className="text-[#e8ecf2]">{p.durationMs}ms</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminAtlasLabPanel() {
  const [channel, setChannel] = useState<'' | 'web' | 'telegram'>('');
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; traces: AtlasLabTrace[] }>({
    status: 'loading',
  });
  const [selected, setSelected] = useState<AtlasLabTrace | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchAtlasLabTraces({ channel: channel || undefined, limit: 100 })
      .then((res) => {
        if (!cancelled) setState({ status: 'ok', traces: res.traces });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : 'Yüklenemedi' });
      });
    return () => {
      cancelled = true;
    };
  }, [channel, refreshKey]);

  return (
    <div>
      <p className="mb-4 text-[11px] text-[#8b93a3]">
        ATLAS LAB — son işlenen isteklerin izlenebilirlik kaydı (sadece okunur, gözlemsel). Yanıt üretimini etkilemez; hiçbir model
        muhakemesi (chain-of-thought) tutulmaz.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as '' | 'web' | 'telegram')}
          className="atlas-field text-sm"
          aria-label="Kanala göre filtrele"
        >
          <option value="">Tüm kanallar</option>
          <option value="web">Web</option>
          <option value="telegram">Telegram</option>
        </select>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="atlas-focus rounded border border-white/10 px-2.5 py-1 text-[12px] text-[#9aa3b2] hover:bg-white/[0.04]"
        >
          Yenile
        </button>
      </div>

      {state.status === 'loading' ? (
        <div className="space-y-2.5" aria-busy="true" aria-live="polite">
          <div className="animate-pulse-subtle h-4 w-1/3 rounded-full bg-white/[0.06]" />
          <div className="animate-pulse-subtle h-14 rounded-xl bg-white/[0.04]" />
        </div>
      ) : null}
      {state.status === 'error' ? (
        <div className="rounded-xl border border-red-400/25 bg-red-500/[0.05] px-4 py-3">
          <p className="text-sm text-red-300/85">{state.message}</p>
        </div>
      ) : null}
      {state.status === 'ok' && state.traces.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-8 text-center">
          <p className="text-sm text-[#8b93a3]">Henüz iz kaydı yok.</p>
        </div>
      ) : null}
      {state.status === 'ok' && state.traces.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">
                <th className="py-2 pr-4 font-medium">Zaman</th>
                <th className="py-2 pr-4 font-medium">Kanal</th>
                <th className="py-2 pr-4 font-medium">Konuşma</th>
                <th className="py-2 pr-4 font-medium">Niyet / Motor</th>
                <th className="py-2 pr-4 font-medium">Bağlam</th>
                <th className="py-2 pr-4 font-medium">Gecikme</th>
                <th className="py-2 pr-4 font-medium">Hata / Fallback</th>
              </tr>
            </thead>
            <tbody>
              {state.traces.map((t) => (
                <tr
                  key={t.requestId}
                  onClick={() => setSelected(t)}
                  className="cursor-pointer border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="py-2.5 pr-4 text-[#9aa3b2]">{fmtTime(t.timestamp)}</td>
                  <td className="py-2.5 pr-4 text-[#e8ecf2]">{t.channel ?? '—'}</td>
                  <td className="py-2.5 pr-4 font-mono text-[11px] text-[#8b93a3]">{t.conversationRef ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-[#9aa3b2]">{t.intent ?? '—'} / {t.engine ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-[#9aa3b2]">{t.contextMessageCount ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-[#9aa3b2]">{t.totalDurationMs}ms</td>
                  <td className="py-2.5 pr-4 text-[#9aa3b2]">
                    {t.errorState ? <span className="text-red-300/80">{t.errorState}</span> : t.fallbackPath ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? <TraceDetailPanel trace={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../services/api-client';
import { fetchAgentOsSummary, runAgentOsSweep, type AgentOsSummary } from '../../services/atlas-admin-agentos';

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  return err instanceof Error ? err.message : fallback;
}

function Metric({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="atlas-glass-card flex flex-col gap-1.5 p-4">
      <p className="text-[10.5px] uppercase tracking-[0.1em] text-[#8b93a3]">{label}</p>
      <p className="font-display text-[26px] leading-none text-[#eef1f5] sm:text-[28px]">{value === null ? '—' : value}</p>
      {value === null ? <p className="text-[11px] text-[#8b93a3]">Not yet tracked</p> : null}
    </div>
  );
}

function healthColor(state: string) {
  if (state === 'idle') return 'text-[#7dd3fc]';
  if (state === 'running') return 'text-[#c9b37a]';
  if (state === 'failed') return 'text-red-300/80';
  return 'text-[#8b93a3]'; // disabled / unavailable
}

function relTime(iso: string | null) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return 'az önce';
  if (m < 60) return `${m}dk önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}sa önce`;
  return `${Math.round(h / 24)}g önce`;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'unreachable'; reason: string }
  | { status: 'ok'; data: AgentOsSummary };

export default function AdminAgentOsPanel() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [sweepBusy, setSweepBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchAgentOsSummary();
      if (!res.reachable) {
        setState({ status: 'unreachable', reason: res.reason });
        return;
      }
      setState({ status: 'ok', data: res.summary });
      return res.summary;
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err, 'AgentOS verisi yüklenemedi') });
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    load().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const summary = await load();
      if (summary && summary.sweep.status !== 'running') {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setSweepBusy(false);
      }
    }, 3000);
  }

  async function handleRunSweep() {
    setSweepBusy(true);
    try {
      const res = await runAgentOsSweep();
      if (!res.reachable) {
        setState({ status: 'unreachable', reason: res.reason });
        setSweepBusy(false);
        return;
      }
      // started:false here means AgentOS's OWN duplicate-sweep guard refused
      // (a sweep is already running) - not an error, just already in flight.
      startPolling();
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err, 'Full sweep başlatılamadı') });
      setSweepBusy(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="space-y-2.5" aria-busy="true" aria-live="polite">
        <div className="animate-pulse-subtle h-4 w-1/3 rounded-full bg-white/[0.06]" />
        <div className="animate-pulse-subtle h-14 rounded-xl bg-white/[0.04]" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-xl border border-red-400/25 bg-red-500/[0.05] px-4 py-3">
        <p className="text-sm text-red-300/85">{state.message}</p>
      </div>
    );
  }

  if (state.status === 'unreachable') {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-8 text-center">
        <p className="text-sm text-[#e8ecf2]">AgentOS şu anda bağlı değil.</p>
        <p className="mt-1 text-sm text-[#e8ecf2]">Son doğrulanmış operasyon verileri gösterilemiyor.</p>
        <p className="mt-3 text-[12px] text-[#8b93a3]">{state.reason}</p>
        <p className="mt-3 text-[11px] text-[#8b93a3]">
          Başlatmak için ATLAS-AgentOS içinde <code className="rounded bg-white/[0.06] px-1.5 py-0.5">npm run agentos</code> çalıştırın.
        </p>
      </div>
    );
  }

  const { data } = state;
  const isSweepRunning = data.sweep.status === 'running' || sweepBusy;
  const topAction = data.humanRecommendations[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#7fd88f]/30 bg-[#7fd88f]/[0.08] px-2.5 py-1 text-[10.5px] uppercase tracking-[0.08em] text-[#7fd88f]">
            AgentOS operational
          </span>
          <span className="rounded-full border border-red-400/25 bg-red-500/[0.06] px-2.5 py-1 text-[10.5px] uppercase tracking-[0.08em] text-red-300/85">
            read-only bridge
          </span>
          <span className="text-[11px] text-[#8b93a3]">
            Son sweep: {relTime(data.lastFullSweep?.generatedAt ?? null)} · Veri tazeliği: {relTime(data.dataFreshness)}
          </span>
        </div>
        <button
          type="button"
          onClick={handleRunSweep}
          disabled={isSweepRunning}
          className="atlas-focus rounded-lg bg-[#eef1f5] px-3.5 py-2 text-[12.5px] font-semibold text-[#07080a] disabled:opacity-45"
        >
          {isSweepRunning ? `Sweep çalışıyor${data.sweep.phase ? ` · ${data.sweep.phase}` : ''}…` : 'Run Full Sweep'}
        </button>
      </div>

      {/* Main */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Overall Completion" value={data.overall.overall_pct === null ? null : `${data.overall.overall_pct}%`} />
        <Metric label="Confidence" value={data.overall.overall_confidence} />
        <Metric label="QA" value={data.qa ? `${data.qa.pass}/${data.qa.pass + data.qa.fail}` : null} />
        <Metric label="Critical Blockers" value={data.blockers.length} />
        <Metric label="Operational Agents" value={`${data.agentSummary.operational}/${data.agentSummary.total}`} />
        <Metric label="Currently Running" value={data.agentSummary.running} />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[12px] uppercase tracking-[0.1em] text-[#8b93a3]">Recommended Next Action</p>
        {!topAction ? (
          <p className="text-sm text-[#8b93a3]">Henüz bir full sweep çalışmadı.</p>
        ) : (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
            <p className="text-sm font-medium text-[#e8ecf2]">{topAction.title}</p>
            <p className="mt-1 text-sm text-[#9aa3b2]">{topAction.explanation}</p>
            <p className="mt-2 text-[11px] text-[#8b93a3]">
              domain: {topAction.domain} · önem: {topAction.severity} · güven: {topAction.confidence} · {topAction.evidenceSource}
            </p>
            {topAction.technicalDetails.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-[#8b93a3]">Teknik detay ({topAction.technicalDetails.length})</summary>
                <pre className="mt-1.5 whitespace-pre-wrap text-[10.5px] text-[#8b93a3]">
                  {topAction.technicalDetails.map((d) => d.text).join('\n')}
                </pre>
              </details>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[12px] uppercase tracking-[0.1em] text-[#8b93a3]">Operasyonel Ajanlar</p>
        <ul className="space-y-1.5 text-sm">
          {data.agents.map((a) => (
            <li key={a.agent_id} className="flex items-center justify-between gap-2 border-b border-white/[0.06] py-1.5">
              <span className="text-[#9aa3b2]">{a.name}</span>
              <span className={`text-[11px] capitalize ${healthColor(a.state)}`}>{a.state}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Secondary */}
      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        <div>
          <p className="mb-2 text-[12px] uppercase tracking-[0.1em] text-[#8b93a3]">Feedback</p>
          {data.feedback && data.feedback.rawCount > 0 ? (
            <p className="text-sm text-[#9aa3b2]">
              {data.feedback.rawCount} kayıt, {data.feedback.themeCount} tema
            </p>
          ) : (
            <p className="text-sm text-[#8b93a3]">Kayıt yok (doğrulanmış — boş).</p>
          )}
        </div>
        <div>
          <p className="mb-2 text-[12px] uppercase tracking-[0.1em] text-[#8b93a3]">Errors</p>
          {data.errors && data.errors.count > 0 ? (
            <p className="text-sm text-[#9aa3b2]">{data.errors.count} açık hata</p>
          ) : (
            <p className="text-sm text-[#8b93a3]">Hata yok (doğrulanmış — boş).</p>
          )}
        </div>
        <div>
          <p className="mb-2 text-[12px] uppercase tracking-[0.1em] text-[#8b93a3]">Report History</p>
          <p className="text-sm text-[#9aa3b2]">
            {data.reportHistory.count} rapor{data.reportHistory.latestFilename ? ` · son: ${data.reportHistory.latestFilename}` : ''}
          </p>
        </div>
      </div>

      {data.blockers.length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-[12px] uppercase tracking-[0.1em] text-[#8b93a3]">Kritik Engeller</p>
          <ul className="space-y-1.5 text-sm">
            {data.blockers.map((b, i) => (
              <li key={i} className="border-b border-white/[0.06] py-1.5 text-[#9aa3b2]">
                {b}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

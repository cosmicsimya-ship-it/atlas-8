import { useEffect, useState } from 'react';

import { apiRequest } from '../../services/api-client';
import AdminUserActions from './AdminUserActions';
import AdminFeedbackPanel from './AdminFeedbackPanel';
import AdminErrorsPanel from './AdminErrorsPanel';
import AdminAtlasLabPanel from './AdminAtlasLabPanel';

type Tab = 'overview' | 'feedback' | 'errors' | 'atlas-lab' | 'users' | 'prime' | 'usage' | 'costs' | 'health' | 'audit';

type AdminUserRow = {
  userId: string;
  username: string | null;
  email: string | null;
  roles: string[];
  plan: string;
  subscriptionStatus: string;
  usageToday: { dailyUsed: number; dailyLimit: number };
  createdAt: string | null;
  lastActive: string | null;
};

type OverviewFeedbackRow = { id: string; createdAt: string; type: string; message: string; status: string; priority: string };
type OverviewErrorRow = { id: string; lastSeen: string; severity: string; code: string; safeMessage: string; occurrenceCount: number; status: string };

type Overview = {
  totalUsers: number;
  primeUsers: number;
  freeUsers: number;
  activeToday: number | null;
  chatUsageToday: number;
  usersActiveInChatToday: number;
  estimatedAiCost: number | null;
  primeProfilesCompleted?: number;
  checkInsToday?: number;
  outlookGenerationCount?: number;
  backendStatus?: string;
  openFeedbackCount?: number | null;
  recentFeedback?: OverviewFeedbackRow[];
  openErrorCount?: number | null;
  recentErrors?: OverviewErrorRow[];
};

type UsageResponse = {
  totalRequestsToday: number;
  usersActiveToday: number;
  nearLimitThreshold: number;
  users: Array<{ userId: string; plan: string; dailyUsed: number; dailyLimit: number; nearLimit: boolean; atLimit: boolean }>;
};

type CostsResponse = {
  authoritative: boolean;
  message: string;
  todayEstimatedCost: number | null;
};

type HealthResponse = {
  overallStatus: string;
  services: Array<{ service: string; status: string; detail?: string }>;
  checkedAt: string;
};

type AuditEvent = { eventId: string; timestamp: string; actor: string; action: string; targetUserId: string | null; result: string };

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'errors', label: 'Errors' },
  { id: 'atlas-lab', label: 'ATLAS LAB' },
  { id: 'users', label: 'Users' },
  { id: 'prime', label: 'Prime' },
  { id: 'health', label: 'System Health' },
  { id: 'usage', label: 'Usage' },
  { id: 'costs', label: 'Costs' },
  { id: 'audit', label: 'Audit' },
];

function Metric({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-white/[0.08] p-4">
      <p className="text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">{label}</p>
      <p className="mt-1.5 text-2xl text-[#e8ecf2]">{value === null ? '—' : value}</p>
      {value === null ? <p className="mt-1 text-[11px] text-[#8b93a3]">Not yet tracked</p> : null}
    </div>
  );
}

function useAdminFetch<T>(path: string, deps: unknown[] = []) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; data: T }>({
    status: 'loading',
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    apiRequest<T>(path, { method: 'GET' })
      .then((data) => {
        if (!cancelled) setState({ status: 'ok', data });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : 'Yüklenemedi' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

function StateWrapper({ state, empty, children }: { state: { status: string; message?: string }; empty?: boolean; children: React.ReactNode }) {
  if (state.status === 'loading') return <p className="text-sm text-[#8b93a3]">Yükleniyor…</p>;
  if (state.status === 'error') return <p className="text-sm text-red-300/80">{state.message}</p>;
  if (empty) return <p className="text-sm text-[#8b93a3]">Veri yok.</p>;
  return <>{children}</>;
}

function OverviewTab() {
  const state = useAdminFetch<{ ok: boolean; overview: Overview }>('/api/admin/overview');
  return (
    <StateWrapper state={state}>
      {state.status === 'ok' ? (
        <div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Backend Health" value={state.data.overview.backendStatus ?? 'unknown'} />
            <Metric label="Total Users" value={state.data.overview.totalUsers} />
            <Metric label="Prime Users" value={state.data.overview.primeUsers} />
            <Metric label="Free Users" value={state.data.overview.freeUsers} />
            <Metric label="Open Feedback" value={state.data.overview.openFeedbackCount ?? null} />
            <Metric label="Open Errors / Incidents" value={state.data.overview.openErrorCount ?? null} />
            <Metric label="Active Today" value={state.data.overview.activeToday} />
            <Metric label="Chat Usage Today" value={state.data.overview.chatUsageToday} />
            <Metric label="Prime Chat Users Today" value={state.data.overview.usersActiveInChatToday} />
            <Metric label="Prime Profiles Completed" value={state.data.overview.primeProfilesCompleted ?? 0} />
            <Metric label="Check-ins Today" value={state.data.overview.checkInsToday ?? 0} />
            <Metric label="Outlook Generations" value={state.data.overview.outlookGenerationCount ?? 0} />
            <Metric label="Estimated AI Cost" value={state.data.overview.estimatedAiCost} />
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[12px] uppercase tracking-[0.1em] text-[#8b93a3]">Son Geri Bildirimler</p>
              {!state.data.overview.recentFeedback || state.data.overview.recentFeedback.length === 0 ? (
                <p className="text-sm text-[#8b93a3]">Yok.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {state.data.overview.recentFeedback.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2 border-b border-white/[0.06] py-1.5">
                      <span className="truncate text-[#9aa3b2]">{f.type}: {f.message}</span>
                      <span className="shrink-0 text-[11px] text-[#8b93a3]">{f.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-[12px] uppercase tracking-[0.1em] text-[#8b93a3]">Son Hatalar / Olaylar</p>
              {!state.data.overview.recentErrors || state.data.overview.recentErrors.length === 0 ? (
                <p className="text-sm text-[#8b93a3]">Yok.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {state.data.overview.recentErrors.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 border-b border-white/[0.06] py-1.5">
                      <span className="truncate text-[#9aa3b2]">{e.code}: {e.safeMessage}</span>
                      <span className="shrink-0 text-[11px] text-[#8b93a3]">{e.status} ×{e.occurrenceCount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </StateWrapper>
  );
}

function UsersTable({ rows, onSelect }: { rows: AdminUserRow[]; onSelect: (userId: string) => void }) {
  if (rows.length === 0) return <p className="text-sm text-[#8b93a3]">Kullanıcı bulunamadı.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">
            <th className="py-2 pr-4 font-medium">User</th>
            <th className="py-2 pr-4 font-medium">Plan</th>
            <th className="py-2 pr-4 font-medium">Subscription</th>
            <th className="py-2 pr-4 font-medium">Usage</th>
            <th className="py-2 pr-4 font-medium">Created</th>
            <th className="py-2 pr-4 font-medium">Last Active</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr
              key={u.userId}
              onClick={() => onSelect(u.userId)}
              className="cursor-pointer border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
            >
              <td className="py-2.5 pr-4">
                <div className="text-[#e8ecf2]">{u.username ?? '—'}</div>
                <div className="font-mono text-[11px] text-[#8b93a3]">{u.userId}</div>
              </td>
              <td className="py-2.5 pr-4 text-[#e8ecf2]">{u.plan}</td>
              <td className="py-2.5 pr-4 text-[#9aa3b2]">{u.subscriptionStatus}</td>
              <td className="py-2.5 pr-4 text-[#9aa3b2]">{u.usageToday.dailyUsed} / {u.usageToday.dailyLimit}</td>
              <td className="py-2.5 pr-4 text-[#9aa3b2]">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('tr-TR') : '—'}</td>
              <td className="py-2.5 pr-4 text-[#8b93a3]">{u.lastActive ?? 'Not yet tracked'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserDetailPanel({ userId, actorUserId, onClose }: { userId: string; actorUserId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60" role="presentation" onMouseDown={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="h-full w-[min(100%,480px)] overflow-y-auto border-l border-white/10 bg-[#050608] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[12px] text-[#8b93a3]">{userId}</p>
          <button type="button" onClick={onClose} aria-label="Kapat" className="atlas-focus text-[#8b93a3] hover:text-[#e8ecf2]">
            ✕
          </button>
        </div>
        <p className="mt-2 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">Actions</p>
        <AdminUserActions userId={userId} actorUserId={actorUserId} />
      </div>
    </div>
  );
}

function UsersTab({ actorUserId }: { actorUserId: string }) {
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const limit = 25;
  const qs = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(plan ? { plan } : {}),
    ...(status ? { subscriptionStatus: status } : {}),
    limit: String(limit),
    offset: String(offset),
  }).toString();
  const state = useAdminFetch<{ ok: boolean; users: AdminUserRow[]; total: number }>(`/api/admin/users?${qs}`, [qs]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          placeholder="Ara: email, kullanıcı adı, id"
          maxLength={200}
          className="atlas-field max-w-xs text-sm"
          aria-label="Kullanıcı ara"
        />
        <select
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
            setOffset(0);
          }}
          className="atlas-field text-sm"
          aria-label="Plana göre filtrele"
        >
          <option value="">Tüm planlar</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
          className="atlas-field text-sm"
          aria-label="Aboneliğe göre filtrele"
        >
          <option value="">Tüm durumlar</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="expired">Expired</option>
        </select>
      </div>
      <StateWrapper state={state}>
        {state.status === 'ok' ? (
          <>
            <UsersTable rows={state.data.users} onSelect={setSelectedUserId} />
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
                {offset + 1}–{Math.min(offset + limit, state.data.total)} / {state.data.total}
              </span>
              <button
                type="button"
                disabled={offset + limit >= state.data.total}
                onClick={() => setOffset(offset + limit)}
                className="atlas-focus rounded border border-white/10 px-2.5 py-1 disabled:opacity-40"
              >
                Sonraki
              </button>
            </div>
          </>
        ) : null}
      </StateWrapper>
      {selectedUserId ? (
        <UserDetailPanel userId={selectedUserId} actorUserId={actorUserId} onClose={() => setSelectedUserId(null)} />
      ) : null}
    </div>
  );
}

function PrimeTab({ actorUserId }: { actorUserId: string }) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const state = useAdminFetch<{ ok: boolean; users: AdminUserRow[]; total: number }>('/api/admin/prime');
  return (
    <div>
      <StateWrapper state={state}>
        {state.status === 'ok' ? <UsersTable rows={state.data.users} onSelect={setSelectedUserId} /> : null}
      </StateWrapper>
      {selectedUserId ? (
        <UserDetailPanel userId={selectedUserId} actorUserId={actorUserId} onClose={() => setSelectedUserId(null)} />
      ) : null}
    </div>
  );
}

function UsageTab() {
  const state = useAdminFetch<{ ok: boolean; usage: UsageResponse }>('/api/admin/usage');
  return (
    <StateWrapper state={state}>
      {state.status === 'ok' ? (
        <div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Total Requests Today" value={state.data.usage.totalRequestsToday} />
            <Metric label="Users Active Today" value={state.data.usage.usersActiveToday} />
            <Metric label="Near-Limit Threshold" value={`${Math.round(state.data.usage.nearLimitThreshold * 100)}%`} />
          </div>
          <div className="mt-5">
            <p className="mb-2 text-[12px] uppercase tracking-[0.1em] text-[#8b93a3]">Users near or at their daily limit</p>
            {state.data.usage.users.filter((u) => u.nearLimit || u.atLimit).length === 0 ? (
              <p className="text-sm text-[#8b93a3]">Kimse limite yaklaşmadı.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {state.data.usage.users
                  .filter((u) => u.nearLimit || u.atLimit)
                  .map((u) => (
                    <li key={u.userId} className="flex justify-between border-b border-white/[0.06] py-1.5">
                      <span className="font-mono text-[12px] text-[#9aa3b2]">{u.userId}</span>
                      <span className={u.atLimit ? 'text-red-300/80' : 'text-[#c9b37a]/85'}>
                        {u.dailyUsed} / {u.dailyLimit} {u.atLimit ? '(at limit)' : '(near limit)'}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </StateWrapper>
  );
}

function CostsTab() {
  const state = useAdminFetch<{ ok: boolean; costs: CostsResponse }>('/api/admin/costs');
  return (
    <StateWrapper state={state}>
      {state.status === 'ok' ? (
        <div>
          <p className="text-sm text-[#e8ecf2]">
            {state.data.costs.authoritative ? 'Maliyet verisi mevcut.' : 'USAGE AVAILABLE — COST ESTIMATION NOT YET AUTHORITATIVE'}
          </p>
          <p className="mt-2 text-[13px] text-[#8b93a3]">{state.data.costs.message}</p>
        </div>
      ) : null}
    </StateWrapper>
  );
}

function HealthTab() {
  const state = useAdminFetch<{ ok: boolean; health: HealthResponse }>('/api/admin/health');
  const color = (status: string) =>
    status === 'healthy' ? 'text-[#7fd88f]' : status === 'degraded' ? 'text-[#c9b37a]' : status === 'unavailable' ? 'text-red-300/85' : 'text-[#8b93a3]';
  return (
    <StateWrapper state={state}>
      {state.status === 'ok' ? (
        <div>
          <p className="mb-4 text-sm">
            Overall: <span className={color(state.data.health.overallStatus)}>{state.data.health.overallStatus}</span>
          </p>
          <ul className="space-y-2">
            {state.data.health.services.map((s) => (
              <li key={s.service} className="flex flex-col gap-0.5 border-b border-white/[0.06] py-2 text-sm sm:flex-row sm:justify-between">
                <span className="text-[#e8ecf2]/85">{s.service}</span>
                <span className={color(s.status)}>
                  {s.status}
                  {s.detail ? <span className="ml-2 text-[12px] text-[#8b93a3]">{s.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </StateWrapper>
  );
}

function AuditTab() {
  const state = useAdminFetch<{ ok: boolean; events: AuditEvent[]; total: number }>('/api/admin/audit');
  return (
    <StateWrapper state={state} empty={state.status === 'ok' && state.data.events.length === 0}>
      {state.status === 'ok' && state.data.events.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">
                <th className="py-2 pr-4 font-medium">Timestamp</th>
                <th className="py-2 pr-4 font-medium">Admin</th>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">Target</th>
                <th className="py-2 pr-4 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {state.data.events.map((e) => (
                <tr key={e.eventId} className="border-b border-white/[0.06] last:border-0">
                  <td className="py-2 pr-4 text-[#9aa3b2]">{new Date(e.timestamp).toLocaleString('tr-TR')}</td>
                  <td className="py-2 pr-4 font-mono text-[12px] text-[#9aa3b2]">{e.actor}</td>
                  <td className="py-2 pr-4 text-[#e8ecf2]">{e.action}</td>
                  <td className="py-2 pr-4 font-mono text-[12px] text-[#8b93a3]">{e.targetUserId ?? '—'}</td>
                  <td className="py-2 pr-4 text-[#9aa3b2]">{e.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </StateWrapper>
  );
}

export default function AdminControlCenter({ actorUserId }: { actorUserId: string }) {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <div className="mt-10 border-t border-white/10 pt-8">
      <p className="font-brand text-[11px] uppercase tracking-[0.28em] text-[#8b93a3]">Control Center</p>
      <nav aria-label="Admin bölümleri" className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-b border-white/[0.08] pb-3 text-[13px]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={tab === t.id ? 'text-[#e8ecf2]' : 'text-[#8b93a3] hover:text-[#e8ecf2]'}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="mt-5">
        {tab === 'overview' ? <OverviewTab /> : null}
        {tab === 'feedback' ? <AdminFeedbackPanel /> : null}
        {tab === 'errors' ? <AdminErrorsPanel /> : null}
        {tab === 'atlas-lab' ? <AdminAtlasLabPanel /> : null}
        {tab === 'users' ? <UsersTab actorUserId={actorUserId} /> : null}
        {tab === 'prime' ? <PrimeTab actorUserId={actorUserId} /> : null}
        {tab === 'usage' ? <UsageTab /> : null}
        {tab === 'costs' ? <CostsTab /> : null}
        {tab === 'health' ? <HealthTab /> : null}
        {tab === 'audit' ? <AuditTab /> : null}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import AdminRouteGuard, { type AdminMeResponse } from '../components/admin/AdminRouteGuard';
import { apiRequest } from '../services/api-client';

type AdminMember = {
  userId: string;
  username: string | null;
  email: string | null;
  plan: 'guest' | 'free' | 'premium';
  subscriptionStatus: string;
  subscription: { plan: string; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null } | null;
  entitlements: {
    'voice.lara': boolean;
    'usage.extended': boolean;
    'image.analysis': boolean;
    'memory.extended': boolean;
  };
  usage: { dailyUsed: number; dailyLimit: number };
};

function planLabel(plan: string) {
  if (plan === 'premium') return 'Lara Prime';
  if (plan === 'free') return 'Free';
  return 'Guest';
}

function MembershipPanel() {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ok'; members: AdminMember[] }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ ok: boolean; members: AdminMember[] }>('/api/admin/membership', {
      method: 'GET',
    })
      .then((res) => {
        if (!cancelled) setState({ status: 'ok', members: res.members });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Üyelik verisi alınamadı',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-10 border-t border-white/10 pt-8">
      <p className="font-brand text-[11px] uppercase tracking-[0.28em] text-[#8b93a3]">
        Users / Membership
      </p>

      {state.status === 'loading' ? (
        <p className="mt-4 text-sm text-[#8b93a3]">Yükleniyor…</p>
      ) : state.status === 'error' ? (
        <p className="mt-4 text-sm text-red-300/80">{state.message}</p>
      ) : state.members.length === 0 ? (
        <p className="mt-4 text-sm text-[#8b93a3]">Kayıtlı kullanıcı yok.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.1em] text-[#8b93a3]">
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium">Plan</th>
                <th className="py-2 pr-4 font-medium">Subscription</th>
                <th className="py-2 pr-4 font-medium">Usage</th>
                <th className="py-2 pr-4 font-medium">Voice</th>
                <th className="py-2 pr-4 font-medium">Image</th>
                <th className="py-2 pr-4 font-medium">Memory</th>
              </tr>
            </thead>
            <tbody>
              {state.members.map((m) => (
                <tr key={m.userId} className="border-b border-white/[0.06] last:border-0">
                  <td className="py-2.5 pr-4">
                    <div className="text-[#e8ecf2]">{m.username ?? '—'}</div>
                    <div className="font-mono text-[11px] text-[#8b93a3]">{m.userId}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-[#e8ecf2]">{planLabel(m.plan)}</td>
                  <td className="py-2.5 pr-4 text-[#9aa3b2]">{m.subscriptionStatus}</td>
                  <td className="py-2.5 pr-4 text-[#9aa3b2]">
                    {m.usage.dailyUsed} / {m.usage.dailyLimit}
                  </td>
                  <td className="py-2.5 pr-4">{m.entitlements['voice.lara'] ? '✓' : '—'}</td>
                  <td className="py-2.5 pr-4">{m.entitlements['image.analysis'] ? '✓' : '—'}</td>
                  <td className="py-2.5 pr-4">{m.entitlements['memory.extended'] ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminVerifiedPanel({ profile }: { profile: AdminMeResponse }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050608] text-[#e8ecf2]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(26,21,48,0.55),transparent_55%),radial-gradient(ellipse_at_80%_20%,rgba(11,18,32,0.7),transparent_50%)]"
      />
      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-16">
        <p className="font-brand text-[11px] uppercase tracking-[0.28em] text-[#8b93a3]">ATLAS Admin</p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-[#eef1f5] sm:text-5xl">
          Admin erişimi doğrulandı
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-[#8b93a3]">
          Kimlik ve rol doğrulaması sunucu tarafında yapılır. Kullanıcı ve üyelik görünürlüğü
          aşağıda; ham kişisel içerik (hafıza, görsel, ses) veya gizli anahtarlar gösterilmez.
        </p>

        <dl className="mt-10 space-y-4 border-t border-white/10 pt-8 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-[#8b93a3]">Kullanıcı</dt>
            <dd className="font-medium text-[#e8ecf2]">{profile.username ?? '—'}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-[#8b93a3]">E-posta</dt>
            <dd className="font-medium text-[#e8ecf2]">{profile.email ?? '—'}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-[#8b93a3]">userId</dt>
            <dd className="break-all font-mono text-xs text-[#9aa3b2]">{profile.userId}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="text-[#8b93a3]">Roller</dt>
            <dd className="font-medium text-[#e8ecf2]">{profile.roles.join(', ')}</dd>
          </div>
        </dl>

        <MembershipPanel />

        <Link
          to="/"
          className="mt-12 inline-flex w-fit text-sm text-[#9aa3b2] underline-offset-4 transition hover:text-[#e8ecf2] hover:underline"
        >
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminRouteGuard>
      {(profile) => <AdminVerifiedPanel profile={profile} />}
    </AdminRouteGuard>
  );
}

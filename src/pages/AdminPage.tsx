import { Link } from 'react-router-dom';

import AdminRouteGuard, { type AdminMeResponse } from '../components/admin/AdminRouteGuard';
import AdminControlCenter from '../components/admin/AdminControlCenter';

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

        <AdminControlCenter />

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

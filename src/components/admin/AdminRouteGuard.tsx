import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { ApiError, apiRequest } from '../../services/api-client';
import { ensureAtlasSession } from '../../utils/atlas-session';

export type AdminMeResponse = {
  ok: boolean;
  userId: string;
  username: string | null;
  email: string | null;
  roles: string[];
  isAdmin: boolean;
  isFounder: boolean;
  authMethod: string | null;
};

type GuardState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }
  | { status: 'ok'; profile: AdminMeResponse };

/**
 * UX-only gate. Authoritative checks live on GET /api/admin/me.
 */
export default function AdminRouteGuard({
  children,
}: {
  children: (profile: AdminMeResponse) => ReactNode;
}) {
  const [state, setState] = useState<GuardState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const session = await ensureAtlasSession();
        if (!session.authenticated || session.isAnonymous) {
          if (!cancelled) setState({ status: 'unauthenticated' });
          return;
        }

        const profile = await apiRequest<AdminMeResponse>('/api/admin/me', {
          method: 'GET',
        });
        if (!cancelled) setState({ status: 'ok', profile });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 401) {
            setState({ status: 'unauthenticated' });
            return;
          }
          if (err.status === 403) {
            setState({ status: 'forbidden' });
            return;
          }
        }
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Admin doğrulanamadı',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050608] text-[#8b93a3]">
        <p className="font-brand text-sm tracking-wide">Admin erişimi doğrulanıyor…</p>
      </div>
    );
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to="/?admin=1" replace />;
  }

  if (state.status === 'forbidden') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050608] px-6 text-center">
        <p className="font-brand text-lg text-[#e8ecf2]">Bu sayfa için admin yetkisi gerekir.</p>
        <p className="max-w-md text-sm text-[#8b93a3]">
          Frontend kontrolü yalnızca arayüz içindir; yetki sunucu tarafından reddedildi.
        </p>
        <Link
          to="/"
          className="text-sm text-[#9aa3b2] underline-offset-4 transition hover:text-[#e8ecf2] hover:underline"
        >
          Ana sayfaya dön
        </Link>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050608] px-6 text-center">
        <p className="font-brand text-lg text-[#e8ecf2]">Admin doğrulaması başarısız.</p>
        <p className="text-sm text-[#8b93a3]">{state.message}</p>
        <Link
          to="/"
          className="text-sm text-[#9aa3b2] underline-offset-4 transition hover:text-[#e8ecf2] hover:underline"
        >
          Ana sayfaya dön
        </Link>
      </div>
    );
  }

  return <>{children(state.profile)}</>;
}

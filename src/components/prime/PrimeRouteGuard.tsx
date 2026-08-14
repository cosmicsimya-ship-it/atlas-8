import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import {
  ATLAS_SESSION_CHANGED_EVENT,
  ensureAtlasSession,
  type AtlasSessionInfo,
} from '../../utils/atlas-session';

type GuardState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'ok'; session: AtlasSessionInfo };

/**
 * UX-only gate. Guest/anonymous sessions never see the Prime personal
 * center; authoritative rejection also happens server-side on every
 * /api/prime/* call (requireAuth rejects anonymous regardless of this).
 */
export default function PrimeRouteGuard({
  children,
}: {
  children: (session: AtlasSessionInfo) => ReactNode;
}) {
  const [state, setState] = useState<GuardState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    function resolve() {
      ensureAtlasSession()
        .then((session) => {
          if (cancelled) return;
          if (!session.authenticated || session.isAnonymous) {
            setState({ status: 'guest' });
            return;
          }
          // New object each time (even for the same user) — remounts children
          // via key below, guaranteeing no stale profile/today/memory state
          // from a previous account lingers on screen.
          setState({ status: 'ok', session });
        })
        .catch(() => {
          if (!cancelled) setState({ status: 'guest' });
        });
    }
    resolve();
    window.addEventListener(ATLAS_SESSION_CHANGED_EVENT, resolve);
    return () => {
      cancelled = true;
      window.removeEventListener(ATLAS_SESSION_CHANGED_EVENT, resolve);
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050608] text-[#8b93a3]">
        <p className="font-brand text-sm tracking-wide">Yükleniyor…</p>
      </div>
    );
  }

  if (state.status === 'guest') {
    return <Navigate to="/lara-prime" replace />;
  }

  return <>{children(state.session)}</>;
}

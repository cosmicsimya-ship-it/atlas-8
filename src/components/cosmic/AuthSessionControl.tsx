import { useEffect, useId, useRef, useState } from 'react';
import { LogIn, LogOut, X } from 'lucide-react';

import {
  ensureAtlasSession,
  loginAtlas,
  logoutAtlas,
  type AtlasSessionInfo,
} from '../../utils/atlas-session';

/**
 * Minimal founder/session login — uses HttpOnly cookies + CSRF via api-client.
 * Never stores passwords or session tokens in localStorage.
 */
export default function AuthSessionControl({
  appearance = 'default',
  autoOpen = false,
}: {
  appearance?: 'default' | 'landing';
  autoOpen?: boolean;
}) {
  const [session, setSession] = useState<AtlasSessionInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    ensureAtlasSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (!autoOpen || session == null) return;
    if (session.isAnonymous || !session.authenticated) {
      setOpen(true);
    }
  }, [autoOpen, session]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => usernameRef.current?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await loginAtlas(username.trim(), password);
      setSession(next);
      setPassword('');
      setOpen(false);
    } catch {
      setError('Giriş başarısız. Bilgileri kontrol edip tekrar deneyin.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    setBusy(true);
    try {
      await logoutAtlas();
      const next = await ensureAtlasSession();
      setSession(next);
    } catch {
      setSession(null);
    } finally {
      setBusy(false);
    }
  }

  const isFounder = Boolean(session?.isFounder);
  const label = isFounder ? 'Kurucu' : session?.isAnonymous ? 'Oturum' : 'Hesap';

  const isLanding = appearance === 'landing';
  const sessionLabelClass = isLanding
    ? 'hidden text-[10px] uppercase tracking-[0.2em] text-[#9aa3ae] sm:inline'
    : 'hidden text-[10px] uppercase tracking-[0.2em] text-[#c9b37a]/55 sm:inline';
  const actionBtnClass = isLanding
    ? 'site-focus inline-flex items-center gap-1.5 rounded-full border border-white/16 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-[#d4dae2] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/24 hover:bg-white/[0.07] hover:text-[#eef1f5]'
    : 'atlas-focus inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#e8ecf2]/75 transition hover:bg-white/5';

  return (
    <>
      <div className="flex items-center gap-2">
        <span className={sessionLabelClass}>{label}</span>
        {isFounder ? (
          <button
            type="button"
            onClick={onLogout}
            disabled={busy}
            className={actionBtnClass}
            aria-label="Çıkış yap"
          >
            <LogOut className="h-3.5 w-3.5" />
            Çıkış
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setError(null);
            }}
            className={actionBtnClass}
            aria-label="Giriş yap"
            aria-haspopup="dialog"
          >
            <LogIn className="h-3.5 w-3.5" />
            Giriş
          </button>
        )}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <button
              type="button"
              className="atlas-focus absolute right-3 top-3 rounded-full p-1 text-[#e8ecf2]/50 hover:bg-white/5"
              onClick={() => setOpen(false)}
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 id={titleId} className="font-brand text-lg font-semibold text-[#e8ecf2]">
              Atlas Giriş
            </h2>
            <p className="mt-1 text-xs text-[#e8ecf2]/50">
              Oturum çerez ile korunur. Şifre tarayıcıda saklanmaz.
            </p>
            <form className="mt-5 space-y-3" onSubmit={onLogin}>
              <label className="block text-xs text-[#e8ecf2]/65">
                Kullanıcı adı
                <input
                  ref={usernameRef}
                  className="atlas-field mt-1 text-sm"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs text-[#e8ecf2]/65">
                Şifre
                <input
                  type="password"
                  className="atlas-field mt-1 text-sm"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {error ? (
                <p className="text-xs text-red-300/90" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={busy} className="atlas-btn-gold w-full">
                {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

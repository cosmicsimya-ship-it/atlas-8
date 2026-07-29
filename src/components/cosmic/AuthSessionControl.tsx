import { useEffect, useState } from 'react';
import { LogIn, LogOut, X } from 'lucide-react';

import {
  ensureAtlasSession,
  loginAtlas,
  logoutAtlas,
  type AtlasSessionInfo,
} from '../../utils/atlas-session';
import { cn } from '../../utils/cn';

/**
 * Minimal founder/session login — uses HttpOnly cookies + CSRF via api-client.
 * Never stores passwords or session tokens in localStorage.
 */
export default function AuthSessionControl() {
  const [session, setSession] = useState<AtlasSessionInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ensureAtlasSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

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

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="hidden text-[10px] uppercase tracking-[0.2em] text-[#c9b37a]/55 sm:inline">
          {label}
        </span>
        {isFounder ? (
          <button
            type="button"
            onClick={onLogout}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#f5f0e8]/75 transition hover:bg-white/5"
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
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#f5f0e8]/75 transition hover:bg-white/5"
            aria-label="Giriş yap"
          >
            <LogIn className="h-3.5 w-3.5" />
            Giriş
          </button>
        )}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="atlas-login-title"
        >
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full p-1 text-[#f5f0e8]/50 hover:bg-white/5"
              onClick={() => setOpen(false)}
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 id="atlas-login-title" className="font-display text-lg text-[#f5f0e8]">
              Atlas Giriş
            </h2>
            <p className="mt-1 text-xs text-[#f5f0e8]/50">
              Oturum çerez ile korunur. Şifre tarayıcıda saklanmaz.
            </p>
            <form className="mt-5 space-y-3" onSubmit={onLogin}>
              <label className="block text-xs text-[#f5f0e8]/65">
                Kullanıcı adı
                <input
                  className={cn(
                    'mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-[#f5f0e8]',
                    'outline-none focus:border-[#c9b37a]/40',
                  )}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs text-[#f5f0e8]/65">
                Şifre
                <input
                  type="password"
                  className={cn(
                    'mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-[#f5f0e8]',
                    'outline-none focus:border-[#c9b37a]/40',
                  )}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {error ? <p className="text-xs text-red-300/90">{error}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-[#c9b37a]/90 px-3 py-2 text-sm font-medium text-[#0a0a0a] transition hover:bg-[#c9b37a] disabled:opacity-60"
              >
                {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

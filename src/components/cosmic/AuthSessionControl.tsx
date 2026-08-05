import { useEffect, useId, useRef, useState } from 'react';
import { Eye, EyeOff, LogIn, LogOut, UserPlus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import {
  consumeAuthCallbackParams,
  ensureAtlasSession,
  fetchGoogleAuthStatus,
  loginAtlas,
  logoutAtlas,
  mapAuthError,
  oauthErrorMessage,
  registerAtlas,
  startGoogleAuth,
  type AtlasSessionInfo,
} from '../../utils/atlas-session';

type AuthMode = 'chooser' | 'login' | 'register';

/**
 * Public auth entry — HttpOnly cookies + CSRF via api-client.
 * Never stores passwords or session tokens in localStorage.
 */
export default function AuthSessionControl({
  appearance = 'default',
  autoOpen = false,
  initialMode = 'chooser',
}: {
  appearance?: 'default' | 'landing';
  autoOpen?: boolean;
  initialMode?: AuthMode;
}) {
  const navigate = useNavigate();
  const [session, setSession] = useState<AtlasSessionInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const isAccount =
    Boolean(session?.authenticated) && !session?.isAnonymous && Boolean(session?.authMethod);

  useEffect(() => {
    const callback = consumeAuthCallbackParams();
    ensureAtlasSession()
      .then((next) => {
        setSession(next);
        if (callback.auth === 'error') {
          setError(oauthErrorMessage(callback.code));
          setOpen(true);
          setMode('chooser');
        } else if (callback.auth === 'ok') {
          setError(null);
          setOpen(false);
          // Google / e-posta dönüşünde Atlas sohbetine al
          if (next.authenticated && !next.isAnonymous) {
            navigate('/atlas', { replace: true });
          }
        }
      })
      .catch(() => setSession(null));

    fetchGoogleAuthStatus()
      .then((s) => setGoogleConfigured(Boolean(s.configured)))
      .catch(() => setGoogleConfigured(false));
  }, [navigate]);

  useEffect(() => {
    if (!autoOpen || session == null) return;
    if (session.isAnonymous || !session.authenticated) {
      setOpen(true);
      setMode('login');
    }
  }, [autoOpen, session]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => {
      if (mode === 'login' || mode === 'register') {
        emailRef.current?.focus();
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
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
  }, [open, mode]);

  function openModal(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setPassword('');
    setPasswordConfirm('');
    setShowPassword(false);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setError(null);
    setPassword('');
    setPasswordConfirm('');
    setShowPassword(false);
    setMode('chooser');
  }

  function validateClient(): string | null {
    const trimmed = email.trim();
    if (!trimmed) {
      return mode === 'register'
        ? 'Geçerli bir e-posta adresi girin.'
        : 'E-posta veya kullanıcı adı gerekli.';
    }
    if (mode === 'register') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return 'Geçerli bir e-posta adresi girin.';
      }
    }
    if (password.length < 8) {
      return 'Şifre en az 8 karakter olmalıdır.';
    }
    if (mode === 'register') {
      if (!/[A-Za-zÀ-ÿ]/.test(password) || !/[0-9]/.test(password)) {
        return 'Şifre en az bir harf ve bir rakam içermelidir.';
      }
      if (password !== passwordConfirm) {
        return 'Şifreler eşleşmiyor.';
      }
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientError = validateClient();
    if (clientError) {
      setError(clientError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next =
        mode === 'register'
          ? await registerAtlas(email.trim(), password, passwordConfirm)
          : await loginAtlas(email.trim(), password);
      setSession(next);
      setPassword('');
      setPasswordConfirm('');
      closeModal();
      if (next.authenticated && !next.isAnonymous) {
        navigate('/atlas');
      }
    } catch (err) {
      setError(mapAuthError(err));
      setPassword('');
      setPasswordConfirm('');
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    setBusy(true);
    setError(null);
    try {
      await logoutAtlas();
      const next = await ensureAtlasSession();
      setSession(next);
    } catch {
      setError('Çıkış yapılamadı. Sayfayı yenileyip tekrar deneyin.');
      setSession(null);
    } finally {
      setBusy(false);
    }
  }

  function onGoogle() {
    setError(null);
    if (!googleConfigured) {
      setError('Google ile giriş henüz yapılandırılmamış. E-posta ile devam edebilirsiniz.');
      return;
    }
    setBusy(true);
    try {
      startGoogleAuth();
    } catch {
      setBusy(false);
      setError('Google girişi başlatılamadı. Pop-up engelleyiciyi kontrol edin veya e-posta kullanın.');
    }
  }

  const displayName =
    session?.displayName ||
    (session?.isFounder ? 'Kurucu' : null) ||
    (session?.email ? session.email.split('@')[0] : null) ||
    'Hesap';
  const displayEmail = session?.email || null;

  const isLanding = appearance === 'landing';
  const sessionNameClass = isLanding
    ? 'max-w-[9rem] truncate text-[11px] font-medium text-[#e8ecf2] sm:max-w-[11rem]'
    : 'max-w-[9rem] truncate text-[11px] font-medium text-[#e8ecf2] sm:max-w-[11rem]';
  const sessionEmailClass = isLanding
    ? 'max-w-[9rem] truncate text-[10px] normal-case tracking-normal text-[#9aa3ae] sm:max-w-[11rem]'
    : 'max-w-[9rem] truncate text-[10px] normal-case tracking-normal text-[#c9b37a]/55 sm:max-w-[11rem]';
  const actionBtnClass = isLanding
    ? 'site-focus inline-flex items-center gap-1.5 rounded-full border border-white/16 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-[#d4dae2] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/24 hover:bg-white/[0.07] hover:text-[#eef1f5] disabled:opacity-60'
    : 'atlas-focus inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#e8ecf2]/75 transition hover:bg-white/5 disabled:opacity-60';

  const title =
    mode === 'register' ? 'Üye Ol' : mode === 'login' ? 'Giriş Yap' : 'Atlas Hesabı';

  return (
    <>
      <div className="flex items-center gap-2">
        {isAccount ? (
          <>
            {session?.avatarUrl ? (
              <img
                src={session.avatarUrl}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full border border-white/15 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[11px] font-semibold text-[#e8ecf2]/80"
                aria-hidden
              >
                {displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div
              className="hidden min-w-0 flex-col sm:flex"
              title={[displayName, displayEmail].filter(Boolean).join(' · ')}
            >
              <span className={sessionNameClass}>{displayName}</span>
              {displayEmail ? <span className={sessionEmailClass}>{displayEmail}</span> : null}
            </div>
            <button
              type="button"
              onClick={onLogout}
              disabled={busy}
              className={actionBtnClass}
              aria-label="Çıkış yap"
            >
              <LogOut className="h-3.5 w-3.5" />
              Çıkış Yap
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => openModal('login')}
              className={actionBtnClass}
              aria-label="Giriş yap"
              aria-haspopup="dialog"
            >
              <LogIn className="h-3.5 w-3.5" />
              Giriş Yap
            </button>
            <button
              type="button"
              onClick={() => openModal('register')}
              className={actionBtnClass}
              aria-label="Üye ol"
              aria-haspopup="dialog"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Üye Ol
            </button>
          </>
        )}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto overscroll-contain bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            ref={dialogRef}
            className="relative my-auto max-h-[min(92dvh,40rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 shadow-2xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <button
              type="button"
              className="atlas-focus absolute right-3 top-3 rounded-full p-1 text-[#e8ecf2]/50 hover:bg-white/5"
              onClick={closeModal}
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 id={titleId} className="pr-8 font-brand text-lg font-semibold text-[#e8ecf2]">
              {title}
            </h2>
            <p className="mt-1 text-xs text-[#e8ecf2]/50">
              Oturum çerez ile korunur. Şifre tarayıcıda saklanmaz.
            </p>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={onGoogle}
                disabled={busy || !googleConfigured}
                title={
                  googleConfigured
                    ? 'Google hesabınızla Atlas oturumu açın'
                    : 'Google OAuth sunucuda henüz yapılandırılmadı'
                }
                className="atlas-focus flex w-full items-center justify-center gap-2 rounded-xl border border-white/14 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-[#eef1f5] transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GoogleMark />
                Google ile Giriş Yap
              </button>
              {!googleConfigured ? (
                <p className="text-[10px] leading-relaxed text-[#e8ecf2]/40">
                  Google girişi şu an kapalı. E-posta ile devam edebilirsiniz.
                </p>
              ) : null}

              {mode === 'chooser' ? (
                <div className="grid gap-2 pt-1">
                  <button
                    type="button"
                    className="atlas-btn-gold w-full"
                    onClick={() => setMode('register')}
                    disabled={busy}
                  >
                    E-posta ile Üye Ol
                  </button>
                  <button
                    type="button"
                    className={actionBtnClass + ' w-full justify-center py-2.5'}
                    onClick={() => setMode('login')}
                    disabled={busy}
                  >
                    E-posta ile Giriş Yap
                  </button>
                </div>
              ) : (
                <form className="space-y-3 pt-1" onSubmit={onSubmit}>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      className={
                        mode === 'login'
                          ? 'text-[#c9b37a]'
                          : 'text-[#e8ecf2]/45 hover:text-[#e8ecf2]/75'
                      }
                      onClick={() => {
                        setMode('login');
                        setError(null);
                      }}
                    >
                      Giriş
                    </button>
                    <span className="text-[#e8ecf2]/25">·</span>
                    <button
                      type="button"
                      className={
                        mode === 'register'
                          ? 'text-[#c9b37a]'
                          : 'text-[#e8ecf2]/45 hover:text-[#e8ecf2]/75'
                      }
                      onClick={() => {
                        setMode('register');
                        setError(null);
                      }}
                    >
                      Üye Ol
                    </button>
                  </div>

                  <label className="block text-xs text-[#e8ecf2]/65">
                    {mode === 'register' ? 'E-posta' : 'E-posta veya kullanıcı adı'}
                    <input
                      ref={emailRef}
                      type={mode === 'register' ? 'email' : 'text'}
                      inputMode={mode === 'register' ? 'email' : 'text'}
                      autoComplete={mode === 'register' ? 'email' : 'username'}
                      className="atlas-field mt-1 text-sm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={busy}
                    />
                  </label>

                  <label className="block text-xs text-[#e8ecf2]/65">
                    Şifre
                    <span className="relative mt-1 block">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="atlas-field w-full pr-10 text-sm"
                        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        disabled={busy}
                      />
                      <button
                        type="button"
                        className="atlas-focus absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#e8ecf2]/45 hover:text-[#e8ecf2]/8"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                        tabIndex={0}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </span>
                  </label>

                  {mode === 'register' ? (
                    <label className="block text-xs text-[#e8ecf2]/65">
                      Şifre (tekrar)
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="atlas-field mt-1 text-sm"
                        autoComplete="new-password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        required
                        minLength={8}
                        disabled={busy}
                      />
                    </label>
                  ) : null}

                  {error ? (
                    <p className="text-xs text-red-300/90" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <button type="submit" disabled={busy} className="atlas-btn-gold w-full">
                    {busy
                      ? mode === 'register'
                        ? 'Hesap oluşturuluyor…'
                        : 'Giriş yapılıyor…'
                      : mode === 'register'
                        ? 'E-posta ile Üye Ol'
                        : 'E-posta ile Giriş Yap'}
                  </button>
                </form>
              )}

              {error && mode === 'chooser' ? (
                <p className="text-xs text-red-300/90" role="alert">
                  {error}
                </p>
              ) : null}

              <p className="pt-1 text-center text-[10px] leading-relaxed text-[#e8ecf2]/40">
                Devam ederek{' '}
                <Link to="/about#sartlar" className="underline hover:text-[#e8ecf2]/70" onClick={closeModal}>
                  Kullanım Koşulları
                </Link>{' '}
                ve{' '}
                <Link to="/about#gizlilik" className="underline hover:text-[#e8ecf2]/70" onClick={closeModal}>
                  Gizlilik Politikası
                </Link>
                ’nı kabul etmiş olursunuz.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.1 4 9.2 8.5 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.9 26.8 37 24 37c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.1 39.4 16 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.2 5.2C39.2 36.3 44 31 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

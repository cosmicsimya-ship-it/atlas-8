/**
 * Lara Prime membership surface — user-facing paid membership for Atlas.
 * Internal plan remains `premium`; checkout/entitlements stay server-authoritative.
 *
 * CODE/TEST VERIFIED via existing billing fixtures.
 * REAL IYZICO SANDBOX E2E remains LEVEL 2 until separate LEVEL 4 proof.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import CosmicShell from '../components/cosmic/CosmicShell';
import {
  fetchBillingConfig,
  isSafePaymentPageUrl,
  startPremiumCheckout,
  type AtlasBillingConfig,
} from '../services/atlas-billing';
import {
  fetchEntitlements,
  isPremiumPlan,
  type AtlasEntitlementsPayload,
} from '../services/atlas-entitlements';
import {
  rememberAuthReturnPath,
  requestAtlasAuth,
} from '../utils/atlas-auth-request';
import {
  ATLAS_SESSION_CHANGED_EVENT,
  ensureAtlasSession,
  type AtlasSessionInfo,
} from '../utils/atlas-session';

type CheckoutUiState = 'idle' | 'initializing' | 'redirecting' | 'dry-run' | 'error';

const FEATURE_LINES = [
  {
    title: 'Lara Voice',
    body: 'Atlas’ı Lara’nın sesiyle dinle — sunucu yetkisiyle açılır.',
  },
  {
    title: 'Türkçe ve İngilizce ses',
    body: 'Sesli yanıt, mevcut Atlas konuşma akışına bağlanır.',
  },
] as const;

export default function LaraPrimePage() {
  const [session, setSession] = useState<AtlasSessionInfo | null>(null);
  const [entitlements, setEntitlements] = useState<AtlasEntitlementsPayload | null>(null);
  const [config, setConfig] = useState<AtlasBillingConfig | null>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutUiState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkoutLock = useRef(false);

  const isAccount =
    Boolean(session?.authenticated) && !session?.isAnonymous && Boolean(session?.authMethod);
  // Server entitlements are canonical once loaded; session.plan is only a first-paint fallback.
  const isPrime = entitlements ? isPremiumPlan(entitlements) : session?.plan === 'premium';
  const busy = checkoutState === 'initializing' || checkoutState === 'redirecting';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await ensureAtlasSession();
        if (cancelled) return;
        setSession(next);
        if (next.authenticated && !next.isAnonymous) {
          try {
            const ent = await fetchEntitlements();
            if (!cancelled) setEntitlements(ent);
          } catch {
            if (!cancelled) setEntitlements(null);
          }
        } else if (!cancelled) {
          setEntitlements(null);
        }
      } catch {
        if (!cancelled) setSession(null);
      }
    }
    load();
    window.addEventListener(ATLAS_SESSION_CHANGED_EVENT, load);
    fetchBillingConfig()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
      window.removeEventListener(ATLAS_SESSION_CHANGED_EVENT, load);
    };
  }, []);

  const priceLabel = config?.product?.displayPrice
    ? `${config.product.displayPrice} / ay`
    : null;

  async function onCheckout() {
    if (checkoutLock.current || busy || isPrime || !isAccount) return;
    checkoutLock.current = true;
    setCheckoutState('initializing');
    setError(null);
    setMessage(null);
    try {
      const result = await startPremiumCheckout();
      if (!result.ok) {
        setCheckoutState('error');
        setError(result.error?.message || 'Checkout başlatılamadı.');
        checkoutLock.current = false;
        return;
      }
      if (result.dryRun || !result.liveCheckoutEnabled) {
        setCheckoutState('dry-run');
        setMessage(
          'Lara Prime ödeme altyapısı hazır (test/dry-run). Canlı sandbox bu ortamda kapalı.',
        );
        checkoutLock.current = false;
        return;
      }
      const url = result.paymentPageUrl;
      if (!isSafePaymentPageUrl(url)) {
        setCheckoutState('error');
        setError('Ödeme sayfası alınamadı. Canlı checkout yanıtında güvenli paymentPageUrl yok.');
        checkoutLock.current = false;
        return;
      }
      setCheckoutState('redirecting');
      setMessage('Ödeme sayfasına yönlendiriliyorsunuz…');
      window.location.assign(String(url));
    } catch (e) {
      setCheckoutState('error');
      setError(e instanceof Error ? e.message : 'Checkout hatası.');
      checkoutLock.current = false;
    }
  }

  function onGuestCta() {
    rememberAuthReturnPath('/lara-prime');
    requestAtlasAuth('login');
  }

  const ctaLabel =
    checkoutState === 'initializing'
      ? 'Hazırlanıyor…'
      : checkoutState === 'redirecting'
        ? 'Yönlendiriliyor…'
        : 'Lara Prime’a Geç';

  return (
    <CosmicShell transparentNav>
      <main className="mx-auto min-h-[100dvh] max-w-3xl px-4 pb-24 pt-28 sm:px-6 md:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-[#c9b37a]/70">
          Cosmic Simya · Atlas
        </p>
        <h1 className="mt-5 font-display text-[clamp(2.1rem,6vw,3.4rem)] font-medium tracking-[-0.03em] text-[#e8ecf2]">
          LARA PRIME
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-[#e8ecf2]/68">
          Atlas’ın ayrıcalıklı deneyimi.
        </p>

        <section className="mt-14 border-t border-white/[0.08] pt-10">
          <h2 className="font-display text-lg tracking-wide text-[#e8ecf2]/90">Kapsam</h2>
          <ul className="mt-6 space-y-6">
            {FEATURE_LINES.map((f) => (
              <li key={f.title}>
                <p className="text-sm font-medium tracking-wide text-[#e8ecf2]">{f.title}</p>
                <p className="mt-1.5 text-sm leading-6 text-[#9aa3b2]">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 border-t border-white/[0.08] pt-10">
          {isPrime ? (
            <div className="max-w-md">
              <p className="font-display text-xl tracking-wide text-[#e8ecf2]">LARA PRIME</p>
              <p className="mt-3 text-sm leading-6 text-[#c9b37a]/85">Üyeliğin aktif.</p>
              <p className="mt-2 text-[12px] text-[#8b93a3]">
                Sunucu planı: premium
                {entitlements?.entitlements?.['voice.lara'] || session?.entitlements?.['voice.lara']
                  ? ' · Lara Voice açık'
                  : ''}
              </p>
              <Link
                to="/prime"
                className="atlas-focus mt-8 inline-flex rounded-md border border-white/14 bg-white/[0.04] px-4 py-2.5 text-sm text-[#e8ecf2] transition hover:bg-white/[0.08]"
              >
                Prime merkeze gir
              </Link>
            </div>
          ) : (
            <div className="max-w-md">
              {priceLabel ? (
                <p className="font-display text-2xl tracking-wide text-[#e8ecf2]">{priceLabel}</p>
              ) : (
                <p className="text-sm text-[#9aa3b2]">Fiyat sunucu yapılandırmasından yükleniyor…</p>
              )}
              <p className="mt-2 text-[12px] text-[#8b93a3]">
                Tutar ve para birimi sunucu tarafından belirlenir; istemci fiyatı yetkili değildir.
              </p>

              {isAccount ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onCheckout}
                  className="atlas-focus mt-8 w-full rounded-md border border-[#c9b37a]/35 bg-[#c9b37a]/10 px-4 py-3 text-sm font-medium tracking-wide text-[#e8ecf2] transition hover:bg-[#c9b37a]/16 disabled:opacity-50 sm:w-auto sm:min-w-[14rem]"
                >
                  {ctaLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onGuestCta}
                  className="atlas-focus mt-8 w-full rounded-md border border-[#c9b37a]/35 bg-[#c9b37a]/10 px-4 py-3 text-sm font-medium tracking-wide text-[#e8ecf2] transition hover:bg-[#c9b37a]/16 sm:w-auto sm:min-w-[14rem]"
                >
                  Lara Prime’a Geç
                </button>
              )}

              {!isAccount ? (
                <p className="mt-3 text-[12px] leading-5 text-[#8b93a3]">
                  Üyelik için giriş gerekir. Girişten sonra Lara Prime sayfasına dönebilirsin.
                </p>
              ) : null}

              {message ? <p className="mt-4 text-[12px] text-[#9aa3b2]">{message}</p> : null}
              {error ? <p className="mt-4 text-[12px] text-rose-300/90">{error}</p> : null}
            </div>
          )}
        </section>
      </main>
    </CosmicShell>
  );
}

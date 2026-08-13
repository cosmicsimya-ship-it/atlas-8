/**
 * Lara Prime membership surface — user-facing paid membership for Atlas.
 * Internal plan remains `premium`; checkout/entitlements stay server-authoritative.
 *
 * Every capability described on this page is real and server-enforced:
 *   - voice.lara            server/voice/*, server/entitlements/middleware.js
 *   - usage.extended         server/usage/chat-usage.js, server/entitlements/usage-guard.js
 *   - image.analysis        server/entitlements/image-guard.js, gated in POST /api/chat
 *   - memory.extended        server/memory-intents.js (buildRelevantMemoryContext)
 * Quota/depth numbers below (40/200, 3/12) mirror the server defaults in
 * chat-usage.js and memory-intents.js. If those env defaults change, this
 * copy must be updated to match — there is no public numbers endpoint yet.
 *
 * CODE/TEST VERIFIED via existing billing fixtures.
 * REAL IYZICO SANDBOX E2E remains LEVEL 2 until separate LEVEL 4 proof.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ImagePlus,
  Lock,
  MessageCircle,
  Mic,
  Minus,
  Sparkles,
} from 'lucide-react';

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
import { ensureAtlasSession, type AtlasSessionInfo } from '../utils/atlas-session';

type CheckoutUiState = 'idle' | 'initializing' | 'redirecting' | 'dry-run' | 'error';

/** Server defaults — see server/usage/chat-usage.js and server/memory-intents.js */
const FREE_DAILY_MESSAGES = 40;
const PRIME_DAILY_MESSAGES = 200;
const FREE_MEMORY_DEPTH = 3;
const PRIME_MEMORY_DEPTH = 12;

const CAPABILITY_CARDS = [
  {
    icon: Mic,
    eyebrow: 'Lara Voice',
    title: 'Atlas’ı Lara’nın sesiyle dinle',
    body: 'Türkçe ve İngilizce. Sunucu yetkisiyle açılır, mevcut konuşma akışına doğrudan bağlanır.',
  },
  {
    icon: MessageCircle,
    eyebrow: 'Genişletilmiş kullanım',
    title: `Günde ${FREE_DAILY_MESSAGES} yerine ${PRIME_DAILY_MESSAGES} mesaj`,
    body: 'Günlük kullanım sınırı sunucu tarafında plana göre belirlenir; istemci bu sınırı değiştiremez.',
  },
  {
    icon: ImagePlus,
    eyebrow: 'Görsel ile analiz',
    title: 'Bir görseli sohbete ekle',
    body: 'JPEG, PNG veya WEBP — Atlas görseli mevcut konuşmanın bağlamıyla birlikte değerlendirir.',
  },
  {
    icon: Sparkles,
    eyebrow: 'Genişletilmiş kişisel bağlam',
    title: `${FREE_MEMORY_DEPTH} yerine ${PRIME_MEMORY_DEPTH} geçmiş not`,
    body: 'Geçmişe atıfta bulunduğunda Atlas’ın hatırladığı not sayısı genişler; tetikleme mantığı aynı kalır.',
  },
] as const;

type ComparisonRow = {
  label: string;
  free: string;
  prime: string;
  /** true when free and prime are genuinely identical — no upsell framing */
  same?: boolean;
};

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Atlas ile sohbet', free: 'Var', prime: 'Var', same: true },
  {
    label: 'Astroloji, numeroloji, sembolik analiz',
    free: 'Var',
    prime: 'Var',
    same: true,
  },
  { label: 'Ses / müzik dosyası yükleme', free: 'Var', prime: 'Var', same: true },
  { label: 'Günlük kullanım', free: `${FREE_DAILY_MESSAGES} mesaj`, prime: `${PRIME_DAILY_MESSAGES} mesaj` },
  {
    label: 'Kişisel bağlam (geçmişe atıfta)',
    free: `${FREE_MEMORY_DEPTH} not`,
    prime: `${PRIME_MEMORY_DEPTH} not`,
  },
  { label: 'Lara Voice', free: 'Yok', prime: 'Var' },
  { label: 'Görsel ile analiz', free: 'Yok', prime: 'Var' },
];

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
  const isPrime = isPremiumPlan(entitlements) || session?.plan === 'premium';
  const busy = checkoutState === 'initializing' || checkoutState === 'redirecting';

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        }
      } catch {
        if (!cancelled) setSession(null);
      }
    })();
    fetchBillingConfig()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
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

  function CtaBlock({ compact = false }: { compact?: boolean }) {
    if (isPrime) {
      return (
        <div className={compact ? '' : 'max-w-md'}>
          <p className="text-sm leading-6 text-[#c9b37a]/85">Üyeliğin aktif.</p>
          <p className="mt-2 text-[12px] text-[#8b93a3]">
            Sunucu planı: premium
            {entitlements?.entitlements?.['voice.lara'] || session?.entitlements?.['voice.lara']
              ? ' · Lara Voice açık'
              : ''}
          </p>
          <Link
            to="/atlas"
            className="atlas-focus mt-6 inline-flex rounded-md border border-white/14 bg-white/[0.04] px-4 py-2.5 text-sm text-[#e8ecf2] transition hover:bg-white/[0.08]"
          >
            Atlas’a dön
          </Link>
        </div>
      );
    }

    return (
      <div className={compact ? '' : 'max-w-md'}>
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
            className="atlas-focus mt-6 w-full rounded-md border border-[#c9b37a]/35 bg-[#c9b37a]/10 px-4 py-3 text-sm font-medium tracking-wide text-[#e8ecf2] transition hover:bg-[#c9b37a]/16 disabled:opacity-50 sm:w-auto sm:min-w-[14rem]"
          >
            {ctaLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onGuestCta}
            className="atlas-focus mt-6 w-full rounded-md border border-[#c9b37a]/35 bg-[#c9b37a]/10 px-4 py-3 text-sm font-medium tracking-wide text-[#e8ecf2] transition hover:bg-[#c9b37a]/16 sm:w-auto sm:min-w-[14rem]"
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
    );
  }

  return (
    <CosmicShell transparentNav>
      <main className="mx-auto min-h-[100dvh] max-w-3xl px-4 pb-24 pt-28 sm:px-6 md:px-8">
        {/* 1 — Hero */}
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-[#c9b37a]/70">
          Cosmic Simya · Atlas
        </p>
        <h1 className="mt-5 font-display text-[clamp(2.1rem,6vw,3.4rem)] font-medium tracking-[-0.03em] text-[#e8ecf2]">
          LARA PRIME
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-[#e8ecf2]/68">
          Atlas’ın daha kişisel katmanı: Lara’nın sesi, daha geniş günlük kullanım, görsel ile
          analiz ve daha derin kişisel bağlam.
        </p>

        {/* 2 — Fiyat + CTA */}
        <section className="mt-10 border-t border-white/[0.08] pt-8">
          <CtaBlock />
        </section>

        {/* 3 — Prime ile ne değişiyor? */}
        <section className="mt-14 border-t border-white/[0.08] pt-10">
          <h2 className="font-display text-lg tracking-wide text-[#e8ecf2]/90">
            Prime ile ne değişiyor?
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#9aa3b2]">
            Dördü de gerçek, sunucu tarafında uygulanan farklar — istemci hiçbirini kendi kendine
            açamaz.
          </p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2">
            {CAPABILITY_CARDS.map(({ icon: Icon, eyebrow, title, body }) => (
              <div key={eyebrow} className="bg-[#050608] p-5">
                <Icon size={16} className="text-[#c9b37a]/80" aria-hidden />
                <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#c9b37a]/70">
                  {eyebrow}
                </p>
                <p className="mt-1.5 text-sm font-medium tracking-wide text-[#e8ecf2]">{title}</p>
                <p className="mt-1.5 text-[13px] leading-5 text-[#9aa3b2]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 4 — Lara Voice */}
        <section className="mt-14 border-t border-white/[0.08] pt-10">
          <div className="flex items-center gap-2.5">
            <Mic size={16} className="text-[#c9b37a]/80" aria-hidden />
            <h2 className="font-display text-lg tracking-wide text-[#e8ecf2]/90">Lara Voice</h2>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#9aa3b2]">
            Atlas’ın yanıtlarını Lara’nın sesiyle dinle — Türkçe ve İngilizce. Sesli yanıt, mevcut
            Atlas konuşma akışına doğrudan bağlanır; ayrı bir uygulama veya adım gerekmez.
          </p>
        </section>

        {/* 5 — Genişletilmiş kullanım */}
        <section className="mt-14 border-t border-white/[0.08] pt-10">
          <div className="flex items-center gap-2.5">
            <MessageCircle size={16} className="text-[#c9b37a]/80" aria-hidden />
            <h2 className="font-display text-lg tracking-wide text-[#e8ecf2]/90">
              Genişletilmiş kullanım
            </h2>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#9aa3b2]">
            Günlük kullanım sınırı plana göre değişir — Atlas free hesapta günde{' '}
            {FREE_DAILY_MESSAGES}, Lara Prime’da günde {PRIME_DAILY_MESSAGES} mesaja kadar
            kullanılabilir. Bu sınır sunucu tarafında hesaplanır; istemci tarafından değiştirilemez.
          </p>
        </section>

        {/* 6 — Görsel ile analiz */}
        <section className="mt-14 border-t border-white/[0.08] pt-10">
          <div className="flex items-center gap-2.5">
            <ImagePlus size={16} className="text-[#c9b37a]/80" aria-hidden />
            <h2 className="font-display text-lg tracking-wide text-[#e8ecf2]/90">
              Görsel ile analiz
            </h2>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#9aa3b2]">
            Sohbete bir görsel ekle — JPEG, PNG veya WEBP. Atlas görseli, konuşmanın mevcut
            bağlamıyla birlikte değerlendirir. Bu, yalnızca Lara Prime üyeliğinde açık.
          </p>
        </section>

        {/* 7 — Genişletilmiş kişisel bağlam */}
        <section className="mt-14 border-t border-white/[0.08] pt-10">
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-[#c9b37a]/80" aria-hidden />
            <h2 className="font-display text-lg tracking-wide text-[#e8ecf2]/90">
              Genişletilmiş kişisel bağlam
            </h2>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#9aa3b2]">
            Atlas geçmişe atıfta bulunduğun anlarda seninle ilgili notları hatırlar — free hesapta
            en son {FREE_MEMORY_DEPTH}, Lara Prime’da en son {PRIME_MEMORY_DEPTH} not. Ne zaman
            hatırlanacağı aynı kalır; yalnızca hatırlanan derinlik genişler.
          </p>
        </section>

        {/* 8 — Free vs Prime */}
        <section className="mt-14 border-t border-white/[0.08] pt-10">
          <h2 className="font-display text-lg tracking-wide text-[#e8ecf2]/90">
            Atlas Free ve Lara Prime
          </h2>
          <div className="mt-6 overflow-hidden rounded-lg border border-white/[0.08]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.12em] text-[#8b93a3]">
                  <th className="px-4 py-3 font-medium">&nbsp;</th>
                  <th className="px-4 py-3 font-medium">Atlas Free</th>
                  <th className="px-4 py-3 font-medium text-[#c9b37a]/85">Lara Prime</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-4 py-3 text-[#e8ecf2]/85">{row.label}</td>
                    <td className="px-4 py-3 text-[#9aa3b2]">
                      {row.same ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Check size={13} className="text-[#9aa3b2]" aria-hidden /> {row.free}
                        </span>
                      ) : row.free === 'Yok' ? (
                        <span className="inline-flex items-center gap-1.5 text-[#8b93a3]/70">
                          <Minus size={13} aria-hidden /> Yok
                        </span>
                      ) : (
                        row.free
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#e8ecf2]">
                      {row.same ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Check size={13} className="text-[#c9b37a]/85" aria-hidden /> {row.prime}
                        </span>
                      ) : row.prime === 'Yok' ? (
                        <span className="inline-flex items-center gap-1.5 text-[#8b93a3]/70">
                          <Minus size={13} aria-hidden /> Yok
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <Check size={13} className="text-[#c9b37a]/85" aria-hidden /> {row.prime}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-[#8b93a3]">
            Sohbet, sembolik analiz ve ses/müzik yükleme her iki planda da aynı şekilde çalışır —
            bunlar Prime’a özel değildir.
          </p>
        </section>

        {/* 9 — Mahremiyet / güven */}
        <section className="mt-14 border-t border-white/[0.08] pt-10">
          <div className="flex items-center gap-2.5">
            <Lock size={16} className="text-[#c9b37a]/80" aria-hidden />
            <h2 className="font-display text-lg tracking-wide text-[#e8ecf2]/90">
              Mahremiyet ve kontrol
            </h2>
          </div>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-[#9aa3b2]">
            <li>
              Plan ve yetki bilgisi yalnızca sunucu tarafında belirlenir; istemci bu bilgiyi
              değiştiremez veya kendine yetki veremez.
            </li>
            <li>
              Üyelik sona erdiğinde geçmiş bilgilerin hiçbiri silinmez — yalnızca genişletilmiş
              erişim kapanır, Atlas free hesap davranışına döner.
            </li>
            <li>
              Görseller yalnızca analiz için işlenir; ham içerik loglara veya konuşma geçmişine
              kalıcı olarak yazılmaz.
            </li>
          </ul>
        </section>

        {/* 10 — Final CTA */}
        <section className="mt-14 border-t border-white/[0.08] pt-10">
          <p className="font-display text-xl tracking-wide text-[#e8ecf2]">LARA PRIME ✦</p>
          <p className="mt-2 text-sm leading-6 text-[#9aa3b2]">Atlas’ı daha kişisel kullan.</p>
          <div className="mt-6">
            <CtaBlock compact />
          </div>
        </section>
      </main>
    </CosmicShell>
  );
}

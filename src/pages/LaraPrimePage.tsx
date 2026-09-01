/**
 * Lara Prime membership surface — user-facing paid membership for Atlas.
 * Internal plan remains `premium`; checkout/entitlements stay server-authoritative.
 * Only capabilities that exist in the current product are described here.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  ImagePlus,
  Lock,
  MessageCircle,
  Mic,
  Minus,
  ShieldCheck,
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
import {
  ATLAS_SESSION_CHANGED_EVENT,
  ensureAtlasSession,
  type AtlasSessionInfo,
} from '../utils/atlas-session';

type CheckoutUiState = 'idle' | 'initializing' | 'redirecting' | 'dry-run' | 'error';

/** Server defaults — see server/usage/chat-usage.js and server/memory-intents.js */
const FREE_DAILY_MESSAGES = 40;
const PRIME_DAILY_MESSAGES = 200;
const FREE_MEMORY_DEPTH = 3;
const PRIME_MEMORY_DEPTH = 12;

const BENEFIT_CARDS = [
  {
    icon: Sparkles,
    eyebrow: 'Kişisel merkez',
    title: 'Atlas’ın sana ait alanı',
    body: 'Profilin, günlük sinyallerin ve Prime katmanların tek bir kişisel merkezde buluşur.',
  },
  {
    icon: Clock3,
    eyebrow: 'Bugün görünümü',
    title: 'Günün tek ekranda',
    body: 'Kişisel verilerin, mevcut sembolik katmanların ve güncel check-in bilgilerin birlikte görünür.',
  },
  {
    icon: MessageCircle,
    eyebrow: 'Günlük check-in',
    title: 'O günkü halini bağlama ekle',
    body: 'Enerji, odak ve niyetini kısa bir akışla kaydet; Atlas günün bağlamını daha iyi taşısın.',
  },
  {
    icon: CalendarDays,
    eyebrow: '7 günlük görünüm',
    title: 'Yakın dönemi birlikte gör',
    body: 'Önündeki yedi günün kişisel sinyallerini dağınık parçalar yerine düzenli bir akışta izle.',
  },
  {
    icon: Mic,
    eyebrow: 'Lara Voice',
    title: 'Atlas’ı Lara’nın sesiyle dinle',
    body: 'Türkçe ve İngilizce sesli yanıt, mevcut konuşma akışına doğrudan bağlanır.',
  },
  {
    icon: ImagePlus,
    eyebrow: 'Görsel ile analiz',
    title: 'Görseli konuşmanın içine al',
    body: 'JPEG, PNG veya WEBP görselleri mevcut sohbet bağlamıyla birlikte Atlas’a dahil edebilirsin.',
  },
  {
    icon: MessageCircle,
    eyebrow: 'Daha yüksek kullanım',
    title: `Günde ${PRIME_DAILY_MESSAGES} mesaja kadar`,
    body: `Atlas Free günde ${FREE_DAILY_MESSAGES} mesaj sunar; Prime daha uzun ve kesintisiz kullanım alanı açar.`,
  },
  {
    icon: Sparkles,
    eyebrow: 'Daha derin kişisel bağlam',
    title: 'Geçmiş bağlam daha uzun taşınır',
    body: `Free plandaki ${FREE_MEMORY_DEPTH} notluk bağlam derinliği Prime’da ${PRIME_MEMORY_DEPTH} nota kadar genişler.`,
  },
] as const;

type ComparisonRow = {
  label: string;
  free: string;
  prime: string;
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
    label: 'Kişisel bağlam derinliği',
    free: `${FREE_MEMORY_DEPTH} not`,
    prime: `${PRIME_MEMORY_DEPTH} not`,
  },
  { label: 'Lara Voice', free: 'Yok', prime: 'Var' },
  { label: 'Görsel ile analiz', free: 'Yok', prime: 'Var' },
  { label: 'Kişisel merkez', free: 'Yok', prime: 'Var' },
  { label: 'Günlük check-in', free: 'Yok', prime: 'Var' },
  { label: '7 günlük görünüm', free: 'Yok', prime: 'Var' },
];

function Availability({ value, prime = false }: { value: string; prime?: boolean }) {
  if (value === 'Yok') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[#777f8d]">
        <Minus size={13} aria-hidden /> Yok
      </span>
    );
  }
  if (value === 'Var') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Check size={13} className={prime ? 'text-[#d8c48b]' : 'text-[#9aa3b2]'} aria-hidden /> Var
      </span>
    );
  }
  return <span>{value}</span>;
}

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
        setError('Ödeme şu anda başlatılamıyor. Lütfen kısa süre sonra tekrar deneyin.');
        checkoutLock.current = false;
        return;
      }
      if (result.dryRun || !result.liveCheckoutEnabled) {
        setCheckoutState('dry-run');
        setMessage('Ödeme sistemi şu anda hazır değil. Lütfen kısa süre sonra tekrar deneyin.');
        checkoutLock.current = false;
        return;
      }
      const url = result.paymentPageUrl;
      if (!isSafePaymentPageUrl(url)) {
        setCheckoutState('error');
        setError('Güvenli ödeme sayfası şu anda açılamıyor. Lütfen kısa süre sonra tekrar deneyin.');
        checkoutLock.current = false;
        return;
      }
      setCheckoutState('redirecting');
      setMessage('Güvenli ödeme sayfasına yönlendiriliyorsun…');
      window.location.assign(String(url));
    } catch {
      setCheckoutState('error');
      setError('Ödeme şu anda başlatılamıyor. Lütfen kısa süre sonra tekrar deneyin.');
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
        <div className={compact ? '' : 'max-w-xl'}>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#c9b37a]/25 bg-[#c9b37a]/[0.07] px-3 py-1.5 text-xs font-medium text-[#e6d7aa]">
            <Check size={13} aria-hidden /> Lara Prime aktif
          </div>
          <p className="mt-4 max-w-md text-sm leading-6 text-[#a7afbc]">
            Kişisel merkezin ve Prime deneyimin hazır. Günlük akışına kaldığın yerden devam edebilirsin.
          </p>
          <Link
            to="/prime"
            className="atlas-focus mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#d5c184]/35 bg-[#d5c184]/12 px-5 py-3.5 text-sm font-medium text-[#f2ead4] transition hover:bg-[#d5c184]/18 sm:w-auto"
          >
            Kişisel merkeze git <ChevronRight size={15} aria-hidden />
          </Link>
        </div>
      );
    }

    return (
      <div className={compact ? '' : 'max-w-xl'}>
        {priceLabel ? (
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="font-display text-3xl tracking-[-0.02em] text-[#f1f2f4] sm:text-4xl">{priceLabel}</p>
            <p className="pb-1 text-[11px] uppercase tracking-[0.16em] text-[#c9b37a]/70">aylık üyelik</p>
          </div>
        ) : (
          <p className="text-sm text-[#9aa3b2]">Fiyat yükleniyor…</p>
        )}

        {isAccount ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCheckout}
            className="atlas-focus mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#d5c184]/40 bg-[#d5c184]/14 px-5 py-3.5 text-sm font-medium tracking-wide text-[#f4ecd7] shadow-[0_16px_48px_rgba(201,179,122,0.06)] transition hover:bg-[#d5c184]/20 disabled:cursor-wait disabled:opacity-55 sm:w-auto sm:min-w-[15rem]"
          >
            {ctaLabel}
            {!busy ? <ChevronRight size={15} aria-hidden /> : null}
          </button>
        ) : (
          <button
            type="button"
            onClick={onGuestCta}
            className="atlas-focus mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#d5c184]/40 bg-[#d5c184]/14 px-5 py-3.5 text-sm font-medium tracking-wide text-[#f4ecd7] shadow-[0_16px_48px_rgba(201,179,122,0.06)] transition hover:bg-[#d5c184]/20 sm:w-auto sm:min-w-[15rem]"
          >
            Lara Prime’a Geç <ChevronRight size={15} aria-hidden />
          </button>
        )}

        <p className="mt-3 text-[12px] leading-5 text-[#838b98]">
          {isAccount
            ? 'Üyeliğin mevcut Atlas hesabına tanımlanır.'
            : 'Devam etmek için giriş yap. Sonrasında otomatik olarak bu sayfaya dönersin.'}
        </p>

        {message ? <p className="mt-4 text-[12px] leading-5 text-[#a7afbc]">{message}</p> : null}
        {error ? <p className="mt-4 text-[12px] leading-5 text-rose-300/90">{error}</p> : null}
      </div>
    );
  }

  return (
    <CosmicShell transparentNav>
      <main className="relative mx-auto min-h-[100dvh] max-w-6xl overflow-hidden px-4 pb-28 pt-28 sm:px-6 sm:pt-32 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-20 h-[34rem] w-[58rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,179,122,0.08)_0%,rgba(201,179,122,0.025)_34%,transparent_70%)] blur-3xl"
        />

        {/* Hero */}
        <section className="relative grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-16">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.34em] text-[#c9b37a]/72">
              Cosmic Simya · Atlas
            </p>
            <h1 className="mt-6 font-display text-[clamp(3rem,8vw,6.3rem)] font-medium leading-[0.88] tracking-[-0.055em] text-[#f2f3f5]">
              LARA PRIME
            </h1>
            <p className="mt-7 max-w-2xl font-display text-[clamp(1.35rem,3vw,2rem)] leading-[1.18] tracking-[-0.02em] text-[#e4e6ea]">
              Atlas’ın daha kişisel, daha derin ve günün içinde seninle devam eden premium katmanı.
            </p>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[#9da5b1] sm:text-base sm:leading-8">
              Kişisel merkez, günlük ritim, daha derin bağlam, Lara Voice ve görsel analiz; tek bir sürekli deneyimde birleşir.
            </p>
          </div>

          <div className="rounded-2xl border border-[#c9b37a]/20 bg-[linear-gradient(145deg,rgba(201,179,122,0.075),rgba(255,255,255,0.018)_50%,rgba(0,0,0,0.1))] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-7">
            <CtaBlock />
          </div>
        </section>

        {/* Benefits */}
        <section className="relative mt-24 border-t border-white/[0.07] pt-14 sm:mt-28 sm:pt-16">
          <div className="max-w-3xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/72">Lara Prime ile ne açılır?</p>
            <h2 className="mt-4 font-display text-3xl tracking-[-0.025em] text-[#eef0f3] sm:text-4xl">
              Daha fazla özellik değil. Daha bütünlüklü bir Atlas deneyimi.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#969eaa] sm:text-[15px]">
              Prime, Atlas’ın farklı yüzeylerini aynı kişisel akışta buluşturur. Böylece her kullanım tek başına kalmaz; günün, geçmiş bağlamın ve kişisel merkezin birbirine bağlanır.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFIT_CARDS.map(({ icon: Icon, eyebrow, title, body }) => (
              <article
                key={eyebrow}
                className="group min-h-[13.5rem] rounded-2xl border border-white/[0.075] bg-[linear-gradient(145deg,rgba(255,255,255,0.028),rgba(255,255,255,0.012))] p-5 transition duration-300 hover:border-[#c9b37a]/20 hover:bg-[#c9b37a]/[0.025] sm:p-6"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#c9b37a]/18 bg-[#c9b37a]/[0.045]">
                  <Icon size={16} className="text-[#d3c08a]/85" aria-hidden />
                </div>
                <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.18em] text-[#c9b37a]/68">{eyebrow}</p>
                <h3 className="mt-2 text-[15px] font-medium leading-6 text-[#e5e8ec]">{title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-[#929aa7]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Experience shift */}
        <section className="mt-24 border-t border-white/[0.07] pt-14 sm:mt-28 sm:pt-16">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/72">Deneyim nasıl değişir?</p>
              <h2 className="mt-4 font-display text-3xl tracking-[-0.025em] text-[#eef0f3] sm:text-4xl">
                Free başlatır. Prime süreklilik kazandırır.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-2xl border border-white/[0.075] bg-white/[0.016] p-6">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8e96a3]">Atlas Free</p>
                <p className="mt-4 font-display text-2xl text-[#e5e8ec]">Güçlü başlangıç</p>
                <p className="mt-3 text-sm leading-7 text-[#929aa7]">
                  Atlas ile konuşur, sembolik analizleri kullanır ve temel deneyimin tamamına güçlü bir giriş yaparsın.
                </p>
              </article>
              <article className="rounded-2xl border border-[#c9b37a]/20 bg-[#c9b37a]/[0.035] p-6 shadow-[0_24px_80px_rgba(201,179,122,0.035)]">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#d3c08a]/82">Lara Prime</p>
                <p className="mt-4 font-display text-2xl text-[#f0f1f3]">Kişisel süreklilik</p>
                <p className="mt-3 text-sm leading-7 text-[#a3aab5]">
                  Atlas daha fazla kişisel bağlam taşır; günlük ritmin, kişisel merkezin ve Prime yüzeylerin tek bir devamlı deneyime dönüşür.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="mt-24 border-t border-white/[0.07] pt-14 sm:mt-28 sm:pt-16">
          <div className="max-w-3xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/72">Free vs Prime</p>
            <h2 className="mt-4 font-display text-3xl tracking-[-0.025em] text-[#eef0f3] sm:text-4xl">İki plan. İki farklı kullanım derinliği.</h2>
            <p className="mt-4 text-sm leading-7 text-[#969eaa] sm:text-[15px]">
              Atlas Free temel deneyimi korur. Lara Prime bunun üzerine kişisel merkez, daha yüksek kullanım ve daha derin süreklilik ekler.
            </p>
          </div>

          <div className="mt-9 hidden overflow-hidden rounded-2xl border border-white/[0.08] md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.018] text-[11px] uppercase tracking-[0.14em] text-[#858d99]">
                  <th className="w-[46%] px-6 py-4 font-medium">Deneyim</th>
                  <th className="w-[24%] px-6 py-4 font-medium">Atlas Free</th>
                  <th className="w-[30%] border-l border-[#c9b37a]/10 bg-[#c9b37a]/[0.025] px-6 py-4 font-medium text-[#d4c18b]">Lara Prime</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.055] last:border-0">
                    <td className="px-6 py-4 text-[#d9dde3]">{row.label}</td>
                    <td className="px-6 py-4 text-[#939ba8]">
                      <Availability value={row.free} />
                    </td>
                    <td className="border-l border-[#c9b37a]/10 bg-[#c9b37a]/[0.018] px-6 py-4 text-[#e8e9ec]">
                      <Availability value={row.prime} prime />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-3 md:hidden">
            {COMPARISON_ROWS.map((row) => (
              <article key={row.label} className="rounded-xl border border-white/[0.075] bg-white/[0.014] p-4">
                <p className="text-sm font-medium leading-6 text-[#dde0e5]">{row.label}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-lg border border-white/[0.06] p-3 text-[#8f97a4]">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.13em] text-[#747c88]">Free</p>
                    <Availability value={row.free} />
                  </div>
                  <div className="rounded-lg border border-[#c9b37a]/16 bg-[#c9b37a]/[0.025] p-3 text-[#e5e6e9]">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.13em] text-[#c9b37a]/75">Prime</p>
                    <Availability value={row.prime} prime />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section className="mt-24 border-t border-white/[0.07] pt-14 sm:mt-28 sm:pt-16">
          <div className="grid gap-9 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <div className="flex items-center gap-2.5 text-[#d3c08a]">
                <ShieldCheck size={17} aria-hidden />
                <p className="text-[11px] font-medium uppercase tracking-[0.24em]">Mahremiyet ve kontrol</p>
              </div>
              <h2 className="mt-4 font-display text-3xl tracking-[-0.025em] text-[#eef0f3] sm:text-4xl">
                Üyelik değişir. Geçmişin silinmez.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.075] bg-white/[0.014] p-5">
                <Lock size={15} className="text-[#c9b37a]/75" aria-hidden />
                <p className="mt-4 text-sm font-medium text-[#dfe2e6]">Yetkiler hesabına bağlıdır</p>
                <p className="mt-2 text-[13px] leading-6 text-[#929aa7]">Prime erişimi yalnızca üyeliğin açık olduğu hesapta kullanılabilir.</p>
              </div>
              <div className="rounded-xl border border-white/[0.075] bg-white/[0.014] p-5">
                <Check size={15} className="text-[#c9b37a]/75" aria-hidden />
                <p className="mt-4 text-sm font-medium text-[#dfe2e6]">Kontrol sende kalır</p>
                <p className="mt-2 text-[13px] leading-6 text-[#929aa7]">Planın değiştiğinde erişim seviyesi değişir; mevcut hesabın ve geçmiş kullanımın korunur.</p>
              </div>
              <div className="rounded-xl border border-white/[0.075] bg-white/[0.014] p-5 sm:col-span-2">
                <Sparkles size={15} className="text-[#c9b37a]/75" aria-hidden />
                <p className="mt-4 text-sm font-medium text-[#dfe2e6]">Kişisel deneyim, izin sınırları içinde çalışır</p>
                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#929aa7]">Prime yüzeyleri ve ek yetkiler planına göre açılır; üyelik sona erdiğinde hesabın Atlas Free deneyimine döner.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative mt-24 overflow-hidden rounded-3xl border border-[#c9b37a]/20 bg-[linear-gradient(135deg,rgba(201,179,122,0.075),rgba(255,255,255,0.018)_55%,rgba(201,179,122,0.025))] p-6 shadow-[0_36px_120px_rgba(0,0,0,0.28)] sm:mt-28 sm:p-9 lg:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#c9b37a]/10" />
          <div className="relative grid gap-9 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-14">
            <div className="max-w-2xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/72">Lara Prime</p>
              <h2 className="mt-4 font-display text-3xl leading-[1.08] tracking-[-0.03em] text-[#f0f1f3] sm:text-4xl">
                Atlas’ın kişisel premium katmanını aç.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#9da5b1] sm:text-[15px]">
                Kişisel merkez, günlük ritim, Lara Voice, görsel analiz, daha yüksek kullanım ve daha derin bağlam tek üyelikte.
              </p>
            </div>
            <div className="min-w-0 lg:min-w-[18rem]">
              <CtaBlock compact />
            </div>
          </div>
        </section>
      </main>
    </CosmicShell>
  );
}

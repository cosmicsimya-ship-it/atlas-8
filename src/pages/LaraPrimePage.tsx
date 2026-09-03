/**
 * Lara Prime PUBLIC sales page — explains, reassures, compares, converts.
 * This is NOT the logged-in Prime member area (see PrimePage.tsx at /prime).
 * No member-dashboard screens are reproduced here; only descriptive copy.
 *
 * Internal plan remains `premium`; checkout/entitlements stay server-authoritative.
 * Only capabilities that exist in the current product are described as
 * available today — everything else is explicitly labeled upcoming.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  History,
  Lock,
  Minus,
  ShieldCheck,
  Sparkles,
  Users,
  Waves,
} from 'lucide-react';

import CosmicShell from '../components/cosmic/CosmicShell';
import SiteFooter from '../components/landing/SiteFooter';
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
import { trackEvent } from '../services/atlas-analytics';
import { faqItems } from '../data/trust-content';

type CheckoutUiState = 'idle' | 'initializing' | 'redirecting' | 'dry-run' | 'error';

/** Server defaults — see server/usage/chat-usage.js and server/memory-intents.js */
const FREE_DAILY_MESSAGES = 40;
const PRIME_DAILY_MESSAGES = 200;
const FREE_MEMORY_DEPTH = 3;
const PRIME_MEMORY_DEPTH = 12;

/** "₺299/ay karşılığında ne alıyorsun?" — concrete, not vague. */
const VALUE_ITEMS = [
  {
    title: 'Kişisel Prime merkezi',
    body: 'Bugün görünümü, günlük check-in ve 7 günlük görünüm tek bir kişisel merkezde.',
  },
  {
    title: 'Atlas ile daha derin, sürekli bağlam',
    body: 'Geçmiş konuşmaların ve kaydettiğin notlar yeni sohbetlere taşınır.',
  },
  {
    title: 'Lara Voice',
    body: 'Türkçe ve İngilizce sesli yanıt, mevcut konuşma akışına doğrudan bağlanır.',
  },
  {
    title: 'Görsel ile analiz',
    body: 'JPEG, PNG veya WEBP görselleri konuşmana dahil edebilirsin.',
  },
  {
    title: 'Daha yüksek günlük kullanım',
    body: `Free günde ${FREE_DAILY_MESSAGES} mesaj sunar; Prime ${PRIME_DAILY_MESSAGES} mesaja kadar çıkar.`,
  },
  {
    title: 'Üye önceliği',
    body: 'Frequency Library ve Prime Rooms açıldığında bunlara ilk erişen Prime üyeleri olur.',
  },
] as const;

type PillarStatus = 'now' | 'soon' | 'later';

const STATUS_LABEL: Record<PillarStatus, string> = {
  now: 'Mevcut',
  soon: 'Yakında · Faz 1',
  later: 'Sonraki faz',
};

function StatusTag({ status }: { status: PillarStatus }) {
  const dotClass = status === 'now' ? 'bg-[#e8ecf2]' : 'bg-[#8eeafa]/70';
  const textClass = status === 'now' ? 'text-[#c7cdd6]' : 'text-[#9fd3e6]';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] ${textClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

const PILLARS = [
  {
    icon: Compass,
    status: 'now' as PillarStatus,
    title: 'My Prime',
    body: 'Bugün görünümü, günlük check-in, 7 günlük görünüm, geçmiş konuşmaların ve profilin — kişisel merkezin burada. İlerleyen dönemde Arşiv ve Favoriler ile genişleyecek.',
  },
  {
    icon: Waves,
    status: 'soon' as PillarStatus,
    title: 'Frequency Library',
    body: 'Odaklanma, ritüel, yansıma ve atmosfer için küratörlü ses ve müzik deneyimleri. Koleksiyonlar, kaydetme ve Atlas bağlantılı öneriler yayına girdikçe eklenecek.',
  },
  {
    icon: Users,
    status: 'later' as PillarStatus,
    title: 'Prime Rooms',
    body: 'Astroloji, döngüler, rüyalar, semboller ve frekans temalı küçük, moderasyonlu odalar — gürültülü bir sosyal ağ değil, seçilmiş bir topluluk.',
  },
  {
    icon: Sparkles,
    status: 'now' as PillarStatus,
    title: 'Atlas — bağlayıcı katman',
    body: 'Atlas ayrı bir Prime chatbotu değildir. Kişisel bağlamını, günlük ve haftalık sentezini taşır; ileride Frequency Library ve Prime Rooms’u da aynı akışa bağlayacak.',
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
  { label: 'Kişisel merkez (My Prime)', free: 'Yok', prime: 'Var' },
  { label: 'Günlük check-in', free: 'Yok', prime: 'Var' },
  { label: '7 günlük görünüm', free: 'Yok', prime: 'Var' },
];

function Availability({ value, prime = false }: { value: string; prime?: boolean }) {
  if (value === 'Yok') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[#6f7886]">
        <Minus size={13} aria-hidden /> Yok
      </span>
    );
  }
  if (value === 'Var') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Check size={13} className={prime ? 'text-[#bcd6e6]' : 'text-[#9aa3b2]'} aria-hidden /> Var
      </span>
    );
  }
  return <span>{value}</span>;
}

/** Prime, günlük/haftalık ritim örnekleri — açıklayıcı metin, sahte ekran görüntüsü değil. */
const RHYTHM_EXAMPLES = [
  {
    icon: Clock3,
    eyebrow: 'Bugün',
    body: 'Güne başladığında güncel sembolik katmanlarını ve check-in’ini tek ekranda görürsün.',
  },
  {
    icon: History,
    eyebrow: 'Haftalık',
    body: 'Önündeki 7 günün kişisel sinyallerini dağınık parçalar yerine tek bir akışta izlersin.',
  },
  {
    icon: Sparkles,
    eyebrow: 'Süreklilik',
    body: 'Kaydettiğin bağlam ve önceki konuşmaların, yeni bir sohbete başladığında Atlas tarafından hatırlanır.',
  },
] as const;

const AVAILABLE_NOW = [
  'My Prime kişisel merkezi',
  'Günlük check-in ve 7 günlük görünüm',
  'Atlas ile sürekli bağlam ve hafıza',
  'Lara Voice (Türkçe / İngilizce)',
  'Görsel ile analiz',
  'Daha yüksek günlük kullanım',
];

const COMING_NEXT = [
  { label: 'Frequency Library', note: 'Faz 1' },
  { label: 'Arşiv / Favoriler', note: 'My Prime içinde' },
  { label: 'Prime Rooms', note: 'sonraki faz' },
];

const FAQ_PREVIEW_QUESTIONS = [
  'Lara Prime nedir?',
  'Üyelik aylık mı?',
  'Nasıl iptal ederim?',
  'Free ve Prime arasındaki fark nedir?',
];
const FAQ_PREVIEW = FAQ_PREVIEW_QUESTIONS.map((q) => faqItems.find((item) => item.q === q)).filter(
  (item): item is (typeof faqItems)[number] => Boolean(item),
);

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
    trackEvent('prime_viewed');
  }, []);

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
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[#e5e8ec]">
            <Check size={13} aria-hidden /> Lara Prime aktif
          </div>
          <p className="mt-4 max-w-md text-sm leading-6 text-[#a7afbc]">
            Kişisel merkezin ve Prime deneyimin hazır. Günlük akışına kaldığın yerden devam edebilirsin.
          </p>
          <Link
            to="/prime"
            className="atlas-focus mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#e8ecf2] px-6 py-3.5 text-sm font-semibold text-[#050608] transition hover:bg-white sm:w-auto"
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
            <p className="pb-1 text-[11px] uppercase tracking-[0.16em] text-[#8b93a3]">aylık üyelik</p>
          </div>
        ) : (
          <p className="text-sm text-[#9aa3b2]">Fiyat yükleniyor…</p>
        )}

        {isAccount ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCheckout}
            className="atlas-btn-primary mt-6 min-h-[3.25rem] w-full px-8 text-[15px] disabled:cursor-wait disabled:opacity-55 sm:w-auto sm:min-w-[15rem]"
          >
            {ctaLabel}
            {!busy ? <ChevronRight size={15} aria-hidden className="ml-1.5" /> : null}
          </button>
        ) : (
          <button
            type="button"
            onClick={onGuestCta}
            className="atlas-btn-primary mt-6 min-h-[3.25rem] w-full px-8 text-[15px] sm:w-auto sm:min-w-[15rem]"
          >
            Lara Prime’a Geç <ChevronRight size={15} aria-hidden className="ml-1.5" />
          </button>
        )}

        <p className="mt-3 text-[12px] leading-5 text-[#838b98]">
          {isAccount
            ? 'Üyeliğin mevcut Atlas hesabına tanımlanır.'
            : 'Devam etmek için giriş yap. Sonrasında otomatik olarak bu sayfaya dönersin.'}
        </p>
        <p className="mt-2 text-[12px] leading-5 text-[#6f7886]">
          Aylık otomatik yenilenir. İstediğin zaman iptal edebilirsin —{' '}
          <Link to="/iade-iptal" className="text-[#8fa3b3] underline-offset-4 hover:underline">
            yenileme ve iptal koşulları
          </Link>
          .
        </p>

        {message ? <p className="mt-4 text-[12px] leading-5 text-[#a7afbc]">{message}</p> : null}
        {error ? <p className="mt-4 text-[12px] leading-5 text-rose-300/90">{error}</p> : null}
      </div>
    );
  }

  return (
    <CosmicShell transparentNav>
      <main className="relative mx-auto max-w-6xl overflow-hidden px-4 pb-28 pt-28 sm:px-6 sm:pt-32 lg:px-8">
        {/* Hero — single composition, North Star kept quiet (SymbolicBackground only),
            one restrained blue ambient glow instead of a competing gold field. */}
        <section className="relative pt-4">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 left-1/2 h-[26rem] w-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(142,234,250,0.055)_0%,rgba(142,234,250,0.015)_38%,transparent_72%)] blur-3xl"
          />
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8eeafa]/70 motion-safe:animate-pulse" aria-hidden="true" />
              <span className="text-[11px] font-medium tracking-[0.16em] text-[#c7cdd6]">LARA PRIME</span>
            </div>
            <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.32em] text-[#c9b37a]/70">
              Cosmic Simya · Atlas
            </p>
            <h1 className="mt-4 font-display text-[clamp(2.1rem,4.4vw,3.4rem)] font-medium leading-[1.06] tracking-[-0.02em] text-[#f2f3f5]">
              Atlas’ın kişisel ve sürekli katmanı.
            </h1>
            <p className="mt-5 max-w-xl font-display text-[clamp(1.05rem,1.9vw,1.3rem)] leading-[1.42] tracking-[-0.005em] text-[#c7cdd6]">
              Kişisel merkezin, Atlas’la kurduğun derin bağlamın ve zamanla açılacak yeni deneyimlerin buluştuğu aylık üyelik alanı.
            </p>

            <div className="mt-10 border-t border-white/[0.08] pt-8">
              <CtaBlock />
            </div>
          </div>
        </section>

        {/* What you get for ₺299/month */}
        <section className="relative mt-24 border-t border-white/[0.07] pt-14 sm:mt-28 sm:pt-16">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#8eeafa]/60">Neye sahip olursun?</p>
            <h2 className="mt-4 font-display text-3xl tracking-[-0.025em] text-[#eef0f3] sm:text-4xl">
              ₺299/ay karşılığında ne alıyorsun?
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#969eaa] sm:text-[15px]">Net bir liste — vaat değil, elindeki karşılık:</p>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            {VALUE_ITEMS.map((item) => (
              <div
                key={item.title}
                className="flex gap-3.5 rounded-xl border border-white/[0.07] bg-white/[0.014] p-5"
              >
                <Check size={16} className="mt-0.5 flex-none text-[#9aa3b2]" aria-hidden />
                <div>
                  <p className="text-[14.5px] font-medium leading-6 text-[#e5e8ec]">{item.title}</p>
                  <p className="mt-1.5 text-[13px] leading-6 text-[#929aa7]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Four pillars */}
        <section className="relative mt-24 border-t border-white/[0.07] pt-14 sm:mt-28 sm:pt-16">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#8eeafa]/60">Mimari</p>
            <h2 className="mt-4 font-display text-3xl tracking-[-0.025em] text-[#eef0f3] sm:text-4xl">
              Lara Prime dört katmandan oluşur.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#969eaa] sm:text-[15px]">
              Bazıları bugün aktif, bazıları önümüzdeki aylarda açılacak. Hepsi aynı kişisel merkezde buluşur.
            </p>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            {PILLARS.map(({ icon: Icon, status, title, body }) => (
              <article
                key={title}
                className="rounded-2xl border border-white/[0.075] bg-white/[0.016] p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03]">
                    <Icon size={16} className="text-[#c7cdd6]" aria-hidden />
                  </div>
                  <StatusTag status={status} />
                </div>
                <h3 className="mt-5 font-display text-xl text-[#eef0f3]">{title}</h3>
                <p className="mt-2.5 text-[13.5px] leading-6 text-[#929aa7]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Free vs Prime */}
        <section className="mt-24 border-t border-white/[0.07] pt-14 sm:mt-28 sm:pt-16">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#8eeafa]/60">Free vs Prime</p>
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
                  <th className="w-[30%] border-l border-white/[0.06] bg-white/[0.02] px-6 py-4 font-medium text-[#c7cdd6]">Lara Prime</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.055] last:border-0">
                    <td className="px-6 py-4 text-[#d9dde3]">{row.label}</td>
                    <td className="px-6 py-4 text-[#939ba8]">
                      <Availability value={row.free} />
                    </td>
                    <td className="border-l border-white/[0.06] bg-white/[0.012] px-6 py-4 text-[#e8e9ec]">
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
                  <div className="rounded-lg border border-white/[0.09] bg-white/[0.02] p-3 text-[#e5e6e9]">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.13em] text-[#9fb4c2]">Prime</p>
                    <Availability value={row.prime} prime />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-6 flex items-center gap-2 text-[12.5px] text-[#7c8492]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8eeafa]/60" aria-hidden="true" />
            Frequency Library ve Prime Rooms henüz bu karşılaştırmaya dahil değil — yayına girdiklerinde Prime üyeliğine eklenecekler.
          </p>
        </section>

        {/* Sample rhythm */}
        <section className="mt-24 border-t border-white/[0.07] pt-14 sm:mt-28 sm:pt-16">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#8eeafa]/60">Günlük ritim</p>
            <h2 className="mt-4 font-display text-3xl tracking-[-0.025em] text-[#eef0f3] sm:text-4xl">
              Prime’da bir gün, bir hafta nasıl görünür?
            </h2>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {RHYTHM_EXAMPLES.map(({ icon: Icon, eyebrow, body }) => (
              <div key={eyebrow} className="rounded-2xl border border-white/[0.075] bg-white/[0.014] p-6">
                <Icon size={16} className="text-[#9aa3b2]" aria-hidden />
                <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-[#8b93a3]">{eyebrow}</p>
                <p className="mt-2 text-[13.5px] leading-6 text-[#a7afbc]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Available now vs coming next — mandatory transparency */}
        <section className="mt-24 border-t border-white/[0.07] pt-14 sm:mt-28 sm:pt-16">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#8eeafa]/60">Şeffaflık</p>
            <h2 className="mt-4 font-display text-3xl tracking-[-0.025em] text-[#eef0f3] sm:text-4xl">
              Şu an ne var, yakında ne geliyor?
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#969eaa] sm:text-[15px]">
              Lara Prime aşamalı olarak büyüyor. Bugün elinde olanla geliştirilmekte olanı net tutuyoruz.
            </p>
          </div>

          <div className="mt-9 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.018] p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#c7cdd6]">Şu an aktif</p>
              <ul className="mt-5 space-y-3">
                {AVAILABLE_NOW.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-6 text-[#d3d7dd]">
                    <Check size={14} className="mt-1 flex-none text-[#9aa3b2]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-transparent p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9fd3e6]">Yakında</p>
              <ul className="mt-5 space-y-3">
                {COMING_NEXT.map((item) => (
                  <li key={item.label} className="flex items-start justify-between gap-2.5 text-[13.5px] leading-6 text-[#93a0ab]">
                    <span className="flex items-start gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full border border-[#8eeafa]/50" aria-hidden="true" />
                      {item.label}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.1em] text-[#6f7886]">{item.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Trust / billing / cancellation / support */}
        <section className="mt-24 border-t border-white/[0.07] pt-14 sm:mt-28 sm:pt-16">
          <div className="grid gap-9 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <div className="flex items-center gap-2.5 text-[#c7cdd6]">
                <ShieldCheck size={17} aria-hidden />
                <p className="text-[11px] font-medium uppercase tracking-[0.24em]">Mahremiyet ve kontrol</p>
              </div>
              <h2 className="mt-4 font-display text-3xl tracking-[-0.025em] text-[#eef0f3] sm:text-4xl">
                Üyelik değişir. Geçmişin silinmez.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.075] bg-white/[0.014] p-5">
                <Lock size={15} className="text-[#9aa3b2]" aria-hidden />
                <p className="mt-4 text-sm font-medium text-[#dfe2e6]">Yetkiler hesabına bağlıdır</p>
                <p className="mt-2 text-[13px] leading-6 text-[#929aa7]">Prime erişimi yalnızca üyeliğin açık olduğu hesapta kullanılabilir.</p>
              </div>
              <div className="rounded-xl border border-white/[0.075] bg-white/[0.014] p-5">
                <Check size={15} className="text-[#9aa3b2]" aria-hidden />
                <p className="mt-4 text-sm font-medium text-[#dfe2e6]">Kontrol sende kalır</p>
                <p className="mt-2 text-[13px] leading-6 text-[#929aa7]">Planın değiştiğinde erişim seviyesi değişir; mevcut hesabın ve geçmiş kullanımın korunur.</p>
              </div>
              <div className="rounded-xl border border-white/[0.075] bg-white/[0.014] p-5 sm:col-span-2">
                <Sparkles size={15} className="text-[#9aa3b2]" aria-hidden />
                <p className="mt-4 text-sm font-medium text-[#dfe2e6]">Kişisel deneyim, izin sınırları içinde çalışır</p>
                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#929aa7]">Prime yüzeyleri ve ek yetkiler planına göre açılır; üyelik sona erdiğinde hesabın Atlas Free deneyimine döner.</p>
              </div>
            </div>
          </div>

          {/* Subscription disclosure — required near billing content */}
          <div className="mt-9 rounded-2xl border border-white/[0.08] bg-white/[0.016] p-6 sm:p-7">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b93a3]">Üyelik özeti</p>
            <p className="mt-3 max-w-2xl text-[13.5px] leading-7 text-[#c2c7cf]">
              {priceLabel ?? `${'₺299'} / ay`} olarak otomatik yenilenen bir üyeliktir. İstediğin zaman iptal edebilirsin;
              iptal mevcut ödenmiş dönemin sonunda geçerli olur. Faturalandırma sorunları için{' '}
              <Link to="/destek" className="text-[#9fb4c2] underline-offset-4 hover:underline">
                Destek
              </Link>{' '}
              sayfasını kullanabilirsin.
            </p>
          </div>

          <nav aria-label="Üyelik şeffaflığı ve destek" className="mt-8 border-t border-white/[0.06] pt-6">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px]">
              <li>
                <Link to="/uyelik-sozlesmesi" className="site-focus text-[#9aa3b2] underline-offset-4 hover:text-[#c7cdd6] hover:underline">
                  Üyelik Sözleşmesi
                </Link>
              </li>
              <li>
                <Link to="/iade-iptal" className="site-focus text-[#9aa3b2] underline-offset-4 hover:text-[#c7cdd6] hover:underline">
                  İade ve İptal
                </Link>
              </li>
              <li>
                <Link to="/gizlilik" className="site-focus text-[#9aa3b2] underline-offset-4 hover:text-[#c7cdd6] hover:underline">
                  Gizlilik / KVKK
                </Link>
              </li>
              <li>
                <Link to="/sss" className="site-focus text-[#9aa3b2] underline-offset-4 hover:text-[#c7cdd6] hover:underline">
                  SSS
                </Link>
              </li>
              <li>
                <Link to="/destek" className="site-focus text-[#9aa3b2] underline-offset-4 hover:text-[#c7cdd6] hover:underline">
                  Destek
                </Link>
              </li>
              <li>
                <Link to="/iletisim" className="site-focus text-[#9aa3b2] underline-offset-4 hover:text-[#c7cdd6] hover:underline">
                  İletişim
                </Link>
              </li>
            </ul>
          </nav>
        </section>

        {/* FAQ preview */}
        <section className="mt-24 border-t border-white/[0.07] pt-14 sm:mt-28 sm:pt-16">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#8eeafa]/60">SSS</p>
            <h2 className="mt-4 font-display text-3xl tracking-[-0.025em] text-[#eef0f3] sm:text-4xl">Sık sorulan sorular</h2>
          </div>

          <div className="mt-9 divide-y divide-white/[0.06] border-t border-white/[0.06]">
            {FAQ_PREVIEW.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="atlas-focus flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-medium leading-6 text-[#e5e8ec] marker:content-none">
                  <span>{item.q}</span>
                  <ChevronDown
                    size={16}
                    className="mt-0.5 flex-none text-[#8b93a3] transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-3 max-w-2xl text-[13.5px] leading-7 text-[#929aa7]">{item.a}</p>
              </details>
            ))}
          </div>

          <Link
            to="/sss"
            className="site-focus mt-6 inline-flex items-center gap-1.5 text-[13px] text-[#9fb4c2] underline-offset-4 hover:underline"
          >
            Tüm soruları gör <ChevronRight size={13} aria-hidden />
          </Link>
        </section>

        {/* Final CTA */}
        <section className="relative mt-24 overflow-hidden rounded-3xl border border-white/[0.09] bg-white/[0.018] p-6 sm:mt-28 sm:p-9 lg:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(142,234,250,0.06),transparent_70%)] blur-2xl"
          />
          <div className="relative grid gap-9 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-14">
            <div className="max-w-2xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/70">Lara Prime</p>
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

      <SiteFooter />
    </CosmicShell>
  );
}

/**
 * Lara Prime membership surface — user-facing paid membership for Atlas.
 * Internal plan remains `premium`; checkout/entitlements stay server-authoritative.
 *
 * Only capabilities that exist in the current product are described here.
 * Core premium gates are server-enforced; Prime World surfaces live behind the
 * premium route/capability layer.
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

const PRIME_WORLD_CARDS = [
  {
    eyebrow: 'Kişisel merkez',
    title: 'Atlas’ın sana göre şekillenen alanı',
    body: 'Profil, günlük sinyaller ve Prime katmanları tek bir kişisel merkezde birleşir.',
  },
  {
    eyebrow: 'Bugün',
    title: 'Günün kişisel görünümü',
    body: 'Profil verilerin, mevcut sembolik katmanlar ve güncel check-in bilgilerin tek yüzeyde buluşur.',
  },
  {
    eyebrow: 'Check-in',
    title: 'Enerjini, odağını ve niyetini kaydet',
    body: 'Üç kısa adımla o günkü halini Atlas’ın kişisel bağlamına eklersin.',
  },
  {
    eyebrow: '7 günlük görünüm',
    title: 'Önündeki haftayı tek yerde gör',
    body: 'Prime kişisel merkezindeki yedi günlük görünüm, yakın dönem sinyallerini düzenli bir akışta sunar.',
  },
] as const;

const CAPABILITY_CARDS = [
  {
    icon: Mic,
    eyebrow: 'Lara Voice',
    title: 'Atlas’ı Lara’nın sesiyle dinle',
    body: 'Türkçe ve İngilizce sesli yanıt, mevcut konuşma akışına doğrudan bağlanır.',
  },
  {
    icon: MessageCircle,
    eyebrow: 'Daha geniş kullanım',
    title: `Günde ${PRIME_DAILY_MESSAGES} mesaja kadar kullanım`,
    body: `Atlas Free ${FREE_DAILY_MESSAGES} mesajla sınırlıyken Prime günlük alanını belirgin biçimde genişletir.`,
  },
  {
    icon: ImagePlus,
    eyebrow: 'Görsel ile analiz',
    title: 'Görseli konuşmanın bağlamına dahil et',
    body: 'JPEG, PNG veya WEBP görseller Atlas tarafından mevcut sohbet bağlamıyla birlikte değerlendirilebilir.',
  },
  {
    icon: Sparkles,
    eyebrow: 'Daha derin kişisel bağlam',
    title: `${PRIME_MEMORY_DEPTH} geçmiş nota kadar bağlam derinliği`,
    body: `Free plandaki ${FREE_MEMORY_DEPTH} notluk derinlik Prime’da genişler; geçmişe dayalı konuşmalar daha fazla bağlam taşıyabilir.`,
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
  { label: 'Prime kişisel merkez', free: 'Yok', prime: 'Var' },
  { label: 'Günlük check-in', free: 'Yok', prime: 'Var' },
  { label: '7 günlük görünüm', free: 'Yok', prime: 'Var' },
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
        setMessage('Lara Prime ödeme altyapısı test modunda. Canlı ödeme bu ortamda henüz açık değil.');
        checkoutLock.current = false;
        return;
      }
      const url = result.paymentPageUrl;
      if (!isSafePaymentPageUrl(url)) {
        setCheckoutState('error');
        setError('Ödeme sayfası alınamadı. Güvenli ödeme bağlantısı oluşturulamadı.');
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
          <p className="text-sm font-medium leading-6 text-[#c9b37a]/90">Lara Prime üyeliğin aktif.</p>
          <p className="mt-2 text-[13px] leading-5 text-[#9aa3b2]">
            Kişisel merkez, Lara Voice, genişletilmiş kullanım ve Prime yetkilerin açık.
          </p>
          <Link
            to="/prime"
            className="atlas-focus mt-6 inline-flex rounded-md border border-[#c9b37a]/35 bg-[#c9b37a]/10 px-4 py-2.5 text-sm text-[#e8ecf2] transition hover:bg-[#c9b37a]/16"
          >
            Prime kişisel merkeze git
          </Link>
        </div>
      );
    }

    return (
      <div className={compact ? '' : 'max-w-lg'}>
        {priceLabel ? (
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="font-display text-3xl tracking-wide text-[#e8ecf2]">{priceLabel}</p>
            <p className="pb-1 text-[12px] uppercase tracking-[0.14em] text-[#c9b37a]/70">aylık dijital üyelik</p>
          </div>
        ) : (
          <p className="text-sm text-[#9aa3b2]">Fiyat yükleniyor…</p>
        )}
        <p className="mt-3 max-w-md text-sm leading-6 text-[#9aa3b2]">
          Tek üyelikle Prime kişisel merkez, Lara Voice, görsel analiz, daha yüksek kullanım ve daha derin kişisel bağlam açılır.
        </p>

        {isAccount ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCheckout}
            className="atlas-focus mt-6 w-full rounded-md border border-[#c9b37a]/40 bg-[#c9b37a]/12 px-5 py-3.5 text-sm font-medium tracking-wide text-[#f2ead4] transition hover:bg-[#c9b37a]/18 disabled:opacity-50 sm:w-auto sm:min-w-[15rem]"
          >
            {ctaLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onGuestCta}
            className="atlas-focus mt-6 w-full rounded-md border border-[#c9b37a]/40 bg-[#c9b37a]/12 px-5 py-3.5 text-sm font-medium tracking-wide text-[#f2ead4] transition hover:bg-[#c9b37a]/18 sm:w-auto sm:min-w-[15rem]"
          >
            Lara Prime’a Geç
          </button>
        )}

        {!isAccount ? (
          <p className="mt-3 text-[12px] leading-5 text-[#8b93a3]">
            Üyelik hesabına bağlanır. Giriş yaptıktan sonra bu sayfaya geri dönersin.
          </p>
        ) : null}

        {message ? <p className="mt-4 text-[12px] text-[#9aa3b2]">{message}</p> : null}
        {error ? <p className="mt-4 text-[12px] text-rose-300/90">{error}</p> : null}
      </div>
    );
  }

  return (
    <CosmicShell transparentNav>
      <main className="mx-auto min-h-[100dvh] max-w-4xl px-4 pb-24 pt-28 sm:px-6 md:px-8">
        {/* Hero */}
        <section>
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-[#c9b37a]/70">
            Cosmic Simya · Atlas
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-[clamp(2.4rem,7vw,4.6rem)] font-medium leading-[0.98] tracking-[-0.035em] text-[#e8ecf2]">
            LARA PRIME
          </h1>
          <p className="mt-5 max-w-2xl font-display text-[clamp(1.25rem,3vw,1.75rem)] leading-snug tracking-[-0.01em] text-[#e8ecf2]/90">
            Atlas’ın yalnızca daha fazlası değil. Sana göre şekillenen kişisel katmanı.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#9aa3b2]">
            Günlük kişisel merkezden Lara Voice’a, görsel analizden daha derin hafızaya kadar Atlas’ın premium deneyimini tek üyelikte aç.
          </p>

          <div className="mt-9 rounded-xl border border-[#c9b37a]/20 bg-[#c9b37a]/[0.035] p-5 sm:p-6">
            <CtaBlock />
          </div>
        </section>

        {/* Value statement */}
        <section className="mt-16 border-t border-white/[0.08] pt-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#c9b37a]/70">Prime World</p>
          <h2 className="mt-3 max-w-2xl font-display text-2xl tracking-wide text-[#e8ecf2] sm:text-3xl">
            Bir abonelikten fazlası: kişisel çalışma alanın
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#9aa3b2]">
            Prime, yalnızca mesaj limitini yükseltmez. Atlas’ın sana ait kişisel merkezini açar ve gün içindeki kullanımını tek bir süreklilik içinde toplar.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {PRIME_WORLD_CARDS.map((item) => (
              <article key={item.eyebrow} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#c9b37a]/70">{item.eyebrow}</p>
                <h3 className="mt-2 text-[15px] font-medium leading-6 text-[#e8ecf2]">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-[#9aa3b2]">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Premium capabilities */}
        <section className="mt-16 border-t border-white/[0.08] pt-10">
          <h2 className="font-display text-2xl tracking-wide text-[#e8ecf2]">Prime ile açılan güç</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9aa3b2]">
            Bunlar vitrin sözü değil; mevcut Prime yetki katmanına bağlı gerçek ürün farklarıdır.
          </p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2">
            {CAPABILITY_CARDS.map(({ icon: Icon, eyebrow, title, body }) => (
              <article key={eyebrow} className="bg-[#050608] p-5 sm:p-6">
                <Icon size={17} className="text-[#c9b37a]/80" aria-hidden />
                <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[#c9b37a]/70">{eyebrow}</p>
                <h3 className="mt-2 text-[15px] font-medium leading-6 text-[#e8ecf2]">{title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-[#9aa3b2]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section className="mt-16 border-t border-white/[0.08] pt-10">
          <h2 className="font-display text-2xl tracking-wide text-[#e8ecf2]">Atlas Free ve Lara Prime</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9aa3b2]">
            Free, Atlas’ı gerçekten kullanmanı sağlar. Prime ise kişiselleştirme, süreklilik ve kullanım alanını belirgin biçimde genişletir.
          </p>
          <div className="mt-7 overflow-x-auto rounded-xl border border-white/[0.08]">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.12em] text-[#8b93a3]">
                  <th className="px-4 py-3 font-medium">Özellik</th>
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
            Atlas’ın temel sohbet ve sembolik analiz katmanları Free planda da kullanılabilir. Prime, bunları kaldırıp yeniden satmaz; üstüne gerçek bir premium katman ekler.
          </p>
        </section>

        {/* Trust */}
        <section className="mt-16 border-t border-white/[0.08] pt-10">
          <div className="flex items-center gap-2.5">
            <Lock size={16} className="text-[#c9b37a]/80" aria-hidden />
            <h2 className="font-display text-xl tracking-wide text-[#e8ecf2]/95">Üyelik ve kontrol</h2>
          </div>
          <ul className="mt-5 grid gap-3 text-sm leading-6 text-[#9aa3b2] sm:grid-cols-2">
            <li className="rounded-lg border border-white/[0.07] bg-white/[0.015] p-4">
              Prime yetkileri hesabına bağlanır ve sunucu tarafında doğrulanır.
            </li>
            <li className="rounded-lg border border-white/[0.07] bg-white/[0.015] p-4">
              Üyelik sona erdiğinde hesabın Free plana döner; Prime yetkileri kapanır.
            </li>
            <li className="rounded-lg border border-white/[0.07] bg-white/[0.015] p-4">
              Görsel analiz yetkisi yalnızca Prime planında açılır.
            </li>
            <li className="rounded-lg border border-white/[0.07] bg-white/[0.015] p-4">
              Fiyat ve plan bilgisi ödeme sırasında istemciden değil, sunucu yapılandırmasından alınır.
            </li>
          </ul>
        </section>

        {/* Final CTA */}
        <section className="mt-16 rounded-xl border border-[#c9b37a]/20 bg-[#c9b37a]/[0.035] p-5 sm:p-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#c9b37a]/70">Lara Prime</p>
          <h2 className="mt-3 max-w-2xl font-display text-2xl leading-snug tracking-wide text-[#e8ecf2]">
            Atlas’ı kullanmak başka. Atlas’ın seni tanıyan kişisel katmanını açmak başka.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#9aa3b2]">
            Prime kişisel merkez, Lara Voice, genişletilmiş kullanım, görsel analiz ve daha derin bağlam tek üyelikte.
          </p>
          <div className="mt-7">
            <CtaBlock compact />
          </div>
        </section>
      </main>
    </CosmicShell>
  );
}

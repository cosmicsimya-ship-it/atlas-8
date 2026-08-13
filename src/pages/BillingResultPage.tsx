/**
 * Safe billing result surface — no tokens/secrets in UI.
 * Query status is UX hint only. Lara Prime = server entitlements (plan: premium).
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import CosmicShell from '../components/cosmic/CosmicShell';
import { fetchEntitlementsWithRetry, isPremiumPlan } from '../services/atlas-entitlements';
import { ensureAtlasSession } from '../utils/atlas-session';

type ViewKey = 'loading' | 'active' | 'pending' | 'failed' | 'canceled' | 'invalid' | 'error';

const COPY: Record<
  Exclude<ViewKey, 'loading'>,
  { title: string; body: string }
> = {
  active: {
    title: 'Aktivasyon tamamlandı',
    body: 'Lara Prime üyeliğin açıldı. Prime özellikleri hesabında hazır.',
  },
  pending: {
    title: 'Ödeme işleniyor',
    body: 'Ödeme henüz tamamlanmadı. Kısa süre sonra bu sayfayı yenileyin.',
  },
  failed: {
    title: 'Ödeme tamamlanamadı',
    body: 'Ödeme alınamadı. Lara Prime açılmadı.',
  },
  canceled: {
    title: 'Ödeme iptal edildi',
    body: 'İşlem iptal edildi. Hesap planınız değişmedi.',
  },
  invalid: {
    title: 'Ödeme tamamlanamadı',
    body: 'Ödeme oturumu doğrulanamadı. Lara Prime açılmadı.',
  },
  error: {
    title: 'Ödeme tamamlanamadı',
    body: 'Üyelik durumu alınamadı. Giriş yaptığınızdan emin olup tekrar deneyin.',
  },
};

function hintFromQuery(status: string): 'failed' | 'canceled' | 'invalid' | 'pending' {
  if (status === 'canceled' || status === 'cancelled') return 'canceled';
  if (status === 'failed') return 'failed';
  if (status === 'invalid') return 'invalid';
  if (status === 'pending') return 'pending';
  // status=success is NOT authority — treat as pending until entitlements confirm.
  if (status === 'success') return 'pending';
  return 'invalid';
}

export default function BillingResultPage() {
  const [params] = useSearchParams();
  const queryStatus = String(params.get('status') || 'invalid').toLowerCase();
  const [view, setView] = useState<ViewKey>('loading');

  useEffect(() => {
    let cancelled = false;
    const preferPremium = queryStatus === 'success';

    (async () => {
      try {
        await ensureAtlasSession();
        const data = await fetchEntitlementsWithRetry({
          attempts: 3,
          delayMs: 400,
          preferPremium,
        });
        if (cancelled) return;
        if (isPremiumPlan(data)) {
          await ensureAtlasSession();
          if (cancelled) return;
          setView('active');
          return;
        }
        // Never promote query success to Lara Prime without server plan.
        setView(hintFromQuery(queryStatus));
      } catch {
        if (cancelled) return;
        // Query alone still cannot show Lara Prime.
        setView(queryStatus === 'success' ? 'error' : hintFromQuery(queryStatus));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryStatus]);

  const copy =
    view === 'loading'
      ? { title: 'Üyelik kontrol ediliyor…', body: 'Aktivasyon durumu bekleniyor.' }
      : COPY[view];

  return (
    <CosmicShell>
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 pb-16 pt-28 md:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
          Lara Prime
        </p>
        <h1 className="mt-4 font-display text-[clamp(1.6rem,4vw,2.2rem)] font-medium tracking-[-0.02em] text-[#e8ecf2]">
          {copy.title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#e8ecf2]/68">{copy.body}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/lara-prime"
            className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm text-[#e8ecf2] hover:bg-white/10"
          >
            {view === 'active' ? 'Prime merkeze gir' : 'Lara Prime'}
          </Link>
          <Link
            to="/atlas"
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-[#9aa3b2] hover:text-[#e8ecf2]"
          >
            Atlas’a dön
          </Link>
        </div>
      </main>
    </CosmicShell>
  );
}

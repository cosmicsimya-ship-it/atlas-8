/**
 * Safe billing result surface — no tokens/secrets in UI.
 * Query status is UX hint only. Premium = server entitlements.
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import CosmicShell from '../components/cosmic/CosmicShell';
import {
  fetchEntitlementsWithRetry,
  isPremiumPlan,
  type AtlasEntitlementsPayload,
} from '../services/atlas-entitlements';
import { ensureAtlasSession } from '../utils/atlas-session';

type ViewKey = 'loading' | 'active' | 'pending' | 'failed' | 'canceled' | 'invalid' | 'error';

const COPY: Record<
  Exclude<ViewKey, 'loading'>,
  { title: string; body: string }
> = {
  active: {
    title: 'Premium aktif',
    body: 'Sunucu üyeliğinizi doğruladı. Lara Voice ve Premium özellikler hesabınızda açık.',
  },
  pending: {
    title: 'Ödeme işleniyor',
    body: 'Ödeme doğrulaması henüz Premium’u açmadı. Kısa süre sonra yenileyin veya Atlas’a dönüp hesabınızı kontrol edin.',
  },
  failed: {
    title: 'Ödeme doğrulanamadı',
    body: 'Ödeme tamamlanamadı veya sunucu doğrulaması başarısız. Premium açılmadı.',
  },
  canceled: {
    title: 'Ödeme iptal edildi',
    body: 'İşlem iptal edildi. Hesap planınız değişmedi.',
  },
  invalid: {
    title: 'Geçersiz ödeme oturumu',
    body: 'Checkout oturumu bulunamadı veya eşleşmedi. Premium açılmadı.',
  },
  error: {
    title: 'Durum kontrol edilemedi',
    body: 'Üyelik durumu sunucudan alınamadı. Giriş yaptığınızdan emin olup tekrar deneyin.',
  },
};

function hintFromQuery(status: string): 'failed' | 'canceled' | 'invalid' | 'pending' {
  if (status === 'canceled' || status === 'cancelled') return 'canceled';
  if (status === 'failed') return 'failed';
  if (status === 'invalid') return 'invalid';
  // status=success is NOT authority — treat as pending until entitlements confirm.
  if (status === 'success') return 'pending';
  return 'invalid';
}

export default function BillingResultPage() {
  const [params] = useSearchParams();
  const queryStatus = String(params.get('status') || 'invalid').toLowerCase();
  const code = String(params.get('code') || '').slice(0, 64);
  const [view, setView] = useState<ViewKey>('loading');
  const [entitlements, setEntitlements] = useState<AtlasEntitlementsPayload | null>(null);

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
        setEntitlements(data);
        if (isPremiumPlan(data)) {
          setView('active');
          return;
        }
        // Never promote query success to Premium without server plan.
        setView(hintFromQuery(queryStatus));
      } catch {
        if (cancelled) return;
        // Query alone still cannot show Premium.
        setView(queryStatus === 'success' ? 'error' : hintFromQuery(queryStatus));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryStatus]);

  const copy =
    view === 'loading'
      ? { title: 'Üyelik kontrol ediliyor…', body: 'Sunucu doğrulaması bekleniyor.' }
      : COPY[view];

  return (
    <CosmicShell>
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 pb-16 pt-28 md:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
          Atlas Premium
        </p>
        <h1 className="mt-4 font-display text-[clamp(1.6rem,4vw,2.2rem)] font-medium tracking-[-0.02em] text-[#e8ecf2]">
          {copy.title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#e8ecf2]/68">{copy.body}</p>
        {entitlements?.plan ? (
          <p className="mt-3 text-[11px] tracking-wide text-[#8b93a3]">
            Sunucu planı: {entitlements.plan}
            {entitlements.subscriptionStatus
              ? ` · ${entitlements.subscriptionStatus}`
              : ''}
          </p>
        ) : null}
        {code ? (
          <p className="mt-3 text-[11px] tracking-wide text-[#8b93a3]">Kod: {code}</p>
        ) : null}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/atlas"
            className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm text-[#e8ecf2] hover:bg-white/10"
          >
            Atlas’a dön
          </Link>
          <Link
            to="/"
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-[#9aa3b2] hover:text-[#e8ecf2]"
          >
            Ana sayfa
          </Link>
        </div>
      </main>
    </CosmicShell>
  );
}

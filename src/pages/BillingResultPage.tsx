/**
 * Safe billing result surface — no tokens/secrets in UI.
 */

import { Link, useSearchParams } from 'react-router-dom';

import CosmicShell from '../components/cosmic/CosmicShell';

const COPY: Record<
  string,
  { title: string; body: string; tone: 'ok' | 'bad' | 'neutral' }
> = {
  success: {
    title: 'Ödeme doğrulandı',
    body: 'Atlas Premium hesabınıza tanımlandı. Lara Voice ve Premium özellikler aktif.',
    tone: 'ok',
  },
  failed: {
    title: 'Ödeme doğrulanamadı',
    body: 'Ödeme tamamlanamadı veya sunucu doğrulaması başarısız. Premium açılmadı.',
    tone: 'bad',
  },
  canceled: {
    title: 'Ödeme iptal edildi',
    body: 'İşlem iptal edildi. Hesap planınız değişmedi.',
    tone: 'neutral',
  },
  invalid: {
    title: 'Geçersiz ödeme oturumu',
    body: 'Checkout oturumu bulunamadı veya eşleşmedi. Premium açılmadı.',
    tone: 'bad',
  },
};

export default function BillingResultPage() {
  const [params] = useSearchParams();
  const status = String(params.get('status') || 'invalid').toLowerCase();
  const code = String(params.get('code') || '').slice(0, 64);
  const view = COPY[status] || COPY.invalid;

  return (
    <CosmicShell>
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 pb-16 pt-28 md:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
          Atlas Premium
        </p>
        <h1 className="mt-4 font-display text-[clamp(1.6rem,4vw,2.2rem)] font-medium tracking-[-0.02em] text-[#e8ecf2]">
          {view.title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-[#e8ecf2]/68">{view.body}</p>
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

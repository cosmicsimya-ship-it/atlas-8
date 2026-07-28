import { ArrowRight } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import CosmicShell from '../components/cosmic/CosmicShell';
import IntroSequence from '../components/cosmic/IntroSequence';

export default function Landing() {
  const navigate = useNavigate();
  const [introDone, setIntroDone] = useState(false);

  const onIntroComplete = useCallback(() => setIntroDone(true), []);

  return (
    <CosmicShell transparentNav showBackground>
      {!introDone && <IntroSequence onComplete={onIntroComplete} />}

      <main className="flex min-h-[100dvh] flex-col justify-center px-4 pb-16 pt-28 md:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <p className="mb-5 text-xs uppercase tracking-[0.28em] text-[#c9b37a]/65">
            Cosmicsimya.com!
          </p>

          <h1 className="font-display text-[clamp(4rem,16vw,9rem)] leading-[0.82] tracking-[-0.04em] text-[#f5f0e8]">
            ATLAS
          </h1>

          <p className="mt-8 max-w-2xl font-display text-2xl leading-relaxed text-[#f5f0e8]/88 md:text-3xl">
            Bazı cevaplar bilgiyle bulunmaz. Örüntüyle görünür.
          </p>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#f5f0e8]/48 md:text-base">
            Astroloji, numeroloji ve kişisel örüntüleri tek bir analiz katmanında birleştiren
            Cosmic Simya zekâ sistemi.
          </p>

          <div className="mt-10 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => navigate('/analysis')}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f5f0e8] px-7 py-3 text-sm font-semibold text-[#050505] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9b37a]"
            >
              Haritamı Oku
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/archive')}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-white/[0.03] px-7 py-3 text-sm text-[#f5f0e8]/82 transition hover:border-[#c9b37a]/35 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9b37a]"
            >
              Arşive Gir
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/atlas')}
            className="mt-4 text-sm text-[#c9b37a]/70 underline-offset-4 hover:text-[#c9b37a] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9b37a]"
          >
            Atlas’a Sor
          </button>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/8 px-4 py-6 text-center text-[11px] uppercase tracking-[0.18em] text-[#f5f0e8]/28 md:px-8">
        Örüntü Analizi · Derin Muhakeme · Kısa Ama Yoğun
      </footer>
    </CosmicShell>
  );
}

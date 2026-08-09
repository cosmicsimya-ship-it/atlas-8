import { useEffect, useState } from 'react';

import { landingConvergence } from '../../data/landing-content';
import NetworkConstellation from './NetworkConstellation';
import ObservatoryField from './ObservatoryField';

export default function ConvergenceSection() {
  const { id, eyebrow, title, paragraphs, punchline } = landingConvergence;
  const [sparse, setSparse] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setSparse(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <section
      id={id}
      className="atlas-section relative scroll-mt-24"
      aria-labelledby="convergence-title"
    >
      <ObservatoryField density="subtle" className="opacity-35 max-md:opacity-22" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <div>
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
              {eyebrow}
            </p>
            <h2
              id="convergence-title"
              className="mt-4 font-display text-[clamp(1.95rem,4.5vw,3.1rem)] font-medium leading-[1.1] tracking-[-0.02em] text-[#f5f0e6]"
            >
              {title}
            </h2>
            <div className="mt-8 space-y-4 text-[15px] leading-7 text-[#9a9488] sm:text-base sm:leading-8">
              {paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <p className="mt-8 max-w-lg border-l border-[#c9b37a]/35 pl-5 text-[15px] leading-7 text-[#e8e2d6] sm:text-base sm:leading-8">
              {punchline}
            </p>
          </div>

          <NetworkConstellation
            sparse={sparse}
            className="mx-auto w-full max-w-md lg:max-w-none"
          />
        </div>
      </div>
    </section>
  );
}

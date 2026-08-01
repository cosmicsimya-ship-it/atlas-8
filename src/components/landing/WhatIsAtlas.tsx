import { landingWhatIs } from '../../data/landing-content';

export default function WhatIsAtlas() {
  const { id, titleLines, paragraphs } = landingWhatIs;

  return (
    <section
      id={id}
      className="atlas-section relative scroll-mt-24"
      aria-labelledby="what-title"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:gap-16">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
              Atlas Nedir?
            </p>
            <h2
              id="what-title"
              className="mt-4 font-display text-[clamp(1.85rem,4.2vw,2.85rem)] font-medium leading-[1.12] tracking-[-0.02em] text-[#e8ecf2]"
            >
              {titleLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>
          </div>

          <div className="atlas-glass-card relative overflow-hidden px-5 py-6 sm:px-7 sm:py-8">
            <div
              className="pointer-events-none absolute inset-y-7 left-0 w-px bg-gradient-to-b from-transparent via-[#c9b37a]/35 to-transparent"
              aria-hidden="true"
            />
            <div className="space-y-5 pl-4 text-[15px] leading-7 text-[#98a0ad] sm:pl-5 sm:text-base sm:leading-8">
              {paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

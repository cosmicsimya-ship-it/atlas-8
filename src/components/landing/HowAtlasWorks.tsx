import { landingHowItWorks } from '../../data/landing-content';

export default function HowAtlasWorks() {
  const { id, title, steps } = landingHowItWorks;

  return (
    <section
      id={id}
      className="atlas-section relative scroll-mt-24"
      aria-labelledby="how-title"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
            Veri Akışı
          </p>
          <h2
            id="how-title"
            className="mt-4 font-display text-[clamp(1.85rem,4vw,2.6rem)] font-medium tracking-[-0.02em] text-[#e8ecf2]"
          >
            {title}
          </h2>
        </div>

        <ol className="relative mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4 xl:gap-4">
          <div
            className="pointer-events-none absolute left-3 top-2 bottom-2 w-px bg-gradient-to-b from-[#c9b37a]/30 via-white/[0.08] to-transparent sm:hidden"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-[12%] right-[12%] top-[2.15rem] hidden h-px bg-gradient-to-r from-transparent via-[#c9b37a]/28 to-transparent xl:block"
            aria-hidden="true"
          />

          {steps.map((step, index) => (
            <li key={step.n} className="relative min-w-0 pl-7 sm:pl-0">
              <span
                className="absolute left-0 top-5 h-2.5 w-2.5 rounded-full border border-[#c9b37a]/35 bg-[#c9b37a]/45 shadow-[0_0_0_4px_#050608] sm:left-1/2 sm:top-5 sm:-translate-x-1/2"
                aria-hidden="true"
              />
              <div
                className="atlas-step-card h-full min-w-0 p-4 sm:p-5"
                style={{
                  background:
                    index < 2
                      ? 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))'
                      : 'linear-gradient(180deg, rgba(18,22,34,0.9), rgba(255,255,255,0.012))',
                }}
              >
                <span className="font-mono text-[11px] tracking-[0.2em] text-[#c9b37a]/70">
                  {step.n}
                </span>
                <h3 className="mt-2.5 font-brand text-base font-semibold tracking-[-0.01em] text-[#e8ecf2] sm:text-lg">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#8b93a3]">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

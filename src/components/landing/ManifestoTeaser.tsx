import { landingAlchemy, landingManifestoTeaser } from '../../data/landing-content';
import ObservatoryField from './ObservatoryField';

/**
 * Alchemy meaning + principles — content hierarchy only; art direction preserved.
 */
export default function ManifestoTeaser() {
  const alchemy = landingAlchemy;
  const { principles } = landingManifestoTeaser;

  return (
    <section
      id={alchemy.id}
      className="atlas-section relative scroll-mt-24 overflow-hidden"
      aria-labelledby="alchemy-title"
    >
      <ObservatoryField density="section" className="opacity-40 max-md:opacity-25" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-[0.7rem] font-medium tracking-[0.28em] text-[#c9b37a]/65">
          {alchemy.eyebrow}
        </p>
        <h2
          id="alchemy-title"
          className="mt-4 max-w-2xl font-display text-[clamp(1.85rem,4vw,2.85rem)] font-medium leading-[1.12] tracking-[-0.02em] text-[#f5f0e6]"
        >
          {alchemy.title}
        </h2>
        <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#9a9488] sm:text-base sm:leading-8">
          {alchemy.body}
        </p>

        <div className="mt-14 grid gap-8 sm:grid-cols-3 sm:gap-10">
          {alchemy.steps.map((step) => (
            <div key={step.label}>
              <p className="font-display text-[clamp(1.25rem,2.5vw,1.65rem)] text-[#c9b37a]/8">
                {step.label}
              </p>
              <p className="mt-3 text-[15px] leading-7 text-[#9a9488]">{step.text}</p>
            </div>
          ))}
        </div>

        <ul className="mt-16 max-w-2xl space-y-0 border-t border-white/[0.07]">
          {principles.map((item, index) => (
            <li
              key={item}
              className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-white/[0.06] py-4 text-[15px] leading-7"
            >
              <span className="font-mono text-[0.7rem] tracking-[0.18em] text-[#c9b37a]/45">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-[#e8e2d6]">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

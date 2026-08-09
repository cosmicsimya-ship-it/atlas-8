import { landingWhatAtlasDoes } from '../../data/landing-content';
import ObservatoryField from './ObservatoryField';

/** What Atlas does — clear product explanation. Visual language unchanged. */
export default function AlreadyThere() {
  const { id, eyebrow, title, body } = landingWhatAtlasDoes;

  return (
    <section id={id} className="atlas-section relative scroll-mt-24" aria-labelledby="what-atlas-title">
      <ObservatoryField density="subtle" className="opacity-30" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-[0.7rem] font-medium tracking-[0.28em] text-[#c9b37a]/65">
          {eyebrow}
        </p>
        <h2
          id="what-atlas-title"
          className="mt-5 max-w-3xl font-display text-[clamp(2rem,5vw,3.4rem)] font-medium leading-[1.08] tracking-[-0.02em] text-[#f5f0e6]"
        >
          {title}
        </h2>
        <p className="mt-8 max-w-xl text-[15px] leading-8 text-[#9a9488] sm:text-base sm:leading-8">
          {body}
        </p>
      </div>
    </section>
  );
}

import { landingMemory } from '../../data/landing-content';
import ObservatoryField from './ObservatoryField';

/** Memory / context — privacy-aligned. */
export default function MemoryContext() {
  const { id, eyebrow, title, body } = landingMemory;

  return (
    <section id={id} className="atlas-section relative scroll-mt-24 !py-16 md:!py-20" aria-labelledby="memory-title">
      <ObservatoryField density="subtle" showGeometry={false} className="opacity-25" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-[0.7rem] font-medium tracking-[0.28em] text-[#c9b37a]/65">
            {eyebrow}
          </p>
          <h2
            id="memory-title"
            className="mt-4 font-display text-[clamp(1.65rem,3.5vw,2.45rem)] font-medium leading-[1.15] tracking-[-0.02em] text-[#f5f0e6]"
          >
            {title}
          </h2>
          <p className="mt-5 text-[15px] leading-7 text-[#9a9488] sm:text-base sm:leading-8">
            {body}
          </p>
        </div>
      </div>
    </section>
  );
}

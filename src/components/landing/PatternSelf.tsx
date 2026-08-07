import { landingPatternSelf } from '../../data/landing-content';

export default function PatternSelf() {
  const { id, eyebrow, title, accent, paragraphs } = landingPatternSelf;

  return (
    <section id={id} className="atlas-section relative scroll-mt-24" aria-labelledby="pattern-self-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
          {eyebrow}
        </p>
        <h2
          id="pattern-self-title"
          className="mt-5 font-display text-[clamp(2.1rem,5.5vw,3.6rem)] font-medium leading-[1.08] tracking-[-0.02em] text-[#e8ecf2]"
        >
          {title}
        </h2>
        <p className="mt-4 max-w-2xl font-display text-[clamp(1.4rem,3.2vw,2.15rem)] leading-[1.2] text-[#c9b37a]/88">
          {accent}
        </p>
        <div className="mt-10 max-w-xl space-y-5 text-[15px] leading-8 text-[#98a0ad] sm:text-base">
          {paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

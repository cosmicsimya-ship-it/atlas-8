import { landingAlreadyThere } from '../../data/landing-content';

export default function AlreadyThere() {
  const { id, eyebrow, title, accent, body } = landingAlreadyThere;

  return (
    <section id={id} className="atlas-section relative scroll-mt-24" aria-labelledby="already-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
          {eyebrow}
        </p>
        <h2
          id="already-title"
          className="mt-5 max-w-3xl font-display text-[clamp(2.1rem,5.5vw,3.6rem)] font-medium leading-[1.08] tracking-[-0.02em] text-[#e8ecf2]"
        >
          {title}
        </h2>
        <p className="mt-4 max-w-2xl font-display text-[clamp(1.35rem,3vw,2rem)] leading-[1.25] text-[#c9b37a]/85">
          {accent}
        </p>
        <p className="mt-10 max-w-xl text-[15px] leading-8 text-[#98a0ad] sm:text-base sm:leading-8">
          {body}
        </p>
      </div>
    </section>
  );
}

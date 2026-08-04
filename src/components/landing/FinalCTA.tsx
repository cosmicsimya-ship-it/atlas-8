import { Link } from 'react-router-dom';

import { landingFinalCta } from '../../data/landing-content';
import { scrollToSection } from '../../utils/scroll-section';

export default function FinalCTA() {
  const { id, titleLines, body, primaryCta, secondaryCta } = landingFinalCta;

  return (
    <section
      id={id}
      className="atlas-section relative scroll-mt-24"
      aria-labelledby="final-cta-title"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="atlas-glass-card relative overflow-hidden px-5 py-10 text-center sm:px-8 md:px-12 md:py-14">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(201,179,122,0.08),transparent_55%)]"
            aria-hidden="true"
          />
          <h2
            id="final-cta-title"
            className="relative font-display text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.1] tracking-[-0.02em] text-[#e8ecf2]"
          >
            {titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p className="relative mx-auto mt-5 max-w-md text-[15px] leading-7 text-[#8b93a3]">
            {body}
          </p>

          <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-3.5">
            <Link to={primaryCta.to} className="atlas-btn-primary min-w-[11rem]">
              {primaryCta.label}
            </Link>
            <button
              type="button"
              onClick={() => scrollToSection(secondaryCta.sectionId)}
              className="atlas-btn-secondary min-w-[11rem]"
            >
              {secondaryCta.label}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';

import { landingFinalCta } from '../../data/landing-content';

export default function FinalCTA() {
  const { id, titleLines, body, accountHint, primaryCta, secondaryCta } = landingFinalCta;

  return (
    <section
      id={id}
      className="atlas-section relative scroll-mt-24"
      aria-labelledby="final-cta-title"
    >
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2
          id="final-cta-title"
          className="font-display text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.1] tracking-[-0.02em] text-[#e8ecf2]"
        >
          {titleLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-7 text-[#8b93a3]">{body}</p>
        <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-[#6f7886]">{accountHint}</p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-3.5">
          <Link to={primaryCta.to} className="atlas-btn-primary min-w-[11rem]">
            {primaryCta.label}
          </Link>
          <Link to={secondaryCta.to} className="atlas-btn-secondary min-w-[11rem]">
            {secondaryCta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}

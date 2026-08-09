import { Link } from 'react-router-dom';

import { landingFinalCta } from '../../data/landing-content';
import { scrollToSection } from '../../utils/scroll-section';
import ObservatoryField from './ObservatoryField';

export default function FinalCTA() {
  const { id, titleLines, body, accountHint, primaryCta, secondaryCta } = landingFinalCta;

  return (
    <section
      id={id}
      className="atlas-section relative scroll-mt-24"
      aria-labelledby="final-cta-title"
    >
      <ObservatoryField density="subtle" className="opacity-45 max-md:opacity-28" />

      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(70vw,28rem)] w-[min(70vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,179,122,0.07)_0%,rgba(16,16,14,0.25)_42%,transparent_70%)] max-md:opacity-55"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2
          id="final-cta-title"
          className="font-display text-[clamp(2rem,5.2vw,3.35rem)] font-medium leading-[1.1] tracking-[-0.02em] text-[#f5f0e6]"
        >
          {titleLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-7 text-[#9a9488]">{body}</p>
        <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-[#6f6a60]">{accountHint}</p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-3.5">
          <Link
            to={primaryCta.to}
            className="atlas-btn-primary min-h-12 w-full max-w-xs touch-manipulation sm:w-auto sm:min-w-[11rem]"
          >
            {primaryCta.label}
          </Link>
          {'sectionId' in secondaryCta ? (
            <button
              type="button"
              onClick={() => scrollToSection(secondaryCta.sectionId)}
              className="atlas-btn-secondary min-h-12 w-full max-w-xs sm:w-auto sm:min-w-[11rem]"
            >
              {secondaryCta.label}
            </button>
          ) : (
            <Link
              to={(secondaryCta as { to: string }).to}
              className="atlas-btn-secondary min-h-12 w-full max-w-xs sm:w-auto sm:min-w-[11rem]"
            >
              {secondaryCta.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

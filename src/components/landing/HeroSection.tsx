import { Link } from 'react-router-dom';

import { landingHero } from '../../data/landing-content';
import AtlasCoreVisual from './AtlasCoreVisual';
import HeroAtmosphere from './HeroAtmosphere';

/**
 * Cinematic hero — production hierarchy + spatial observation engine.
 * Desktop: interlocking type + giant cropped mechanism.
 * Mobile: type overlays extreme lens close-crop (not stack + tiny orb).
 */
export default function HeroSection() {
  const { brand, titleLines, methodLines, body, primaryCta } = landingHero;

  return (
    <section
      className="relative min-h-[100dvh] overflow-hidden pt-[5.5rem]"
      aria-labelledby="landing-hero-title"
    >
      <HeroAtmosphere />

      {/* Mobile midground — extreme close-crop fills the scene behind type */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[28%] z-[1] overflow-hidden lg:hidden"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(201,179,122,0.1),transparent_55%)]" />
        <AtlasCoreVisual crop="mobile" className="h-full w-full scale-[1.15]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#050505_0%,rgba(5,5,5,0.55)_18%,transparent_42%,rgba(5,5,5,0.35)_78%,#050505_100%)]" />
      </div>

      {/* Desktop midground — giant mechanism */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-[1] hidden w-[min(72%,54rem)] lg:block"
        aria-hidden="true"
      >
        <div className="absolute inset-y-0 left-0 z-[1] w-48 bg-[linear-gradient(to_right,#050505,transparent)]" />
        <AtlasCoreVisual crop="desktop" className="h-full w-full" />
      </div>

      {/* Foreground editorial */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-5.5rem)] w-full max-w-6xl flex-col justify-center px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-24">
        <div className="max-w-xl lg:max-w-[34rem]">
          <p className="hero-reveal hero-reveal-1 atlas-mark mb-5 text-[clamp(1.55rem,5vw,2.75rem)] leading-none text-transparent sm:mb-7">
            {brand}
          </p>

          <p
            lang="en"
            className="hero-reveal hero-reveal-2 mb-4 text-[0.7rem] font-medium tracking-[0.34em] text-[#c9b37a]/75 sm:mb-5"
          >
            COSMIC SIMYA
          </p>

          <h1
            id="landing-hero-title"
            className="hero-reveal hero-reveal-3 font-display text-[clamp(2.05rem,7vw,3.85rem)] font-medium leading-[1.06] tracking-[-0.02em] text-[#f5f0e6]"
          >
            {titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>

          <p className="hero-reveal hero-reveal-4 mt-4 max-w-md font-display text-[clamp(1.1rem,3.2vw,1.55rem)] font-medium leading-[1.25] tracking-[-0.01em] text-[#c9b37a]/c8 sm:mt-6">
            <span className="block sm:inline">{methodLines[0]}</span>{' '}
            <span className="block sm:inline">{methodLines[1]}</span>
          </p>

          <p className="hero-reveal hero-reveal-5 mt-4 max-w-md text-[14px] leading-6 text-[#9a9488] sm:mt-7 sm:text-[1.05rem] sm:leading-8">
            {body}
          </p>

          <div className="hero-reveal hero-reveal-6 mt-8 flex sm:mt-11">
            <Link
              to={primaryCta.to}
              className="atlas-btn-primary min-h-12 w-full touch-manipulation sm:w-auto sm:min-w-[10.5rem]"
            >
              {primaryCta.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

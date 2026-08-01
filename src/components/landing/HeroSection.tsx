import { Link } from 'react-router-dom';

import { landingHero } from '../../data/landing-content';
import { scrollToSection } from '../../utils/scroll-section';
import AtlasCoreVisual from './AtlasCoreVisual';
import HeroAtmosphere from './HeroAtmosphere';

export default function HeroSection() {
  const { brand, eyebrow, titleLines, body, primaryCta, secondaryCta } = landingHero;

  return (
    <section
      className="relative flex min-h-[100dvh] items-center overflow-hidden pt-[5.5rem] pb-20 sm:pb-24"
      aria-labelledby="landing-hero-title"
    >
      <HeroAtmosphere />

      {/* Left clarity field — readable copy without flattening the visual */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-full max-w-[min(100%,52rem)] bg-[linear-gradient(to_right,#050608_0%,rgba(5,6,8,0.88)_48%,transparent_100%)] max-lg:bg-[linear-gradient(to_bottom,#050608_0%,rgba(5,6,8,0.9)_32%,transparent_62%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-12 lg:px-8">
        <div className="relative max-w-xl lg:max-w-[36rem]">
          {/* Brand is the hero signal — Figma: Display/Brand */}
          <p className="hero-reveal hero-reveal-1 atlas-mark mb-7 text-[clamp(1.65rem,4.5vw,2.75rem)] leading-none text-transparent">
            {brand}
          </p>

          <p className="hero-reveal hero-reveal-2 mb-5 text-[11px] font-medium uppercase tracking-[0.34em] text-[#c9b37a]/70">
            {eyebrow}
          </p>

          <h1
            id="landing-hero-title"
            className="hero-reveal hero-reveal-3 font-display text-[clamp(2.15rem,6.4vw,3.85rem)] font-medium leading-[1.06] tracking-[-0.02em] text-[#eef1f5]"
          >
            {titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>

          <p className="hero-reveal hero-reveal-4 mt-7 max-w-md text-[15px] leading-7 text-[#9aa3b0] sm:mt-8 sm:max-w-lg sm:text-[1.05rem] sm:leading-8">
            {body}
          </p>

          <div className="hero-reveal hero-reveal-5 mt-10 flex flex-col gap-3 sm:mt-11 sm:flex-row sm:items-center sm:gap-3.5">
            <Link to={primaryCta.to} className="atlas-btn-primary sm:min-w-[10.5rem]">
              {primaryCta.label}
            </Link>
            <button
              type="button"
              onClick={() => scrollToSection(secondaryCta.sectionId)}
              className="atlas-btn-secondary sm:min-w-[10.5rem]"
            >
              {secondaryCta.label}
            </button>
          </div>
        </div>

        <div className="hero-reveal hero-reveal-visual relative mx-auto w-full max-w-[22rem] sm:max-w-md lg:max-w-none lg:justify-self-end">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,179,122,0.07),transparent_68%)] blur-2xl"
            aria-hidden="true"
          />
          <AtlasCoreVisual className="relative" />
        </div>
      </div>
    </section>
  );
}

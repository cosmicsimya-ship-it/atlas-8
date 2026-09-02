import { Link } from 'react-router-dom';

import { landingHero } from '../../data/landing-content';
import AtlasCoreVisual from './AtlasCoreVisual';
import HeroAtmosphere from './HeroAtmosphere';

export default function HeroSection() {
  const { titleLines, methodLines, body, primaryCta } = landingHero;

  return (
    <section className="relative min-h-[100dvh] overflow-hidden pt-16" aria-labelledby="landing-hero-title">
      <HeroAtmosphere />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[39%] z-[1] overflow-hidden lg:hidden" aria-hidden="true">
        <AtlasCoreVisual crop="mobile" className="h-full w-full scale-[0.92] opacity-55" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#020203_0%,rgba(2,2,3,.82)_24%,transparent_50%,rgba(2,2,3,.82)_84%,#020203_100%)]" />
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-[2%] z-[1] hidden w-[min(48%,40rem)] lg:flex lg:items-center lg:justify-center" aria-hidden="true">
        <div className="absolute inset-y-0 left-0 z-[1] w-48 bg-[linear-gradient(to_right,#020203,transparent)]" />
        <AtlasCoreVisual crop="desktop" className="w-full opacity-78" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <div className="max-w-[39rem]">
          <div className="mb-7 flex items-center gap-4">
            <div className="h-px w-14 bg-[linear-gradient(to_right,rgba(240,240,239,.65),transparent)]" />
            <p className="atlas-compass-eyebrow text-[10px]">COSMIC SIMYA · ATLAS</p>
          </div>

          <h1 id="landing-hero-title" className="font-display text-[clamp(2.5rem,6vw,4.35rem)] font-medium leading-[1.02] tracking-[-0.035em] text-[#f2f2f0]">
            {titleLines.map((line) => <span key={line} className="block">{line}</span>)}
          </h1>

          <p className="mt-7 max-w-lg font-display text-[clamp(1.08rem,2.2vw,1.42rem)] leading-[1.35] text-[#c6c7ca]">
            <span className="block sm:inline">{methodLines[0]}</span>{' '}
            <span className="block sm:inline">{methodLines[1]}</span>
          </p>

          <p className="mt-6 max-w-lg text-[14px] leading-7 text-[#8f9298] sm:text-[15px] sm:leading-8">{body}</p>

          <div className="mt-10 flex items-center gap-6">
            <Link to={primaryCta.to} className="atlas-btn-primary min-h-12 min-w-[10.5rem] px-6">{primaryCta.label}</Link>
            <div className="hidden h-px w-24 bg-[linear-gradient(to_right,rgba(235,236,238,.28),transparent)] sm:block" />
          </div>
        </div>
      </div>
    </section>
  );
}

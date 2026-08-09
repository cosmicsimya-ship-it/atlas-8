import { Link } from 'react-router-dom';

import { landingIntelligence } from '../../data/landing-content';
import ObservatoryField from './ObservatoryField';

/** Atlas positioning strip — no AI jargon. */
export default function AtlasIntelligenceStrip() {
  const { id, eyebrow, title, body, cta } = landingIntelligence;

  return (
    <section
      id={id}
      className="atlas-section relative scroll-mt-24 !py-16 md:!py-20"
      aria-labelledby="intelligence-title"
    >
      <ObservatoryField density="subtle" showGeometry={false} className="opacity-30" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative grid items-center gap-8 border-y border-white/[0.07] py-10 lg:grid-cols-[minmax(0,1.4fr)_auto] lg:gap-12 lg:py-12">
          <div>
            <p className="text-[0.7rem] font-medium tracking-[0.28em] text-[#c9b37a]/65">
              {eyebrow}
            </p>
            <h2
              id="intelligence-title"
              className="mt-4 max-w-2xl font-display text-[clamp(1.55rem,3.2vw,2.35rem)] font-medium leading-[1.15] tracking-[-0.02em] text-[#f5f0e6]"
            >
              {title}
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#9a9488] sm:text-base sm:leading-8">
              {body}
            </p>
          </div>
          <Link
            to={cta.to}
            className="atlas-btn-primary min-h-12 w-full touch-manipulation sm:w-auto sm:min-w-[11rem]"
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}

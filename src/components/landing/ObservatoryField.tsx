import { cn } from '../../utils/cn';

type Density = 'hero' | 'section' | 'subtle';

interface ObservatoryFieldProps {
  className?: string;
  density?: Density;
  showGeometry?: boolean;
}

/** Warm atmospheric continuity — no navy wash. */
export default function ObservatoryField({
  className,
  density = 'section',
  showGeometry = true,
}: ObservatoryFieldProps) {
  const isHero = density === 'hero';
  return (
    <div className={cn('obs-field', className)} aria-hidden="true">
      <div className={cn('obs-field-haze', isHero && 'obs-field-haze-hero')} />
      {density !== 'subtle' ? (
        <div className={cn('obs-field-grid', isHero && 'obs-field-grid-hero')} />
      ) : null}

      {showGeometry && density !== 'subtle' ? (
        <svg
          className={cn(
            'absolute inset-0 h-full w-full opacity-40 max-md:opacity-20',
            isHero && 'opacity-60 max-md:opacity-35',
          )}
          viewBox="0 0 1200 800"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          <path
            d="M 60 400 A 360 260 0 0 1 480 140"
            stroke="rgba(201,179,122,0.08)"
            strokeWidth="0.8"
            className="obs-orbit-ultra max-md:hidden"
            style={{ transformOrigin: '360px 360px' }}
          />
          <line x1="160" y1="200" x2="300" y2="290" stroke="rgba(201,179,122,0.07)" strokeWidth="0.55" />
          <circle cx="160" cy="200" r="1.3" fill="rgba(245,240,230,0.3)" />
          <circle cx="300" cy="290" r="1.1" fill="rgba(201,179,122,0.35)" />
          {isHero ? (
            <>
              <path
                d="M 900 60 A 300 300 0 0 1 1140 420"
                stroke="rgba(245,240,230,0.06)"
                strokeWidth="0.6"
                className="obs-orbit-ultra-rev max-md:hidden"
                style={{ transformOrigin: '960px 360px' }}
              />
              <line
                x1="820"
                y1="520"
                x2="1010"
                y2="600"
                stroke="rgba(201,179,122,0.06)"
                strokeWidth="0.5"
                className="max-md:hidden"
              />
              <circle cx="1010" cy="600" r="1" fill="rgba(245,240,230,0.24)" className="max-md:hidden" />
            </>
          ) : null}
        </svg>
      ) : null}

      <div className="site-grain opacity-[0.028] max-md:opacity-[0.018]" />
    </div>
  );
}

import { cn } from '../../utils/cn';

interface AtlasCoreVisualProps {
  className?: string;
  /** Mobile close-crop of the observation engine. */
  crop?: 'desktop' | 'mobile';
}

/**
 * Observation engine — evolved from production fragmented optic language.
 * Large, cropped, layered. Dark aperture (not AI orb). Warm metal / smoked glass.
 */
export default function AtlasCoreVisual({ className, crop = 'desktop' }: AtlasCoreVisualProps) {
  const mobile = crop === 'mobile';

  return (
    <div
      className={cn(
        'hero-core-visual relative h-full w-full overflow-visible',
        className,
      )}
      aria-hidden="true"
    >
      {/* Soft champagne light interacting with geometry */}
      <div className="pointer-events-none absolute left-[18%] top-[22%] h-[55%] w-[55%] rounded-full bg-[radial-gradient(circle,rgba(201,179,122,0.09)_0%,transparent_68%)] blur-3xl obs-light-sweep max-md:left-[20%] max-md:top-[30%] max-md:bg-[radial-gradient(circle,rgba(201,179,122,0.07)_0%,transparent_65%)] max-md:blur-xl" />

      <div className={cn('obs-engine', mobile && 'obs-engine-mobile')}>
        {/* FAR plane — distant partial rings */}
        <div className="obs-engine-layer obs-engine-far">
          <svg
            className="absolute h-[140%] w-[140%] -right-[18%] -top-[12%] max-md:h-[160%] max-md:w-[160%] max-md:-right-[35%] max-md:-top-[20%]"
            viewBox="0 0 640 640"
            fill="none"
          >
            <ellipse
              cx="360"
              cy="300"
              rx="260"
              ry="220"
              stroke="rgba(176,169,156,0.12)"
              strokeWidth="0.8"
              fill="none"
            />
            <ellipse
              cx="360"
              cy="300"
              rx="210"
              ry="170"
              stroke="rgba(201,179,122,0.08)"
              strokeWidth="0.6"
              strokeDasharray="3 14"
              fill="none"
              className="obs-orbit-ultra origin-center [transform-box:fill-box] [transform-origin:360px_300px]"
            />
          </svg>
        </div>

        {/* MID plane — main observation mechanism */}
        <div className="obs-engine-layer obs-engine-mid obs-drift-soft">
          <svg
            className={cn(
              'absolute',
              mobile
                ? 'h-[260%] w-[260%] -left-[55%] -top-[55%]'
                : 'h-[125%] w-[125%] -right-[8%] -top-[6%]',
            )}
            viewBox="0 0 640 640"
            fill="none"
          >
            <defs>
              <linearGradient id="oeChrome" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f5f0e6" stopOpacity="0.55" />
                <stop offset="40%" stopColor="#8a8274" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#c9b37a" stopOpacity="0.28" />
              </linearGradient>
              <linearGradient id="oeBronze" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e8d9a8" stopOpacity="0.5" />
                <stop offset="55%" stopColor="#c9b37a" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#8b7a4a" stopOpacity="0.06" />
              </linearGradient>
              <linearGradient id="oeGlass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5f0e6" stopOpacity="0.14" />
                <stop offset="45%" stopColor="#8a8274" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#050505" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="oeAperture" cx="42%" cy="38%" r="62%">
                <stop offset="0%" stopColor="#1a1814" stopOpacity="0.2" />
                <stop offset="45%" stopColor="#0b0a08" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#050505" stopOpacity="1" />
              </radialGradient>
              <linearGradient id="oeFracture" x1="0" y1="0.5" x2="1" y2="0.5">
                <stop offset="0%" stopColor="#f5f0e6" stopOpacity="0" />
                <stop offset="45%" stopColor="#e8d9a8" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#f5f0e6" stopOpacity="0" />
              </linearGradient>
              <filter id="oeSoft" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.2" />
              </filter>
            </defs>

            {/* Outer metallic ring — partially cropped */}
            <path
              d="M 120 160 A 220 200 0 0 1 520 280"
              stroke="url(#oeChrome)"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
              opacity="0.65"
            />
            <path
              d="M 90 340 A 250 180 0 0 0 480 480"
              stroke="rgba(176,169,156,0.16)"
              strokeWidth="0.8"
              fill="none"
              className="max-md:hidden"
            />

            {/* Precision ticks on outer arc */}
            {Array.from({ length: 18 }).map((_, i) => {
              const t = i / 17;
              const a = -0.9 + t * 1.7;
              const cx = 320 + Math.cos(a) * 220;
              const cy = 280 + Math.sin(a) * 195;
              const cx2 = 320 + Math.cos(a) * (i % 3 === 0 ? 205 : 212);
              const cy2 = 280 + Math.sin(a) * (i % 3 === 0 ? 182 : 188);
              return (
                <line
                  key={i}
                  x1={cx}
                  y1={cy}
                  x2={cx2}
                  y2={cy2}
                  stroke={i % 3 === 0 ? 'rgba(201,179,122,0.4)' : 'rgba(176,169,156,0.18)'}
                  strokeWidth={i % 3 === 0 ? 1.1 : 0.55}
                />
              );
            })}

            {/* Champagne illuminated edge */}
            <path
              d="M 140 200 A 210 190 0 0 1 470 230"
              stroke="url(#oeBronze)"
              strokeWidth="1.1"
              strokeLinecap="round"
              fill="none"
              opacity="0.7"
              className="obs-light-sweep"
            />

            {/* Suspended observation plane — smoked glass (occludes behind) */}
            <path
              d="M 250 110 L 430 165 L 390 310 L 220 255 Z"
              fill="url(#oeGlass)"
              stroke="rgba(245,240,230,0.16)"
              strokeWidth="0.7"
            />
            <path
              d="M 180 320 L 290 270 L 350 390 L 230 430 Z"
              fill="rgba(139,122,74,0.04)"
              stroke="rgba(201,179,122,0.14)"
              strokeWidth="0.55"
              className="max-md:hidden"
            />

            {/* Inner orbital marking */}
            <g className="obs-orbit-ultra-rev origin-center [transform-box:fill-box] [transform-origin:320px_300px]">
              <ellipse
                cx="320"
                cy="300"
                rx="130"
                ry="108"
                stroke="rgba(201,179,122,0.18)"
                strokeWidth="0.7"
                strokeDasharray="4 10"
                fill="none"
              />
              {/* Bright node desktop-only — never a mobile “AI orb” */}
              <circle
                cx="320"
                cy="192"
                r="2.2"
                fill="rgba(245,240,230,0.45)"
                className="max-md:hidden"
              />
            </g>

            {/* Dark optical aperture — NOT a glowing orb */}
            <ellipse cx="320" cy="300" rx="78" ry="68" fill="url(#oeAperture)" />
            <ellipse
              cx="320"
              cy="300"
              rx="78"
              ry="68"
              stroke="rgba(245,240,230,0.2)"
              strokeWidth="1.1"
              fill="none"
            />
            <ellipse
              cx="320"
              cy="300"
              rx="52"
              ry="44"
              stroke="rgba(201,179,122,0.16)"
              strokeWidth="0.7"
              fill="none"
            />
            {/* Warm internal reflection on dark lens */}
            <path
              d="M 268 262 A 55 48 0 0 1 358 275"
              stroke="rgba(245,240,230,0.28)"
              strokeWidth="1.4"
              strokeLinecap="round"
              fill="none"
              opacity="0.7"
            />
            <ellipse
              cx="300"
              cy="278"
              rx="18"
              ry="8"
              fill="rgba(232,217,168,0.06)"
              filter="url(#oeSoft)"
            />

            {/* Fracture light lines */}
            <line x1="300" y1="170" x2="420" y2="250" stroke="url(#oeFracture)" strokeWidth="1.1" />
            <line
              x1="210"
              y1="310"
              x2="300"
              y2="250"
              stroke="url(#oeFracture)"
              strokeWidth="0.7"
              opacity="0.5"
              className="max-md:hidden"
            />

            {/* Engraved coordinate marks */}
            <text
              x="70"
              y="120"
              fill="rgba(176,169,156,0.35)"
              fontSize="11"
              fontFamily="JetBrains Mono, monospace"
              letterSpacing="1.4"
              className="max-md:hidden"
            >
              AZ 142.6°
            </text>
            <text
              x="460"
              y="500"
              fill="rgba(176,169,156,0.28)"
              fontSize="11"
              fontFamily="JetBrains Mono, monospace"
              letterSpacing="1.4"
              className="max-md:hidden"
            >
              LENS · 03
            </text>
          </svg>
        </div>

        {/* NEAR plane — foreground shard / edge */}
        <div className="obs-engine-layer obs-engine-near max-md:opacity-80">
          <svg
            className={cn(
              'absolute',
              mobile ? 'h-[90%] w-[90%] left-[-10%] top-[35%]' : 'h-[70%] w-[55%] left-[-4%] top-[28%]',
            )}
            viewBox="0 0 320 320"
            fill="none"
          >
            <path
              d="M 40 80 L 160 40 L 200 160 L 70 190 Z"
              fill="rgba(245,240,230,0.03)"
              stroke="rgba(201,179,122,0.22)"
              strokeWidth="0.8"
            />
            <path
              d="M 120 200 L 220 170 L 250 250 L 150 275 Z"
              fill="rgba(16,16,14,0.55)"
              stroke="rgba(245,240,230,0.12)"
              strokeWidth="0.6"
            />
            <line
              x1="20"
              y1="160"
              x2="90"
              y2="150"
              stroke="rgba(201,179,122,0.25)"
              strokeWidth="0.7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

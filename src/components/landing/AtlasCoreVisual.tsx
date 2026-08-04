import { cn } from '../../utils/cn';

interface AtlasCoreVisualProps {
  className?: string;
}

/**
 * Fragmented optic architecture — lens shards, broken rings, no central orb.
 */
export default function AtlasCoreVisual({ className }: AtlasCoreVisualProps) {
  return (
    <div
      className={cn(
        'hero-core-visual relative mx-auto aspect-square w-full max-w-[min(100%,440px)] lg:max-w-none',
        className,
      )}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 440 440"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="chromeArc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e4e9ef" stopOpacity="0.5" />
            <stop offset="40%" stopColor="#7a8492" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#b8c0cc" stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id="chromeThin" x1="0.2" y1="0" x2="0.9" y2="1">
            <stop offset="0%" stopColor="#eceff4" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#5c6674" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="fracture" x1="0" y1="0.5" x2="1" y2="0.5">
            <stop offset="0%" stopColor="#dfe5ec" stopOpacity="0" />
            <stop offset="45%" stopColor="#c5ccd6" stopOpacity="0.32" />
            <stop offset="55%" stopColor="#9aa3ae" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#dfe5ec" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="goldEdge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8d9a8" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#c9b37a" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#8b7a4a" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="glassPlane" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d8dee6" stopOpacity="0.14" />
            <stop offset="55%" stopColor="#8a939f" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#010101" stopOpacity="0" />
          </linearGradient>
          <mask id="fadeEdges">
            <rect width="440" height="440" fill="white" />
            <rect x="0" y="300" width="440" height="160" fill="url(#fadeBottomGrad)" />
            <rect x="300" y="0" width="140" height="440" fill="url(#fadeRightGrad)" />
          </mask>
          <linearGradient id="fadeRightGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fadeBottomGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <filter id="softBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.9" />
          </filter>
        </defs>

        <g mask="url(#fadeEdges)">
          {/* Broken outer ring — upper segment only */}
          <path
            d="M 96 118 A 132 132 0 0 1 312 198"
            stroke="url(#chromeArc)"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.5"
            className="site-animate-pulse-soft"
          />
          <path
            d="M 118 312 A 118 118 0 0 1 48 210"
            stroke="url(#chromeThin)"
            strokeWidth="0.65"
            strokeLinecap="round"
            fill="none"
            opacity="0.35"
            className="max-md:hidden"
          />

          {/* Gold whisper arc — brand accent */}
          <path
            d="M 108 148 A 124 124 0 0 1 286 156"
            stroke="url(#goldEdge)"
            strokeWidth="0.9"
            strokeLinecap="round"
            fill="none"
            opacity="0.55"
            className="site-animate-pulse-soft"
          />

          {/* Off-axis time ring — slow drift */}
          <g className="site-animate-orbit origin-center [transform-box:fill-box] [transform-origin:220px_220px]">
            <path
              d="M 72 232 A 156 108 0 0 1 328 168"
              stroke="rgba(180,190,202,0.14)"
              strokeWidth="0.55"
              strokeDasharray="4 11"
              fill="none"
            />
          </g>

          {/* Glass plane shard — asymmetric lens fragment */}
          <path
            d="M 228 88 L 312 142 L 278 228 L 192 186 Z"
            fill="url(#glassPlane)"
            stroke="rgba(210,218,226,0.18)"
            strokeWidth="0.55"
          />
          <path
            d="M 148 248 L 198 198 L 248 262 L 188 318 Z"
            fill="rgba(160,170,182,0.04)"
            stroke="rgba(190,198,208,0.14)"
            strokeWidth="0.45"
            className="max-md:hidden"
          />

          {/* Inner arc fragments — no closed sphere */}
          <path
            d="M 178 152 A 64 78 0 0 1 298 248"
            stroke="url(#chromeArc)"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
            opacity="0.42"
            filter="url(#softBlur)"
          />
          <path
            d="M 152 278 A 52 64 0 0 0 248 142"
            stroke="rgba(200,208,218,0.12)"
            strokeWidth="0.6"
            strokeLinecap="round"
            fill="none"
          />

          {/* Data layer lines */}
          <path
            d="M 48 196 Q 148 168 248 188 T 392 158"
            stroke="rgba(150,160,172,0.1)"
            strokeWidth="0.45"
            fill="none"
          />
          <path
            d="M 64 268 Q 180 238 268 256"
            stroke="rgba(130,140,152,0.08)"
            strokeWidth="0.4"
            fill="none"
            className="max-md:hidden"
          />

          {/* Fractured light lines */}
          <line x1="218" y1="128" x2="302" y2="192" stroke="url(#fracture)" strokeWidth="1" />
          <line
            x1="168"
            y1="228"
            x2="238"
            y2="178"
            stroke="url(#fracture)"
            strokeWidth="0.7"
            opacity="0.55"
            className="max-md:hidden"
          />

          {/* Small chrome edge — not a core */}
          <path
            d="M 204 176 L 224 196 L 208 212 L 188 192 Z"
            fill="rgba(190,198,208,0.06)"
            stroke="rgba(220,228,236,0.22)"
            strokeWidth="0.45"
          />

          {/* Refracted shard */}
          <path
            d="M 318 188 L 338 218 L 322 232 L 302 202 Z"
            fill="rgba(170,180,192,0.05)"
            stroke="rgba(201,179,122,0.22)"
            strokeWidth="0.45"
          />
        </g>
      </svg>

      <div className="hero-core-vignette absolute inset-0" />
    </div>
  );
}

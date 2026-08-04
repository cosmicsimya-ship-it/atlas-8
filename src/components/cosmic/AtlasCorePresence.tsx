import { cn } from '../../utils/cn';

interface AtlasCorePresenceProps {
  className?: string;
  /** idle | thinking */
  state?: 'idle' | 'thinking';
}

/**
 * Register Core — brightest object in the conversation field.
 * Layered planes with soft cyan seam; 5s intelligence breath.
 */
export default function AtlasCorePresence({
  className,
  state = 'idle',
}: AtlasCorePresenceProps) {
  const thinking = state === 'thinking';

  return (
    <div
      className={cn(
        'relative mx-auto aspect-square w-[min(72vw,34dvh,240px)] sm:w-[min(52vw,38dvh,280px)]',
        'motion-safe:animate-[atlas-core-breathe_5s_ease-in-out_infinite]',
        className,
      )}
      aria-hidden="true"
    >
      <div
        className={cn(
          'absolute inset-[8%] rounded-full',
          'bg-[radial-gradient(circle,rgba(126,182,255,0.22),rgba(59,130,246,0.06)_48%,transparent_72%)]',
          'blur-xl transition-opacity duration-700',
          thinking ? 'opacity-100' : 'opacity-80',
        )}
      />

      <svg
        className="relative h-full w-full drop-shadow-[0_0_28px_rgba(126,182,255,0.35)]"
        viewBox="0 0 280 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="corePlane" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8f4ff" stopOpacity="0.42" />
            <stop offset="45%" stopColor="#7eb6ff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="coreSeam" x1="0" y1="0.5" x2="1" y2="0.5">
            <stop offset="0%" stopColor="#8eeafa" stopOpacity="0" />
            <stop offset="48%" stopColor="#8eeafa" stopOpacity={thinking ? 0.85 : 0.55} />
            <stop offset="52%" stopColor="#8eeafa" stopOpacity={thinking ? 0.85 : 0.55} />
            <stop offset="100%" stopColor="#8eeafa" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="coreEdge" x1="0.2" y1="0" x2="0.9" y2="1">
            <stop offset="0%" stopColor="#dceeff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#4a6a8a" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {/* Outer plane — slightly misaligned */}
        <ellipse
          cx="140"
          cy="142"
          rx="108"
          ry="102"
          stroke="url(#coreEdge)"
          strokeWidth="0.7"
          fill="none"
          opacity="0.45"
          transform="rotate(-4 140 142)"
        />

        {/* Mid glass plane */}
        <path
          d="M 148 72 L 218 118 L 192 198 L 108 168 Z"
          fill="url(#corePlane)"
          stroke="rgba(200,220,240,0.2)"
          strokeWidth="0.5"
          opacity="0.85"
          className={thinking ? 'motion-safe:animate-[atlas-plane-drift_2.2s_ease-in-out_infinite]' : undefined}
        />

        {/* Inner arc fragment */}
        <path
          d="M 98 148 A 72 86 0 0 1 228 168"
          stroke="url(#coreEdge)"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />

        {/* Cyan seam — register alignment */}
        <line
          x1="88"
          y1="138"
          x2="192"
          y2="132"
          stroke="url(#coreSeam)"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Lower plane shard */}
        <path
          d="M 118 188 L 168 158 L 198 212 L 142 238 Z"
          fill="rgba(126,182,255,0.06)"
          stroke="rgba(142,234,250,0.18)"
          strokeWidth="0.45"
          opacity="0.7"
        />

        {/* Slow orbit trace */}
        <g
          className={
            thinking
              ? 'motion-safe:animate-[atlas-orbit-slow_12s_linear_infinite] origin-center [transform-box:fill-box] [transform-origin:140px_140px]'
              : 'motion-safe:animate-[atlas-orbit-slow_24s_linear_infinite] origin-center [transform-box:fill-box] [transform-origin:140px_140px]'
          }
        >
          <path
            d="M 52 168 A 116 88 0 0 1 248 112"
            stroke="rgba(126,182,255,0.12)"
            strokeWidth="0.45"
            strokeDasharray="3 9"
            fill="none"
          />
        </g>
      </svg>
    </div>
  );
}

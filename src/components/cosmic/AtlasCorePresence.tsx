import { useId } from 'react';

import { cn } from '../../utils/cn';

interface AtlasCorePresenceProps {
  className?: string;
  /** idle | thinking */
  state?: 'idle' | 'thinking';
}

/**
 * Register aperture — quiet observation mark for the conversation field.
 * Incomplete orbits + alignment ticks; not an AI orb / loading glyph.
 */
export default function AtlasCorePresence({
  className,
  state = 'idle',
}: AtlasCorePresenceProps) {
  const thinking = state === 'thinking';
  const uid = useId().replace(/:/g, '');
  const edgeId = `atlas-aperture-edge-${uid}`;
  const seamId = `atlas-aperture-seam-${uid}`;

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
          'absolute inset-[18%] rounded-full',
          'bg-[radial-gradient(circle,rgba(201,179,122,0.10),transparent_68%)]',
          'blur-2xl transition-opacity duration-700',
          thinking ? 'opacity-90' : 'opacity-55',
        )}
      />

      <svg
        className="relative h-full w-full"
        viewBox="0 0 280 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={edgeId} x1="0.15" y1="0" x2="0.9" y2="1">
            <stop offset="0%" stopColor="#f5f0e6" stopOpacity="0.42" />
            <stop offset="55%" stopColor="#c9b37a" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#8b7a4a" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id={seamId} x1="0" y1="0.5" x2="1" y2="0.5">
            <stop offset="0%" stopColor="#c9b37a" stopOpacity="0" />
            <stop offset="48%" stopColor="#c9b37a" stopOpacity={thinking ? 0.7 : 0.38} />
            <stop offset="52%" stopColor="#c9b37a" stopOpacity={thinking ? 0.7 : 0.38} />
            <stop offset="100%" stopColor="#c9b37a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer incomplete orbit */}
        <path
          d="M 54 168 A 118 104 0 0 1 226 96"
          stroke={`url(#${edgeId})`}
          strokeWidth="0.7"
          strokeLinecap="round"
          fill="none"
          opacity="0.55"
        />

        {/* Counter orbit — misaligned, dashed */}
        <g
          className={
            thinking
              ? 'motion-safe:animate-[atlas-orbit-slow_18s_linear_infinite] origin-center [transform-box:fill-box] [transform-origin:140px_140px]'
              : 'motion-safe:animate-[atlas-orbit-slow_32s_linear_infinite] origin-center [transform-box:fill-box] [transform-origin:140px_140px]'
          }
        >
          <path
            d="M 72 92 A 108 92 0 0 1 214 198"
            stroke="rgba(201,179,122,0.16)"
            strokeWidth="0.55"
            strokeDasharray="2.5 11"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Inner aperture ring — broken at seam */}
        <path
          d="M 102 168 A 48 48 0 1 1 178 112"
          stroke={`url(#${edgeId})`}
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />

        {/* Soft plane shard — register fragment */}
        <path
          d="M 148 78 L 196 118 L 176 168 L 128 142 Z"
          fill="rgba(245,240,230,0.03)"
          stroke="rgba(232,217,168,0.14)"
          strokeWidth="0.45"
          opacity={thinking ? 0.9 : 0.65}
          className={
            thinking
              ? 'motion-safe:animate-[atlas-plane-drift_2.8s_ease-in-out_infinite]'
              : undefined
          }
        />

        {/* Gold register seam */}
        <line
          x1="96"
          y1="142"
          x2="184"
          y2="136"
          stroke={`url(#${seamId})`}
          strokeWidth="0.9"
          strokeLinecap="round"
        />

        {/* Alignment ticks */}
        <line x1="140" y1="58" x2="140" y2="72" stroke="rgba(201,179,122,0.28)" strokeWidth="0.7" strokeLinecap="round" />
        <line x1="208" y1="140" x2="222" y2="140" stroke="rgba(201,179,122,0.22)" strokeWidth="0.7" strokeLinecap="round" />
        <line x1="140" y1="208" x2="140" y2="222" stroke="rgba(201,179,122,0.18)" strokeWidth="0.7" strokeLinecap="round" />
        <line x1="58" y1="140" x2="72" y2="140" stroke="rgba(201,179,122,0.18)" strokeWidth="0.7" strokeLinecap="round" />

        {/* Quiet center point — observation focus */}
        <circle
          cx="140"
          cy="140"
          r={thinking ? 2.2 : 1.6}
          fill="rgba(201,179,122,0.55)"
          className="transition-[r] duration-500"
        />
      </svg>
    </div>
  );
}

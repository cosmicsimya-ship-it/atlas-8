import { cn } from '../../utils/cn';

interface AtlasCoreVisualProps {
  className?: string;
}

/**
 * North Star hero anchor.
 * Uses the approved identity asset and keeps supporting geometry quiet so the
 * mark, not an abstract AI orb, owns the visual hierarchy.
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
      {/* Wide silver halo — optical depth, not a glowing orb. */}
      <div className="absolute left-1/2 top-1/2 h-[82%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(226,230,236,0.09)_0%,rgba(151,160,173,0.025)_34%,transparent_69%)] blur-xl" />

      {/* Quiet instrument rings. */}
      <div className="absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.055]" />
      <div className="absolute left-1/2 top-1/2 h-[68%] w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.025]" />
      <div className="absolute left-1/2 top-[8%] h-[84%] w-px -translate-x-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(235,239,244,0.055),transparent)]" />
      <div className="absolute left-[8%] top-1/2 h-px w-[84%] -translate-y-1/2 bg-[linear-gradient(to_right,transparent,rgba(235,239,244,0.045),transparent)]" />

      {/* Approved North Star mark. */}
      <img
        src="/atlas-north-star.png"
        alt=""
        className="absolute left-1/2 top-1/2 z-10 h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.96] drop-shadow-[0_16px_44px_rgba(0,0,0,0.62)]"
      />

      {/* Small material glint — restrained and neutral. */}
      <div className="absolute left-1/2 top-1/2 z-20 h-[8%] w-[8%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.28),rgba(230,234,240,0.06)_34%,transparent_72%)] mix-blend-screen" />

      <div className="hero-core-vignette absolute inset-0" />
    </div>
  );
}

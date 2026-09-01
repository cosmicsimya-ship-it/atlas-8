import { cn } from '../../utils/cn';

interface AtlasCoreVisualProps {
  className?: string;
  /** Preserve the canonical mobile close-crop API while using the North Star identity. */
  crop?: 'desktop' | 'mobile';
}

/**
 * Approved North Star hero anchor.
 * Keeps the canonical desktop/mobile contract while replacing the old abstract
 * observation engine with the product's primary visual identity.
 */
export default function AtlasCoreVisual({ className, crop = 'desktop' }: AtlasCoreVisualProps) {
  const mobile = crop === 'mobile';

  return (
    <div
      className={cn(
        'hero-core-visual relative mx-auto aspect-square w-full overflow-visible',
        mobile ? 'max-w-[min(116vw,520px)]' : 'max-w-[min(100%,440px)] lg:max-w-none',
        className,
      )}
      aria-hidden="true"
    >
      {/* Wide silver halo — optical depth, never a generic glowing AI orb. */}
      <div className="absolute left-1/2 top-1/2 h-[86%] w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(226,230,236,0.09)_0%,rgba(151,160,173,0.025)_34%,transparent_69%)] blur-xl" />

      {/* Quiet compass/instrument geometry. */}
      <div className="absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.055]" />
      <div className="absolute left-1/2 top-1/2 h-[68%] w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.025]" />
      <div className="absolute left-1/2 top-[7%] h-[86%] w-px -translate-x-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(235,239,244,0.055),transparent)]" />
      <div className="absolute left-[7%] top-1/2 h-px w-[86%] -translate-y-1/2 bg-[linear-gradient(to_right,transparent,rgba(235,239,244,0.045),transparent)]" />

      {/* Approved North Star mark. */}
      <img
        src="/atlas-north-star.png"
        alt=""
        className={cn(
          'absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.96] drop-shadow-[0_16px_44px_rgba(0,0,0,0.62)]',
          mobile ? 'h-[84%] w-[84%]' : 'h-[76%] w-[76%]',
        )}
      />

      {/* Restrained neutral material glint. */}
      <div className="absolute left-1/2 top-1/2 z-20 h-[8%] w-[8%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.28),rgba(230,234,240,0.06)_34%,transparent_72%)] mix-blend-screen" />

      <div className="hero-core-vignette absolute inset-0" />
    </div>
  );
}

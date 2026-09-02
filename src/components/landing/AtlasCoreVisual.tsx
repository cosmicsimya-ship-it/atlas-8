import { cn } from '../../utils/cn';

interface AtlasCoreVisualProps {
  className?: string;
  crop?: 'desktop' | 'mobile';
}

/**
 * North Star hero anchor drawn as part of the interface field.
 * No pasted image: the star, axes and orbital geometry are one integrated system.
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
      {/* Deep optical field. */}
      <div className="absolute left-1/2 top-1/2 h-[92%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(70,128,183,0.12)_0%,rgba(29,68,108,0.05)_34%,transparent_70%)] blur-2xl" />

      {/* Instrument rings. */}
      <div className="absolute left-1/2 top-1/2 h-[82%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#90b7da]/[0.08]" />
      <div className="absolute left-1/2 top-1/2 h-[68%] w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#90b7da]/[0.04]" />
      <div className="absolute left-1/2 top-1/2 h-[52%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#90b7da]/[0.028]" />

      {/* Navigation axes. */}
      <div className="absolute left-1/2 top-[5%] h-[90%] w-px -translate-x-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(125,169,208,0.08)_28%,rgba(181,211,236,0.16)_50%,rgba(125,169,208,0.08)_72%,transparent)]" />
      <div className="absolute left-[5%] top-1/2 h-px w-[90%] -translate-y-1/2 bg-[linear-gradient(to_right,transparent,rgba(125,169,208,0.07)_28%,rgba(181,211,236,0.14)_50%,rgba(125,169,208,0.07)_72%,transparent)]" />

      {/* Diagonal bearings. */}
      <div className="absolute left-1/2 top-1/2 h-px w-[72%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[linear-gradient(to_right,transparent,rgba(111,158,198,0.055),transparent)]" />
      <div className="absolute left-1/2 top-1/2 h-px w-[72%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-[linear-gradient(to_right,transparent,rgba(111,158,198,0.055),transparent)]" />

      {/* North Star — constructed from light, not an image asset. */}
      <div className="absolute left-1/2 top-1/2 z-10 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute left-1/2 top-1/2 h-full w-[1.5px] -translate-x-1/2 -translate-y-1/2 bg-[linear-gradient(to_bottom,transparent_0%,rgba(149,193,229,0.12)_18%,rgba(224,240,252,0.9)_49%,rgba(149,193,229,0.12)_82%,transparent_100%)] shadow-[0_0_22px_rgba(109,164,211,0.14)]" />
        <div className="absolute left-1/2 top-1/2 h-[1.5px] w-full -translate-x-1/2 -translate-y-1/2 bg-[linear-gradient(to_right,transparent_0%,rgba(149,193,229,0.1)_18%,rgba(224,240,252,0.82)_49%,rgba(149,193,229,0.1)_82%,transparent_100%)] shadow-[0_0_22px_rgba(109,164,211,0.12)]" />
        <div className="absolute left-1/2 top-1/2 h-[52%] w-[1px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[linear-gradient(to_bottom,transparent,rgba(181,211,235,0.48),transparent)]" />
        <div className="absolute left-1/2 top-1/2 h-[52%] w-[1px] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-[linear-gradient(to_bottom,transparent,rgba(181,211,235,0.48),transparent)]" />
        <div className="absolute left-1/2 top-1/2 h-[17%] w-[17%] -translate-x-1/2 -translate-y-1/2 rotate-45 border border-[#d8e9f7]/45 bg-[#8eb9dd]/[0.035] shadow-[0_0_32px_rgba(108,164,211,0.16)]" />
        <div className="absolute left-1/2 top-1/2 h-[5%] w-[5%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#eef7ff]/75 shadow-[0_0_20px_rgba(183,219,247,0.5)]" />
      </div>

      {/* Tiny orbital nodes keep the identity technical, not decorative. */}
      <div className="absolute left-[18%] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full border border-[#9bc2e2]/30 bg-[#5c8fb9]/25" />
      <div className="absolute right-[18%] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full border border-[#9bc2e2]/30 bg-[#5c8fb9]/25" />
      <div className="absolute left-1/2 top-[18%] h-1.5 w-1.5 -translate-x-1/2 rounded-full border border-[#9bc2e2]/30 bg-[#5c8fb9]/25" />

      <div className="hero-core-vignette absolute inset-0" />
    </div>
  );
}

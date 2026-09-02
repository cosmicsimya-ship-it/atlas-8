import { cn } from '../../utils/cn';

interface AtlasCoreVisualProps {
  className?: string;
  crop?: 'desktop' | 'mobile';
}

/**
 * North Star hero anchor drawn as part of the interface field.
 * The star is intentionally substantial: a brand mark, not a hairline compass.
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
      {/* Deep optical field: blue is concentrated around the instrument, never a full-screen wash. */}
      <div className="absolute left-1/2 top-1/2 h-[90%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(45,89,132,0.11)_0%,rgba(18,43,72,0.035)_38%,transparent_72%)] blur-2xl" />

      {/* Quiet orbital geometry. */}
      <div className="absolute left-1/2 top-1/2 h-[82%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#8eb2d0]/[0.055]" />
      <div className="absolute left-1/2 top-1/2 h-[68%] w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#8eb2d0]/[0.028]" />
      <div className="absolute left-1/2 top-1/2 h-[52%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#8eb2d0]/[0.018]" />

      <div className="absolute left-1/2 top-[6%] h-[88%] w-px -translate-x-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(116,156,190,0.045)_28%,rgba(187,214,235,0.09)_50%,rgba(116,156,190,0.045)_72%,transparent)]" />
      <div className="absolute left-[6%] top-1/2 h-px w-[88%] -translate-y-1/2 bg-[linear-gradient(to_right,transparent,rgba(116,156,190,0.04)_28%,rgba(187,214,235,0.08)_50%,rgba(116,156,190,0.04)_72%,transparent)]" />

      {/* Strong North Star silhouette. */}
      <svg
        viewBox="0 0 320 320"
        className="absolute left-1/2 top-1/2 z-10 h-[64%] w-[64%] -translate-x-1/2 -translate-y-1/2 overflow-visible"
      >
        <defs>
          <linearGradient id="atlasStarFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3f8fc" stopOpacity="0.96" />
            <stop offset="52%" stopColor="#c7dbea" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#83a8c5" stopOpacity="0.72" />
          </linearGradient>
          <filter id="atlasStarGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M160 18 L181 125 L302 160 L181 195 L160 302 L139 195 L18 160 L139 125 Z"
          fill="url(#atlasStarFill)"
          fillOpacity="0.78"
          stroke="#dcecf8"
          strokeOpacity="0.72"
          strokeWidth="2.4"
          filter="url(#atlasStarGlow)"
        />
        <path
          d="M160 72 L174 141 L248 160 L174 179 L160 248 L146 179 L72 160 L146 141 Z"
          fill="#eaf4fb"
          fillOpacity="0.18"
          stroke="#bad5e8"
          strokeOpacity="0.32"
          strokeWidth="1.4"
        />
        <circle cx="160" cy="160" r="12" fill="#f5fbff" fillOpacity="0.9" />
        <circle cx="160" cy="160" r="25" fill="none" stroke="#aac8df" strokeOpacity="0.2" />
      </svg>

      {/* Sparse nodes keep the field technical and calm. */}
      <div className="absolute left-[18%] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full border border-[#9bc2e2]/22 bg-[#5c8fb9]/18" />
      <div className="absolute right-[18%] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full border border-[#9bc2e2]/22 bg-[#5c8fb9]/18" />
      <div className="absolute left-1/2 top-[18%] h-1.5 w-1.5 -translate-x-1/2 rounded-full border border-[#9bc2e2]/22 bg-[#5c8fb9]/18" />

      <div className="hero-core-vignette absolute inset-0" />
    </div>
  );
}

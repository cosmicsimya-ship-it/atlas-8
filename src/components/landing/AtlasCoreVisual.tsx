import { cn } from '../../utils/cn';

interface AtlasCoreVisualProps {
  className?: string;
  crop?: 'desktop' | 'mobile';
}

/**
 * North Star hero anchor integrated into the optical field.
 * Quiet, architectural and premium — never a giant glowing icon.
 */
export default function AtlasCoreVisual({ className, crop = 'desktop' }: AtlasCoreVisualProps) {
  const mobile = crop === 'mobile';

  return (
    <div
      className={cn(
        'hero-core-visual relative mx-auto aspect-square w-full overflow-visible',
        mobile ? 'max-w-[min(112vw,500px)]' : 'max-w-[min(100%,420px)] lg:max-w-none',
        className,
      )}
      aria-hidden="true"
    >
      {/* Local optical depth only. */}
      <div className="absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(42,78,112,0.085)_0%,rgba(18,39,65,0.025)_38%,transparent_74%)] blur-2xl" />

      {/* Observation rings disappear into the page instead of framing a logo. */}
      <div className="absolute left-1/2 top-1/2 h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#9ab4c9]/[0.035]" />
      <div className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#9ab4c9]/[0.018]" />
      <div className="absolute left-1/2 top-[11%] h-[78%] w-px -translate-x-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(145,176,201,0.035),transparent)]" />
      <div className="absolute left-[11%] top-1/2 h-px w-[78%] -translate-y-1/2 bg-[linear-gradient(to_right,transparent,rgba(145,176,201,0.032),transparent)]" />

      {/* North Star: medium-weight outline, no filled neon body. */}
      <svg
        viewBox="0 0 320 320"
        className="absolute left-1/2 top-1/2 z-10 h-[48%] w-[48%] -translate-x-1/2 -translate-y-1/2 overflow-visible"
      >
        <defs>
          <linearGradient id="northStarStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#edf5fb" stopOpacity="0.72" />
            <stop offset="50%" stopColor="#bdd2e2" stopOpacity="0.58" />
            <stop offset="100%" stopColor="#7899b2" stopOpacity="0.34" />
          </linearGradient>
          <filter id="northStarSoftGlow" x="-45%" y="-45%" width="190%" height="190%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M160 30 L177 132 L290 160 L177 188 L160 290 L143 188 L30 160 L143 132 Z"
          fill="rgba(191,215,233,0.025)"
          stroke="url(#northStarStroke)"
          strokeWidth="3.2"
          strokeLinejoin="round"
          filter="url(#northStarSoftGlow)"
        />
        <path
          d="M160 89 L169 148 L231 160 L169 172 L160 231 L151 172 L89 160 L151 148 Z"
          fill="none"
          stroke="#c8dce9"
          strokeOpacity="0.22"
          strokeWidth="1.4"
        />
        <rect
          x="151"
          y="151"
          width="18"
          height="18"
          rx="1"
          transform="rotate(45 160 160)"
          fill="#e9f3fa"
          fillOpacity="0.34"
          stroke="#d9e8f2"
          strokeOpacity="0.36"
          strokeWidth="1.2"
        />
      </svg>

      {/* Sparse registration points. */}
      <div className="absolute left-[20%] top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[#a9c2d5]/22" />
      <div className="absolute right-[20%] top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[#a9c2d5]/22" />
      <div className="absolute left-1/2 top-[20%] h-1 w-1 -translate-x-1/2 rounded-full bg-[#a9c2d5]/22" />

      <div className="hero-core-vignette absolute inset-0" />
    </div>
  );
}

import { cn } from '../../utils/cn';

interface SiteAtmosphereProps {
  className?: string;
}

/**
 * Page-wide visual field for the North Star identity.
 * Deep blue-black, cool optical depth and restrained cobalt accents.
 * The star system is environmental, not a pasted illustration.
 */
export default function SiteAtmosphere({ className }: SiteAtmosphereProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#02050a]" />

      {/* Primary cool depth: dark enough to stay premium, blue enough to avoid flat black. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_10%,rgba(39,92,151,0.16)_0%,rgba(18,43,77,0.07)_28%,transparent_61%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_12%_45%,rgba(83,126,172,0.08)_0%,transparent_44%)]" />
      <div className="absolute inset-x-0 top-[34rem] h-[90rem] bg-[linear-gradient(to_bottom,transparent,rgba(17,37,64,0.12)_34%,rgba(6,18,33,0.18)_58%,transparent_90%)]" />

      {/* Large, low-contrast navigation geometry — part of the atmosphere, not a separate image. */}
      <div className="absolute right-[-25rem] top-[14rem] h-[58rem] w-[58rem] rounded-full border border-[#6ea4d8]/[0.045]" />
      <div className="absolute right-[-17rem] top-[22rem] h-[42rem] w-[42rem] rounded-full border border-[#8fb8df]/[0.026]" />
      <div className="absolute right-[2rem] top-[13rem] h-[64rem] w-px bg-[linear-gradient(to_bottom,transparent,rgba(111,160,205,0.055),transparent)] max-md:hidden" />
      <div className="absolute right-[-1rem] top-[42rem] h-px w-[52rem] bg-[linear-gradient(to_right,transparent,rgba(92,143,190,0.045),transparent)] max-md:hidden" />

      {/* Faint stellar dust; no neon bloom. */}
      <div className="absolute inset-0 opacity-[0.34] [background-image:radial-gradient(circle_at_20%_18%,rgba(200,220,238,0.36)_0_1px,transparent_1.3px),radial-gradient(circle_at_78%_24%,rgba(129,174,214,0.28)_0_1px,transparent_1.2px),radial-gradient(circle_at_64%_70%,rgba(210,227,242,0.18)_0_1px,transparent_1.2px),radial-gradient(circle_at_31%_76%,rgba(120,165,204,0.18)_0_1px,transparent_1.2px)]" />

      <div className="site-grain opacity-[0.032]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(0,2,6,0.58)_100%)]" />
    </div>
  );
}

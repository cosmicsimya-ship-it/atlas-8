import { cn } from '../../utils/cn';

interface SiteAtmosphereProps {
  className?: string;
}

/**
 * Page-wide North Star field.
 * Near-black first; cool blue appears as depth, not as a full-page colour wash.
 */
export default function SiteAtmosphere({ className }: SiteAtmosphereProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#010307]" />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_10%,rgba(31,69,108,0.1)_0%,rgba(15,34,59,0.035)_30%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_12%_45%,rgba(66,100,134,0.04)_0%,transparent_43%)]" />
      <div className="absolute inset-x-0 top-[36rem] h-[92rem] bg-[linear-gradient(to_bottom,transparent,rgba(11,25,43,0.065)_35%,rgba(5,13,24,0.09)_58%,transparent_90%)]" />

      {/* Large, low-contrast navigation geometry. */}
      <div className="absolute right-[-25rem] top-[14rem] h-[58rem] w-[58rem] rounded-full border border-[#7598b5]/[0.032]" />
      <div className="absolute right-[-17rem] top-[22rem] h-[42rem] w-[42rem] rounded-full border border-[#8aa8c0]/[0.018]" />
      <div className="absolute right-[2rem] top-[13rem] h-[64rem] w-px bg-[linear-gradient(to_bottom,transparent,rgba(96,130,160,0.04),transparent)] max-md:hidden" />
      <div className="absolute right-[-1rem] top-[42rem] h-px w-[52rem] bg-[linear-gradient(to_right,transparent,rgba(82,118,151,0.032),transparent)] max-md:hidden" />

      <div className="absolute inset-0 opacity-[0.22] [background-image:radial-gradient(circle_at_20%_18%,rgba(200,220,238,0.28)_0_1px,transparent_1.3px),radial-gradient(circle_at_78%_24%,rgba(129,174,214,0.2)_0_1px,transparent_1.2px),radial-gradient(circle_at_64%_70%,rgba(210,227,242,0.12)_0_1px,transparent_1.2px),radial-gradient(circle_at_31%_76%,rgba(120,165,204,0.12)_0_1px,transparent_1.2px)]" />

      <div className="site-grain opacity-[0.028]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,1,4,0.68)_100%)]" />
    </div>
  );
}

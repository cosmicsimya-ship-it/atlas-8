import { cn } from '../../utils/cn';

interface SiteAtmosphereProps {
  className?: string;
}

/**
 * Page-wide visual field for the North Star identity.
 * Near-black, silver depth and restrained warm-metal reflection only.
 */
export default function SiteAtmosphere({ className }: SiteAtmosphereProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#030304]" />

      {/* Soft silver depth — replaces the previous blue/cyan cast. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_8%,rgba(221,225,232,0.075)_0%,rgba(135,142,153,0.025)_30%,transparent_62%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_48%,rgba(255,255,255,0.035)_0%,transparent_46%)]" />

      {/* Very restrained warm reflection so the old gold language survives only as material depth. */}
      <div className="absolute inset-x-0 top-[18%] h-[34rem] bg-[radial-gradient(ellipse_at_50%_50%,rgba(201,179,122,0.025),transparent_68%)]" />

      {/* Large compass geometry; intentionally almost subliminal. */}
      <div className="absolute right-[-24rem] top-[18rem] h-[54rem] w-[54rem] rounded-full border border-white/[0.025]" />
      <div className="absolute right-[-17rem] top-[25rem] h-[40rem] w-[40rem] rounded-full border border-white/[0.018]" />
      <div className="absolute right-[2rem] top-[16rem] h-[58rem] w-px bg-[linear-gradient(to_bottom,transparent,rgba(235,238,243,0.035),transparent)] max-md:hidden" />

      {/* Long page-light, keeping lower sections from turning into flat black cards. */}
      <div className="absolute inset-x-0 top-[48rem] h-[82rem] bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.012)_32%,rgba(255,255,255,0.022)_52%,transparent_88%)]" />

      <div className="site-grain opacity-[0.035]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.48)_100%)]" />
    </div>
  );
}

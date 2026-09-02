import { cn } from '../../utils/cn';

interface SiteAtmosphereProps { className?: string; }

export default function SiteAtmosphere({ className }: SiteAtmosphereProps) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
      <div className="absolute inset-0 bg-[#040405]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_74%_7%,rgba(255,255,255,0.038)_0%,transparent_38%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_12%_44%,rgba(255,255,255,0.018)_0%,transparent_42%)]" />
      <div className="absolute right-[-24rem] top-[18rem] h-[56rem] w-[56rem] rounded-full border border-white/[0.02]" />
      <div className="absolute right-[-16rem] top-[26rem] h-[40rem] w-[40rem] rounded-full border border-white/[0.012]" />
      <div className="absolute right-[2rem] top-[16rem] h-[58rem] w-px bg-[linear-gradient(to_bottom,transparent,rgba(238,239,241,0.028),transparent)] max-md:hidden" />
      <div className="absolute inset-x-0 top-[48rem] h-[94rem] bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.01)_35%,rgba(255,255,255,0.016)_54%,transparent_88%)]" />
      <div className="site-grain opacity-[0.03]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_44%,rgba(0,0,0,0.54)_100%)]" />
    </div>
  );
}

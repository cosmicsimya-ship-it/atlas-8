export default function HeroAtmosphere() {
  return (
    <div className="hero-atmosphere pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[#040405]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_79%_40%,rgba(255,255,255,0.055)_0%,rgba(190,193,199,0.018)_30%,transparent_62%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_58%_4%,rgba(255,255,255,0.026)_0%,transparent_38%)]" />
      <div className="absolute right-[-7%] top-[8%] h-[72vmin] w-[72vmin] rounded-full border border-white/[0.035] max-md:right-[-35%] max-md:top-[35%]" />
      <div className="absolute right-[1%] top-[16%] h-[58vmin] w-[58vmin] rounded-full border border-white/[0.018] max-md:hidden" />
      <div className="absolute right-[31%] top-[8%] h-[76%] w-px bg-[linear-gradient(to_bottom,transparent,rgba(238,239,241,0.04),transparent)] max-md:hidden" />
      <div className="absolute right-[-2%] top-[47%] h-px w-[68%] bg-[linear-gradient(to_right,transparent,rgba(238,239,241,0.035),transparent)] max-md:hidden" />
      <div className="absolute inset-x-0 bottom-0 h-[44%] bg-[linear-gradient(to_top,rgba(255,255,255,0.018),transparent_62%)]" />
      <div className="site-grain hero-grain opacity-[0.035]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_48%,rgba(0,0,0,0.58)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_54%,#040405_100%)]" />
    </div>
  );
}

/**
 * Hero atmosphere — black/silver compass identity.
 * No blue/cyan field: light is neutral metal only.
 */
export default function HeroAtmosphere() {
  return (
    <div className="hero-atmosphere pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[#020203]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_76%_38%,rgba(238,239,241,0.055)_0%,rgba(170,173,180,0.018)_30%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_58%_7%,rgba(255,255,255,0.026)_0%,transparent_42%)]" />
      <div className="absolute right-[-9%] top-[10%] h-[58vmin] w-[62vmin] rounded-full bg-[radial-gradient(circle,rgba(220,222,226,0.035),transparent_72%)] blur-[110px]" />

      <div className="absolute right-[-4%] top-[10%] h-[72vmin] w-[72vmin] rounded-full border border-white/[0.018] max-md:right-[-34%] max-md:top-[35%]" />
      <div className="absolute right-[3%] top-[17%] h-[58vmin] w-[58vmin] rounded-full border border-white/[0.012] max-md:hidden" />
      <div className="absolute right-[32%] top-[7%] h-[78%] w-px bg-[linear-gradient(to_bottom,transparent,rgba(240,240,240,0.026),transparent)] max-md:hidden" />
      <div className="absolute right-[-1%] top-[45%] h-px w-[68%] bg-[linear-gradient(to_right,transparent,rgba(240,240,240,0.022),transparent)] max-md:hidden" />

      <div className="site-grain hero-grain opacity-[0.022]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_48%,rgba(0,0,0,0.46)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_54%,#020203_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_62%,rgba(2,2,3,0.54)_84%,#020203_100%)] max-md:hidden" />
    </div>
  );
}

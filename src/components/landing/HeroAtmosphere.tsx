/**
 * Hero atmosphere — North Star identity.
 * Deep black, silver optical depth, restrained warm-metal reflection.
 */
export default function HeroAtmosphere() {
  return (
    <div
      className="hero-atmosphere pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#030304]" />

      {/* Silver light field instead of navy/violet/cyan atmosphere. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_38%,rgba(225,229,235,0.09)_0%,rgba(135,143,154,0.028)_28%,transparent_61%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_62%_8%,rgba(255,255,255,0.045)_0%,transparent_45%)]" />

      {/* Volumetric metal haze. */}
      <div className="hero-haze absolute inset-0">
        <div className="absolute right-[-10%] top-[7%] h-[58vmin] w-[64vmin] rounded-full bg-[radial-gradient(circle,rgba(210,216,225,0.075),transparent_70%)] blur-[100px] site-animate-drift max-md:h-[46vmin] max-md:w-[52vmin] max-md:opacity-55" />
        <div className="absolute right-[8%] top-[42%] h-[32vmin] w-[38vmin] rounded-full bg-[radial-gradient(circle,rgba(160,169,182,0.055),transparent_74%)] blur-[72px] site-animate-pulse-soft max-md:hidden" />
        <div className="absolute left-[35%] top-[60%] h-[24vmin] w-[30vmin] rounded-full bg-[radial-gradient(circle,rgba(201,179,122,0.026),transparent_72%)] blur-[56px] opacity-55 max-md:hidden" />
      </div>

      {/* Compass-scale geometry, subtle enough to read as depth rather than illustration. */}
      <div className="absolute right-[-5%] top-[9%] h-[76vmin] w-[76vmin] rounded-full border border-white/[0.035] max-md:right-[-34%] max-md:top-[34%] max-md:h-[72vmin] max-md:w-[72vmin]" />
      <div className="absolute right-[2%] top-[16%] h-[62vmin] w-[62vmin] rounded-full border border-white/[0.018] max-md:hidden" />
      <div className="absolute right-[33%] top-[5%] h-[82%] w-px bg-[linear-gradient(to_bottom,transparent,rgba(236,239,244,0.045),transparent)] max-md:hidden" />
      <div className="absolute right-[-2%] top-[44%] h-px w-[72%] bg-[linear-gradient(to_right,transparent,rgba(236,239,244,0.04),transparent)] max-md:hidden" />

      {/* Soft floor reflection. */}
      <div className="absolute inset-x-0 bottom-0 h-[46%] bg-[linear-gradient(to_top,rgba(205,212,222,0.035)_0%,transparent_60%)] opacity-65 max-md:opacity-35" />
      <div className="absolute right-[21%] top-[29%] h-[14vmin] w-[14vmin] rounded-full bg-[radial-gradient(circle,rgba(246,242,226,0.07),transparent_68%)] opacity-45 mix-blend-screen max-md:opacity-20" />

      {/* Refraction without a colored neon streak. */}
      <div className="hero-refraction absolute inset-0 opacity-35 max-md:opacity-18">
        <div className="absolute inset-0 bg-[linear-gradient(122deg,transparent_48%,rgba(232,236,242,0.035)_50%,transparent_54%)] max-md:hidden" />
        <div className="hero-lens-flare absolute right-[5%] top-[22%] h-[34vmin] w-[34vmin] max-md:right-[-6%] max-md:top-[36%] max-md:h-[42vmin] max-md:w-[42vmin]" />
      </div>

      <div className="site-grain hero-grain" />
      <div className="hero-lens-texture absolute inset-0 opacity-[0.055] mix-blend-overlay max-md:opacity-[0.035]" />
      <div className="hero-core-vignette absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_54%,#030304_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_60%,rgba(3,3,4,0.48)_84%,#030304_100%)] max-md:hidden" />
    </div>
  );
}

/**
 * Hero atmosphere — integrated North Star identity.
 * Blue-black, restrained and concentrated around the optical core.
 */
export default function HeroAtmosphere() {
  return (
    <div
      className="hero-atmosphere pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#010307]" />

      {/* Cool depth is localised to the right-side instrument, not washed across the whole viewport. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_39%,rgba(38,79,119,0.13)_0%,rgba(18,39,65,0.045)_30%,transparent_61%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_67%_9%,rgba(104,139,171,0.055)_0%,transparent_42%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(116deg,#010307_0%,#02060c_44%,rgba(5,14,25,0.82)_70%,#010307_100%)]" />

      {/* Very low-saturation volume. */}
      <div className="hero-haze absolute inset-0">
        <div className="absolute right-[-10%] top-[7%] h-[58vmin] w-[64vmin] rounded-full bg-[radial-gradient(circle,rgba(49,92,132,0.085),transparent_72%)] blur-[118px] site-animate-drift max-md:h-[46vmin] max-md:w-[52vmin] max-md:opacity-55" />
        <div className="absolute right-[10%] top-[43%] h-[32vmin] w-[38vmin] rounded-full bg-[radial-gradient(circle,rgba(54,88,119,0.05),transparent_75%)] blur-[82px] site-animate-pulse-soft max-md:hidden" />
      </div>

      {/* Compass geometry integrated into the field. */}
      <div className="absolute right-[-5%] top-[9%] h-[76vmin] w-[76vmin] rounded-full border border-[#86a9c5]/[0.045] max-md:right-[-34%] max-md:top-[34%] max-md:h-[72vmin] max-md:w-[72vmin]" />
      <div className="absolute right-[2%] top-[16%] h-[62vmin] w-[62vmin] rounded-full border border-[#86a9c5]/[0.022] max-md:hidden" />
      <div className="absolute right-[33%] top-[5%] h-[82%] w-px bg-[linear-gradient(to_bottom,transparent,rgba(111,148,181,0.045),transparent)] max-md:hidden" />
      <div className="absolute right-[-2%] top-[44%] h-px w-[72%] bg-[linear-gradient(to_right,transparent,rgba(95,134,169,0.04),transparent)] max-md:hidden" />

      {/* Sparse stellar points. */}
      <div className="absolute inset-0 opacity-[0.3] [background-image:radial-gradient(circle_at_74%_20%,rgba(220,235,248,0.5)_0_1px,transparent_1.4px),radial-gradient(circle_at_84%_51%,rgba(133,180,220,0.3)_0_1px,transparent_1.3px),radial-gradient(circle_at_58%_66%,rgba(203,224,242,0.22)_0_1px,transparent_1.2px),radial-gradient(circle_at_91%_72%,rgba(105,154,197,0.2)_0_1px,transparent_1.2px)]" />

      <div className="absolute inset-x-0 bottom-0 h-[46%] bg-[linear-gradient(to_top,rgba(18,40,66,0.055)_0%,transparent_62%)] opacity-60 max-md:opacity-35" />
      <div className="site-grain hero-grain" />
      <div className="hero-lens-texture absolute inset-0 opacity-[0.035] mix-blend-overlay max-md:opacity-[0.025]" />
      <div className="hero-core-vignette absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_52%,#010307_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_56%,rgba(1,3,7,0.34)_82%,#010307_100%)] max-md:hidden" />
    </div>
  );
}

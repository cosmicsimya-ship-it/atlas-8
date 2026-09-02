/**
 * Hero atmosphere — integrated North Star identity.
 * Deep blue-black with restrained optical depth; deliberately avoids neon cyan.
 */
export default function HeroAtmosphere() {
  return (
    <div
      className="hero-atmosphere pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#02050a]" />

      {/* Main light field: cool, dimensional, not glowing. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_38%,rgba(48,101,157,0.19)_0%,rgba(23,52,87,0.075)_30%,transparent_62%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_64%_7%,rgba(128,164,198,0.09)_0%,transparent_44%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(118deg,rgba(2,5,10,0.96)_0%,rgba(4,10,19,0.9)_42%,rgba(6,17,31,0.72)_70%,rgba(2,5,10,0.94)_100%)]" />

      {/* Volumetric blue haze — broad, low saturation. */}
      <div className="hero-haze absolute inset-0">
        <div className="absolute right-[-10%] top-[6%] h-[60vmin] w-[66vmin] rounded-full bg-[radial-gradient(circle,rgba(61,115,169,0.12),transparent_72%)] blur-[112px] site-animate-drift max-md:h-[48vmin] max-md:w-[54vmin] max-md:opacity-65" />
        <div className="absolute right-[9%] top-[42%] h-[34vmin] w-[40vmin] rounded-full bg-[radial-gradient(circle,rgba(67,108,151,0.075),transparent_75%)] blur-[78px] site-animate-pulse-soft max-md:hidden" />
      </div>

      {/* Compass geometry integrated into the field. */}
      <div className="absolute right-[-5%] top-[9%] h-[76vmin] w-[76vmin] rounded-full border border-[#8ab5db]/[0.06] max-md:right-[-34%] max-md:top-[34%] max-md:h-[72vmin] max-md:w-[72vmin]" />
      <div className="absolute right-[2%] top-[16%] h-[62vmin] w-[62vmin] rounded-full border border-[#8ab5db]/[0.032] max-md:hidden" />
      <div className="absolute right-[33%] top-[5%] h-[82%] w-px bg-[linear-gradient(to_bottom,transparent,rgba(118,164,205,0.065),transparent)] max-md:hidden" />
      <div className="absolute right-[-2%] top-[44%] h-px w-[72%] bg-[linear-gradient(to_right,transparent,rgba(103,154,198,0.055),transparent)] max-md:hidden" />

      {/* Sparse stellar points. */}
      <div className="absolute inset-0 opacity-[0.48] [background-image:radial-gradient(circle_at_74%_20%,rgba(220,235,248,0.65)_0_1px,transparent_1.4px),radial-gradient(circle_at_84%_51%,rgba(133,180,220,0.42)_0_1px,transparent_1.3px),radial-gradient(circle_at_58%_66%,rgba(203,224,242,0.34)_0_1px,transparent_1.2px),radial-gradient(circle_at_91%_72%,rgba(105,154,197,0.3)_0_1px,transparent_1.2px)]" />

      {/* Floor reflection and optical falloff. */}
      <div className="absolute inset-x-0 bottom-0 h-[46%] bg-[linear-gradient(to_top,rgba(26,57,91,0.09)_0%,transparent_62%)] opacity-70 max-md:opacity-45" />
      <div className="hero-refraction absolute inset-0 opacity-25 max-md:opacity-15">
        <div className="absolute inset-0 bg-[linear-gradient(122deg,transparent_48%,rgba(124,164,201,0.045)_50%,transparent_54%)] max-md:hidden" />
      </div>

      <div className="site-grain hero-grain" />
      <div className="hero-lens-texture absolute inset-0 opacity-[0.045] mix-blend-overlay max-md:opacity-[0.03]" />
      <div className="hero-core-vignette absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_54%,#02050a_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_58%,rgba(2,5,10,0.36)_82%,#02050a_100%)] max-md:hidden" />
    </div>
  );
}

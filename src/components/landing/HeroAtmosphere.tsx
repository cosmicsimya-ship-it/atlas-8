/**
 * Warm charcoal atmospheric world — champagne light as illumination.
 * No navy / blue wash. No purple.
 */
export default function HeroAtmosphere() {
  return (
    <div
      className="hero-atmosphere pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#050505]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_38%,#10100e_0%,transparent_55%)] opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_72%,#0b0a08_0%,transparent_50%)] opacity-80" />

      {/* Low-frequency warm illumination */}
      <div className="hero-haze absolute inset-0">
        <div className="absolute right-[-8%] top-[8%] h-[58vmin] w-[64vmin] rounded-full bg-[radial-gradient(circle,rgba(201,179,122,0.07),transparent_68%)] blur-[90px] site-animate-drift max-md:right-[-20%] max-md:top-[40%] max-md:h-[50vmin] max-md:w-[56vmin] max-md:bg-[radial-gradient(circle,rgba(201,179,122,0.06),transparent_70%)] max-md:opacity-70 max-md:blur-[40px]" />
        <div className="absolute right-[12%] top-[36%] h-[34vmin] w-[40vmin] rounded-full bg-[radial-gradient(circle,rgba(232,217,168,0.045),transparent_72%)] blur-[64px] obs-light-sweep max-md:hidden" />
        <div className="absolute left-[30%] top-[58%] h-[28vmin] w-[34vmin] rounded-full bg-[radial-gradient(circle,rgba(139,122,74,0.04),transparent_70%)] blur-[52px] opacity-70 max-md:hidden" />
      </div>

      {/* Floor reflection */}
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(to_top,rgba(201,179,122,0.045)_0%,transparent_58%)] opacity-50 max-md:opacity-28" />

      {/* Champagne specular whisper */}
      <div className="absolute right-[22%] top-[26%] h-[18vmin] w-[18vmin] rounded-full bg-[radial-gradient(circle,rgba(245,240,230,0.08),transparent_70%)] blur-[1px] opacity-45 mix-blend-screen max-md:opacity-22" />

      <div className="hero-refraction absolute inset-0 opacity-35 max-md:opacity-18">
        <div className="absolute inset-0 bg-[linear-gradient(118deg,transparent_46%,rgba(245,240,230,0.035)_50%,transparent_54%)] max-md:hidden" />
      </div>

      <div className="site-grain hero-grain" />
      <div className="hero-lens-texture absolute inset-0 opacity-[0.06] mix-blend-overlay max-md:opacity-[0.03]" />

      <div className="hero-core-vignette absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,#050505_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(5,5,5,0.72)_0%,rgba(5,5,5,0.35)_38%,transparent_62%)] max-md:bg-[linear-gradient(to_bottom,rgba(5,5,5,0.55)_0%,transparent_30%,transparent_58%,rgba(5,5,5,0.5)_100%)]" />
    </div>
  );
}

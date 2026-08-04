/**
 * Hero atmosphere — Figma ATLAS: deep void, navy/violet wash,
 * gold specular whisper, optical grain. No neon / galaxy wallpaper.
 */
export default function HeroAtmosphere() {
  return (
    <div
      className="hero-atmosphere pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Layer 1 — coal void */}
      <div className="absolute inset-0 bg-[#050608]" />

      {/* Layer 2 — deep navy base plane */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_42%,#0b1220_0%,transparent_58%)] opacity-70" />

      {/* Layer 3 — violet night wash (controlled, not purple neon) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_88%_18%,rgba(26,21,48,0.55)_0%,transparent_52%)] opacity-80" />

      {/* Layer 4 — volumetric fog */}
      <div className="hero-haze absolute inset-0">
        <div className="absolute right-[-12%] top-[10%] h-[54vmin] w-[60vmin] rounded-full bg-[radial-gradient(circle,rgba(130,138,150,0.08),transparent_70%)] blur-[92px] site-animate-drift max-md:h-[42vmin] max-md:w-[48vmin] max-md:opacity-50" />
        <div className="absolute right-[6%] top-[40%] h-[36vmin] w-[42vmin] rounded-full bg-[radial-gradient(circle,rgba(90,100,120,0.06),transparent_74%)] blur-[68px] site-animate-pulse-soft max-md:hidden" />
        <div className="absolute left-[38%] top-[62%] h-[24vmin] w-[30vmin] rounded-full bg-[radial-gradient(circle,rgba(201,179,122,0.035),transparent_72%)] blur-[52px] opacity-60 max-md:hidden" />
      </div>

      {/* Layer 5 — soft floor reflection + gold specular */}
      <div className="absolute inset-x-0 bottom-0 h-[44%] bg-[linear-gradient(to_top,rgba(180,188,200,0.04)_0%,transparent_58%)] opacity-55 max-md:opacity-30" />
      <div className="absolute right-[20%] top-[28%] h-[16vmin] w-[16vmin] rounded-full bg-[radial-gradient(circle,rgba(232,220,180,0.08),transparent_70%)] blur-[1px] opacity-50 mix-blend-screen max-md:opacity-25" />

      {/* Layer 6 — refraction / lens */}
      <div className="hero-refraction absolute inset-0 opacity-40 max-md:opacity-22">
        <div className="absolute inset-0 bg-[linear-gradient(122deg,transparent_48%,rgba(210,218,226,0.045)_50%,transparent_54%)] max-md:hidden" />
        <div className="hero-lens-flare absolute right-[5%] top-[22%] h-[34vmin] w-[34vmin] max-md:right-[-6%] max-md:top-[36%] max-md:h-[42vmin] max-md:w-[42vmin]" />
      </div>

      {/* Layer 7 — grain + micro texture */}
      <div className="site-grain hero-grain" />
      <div className="hero-lens-texture absolute inset-0 opacity-[0.07] mix-blend-overlay max-md:opacity-[0.04]" />

      {/* Depth vignette */}
      <div className="hero-core-vignette absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_55%,#050608_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_60%,rgba(5,6,8,0.5)_84%,#050608_100%)] max-md:hidden" />
    </div>
  );
}

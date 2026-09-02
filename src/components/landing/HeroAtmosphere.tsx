/**
 * Hero atmosphere — integrated North Star identity.
 * Near-black first, with a restrained cool field concentrated around the optical core.
 */
export default function HeroAtmosphere() {
  return (
    <div
      className="hero-atmosphere pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#010205]" />

      {/* Cool depth stays local to the right-hand observation field. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_40%,rgba(34,68,101,0.09)_0%,rgba(15,31,50,0.028)_30%,transparent_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_10%,rgba(98,128,153,0.035)_0%,transparent_40%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(116deg,#010205_0%,#02050a_46%,rgba(4,11,19,0.88)_70%,#010205_100%)]" />

      {/* Very restrained volume — enough depth, no blue fog. */}
      <div className="hero-haze absolute inset-0">
        <div className="absolute right-[-8%] top-[10%] h-[52vmin] w-[58vmin] rounded-full bg-[radial-gradient(circle,rgba(45,78,108,0.055),transparent_72%)] blur-[126px] site-animate-drift max-md:h-[42vmin] max-md:w-[48vmin] max-md:opacity-45" />
      </div>

      {/* Geometry almost disappears until the eye reaches the star. */}
      <div className="absolute right-[-4%] top-[11%] h-[72vmin] w-[72vmin] rounded-full border border-[#9ab3c7]/[0.028] max-md:right-[-34%] max-md:top-[34%] max-md:h-[70vmin] max-md:w-[70vmin]" />
      <div className="absolute right-[4%] top-[18%] h-[56vmin] w-[56vmin] rounded-full border border-[#9ab3c7]/[0.014] max-md:hidden" />
      <div className="absolute right-[33%] top-[8%] h-[78%] w-px bg-[linear-gradient(to_bottom,transparent,rgba(132,158,180,0.028),transparent)] max-md:hidden" />

      {/* Sparse points, not a starfield effect. */}
      <div className="absolute inset-0 opacity-[0.2] [background-image:radial-gradient(circle_at_74%_20%,rgba(220,235,248,0.44)_0_1px,transparent_1.4px),radial-gradient(circle_at_85%_52%,rgba(133,180,220,0.22)_0_1px,transparent_1.3px),radial-gradient(circle_at_91%_72%,rgba(105,154,197,0.15)_0_1px,transparent_1.2px)]" />

      <div className="absolute inset-x-0 bottom-0 h-[48%] bg-[linear-gradient(to_top,rgba(12,25,40,0.038)_0%,transparent_64%)]" />
      <div className="site-grain hero-grain" />
      <div className="hero-lens-texture absolute inset-0 opacity-[0.025] mix-blend-overlay max-md:opacity-[0.018]" />
      <div className="hero-core-vignette absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,#010205_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_57%,rgba(1,2,5,0.4)_83%,#010205_100%)] max-md:hidden" />
    </div>
  );
}

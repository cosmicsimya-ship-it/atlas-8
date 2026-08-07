import { landingManifestoTeaser } from '../../data/landing-content';

export default function ManifestoTeaser() {
  const { id, titleLines, principles } = landingManifestoTeaser;

  return (
    <section id={id} className="atlas-section relative scroll-mt-24" aria-labelledby="manifesto-teaser-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
              İlke
            </p>
            <h2
              id="manifesto-teaser-title"
              className="mt-4 font-display text-[clamp(1.75rem,4vw,2.85rem)] font-medium leading-[1.15] tracking-[-0.02em] text-[#e8ecf2]"
            >
              {titleLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>
          </div>

          <ul className="space-y-4 text-left lg:max-w-xl">
            {principles.map((item, index) => (
              <li
                key={item}
                className="border-t border-white/[0.08] pt-4 text-[15px] leading-7 text-[#9aa3ae] first:border-t-0 first:pt-0"
              >
                <span className="mr-3 font-mono text-[11px] tracking-[0.22em] text-[#c9b37a]/55">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-[#d6dbe3]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

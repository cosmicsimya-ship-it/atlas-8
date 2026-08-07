import { landingLooks } from '../../data/landing-content';

export default function AtlasLooks() {
  const { id, eyebrow, title, items } = landingLooks;

  return (
    <section id={id} className="atlas-section relative scroll-mt-24" aria-labelledby="looks-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#c9b37a]/65">
            {eyebrow}
          </p>
          <h2
            id="looks-title"
            className="mt-4 font-display text-[clamp(1.85rem,4vw,2.75rem)] font-medium tracking-[-0.02em] text-[#e8ecf2]"
          >
            {title}
          </h2>
        </div>

        <ul className="mt-14 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.title} className="border-t border-white/[0.08] pt-5">
              <h3 className="font-brand text-lg font-semibold tracking-[-0.01em] text-[#e8ecf2]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#8b93a3]">{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

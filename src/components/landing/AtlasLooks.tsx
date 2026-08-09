import { useEffect, useRef, useState } from 'react';

import { landingLooks } from '../../data/landing-content';
import ObservatoryField from './ObservatoryField';
import { cn } from '../../utils/cn';

/**
 * Observation array — one focused instrument + secondary indices.
 * Spatial editorial, not admin list / card grid.
 */
export default function AtlasLooks() {
  const { id, eyebrow, title, items } = landingLooks;
  const [active, setActive] = useState(0);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const nodes = itemRefs.current.filter(Boolean) as HTMLLIElement[];
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const idx = Number((visible.target as HTMLElement).dataset.index);
        if (!Number.isNaN(idx)) setActive(idx);
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: [0.2, 0.5, 0.8] },
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [items.length]);

  const featured = items[active] ?? items[0];

  return (
    <section id={id} className="atlas-section relative scroll-mt-24 overflow-hidden" aria-labelledby="looks-title">
      <ObservatoryField density="subtle" className="opacity-35 max-md:opacity-22" />

      {/* Distant geometry plane */}
      <div
        className="pointer-events-none absolute -right-[12%] top-[18%] h-[70%] w-[55%] opacity-30 max-md:hidden"
        aria-hidden="true"
      >
        <svg viewBox="0 0 400 400" className="h-full w-full" fill="none">
          <ellipse cx="220" cy="200" rx="160" ry="140" stroke="rgba(201,179,122,0.12)" strokeWidth="0.8" />
          <ellipse
            cx="220"
            cy="200"
            rx="110"
            ry="95"
            stroke="rgba(201,179,122,0.08)"
            strokeWidth="0.6"
            strokeDasharray="3 10"
            className="obs-orbit-ultra origin-center [transform-box:fill-box] [transform-origin:220px_200px]"
          />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[0.7rem] font-medium tracking-[0.28em] text-[#c9b37a]/65">
              {eyebrow}
            </p>
            <h2
              id="looks-title"
              className="mt-4 font-display text-[clamp(1.85rem,4vw,2.75rem)] font-medium tracking-[-0.02em] text-[#f5f0e6]"
            >
              {title}
            </h2>
          </div>
        </div>

        <div className="relative mt-14 grid items-start gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-8">
          {/* Focused instrument — typography + giant index, no card chrome */}
          <div className="relative min-h-[16rem] lg:sticky lg:top-28 lg:min-h-[22rem]">
            <p
              className="pointer-events-none absolute -left-4 -top-10 font-display text-[clamp(7rem,18vw,12rem)] leading-none tracking-[-0.04em] text-[#c9b37a]/[0.08] transition-opacity duration-500 sm:-left-8"
              aria-hidden="true"
            >
              {String(active + 1).padStart(2, '0') === featured.index
                ? featured.index
                : featured.index}
            </p>
            <div className="relative pt-8 sm:pt-12">
              <div className="mb-6 h-px w-16 bg-[#c9b37a]/40" aria-hidden="true" />
              <p className="font-mono text-[0.7rem] tracking-[0.2em] text-[#c9b37a]/55">
                {featured.index} · {featured.layer} · {featured.system}
              </p>
              <h3 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.08] tracking-[-0.02em] text-[#f5f0e6] transition-colors duration-500">
                {featured.title}
              </h3>
              <p className="mt-6 max-w-md text-[15px] leading-7 text-[#9a9488] sm:text-base sm:leading-8">
                {featured.text}
              </p>
            </div>
          </div>

          {/* Secondary index — quiet rail */}
          <ul className="relative space-y-0 lg:pt-6">
            {items.map((item, i) => (
              <li
                key={item.title}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                data-index={i}
                data-active={i === active}
                className={cn(
                  'obs-array-item border-b border-white/[0.05] py-4 transition-opacity duration-400 first:border-t first:border-white/[0.05]',
                  i === active ? 'opacity-100' : 'opacity-40 hover:opacity-70',
                )}
              >
                <button
                  type="button"
                  className="site-focus flex w-full items-baseline gap-4 text-left"
                  onClick={() => {
                    setActive(i);
                    itemRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  <span className="font-mono text-[0.7rem] tracking-[0.2em] text-[#c9b37a]/45">
                    {item.index}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block font-brand text-base tracking-[-0.01em] sm:text-lg',
                        i === active ? 'text-[#f5f0e6]' : 'text-[#b0a99c]',
                      )}
                    >
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[0.7rem] tracking-[0.14em] text-[#6f6a60]">
                      {item.layer} · {item.system}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

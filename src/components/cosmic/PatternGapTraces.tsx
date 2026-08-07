import { useMemo, useState } from 'react';

import {
  getSessionConvergenceHint,
  getSessionVisibleTraces,
  type PatternTrace,
} from '../../data/pattern-traces';
import { cn } from '../../utils/cn';

type Props = {
  selected: PatternTrace[];
  onChange: (next: PatternTrace[]) => void;
  className?: string;
};

/**
 * A15 Pattern Gap — max 3 typographic traces, multi-select, no chip wall.
 */
export default function PatternGapTraces({ selected, onChange, className }: Props) {
  const [visible] = useState(() => getSessionVisibleTraces());
  const hint = useMemo(() => getSessionConvergenceHint(), []);

  const selectedIds = useMemo(
    () => new Set(selected.map((t) => t.id)),
    [selected],
  );

  const toggle = (trace: PatternTrace) => {
    if (selectedIds.has(trace.id)) {
      onChange(selected.filter((t) => t.id !== trace.id));
      return;
    }
    if (selected.length >= 3) return;
    onChange([...selected, trace]);
  };

  const showHint = selected.length >= 2;

  return (
    <div className={cn('w-full', className)}>
      <div
        className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 sm:gap-x-2"
        role="group"
        aria-label="Yaşanmış izler. İstediğin kadar seçebilirsin; hiç seçmeden de yazabilirsin."
      >
        {visible.map((trace, index) => {
          const pressed = selectedIds.has(trace.id);
          return (
            <span key={trace.id} className="inline-flex items-center">
              {index > 0 ? (
                <span
                  className="mx-0.5 select-none text-[13px] text-[#5c6573] sm:mx-1"
                  aria-hidden="true"
                >
                  ·
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => toggle(trace)}
                aria-pressed={pressed}
                aria-label={
                  pressed
                    ? `${trace.label} izini kaldır`
                    : `${trace.label} izini seç`
                }
                className={cn(
                  'site-focus inline-flex min-h-11 min-w-[2.75rem] items-center justify-center px-2.5 py-2',
                  'text-[14px] font-medium tracking-[-0.02em] transition-colors duration-150',
                  'sm:px-3 sm:text-[15px]',
                  pressed
                    ? 'text-[#e8ecf2] underline decoration-[#e8ecf2]/35 underline-offset-[6px]'
                    : 'text-[#8b93a3] hover:text-[#c5ccd6]',
                )}
              >
                {trace.label}
              </button>
            </span>
          );
        })}
      </div>

      {showHint ? (
        <p
          className="mt-3 text-center text-[12px] leading-relaxed tracking-[-0.01em] text-[#6b7382] sm:text-[13px]"
          aria-live="polite"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

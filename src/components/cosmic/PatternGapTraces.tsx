import {
  EMPTY_STATE_SUGGESTIONS,
  type EmptyStateSuggestionId,
} from '../../data/capability-discovery';
import { cn } from '../../utils/cn';

type Props = {
  activeId?: EmptyStateSuggestionId | null;
  onSelect?: (id: EmptyStateSuggestionId) => void;
  className?: string;
};

/**
 * Empty-state natural entry prompts — soft guidance only.
 * No taxonomy chips, no auto-send, no mode lock.
 */
export default function PatternGapTraces({
  activeId = null,
  onSelect,
  className,
}: Props) {
  return (
    <div className={cn('w-full max-w-md px-0.5', className)}>
      <ul
        className="grid grid-cols-2 gap-x-2 gap-y-1.5 sm:gap-x-3 sm:gap-y-2"
        role="list"
        aria-label="Başlangıç önerileri. İstersen birine dokun; hiç seçmeden de yazabilirsin."
      >
        {EMPTY_STATE_SUGGESTIONS.map((item) => {
          const pressed = activeId === item.id;
          return (
            <li key={item.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect?.(item.id)}
                aria-pressed={pressed}
                className={cn(
                  'site-focus flex min-h-[3.25rem] w-full flex-col justify-center rounded-sm px-2.5 py-2 text-left touch-manipulation sm:min-h-[3.5rem] sm:px-3 sm:py-2.5',
                  'transition-colors duration-150',
                  pressed
                    ? 'bg-white/[0.05] text-[#e8ecf2]'
                    : 'text-[#8b93a3] hover:bg-white/[0.03] hover:text-[#c5ccd6]',
                )}
              >
                <span
                  className={cn(
                    'block text-[12.5px] font-medium leading-snug tracking-[-0.01em] sm:text-[13px]',
                    pressed ? 'text-[#e8ecf2]' : 'text-[#c5ccd6]/90',
                  )}
                >
                  {item.title}
                </span>
                <span className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug tracking-[-0.01em] text-[#6b7382] sm:text-[11px]">
                  {item.description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

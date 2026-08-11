import {
  discoveryQuestionToComposerText,
  getEmptyStateDiscoveryQuestions,
  type DiscoveryQuestion,
} from '../../data/pattern-traces';
import { cn } from '../../utils/cn';

type Props = {
  className?: string;
  onSelect?: (question: DiscoveryQuestion, composerText: string) => void;
};

/**
 * Fixed empty-state composition (5 questions):
 *   top + bottom on center axis
 *   short sides for optical balance
 *   center anchor: “Bu tesadüf mü, yoksa bir tekrar mı?”
 * No chips, columns-as-FAQ, or random offsets.
 */
export default function PatternGapTraces({ className, onSelect }: Props) {
  const questions = getEmptyStateDiscoveryQuestions();
  const byId = Object.fromEntries(questions.map((q) => [q.id, q])) as Record<
    DiscoveryQuestion['id'],
    DiscoveryQuestion
  >;

  const top = byId.date;
  const left = byId.pattern;
  const center = byId.repeat;
  const right = byId.person;
  const bottom = byId.contradiction;

  if (!top || !left || !center || !right || !bottom) return null;

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[21.5rem] px-1 pb-1 sm:max-w-md',
        className,
      )}
    >
      <ul
        className="flex flex-col items-center gap-3 sm:gap-3.5"
        aria-label="Örnek sorular"
      >
        <li className="w-full">
          <QuestionLink
            question={top}
            onSelect={onSelect}
            className="mx-auto block max-w-[19rem] text-center"
          />
        </li>

        <li className="flex w-full items-baseline justify-between gap-2 px-0.5">
          <QuestionLink
            question={left}
            onSelect={onSelect}
            className="max-w-[36%] shrink-0 text-left"
          />
          <QuestionLink
            question={right}
            onSelect={onSelect}
            className="max-w-[60%] text-right whitespace-normal sm:whitespace-nowrap"
          />
        </li>

        <li className="w-full">
          <QuestionLink
            question={center}
            onSelect={onSelect}
            className="mx-auto block max-w-[19.5rem] text-center text-[#8b93a3]"
          />
        </li>

        <li className="w-full">
          <QuestionLink
            question={bottom}
            onSelect={onSelect}
            className="mx-auto block max-w-[19rem] text-center"
          />
        </li>
      </ul>
    </div>
  );
}

function QuestionLink({
  question,
  onSelect,
  className,
}: {
  question: DiscoveryQuestion;
  onSelect?: (question: DiscoveryQuestion, composerText: string) => void;
  className?: string;
}) {
  const text = discoveryQuestionToComposerText(question);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(question, text)}
      className={cn(
        'site-focus text-[12.5px] leading-[1.35] tracking-[-0.012em]',
        'text-[#7a8494]/92 transition-colors duration-200',
        'hover:text-[#c5ccd6] active:text-[#e8ecf2]',
        'whitespace-nowrap sm:text-[13.5px] sm:leading-[1.4]',
        className,
      )}
    >
      {text}
    </button>
  );
}

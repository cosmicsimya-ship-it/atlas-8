import type { ReactNode } from 'react';

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
 * Fixed empty-state composition — 1 / 3 / 1:
 *   row1 center · row2 left/center/right · row3 center
 * Typography + spacing only. No chips, cards, or rotation.
 */
export default function PatternGapTraces({ className, onSelect }: Props) {
  const questions = getEmptyStateDiscoveryQuestions();
  const byId = Object.fromEntries(questions.map((q) => [q.id, q])) as Record<
    DiscoveryQuestion['id'],
    DiscoveryQuestion
  >;

  const row1 = byId.repeat;
  const midLeft = byId.date;
  const midCenter = byId.pattern;
  const midRight = byId.person;
  const row3 = byId.contradiction;

  if (!row1 || !midLeft || !midCenter || !midRight || !row3) return null;

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[22rem] px-0.5 pb-1 sm:max-w-lg',
        className,
      )}
    >
      <ul
        className="flex w-full flex-col items-center gap-2.5 sm:gap-3"
        aria-label="Örnek sorular"
      >
        {/* ROW 1 — center */}
        <li className="w-full text-center">
          <QuestionLink
            question={row1}
            onSelect={onSelect}
            className="mx-auto max-w-[20rem]"
          />
        </li>

        {/* ROW 2 — three questions; middle phrase locked to true center */}
        <li className="grid w-full grid-cols-[1fr_auto_1fr] items-baseline gap-x-[0.43rem] sm:gap-x-[0.85rem]">
          <QuestionLink
            question={midLeft}
            onSelect={onSelect}
            className="justify-self-end text-center"
          />
          <QuestionLink
            question={midCenter}
            onSelect={onSelect}
            className="justify-self-center px-0.5 text-center whitespace-nowrap"
          />
          <QuestionLink
            question={midRight}
            onSelect={onSelect}
            className="justify-self-start text-center"
          />
        </li>

        {/* ROW 3 — center */}
        <li className="w-full text-center">
          <QuestionLink
            question={row3}
            onSelect={onSelect}
            className="mx-auto max-w-[20rem]"
          />
        </li>
      </ul>
    </div>
  );
}

/** Display-only line breaks — composer still receives the full single-line copy. */
function questionDisplay(question: DiscoveryQuestion): ReactNode {
  switch (question.id) {
    case 'date':
      return (
        <>
          Bu tarih neden{' '}
          <span className="block sm:inline">karşıma çıkıyor?</span>
        </>
      );
    case 'person':
      return (
        <>
          Bu kişi neden yeniden{' '}
          <span className="block sm:inline">gündeme geldi?</span>
        </>
      );
    default:
      return discoveryQuestionToComposerText(question);
  }
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
        'site-focus text-[12px] leading-[1.35] tracking-[-0.012em]',
        'text-[#9a9488]/92 transition-colors duration-200',
        'hover:text-[#e8d9a8] active:text-[#f5f0e6]',
        'sm:text-[13.5px] sm:leading-[1.4]',
        className,
      )}
    >
      {questionDisplay(question)}
    </button>
  );
}

import { discoveryCopy } from '../../data/capability-discovery';
import { cn } from '../../utils/cn';

type Props = {
  className?: string;
};

/**
 * Empty-state soft invite — subtitle only.
 * No taxonomy chips, suggestions, or mode prompts.
 */
export default function PatternGapTraces({ className }: Props) {
  const { line2 } = discoveryCopy.emptyInvite;
  if (!line2) return null;

  return (
    <div className={cn('w-full max-w-md px-1', className)}>
      <p className="text-center text-[13px] leading-snug tracking-[-0.01em] text-[#8b93a3] sm:text-[14px] sm:leading-relaxed">
        {line2}
      </p>
    </div>
  );
}

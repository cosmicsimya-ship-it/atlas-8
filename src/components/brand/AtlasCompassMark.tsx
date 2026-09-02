import { cn } from '../../utils/cn';

interface AtlasCompassMarkProps {
  className?: string;
  compact?: boolean;
}

export default function AtlasCompassMark({ className, compact = false }: AtlasCompassMarkProps) {
  return (
    <img
      src="/atlas-compass-mark.svg"
      alt=""
      aria-hidden="true"
      className={cn(
        'atlas-compass-mark object-contain',
        compact ? 'atlas-compass-mark-compact' : '',
        className,
      )}
    />
  );
}

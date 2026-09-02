import AtlasCompassMark from '../brand/AtlasCompassMark';
import { cn } from '../../utils/cn';

interface AtlasCoreVisualProps {
  className?: string;
  crop?: 'desktop' | 'mobile';
}

export default function AtlasCoreVisual({ className, crop = 'desktop' }: AtlasCoreVisualProps) {
  const mobile = crop === 'mobile';

  return (
    <div
      className={cn(
        'hero-core-visual relative mx-auto aspect-square w-full overflow-visible',
        mobile ? 'max-w-[min(108vw,520px)]' : 'max-w-[min(100%,500px)] lg:max-w-none',
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute left-1/2 top-1/2 h-[88%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.055),rgba(255,255,255,0.012)_34%,transparent_68%)] blur-2xl" />
      <div className="absolute left-1/2 top-1/2 h-[74%] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.035]" />
      <div className="absolute left-1/2 top-[8%] h-[84%] w-px -translate-x-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(238,239,241,0.055),transparent)]" />
      <div className="absolute left-[8%] top-1/2 h-px w-[84%] -translate-y-1/2 bg-[linear-gradient(to_right,transparent,rgba(238,239,241,0.045),transparent)]" />
      <AtlasCompassMark className={cn('absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2', mobile ? 'h-[78%] w-[78%]' : 'h-[70%] w-[70%]')} />
      <div className="hero-core-vignette absolute inset-0" />
    </div>
  );
}

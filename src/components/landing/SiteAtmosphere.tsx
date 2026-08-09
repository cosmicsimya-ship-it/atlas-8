import { cn } from '../../utils/cn';
import ObservatoryField from './ObservatoryField';

interface SiteAtmosphereProps {
  className?: string;
}

/** Page-wide warm charcoal continuity. */
export default function SiteAtmosphere({ className }: SiteAtmosphereProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#050505]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(16,16,14,0.55),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_60%,rgba(11,10,8,0.4),transparent_50%)]" />
      <ObservatoryField density="subtle" showGeometry={false} className="opacity-50" />
    </div>
  );
}

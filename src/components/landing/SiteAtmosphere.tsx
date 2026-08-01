import { cn } from '../../utils/cn';

interface SiteAtmosphereProps {
  className?: string;
}

/** Page-wide base — minimal; hero carries its own rich atmosphere. */
export default function SiteAtmosphere({ className }: SiteAtmosphereProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#050608]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(18,20,26,0.35),transparent_55%)]" />
      <div className="site-grain opacity-[0.03]" />
    </div>
  );
}

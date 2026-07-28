import { cn } from '../../utils/cn';

interface SymbolicBackgroundProps {
  className?: string;
}

export default function SymbolicBackground({ className }: SymbolicBackgroundProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#050505]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(15,23,42,0.55),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.65))]" />

      <svg
        className="absolute inset-0 h-full w-full opacity-[0.14] motion-safe:animate-[drift_28s_ease-in-out_infinite]"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="gridGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c9b37a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8b7355" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {[...Array(12)].map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0"
            y1={60 + i * 62}
            x2="1200"
            y2={120 + i * 58}
            stroke="url(#gridGold)"
            strokeWidth="0.6"
          />
        ))}
        {[...Array(10)].map((_, i) => (
          <line
            key={`v-${i}`}
            x1={80 + i * 110}
            y1="0"
            x2={40 + i * 115}
            y2="800"
            stroke="url(#gridGold)"
            strokeWidth="0.6"
          />
        ))}
        <circle cx="620" cy="360" r="180" fill="none" stroke="#c9b37a" strokeOpacity="0.08" />
        <circle cx="620" cy="360" r="260" fill="none" stroke="#c9b37a" strokeOpacity="0.05" />
      </svg>

      <div className="absolute left-1/2 top-[18%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#0f172a]/40 blur-[120px]" />
    </div>
  );
}

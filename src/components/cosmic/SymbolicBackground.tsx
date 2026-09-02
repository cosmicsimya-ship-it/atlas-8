import { cn } from '../../utils/cn';

interface SymbolicBackgroundProps {
  className?: string;
}

/** Shared product atmosphere: the same North Star blue-black language used by landing. */
export default function SymbolicBackground({ className }: SymbolicBackgroundProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#010307]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_10%,rgba(31,69,108,0.09)_0%,rgba(15,34,59,0.03)_30%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,12,0.1),rgba(0,1,4,0.72))]" />

      <svg
        className="absolute inset-0 h-full w-full opacity-[0.11] motion-safe:animate-[drift_28s_ease-in-out_infinite]"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="gridBlue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8fb2cf" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#426985" stopOpacity="0.025" />
          </linearGradient>
        </defs>
        {[...Array(12)].map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0"
            y1={60 + i * 62}
            x2="1200"
            y2={120 + i * 58}
            stroke="url(#gridBlue)"
            strokeWidth="0.55"
          />
        ))}
        {[...Array(10)].map((_, i) => (
          <line
            key={`v-${i}`}
            x1={80 + i * 110}
            y1="0"
            x2={40 + i * 115}
            y2="800"
            stroke="url(#gridBlue)"
            strokeWidth="0.55"
          />
        ))}
        <circle cx="620" cy="360" r="180" fill="none" stroke="#86aac7" strokeOpacity="0.05" />
        <circle cx="620" cy="360" r="260" fill="none" stroke="#86aac7" strokeOpacity="0.025" />
      </svg>

      <div className="absolute left-[64%] top-[16%] h-[440px] w-[440px] -translate-x-1/2 rounded-full bg-[#17344e]/20 blur-[135px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_43%,rgba(0,1,4,0.6)_100%)]" />
    </div>
  );
}

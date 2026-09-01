import { cn } from '../../utils/cn';

interface ChatAtmosphereProps {
  className?: string;
}

/** Near-black conversation field with restrained silver optical depth. */
export default function ChatAtmosphere({ className }: ChatAtmosphereProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#030304]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_34%,rgba(198,204,214,0.10),transparent_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_20%,rgba(132,139,150,0.055),transparent_44%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_42%,#030304_100%)]" />

      {/* Quiet metallic depth; no blue/cyan glow. */}
      <div className="absolute left-1/2 top-[27%] h-[min(52vw,420px)] w-[min(52vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(232,235,240,0.075),rgba(150,156,166,0.025)_42%,transparent_68%)] blur-[76px] motion-safe:animate-[atlas-glow-breathe_5s_ease-in-out_infinite]" />
      <div className="absolute left-1/2 top-[28%] h-[min(28vw,220px)] w-[min(28vw,220px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.045),transparent_70%)] blur-[52px] motion-safe:animate-[atlas-glow-breathe_5s_ease-in-out_infinite_0.4s]" />

      {/* Sparse silver points, intentionally low contrast. */}
      <div className="absolute inset-0 opacity-[0.26] motion-safe:animate-[atlas-field-drift_16s_ease-in-out_infinite]">
        {[...Array(6)].map((_, i) => (
          <span
            key={i}
            className="absolute h-px w-px rounded-full bg-[#d8dce3]"
            style={{
              left: `${18 + i * 14}%`,
              top: `${22 + (i % 3) * 18}%`,
              opacity: 0.2 + (i % 3) * 0.1,
              boxShadow: '0 0 6px rgba(220, 224, 232, 0.22)',
            }}
          />
        ))}
      </div>

      {/* Barely visible compass-scale geometry to keep depth across the canvas. */}
      <div className="absolute left-1/2 top-[27%] h-[min(68vw,560px)] w-[min(68vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.035]" />
      <div className="absolute left-1/2 top-[27%] h-[min(44vw,360px)] w-[min(44vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.025]" />

      <div className="site-grain absolute inset-0 opacity-[0.025]" />
    </div>
  );
}

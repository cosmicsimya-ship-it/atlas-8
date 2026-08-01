import { cn } from '../../utils/cn';

interface ChatAtmosphereProps {
  className?: string;
}

/** Void field with soft cyan volumetric glow — conversation canvas. */
export default function ChatAtmosphere({ className }: ChatAtmosphereProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#050608]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(14,24,36,0.55),transparent_62%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_45%,#050608_100%)]" />

      {/* Core-adjacent volumetric glow */}
      <div className="absolute left-1/2 top-[28%] h-[min(52vw,420px)] w-[min(52vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(126,182,255,0.14),rgba(59,130,246,0.04)_42%,transparent_68%)] blur-[72px] motion-safe:animate-[atlas-glow-breathe_5s_ease-in-out_infinite]" />
      <div className="absolute left-1/2 top-[28%] h-[min(28vw,220px)] w-[min(28vw,220px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(142,234,250,0.08),transparent_70%)] blur-[48px] motion-safe:animate-[atlas-glow-breathe_5s_ease-in-out_infinite_0.4s]" />

      {/* Sparse ambient particles */}
      <div className="absolute inset-0 opacity-[0.35] motion-safe:animate-[atlas-field-drift_16s_ease-in-out_infinite]">
        {[...Array(6)].map((_, i) => (
          <span
            key={i}
            className="absolute h-px w-px rounded-full bg-[#8eeafa]"
            style={{
              left: `${18 + i * 14}%`,
              top: `${22 + (i % 3) * 18}%`,
              opacity: 0.25 + (i % 3) * 0.12,
              boxShadow: '0 0 6px rgba(142, 234, 250, 0.35)',
            }}
          />
        ))}
      </div>

      <div className="site-grain absolute inset-0 opacity-[0.028]" />
    </div>
  );
}

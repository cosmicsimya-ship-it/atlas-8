import { cn } from '../../utils/cn';

type Props = {
  className?: string;
};

/** Abstract convergence: independent rays meet at a quiet center — not an AI network. */
export default function ConvergenceVisual({ className }: Props) {
  const rays = [
    { x1: 28, y1: 18, label: '' },
    { x1: 172, y1: 22, label: '' },
    { x1: 188, y1: 110, label: '' },
    { x1: 160, y1: 178, label: '' },
    { x1: 40, y1: 172, label: '' },
    { x1: 12, y1: 100, label: '' },
  ] as const;

  return (
    <div
      className={cn('relative aspect-square w-full', className)}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="conv-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c9b37a" stopOpacity="0.35" />
            <stop offset="55%" stopColor="#c9b37a" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#c9b37a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="100" cy="100" r="54" fill="url(#conv-core)" />

        {rays.map((ray, i) => (
          <g key={i}>
            <line
              x1={ray.x1}
              y1={ray.y1}
              x2="100"
              y2="100"
              stroke="#c9b37a"
              strokeOpacity={0.22 + (i % 3) * 0.06}
              strokeWidth="0.75"
            />
            <circle
              cx={ray.x1}
              cy={ray.y1}
              r="2.2"
              fill="#e8ecf2"
              fillOpacity="0.45"
            />
          </g>
        ))}

        <circle
          cx="100"
          cy="100"
          r="4"
          fill="#e8ecf2"
          fillOpacity="0.85"
        />
        <circle
          cx="100"
          cy="100"
          r="10"
          stroke="#c9b37a"
          strokeOpacity="0.4"
          strokeWidth="0.8"
        />
        <circle
          cx="100"
          cy="100"
          r="22"
          stroke="#c9b37a"
          strokeOpacity="0.18"
          strokeWidth="0.6"
          strokeDasharray="2 4"
        />
      </svg>
    </div>
  );
}

import { cn } from '../../utils/cn';

type Props = {
  className?: string;
  sparse?: boolean;
};

type Node = { x: number; y: number; z: 'near' | 'mid' | 'far'; label: string };

const DESKTOP: Node[] = [
  { x: 34, y: 42, z: 'near', label: 'Zaman' },
  { x: 118, y: 26, z: 'mid', label: 'Yapı' },
  { x: 176, y: 70, z: 'near', label: 'Sembol' },
  { x: 158, y: 150, z: 'mid', label: 'Hafıza' },
  { x: 58, y: 156, z: 'far', label: 'Çelişki' },
  { x: 100, y: 100, z: 'near', label: 'Kesişim' },
];

const MOBILE: Node[] = [
  { x: 42, y: 48, z: 'near', label: 'Zaman' },
  { x: 158, y: 40, z: 'mid', label: 'Sembol' },
  { x: 150, y: 150, z: 'mid', label: 'Hafıza' },
  { x: 48, y: 142, z: 'far', label: 'Yapı' },
  { x: 100, y: 100, z: 'near', label: 'Kesişim' },
];

const DESKTOP_EDGES: [number, number][] = [
  [0, 5],
  [1, 5],
  [2, 5],
  [3, 5],
  [4, 5],
  [0, 1],
  [2, 3],
];

const MOBILE_EDGES: [number, number][] = [
  [0, 4],
  [1, 4],
  [2, 4],
  [3, 4],
  [0, 1],
];

const Z = {
  near: { r: 3.6, op: 0.85, line: 0.22 },
  mid: { r: 2.6, op: 0.5, line: 0.14 },
  far: { r: 1.8, op: 0.28, line: 0.08 },
} as const;

/**
 * Resonance network — near/mid/far depth, warm metal, no constellation wallpaper.
 */
export default function NetworkConstellation({ className, sparse = false }: Props) {
  const nodes = sparse ? MOBILE : DESKTOP;
  const edges = sparse ? MOBILE_EDGES : DESKTOP_EDGES;

  return (
    <div className={cn('relative aspect-square w-full', className)} aria-hidden="true">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,179,122,0.08),transparent_70%)] blur-xl obs-light-sweep max-md:blur-lg" />

      <svg viewBox="0 0 200 200" className="h-full w-full" fill="none" style={{ transform: sparse ? undefined : 'perspective(600px) rotateX(8deg)' }}>
        <defs>
          <radialGradient id="res-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c9b37a" stopOpacity="0.18" />
            <stop offset="55%" stopColor="#c9b37a" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#c9b37a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Far ring — larger, softer */}
        <ellipse
          cx="100"
          cy="108"
          rx="78"
          ry="58"
          stroke="rgba(201,179,122,0.07)"
          strokeWidth="0.45"
          className="max-md:hidden"
        />
        <ellipse cx="100" cy="104" rx="52" ry="40" fill="url(#res-core)" />
        <ellipse
          cx="100"
          cy="100"
          rx="68"
          ry="50"
          stroke="rgba(201,179,122,0.12)"
          strokeWidth="0.5"
          strokeDasharray="2 7"
          className="obs-orbit-ultra origin-center [transform-box:fill-box] [transform-origin:100px_100px]"
        />

        {edges.map(([a, b], i) => {
          const na = nodes[a];
          const nb = nodes[b];
          const depth = na.z === 'far' || nb.z === 'far' ? 'far' : na.z === 'mid' || nb.z === 'mid' ? 'mid' : 'near';
          return (
            <line
              key={`${a}-${b}`}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke="#c9b37a"
              strokeOpacity={Z[depth].line + (i % 2) * 0.03}
              strokeWidth={depth === 'near' ? 0.85 : 0.55}
            />
          );
        })}

        {nodes.map((node, i) => {
          const isCore = i === nodes.length - 1;
          const z = Z[node.z];
          return (
            <g key={node.label}>
              <circle
                cx={node.x}
                cy={node.y}
                r={isCore ? 4.2 : z.r}
                fill={isCore ? '#f5f0e6' : '#c9b37a'}
                fillOpacity={isCore ? 0.9 : z.op}
              />
              {isCore ? (
                <ellipse
                  cx={node.x}
                  cy={node.y}
                  rx="12"
                  ry="10"
                  stroke="#c9b37a"
                  strokeOpacity="0.35"
                  strokeWidth="0.7"
                  fill="none"
                />
              ) : null}
              <text
                x={node.x}
                y={node.y + (isCore ? 22 : 14)}
                textAnchor="middle"
                fill="rgba(176,169,156,0.5)"
                fontSize="5.5"
                fontFamily="JetBrains Mono, monospace"
                letterSpacing="0.8"
                className="max-md:hidden"
              >
                {node.label.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

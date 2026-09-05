import { cn } from '../../utils/cn';

interface AtlasCompassMarkProps {
  className?: string;
  compact?: boolean;
}

const CENTER = 160;
/** Single global light source so every facet reads as one coherent gem, not per-arm noise. */
const LIGHT_ANGLE = 315;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function isFacingLight(normalDeg: number) {
  const diff = ((normalDeg - LIGHT_ANGLE + 540) % 360) - 180;
  return Math.cos(toRad(diff)) > 0;
}

function polar(radius: number, angleDeg: number) {
  const rad = toRad(angleDeg);
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) };
}

/**
 * One continuous 16-vertex star outline: 8 tips (radius from tipRadiusAt) at
 * every 45° (+ angleOffset), interleaved with 8 waist vertices at a single
 * shared radius. Every tip's two flanking facets meet the SAME waist vertex
 * as its neighbor's, so there is no gap between points — one connected
 * faceted body, not independent spikes radiating from a void. angleOffset
 * is baked into the geometry (not an SVG transform) so isFacingLight stays
 * correct against the one fixed light source even for a rotated layer.
 */
function starFacets(tipRadiusAt: (tipIndex: number) => number, waistR: number, angleOffset = 0) {
  const outline = Array.from({ length: 16 }).map((_, i) => {
    const angle = i * 22.5 + angleOffset;
    const r = i % 2 === 0 ? tipRadiusAt(i / 2) : waistR;
    return { angle, ...polar(r, angle) };
  });

  return outline.map((p0, i) => {
    const p1 = outline[(i + 1) % outline.length];
    const midAngle = i * 22.5 + 11.25 + angleOffset;
    return {
      d: `M ${CENTER} ${CENTER} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`,
      bright: isFacingLight(midAngle),
    };
  });
}

function FacetedStar({
  facets,
  blue = false,
  goldRim = false,
}: {
  facets: ReturnType<typeof starFacets>;
  blue?: boolean;
  goldRim?: boolean;
}) {
  const brightFill = blue ? 'url(#atlasFacetInnerBlue)' : 'url(#atlasFacetBright)';
  const darkFill = blue ? 'url(#atlasFacetInnerDark)' : 'url(#atlasFacetDark)';
  return (
    <g>
      {facets.map((f, i) => (
        <path key={i} d={f.d} fill={f.bright ? brightFill : darkFill} />
      ))}
      {goldRim && (
        <>
          <path d={facets[15].d.replace(/^M[^L]+L/, 'M')} fill="none" stroke="rgba(216,196,150,0.32)" strokeWidth="0.7" />
          <path d={facets[0].d.replace(/^M[^L]+L/, 'M')} fill="none" stroke="rgba(216,196,150,0.32)" strokeWidth="0.7" />
        </>
      )}
    </g>
  );
}

function FacetCore({ radius }: { radius: number }) {
  const facets = 8;
  const step = 360 / facets;
  return (
    <g>
      {Array.from({ length: facets }).map((_, i) => {
        const a0 = i * step;
        const a1 = a0 + step;
        const mid = a0 + step / 2;
        const p0 = polar(radius, a0);
        const p1 = polar(radius, a1);
        const bright = isFacingLight(mid);
        return (
          <path
            key={i}
            d={`M ${CENTER} ${CENTER} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`}
            fill={bright ? 'url(#atlasFacetInnerBlue)' : 'url(#atlasFacetInnerDark)'}
          />
        );
      })}
    </g>
  );
}

/**
 * Two interlocking faceted stars, not one shape with a glowing center point.
 * A silver/pearl primary star (the visible 8-point form) sits on top of a
 * smaller blue secondary star rotated 22.5° — its tips point exactly at the
 * primary's waists, so blue shows through as it emerges from between/behind
 * the silver points along the whole body, not as a single bright dot. This
 * one construction drives both the hero mark and the header micro-mark so
 * they read as the same family at any size.
 */
function DualStar({
  primaryTipRadii,
  primaryWaistR,
  secondaryTipR,
  secondaryWaistR,
  coreRadius,
  goldRim = false,
}: {
  primaryTipRadii: number[];
  primaryWaistR: number;
  secondaryTipR: number;
  secondaryWaistR: number;
  coreRadius: number;
  goldRim?: boolean;
}) {
  const secondaryFacets = starFacets(() => secondaryTipR, secondaryWaistR, 22.5);
  const primaryFacets = starFacets((i) => primaryTipRadii[i], primaryWaistR);

  return (
    <>
      <FacetedStar facets={secondaryFacets} blue />
      <FacetedStar facets={primaryFacets} goldRim={goldRim} />
      <FacetCore radius={coreRadius} />
    </>
  );
}

const HERO_DEFS = (
  <defs>
    {/* Silver/pearl body — pulled back from pure white to cut glare, given a
        faint cool cast so it already feels lit by something blue nearby. */}
    <linearGradient id="atlasFacetBright" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#f1f4fa" />
      <stop offset="55%" stopColor="#dbe1ea" />
      <stop offset="100%" stopColor="#b3bac8" />
    </linearGradient>
    {/* Shadow side gets cobalt depth instead of neutral graphite. */}
    <linearGradient id="atlasFacetDark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#aab6cf" />
      <stop offset="55%" stopColor="#78859f" />
      <stop offset="100%" stopColor="#4c577a" />
    </linearGradient>
    {/* The secondary star + core — cool energy living inside the form, not one bulb. */}
    <linearGradient id="atlasFacetInnerBlue" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#cfe6ff" />
      <stop offset="45%" stopColor="#7fb8ff" />
      <stop offset="100%" stopColor="#3d68c8" />
    </linearGradient>
    <linearGradient id="atlasFacetInnerDark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#4f68ae" />
      <stop offset="100%" stopColor="#212e58" />
    </linearGradient>
  </defs>
);

function HeroMark() {
  // tip order: N, NE, E, SE, S, SW, W, NW — north is the one longer primary point.
  const primaryTipRadii = [134, 96, 112, 96, 112, 96, 112, 96];

  return (
    <>
      <circle cx="160" cy="160" r="120" fill="none" stroke="#d9dadd" strokeOpacity="0.32" strokeWidth="1" />
      <circle cx="160" cy="160" r="100" fill="none" stroke="#f4f4f2" strokeOpacity="0.16" strokeWidth="0.75" />
      <g stroke="#bfc2c7" strokeOpacity="0.14" strokeWidth="0.7">
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * 360) / 8;
          return <line key={i} x1="160" y1="50" x2="160" y2="57" transform={`rotate(${a} 160 160)`} />;
        })}
      </g>

      <g filter="drop-shadow(0 0 6px rgba(111,179,255,0.08))">
        <DualStar
          primaryTipRadii={primaryTipRadii}
          primaryWaistR={27}
          secondaryTipR={60}
          secondaryWaistR={17}
          coreRadius={13}
          goldRim
        />
      </g>
    </>
  );
}

/**
 * Dedicated micro-mark for 24-32px header use — NOT a scaled-down hero star.
 * Same DualStar construction (so it is unmistakably the same family), tuned
 * thinner/more refined than before; the secondary blue star showing through
 * the primary's waists is what keeps it reading as one full 8-point body at
 * small size even with a slimmer primary silhouette.
 */
function CompactMark() {
  const primaryTipRadii = [150, 98, 150, 98, 150, 98, 150, 98];
  return (
    <DualStar
      primaryTipRadii={primaryTipRadii}
      primaryWaistR={34}
      secondaryTipR={48}
      secondaryWaistR={11}
      coreRadius={8}
    />
  );
}

export default function AtlasCompassMark({ className, compact = false }: AtlasCompassMarkProps) {
  return (
    <svg
      viewBox="0 0 320 320"
      role="img"
      aria-label="Atlas Kuzey Yıldızı"
      className={cn('atlas-compass-mark overflow-visible', compact && 'atlas-compass-mark-compact', className)}
    >
      {HERO_DEFS}
      {compact ? <CompactMark /> : <HeroMark />}
    </svg>
  );
}

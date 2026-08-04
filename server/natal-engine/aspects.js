import { angularSeparation, MAJOR_ASPECTS, MINOR_ASPECTS } from './constants.js';

/**
 * @param {string} aspect
 * @param {{ bodyA: string, bodyB: string }} pair
 * @param {object} methodology
 */
export function orbAllowance(aspect, pair, methodology) {
  const major = methodology.aspectOrbs?.[aspect];
  const minor = methodology.minorAspectOrbs?.[aspect];
  let base = major ?? minor ?? 0;
  const luminaries = methodology.luminaryBodies || ['Sun', 'Moon'];
  const bonus = methodology.luminaryBonus || 0;
  if (major != null && (luminaries.includes(pair.bodyA) || luminaries.includes(pair.bodyB))) {
    base += bonus;
  }
  return base;
}

/**
 * @param {object[]} points
 * @param {object} methodology
 * @param {{ includeMinor?: boolean }} [opts]
 */
export function computeAspects(points, methodology, opts = {}) {
  const aspectDefs = [
    ...MAJOR_ASPECTS,
    ...(opts.includeMinor ? MINOR_ASPECTS : []),
  ];

  // Aspect only traditional chart points (exclude SouthNode duplicates with North for majors optionally)
  const bodies = points.filter((p) =>
    [
      'Sun',
      'Moon',
      'Mercury',
      'Venus',
      'Mars',
      'Jupiter',
      'Saturn',
      'Uranus',
      'Neptune',
      'Pluto',
      'NorthNode',
      'Ascendant',
      'Midheaven',
    ].includes(p.body),
  );

  /** @type {object[]} */
  const aspects = [];
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const a = bodies[i];
      const b = bodies[j];
      const actual = angularSeparation(a.longitude, b.longitude);
      for (const def of aspectDefs) {
        const orb = Math.abs(actual - def.exactAngle);
        const maxOrb = orbAllowance(def.aspect, { bodyA: a.body, bodyB: b.body }, methodology);
        if (orb <= maxOrb) {
          aspects.push({
            bodyA: a.body,
            bodyB: b.body,
            aspect: def.aspect,
            exactAngle: def.exactAngle,
            actualAngle: Number(actual.toFixed(4)),
            orb: Number(orb.toFixed(4)),
          });
        }
      }
    }
  }

  aspects.sort((x, y) => x.orb - y.orb);
  return aspects;
}

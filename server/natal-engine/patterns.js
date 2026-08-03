import { angularSeparation } from './constants.js';

/**
 * Basic pattern detection (Grand Trine, T-Square, Grand Cross, Yod, Kite, stellium).
 * Deterministic; tolerances use aspect orbs already present in aspect list when possible.
 *
 * @param {object[]} points
 * @param {object[]} aspects
 */
export function detectPatterns(points, aspects) {
  const patterns = [];
  const planetPoints = points.filter((p) =>
    ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(
      p.body,
    ),
  );

  // Stellium: 3+ planets within 8° span in same sign
  const bySign = {};
  for (const p of planetPoints) {
    (bySign[p.sign] ||= []).push(p);
  }
  for (const [sign, group] of Object.entries(bySign)) {
    if (group.length >= 3) {
      const lons = group.map((g) => g.longitude).sort((a, b) => a - b);
      const span = lons[lons.length - 1] - lons[0];
      if (span <= 10) {
        patterns.push({
          type: 'stellium',
          bodies: group.map((g) => g.body),
          sign,
          span: Number(span.toFixed(3)),
        });
      }
    }
  }

  const trines = aspects.filter((a) => a.aspect === 'trine');
  const squares = aspects.filter((a) => a.aspect === 'square');
  const oppositions = aspects.filter((a) => a.aspect === 'opposition');
  const sextiles = aspects.filter((a) => a.aspect === 'sextile');
  const quincunxes = aspects.filter((a) => a.aspect === 'quincunx');

  // Grand Trine: three bodies all mutually trine
  for (let i = 0; i < trines.length; i += 1) {
    for (let j = i + 1; j < trines.length; j += 1) {
      const set = new Set([trines[i].bodyA, trines[i].bodyB, trines[j].bodyA, trines[j].bodyB]);
      if (set.size !== 3) continue;
      const bodies = [...set];
      if (isMutualAspect(bodies, trines, 'trine')) {
        const key = `grand-trine:${bodies.sort().join(',')}`;
        if (!patterns.some((p) => p.key === key)) {
          patterns.push({ type: 'grand-trine', bodies, key });
        }
      }
    }
  }

  // T-Square: opposition + both square a third
  for (const opp of oppositions) {
    for (const p of planetPoints) {
      if (p.body === opp.bodyA || p.body === opp.bodyB) continue;
      const sqA = squares.some(
        (s) =>
          (s.bodyA === p.body && s.bodyB === opp.bodyA) ||
          (s.bodyB === p.body && s.bodyA === opp.bodyA),
      );
      const sqB = squares.some(
        (s) =>
          (s.bodyA === p.body && s.bodyB === opp.bodyB) ||
          (s.bodyB === p.body && s.bodyA === opp.bodyB),
      );
      if (sqA && sqB) {
        const bodies = [opp.bodyA, opp.bodyB, p.body];
        const key = `t-square:${[...bodies].sort().join(',')}`;
        if (!patterns.some((x) => x.key === key)) {
          patterns.push({ type: 't-square', bodies, apex: p.body, key });
        }
      }
    }
  }

  // Grand Cross: two oppositions + crossing squares (4 bodies)
  for (let i = 0; i < oppositions.length; i += 1) {
    for (let j = i + 1; j < oppositions.length; j += 1) {
      const bodies = [
        oppositions[i].bodyA,
        oppositions[i].bodyB,
        oppositions[j].bodyA,
        oppositions[j].bodyB,
      ];
      if (new Set(bodies).size !== 4) continue;
      // Require each body square-connected enough: count squares among them >= 4
      const sqCount = squares.filter(
        (s) => bodies.includes(s.bodyA) && bodies.includes(s.bodyB),
      ).length;
      if (sqCount >= 4) {
        const key = `grand-cross:${[...bodies].sort().join(',')}`;
        if (!patterns.some((p) => p.key === key)) {
          patterns.push({ type: 'grand-cross', bodies, key });
        }
      }
    }
  }

  // Yod: two quincunxes to apex + sextile base (needs minor aspects)
  for (const qx of quincunxes) {
    for (const qy of quincunxes) {
      if (qx === qy) continue;
      const shared = [qx.bodyA, qx.bodyB].find((b) => b === qy.bodyA || b === qy.bodyB);
      if (!shared) continue;
      const a = qx.bodyA === shared ? qx.bodyB : qx.bodyA;
      const b = qy.bodyA === shared ? qy.bodyB : qy.bodyA;
      if (a === b) continue;
      const hasSex = sextiles.some(
        (s) =>
          (s.bodyA === a && s.bodyB === b) || (s.bodyA === b && s.bodyB === a),
      );
      if (hasSex) {
        const bodies = [shared, a, b];
        const key = `yod:${[...bodies].sort().join(',')}`;
        if (!patterns.some((p) => p.key === key)) {
          patterns.push({ type: 'yod', bodies, apex: shared, key });
        }
      }
    }
  }

  // Kite: grand trine + opposition from one point to a fourth on the opposite side (simplified: GT + sextiles)
  for (const gt of patterns.filter((p) => p.type === 'grand-trine')) {
    for (const p of planetPoints) {
      if (gt.bodies.includes(p.body)) continue;
      const sexCount = sextiles.filter(
        (s) =>
          (s.bodyA === p.body && gt.bodies.includes(s.bodyB)) ||
          (s.bodyB === p.body && gt.bodies.includes(s.bodyA)),
      ).length;
      const oppHit = oppositions.some(
        (o) =>
          (o.bodyA === p.body && gt.bodies.includes(o.bodyB)) ||
          (o.bodyB === p.body && gt.bodies.includes(o.bodyA)),
      );
      if (sexCount >= 2 && oppHit) {
        const bodies = [...gt.bodies, p.body];
        const key = `kite:${[...bodies].sort().join(',')}`;
        if (!patterns.some((x) => x.key === key)) {
          patterns.push({ type: 'kite', bodies, key });
        }
      }
    }
  }

  // Angular planets (houses 1,4,7,10)
  const angular = points.filter((p) => [1, 4, 7, 10].includes(p.house));
  if (angular.length) {
    patterns.push({
      type: 'angular-planets',
      bodies: angular.map((p) => p.body),
    });
  }

  const retroCount = planetPoints.filter((p) => p.retrograde).length;
  patterns.push({ type: 'retrograde-count', count: retroCount });

  return patterns.map(({ key, ...rest }) => rest);
}

/**
 * @param {string[]} bodies
 * @param {object[]} aspectList
 * @param {string} aspect
 */
function isMutualAspect(bodies, aspectList, aspect) {
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const ok = aspectList.some(
        (a) =>
          a.aspect === aspect &&
          ((a.bodyA === bodies[i] && a.bodyB === bodies[j]) ||
            (a.bodyA === bodies[j] && a.bodyB === bodies[i])),
      );
      if (!ok) return false;
    }
  }
  return true;
}

// silence unused import lint if any bundler cares
void angularSeparation;

import { SIGN_ELEMENTS, SIGN_MODALITIES, SIGN_POLARITIES, SIGN_RULERS } from './constants.js';

/**
 * @param {object[]} points
 * @param {object} methodology
 * @param {{ housesAvailable?: boolean }} [opts]
 */
export function computeDistributions(points, methodology, opts = {}) {
  const bodies = methodology.distributionBodies || [];
  const selected = points.filter((p) => bodies.includes(p.body));

  const elements = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const modalities = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  const polarities = { Yang: 0, Yin: 0 };

  for (const p of selected) {
    elements[SIGN_ELEMENTS[p.sign]] += 1;
    modalities[SIGN_MODALITIES[p.sign]] += 1;
    polarities[SIGN_POLARITIES[p.sign]] += 1;
  }

  /** @type {Record<string, number>|undefined} */
  let hemispheres;
  /** @type {Record<string, number>|undefined} */
  let quadrants;

  if (opts.housesAvailable) {
    const houseBodies = points.filter((p) =>
      (methodology.houseStatBodies || bodies).includes(p.body) && p.house != null,
    );
    hemispheres = { north: 0, south: 0, east: 0, west: 0 };
    quadrants = { q1: 0, q2: 0, q3: 0, q4: 0 };
    for (const p of houseBodies) {
      const h = p.house;
      // Southern hemisphere = houses 7–12 (above horizon in whole-sign sense of MC side)
      // Conventional: houses 1–6 = below (north in northern-hemisphere chart jargon varies).
      // Atlas convention: lower (1–6) / upper (7–12); east (10,11,12,1,2,3) / west (4–9).
      if (h >= 1 && h <= 6) hemispheres.north += 1;
      else hemispheres.south += 1;
      if ([10, 11, 12, 1, 2, 3].includes(h)) hemispheres.east += 1;
      else hemispheres.west += 1;

      if ([1, 2, 3].includes(h)) quadrants.q1 += 1;
      else if ([4, 5, 6].includes(h)) quadrants.q2 += 1;
      else if ([7, 8, 9].includes(h)) quadrants.q3 += 1;
      else if ([10, 11, 12].includes(h)) quadrants.q4 += 1;
    }
  }

  const dominantElement = dominantKey(elements);
  const dominantModality = dominantKey(modalities);

  return {
    elements,
    modalities,
    polarities,
    hemispheres,
    quadrants,
    dominantElement,
    dominantModality,
  };
}

/**
 * @param {Record<string, number>} map
 */
function dominantKey(map) {
  let best = null;
  let n = -1;
  for (const [k, v] of Object.entries(map)) {
    if (v > n) {
      n = v;
      best = k;
    }
  }
  return best;
}

/**
 * Chart ruler = traditional domicile ruler of Ascendant sign.
 * @param {object|null} ascendant
 * @param {object[]} points
 */
export function computeChartRuler(ascendant, points) {
  if (!ascendant?.sign) return null;
  const ruler = SIGN_RULERS[ascendant.sign];
  const pos = points.find((p) => p.body === ruler);
  return {
    body: ruler,
    sign: pos?.sign ?? null,
    house: pos?.house ?? null,
    longitude: pos?.longitude ?? null,
  };
}

/**
 * Simple dispositor chain via domicile rulers.
 * @param {object[]} points
 */
export function computeDispositorChain(points) {
  const byBody = Object.fromEntries(
    points
      .filter((p) =>
        ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].includes(p.body),
      )
      .map((p) => [p.body, p]),
  );

  const chain = {};
  for (const body of Object.keys(byBody)) {
    const path = [];
    let cur = body;
    const seen = new Set();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      path.push(cur);
      const sign = byBody[cur]?.sign;
      if (!sign) break;
      const next = SIGN_RULERS[sign];
      if (!next || !byBody[next]) {
        path.push(next);
        break;
      }
      if (next === cur) break;
      cur = next;
      if (path.length > 12) break;
    }
    chain[body] = path;
  }
  return chain;
}

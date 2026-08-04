import placesData from './places-data.json' with { type: 'json' };
import { foldPlaceKey } from './normalize.js';
import { NatalEngineErrorCode, natalError } from './errors.js';

/**
 * @typedef {{
 *   id: string,
 *   displayName: string,
 *   aliases: string[],
 *   latitude: number,
 *   longitude: number,
 *   countryCode: string,
 *   timezone: string,
 * }} PlaceRecord
 */

/** @type {PlaceRecord[]} */
const PLACES = placesData;

/**
 * @param {string} query
 * @returns {PlaceRecord[]}
 */
export function findPlaceCandidates(query) {
  const q = foldPlaceKey(query);
  if (!q) return [];

  const exact = [];
  const partial = [];

  for (const place of PLACES) {
    const names = [foldPlaceKey(place.displayName), ...place.aliases.map(foldPlaceKey)];
    if (names.includes(q)) {
      exact.push(place);
      continue;
    }
    // "Springfield" bare name → all springfield* aliases starting as city token
    const cityToken = q.split(',')[0].trim();
    if (
      names.some((n) => n === cityToken || n.startsWith(`${cityToken} `) || n.startsWith(`${cityToken},`))
    ) {
      partial.push(place);
    }
  }

  if (exact.length) return dedupePlaces(exact);
  return dedupePlaces(partial);
}

/**
 * @param {PlaceRecord[]} list
 */
function dedupePlaces(list) {
  const seen = new Set();
  const out = [];
  for (const p of list) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

/**
 * Resolve birth place text and/or coordinates.
 * Never silently picks among ambiguous city names.
 *
 * @param {{
 *   birthPlace?: string|null,
 *   latitude?: number|null,
 *   longitude?: number|null,
 *   timezone?: string|null,
 * }} input
 */
export function resolveBirthLocation(input = {}) {
  const hasCoords =
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude) &&
    Math.abs(input.latitude) <= 90 &&
    Math.abs(input.longitude) <= 180;

  if (hasCoords) {
    const nearest = nearestPlace(input.latitude, input.longitude);
    return {
      ok: true,
      location: {
        displayName: input.birthPlace?.trim() || nearest?.displayName || 'Custom coordinates',
        latitude: Number(input.latitude),
        longitude: Number(input.longitude),
        countryCode: nearest?.countryCode ?? null,
        timezone: input.timezone || nearest?.timezone || null,
        source: input.birthPlace ? 'coordinates+place' : 'coordinates',
        placeId: nearest?.id ?? null,
      },
      candidates: [],
    };
  }

  const placeText = input.birthPlace != null ? String(input.birthPlace).trim() : '';
  if (!placeText) {
    return {
      ok: false,
      error: natalError(NatalEngineErrorCode.BIRTH_PLACE_REQUIRED),
      location: null,
      candidates: [],
    };
  }

  const candidates = findPlaceCandidates(placeText);
  if (candidates.length === 0) {
    return {
      ok: false,
      error: natalError(NatalEngineErrorCode.LOCATION_RESOLUTION_FAILED, placeText),
      location: null,
      candidates: [],
    };
  }

  if (candidates.length > 1) {
    // If query includes a disambiguator that uniquely matches one displayName/alias, accept it.
    const q = foldPlaceKey(placeText);
    const refined = candidates.filter((c) => {
      const names = [foldPlaceKey(c.displayName), ...c.aliases.map(foldPlaceKey)];
      return names.includes(q);
    });
    if (refined.length === 1) {
      const place = refined[0];
      return {
        ok: true,
        location: {
          displayName: place.displayName,
          latitude: place.latitude,
          longitude: place.longitude,
          countryCode: place.countryCode,
          timezone: input.timezone || place.timezone,
          source: 'places-db',
          placeId: place.id,
        },
        candidates: [],
      };
    }

    return {
      ok: false,
      error: natalError(NatalEngineErrorCode.AMBIGUOUS_BIRTH_PLACE, placeText, {
        candidates: candidates.map((c) => ({
          id: c.id,
          displayName: c.displayName,
          countryCode: c.countryCode,
        })),
      }),
      location: null,
      candidates,
    };
  }

  const place = candidates[0];
  return {
    ok: true,
    location: {
      displayName: place.displayName,
      latitude: place.latitude,
      longitude: place.longitude,
      countryCode: place.countryCode,
      timezone: input.timezone || place.timezone,
      source: 'places-db',
      placeId: place.id,
    },
    candidates: [],
  };
}

/**
 * @param {number} lat
 * @param {number} lon
 */
function nearestPlace(lat, lon) {
  let best = null;
  let bestD = Infinity;
  for (const p of PLACES) {
    const d = (p.latitude - lat) ** 2 + (p.longitude - lon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function listKnownPlaces() {
  return PLACES.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    countryCode: p.countryCode,
  }));
}

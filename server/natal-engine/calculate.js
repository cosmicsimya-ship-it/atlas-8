import { ENGINE_ID, ENGINE_VERSION, HOUSE_SYSTEMS, ZODIAC_SYSTEMS, ZODIAC_SIGNS_TR } from './constants.js';
import { NatalEngineError, NatalEngineErrorCode, natalError } from './errors.js';
import { resolveNatalMethodology } from './methodology.js';
import { normalizeNatalInput } from './normalize.js';
import { resolveBirthLocation } from './location.js';
import { resolveBirthInstant, utcNoonProbe } from './timezone.js';
import {
  computePlanetaryPositions,
  moonMayChangeSignOnDate,
} from './ephemeris-bodies.js';
import {
  assignHousesToPoints,
  computeChartAngles,
  computeHouseCusps,
} from './angles-houses.js';
import { computeAspects } from './aspects.js';
import {
  computeChartRuler,
  computeDispositorChain,
  computeDistributions,
} from './distributions.js';
import { detectPatterns } from './patterns.js';
import { buildNatalCacheKey, getCachedNatal, setCachedNatal } from './cache.js';

/**
 * Deterministic natal chart calculation.
 * Stateless: same input → same result (plus cache).
 *
 * @param {object} rawInput
 * @param {{ skipCache?: boolean }} [options]
 * @returns {object} NatalChartResult or error-shaped object
 */
export function calculateNatalChart(rawInput = {}, options = {}) {
  const started = Date.now();
  const analysisId = `natal_${started.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const warnings = [];

  try {
    const methodology = resolveNatalMethodology(rawInput.methodologyId);
    if (!methodology) {
      throw natalError(
        NatalEngineErrorCode.UNSUPPORTED_ZODIAC_SYSTEM,
        `unknown methodology ${rawInput.methodologyId}`,
      );
    }

    const normalized = normalizeNatalInput(rawInput, methodology);
    warnings.push(...normalized.warnings);

    if (!ZODIAC_SYSTEMS.includes(normalized.zodiacSystem)) {
      throw natalError(NatalEngineErrorCode.UNSUPPORTED_ZODIAC_SYSTEM, normalized.zodiacSystem);
    }
    if (normalized.zodiacSystem !== 'tropical') {
      throw natalError(
        NatalEngineErrorCode.UNSUPPORTED_ZODIAC_SYSTEM,
        'sidereal reserved for later; tropical only in v1',
      );
    }
    if (normalized.houseSystem && !HOUSE_SYSTEMS.includes(normalized.houseSystem)) {
      throw natalError(NatalEngineErrorCode.UNSUPPORTED_HOUSE_SYSTEM, normalized.houseSystem);
    }

    const locationResult = resolveBirthLocation({
      birthPlace: normalized.birthPlace,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      timezone: normalized.timezone,
    });

    const birthTimeKnown = Boolean(normalized.birthTime);
    const birthPlaceResolved = Boolean(locationResult.ok && locationResult.location);
    let timezoneResolved = false;
    let fullChartAvailable = false;
    /** @type {object|null} */
    let location = birthPlaceResolved ? locationResult.location : null;
    /** @type {object|null} */
    let instant = null;

    // Data requirement rules
    if (!birthTimeKnown && !birthPlaceResolved) {
      // Date only — planet positions at UTC noon; no ASC/houses
      instant = utcNoonProbe(normalized.birthDate);
      warnings.push(
        'Birth time and place unknown: Ascendant, houses, and MC are omitted. Planet positions use UTC noon probe.',
      );
      if (moonMayChangeSignOnDate(normalized.birthDate)) {
        warnings.push('Moon may change sign during this calendar day; birth time needed for a reliable Moon position.');
      }
    } else if (birthTimeKnown && !birthPlaceResolved) {
      // Time without place — never invent ASC/houses; planets only.
      if (locationResult.error?.code === NatalEngineErrorCode.AMBIGUOUS_BIRTH_PLACE) {
        return errorResult(locationResult.error, analysisId, started, warnings);
      }
      if (locationResult.error?.code === NatalEngineErrorCode.LOCATION_RESOLUTION_FAILED) {
        return errorResult(locationResult.error, analysisId, started, warnings);
      }
      if (normalized.timezone) {
        instant = resolveBirthInstant(normalized.birthDate, normalized.birthTime, normalized.timezone);
        timezoneResolved = true;
        warnings.push(
          'Birth place missing: Ascendant and houses are not calculated. Planet positions use the provided timezone.',
        );
      } else {
        // Without place or timezone we cannot responsibly map local clock → UTC.
        return errorResult(
          natalError(NatalEngineErrorCode.BIRTH_PLACE_REQUIRED),
          analysisId,
          started,
          warnings,
        );
      }
    } else if (!birthTimeKnown && birthPlaceResolved) {
      // Place without time — no ASC/houses; planets at local noon
      const tz = location.timezone || normalized.timezone;
      if (!tz) {
        throw natalError(NatalEngineErrorCode.TIMEZONE_RESOLUTION_FAILED, 'no timezone for place');
      }
      instant = resolveBirthInstant(normalized.birthDate, '12:00:00', tz);
      timezoneResolved = true;
      warnings.push(
        'Birth time unknown: Ascendant, houses, and MC are omitted. No noon-as-exact-chart assumption for angles.',
      );
      if (moonMayChangeSignOnDate(normalized.birthDate)) {
        warnings.push('Moon may change sign during this day; birth time needed for reliable Moon and lunar aspects.');
      }
    } else if (birthTimeKnown && birthPlaceResolved) {
      if (locationResult.error) {
        return errorResult(locationResult.error, analysisId, started, warnings);
      }
      const tz = location.timezone || normalized.timezone;
      if (!tz) {
        throw natalError(NatalEngineErrorCode.TIMEZONE_RESOLUTION_FAILED, 'timezone missing after place resolve');
      }
      instant = resolveBirthInstant(normalized.birthDate, normalized.birthTime, tz);
      timezoneResolved = true;
      fullChartAvailable = true;
    } else if (locationResult.error) {
      // Ambiguous / failed place when place was attempted
      if (
        normalized.birthPlace &&
        (locationResult.error.code === NatalEngineErrorCode.AMBIGUOUS_BIRTH_PLACE ||
          locationResult.error.code === NatalEngineErrorCode.LOCATION_RESOLUTION_FAILED)
      ) {
        return errorResult(locationResult.error, analysisId, started, warnings);
      }
    }

    const cacheKey = buildNatalCacheKey({
      birthDate: normalized.birthDate,
      birthTime: normalized.birthTime,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      timezone: instant?.timezone ?? null,
      zodiacSystem: normalized.zodiacSystem,
      houseSystem: fullChartAvailable ? normalized.houseSystem : null,
      ayanamsa: normalized.ayanamsa,
      methodologyId: methodology.methodologyId,
      rulesetVersion: methodology.rulesetVersion,
      includeMinorAspects: normalized.includeMinorAspects,
    });

    if (!options.skipCache) {
      const cached = getCachedNatal(cacheKey);
      if (cached) {
        return {
          ...cached,
          analysisId,
          observability: {
            ...cached.observability,
            analysisId,
            durationMs: Date.now() - started,
            cacheHit: true,
          },
        };
      }
    }

    const moonUncertainty = !birthTimeKnown;
    let points = computePlanetaryPositions(instant.utcDate, { moonUncertainty });

    /** @type {object|null} */
    let angles = null;
    /** @type {object[]|undefined} */
    let houses;
    let chartRuler = null;
    let ramc = null;
    let obliquity = null;

    if (fullChartAvailable && location) {
      const anglePack = computeChartAngles(instant.utcDate, location.latitude, location.longitude);
      angles = anglePack.angles;
      ramc = anglePack.ramc;
      obliquity = anglePack.obliquity;

      const housePack = computeHouseCusps(
        normalized.houseSystem,
        angles,
        ramc,
        obliquity,
        location.latitude,
      );
      houses = housePack.cusps;
      warnings.push(...housePack.warnings);

      // Include angles in point list for aspects/houses
      const anglePoints = [
        angles.ascendant,
        angles.descendant,
        angles.midheaven,
        angles.imumCoeli,
      ];
      points = assignHousesToPoints([...points, ...anglePoints], houses);
      // Keep planet list with houses; angles also housed
      chartRuler = computeChartRuler(angles.ascendant, points);
    } else if (birthTimeKnown && !birthPlaceResolved) {
      // planets only — already computed
    }

    const aspectPoints = fullChartAvailable
      ? points
      : points.filter((p) => !['Ascendant', 'Descendant', 'Midheaven', 'ImumCoeli'].includes(p.body));

    const aspects = computeAspects(aspectPoints, methodology, {
      includeMinor: normalized.includeMinorAspects,
    });

    const distributions = computeDistributions(points, methodology, {
      housesAvailable: Boolean(houses),
    });

    const patterns =
      methodology.includePatternsByDefault && normalized.includePatterns
        ? detectPatterns(points, aspects)
        : undefined;

    const dispositorChain = fullChartAvailable ? computeDispositorChain(points) : undefined;

    const result = {
      ok: true,
      engineId: ENGINE_ID,
      engineVersion: ENGINE_VERSION,
      analysisId,
      methodology: {
        methodologyId: methodology.methodologyId,
        methodologyVersion: methodology.methodologyVersion,
        zodiacSystem: normalized.zodiacSystem,
        houseSystem: fullChartAvailable ? normalized.houseSystem : undefined,
        ayanamsa: normalized.ayanamsa || undefined,
        ephemerisProvider: methodology.ephemerisProvider,
        rulesetVersion: methodology.rulesetVersion,
      },
      normalizedInput: {
        birthDate: normalized.birthDate,
        birthTime: normalized.birthTime || undefined,
        birthPlace: location?.displayName || normalized.birthPlace || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
        timezone: instant?.timezone,
        utcDateTime: instant?.utcDateTime,
        subjectId: normalized.subjectId,
        subjectLabel: normalized.subjectLabel || undefined,
      },
      dataQuality: {
        birthTimeKnown,
        birthTimeConfidence: normalized.birthTimeConfidence,
        birthPlaceResolved,
        timezoneResolved,
        fullChartAvailable,
        warnings: [...warnings],
      },
      location: location || undefined,
      points: points.map(stripInternal),
      houses: houses || undefined,
      angles: angles
        ? {
            ascendant: stripInternal(angles.ascendant),
            descendant: stripInternal(angles.descendant),
            midheaven: stripInternal(angles.midheaven),
            imumCoeli: stripInternal(angles.imumCoeli),
          }
        : undefined,
      aspects,
      distributions,
      patterns,
      chartRuler: chartRuler || undefined,
      dispositorChain,
      calculationTrace: {
        inputLocalDateTime: instant?.localDateTime,
        resolvedTimezone: instant?.timezone,
        utcDateTime: instant?.utcDateTime,
        utcOffset: instant?.utcOffset,
        latitude: location?.latitude,
        longitude: location?.longitude,
        ephemerisProvider: methodology.ephemerisProvider,
        zodiacSystem: normalized.zodiacSystem,
        houseSystem: fullChartAvailable ? normalized.houseSystem : null,
        ramc: ramc != null ? Number(ramc.toFixed(6)) : undefined,
        obliquity: obliquity != null ? Number(obliquity.toFixed(6)) : undefined,
        nodeType: 'mean',
        chiron: 'unsupported-in-v1',
      },
      memoryMeta: normalized.memoryMeta || undefined,
      warnings: [...warnings],
      observability: {
        analysisId,
        engineId: ENGINE_ID,
        engineVersion: ENGINE_VERSION,
        methodologyId: methodology.methodologyId,
        durationMs: Date.now() - started,
        cacheHit: false,
        warnings: [...warnings],
        errorCode: null,
      },
    };

    if (!options.skipCache) {
      setCachedNatal(cacheKey, result);
    }

    result.observability.durationMs = Date.now() - started;
    return result;
  } catch (err) {
    if (err instanceof NatalEngineError) {
      return errorResult(err, analysisId, started, warnings);
    }
    return errorResult(
      natalError(NatalEngineErrorCode.EPHEMERIS_CALCULATION_FAILED, err?.message || String(err)),
      analysisId,
      started,
      warnings,
    );
  }
}

/**
 * @param {object} p
 */
function stripInternal(p) {
  if (!p) return p;
  const { uncertainty, meta, ...rest } = p;
  return {
    ...rest,
    ...(uncertainty ? { uncertainty } : {}),
    ...(meta ? { meta } : {}),
    signTr: ZODIAC_SIGNS_TR[p.sign] || p.sign,
  };
}

/**
 * @param {NatalEngineError} err
 * @param {string} analysisId
 * @param {number} started
 * @param {string[]} warnings
 */
function errorResult(err, analysisId, started, warnings) {
  console.error(
    `[natal-engine] analysisId=${analysisId} code=${err.code} detail=${err.detail || ''}`,
  );
  return {
    ok: false,
    engineId: ENGINE_ID,
    engineVersion: ENGINE_VERSION,
    analysisId,
    errorCode: err.code,
    message: err.userMessage,
    detail: err.detail || undefined,
    meta: err.meta || undefined,
    warnings,
    observability: {
      analysisId,
      engineId: ENGINE_ID,
      engineVersion: ENGINE_VERSION,
      durationMs: Date.now() - started,
      cacheHit: false,
      warnings,
      errorCode: err.code,
    },
  };
}

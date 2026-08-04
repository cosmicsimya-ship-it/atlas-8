import { MONTH_NAMES_TR } from './constants.js';
import { NatalEngineErrorCode, natalError } from './errors.js';

/**
 * @param {string} text
 */
export function foldPlaceKey(text) {
  return String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/[î]/g, 'i')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/['’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y, m) {
  const dim = [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dim[m - 1];
}

/**
 * @param {number} y
 * @param {number} m
 * @param {number} d
 */
export function assertValidCivilDate(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    throw natalError(NatalEngineErrorCode.INVALID_BIRTH_DATE, 'non-integer date parts');
  }
  if (y < 1800 || y > 2100) {
    throw natalError(NatalEngineErrorCode.INVALID_BIRTH_DATE, `year out of supported range: ${y}`);
  }
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    throw natalError(NatalEngineErrorCode.INVALID_BIRTH_DATE, `invalid civil date ${y}-${m}-${d}`);
  }
}

/**
 * Parse birth date strings into ISO date (YYYY-MM-DD).
 * Supports: 1986-01-27, 27.01.1986, 27/01/1986, 27 Ocak 1986
 * @param {string} raw
 * @returns {string}
 */
export function normalizeBirthDate(raw) {
  const text = String(raw ?? '').trim();
  if (!text) {
    throw natalError(NatalEngineErrorCode.INVALID_BIRTH_DATE, 'empty');
  }

  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    assertValidCivilDate(y, mo, d);
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  m = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    assertValidCivilDate(y, mo, d);
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  m = text.match(/^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})$/u);
  if (m) {
    const d = Number(m[1]);
    const monthKey = foldPlaceKey(m[2]);
    const mo = MONTH_NAMES_TR[monthKey];
    const y = Number(m[3]);
    if (!mo) {
      throw natalError(NatalEngineErrorCode.INVALID_BIRTH_DATE, `unknown month name: ${m[2]}`);
    }
    assertValidCivilDate(y, mo, d);
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  throw natalError(NatalEngineErrorCode.INVALID_BIRTH_DATE, `unrecognized format: ${text}`);
}

/**
 * Parse birth time into HH:MM:SS (24h).
 * Supports: 18:20, 18.20, 18:20:30, 6:05 PM
 * Approximate phrases like "sabah" are NOT coerced to a clock time.
 * @param {string} raw
 * @returns {{ time: string, confidence: 'exact'|'approximate' }}
 */
export function normalizeBirthTime(raw) {
  const text = String(raw ?? '').trim();
  if (!text) {
    throw natalError(NatalEngineErrorCode.INVALID_BIRTH_TIME, 'empty');
  }

  const lower = foldPlaceKey(text);
  if (
    /^(sabah|ogle|oglen|aksam|gece|morning|afternoon|evening|night|yaklasik|approx)/.test(lower) &&
    !/\d/.test(text)
  ) {
    throw natalError(
      NatalEngineErrorCode.INVALID_BIRTH_TIME,
      'approximate verbal time cannot be coerced to exact clock',
      { birthTimeConfidence: 'unknown', verbal: text },
    );
  }

  let m = text.match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm|AM|PM)?$/);
  if (!m) {
    throw natalError(NatalEngineErrorCode.INVALID_BIRTH_TIME, `unrecognized format: ${text}`);
  }

  let hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = m[3] != null ? Number(m[3]) : 0;
  const meridiem = m[4] ? m[4].toLowerCase() : null;

  if (mm > 59 || ss > 59) {
    throw natalError(NatalEngineErrorCode.INVALID_BIRTH_TIME, `invalid minutes/seconds: ${text}`);
  }

  if (meridiem) {
    if (hh < 1 || hh > 12) {
      throw natalError(NatalEngineErrorCode.INVALID_BIRTH_TIME, `invalid 12h hour: ${text}`);
    }
    if (meridiem === 'pm' && hh < 12) hh += 12;
    if (meridiem === 'am' && hh === 12) hh = 0;
  } else if (hh > 23) {
    throw natalError(NatalEngineErrorCode.INVALID_BIRTH_TIME, `invalid 24h hour: ${text}`);
  }

  const confidence = /yaklasik|approx|circa|~/.test(lower) ? 'approximate' : 'exact';
  return {
    time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
    confidence,
  };
}

/**
 * @param {import('./methodology.js').WESTERN_TROPICAL_NATAL_V1} methodology
 * @param {object} input
 */
export function normalizeNatalInput(input = {}, methodology) {
  const warnings = [];
  if (!input.birthDate) {
    throw natalError(NatalEngineErrorCode.INVALID_BIRTH_DATE, 'birthDate required');
  }

  const birthDate = normalizeBirthDate(input.birthDate);

  let birthTime = null;
  /** @type {'exact'|'approximate'|'unknown'} */
  let birthTimeConfidence = 'unknown';
  if (input.birthTime != null && String(input.birthTime).trim() !== '') {
    try {
      const nt = normalizeBirthTime(input.birthTime);
      birthTime = nt.time;
      birthTimeConfidence = nt.confidence;
      if (birthTimeConfidence === 'approximate') {
        warnings.push(
          'Approximate birth time: Ascendant degree, houses, and some Moon aspects may shift.',
        );
      }
    } catch (err) {
      if (err?.code === NatalEngineErrorCode.INVALID_BIRTH_TIME && err?.meta?.birthTimeConfidence === 'unknown') {
        warnings.push(
          'Verbal/approximate birth time was not coerced to a clock time; houses and Ascendant are omitted.',
        );
        birthTime = null;
        birthTimeConfidence = 'unknown';
      } else {
        throw err;
      }
    }
  }

  const houseSystem = input.houseSystem || methodology.defaultHouseSystem;
  const zodiacSystem = input.zodiacSystem || methodology.zodiacSystem;
  const ayanamsa = input.ayanamsa || null;

  return {
    birthDate,
    birthTime,
    birthTimeConfidence,
    birthPlace: input.birthPlace != null ? String(input.birthPlace).trim() : null,
    latitude: input.latitude != null ? Number(input.latitude) : null,
    longitude: input.longitude != null ? Number(input.longitude) : null,
    timezone: input.timezone != null ? String(input.timezone).trim() : null,
    houseSystem,
    zodiacSystem,
    ayanamsa,
    subjectId: input.subjectId || 'self',
    subjectLabel: input.subjectLabel || null,
    memoryMeta: input.memoryMeta || null,
    includeMinorAspects: input.includeMinorAspects === true,
    includePatterns: input.includePatterns !== false,
    warnings,
  };
}

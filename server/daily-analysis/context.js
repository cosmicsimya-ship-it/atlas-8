/**
 * Shared request context helpers for daily-analysis layers.
 */
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from './schema.js';

/**
 * @param {unknown} value
 * @returns {Date}
 */
export function parseDateInput(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('INVALID_DATE');
    return value;
  }
  if (value == null || value === '') {
    return new Date();
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('INVALID_DATE');
  return d;
}

/**
 * @param {string} [timeZone]
 */
export function assertTimezone(timeZone) {
  const tz = timeZone || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    throw new Error('INVALID_TIMEZONE');
  }
}

/**
 * @param {number|null|undefined} latitude
 * @param {number|null|undefined} longitude
 * @returns {{ ok: true, latitude: number, longitude: number } | { ok: false, error: string }}
 */
export function validateCoordinates(latitude, longitude) {
  if (latitude == null || longitude == null || latitude === '' || longitude === '') {
    return { ok: false, error: 'COORDINATES_MISSING' };
  }
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: 'COORDINATES_INVALID' };
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { ok: false, error: 'COORDINATES_OUT_OF_RANGE' };
  }
  return { ok: true, latitude: lat, longitude: lon };
}

/**
 * Civil Y-M-D parts in a timezone.
 * @param {Date} date
 * @param {string} timeZone
 */
export function getCivilParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const second = Number(get('second'));
  const weekdayShort = get('weekday');

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekdayShort,
    isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    localDateTime: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
  };
}

/**
 * Day of year (1-366) for civil Y-M-D.
 */
export function dayOfYear(year, month, day) {
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86400000) + 1;
}

/**
 * ISO week number (approximate via Thursday rule).
 */
export function isoWeekNumber(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Normalize orchestrator request into a stable context object.
 * @param {object} [input]
 */
export function normalizeRequestContext(input = {}) {
  const timezone = assertTimezone(input.timezone ?? input.timeZone ?? DEFAULT_TIMEZONE);
  const date = parseDateInput(input.date ?? input.when);
  const locale = input.locale || DEFAULT_LOCALE;
  const coords = validateCoordinates(input.latitude, input.longitude);
  const civil = getCivilParts(date, timezone);

  return {
    date,
    timezone,
    locale,
    latitude: coords.ok ? coords.latitude : null,
    longitude: coords.ok ? coords.longitude : null,
    hasCoordinates: coords.ok,
    coordinatesError: coords.ok ? null : coords.error,
    civil,
    dateKey: civil.isoDate,
    numerologyConfig: {
      keepMasterNumbers: input.keepMasterNumbers !== false,
      masterNumbers: Array.isArray(input.masterNumbers)
        ? input.masterNumbers.map(Number)
        : [11, 22, 33],
    },
  };
}

/**
 * Format duration ms → HH:MM display + seconds.
 * @param {number} ms
 */
export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    totalSeconds,
    hours,
    minutes,
    seconds,
    display: `${hours}s ${String(minutes).padStart(2, '0')}dk`,
    isoLike: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
  };
}

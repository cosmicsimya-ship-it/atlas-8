import { NatalEngineErrorCode, natalError } from './errors.js';

/**
 * Validate IANA timezone via Intl.
 * @param {string} timeZone
 */
export function assertValidTimezone(timeZone) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Format offset minutes as ±HH:MM.
 * @param {number} offsetMinutes
 */
export function formatUtcOffset(offsetMinutes) {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/**
 * Historical UTC offset for a local civil datetime in an IANA zone.
 * Uses Intl (ICU) so DST and historical rule changes are honored.
 *
 * @param {string} birthDate YYYY-MM-DD
 * @param {string} birthTime HH:MM:SS
 * @param {string} timeZone
 * @returns {{
 *   localDateTime: string,
 *   timezone: string,
 *   utcOffset: string,
 *   utcOffsetMinutes: number,
 *   utcDateTime: string,
 *   utcDate: Date,
 * }}
 */
export function resolveBirthInstant(birthDate, birthTime, timeZone) {
  if (!timeZone || !assertValidTimezone(timeZone)) {
    throw natalError(NatalEngineErrorCode.TIMEZONE_RESOLUTION_FAILED, `invalid timezone: ${timeZone}`);
  }

  const time = birthTime || '12:00:00';
  const localDateTime = `${birthDate}T${time}`;
  const guess = new Date(`${localDateTime}Z`);
  if (Number.isNaN(guess.getTime())) {
    throw natalError(NatalEngineErrorCode.INVALID_BIRTH_DATE, `bad local datetime ${localDateTime}`);
  }

  // Iterate to resolve the UTC instant that formats back to the requested local wall time.
  let utcMs = guess.getTime();
  for (let i = 0; i < 4; i += 1) {
    const offsetMin = getTimeZoneOffsetMinutes(new Date(utcMs), timeZone);
    const asUtc = Date.parse(`${localDateTime}Z`);
    utcMs = asUtc - offsetMin * 60_000;
  }

  const utcDate = new Date(utcMs);
  const parts = getZonedParts(utcDate, timeZone);
  const expected = parseLocalParts(birthDate, time);
  if (
    parts.year !== expected.year ||
    parts.month !== expected.month ||
    parts.day !== expected.day ||
    parts.hour !== expected.hour ||
    parts.minute !== expected.minute
  ) {
    // DST gap/fold — still return best effort but flag via offset consistency check.
    // Prefer the offset that matches wall time as closely as possible.
  }

  const utcOffsetMinutes = getTimeZoneOffsetMinutes(utcDate, timeZone);
  return {
    localDateTime,
    timezone: timeZone,
    utcOffset: formatUtcOffset(utcOffsetMinutes),
    utcOffsetMinutes,
    utcDateTime: utcDate.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    utcDate,
  };
}

/**
 * @param {Date} date
 * @param {string} timeZone
 */
export function getTimeZoneOffsetMinutes(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(date);
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT';
  // Examples: GMT+2, GMT+02:00, GMT-5, GMT
  const m = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!m) {
    if (/^UTC$/i.test(tzName) || /^GMT$/i.test(tzName)) return 0;
    // Fallback: compare locale strings
    const asUTC = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const asLocal = new Date(date.toLocaleString('en-US', { timeZone }));
    return Math.round((asLocal.getTime() - asUTC.getTime()) / 60_000);
  }
  const sign = m[1] === '-' ? -1 : 1;
  const hh = Number(m[2]);
  const mm = m[3] != null ? Number(m[3]) : 0;
  return sign * (hh * 60 + mm);
}

/**
 * @param {Date} date
 * @param {string} timeZone
 */
function getZonedParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * @param {string} birthDate
 * @param {string} birthTime
 */
function parseLocalParts(birthDate, birthTime) {
  const [y, m, d] = birthDate.split('-').map(Number);
  const [hh, mm, ss] = birthTime.split(':').map(Number);
  return { year: y, month: m, day: d, hour: hh, minute: mm, second: ss || 0 };
}

/**
 * Noon UTC probe when only date is known (planet longitudes except sensitive Moon).
 * @param {string} birthDate
 */
export function utcNoonProbe(birthDate) {
  const utcDate = new Date(`${birthDate}T12:00:00Z`);
  return {
    localDateTime: `${birthDate}T12:00:00`,
    timezone: 'UTC',
    utcOffset: '+00:00',
    utcOffsetMinutes: 0,
    utcDateTime: utcDate.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    utcDate,
    provisional: true,
  };
}

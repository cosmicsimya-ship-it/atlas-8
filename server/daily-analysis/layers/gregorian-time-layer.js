/**
 * Gregorian civil date/time layer (computed).
 */
import { makeLayerResult } from '../schema.js';
import {
  dayOfYear,
  getCivilParts,
  isLeapYear,
  isoWeekNumber,
  parseDateInput,
  assertTimezone,
} from '../context.js';

const MONTHS_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * @param {import('../context.js').normalizeRequestContext extends Function ? any : object} ctx
 */
export function buildGregorianTimeLayer(ctx) {
  try {
    const timezone = assertTimezone(ctx.timezone);
    const date = ctx.date instanceof Date ? ctx.date : parseDateInput(ctx.date);
    const civil = ctx.civil ?? getCivilParts(date, timezone);
    const leap = isLeapYear(civil.year);

    return makeLayerResult({
      id: 'gregorian-date',
      title: 'Miladi Tarih',
      type: 'computed',
      source: 'Intl civil calendar',
      confidence: 'high',
      status: 'success',
      computedData: {
        isoDate: civil.isoDate,
        day: civil.day,
        month: civil.month,
        year: civil.year,
        monthName: MONTHS_TR[civil.month - 1],
        monthNameEn: MONTHS_EN[civil.month - 1],
        weekday: new Intl.DateTimeFormat(ctx.locale || 'tr-TR', {
          timeZone: timezone,
          weekday: 'long',
        }).format(date),
        dayOfYear: dayOfYear(civil.year, civil.month, civil.day),
        weekOfYear: isoWeekNumber(civil.year, civil.month, civil.day),
        isLeapYear: leap,
        timezone,
        localDateTime: civil.localDateTime,
      },
      interpretation: null,
      warnings: [],
      metadata: {
        timezone,
        locale: ctx.locale || 'tr-TR',
        algorithm: 'Intl.DateTimeFormat civil parts',
        dateKey: civil.isoDate,
      },
    });
  } catch (err) {
    return makeLayerResult({
      id: 'gregorian-date',
      title: 'Miladi Tarih',
      type: 'computed',
      source: 'Intl civil calendar',
      confidence: 'low',
      status: 'error',
      computedData: null,
      interpretation: null,
      warnings: [err.message === 'INVALID_TIMEZONE' ? 'Geçersiz timezone.' : 'Geçersiz tarih.'],
      metadata: {
        error: err.message ?? 'GREGORIAN_FAILURE',
        timezone: ctx?.timezone ?? null,
      },
    });
  }
}

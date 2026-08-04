/**
 * Weekday layer — localized weekday metadata (computed).
 */
import { makeLayerResult } from '../schema.js';
import { assertTimezone, getCivilParts, parseDateInput } from '../context.js';

const ISO_WEEKDAY = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * @param {object} ctx
 */
export function buildWeekdayLayer(ctx) {
  try {
    const timezone = assertTimezone(ctx.timezone);
    const date = ctx.date instanceof Date ? ctx.date : parseDateInput(ctx.date);
    const civil = ctx.civil ?? getCivilParts(date, timezone);
    const locale = ctx.locale || 'tr-TR';

    const localName = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      weekday: 'long',
    }).format(date);
    const englishName = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
    }).format(date);
    const isoWeekday = ISO_WEEKDAY[civil.weekdayShort] ?? null;
    const isWeekend = isoWeekday === 6 || isoWeekday === 7;

    return makeLayerResult({
      id: 'weekday',
      title: 'Haftanın Günü',
      type: 'computed',
      source: 'Intl weekday',
      confidence: 'high',
      status: 'success',
      computedData: {
        localName,
        englishName,
        isoWeekdayNumber: isoWeekday,
        isWeekend,
        dateKey: civil.isoDate,
      },
      interpretation: null,
      warnings: [],
      metadata: {
        timezone,
        locale,
        algorithm: 'Intl.DateTimeFormat weekday',
      },
    });
  } catch (err) {
    return makeLayerResult({
      id: 'weekday',
      title: 'Haftanın Günü',
      type: 'computed',
      source: 'Intl weekday',
      confidence: 'low',
      status: 'error',
      computedData: null,
      interpretation: null,
      warnings: [String(err.message || err)],
      metadata: { error: err.message ?? 'WEEKDAY_FAILURE' },
    });
  }
}

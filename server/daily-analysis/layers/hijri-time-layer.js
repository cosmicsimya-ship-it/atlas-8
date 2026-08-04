/**
 * Hijri calendar layer — deterministic conversion (computed/calendar).
 */
import {
  gregorianToHijri,
  hijriMonthNameTr,
  hijriMonthSection,
  hijriMonthSectionLabelTr,
} from '../../atlas-symbolic-calendar.js';
import { makeLayerResult } from '../schema.js';
import { assertTimezone, getCivilParts, parseDateInput } from '../context.js';

const PHASE_EN = {
  baslangic: 'start',
  orta: 'middle',
  son: 'end',
};

/**
 * @param {object} ctx
 */
export function buildHijriTimeLayer(ctx) {
  try {
    const timezone = assertTimezone(ctx.timezone);
    const date = ctx.date instanceof Date ? ctx.date : parseDateInput(ctx.date);
    const civil = ctx.civil ?? getCivilParts(date, timezone);
    const hijri = gregorianToHijri(civil.year, civil.month, civil.day);
    const section = hijriMonthSection(hijri.hd);
    const monthName = hijriMonthNameTr(hijri.hm);
    const method = hijri.method || 'islamic-umalqura';
    const sourceLabel =
      method === 'islamic-umalqura'
        ? 'ICU islamic-umalqura (Umm al-Qura)'
        : 'Kuwaiti arithmetic calendar';

    return makeLayerResult({
      id: 'hijri-date',
      title: 'Hicri Tarih',
      type: 'calendar',
      source: sourceLabel,
      confidence: 'medium',
      status: 'success',
      computedData: {
        year: hijri.hy,
        month: hijri.hm,
        monthName,
        day: hijri.hd,
        display: `${hijri.hd} ${monthName} ${hijri.hy}`,
        phaseOfMonth: PHASE_EN[section] ?? section,
        phaseOfMonthTr: section,
        phaseOfMonthLabel: hijriMonthSectionLabelTr(section),
        conversionMethod: method,
      },
      interpretation: null,
      warnings: [
        'Hilal gözlemine göre ±1 gün farklılık olabilir.',
        'Dini veya resmî kullanım için yerel resmî takvim esas alınmalıdır.',
      ],
      metadata: {
        timezone,
        algorithm: method,
        gregorianIso: civil.isoDate,
        reference: 'Umm al-Qura / ICU',
      },
    });
  } catch (err) {
    return makeLayerResult({
      id: 'hijri-date',
      title: 'Hicri Tarih',
      type: 'calendar',
      source: 'hijri-conversion',
      confidence: 'low',
      status: 'error',
      computedData: null,
      interpretation: null,
      warnings: ['Hicri dönüşüm hatası.'],
      metadata: { error: err.message ?? 'HIJRI_CONVERSION_FAILURE' },
    });
  }
}

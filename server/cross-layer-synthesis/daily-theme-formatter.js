/**
 * "Bugünün temasını oku" — structured daily cross-domain synthesis reply.
 *
 * Sections: Tarih / Numerolojik örüntü / Hicrî tarih / Ay fazı /
 * Astrolojik katman / Ortak tema / Atlas sentezi.
 *
 * All seven sections are deterministic — no LLM round-trip. Sections 1-4
 * come straight from buildDailyAnalysis(); section 5 from the same
 * ephemeris snapshot atlas-astrology-flow.js uses; sections 6-7 reuse the
 * existing cross-layer-synthesis composer (collectSynthesisLayers +
 * composeSynthesis), which already locks source-layer values and never
 * mutates them (ADR-009). "Atlas sentezi" is a short line built from the
 * composer's own locked relationship label + reflection question, not a
 * second free-form LLM call — this keeps the feature inside the existing
 * deterministic-data / bounded-narration pattern used across the app.
 */

import { buildDailyAnalysis } from '../daily-analysis/orchestrator.js';
import { buildEphemerisSnapshot } from '../atlas-ephemeris.js';
import { collectSynthesisLayers } from './message-integration.js';
import { ensureNormalizedLayer } from './normalize.js';
import { composeSynthesis } from './composer.js';

export const DAILY_THEME_FORMATTER_VERSION = 'atlas-daily-theme-formatter-v1';

/**
 * @param {object} layer daily-analysis LayerResult
 */
function formatTarih(layer) {
  const d = layer?.computedData;
  if (!d) return 'Miladi tarih hesaplanamadı.';
  return `${d.day} ${d.monthName} ${d.year}, ${d.weekday}`;
}

/**
 * @param {object} layer daily-analysis LayerResult (combined-numerology)
 */
function formatNumerolojikOrunku(layer) {
  const d = layer?.computedData;
  if (!d) return 'Numerolojik örüntü hesaplanamadı.';
  return (
    `Birleşik numeroloji sayısı: ${d.combinedReducedNumber}` +
    `${d.isMasterNumber ? ' (üst sayı)' : ''}` +
    ` — Miladi ${d.gregorianNumber} + Hicrî ${d.hijriNumber} = ${d.combinedRawTotal} → ${d.combinedReducedNumber}.`
  );
}

/**
 * @param {object} layer daily-analysis LayerResult (hijri-date)
 */
function formatHicriTarih(layer) {
  const d = layer?.computedData;
  if (!d) return 'Hicrî tarih hesaplanamadı.';
  const methodologyNote = (layer.warnings || []).find((w) => /±1 gün/i.test(w));
  return [`${d.display} (${d.phaseOfMonthLabel})`, methodologyNote].filter(Boolean).join(' — ');
}

/**
 * @param {object} layer daily-analysis LayerResult (moon-phase)
 */
function formatAyFazi(layer) {
  const d = layer?.computedData;
  if (!d) return 'Ay fazı hesaplanamadı.';
  return `${d.localizedPhaseName} (%${d.illuminationPercent} aydınlanma, ${d.ageDays} günlük)`;
}

/**
 * @param {object|null} sky buildEphemerisSnapshot() result
 */
function formatAstrolojikKatman(sky) {
  if (!sky?.ok) return 'Astrolojik katman hesaplanamadı.';
  return `Güneş ${sky.sun.display}, Ay ${sky.moon.display} — ${sky.moon.phase}.`;
}

/**
 * @param {object|null} synthesis composeSynthesis() result, or null if fewer than 2 layers
 */
function formatOrtakTema(synthesis) {
  if (!synthesis) return 'Bugünkü katmanlar arasında ortak tema kurulamadı (yetersiz katman).';
  return (
    synthesis.sections?.commonTheme ??
    synthesis.sections?.whyRelated ??
    'Ortak tema kurulamadı.'
  );
}

/**
 * @param {object|null} synthesis composeSynthesis() result
 */
function formatAtlasSentezi(synthesis) {
  if (!synthesis) {
    return 'Bugün için katmanları birleştirecek yeterli veri yok; tekil katmanlar yine de geçerli.';
  }
  const label = synthesis.primaryRelationship?.labelTr ?? 'İlişkisi belirsiz';
  const question = synthesis.sections?.reflectionQuestion ?? '';
  return [`Bugünün katmanları arasında ${label.toLocaleLowerCase('tr-TR')} bir ilişki okunuyor.`, question]
    .filter(Boolean)
    .join(' ');
}

/**
 * Build all 7 sections deterministically for a given date/location.
 *
 * @param {{ date?: Date, timezone?: string, latitude?: number, longitude?: number, locale?: string, message?: string }} [opts]
 */
export function buildDailyThemeSections(opts = {}) {
  const date = opts.date ?? new Date();
  const timezone = opts.timezone ?? 'Europe/Istanbul';
  const latitude = opts.latitude ?? 41.0082;
  const longitude = opts.longitude ?? 28.9784;
  const message = opts.message ?? 'bugünün temasını oku';

  const daily = buildDailyAnalysis({
    date,
    timezone,
    latitude,
    longitude,
    layers: ['gregorian-date', 'hijri-date', 'moon-phase', 'combined-numerology'],
  });

  const sky = buildEphemerisSnapshot({ when: date, latitude, longitude, timeZone: timezone });

  const collection = collectSynthesisLayers({
    message,
    when: date,
    intentInfo: {
      wantsSynthesis: true,
      combineExplicit: true,
      layersRequested: ['daily', 'astrology', 'numerology'],
      isUserExample: false,
    },
  });
  const synthesis =
    collection.layers.length >= 2
      ? composeSynthesis({
          layers: collection.layers.map(ensureNormalizedLayer),
          userMessage: message,
          userAskedToCombine: true,
        })
      : null;

  return {
    version: DAILY_THEME_FORMATTER_VERSION,
    tarih: formatTarih(daily.layers?.['gregorian-date']),
    numerolojikOrunku: formatNumerolojikOrunku(daily.layers?.['combined-numerology']),
    hicriTarih: formatHicriTarih(daily.layers?.['hijri-date']),
    ayFazi: formatAyFazi(daily.layers?.['moon-phase']),
    astrolojikKatman: formatAstrolojikKatman(sky),
    ortakTema: formatOrtakTema(synthesis),
    atlasSentezi: formatAtlasSentezi(synthesis),
    daily,
    sky,
    synthesis,
  };
}

/**
 * @param {ReturnType<typeof buildDailyThemeSections>} sections
 */
export function formatDailyThemeReply(sections) {
  return [
    'Tarih',
    sections.tarih,
    '',
    'Numerolojik örüntü',
    sections.numerolojikOrunku,
    '',
    'Hicrî tarih',
    sections.hicriTarih,
    '',
    'Ay fazı',
    sections.ayFazi,
    '',
    'Astrolojik katman',
    sections.astrolojikKatman,
    '',
    'Ortak tema',
    sections.ortakTema,
    '',
    'Atlas sentezi',
    sections.atlasSentezi,
  ].join('\n');
}

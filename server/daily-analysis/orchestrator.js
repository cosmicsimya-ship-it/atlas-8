/**
 * Daily Analysis Orchestrator — Faz A+B.
 * Calls independent layers; one failure does not abort the rest.
 * No LLM. interpretation always null.
 */
import { cacheGet, cacheSet, buildCacheKey } from './cache.js';
import { normalizeRequestContext } from './context.js';
import {
  DAILY_ANALYSIS_VERSION,
  LAYER_IDS,
  makeLayerResult,
  validateLayerResult,
} from './schema.js';
import { buildGregorianTimeLayer } from './layers/gregorian-time-layer.js';
import { buildHijriTimeLayer } from './layers/hijri-time-layer.js';
import { buildWeekdayLayer } from './layers/weekday-layer.js';
import { buildMoonPhaseLayer } from './layers/moon-phase-layer.js';
import { buildAstronomyLayer } from './layers/astronomy-layer.js';
import { buildSunTimesLayer } from './layers/sun-times-layer.js';
import { buildDayLengthLayer } from './layers/day-length-layer.js';
import { buildGregorianNumerologyLayer } from './layers/gregorian-numerology-layer.js';
import { buildHijriNumerologyLayer } from './layers/hijri-numerology-layer.js';
import { buildCombinedNumerologyLayer } from './layers/combined-numerology-layer.js';
import { buildPlanetaryHoursLayer } from './layers/planetary-hours-layer.js';

/**
 * Extensible registry — future traditional layers can register here later.
 * Faz A/B does not register Quran / Esma / dua / zikir / ebced / synthesis.
 */
export const LAYER_REGISTRY = Object.freeze({
  'gregorian-date': { title: 'Miladi Tarih', phase: 'A' },
  'hijri-date': { title: 'Hicri Tarih', phase: 'A' },
  weekday: { title: 'Haftanın Günü', phase: 'A' },
  'moon-phase': { title: 'Ay Evresi', phase: 'A' },
  astronomy: { title: 'Astronomik Veriler', phase: 'A' },
  'sun-times': { title: 'Güneş Doğuş / Batış', phase: 'A' },
  'day-length': { title: 'Gün Uzunluğu', phase: 'A' },
  'gregorian-numerology': { title: 'Miladi Numeroloji', phase: 'B' },
  'hijri-numerology': { title: 'Hicri Numeroloji', phase: 'B' },
  'combined-numerology': { title: 'Birleşik Numeroloji', phase: 'B' },
  'planetary-hours': { title: 'Gezegen Saatleri', phase: 'B' },
});

/**
 * @param {() => import('./schema.js').LayerResult} fn
 * @param {string} id
 * @param {string} title
 */
function safeRun(fn, id, title) {
  try {
    return fn();
  } catch (err) {
    return makeLayerResult({
      id,
      title,
      type: 'computed',
      source: 'orchestrator-guard',
      confidence: 'low',
      status: 'error',
      computedData: null,
      interpretation: null,
      warnings: ['Katman beklenmeyen hata nedeniyle atlandı.'],
      metadata: { error: err?.message ?? 'LAYER_EXCEPTION' },
    });
  }
}

/**
 * @param {{
 *   date?: Date|string|number,
 *   timezone?: string,
 *   latitude?: number,
 *   longitude?: number,
 *   locale?: string,
 *   layers?: string[],
 *   useCache?: boolean,
 *   keepMasterNumbers?: boolean,
 *   masterNumbers?: number[],
 * }} [options]
 */
export function buildDailyAnalysis(options = {}) {
  let ctx;
  try {
    ctx = normalizeRequestContext(options);
  } catch (err) {
    return {
      version: DAILY_ANALYSIS_VERSION,
      ok: false,
      error: err.message ?? 'INVALID_REQUEST',
      layers: {},
      layerOrder: [],
      metadata: {
        llmUsed: false,
        interpretationProduced: false,
        phase: 'A+B',
      },
    };
  }

  const requested =
    Array.isArray(options.layers) && options.layers.length > 0
      ? options.layers.filter((id) => LAYER_IDS.includes(id))
      : [...LAYER_IDS];

  const want = new Set(requested);
  const useCache = options.useCache !== false;
  /** @type {Record<string, import('./schema.js').LayerResult>} */
  const layers = {};

  const cacheWrap = (layerId, compute) => {
    if (!useCache) return compute();
    const key = buildCacheKey({
      layerId,
      dateKey: ctx.dateKey,
      timezone: ctx.timezone,
      latitude: ctx.latitude,
      longitude: ctx.longitude,
      locale: ctx.locale,
      extra: JSON.stringify(ctx.numerologyConfig || {}),
    });
    const hit = cacheGet(key);
    if (hit) return /** @type {import('./schema.js').LayerResult} */ (hit);
    const value = compute();
    if (value?.status === 'success' || value?.status === 'partial') {
      cacheSet(key, value);
    }
    return value;
  };

  if (want.has('gregorian-date')) {
    layers['gregorian-date'] = cacheWrap('gregorian-date', () =>
      safeRun(() => buildGregorianTimeLayer(ctx), 'gregorian-date', 'Miladi Tarih'),
    );
  }

  if (want.has('hijri-date')) {
    layers['hijri-date'] = cacheWrap('hijri-date', () =>
      safeRun(() => buildHijriTimeLayer(ctx), 'hijri-date', 'Hicri Tarih'),
    );
  }

  if (want.has('weekday')) {
    layers.weekday = cacheWrap('weekday', () =>
      safeRun(() => buildWeekdayLayer(ctx), 'weekday', 'Haftanın Günü'),
    );
  }

  if (want.has('moon-phase')) {
    layers['moon-phase'] = cacheWrap('moon-phase', () =>
      safeRun(() => buildMoonPhaseLayer(ctx), 'moon-phase', 'Ay Evresi'),
    );
  }

  if (want.has('astronomy')) {
    layers.astronomy = cacheWrap('astronomy', () =>
      safeRun(() => buildAstronomyLayer(ctx), 'astronomy', 'Astronomik Veriler'),
    );
  }

  if (want.has('sun-times')) {
    layers['sun-times'] = cacheWrap('sun-times', () =>
      safeRun(() => buildSunTimesLayer(ctx), 'sun-times', 'Güneş Doğuş / Batış'),
    );
  }

  if (want.has('day-length')) {
    layers['day-length'] = cacheWrap('day-length', () =>
      safeRun(
        () => buildDayLengthLayer(ctx, layers['sun-times'] ?? null),
        'day-length',
        'Gün Uzunluğu',
      ),
    );
  }

  if (want.has('gregorian-numerology')) {
    layers['gregorian-numerology'] = cacheWrap('gregorian-numerology', () =>
      safeRun(
        () => buildGregorianNumerologyLayer(ctx, layers['gregorian-date'] ?? null),
        'gregorian-numerology',
        'Miladi Numeroloji',
      ),
    );
  }

  if (want.has('hijri-numerology')) {
    if (!layers['hijri-date'] && !want.has('hijri-date')) {
      layers['hijri-date'] = safeRun(() => buildHijriTimeLayer(ctx), 'hijri-date', 'Hicri Tarih');
    }
    layers['hijri-numerology'] = cacheWrap('hijri-numerology', () =>
      safeRun(
        () => buildHijriNumerologyLayer(ctx, layers['hijri-date'] ?? null),
        'hijri-numerology',
        'Hicri Numeroloji',
      ),
    );
  }

  if (want.has('combined-numerology')) {
    if (!layers['gregorian-numerology']) {
      layers['gregorian-numerology'] = safeRun(
        () => buildGregorianNumerologyLayer(ctx, layers['gregorian-date'] ?? null),
        'gregorian-numerology',
        'Miladi Numeroloji',
      );
    }
    if (!layers['hijri-numerology']) {
      if (!layers['hijri-date']) {
        layers['hijri-date'] = safeRun(() => buildHijriTimeLayer(ctx), 'hijri-date', 'Hicri Tarih');
      }
      layers['hijri-numerology'] = safeRun(
        () => buildHijriNumerologyLayer(ctx, layers['hijri-date'] ?? null),
        'hijri-numerology',
        'Hicri Numeroloji',
      );
    }
    layers['combined-numerology'] = cacheWrap('combined-numerology', () =>
      safeRun(
        () =>
          buildCombinedNumerologyLayer(
            ctx,
            layers['gregorian-numerology'],
            layers['hijri-numerology'],
          ),
        'combined-numerology',
        'Birleşik Numeroloji',
      ),
    );
  }

  if (want.has('planetary-hours')) {
    layers['planetary-hours'] = cacheWrap('planetary-hours', () =>
      safeRun(
        () => buildPlanetaryHoursLayer(ctx, layers['sun-times'] ?? null),
        'planetary-hours',
        'Gezegen Saatleri',
      ),
    );
  }

  const layerOrder = requested.filter((id) => layers[id]);
  const schemaChecks = layerOrder.map((id) => ({
    id,
    ...validateLayerResult(layers[id]),
  }));

  const anySuccess = layerOrder.some(
    (id) => layers[id]?.status === 'success' || layers[id]?.status === 'partial',
  );

  return {
    version: DAILY_ANALYSIS_VERSION,
    ok: anySuccess,
    request: {
      date: ctx.date.toISOString(),
      dateKey: ctx.dateKey,
      timezone: ctx.timezone,
      locale: ctx.locale,
      latitude: ctx.latitude,
      longitude: ctx.longitude,
      hasCoordinates: ctx.hasCoordinates,
    },
    layers,
    layerOrder,
    schemaChecks,
    metadata: {
      llmUsed: false,
      interpretationProduced: false,
      phase: 'A+B',
      cacheUsed: useCache,
      note: 'Faz A/B: yalnızca hesaplanabilir katmanlar. interpretation=null. LLM yok.',
    },
  };
}

export { buildCacheKey };

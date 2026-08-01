/**
 * Daily Analysis Engine — Faz A+B acceptance tests.
 * Computation only; asserts no LLM and interpretation=null.
 */
import {
  buildDailyAnalysis,
  buildGregorianTimeLayer,
  buildHijriTimeLayer,
  buildWeekdayLayer,
  buildMoonPhaseLayer,
  buildAstronomyLayer,
  buildSunTimesLayer,
  buildDayLengthLayer,
  buildGregorianNumerologyLayer,
  buildHijriNumerologyLayer,
  buildCombinedNumerologyLayer,
  buildPlanetaryHoursLayer,
  validateLayerResult,
  buildCacheKey,
  cacheClear,
  normalizeRequestContext,
  DAILY_ANALYSIS_VERSION,
} from '../server/daily-analysis/index.js';
import {
  detectDailyAnalysisIntent,
  tryDailyAnalysis,
} from '../server/daily-analysis-flow.js';
import { numerologyDayNumber } from '../server/atlas-numerology.js';

let passed = 0;
let failed = 0;

function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const WHEN = new Date('2026-07-29T12:00:00+03:00');
const TZ = 'Europe/Istanbul';
const IST = { latitude: 41.0082, longitude: 28.9784 };

cacheClear();
const ctx = normalizeRequestContext({
  date: WHEN,
  timezone: TZ,
  latitude: IST.latitude,
  longitude: IST.longitude,
  locale: 'tr-TR',
});

// 1. Miladi tarih
const greg = buildGregorianTimeLayer(ctx);
record('1 miladi dönüşüm', greg.status === 'success' && greg.computedData.isoDate === '2026-07-29');
record('1 leap year false 2026', greg.computedData.isLeapYear === false);
record('1 schema', validateLayerResult(greg).ok);

// 2. Haftanın günü
const wd = buildWeekdayLayer(ctx);
record('2 weekday TR', wd.computedData.localName === 'Çarşamba', wd.computedData.localName);
record('2 weekday EN', wd.computedData.englishName === 'Wednesday');
record('2 iso weekday', wd.computedData.isoWeekdayNumber === 3);

// 3. Artık yıl
const leapCtx = normalizeRequestContext({
  date: new Date('2024-02-29T12:00:00+03:00'),
  timezone: TZ,
});
record('3 leap year 2024', buildGregorianTimeLayer(leapCtx).computedData.isLeapYear === true);

// 4-6. Hicri
const hijri = buildHijriTimeLayer(ctx);
record(
  '4 hicri dönüşüm 15 Safer 1448',
  hijri.status === 'success' &&
    hijri.computedData.year === 1448 &&
    hijri.computedData.month === 2 &&
    hijri.computedData.day === 15 &&
    hijri.computedData.monthName === 'Safer',
  JSON.stringify(hijri.computedData),
);
record('5 hicri ay bölümü middle', hijri.computedData.phaseOfMonth === 'middle');
record(
  '6 hicri ±1 gün uyarısı',
  hijri.warnings.some((w) => /±1|hilal/i.test(w)) &&
    hijri.warnings.some((w) => /yerel|resmî|resmi/i.test(w)),
);
record('6 confidence medium', hijri.confidence === 'medium');

// 7. Ay evresi
const moon = buildMoonPhaseLayer(ctx);
record(
  '7 ay evresi',
  moon.status === 'success' &&
    typeof moon.computedData.phaseName === 'string' &&
    Number.isFinite(moon.computedData.illuminationPercent) &&
    Number.isFinite(moon.computedData.ageDays) &&
    // 2026-07-29 near full: illumination high and phase near Full
    moon.computedData.illuminationPercent > 90 &&
    /Full|Dolunay|Gibbous|Şişkin/i.test(
      `${moon.computedData.phaseName} ${moon.computedData.localizedPhaseName}`,
    ),
  `${moon.computedData?.phaseName} ${moon.computedData?.illuminationPercent}% age=${moon.computedData?.ageDays}`,
);

// 8-9. Güneş + gün uzunluğu
const sun = buildSunTimesLayer(ctx);
record(
  '8 güneş doğuş/batış',
  sun.status === 'success' &&
    sun.computedData.sunrise?.localClock &&
    sun.computedData.sunset?.localClock &&
    sun.computedData.solarNoon,
  `${sun.computedData?.sunrise?.localClock} → ${sun.computedData?.sunset?.localClock}`,
);
const dayLen = buildDayLengthLayer(ctx, sun);
record(
  '9 gün uzunluğu',
  dayLen.status === 'success' &&
    dayLen.computedData.totalSeconds > 13 * 3600 &&
    dayLen.computedData.totalSeconds < 16 * 3600 &&
    typeof dayLen.computedData.previousDayDeltaSeconds === 'number',
  dayLen.computedData?.display,
);

// 10-13. Numeroloji
const gNum = buildGregorianNumerologyLayer(ctx, greg);
// 29.07.2026 → 2+9+0+7+2+0+2+6=28 → 10 → 1
record('10 miladi numeroloji 29.07.2026 → 1', gNum.computedData.reducedNumber === 1, String(gNum.computedData?.reducedNumber));
record('10 steps present', gNum.computedData.calculationSteps.length >= 1);

const hNum = buildHijriNumerologyLayer(ctx, hijri);
record('11 hicri numeroloji', hNum.status === 'success' && Number.isFinite(hNum.computedData.reducedNumber));

const combined = buildCombinedNumerologyLayer(ctx, gNum, hNum);
record(
  '12 birleşik numeroloji',
  combined.status === 'success' &&
    combined.computedData.gregorianNumber === 1 &&
    Number.isFinite(combined.computedData.combinedReducedNumber),
);

// 2000-01-08 → digits sum to 11
const masterKeep = numerologyDayNumber(2000, 1, 8, {
  keepMaster: true,
  masterNumbers: [11, 22, 33],
});
const masterReduce = numerologyDayNumber(2000, 1, 8, {
  keepMaster: false,
  masterNumbers: [11, 22, 33],
});
record('13 master keep 11', masterKeep.reducedNumber === 11 && masterKeep.isMasterNumber === true, String(masterKeep.reducedNumber));
record('13 master reduce config', masterReduce.reducedNumber === 2, String(masterReduce.reducedNumber));

const cfgCtx = normalizeRequestContext({
  date: WHEN,
  timezone: TZ,
  keepMasterNumbers: false,
  masterNumbers: [11, 22, 33],
});
const cfgNum = buildGregorianNumerologyLayer(cfgCtx, greg);
record('13 master config propagated', cfgNum.computedData.keepMasterNumbers === false);

// 14-15. Gezegen saatleri
const hours = buildPlanetaryHoursLayer(ctx, sun);
record(
  '14 gezegen saatleri',
  hours.status === 'success' &&
    hours.computedData.dayHours?.length === 12 &&
    hours.computedData.nightHours?.length === 12,
);
record(
  '15 gündüz+gece = 24',
  hours.computedData.dayHours.length + hours.computedData.nightHours.length === 24,
);
record(
  '15 traditional warning',
  hours.warnings.some((w) => /geleneksel/i.test(w)),
);
record(
  '15 localized names',
  hours.computedData.hours.every((h) => h.planet && h.localizedPlanetName),
);

// 16. Farklı timezone
const ny = normalizeRequestContext({
  date: WHEN,
  timezone: 'America/New_York',
  latitude: 40.7128,
  longitude: -74.006,
});
const nyGreg = buildGregorianTimeLayer(ny);
record('16 farklı timezone', nyGreg.computedData.timezone === 'America/New_York' && nyGreg.computedData.isoDate === '2026-07-29');

// 17. Farklı konum
const ankara = normalizeRequestContext({
  date: WHEN,
  timezone: TZ,
  latitude: 39.9334,
  longitude: 32.8597,
});
const sunAnkara = buildSunTimesLayer(ankara);
record(
  '17 farklı konum',
  sunAnkara.status === 'success' &&
    sunAnkara.computedData.sunrise.utcIso !== sun.computedData.sunrise.utcIso,
  `${sun.computedData.sunrise.utcIso} vs ${sunAnkara.computedData?.sunrise?.utcIso}`,
);

// 18. Eksik konum
const noLoc = normalizeRequestContext({ date: WHEN, timezone: TZ });
record('18 eksik konum sun unavailable', buildSunTimesLayer(noLoc).status === 'unavailable');
record('18 eksik konum hours unavailable', buildPlanetaryHoursLayer(noLoc).status === 'unavailable');
record('18 eksik konum day-length unavailable', buildDayLengthLayer(noLoc).status === 'unavailable');

// 19. Geçersiz koordinat
const bad = normalizeRequestContext({
  date: WHEN,
  timezone: TZ,
  latitude: 999,
  longitude: 28,
});
record('19 geçersiz koordinat', bad.hasCoordinates === false && bad.coordinatesError === 'COORDINATES_OUT_OF_RANGE');
record('19 sun-times error', buildSunTimesLayer(bad).status === 'error');

// 20. Bir katman hata → diğerleri devam
const partialReport = buildDailyAnalysis({
  date: WHEN,
  timezone: TZ,
  // no coords → sun/hours fail; gregorian/hijri/moon still ok
  layers: ['gregorian-date', 'hijri-date', 'moon-phase', 'sun-times', 'planetary-hours'],
  useCache: false,
});
record(
  '20 izolasyon',
  partialReport.layers['gregorian-date'].status === 'success' &&
    partialReport.layers['hijri-date'].status === 'success' &&
    partialReport.layers['moon-phase'].status === 'success' &&
    partialReport.layers['sun-times'].status === 'unavailable' &&
    partialReport.layers['planetary-hours'].status === 'unavailable' &&
    partialReport.ok === true,
);

// 21. Cache key
const k1 = buildCacheKey({
  layerId: 'sun-times',
  dateKey: '2026-07-29',
  timezone: TZ,
  latitude: 41.0082,
  longitude: 28.9784,
  locale: 'tr-TR',
});
const k2 = buildCacheKey({
  layerId: 'sun-times',
  dateKey: '2026-07-30',
  timezone: TZ,
  latitude: 41.0082,
  longitude: 28.9784,
  locale: 'tr-TR',
});
const k3 = buildCacheKey({
  layerId: 'sun-times',
  dateKey: '2026-07-29',
  timezone: 'UTC',
  latitude: 41.0082,
  longitude: 28.9784,
  locale: 'tr-TR',
});
record('21 cache key date sensitive', k1 !== k2);
record('21 cache key timezone sensitive', k1 !== k3);

cacheClear();
const r1 = buildDailyAnalysis({
  date: WHEN,
  timezone: TZ,
  latitude: IST.latitude,
  longitude: IST.longitude,
  layers: ['gregorian-date'],
  useCache: true,
});
const r2 = buildDailyAnalysis({
  date: WHEN,
  timezone: TZ,
  latitude: IST.latitude,
  longitude: IST.longitude,
  layers: ['gregorian-date'],
  useCache: true,
});
record(
  '21 cache hit stable',
  r1.layers['gregorian-date'].computedData.isoDate ===
    r2.layers['gregorian-date'].computedData.isoDate,
);

// 22. JSON schema
const full = buildDailyAnalysis({
  date: WHEN,
  timezone: TZ,
  latitude: IST.latitude,
  longitude: IST.longitude,
  useCache: false,
});
record('22 version', full.version === DAILY_ANALYSIS_VERSION);
record(
  '22 all schemas valid',
  full.schemaChecks.every((c) => c.ok),
  full.schemaChecks.filter((c) => !c.ok).map((c) => `${c.id}:${c.errors}`).join(';'),
);

// 23. LLM yok
record('23 llmUsed false', full.metadata.llmUsed === false);
record('23 no openai import path', !JSON.stringify(full).includes('openai'));

// 24. interpretation null
record(
  '24 interpretation null',
  full.layerOrder.every((id) => full.layers[id].interpretation === null),
);

// Astronomy layer
const astro = buildAstronomyLayer(ctx);
record(
  'astronomy planets + retrograde',
  astro.status === 'success' &&
    Array.isArray(astro.computedData.planets) &&
    typeof astro.computedData.planets[0].retrograde === 'boolean' &&
    /sınıflandırma|classification/i.test(astro.computedData.planets[0].note),
);

// Invalid timezone / date
const badTz = buildDailyAnalysis({ date: WHEN, timezone: 'Not/AZone' });
record('invalid timezone handled', badTz.ok === false && badTz.error === 'INVALID_TIMEZONE');
const badDate = buildDailyAnalysis({
  date: 'not-a-date',
  timezone: TZ,
  latitude: IST.latitude,
  longitude: IST.longitude,
});
record('invalid date handled', badDate.ok === false && badDate.error === 'INVALID_DATE');

// Flow integration point (not message-service)
record('flow intent', detectDailyAnalysisIntent('Katmanlı günlük analizi yap') === 'daily_analysis');
record('flow ignores fate', detectDailyAnalysisIntent('Bugün kesin olacak mı?') === null);
const flow = tryDailyAnalysis({
  message: 'Katmanlı günlük analizi yap',
  date: WHEN,
  timezone: TZ,
  latitude: IST.latitude,
  longitude: IST.longitude,
});
record('flow reply null (no LLM prose)', flow?.reply === null && flow?.report?.ok === true);

// No religious/fate content in computed payloads
const blob = JSON.stringify(full.layers);
record(
  'no forbidden content keys',
  !/esmaül|esmaul|ayet öner|kur.?an tema|kehanet|doğum haritası yorum/i.test(blob),
);

console.log('');
console.log(`=== Daily Analysis A+B: ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);

/**
 * Daily cross-domain theme synthesis ("bugünün temasını oku") regression.
 * Run: node scripts/test-daily-theme-synthesis.mjs
 */
import assert from 'node:assert/strict';
import {
  buildDailyThemeSections,
  formatDailyThemeReply,
} from '../server/cross-layer-synthesis/daily-theme-formatter.js';
import { buildDailyAnalysis } from '../server/daily-analysis/orchestrator.js';

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}: ${err?.message || err}`);
  }
}

const FIXED_DATE = new Date('2026-09-02T12:00:00Z');
const FIXED_OPTS = { date: FIXED_DATE, timezone: 'Europe/Istanbul', latitude: 41.0082, longitude: 28.9784 };

check('all 7 sections present, in order, with content', () => {
  const sections = buildDailyThemeSections(FIXED_OPTS);
  const reply = formatDailyThemeReply(sections);
  const labels = ['Tarih', 'Numerolojik örüntü', 'Hicrî tarih', 'Ay fazı', 'Astrolojik katman', 'Ortak tema', 'Atlas sentezi'];
  let lastIndex = -1;
  for (const label of labels) {
    const idx = reply.indexOf(label);
    assert.ok(idx > lastIndex, `${label} missing or out of order`);
    lastIndex = idx;
  }
});

check('sections 1-4 match buildDailyAnalysis() direct output for the same fixed inputs (no drift)', () => {
  const sections = buildDailyThemeSections(FIXED_OPTS);
  const direct = buildDailyAnalysis({
    ...FIXED_OPTS,
    layers: ['gregorian-date', 'hijri-date', 'moon-phase', 'combined-numerology'],
  });
  assert.match(sections.tarih, new RegExp(String(direct.layers['gregorian-date'].computedData.day)));
  assert.match(sections.tarih, new RegExp(direct.layers['gregorian-date'].computedData.monthName));
  assert.match(sections.hicriTarih, new RegExp(direct.layers['hijri-date'].computedData.display.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(
    sections.ayFazi,
    new RegExp(direct.layers['moon-phase'].computedData.localizedPhaseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  );
  assert.match(sections.numerolojikOrunku, new RegExp(String(direct.layers['combined-numerology'].computedData.combinedReducedNumber)));
});

check('is fully deterministic across repeated calls for the same date', () => {
  const a = buildDailyThemeSections(FIXED_OPTS);
  const b = buildDailyThemeSections(FIXED_OPTS);
  assert.equal(a.tarih, b.tarih);
  assert.equal(a.numerolojikOrunku, b.numerolojikOrunku);
  assert.equal(a.hicriTarih, b.hicriTarih);
  assert.equal(a.ayFazi, b.ayFazi);
  assert.equal(a.ortakTema, b.ortakTema);
  assert.equal(a.atlasSentezi, b.atlasSentezi);
});

check('hijri ±1 day methodology note surfaces in the Hicrî tarih section', () => {
  const sections = buildDailyThemeSections(FIXED_OPTS);
  assert.match(sections.hicriTarih, /±1 gün/);
});

console.log(`\n────────────────────────────────`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL DAILY THEME SYNTHESIS TESTS PASSED');
}

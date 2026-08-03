/**
 * Atlas Natal Astrology Engine — unit + golden + data-quality tests.
 * Run: npm run test:natal
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  angularSeparation,
  calculateNatalChart,
  clearNatalCache,
  computeAspects,
  foldPlaceKey,
  houseForLongitude,
  longitudeToSignParts,
  normalizeBirthDate,
  normalizeBirthTime,
  resolveBirthInstant,
  resolveBirthLocation,
  WESTERN_TROPICAL_NATAL_V1,
} from '../server/natal-engine/index.js';
import { getTimeZoneOffsetMinutes } from '../server/natal-engine/timezone.js';
import { detectAstrologyFlowIntent, tryAstrologyFlowReply } from '../server/atlas-astrology-flow.js';
import { ASCENDANT_CALC_AVAILABLE } from '../server/self-profile-resolver.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, '../server/natal-engine/fixtures');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

function approx(a, b, tol, label) {
  assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b} (tol ${tol})`);
}

console.log('\n=== Natal Engine: normalization ===');
test('ISO date', () => assert.equal(normalizeBirthDate('1986-01-27'), '1986-01-27'));
test('dotted date', () => assert.equal(normalizeBirthDate('27.01.1986'), '1986-01-27'));
test('Turkish month date', () => assert.equal(normalizeBirthDate('27 Ocak 1986'), '1986-01-27'));
test('invalid Feb 29 non-leap', () => {
  assert.throws(() => normalizeBirthDate('29.02.1985'), /INVALID_BIRTH_DATE|Doğum tarihi/);
});
test('time colon', () => assert.equal(normalizeBirthTime('18:20').time, '18:20:00'));
test('time dot', () => assert.equal(normalizeBirthTime('18.20').time, '18:20:00'));
test('invalid 24:60', () => {
  assert.throws(() => normalizeBirthTime('24:60'), /INVALID_BIRTH_TIME|Doğum saati/);
});
test('verbal sabah not coerced', () => {
  const r = calculateNatalChart({ birthDate: '1986-01-27', birthTime: 'sabah', birthPlace: 'Bursa' });
  assert.equal(r.ok, true);
  assert.equal(r.dataQuality.fullChartAvailable, false);
  assert.equal(r.angles, undefined);
});

console.log('\n=== Natal Engine: longitude helpers ===');
test('0° → Aries', () => assert.equal(longitudeToSignParts(0).sign, 'Aries'));
test('29.999 → Aries', () => assert.equal(longitudeToSignParts(29.999).sign, 'Aries'));
test('30° → Taurus', () => assert.equal(longitudeToSignParts(30).sign, 'Taurus'));
test('angular separation wrap', () => assert.equal(angularSeparation(10, 350), 20));

console.log('\n=== Natal Engine: location ambiguity ===');
test('Bursa resolves', () => {
  const r = resolveBirthLocation({ birthPlace: 'Bursa' });
  assert.equal(r.ok, true);
  assert.equal(r.location.countryCode, 'TR');
});
test('Springfield ambiguous', () => {
  const r = resolveBirthLocation({ birthPlace: 'Springfield' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'AMBIGUOUS_BIRTH_PLACE');
  assert.ok(r.candidates.length >= 2);
});
test('Cambridge ambiguous', () => {
  const r = resolveBirthLocation({ birthPlace: 'Cambridge' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'AMBIGUOUS_BIRTH_PLACE');
});
test('foldPlaceKey', () => assert.equal(foldPlaceKey('İstanbul'), 'istanbul'));

console.log('\n=== Natal Engine: timezone / DST ===');
test('Turkey winter 1986 offset +02', () => {
  const inst = resolveBirthInstant('1986-01-27', '18:20:00', 'Europe/Istanbul');
  assert.equal(inst.utcDateTime, '1986-01-27T16:20:00Z');
  assert.equal(inst.utcOffset, '+02:00');
});
test('Turkey summer 1990 has DST-aware offset', () => {
  const inst = resolveBirthInstant('1990-07-15', '14:30:00', 'Europe/Istanbul');
  assert.ok(inst.utcOffsetMinutes !== 0);
  // Historical TR summer was typically +03
  assert.ok(inst.utcOffsetMinutes === 180 || inst.utcOffsetMinutes === 120, `got ${inst.utcOffset}`);
});
test('US eastern DST June vs January differ', () => {
  const summer = getTimeZoneOffsetMinutes(new Date('1985-06-15T16:00:00Z'), 'America/New_York');
  const winter = getTimeZoneOffsetMinutes(new Date('1985-01-15T16:00:00Z'), 'America/New_York');
  assert.notEqual(summer, winter);
});

console.log('\n=== Natal Engine: missing data rules ===');
test('date only — no ASC/houses', () => {
  const r = calculateNatalChart({ birthDate: '1986-01-27' }, { skipCache: true });
  assert.equal(r.ok, true);
  assert.equal(r.dataQuality.fullChartAvailable, false);
  assert.equal(r.angles, undefined);
  assert.equal(r.houses, undefined);
  assert.ok(r.points.find((p) => p.body === 'Sun'));
});
test('date+place no time — no ASC', () => {
  const r = calculateNatalChart(
    { birthDate: '1986-01-27', birthPlace: 'Bursa' },
    { skipCache: true },
  );
  assert.equal(r.ok, true);
  assert.equal(r.dataQuality.fullChartAvailable, false);
  assert.equal(r.angles, undefined);
});
test('date+time no place — asks place', () => {
  const r = calculateNatalChart(
    { birthDate: '1986-01-27', birthTime: '18:20' },
    { skipCache: true },
  );
  assert.equal(r.ok, false);
  assert.equal(r.errorCode, 'BIRTH_PLACE_REQUIRED');
});
test('ambiguous place error', () => {
  const r = calculateNatalChart(
    { birthDate: '1986-01-27', birthTime: '18:20', birthPlace: 'Victoria' },
    { skipCache: true },
  );
  assert.equal(r.ok, false);
  assert.equal(r.errorCode, 'AMBIGUOUS_BIRTH_PLACE');
});

console.log('\n=== Natal Engine: full chart + aspects + distributions ===');
test('full Bursa chart', () => {
  clearNatalCache();
  const r = calculateNatalChart(
    { birthDate: '1986-01-27', birthTime: '18:20', birthPlace: 'Bursa' },
    { skipCache: true },
  );
  assert.equal(r.ok, true);
  assert.equal(r.engineId, 'atlas-natal-astrology');
  assert.equal(r.methodology.methodologyId, WESTERN_TROPICAL_NATAL_V1.methodologyId);
  assert.equal(r.dataQuality.fullChartAvailable, true);
  assert.equal(r.angles.ascendant.sign, 'Leo');
  assert.equal(r.angles.midheaven.sign, 'Taurus');
  assert.equal(r.houses.length, 12);
  assert.ok(r.aspects.length > 0);
  assert.ok(r.distributions.elements.Fire >= 0);
  assert.ok(r.calculationTrace.utcDateTime);
  assert.ok(r.points.every((p) => p.body !== 'Chiron'));
});
test('planet houses assigned', () => {
  const r = calculateNatalChart(
    { birthDate: '1986-01-27', birthTime: '18:20', birthPlace: 'Bursa' },
    { skipCache: true },
  );
  const sun = r.points.find((p) => p.body === 'Sun');
  assert.ok(sun.house >= 1 && sun.house <= 12);
});
test('house boundary near cusp', () => {
  const cusps = [
    { house: 1, longitude: 100 },
    { house: 2, longitude: 130 },
    { house: 3, longitude: 160 },
    { house: 4, longitude: 190 },
    { house: 5, longitude: 220 },
    { house: 6, longitude: 250 },
    { house: 7, longitude: 280 },
    { house: 8, longitude: 310 },
    { house: 9, longitude: 340 },
    { house: 10, longitude: 10 },
    { house: 11, longitude: 40 },
    { house: 12, longitude: 70 },
  ];
  assert.equal(houseForLongitude(100, cusps), 1);
  assert.equal(houseForLongitude(129.999, cusps), 1);
  assert.equal(houseForLongitude(130, cusps), 2);
  assert.equal(houseForLongitude(5, cusps), 9); // 340°→10° wrap still house 9
  assert.equal(houseForLongitude(10, cusps), 10);
  assert.equal(houseForLongitude(15, cusps), 10);
});
test('aspect orb engine', () => {
  const points = [
    { body: 'Sun', longitude: 0 },
    { body: 'Jupiter', longitude: 118.7 },
  ];
  const aspects = computeAspects(points, WESTERN_TROPICAL_NATAL_V1);
  const trine = aspects.find((a) => a.aspect === 'trine');
  assert.ok(trine);
  approx(trine.orb, 1.3, 0.05, 'trine orb');
});
test('cache hit speeds repeat', () => {
  clearNatalCache();
  const input = { birthDate: '1986-01-27', birthTime: '18:20', birthPlace: 'Bursa' };
  const t0 = Date.now();
  calculateNatalChart(input);
  const firstMs = Date.now() - t0;
  const t1 = Date.now();
  const second = calculateNatalChart(input);
  const secondMs = Date.now() - t1;
  assert.equal(second.observability.cacheHit, true);
  assert.ok(secondMs <= firstMs + 50, `cache ${secondMs}ms vs first ${firstMs}ms`);
});

console.log('\n=== Natal Engine: golden fixtures ===');
for (const file of readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'))) {
  test(`fixture ${file}`, () => {
    const fixture = JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf8'));
    const r = calculateNatalChart(fixture.input, { skipCache: true });
    assert.equal(r.ok, true, r.message || r.errorCode);
    const exp = fixture.expected;
    const tolP = fixture.tolerance?.planetLongitudeDeg ?? 0.05;
    const tolA = fixture.tolerance?.angleLongitudeDeg ?? 0.2;

    if (exp.fullChartAvailable != null) {
      assert.equal(r.dataQuality.fullChartAvailable, exp.fullChartAvailable);
    }
    if (exp.utcDateTime) assert.equal(r.normalizedInput.utcDateTime, exp.utcDateTime);
    if (exp.utcOffset) assert.equal(r.calculationTrace.utcOffset, exp.utcOffset);
    if (exp.timezone) assert.equal(r.normalizedInput.timezone, exp.timezone);

    const sun = r.points.find((p) => p.body === 'Sun');
    if (exp.sun?.sign) assert.equal(sun.sign, exp.sun.sign);
    if (exp.sun?.longitude != null) approx(sun.longitude, exp.sun.longitude, tolP, 'sun lon');

    if (exp.moon?.sign) {
      const moon = r.points.find((p) => p.body === 'Moon');
      assert.equal(moon.sign, exp.moon.sign);
    }
    if (exp.ascendant?.sign) assert.equal(r.angles.ascendant.sign, exp.ascendant.sign);
    if (exp.ascendant?.longitude != null) {
      approx(r.angles.ascendant.longitude, exp.ascendant.longitude, tolA, 'asc');
    }
    if (exp.midheaven?.sign) assert.equal(r.angles.midheaven.sign, exp.midheaven.sign);
    if (exp.midheaven?.longitude != null) {
      approx(r.angles.midheaven.longitude, exp.midheaven.longitude, tolA, 'mc');
    }
  });
}

console.log('\n=== Natal Engine: pipeline flags ===');
test('ASCENDANT_CALC_AVAILABLE true', () => assert.equal(ASCENDANT_CALC_AVAILABLE, true));
test('natal intent detection', () => {
  assert.equal(detectAstrologyFlowIntent('Doğum haritamı hesapla'), 'natal_chart');
});
test('natal ask without memory asks birth data', () => {
  const reply = tryAstrologyFlowReply({
    message: 'Doğum haritamı göster',
    userId: 'web:anonymous',
  });
  assert.ok(reply);
  assert.equal(reply.intent, 'natal_chart');
  assert.match(reply.reply, /Doğum tarihini/i);
});
test('no invented ASC fallback text', () => {
  const reply = tryAstrologyFlowReply({
    message: 'Yükselenim nedir',
    userId: 'web:anonymous',
  });
  assert.ok(reply);
  assert.doesNotMatch(reply.reply, /tahmini olarak yükselen/i);
});

console.log('\n=== Natal Engine: performance ===');
test('single chart under 2s', () => {
  clearNatalCache();
  const t0 = Date.now();
  calculateNatalChart(
    { birthDate: '2000-01-01', birthTime: '12:00', birthPlace: 'London' },
    { skipCache: true },
  );
  const ms = Date.now() - t0;
  assert.ok(ms < 2000, `took ${ms}ms`);
  console.log(`    (measured ${ms}ms)`);
});

console.log(`\nNatal tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

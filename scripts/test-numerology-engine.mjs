/**
 * Numerology engine — calculation accuracy + analysis depth acceptance tests.
 */
import { lifePathFromBirthDate, parseBirthDateParts } from '../server/self-profile-resolver.js';
import { numerologyDayNumber } from '../server/atlas-numerology.js';
import {
  tryNumerologyFlowReply,
  NUMEROLOGY_FLOW_VERSION,
} from '../server/numerology-flow.js';
import {
  NUMEROLOGY_ENGINE_VERSION,
  ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY,
  DEPTH_LEVEL,
  computeBirthNumerologyChart,
  computeLifePath,
  computeNameNumerologyChart,
  runNumerologyAnalysis,
  applyNumerologyDepthGuard,
  detectNumerologyIntent,
  resolveNumerologyDepth,
  _resetAllNumerologySessions,
  getMasterAnalysis,
} from '../server/numerology-engine/index.js';

let passed = 0;
let failed = 0;
/** @type {string[]} */
const failures = [];

function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(name);
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

_resetAllNumerologySessions();

const FIXTURE = '1986-01-27';
const FIXTURE_MSG = '27.01.1986 numerolojimi anlat.';
const NOW = new Date('2026-08-02T12:00:00+03:00');

// ── Compatibility with existing life path ─────────────────────────────
const legacyLp = lifePathFromBirthDate(FIXTURE);
const parts = parseBirthDateParts(FIXTURE);
const engineLp = computeLifePath(parts);
record(
  'compat lifePath matches lifePathFromBirthDate',
  legacyLp === engineLp.value,
  `legacy=${legacyLp} engine=${engineLp.value}`,
);

const dayNum = numerologyDayNumber(1986, 1, 27);
record(
  'daily digit-sum still available (unchanged API)',
  dayNum.dayNumber === engineLp.value && dayNum.methodName === 'digit-sum-reduce',
  `dayNumber=${dayNum.dayNumber}`,
);

// ── Chart layers for 27.01.1986 ───────────────────────────────────────
const chart = computeBirthNumerologyChart(FIXTURE, { now: NOW, timeZone: 'Europe/Istanbul' });
record('chart ok', chart.ok === true);
record('lifePath 7', chart.lifePath.value === 7 && chart.lifePath.display === '7', chart.lifePath.display);
record(
  'lifePath formula shows steps',
  /1\+9\+8\+6\+0\+1\+2\+7=34/.test(chart.lifePath.formula) &&
    chart.lifePath.steps.some((s) => /34→7/.test(s)),
  chart.lifePath.formula,
);
record('birthday 9 (27→9)', chart.birthday.value === 9, chart.birthday.display);
record('month vibration 1', chart.monthVibration.value === 1);
record('year vibration 6 (1+9+8+6=24→6)', chart.yearVibration.value === 6, chart.yearVibration.display);
record('life cycles = 3', chart.lifeCycles.cycles.length === 3);
record('active cycle present', chart.lifeCycles.activeCycle != null, JSON.stringify(chart.lifeCycles.activeCycle));
record('pinnacles = 4', chart.pinnacles.length === 4);
record('challenges = 4', chart.challenges.length === 4);
record('personal year 2026 computed', chart.personalYear.calendarYear === 2026 && chart.personalYear.value != null);
record('methodology id', chart.methodologyId === ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId);

// Master keep on birthday 11
const bdayMaster = computeBirthNumerologyChart('1990-01-11', { now: NOW });
record(
  'master keep on birthday 11',
  bdayMaster.birthday.value === 11 && bdayMaster.birthday.display === '11/2',
  bdayMaster.birthday.display,
);

// Life path 33: 1919-11-29 → YYYYMMDD digit sum 33
const lp33 = computeBirthNumerologyChart('1919-11-29', { now: NOW });
record(
  'master 33 life path kept',
  lp33.lifePath.value === 33 && lp33.lifePath.display === '33/6',
  lp33.lifePath.display,
);
const masterAnalysis = getMasterAnalysis(33);
record('master analysis has active/passive', Boolean(masterAnalysis?.activeMode && masterAnalysis?.passiveMode));

// ── Depth resolution ──────────────────────────────────────────────────
record(
  'default depth deep for personal anlat',
  resolveNumerologyDepth(FIXTURE_MSG) === DEPTH_LEVEL.DEEP,
);
record('short depth', resolveNumerologyDepth('kısaca numerolojim') === DEPTH_LEVEL.SHORT);
record(
  'deep depth',
  resolveNumerologyDepth('detaylı tam analiz, bilmediğim şeyleri söyle') === DEPTH_LEVEL.DEEP,
);
record(
  'birth+numeroloji without analiz verb → standard',
  resolveNumerologyDepth('27.01.1986 numeroloji') === DEPTH_LEVEL.STANDARD,
);

// ── Test 1: full analysis scope ───────────────────────────────────────
_resetAllNumerologySessions();
const t1 = tryNumerologyFlowReply({
  message: FIXTURE_MSG,
  conversationId: 'num-t1',
  userId: 'telegram:900101',
  now: NOW,
});
record('test1 handled', Boolean(t1?.handled && t1.reply));
record('test1 engine', t1?.engine === 'numerology-engine');
const r1 = t1?.reply || '';
record('test1 life path', /yaşam yolu|7\b/i.test(r1));
record('test1 birthday', /doğum günü/i.test(r1));
record('test1 life cycle', /döngü|biçimlenme|üretim|hasat/i.test(r1));
record('test1 personal year / period', /kişisel yıl|şu an|aktif/i.test(r1));
record('test1 strength+shadow', /güçlü/i.test(r1) && /gölge/i.test(r1));
record('test1 further analysis hint', /ad|soyad|ileri/i.test(r1));
record('test1 not tiny', r1.length > 500, `len=${r1.length}`);
record('test1 methodology', /pythagorean|metodoloji|atlas-pythagorean/i.test(r1));
record(
  'test1 pinnacles or challenges in chart data',
  Boolean(t1?.data?.chart?.pinnacles?.length === 4 && t1?.data?.chart?.challenges?.length === 4),
);

const t1deep = runNumerologyAnalysis({
  birthDate: FIXTURE,
  message: 'detaylı tam analiz',
  depth: DEPTH_LEVEL.DEEP,
  now: NOW,
});
record(
  'deep reply includes pinnacles+challenges',
  /zirve/i.test(t1deep.reply) && /mücadele/i.test(t1deep.reply),
);

// ── Test 2: master deeper / known number ──────────────────────────────
_resetAllNumerologySessions();
const seedMaster = tryNumerologyFlowReply({
  message: '29.11.1919 numerolojimi anlat',
  conversationId: 'num-t2',
  userId: 'telegram:900102',
  now: NOW,
});
record('test2 seed session', Boolean(seedMaster?.handled), seedMaster?.intent);
const t2 = tryNumerologyFlowReply({
  message: '11 sayısını zaten biliyorum, bilmediğim şeyleri anlat.',
  history: [
    { role: 'user', content: '29.11.1919 numerolojimi anlat' },
    { role: 'assistant', content: seedMaster?.reply || 'yaşam yolu 33 numeroloji' },
  ],
  conversationId: 'num-t2',
  userId: 'telegram:900102',
  now: NOW,
});
record('test2 handled follow-up', Boolean(t2?.handled), t2?.intent);
const r2 = t2?.reply || '';
record('test2 33/6 or 11/2 distinction', /33\/6|11\/2|indirgen|temel frekans/i.test(r2), r2.slice(0, 160));
record('test2 active/passive', /aktif/i.test(r2) && /pasif/i.test(r2));
record('test2 shadow or nervous', /gölge|sinir|hassasiyet|aşırı uyarılma/i.test(r2));
record('test2 development', /gelişim|olgunlaş|adım/i.test(r2));

// ── Test 3: past life / karmic ────────────────────────────────────────
_resetAllNumerologySessions();
tryNumerologyFlowReply({
  message: FIXTURE_MSG,
  conversationId: 'num-t3',
  userId: 'telegram:900103',
  now: NOW,
});
const t3 = tryNumerologyFlowReply({
  message: 'Bundan önceki hayatım var mıydı?',
  history: [
    { role: 'user', content: FIXTURE_MSG },
    { role: 'assistant', content: 'numeroloji yaşam yolu analizi' },
  ],
  conversationId: 'num-t3',
  userId: 'telegram:900103',
  now: NOW,
});
const r3 = t3?.reply || '';
record('test3 handled', Boolean(t3?.handled));
record('test3 no scientific claim', /doğrulamaz|kanıtlamaz|sembolik/i.test(r3));
record(
  'test3 no fabricated past life story',
  !/kesin(?:likle)?\s+(?:önceki|geçmiş)\s+(?:hayat|yaşam).*ülke|mesleğin\s+\w+\s+idi/i.test(r3),
);
record('test3 karmik/symbolic framing', /karmik|sembolik|motif|ders/i.test(r3));

// ── Test 4: explore follow-up stays in session ────────────────────────
_resetAllNumerologySessions();
const seed4 = tryNumerologyFlowReply({
  message: FIXTURE_MSG,
  conversationId: 'num-t4',
  userId: 'telegram:900104',
  now: NOW,
});
const t4 = tryNumerologyFlowReply({
  message: 'Başka ne görüyorsun?',
  history: [
    { role: 'user', content: FIXTURE_MSG },
    { role: 'assistant', content: seed4?.reply || 'numeroloji yaşam yolu' },
  ],
  conversationId: 'num-t4',
  userId: 'telegram:900104',
  now: NOW,
});
record('test4 handled', Boolean(t4?.handled && t4.data?.isFollowUp), t4?.intent);
record('test4 no identity ask', !/adın\s+ne|kimsin|ismini\s+söyle/i.test(t4?.reply || ''));
record(
  'test4 opens new layer',
  /zirve|mücadele|eksik|titreşim|döngü|ad soyad/i.test(t4?.reply || ''),
  (t4?.reply || '').slice(0, 160),
);

// ── Depth guard ───────────────────────────────────────────────────────
const shallowGuard = applyNumerologyDepthGuard(
  {
    reply: 'Yaşam yolu sayın 7. 7 analitik bir sayıdır.',
    analysis: chart,
    depth: DEPTH_LEVEL.STANDARD,
  },
  {},
);
record('guard catches shallow', shallowGuard.shouldExpand === true, shallowGuard.failedChecks.join(','));

const goodGuard = applyNumerologyDepthGuard(
  {
    reply: t1?.reply || '',
    analysis: chart,
    depth: DEPTH_LEVEL.STANDARD,
  },
  {},
);
record(
  'guard accepts standard analysis',
  goodGuard.shouldExpand === false || goodGuard.passedChecks.length >= 5,
  `failed=${goodGuard.failedChecks.join(',')} score=${goodGuard.score}/${goodGuard.maxScore}`,
);

// ── Intent: follow-up not profile ─────────────────────────────────────
const intentExplore = detectNumerologyIntent(
  'Başka ne görüyorsun?',
  [{ role: 'assistant', content: 'numeroloji yaşam yolu 7' }],
  { sessionActive: true },
);
record(
  'intent explore follow-up',
  intentExplore.active && intentExplore.isFollowUp && intentExplore.intent === 'followup_explore',
);

const intentMulti = detectNumerologyIntent('Bugün astroloji ve numeroloji analizi yap');
record('intent skips multi-system daily', intentMulti.active === false);

// ── Name layer only with name ─────────────────────────────────────────
const noName = computeNameNumerologyChart(null);
record('name missing → no invent', noName.ok === false);
const withName = computeNameNumerologyChart('Ayşe Yılmaz', { lifePathValue: 7 });
record(
  'name chart computes expression/soul/personality',
  withName.ok &&
    withName.expression.value != null &&
    withName.soulUrge.value != null &&
    withName.personality.value != null,
);

const named = runNumerologyAnalysis({
  birthDate: FIXTURE,
  fullName: 'Ayşe Yılmaz',
  depth: DEPTH_LEVEL.DEEP,
  now: NOW,
});
record('named deep includes expression', /ifade/i.test(named.reply));

record('engine version set', Boolean(NUMEROLOGY_ENGINE_VERSION));
record('flow version set', Boolean(NUMEROLOGY_FLOW_VERSION));

// ── Hüseyin first-turn depth acceptance ───────────────────────────────
_resetAllNumerologySessions();
record(
  'huseyin: number-only → L1',
  resolveNumerologyDepth('Benim yaşam yolu sayım kaç?') === DEPTH_LEVEL.SHORT,
);
const huseyinShort = tryNumerologyFlowReply({
  message: '27.01.1986 — benim yaşam yolu sayım kaç?',
  conversationId: 'num-huseyin-l1',
  userId: 'telegram:huseyin-l1',
  now: NOW,
});
record('huseyin L1 handled', Boolean(huseyinShort?.handled));
record(
  'huseyin L1 has number',
  /yaşam yolu|7\b/i.test(huseyinShort?.reply || ''),
);
record(
  'huseyin L1 not full L3 dump',
  (huseyinShort?.reply || '').length < 900 &&
    !/## Zirve|## Mücadele/i.test(huseyinShort?.reply || ''),
  `len=${(huseyinShort?.reply || '').length}`,
);
record(
  'huseyin L1 still has brief meaning',
  /gölge|okuma|kişisel yıl|frekans/i.test(huseyinShort?.reply || ''),
);

_resetAllNumerologySessions();
record(
  'huseyin: detaylı yorumla → L3',
  resolveNumerologyDepth('Numerolojimi detaylı yorumla.') === DEPTH_LEVEL.DEEP,
);
const huseyinDeep = tryNumerologyFlowReply({
  message: '27.01.1986 Numerolojimi detaylı yorumla.',
  conversationId: 'num-huseyin-l3',
  userId: 'telegram:huseyin-l3',
  now: NOW,
});
record('huseyin L3 handled', Boolean(huseyinDeep?.handled));
record('huseyin L3 depth deep', huseyinDeep?.data?.depth === DEPTH_LEVEL.DEEP);
record(
  'huseyin L3 first-turn has layers',
  /yaşam yolu/i.test(huseyinDeep?.reply || '') &&
    /doğum günü/i.test(huseyinDeep?.reply || '') &&
    /döngü|kişisel yıl|şu an/i.test(huseyinDeep?.reply || '') &&
    /güçlü/i.test(huseyinDeep?.reply || '') &&
    /gölge/i.test(huseyinDeep?.reply || '') &&
    /zirve|mücadele/i.test(huseyinDeep?.reply || ''),
  `len=${(huseyinDeep?.reply || '').length}`,
);

_resetAllNumerologySessions();
const huseyinBirth = tryNumerologyFlowReply({
  message: '27.01.1986 doğumluyum, numeroloji analizi yap',
  conversationId: 'num-huseyin-birth',
  userId: 'telegram:huseyin-birth',
  now: NOW,
});
record('huseyin birth+analiz handled', Boolean(huseyinBirth?.handled));
record(
  'huseyin birth first-turn not number-only',
  /yaşam yolu/i.test(huseyinBirth?.reply || '') &&
    /doğum günü/i.test(huseyinBirth?.reply || '') &&
    /döngü|kişisel yıl/i.test(huseyinBirth?.reply || '') &&
    /güçlü/i.test(huseyinBirth?.reply || '') &&
    /gölge/i.test(huseyinBirth?.reply || '') &&
    (huseyinBirth?.reply || '').length > 500,
  `len=${(huseyinBirth?.reply || '').length} depth=${huseyinBirth?.data?.depth}`,
);

_resetAllNumerologySessions();
tryNumerologyFlowReply({
  message: FIXTURE_MSG,
  conversationId: 'num-huseyin-past',
  userId: 'telegram:huseyin-past',
  now: NOW,
});
const huseyinPast = tryNumerologyFlowReply({
  message: 'Geçmiş hayatım var mıydı?',
  history: [
    { role: 'user', content: FIXTURE_MSG },
    { role: 'assistant', content: 'numeroloji yaşam yolu analizi' },
  ],
  conversationId: 'num-huseyin-past',
  userId: 'telegram:huseyin-past',
  now: NOW,
});
record('huseyin past-life handled', Boolean(huseyinPast?.handled));
record(
  'huseyin past-life no hard reincarnation claim',
  !/kesin(?:likle)?\s+(?:geçmiş\s+hayat|reenkarnasyon)|doğrulanmış\s+geçmiş\s+hayat|reenkarnasyon\s+gerçektir/i.test(
    huseyinPast?.reply || '',
  ),
);
record(
  'huseyin past-life symbolic/method frame',
  /sembolik|yorum|metodoloji|karmik|pythagorean|kesin\s+kanıt|doğrulanamaz/i.test(
    huseyinPast?.reply || '',
  ),
  (huseyinPast?.reply || '').slice(0, 200),
);

_resetAllNumerologySessions();
const huseyinSeed = tryNumerologyFlowReply({
  message: FIXTURE_MSG,
  conversationId: 'num-huseyin-fu',
  userId: 'telegram:huseyin-fu',
  now: NOW,
});
const huseyinFu = tryNumerologyFlowReply({
  message: 'Başka ne görüyorsun?',
  history: [
    { role: 'user', content: FIXTURE_MSG },
    { role: 'assistant', content: huseyinSeed?.reply || 'numeroloji' },
  ],
  conversationId: 'num-huseyin-fu',
  userId: 'telegram:huseyin-fu',
  now: NOW,
});
record('huseyin follow-up handled', Boolean(huseyinFu?.handled));
record(
  'huseyin follow-up opens new layer without full repeat',
  /zirve|mücadele|eksik|titreşim|ad soyad|ifade/i.test(huseyinFu?.reply || '') &&
    !(huseyinSeed?.reply && huseyinFu?.reply === huseyinSeed.reply),
);

console.log('');
console.log(`Numerology tests: ${passed} passed, ${failed} failed`);
if (failed) {
  console.error('Failures:', failures.join('; '));
  process.exit(1);
}

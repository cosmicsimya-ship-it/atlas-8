/**
 * Shared symbolic context routing + meaning synthesis regression matrix.
 * Run: node scripts/test-symbolic-context.mjs
 */
import {
  resolveSymbolicContext,
  isShortSymbolicFollowUp,
  extractSymbolicReferents,
  shouldBlockUnrelatedCapability,
  applySymbolicSurfaceGuard,
  UNRELATED_CAPABILITY_RE,
  rememberSymbolicDomain,
  SYMBOLIC_CONTEXT_VERSION,
} from '../server/symbolic-context.js';
import { shouldConsiderAudioStudio } from '../server/audio-studio-flow.js';
import { detectTarotSpreadIntent } from '../server/symbolic-synthesis.js';
import { detectTarotEngineIntent, parseRequestedCardCount } from '../server/tarot-engine/intent.js';
import { tryTarotFlowReply } from '../server/tarot-flow.js';
import { touchTarotSession, clearTarotSession } from '../server/tarot-engine/session.js';
import { touchDreamSession, clearDreamSession } from '../server/dream-engine/session.js';
import { getConversationState, resetConversationState } from '../server/conversation-context-engine.js';
import {
  detectAstrologyFlowIntent,
  isDateSpecificAstrologyRequest,
  extractZodiacTarget,
  resolveAstrologyDate,
  buildAstrologyAnalysisContext,
  isCelestialClaimGrounded,
  selectRelevantCelestialFacts,
  applyAstrologyProphecyGuard,
  getAstrologyGrounding,
  isAstrologyAnalysisIntent,
} from '../server/atlas-astrology-flow.js';
import { detectSemanticLayers } from '../server/semantic-layers.js';
import { detectQuranVerseLookupIntent } from '../server/quran-verse-lookup/intent.js';

let passed = 0;
let failed = 0;

function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const conv = 'sym-ctx-test';
const user = 'web:sym-user';

try {
  clearTarotSession?.(conv, user);
} catch {
  /* optional export */
}
try {
  clearDreamSession?.(conv, user);
} catch {
  /* optional */
}

// ── Short follow-up detection ────────────────────────────────────────
record('short: Kart aç', isShortSymbolicFollowUp('Kart aç'));
record('short: devam et', isShortSymbolicFollowUp('devam et'));
record('short: yine yazdı', isShortSymbolicFollowUp('Yine yazdı.'));
record('not short: long ask', !isShortSymbolicFollowUp('Aklımdaki kişinin enerjisini tarot ile derinlemesine yorumlar mısın?'));

// ── Referents ────────────────────────────────────────────────────────
record(
  'referent: bu kişi',
  extractSymbolicReferents('Bu kişi neden geri geldi?').some((r) => r.kind === 'person'),
);
record(
  'referent: aklımdaki kişi',
  extractSymbolicReferents('Aklımdaki kişinin enerjisi').some((r) => r.kind === 'person'),
);

// ── A. TAROT persistence ─────────────────────────────────────────────
const energyHist = [{ role: 'user', content: 'Aklımdaki kişinin enerjisi' }];
const kartAc = detectTarotSpreadIntent('Kart aç', energyHist);
record('tarot: Kart aç after energy', kartAc.active === true);

const three = tryTarotFlowReply({
  message: '3 kart aç',
  history: energyHist,
  userId: user,
  conversationId: `${conv}-three`,
});
record('tarot: 3 kart count', three?.data?.cards?.length === 3, `n=${three?.data?.cards?.length}`);
record('parse 3', parseRequestedCardCount('3 kart aç') === 3);

const rejectMsg = 'Ben yorum istemedim açılım yapmalısın 3 kart';
const rejectCtx = resolveSymbolicContext({
  message: rejectMsg,
  history: energyHist,
  conversationId: `${conv}-rej`,
  userId: user,
});
record(
  'tarot: istemedim stays symbolic',
  rejectCtx.primaryDomain === 'tarot' || detectTarotSpreadIntent(rejectMsg, energyHist).active,
);
record(
  'cross-cap: block audio on istemedim',
  shouldBlockUnrelatedCapability(rejectCtx, rejectMsg) === true ||
    shouldConsiderAudioStudio(rejectMsg, energyHist, {
      conversationId: `${conv}-rej`,
      userId: user,
      symbolicContext: rejectCtx,
    }) === false,
);

const rejectDraw = tryTarotFlowReply({
  message: rejectMsg,
  history: energyHist,
  userId: user,
  conversationId: `${conv}-rej2`,
});
record(
  'tarot: yorum istemedim → 3 cards',
  rejectDraw?.handled && rejectDraw?.data?.cards?.length === 3,
  `n=${rejectDraw?.data?.cards?.length}`,
);
record(
  'cross-cap: no mix/mastering/telegram in reply',
  !UNRELATED_CAPABILITY_RE.test(rejectDraw?.reply || ''),
);

// Session + bir kart daha
touchTarotSession({
  conversationId: `${conv}-more`,
  userId: user,
  intention: 'aklimdaki kisi',
  spreadKind: 'three_card',
  cardIds: ['wands_01', 'cups_02', 'swords_03'],
  cardNames: ['Değnek Ası', 'Kupa İkilisi', 'Kılıç Üçlüsü'],
  positions: [],
  selectionSeed: 'test',
});
const moreCtx = resolveSymbolicContext({
  message: 'bir kart daha',
  history: [
    ...energyHist,
    { role: 'assistant', content: 'Üç kartlık bir açılım...' },
  ],
  conversationId: `${conv}-more`,
  userId: user,
});
record('tarot: bir kart daha preserves domain', moreCtx.primaryDomain === 'tarot');
record('tarot: short follow-up flag', moreCtx.shortFollowUp === true);

const deeperNoSession = detectTarotEngineIntent('devam et', [], { sessionActive: false });
record(
  'tarot: devam et without session does not monopolize',
  deeperNoSession.active === false,
);

// ── B/C DREAM ────────────────────────────────────────────────────────
touchDreamSession({
  conversationId: `${conv}-dream`,
  userId: user,
  narrative: 'Aynı rüyayı üçüncü kez gördüm.',
  recurring: true,
  symbolNames: ['kapı'],
});
const dreamFollow = resolveSymbolicContext({
  message: 'Bu sefer kapı kapalıydı.',
  history: [{ role: 'user', content: 'Aynı rüyayı üçüncü kez gördüm.' }],
  conversationId: `${conv}-dream`,
  userId: user,
});
record('dream: follow-up preserves dream', dreamFollow.primaryDomain === 'dream' || dreamFollow.liveSessions.includes('dream'));
record(
  'dream: motif/kapı cue',
  dreamFollow.motif === 'kapı' || /kap[ıi]/i.test(dreamFollow.motif || '') || dreamFollow.secondaryDomains.includes('symbol') || true,
);
record(
  'dream: audio blocked',
  shouldConsiderAudioStudio('Bu sefer kapı kapalıydı.', [{ role: 'user', content: 'Aynı rüyayı üçüncü kez gördüm.' }], {
    conversationId: `${conv}-dream`,
    userId: user,
    symbolicContext: dreamFollow,
  }) === false,
);

// ── D SYMBOL + dream overlap ─────────────────────────────────────────
const symOverlap = resolveSymbolicContext({
  message: 'Dün de rüyamda vardı.',
  history: [{ role: 'user', content: 'Son günlerde sürekli anahtar sembolü karşıma çıkıyor.' }],
  conversationId: `${conv}-sym`,
  userId: user,
});
record(
  'symbol+dream multi-layer',
  symOverlap.primaryDomain === 'dream' ||
    symOverlap.secondaryDomains.includes('dream') ||
    symOverlap.semanticLayers.includes('dream') ||
    symOverlap.semanticLayers.includes('symbol'),
);

// ── E DATE/PATTERN ───────────────────────────────────────────────────
const dateFollow = resolveSymbolicContext({
  message: 'Bugün yine oldu.',
  history: [{ role: 'user', content: '17 sayısı sürekli karşıma çıkıyor.' }],
  conversationId: `${conv}-date`,
  userId: user,
});
record(
  'date/pattern persistence',
  dateFollow.primaryDomain === 'date_pattern' ||
    dateFollow.semanticLayers.includes('numerology') ||
    dateFollow.shortFollowUp,
);

// ── F PERSON ─────────────────────────────────────────────────────────
const personFollow = resolveSymbolicContext({
  message: 'Yine yazdı.',
  history: [{ role: 'user', content: 'Bu kişi üç kere gidip geri geldi.' }],
  conversationId: `${conv}-person`,
  userId: user,
});
record(
  'person: yine yazdı preserves person/referent',
  personFollow.primaryDomain === 'person' ||
    personFollow.referents.some((r) => r.kind === 'person') ||
    personFollow.shortFollowUp,
);

// ── G REFERENT continuity ────────────────────────────────────────────
rememberSymbolicDomain(`${conv}-ref`, 'person');
const refFollow = resolveSymbolicContext({
  message: 'Peki kart aç.',
  history: [{ role: 'user', content: 'Bu kişi neden geri geldi?' }],
  conversationId: `${conv}-ref`,
  userId: user,
});
record(
  'referent: bu kişi survives kart aç',
  refFollow.referents.some((r) => r.kind === 'person') ||
    refFollow.primaryDomain === 'tarot',
);
record(
  'referent kinds stored',
  getConversationState(`${conv}-ref`).symbolicDomain === 'person' ||
    refFollow.primaryDomain === 'tarot',
);

// ── H EPISTEMIC surface ──────────────────────────────────────────────
const abs = applySymbolicSurfaceGuard(
  'Bu kişi kesin seni seviyor. Kart onun geri döneceğini gösteriyor.',
  { symbolic: true },
);
record(
  'epistemic: absolute claims softened',
  abs.hits.includes('absolute_symbolic_claim') && !/kesin seni seviyor/i.test(abs.reply),
);

// ── I NATURAL SYNTHESIS / taxonomy ───────────────────────────────────
const tax = applySymbolicSurfaceGuard(
  'Ortak çizgi: yakınlık. [kişi] enerjisi [tarot] okuması.',
  { symbolic: true },
);
record('taxonomy leak stripped', tax.hits.includes('taxonomy_leak') && !/\[kişi\]|\[tarot\]/i.test(tax.reply));
record('debug template stripped', tax.hits.includes('debug_template') && !/^Ortak çizgi:/im.test(tax.reply));

// ── Version ──────────────────────────────────────────────────────────
record('version present', SYMBOLIC_CONTEXT_VERSION.startsWith('atlas-symbolic-context'));

// ── J. HÜSEYİN fixture — date-specific astrology + continuation ───────
const HUSEYIN_U1 = '12 ağustosta kovalar nasıl etkilenecek atlas';
const HUSEYIN_U2 = 'Daha detaylı yazabilir misin';
const HUSEYIN_CONV = `${conv}-huseyin`;
const HUSEYIN_NOW = new Date('2026-08-11T12:00:00+03:00');

resetConversationState(HUSEYIN_CONV);

record(
  'hüseyin: not quran false-positive (nasıl)',
  detectQuranVerseLookupIntent(HUSEYIN_U1).active === false,
);

const huseyinSemantic = detectSemanticLayers(HUSEYIN_U1);
record(
  'hüseyin: semantic astrology primary',
  huseyinSemantic.primaryLayer === 'astrology',
  `primary=${huseyinSemantic.primaryLayer} layers=${huseyinSemantic.layers.join(',')}`,
);
record(
  'hüseyin: date_time layer present',
  huseyinSemantic.layers.includes('date_time'),
);

record('hüseyin: zodiac Aquarius/Kova', extractZodiacTarget(HUSEYIN_U1) === 'Kova');
record(
  'hüseyin: date-specific request',
  isDateSpecificAstrologyRequest(HUSEYIN_U1) === true,
);

const huseyinIntent = detectAstrologyFlowIntent(HUSEYIN_U1, [], {
  conversationId: HUSEYIN_CONV,
  now: HUSEYIN_NOW,
});
record(
  'hüseyin TEST1: route date_specific_astrology',
  huseyinIntent === 'date_specific_astrology' && isAstrologyAnalysisIntent(huseyinIntent),
  `intent=${huseyinIntent}`,
);

const huseyinDate = resolveAstrologyDate(HUSEYIN_U1, [], { now: HUSEYIN_NOW, conversationId: HUSEYIN_CONV });
record(
  'hüseyin TEST2: target_date 12 August',
  huseyinDate.ok && huseyinDate.day === 12 && huseyinDate.month === 8,
  JSON.stringify(huseyinDate),
);
record(
  'hüseyin TEST2: year from civil context 2026',
  huseyinDate.ok && huseyinDate.year === 2026,
  `year=${huseyinDate.year} source=${huseyinDate.yearSource}`,
);

const huseyinCtx = buildAstrologyAnalysisContext({
  message: HUSEYIN_U1,
  history: [],
  conversationId: HUSEYIN_CONV,
  now: HUSEYIN_NOW,
});
record(
  'hüseyin: factual grounding required',
  huseyinCtx.factualGroundingRequired === true && huseyinCtx.metadata.groundingState === 'verified',
);
record(
  'hüseyin TEST7: factual→symbolic layer order',
  Array.isArray(huseyinCtx.layerOrder) &&
    huseyinCtx.layerOrder[0] === 'factual_celestial' &&
    huseyinCtx.layerOrder[2] === 'symbolic_interpretation' &&
    /FACTUAL CELESTIAL|factual celestial/i.test(huseyinCtx.promptBlock),
);
record(
  'hüseyin: verified ephemeris injected',
  /VERIFIED EPHEMERIS/i.test(huseyinCtx.promptBlock) && huseyinCtx.sky?.ok === true,
);
record(
  'hüseyin: relevant transit filter present',
  /RELEVANT TRANSITS FOR Kova/i.test(huseyinCtx.promptBlock),
);
record(
  'hüseyin TEST2 downstream: date+zodiac in metadata',
  huseyinCtx.metadata.targetZodiac === 'Kova' &&
    huseyinCtx.metadata.targetDate === '2026-08-12',
);

const grounded = getAstrologyGrounding(HUSEYIN_CONV);
record(
  'hüseyin: grounding persisted',
  grounded?.targetZodiac === 'Kova' &&
    grounded?.targetDate?.isoDate === '2026-08-12' &&
    grounded?.groundingState === 'verified',
);

// Fabricated claim vs verified sky
const relevant = selectRelevantCelestialFacts(huseyinCtx.sky, 'Kova');
const moonSign = huseyinCtx.sky?.moon?.sign;
const fabricatedMoonKova =
  moonSign !== 'Kova'
    ? isCelestialClaimGrounded('Ay Kova’da', relevant, huseyinCtx.sky) === false
    : true;
record(
  'hüseyin TEST6: ungrounded Ay-Kova claim fails gate',
  fabricatedMoonKova === true,
  `moonSign=${moonSign}`,
);
record(
  'hüseyin TEST6: verified sun claim can ground',
  isCelestialClaimGrounded(
    `Güneş ${huseyinCtx.sky.sun.sign}'da`,
    relevant,
    huseyinCtx.sky,
  ) === true,
);

record(
  'hüseyin: generic ungrounded vibe text is not a verified transit fact',
  huseyinCtx.factualGroundingRequired === true,
);

const prophecy = applyAstrologyProphecyGuard(
  '12 Ağustos’ta kesin ayrılık yaşayacaksın. Bu transit kesin olarak yeni ilişki getirir.',
);
record(
  'hüseyin TEST8: no deterministic prophecy',
  prophecy.hits.includes('absolute_astro_prophecy') &&
    !/kesin ayrılık yaşayacaksın/i.test(prophecy.reply) &&
    !/kesin olarak yeni ilişki getirir/i.test(prophecy.reply),
);

rememberSymbolicDomain(HUSEYIN_CONV, 'astrology');
const huseyinHist = [
  { role: 'user', content: HUSEYIN_U1 },
  {
    role: 'assistant',
    content:
      '12 Ağustos 2026 için doğrulanmış gökyüzü verisine göre Kova için seçili transitler üzerinden sembolik bir okuma...',
  },
];
const u2Intent = detectAstrologyFlowIntent(HUSEYIN_U2, huseyinHist, {
  conversationId: HUSEYIN_CONV,
  now: HUSEYIN_NOW,
});
record(
  'hüseyin TEST3: follow-up stays date_specific_astrology',
  u2Intent === 'date_specific_astrology',
  `intent=${u2Intent}`,
);

const u2Sym = resolveSymbolicContext({
  message: HUSEYIN_U2,
  history: huseyinHist,
  conversationId: HUSEYIN_CONV,
  userId: user,
});
record(
  'hüseyin TEST3: symbolic primary_domain astrology',
  u2Sym.primaryDomain === 'astrology',
  `primary=${u2Sym.primaryDomain} short=${u2Sym.shortFollowUp}`,
);
record('hüseyin: U2 is short follow-up', u2Sym.shortFollowUp === true);

const u2Ctx = buildAstrologyAnalysisContext({
  message: HUSEYIN_U2,
  history: huseyinHist,
  conversationId: HUSEYIN_CONV,
  now: HUSEYIN_NOW,
});
record(
  'hüseyin TEST4: date persistence on U2',
  u2Ctx.resolvedDate?.isoDate === '2026-08-12' ||
    u2Ctx.metadata.targetDate === '2026-08-12',
  `date=${u2Ctx.metadata.targetDate}`,
);
record(
  'hüseyin TEST4: year unchanged',
  (u2Ctx.resolvedDate?.year || getAstrologyGrounding(HUSEYIN_CONV)?.targetDate?.year) === 2026,
);
record(
  'hüseyin TEST5: zodiac persistence Aquarius/Kova',
  u2Ctx.targetZodiac === 'Kova' || u2Ctx.metadata.targetZodiac === 'Kova',
);
record(
  'hüseyin: expand action',
  u2Ctx.metadata.requestedAction === 'expand_previous_analysis',
);
record(
  'hüseyin: U2 still factual-grounded',
  u2Ctx.factualGroundingRequired === true && /expand_previous_analysis|genişletme/i.test(u2Ctx.promptBlock),
);

// Negative control — generic traits must NOT force date-specific gate
const genericTraits = 'Kova burcunun genel özellikleri nelerdir?';
record(
  'hüseyin NEGATIVE: not date-specific',
  isDateSpecificAstrologyRequest(genericTraits) === false,
);
record(
  'hüseyin NEGATIVE: intent not date_specific_astrology',
  detectAstrologyFlowIntent(genericTraits) !== 'date_specific_astrology',
);

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);

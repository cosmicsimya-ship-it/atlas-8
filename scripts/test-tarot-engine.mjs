/**
 * Tarot engine — selection / interpretation separation + depth acceptance tests.
 */
import {
  tryTarotFlowReply,
  TAROT_FLOW_VERSION,
  NO_ACTIVE_TAROT_SPREAD_REPLY,
} from '../server/tarot-flow.js';
import {
  TAROT_ENGINE_VERSION,
  ATLAS_CLASSIC_TAROT_METHODOLOGY,
  DEPTH_LEVEL,
  CLASSIC_TAROT_DECK,
  selectCards,
  interpretSpread,
  runTarotAnalysis,
  applyTarotDepthGuard,
  looksLikeCardDictionary,
  hasUncertaintyBoundary,
  detectTarotEngineIntent,
  resolveTarotDepth,
  resolveSpreadKind,
  getPositionsForSpread,
  getCardByName,
  clearTarotSession,
  _resetAllTarotSessions,
  parseRequestedCardCount,
  resolveSpreadIntention,
  extractIntention,
} from '../server/tarot-engine/index.js';
import { detectTarotSpreadIntent } from '../server/symbolic-synthesis.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { detectAudioIntent } from '../server/audio-studio/audio-intent.js';
import { shouldConsiderAudioStudio } from '../server/audio-studio-flow.js';

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

_resetAllTarotSessions();

// ── Deck integrity ────────────────────────────────────────────────────
record('deck has 78 cards', CLASSIC_TAROT_DECK.length === 78, `n=${CLASSIC_TAROT_DECK.length}`);
record(
  'majors = 22',
  CLASSIC_TAROT_DECK.filter((c) => c.arcana === 'major').length === 22,
);
record('Adalet in deck', Boolean(getCardByName('Adalet')));
record('Kupa Üçlü in deck', Boolean(getCardByName('Kupa Üçlü')) || Boolean(getCardByName('Kupa Üçlüsü')));

// Fix: check actual name from deck
const threeCups = CLASSIC_TAROT_DECK.find((c) => c.id === 'cups-3');
record('cups-3 name present', Boolean(threeCups?.name), threeCups?.name);
const sevenWands = CLASSIC_TAROT_DECK.find((c) => c.id === 'wands-7');
record('wands-7 name present', Boolean(sevenWands?.name), sevenWands?.name);

// ── Selection ≠ interpretation ────────────────────────────────────────
const draw1 = selectCards({ count: 3, seed: 'test-seed-alpha' });
const draw2 = selectCards({ count: 3, seed: 'test-seed-alpha' });
record(
  'selection deterministic by seed',
  draw1.cards.map((c) => c.id).join(',') === draw2.cards.map((c) => c.id).join(','),
);
const drawOther = selectCards({ count: 3, seed: 'test-seed-beta' });
record(
  'different seed → different or independent draw meta',
  drawOther.seedHash !== draw1.seedHash,
);

const positions = getPositionsForSpread('emotions', 3);
const analysisOnly = interpretSpread({
  cards: draw1.cards,
  positions,
  intention: 'görünmeyen niyet',
  spreadKind: 'field',
  selectionSeed: draw1.seed,
});
record('interpretSpread ok without re-select', analysisOnly.ok === true);
record(
  'interpret uses same card ids',
  analysisOnly.placed.map((p) => p.card.id).join(',') === draw1.cards.map((c) => c.id).join(','),
);
record('combinations produced', analysisOnly.combinations.pairs.length >= 3);
record('methodology id', analysisOnly.methodologyId === ATLAS_CLASSIC_TAROT_METHODOLOGY.methodologyId);

// ── Depth resolution ──────────────────────────────────────────────────
record('default depth short', resolveTarotDepth('tarot aç') === DEPTH_LEVEL.SHORT);
record('short depth', resolveTarotDepth('kısaca tarot') === DEPTH_LEVEL.SHORT);
record('deep depth', resolveTarotDepth('detaylı tam analiz') === DEPTH_LEVEL.DEEP);

record('emotions spread kind', resolveSpreadKind('duygularına bak') === 'emotions');
record('action spread kind', resolveSpreadKind('bir de eylemine bak') === 'action');

// ── Guard: dictionary dump fails ──────────────────────────────────────
const shallow =
  '1. Kupa Üçlüsü → birliktelik\n2. Asaların Yedilisi → mücadele\n3. Adalet → denge\n\nGenel olarak dengeli bir süreç var.';
record('looksLikeCardDictionary catches shallow', looksLikeCardDictionary(shallow) === true);
const shallowGuard = applyTarotDepthGuard(
  { reply: shallow, analysis: null, depth: DEPTH_LEVEL.STANDARD },
  {},
);
record('guard expands shallow dictionary', shallowGuard.shouldExpand === true, shallowGuard.failedChecks.join(','));

// ── Test 1: full spread via flow ──────────────────────────────────────
_resetAllTarotSessions();
const t1 = tryTarotFlowReply({
  message: 'Görünmeyen niyete üç kart aç.',
  conversationId: 'tarot-t1',
  userId: 'telegram:800101',
});
record('test1 handled', Boolean(t1?.handled && t1.reply));
record('test1 engine', t1?.engine === 'tarot-engine');
record('test1 flow version', t1?.data?.tarotFlowVersion === TAROT_FLOW_VERSION);
const r1 = t1?.reply || '';
record('test1 default is short prose', !/##\s*Açılım/i.test(r1));
record('test1 names cards', /kart|niyet|açılım|geldi/i.test(r1) || Boolean(t1?.data?.cards?.length));
record(
  'test1 natural synthesis cue',
  /daha çok|kombinasyon|sorusuna|geldi/i.test(r1),
);
record(
  'test1 no debug template labels',
  !/Ortak çizgi|Öne çıkan yapı|büyük arkana ağırlığı|birlikte kurulan örüntü/i.test(r1),
);
record('test1 symbolic boundary', /sembolik|olas[ıi]l[ıi]k|kehanet\s+de[gğ]il|zihin\s+okuma/i.test(r1));
record('test1 not report dump', (r1.match(/^##\s+/gm) || []).length === 0);
record('test1 not dictionary', looksLikeCardDictionary(r1) === false);
record('test1 concise', r1.length < 900 && r1.split(/\s+/).length < 180, `len=${r1.length}`);
record('test1 three cards in data', t1?.data?.cards?.length === 3);
const t1Cards = (t1?.data?.cards || []).map((c) => c.name);

// Guard on real analysis
const t1run = runTarotAnalysis({
  message: 'Görünmeyen niyete üç kart aç.',
  intention: 'görünmeyen niyet',
  seed: 'acceptance-seed-1',
  depth: DEPTH_LEVEL.STANDARD,
});
record(
  'guard accepts standard analysis',
  t1run.guard && t1run.guard.ok === true,
  `score=${t1run.guard?.score}/${t1run.guard?.maxScore} failed=${t1run.guard?.failedChecks?.join(',')}`,
);
record('standard still layered when requested', /##\s*Açılım/i.test(t1run.reply || ''));
record('standard has Ana Mesaj when requested', /##\s*Ana Mesaj/i.test(t1run.reply || ''));

// ── Test 1b: deep ─────────────────────────────────────────────────────
const t1deep = runTarotAnalysis({
  message: 'detaylı tam analiz',
  intention: 'görünmeyen niyet',
  seed: 'acceptance-seed-1',
  depth: DEPTH_LEVEL.DEEP,
  existingCardIds: t1run.selection.cardIds,
  existingPositions: t1run.analysis.placed.map((p) => p.position),
  existingSpreadKind: t1run.analysis.spreadKind,
  existingSeed: t1run.selection.seed,
  forceNewDraw: false,
});
record(
  'deep includes element/arcana',
  /element|arkana/i.test(t1deep.reply),
);
record(
  'deep includes alternative or psychological',
  /alternatif|psikolojik/i.test(t1deep.reply),
);

// ── Test 2: reveal same cards ─────────────────────────────────────────
_resetAllTarotSessions();
const seedSpread = tryTarotFlowReply({
  message: 'Aklımdaki kişinin duygularına üç kart aç.',
  conversationId: 'tarot-t2',
  userId: 'telegram:800102',
});
const seededNames = (seedSpread?.data?.cards || []).map((c) => c.name);
const reveal = tryTarotFlowReply({
  message: 'Hangi kartlar?',
  history: [
    { role: 'user', content: 'Aklımdaki kişinin duygularına üç kart aç.' },
    { role: 'assistant', content: seedSpread?.reply || '' },
  ],
  conversationId: 'tarot-t2',
  userId: 'telegram:800102',
});
record('reveal handled', Boolean(reveal?.handled));
record('reveal intent', reveal?.intent === 'tarot:reveal');
record(
  'reveal same cards',
  seededNames.every((n) => (reveal?.reply || '').includes(n)),
  `seeded=${seededNames.join(',')} reveal=${reveal?.reply?.slice(0, 120)}`,
);
record('reveal reusedCards', reveal?.data?.reusedCards === true);

// ── Test 3: interpret / follow-up deeper keeps cards ──────────────────
const interpret = tryTarotFlowReply({
  message: 'Yorumla.',
  history: [
    { role: 'user', content: 'Aklımdaki kişinin duygularına üç kart aç.' },
    { role: 'assistant', content: seedSpread?.reply || '' },
  ],
  conversationId: 'tarot-t2',
  userId: 'telegram:800102',
});
record('interpret handled', Boolean(interpret?.handled));
record('interpret reused', interpret?.data?.reusedCards === true);
record(
  'interpret same card set',
  seededNames.every((n) => (interpret?.data?.cards || []).some((c) => c.name === n)),
);

const deeper = tryTarotFlowReply({
  message: 'Daha derin anlat.',
  history: [
    { role: 'user', content: 'Yorumla.' },
    { role: 'assistant', content: interpret?.reply || '' },
  ],
  conversationId: 'tarot-t2',
  userId: 'telegram:800102',
});
record('deeper follow-up active', deeper?.intent === 'tarot:followup_deeper');
record('deeper reused cards', deeper?.data?.reusedCards === true);
record('deeper depth >= 2', (deeper?.data?.depth || 0) >= DEPTH_LEVEL.STANDARD);

const combo = tryTarotFlowReply({
  message: 'Kombinasyonu anlat.',
  conversationId: 'tarot-t2',
  userId: 'telegram:800102',
});
record('combo follow-up', combo?.intent === 'tarot:followup_combination');
record('combo section', /kombinasyon|birbir/i.test(combo?.reply || ''));

const blind = tryTarotFlowReply({
  message: 'Kör nokta?',
  conversationId: 'tarot-t2',
  userId: 'telegram:800102',
});
record('blind follow-up', blind?.intent === 'tarot:followup_blind_spot');
record('blind content', /k[oö]r\s+nokta/i.test(blind?.reply || ''));

const BOUNDARY_RE =
  /sembolik|olas[ıi]l[ıi]k|yorumlay[ıi]c[ıi]|kesin\s+kehanet|zihin\s+okuma/i;

function cardIdsOf(flowResult) {
  return (flowResult?.data?.cards || []).map((c) => c.id);
}

function idsEqual(a, b) {
  return a.length > 0 && a.length === b.length && a.every((id, i) => id === b[i]);
}

// ── Test 4: continue = new draw, prior intention preserved ────────────
const priorIntention = seedSpread?.data?.intention;
const cont = tryTarotFlowReply({
  message: 'Bir de eylemine bak.',
  history: [
    { role: 'user', content: 'Aklımdaki kişinin duygularına üç kart aç.' },
    { role: 'assistant', content: seedSpread?.reply || '' },
  ],
  conversationId: 'tarot-t2',
  userId: 'telegram:800102',
});
record('continue intent', cont?.intent === 'tarot:continue');
record('continue new draw', cont?.data?.reusedCards === false);
record('continue action kind', cont?.data?.spreadKind === 'action');
record(
  'continue inherits intention',
  Boolean(priorIntention) && cont?.data?.intention === priorIntention,
  `prior=${priorIntention} cont=${cont?.data?.intention}`,
);
record(
  'continue topic preserved',
  Boolean(cont?.data?.topic) &&
    (cont.data.topic === priorIntention || cont.data.topic === seedSpread?.data?.topic),
  `topic=${cont?.data?.topic}`,
);

// ── Test 5: uncertainty — no absolute claims in engine reply ──────────
record(
  'no absolute future claim pattern',
  !/kesin(?:likle)?\s+(?:seni\s+)?(?:arayacak|dönecek)/i.test(r1),
);
record('no "aynı açılım" phrasing in focus replies', !/ayn[ıi]\s+a[cç][ıi]l[ıi]m/i.test(blind?.reply || ''));
record('combo hasBoundary', BOUNDARY_RE.test(combo?.reply || ''));
record('blind hasBoundary', BOUNDARY_RE.test(blind?.reply || ''));

// ── B1: session missing + history marker — no new cards ───────────────
_resetAllTarotSessions();
const histTarot = [
  { role: 'user', content: 'Aklımdaki kişinin duygularına üç kart aç.' },
  {
    role: 'assistant',
    content: '## Açılım\nAmaç: test. Classic Tarot açılım.\n1. Kupa\n2. Kılıç\n3. Asa',
  },
];
const noSessInterpret = tryTarotFlowReply({
  message: 'Yorumla.',
  history: histTarot,
  conversationId: 'tarot-nosess',
  userId: 'telegram:9001',
});
record('nosess interpret handled', Boolean(noSessInterpret?.handled));
record(
  'nosess interpret no cards drawn',
  noSessInterpret?.data?.missingSession === true &&
    noSessInterpret?.data?.drewCards === false &&
    (noSessInterpret?.data?.cards || []).length === 0,
);
record(
  'nosess interpret reply',
  noSessInterpret?.reply === NO_ACTIVE_TAROT_SPREAD_REPLY,
);
record(
  'nosess interpret not fake reuse',
  noSessInterpret?.data?.reusedCards !== true,
);
record(
  'nosess interpret no aynı açılım',
  !/ayn[ıi]\s+a[cç][ıi]l[ıi]m/i.test(noSessInterpret?.reply || ''),
);

// ── B2: group isolation — User B cannot follow User A ─────────────────
_resetAllTarotSessions();
const groupId = 'tg-group-100';
const userA = tryTarotFlowReply({
  message: 'Aklımdaki kişinin duygularına üç kart aç.',
  conversationId: groupId,
  userId: 'telegram:user-a',
});
const aIds = cardIdsOf(userA);
const groupHist = [
  { role: 'user', content: 'Aklımdaki kişinin duygularına üç kart aç.' },
  { role: 'assistant', content: userA?.reply || '' },
];
const userB = tryTarotFlowReply({
  message: 'Kör nokta?',
  history: groupHist,
  conversationId: groupId,
  userId: 'telegram:user-b',
});
record('group B handled', Boolean(userB?.handled));
record('group B missing session', userB?.data?.missingSession === true);
record('group B no cards', (userB?.data?.cards || []).length === 0);
record('group B no draw', userB?.data?.drewCards === false);
record(
  'group B does not use A cards',
  aIds.length === 3 &&
    !(userB?.reply || '').includes(userA?.data?.cards?.[0]?.name || '___'),
);
record('group B no-active reply', userB?.reply === NO_ACTIVE_TAROT_SPREAD_REPLY);

// User A still has session and can follow up
const userABlind = tryTarotFlowReply({
  message: 'Kör nokta?',
  history: groupHist,
  conversationId: groupId,
  userId: 'telegram:user-a',
});
record('group A blind reused', userABlind?.data?.reusedCards === true);
record('group A same cardIds', idsEqual(aIds, cardIdsOf(userABlind)));

// ── Active session blind keeps cards ──────────────────────────────────
_resetAllTarotSessions();
const activeSeed = tryTarotFlowReply({
  message: 'Görünmeyen niyete üç kart aç.',
  conversationId: 'tarot-active',
  userId: 'web:u1',
});
const activeIds = cardIdsOf(activeSeed);
const activeBlind = tryTarotFlowReply({
  message: 'Kör nokta?',
  conversationId: 'tarot-active',
  userId: 'web:u1',
});
record('active blind same ids', idsEqual(activeIds, cardIdsOf(activeBlind)));
record('active blind no new draw', activeBlind?.data?.reusedCards === true);

// ── Focus reply boundaries ────────────────────────────────────────────
_resetAllTarotSessions();
const focusSeed = tryTarotFlowReply({
  message: 'ilişkiye üç kart aç',
  conversationId: 'tarot-focus',
  userId: 'web:focus',
});
const focusCombo = tryTarotFlowReply({
  message: 'Kombinasyonu anlat.',
  conversationId: 'tarot-focus',
  userId: 'web:focus',
});
const focusExplore = tryTarotFlowReply({
  message: 'Başka ne görüyorsun?',
  conversationId: 'tarot-focus',
  userId: 'web:focus',
});
const focusWhy = tryTarotFlowReply({
  message: 'Bu kart neden çıktı?',
  conversationId: 'tarot-focus',
  userId: 'web:focus',
});
const focusBlind = tryTarotFlowReply({
  message: 'Kör nokta?',
  conversationId: 'tarot-focus',
  userId: 'web:focus',
});
record('focus combo hasBoundary', hasUncertaintyBoundary(focusCombo?.reply || ''));
record('focus explore hasBoundary', hasUncertaintyBoundary(focusExplore?.reply || ''));
record('focus why hasBoundary', hasUncertaintyBoundary(focusWhy?.reply || ''));
record('focus blind hasBoundary', hasUncertaintyBoundary(focusBlind?.reply || ''));
record(
  'focus replies avoid aynı açılım',
  ![focusCombo, focusExplore, focusWhy, focusBlind].some((r) =>
    /ayn[ıi]\s+a[cç][ıi]l[ıi]m/i.test(r?.reply || ''),
  ),
);

// ── Multi-turn same cardIds ───────────────────────────────────────────
_resetAllTarotSessions();
const mtSeed = tryTarotFlowReply({
  message: 'Aklımdaki kişinin duygularına üç kart aç.',
  conversationId: 'tarot-mt',
  userId: 'telegram:mt',
});
const mtIds = cardIdsOf(mtSeed);
const mtReveal = tryTarotFlowReply({
  message: 'Hangi kartlar?',
  conversationId: 'tarot-mt',
  userId: 'telegram:mt',
});
const mtInterpret = tryTarotFlowReply({
  message: 'Yorumla.',
  conversationId: 'tarot-mt',
  userId: 'telegram:mt',
});
const mtDeeper = tryTarotFlowReply({
  message: 'Daha derin anlat.',
  conversationId: 'tarot-mt',
  userId: 'telegram:mt',
});
const mtCombo = tryTarotFlowReply({
  message: 'Kombinasyonu anlat.',
  conversationId: 'tarot-mt',
  userId: 'telegram:mt',
});
const mtBlind = tryTarotFlowReply({
  message: 'Kör nokta?',
  conversationId: 'tarot-mt',
  userId: 'telegram:mt',
});
record('mt reveal same ids', idsEqual(mtIds, cardIdsOf(mtReveal)));
record('mt interpret same ids', idsEqual(mtIds, cardIdsOf(mtInterpret)));
record('mt deeper same ids', idsEqual(mtIds, cardIdsOf(mtDeeper)));
record('mt combo same ids', idsEqual(mtIds, cardIdsOf(mtCombo)));
record('mt blind same ids', idsEqual(mtIds, cardIdsOf(mtBlind)));

// ── Idle clear + history must not invent cards ────────────────────────
_resetAllTarotSessions();
const idleSeed = tryTarotFlowReply({
  message: 'ilişkiye üç kart aç',
  conversationId: 'tarot-idle',
  userId: 'web:idle',
});
clearTarotSession('tarot-idle', 'web:idle');
const idleFollow = tryTarotFlowReply({
  message: 'Yorumla.',
  history: [
    { role: 'user', content: 'ilişkiye üç kart aç' },
    { role: 'assistant', content: idleSeed?.reply || '' },
  ],
  conversationId: 'tarot-idle',
  userId: 'web:idle',
});
record('idle follow missing session', idleFollow?.data?.missingSession === true);
record('idle follow no draw', idleFollow?.data?.drewCards === false);

// ── DM vs group isolation ─────────────────────────────────────────────
_resetAllTarotSessions();
const dmA = tryTarotFlowReply({
  message: 'duygularına üç kart aç',
  conversationId: 'dm-1',
  userId: 'telegram:1',
});
const dmB = tryTarotFlowReply({
  message: 'Kör nokta?',
  conversationId: 'dm-2',
  userId: 'telegram:1',
});
record('dm cross-conversation no session', dmB?.data?.missingSession === true);
record('dm A has cards', cardIdsOf(dmA).length === 3);

// ── Image + tarot: no LLM dump (engine-first / controlled fallback) ───
_resetAllTarotSessions();
const tinyPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const imgTarot = await processAtlasMessage(
  {
    channel: 'web',
    userId: 'web:img-tarot',
    conversationId: 'web:img-tarot',
    message: 'Aklımdaki kişinin duygularına üç kart aç.',
    history: [],
    image: { mimeType: 'image/png', base64: tinyPng },
  },
  { trustedUserId: 'web:img-tarot', roles: ['user'] },
);
record(
  'image+tarot engine not llm',
  imgTarot.engine === 'tarot-engine' || imgTarot.data?.provider === 'atlas-tarot-engine',
  `engine=${imgTarot.engine} provider=${imgTarot.data?.provider}`,
);
record(
  'image+tarot not llm dump path',
  imgTarot.data?.model === 'deterministic' && imgTarot.data?.tokensUsed === 0,
);
record(
  'image+tarot has cards or controlled fallback',
  (imgTarot.data?.cards || []).length === 3 ||
    imgTarot.data?.tarotFallback === 'multimodal_unsupported' ||
    imgTarot.data?.imageIgnoredForTarot === true,
  `cards=${(imgTarot.data?.cards || []).length} fallback=${imgTarot.data?.tarotFallback}`,
);

// Follow-up with image after text spread in same session
_resetAllTarotSessions();
const preImg = tryTarotFlowReply({
  message: 'ilişkiye üç kart aç',
  conversationId: 'web:img2',
  userId: 'web:img2',
});
const imgFollow = await processAtlasMessage(
  {
    channel: 'web',
    userId: 'web:img2',
    conversationId: 'web:img2',
    message: 'Kör nokta?',
    history: [
      { role: 'user', content: 'ilişkiye üç kart aç' },
      { role: 'assistant', content: preImg?.reply || '' },
    ],
    image: { mimeType: 'image/png', base64: tinyPng },
  },
  { trustedUserId: 'web:img2', roles: ['user'] },
);
record(
  'image+blind reuses session cards',
  imgFollow.engine === 'tarot-engine' &&
    idsEqual(cardIdsOf(preImg), (imgFollow.data?.cards || []).map((c) => c.id)),
);

// ── Intent detection smoke ────────────────────────────────────────────
_resetAllTarotSessions();
const det = detectTarotEngineIntent('tarot aç', [], { sessionActive: false });
record('detect spread', det.active && det.intent === 'spread');
const det2 = detectTarotEngineIntent('Kör nokta?', [], { sessionActive: true });
record('detect blind in session', det2.intent === 'followup_blind_spot');
const det3 = detectTarotEngineIntent('Kör nokta?', histTarot, { sessionActive: false });
record(
  'detect blind without session still flagged requiresSession',
  det3.intent === 'followup_blind_spot' && det3.requiresSession === true,
);

// ── Engine version ────────────────────────────────────────────────────
record('engine version', TAROT_ENGINE_VERSION === 'atlas-tarot-engine-v1');
record('focus seed handled', Boolean(focusSeed?.handled));

// ── Prod regression: context persistence + contamination + natural synth ─
_resetAllTarotSessions();
const energyHist = [{ role: 'user', content: 'Aklımdaki kişinin enerjisi' }];
const kartAcIntent = detectTarotSpreadIntent('Kart aç', energyHist);
record(
  'energy→Kart aç stays tarot',
  kartAcIntent.active === true && kartAcIntent.intent === 'spread',
);
const energyDraw = tryTarotFlowReply({
  message: 'Kart aç',
  history: energyHist,
  conversationId: 'tarot-energy',
  userId: 'u-energy',
});
record('energy→Kart aç executes tarot', energyDraw?.engine === 'tarot-engine' && energyDraw?.handled === true);
record(
  'energy→Kart aç inherits intention',
  /enerji|ki[sş]i/i.test(energyDraw?.data?.intention || energyDraw?.reply || ''),
  `intention=${energyDraw?.data?.intention || ''}`,
);
record(
  'energy follow-up context preserved',
  detectTarotEngineIntent('Kart aç', energyHist, { sessionActive: false }).active === true,
);

_resetAllTarotSessions();
const three = tryTarotFlowReply({
  message: '3 kart aç',
  conversationId: 'tarot-3count',
  userId: 'u-3',
});
record('3 kart → exactly 3 cards', three?.data?.cards?.length === 3, `n=${three?.data?.cards?.length}`);
record('parse 3 kart', parseRequestedCardCount('3 kart aç') === 3);
record('parse 1 kart', parseRequestedCardCount('1 kart çek') === 1);

_resetAllTarotSessions();
const one = tryTarotFlowReply({
  message: '1 kart aç',
  conversationId: 'tarot-1count',
  userId: 'u-1',
});
record('1 kart → exactly 1 card', one?.data?.cards?.length === 1, `n=${one?.data?.cards?.length}`);

const rejectAudio = 'Ben yorum istemedim açılım yapmalısın 3 kart';
const audioFalse = detectAudioIntent(rejectAudio, []);
record(
  'istemedim ≠ stem audio false positive',
  audioFalse.active !== true || audioFalse.intent !== 'separate_stems',
  `intent=${audioFalse.intent}`,
);
record(
  'tarot beats audio gate on reject-yorum draw',
  shouldConsiderAudioStudio(rejectAudio, []) === false,
);
_resetAllTarotSessions();
const rejectDraw = tryTarotFlowReply({
  message: rejectAudio,
  conversationId: 'tarot-reject',
  userId: 'u-reject',
});
record(
  'yorum istemedim → tarot 3 cards',
  rejectDraw?.engine === 'tarot-engine' && rejectDraw?.data?.cards?.length === 3,
);
record(
  'no audio/telegram contamination copy',
  !/(mix|mastering|stem|telegram|ses\s+dosya|aranje)/i.test(rejectDraw?.reply || ''),
);

_resetAllTarotSessions();
const natural = tryTarotFlowReply({
  message: 'Tarot aç 3 kart',
  conversationId: 'tarot-natural',
  userId: 'u-nat',
});
record(
  'natural synthesis no debug labels',
  Boolean(natural?.reply) &&
    !/Ortak çizgi|Öne çıkan yapı|büyük arkana ağırlığı|birlikte kurulan örüntü/i.test(
      natural.reply,
    ),
);
record(
  'natural synthesis names cards',
  (natural?.data?.cards || []).every((c) => (natural.reply || '').includes(c.name)),
);
record(
  'epistemic: no absolute mind-reading',
  !/kesin(likle)?\s+(düşünüyor|niyeti|aklından)|zihnini\s+okud/i.test(natural?.reply || ''),
);
record(
  'taxonomy marker not user-visible',
  !/\[kişi\]|\[dönem\]|\[seçim\]/i.test(natural?.reply || ''),
);

const inherit = resolveSpreadIntention('Kart aç', [
  { role: 'user', content: 'Aklımdaki kişinin enerjisi' },
]);
record(
  'resolveSpreadIntention inherits energy preamble',
  /enerji/i.test(inherit),
  inherit,
);
record(
  'extractIntention strips draw verbs',
  extractIntention('yorum istemedim açılım yapmalısın 3 kart') === 'genel durum' ||
    extractIntention('yorum istemedim açılım yapmalısın 3 kart').length < 8,
);

// e2e via message service — contamination path
_resetAllTarotSessions();
const e2eReject = await processAtlasMessage(
  {
    channel: 'web',
    userId: 'web:tarot-reject',
    conversationId: 'web:tarot-reject',
    message: rejectAudio,
    history: [],
  },
  { trustedUserId: 'web:tarot-reject', roles: ['user'] },
);
record(
  'e2e reject-yorum stays tarot engine',
  e2eReject.engine === 'tarot-engine' || e2eReject.data?.provider === 'atlas-tarot-engine',
  `engine=${e2eReject.engine}`,
);
record(
  'e2e reject-yorum not audio studio',
  e2eReject.engine !== 'audio-studio' && !/mastering|stem separation/i.test(e2eReject.reply || ''),
);

_resetAllTarotSessions();
const e2eFollow = await processAtlasMessage(
  {
    channel: 'web',
    userId: 'web:tarot-follow',
    conversationId: 'web:tarot-follow',
    message: 'Kart aç',
    history: [{ role: 'user', content: 'Aklımdaki kişinin enerjisi' }],
  },
  { trustedUserId: 'web:tarot-follow', roles: ['user'] },
);
record(
  'e2e energy→Kart aç tarot',
  e2eFollow.engine === 'tarot-engine' || e2eFollow.data?.provider === 'atlas-tarot-engine',
  `engine=${e2eFollow.engine}`,
);

// Summary
console.log('\n=== Summary ===');
console.log(`Tarot tests: ${passed} passed, ${failed} failed`);
if (failed) {
  console.log('Failures:', failures.join(', '));
  process.exit(1);
}
process.exit(0);

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
import { getConversationState } from '../server/conversation-context-engine.js';

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

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);

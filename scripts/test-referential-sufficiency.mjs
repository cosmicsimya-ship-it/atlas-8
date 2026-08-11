/**
 * Referential sufficiency + clarification gate regression matrix.
 * Run: node scripts/test-referential-sufficiency.mjs
 */
import {
  assessReferentialSufficiency,
  isDirectKnowledgeQuestion,
  isReferentHungryAsk,
  buildMinimumClarification,
  detectUnsupportedCausalCompletion,
  historyHasBindablePrior,
  REFERENTIAL_SUFFICIENCY_VERSION,
} from '../server/referential-sufficiency.js';
import { resolveSymbolicContext } from '../server/symbolic-context.js';
import { detectSemanticLayers } from '../server/semantic-layers.js';
import { touchTarotSession, clearTarotSession } from '../server/tarot-engine/session.js';
import { touchDreamSession, clearDreamSession } from '../server/dream-engine/session.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';

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

function assess(message, history = [], opts = {}) {
  const conversationId = opts.conversationId || 'ref-suf-test';
  const userId = opts.userId || 'web:ref-user';
  const symbolicContext = resolveSymbolicContext({
    message,
    history,
    conversationId,
    userId,
  });
  const semanticLayers = detectSemanticLayers(message, history);
  return assessReferentialSufficiency({
    message,
    history,
    symbolicContext,
    semanticLayers,
    conversationId,
  });
}

record('version', REFERENTIAL_SUFFICIENCY_VERSION.startsWith('atlas-referential'));

// ── CASE 1–5 fresh discovery / hungry asks ───────────────────────────
const c1 = assess('Bu tesadüf mü, yoksa bir tekrar mı?', []);
record(
  'CASE1 fresh tesadüf → clarify',
  c1.sufficient === false && c1.intentKnown === true && Boolean(c1.question),
  c1.reason,
);
record(
  'CASE1 question is one useful ask',
  /ki[sş]i|olay|tarih|say[ıi]|davran[ıi][sş]/i.test(c1.question || '') &&
    !/bilin[cç]alt|frekans|enerji/i.test(c1.question || ''),
);

const badCompletion =
  'Bu, tesadüften çok tekrar eden bir örüntü olabilir. Bazı durumlar bilinçaltımızda veya çevresel faktörlerde benzer frekansları yakaladığında kendini tekrarlar.';
record(
  'CASE1 unsupported causal detected',
  detectUnsupportedCausalCompletion(badCompletion).length >= 2,
);

const c2 = assess('Bu tarih neden karşıma çıkıyor?', []);
record('CASE2 fresh tarih → clarify', c2.sufficient === false && /tarih/i.test(c2.question || ''));

const c3 = assess('Asıl örüntü ne?', []);
record('CASE3 asıl örüntü → clarify', c3.sufficient === false && /örnek|olay/i.test(c3.question || ''));

const c4 = assess('Bu kişi neden yeniden gündeme geldi?', []);
record('CASE4 kişi → clarify', c4.sufficient === false);

const c5 = assess('Söylediğiyle yaptığı neden çelişiyor?', []);
record('CASE5 çelişki → clarify', c5.sufficient === false && /söyledi|yapt[ıi]/i.test(c5.question || ''));

// Unseen shapes
record(
  'unseen: Bunun sebebi ne?',
  assess('Bunun sebebi ne?', []).sufficient === false,
);
record(
  'unseen: Yine aynı şey oldu.',
  assess('Yine aynı şey oldu.', []).sufficient === false,
);

// ── CASE 6 context available ─────────────────────────────────────────
const prior17 = [
  {
    role: 'user',
    content: 'Son üç ayda her ayın 17’sinde ondan mesaj geldi.',
  },
];
record('prior bindable', historyHasBindablePrior(prior17) === true);
const c6 = assess('Bu tesadüf mü, yoksa bir tekrar mı?', prior17);
record(
  'CASE6 with prior → NO clarify',
  c6.sufficient === true && c6.referentKnown === true,
  c6.reason,
);

// ── CASE 7 person follow-up ──────────────────────────────────────────
const personHist = [{ role: 'user', content: 'Bu kişi üç kere gidip geri geldi.' }];
const c7 = assess('Yine yazdı.', personHist);
record('CASE7 yine yazdı resolves', c7.sufficient === true, c7.reason);

// ── CASE 8 tarot ─────────────────────────────────────────────────────
const tarotConv = 'ref-tarot';
const tarotUser = 'web:tarot-ref';
clearTarotSession(tarotConv, tarotUser);
touchTarotSession({
  conversationId: tarotConv,
  userId: tarotUser,
  intention: 'aklimdaki kisi',
  spreadKind: 'three_card',
  cardIds: ['a', 'b', 'c'],
  cardNames: ['A', 'B', 'C'],
  positions: [],
  selectionSeed: 't',
});
const c8 = assess(
  'bir kart daha',
  [{ role: 'user', content: 'Aklımdaki kişinin enerjisi' }],
  { conversationId: tarotConv, userId: tarotUser },
);
record('CASE8 tarot bir kart daha → NO clarify', c8.sufficient === true, c8.reason);

// ── CASE 9 dream ─────────────────────────────────────────────────────
const dreamConv = 'ref-dream';
const dreamUser = 'web:dream-ref';
clearDreamSession(dreamConv, dreamUser);
touchDreamSession({
  conversationId: dreamConv,
  userId: dreamUser,
  narrative: 'Aynı rüyayı üçüncü kez gördüm.',
  recurring: true,
  symbolNames: ['kapı'],
});
const c9 = assess(
  'kapı yine kapalıydı',
  [{ role: 'user', content: 'Aynı rüyayı üçüncü kez gördüm.' }],
  { conversationId: dreamConv, userId: dreamUser },
);
record('CASE9 dream motif → NO clarify', c9.sufficient === true, c9.reason);

// ── CASE 10 astrology-ish detail follow-up with date+zodiac prior ─────
const astroHist = [
  { role: 'user', content: '12 Ağustos Kova burcunda transit nasıl?' },
  { role: 'assistant', content: 'Kova vurgusunda…' },
];
const c10 = assess('Daha detaylı anlat', astroHist, {
  conversationId: 'ref-astro',
  userId: 'web:astro',
});
record(
  'CASE10 daha detaylı with prior → allow',
  c10.sufficient === true || isReferentHungryAsk('Daha detaylı anlat') === false,
  c10.reason,
);

// ── CASE 11 multiple referents ───────────────────────────────────────
const multi = [
  { role: 'user', content: 'Ayşe dün aradı.' },
  { role: 'user', content: 'Mehmet de yazdı.' },
];
const c11 = assess('O neden geri geldi?', multi);
record(
  'CASE11 multiple people → clarify which',
  c11.sufficient === false && c11.ambiguityType === 'multiple_referents',
  `${c11.ambiguityType}/${c11.reason}`,
);

// ── CASE 12 direct knowledge ─────────────────────────────────────────
record(
  'CASE12 Kule kartı direct',
  isDirectKnowledgeQuestion('Kule kartının tarot anlamı nedir?') &&
    assess('Kule kartının tarot anlamı nedir?', []).sufficient === true,
);
record(
  'CASE12 numerology traditional',
  assess('17 sayısının numerolojideki geleneksel yorumu nedir?', []).sufficient === true,
);
record(
  'CASE12 capital city',
  assess('Türkiye’nin başkenti neresi?', []).sufficient === true,
);

// ── Over-clarification protection extras ─────────────────────────────
record(
  'over-clarify: concrete observation alone',
  assess('17 sayısını dört gündür görüyorum.', []).sufficient === true,
);

// ── Minimum clarification: one question, not a form ──────────────────
const q = buildMinimumClarification('event_missing', 'Bu tesadüf mü?');
record(
  'min clarification single question',
  (q.match(/\?/g) || []).length <= 2 && !/1\)|2\)|3\)/.test(q),
);

// ── e2e via processAtlasMessage ──────────────────────────────────────
const e2e = await processAtlasMessage(
  {
    message: 'Bu tesadüf mü, yoksa bir tekrar mı?',
    history: [],
    userId: 'web:e2e-ref',
    conversationId: 'web:e2e-ref',
    channel: 'web',
  },
  { skipLlm: true },
);
record(
  'e2e fresh discovery clarifies',
  e2e.intent === 'referent:clarify' ||
    e2e.intent === 'pattern:clarify' ||
    e2e.engine === 'referential-sufficiency' ||
    e2e.engine === 'semantic-layers',
  `intent=${e2e.intent} engine=${e2e.engine}`,
);
record(
  'e2e no invented pattern prose',
  !/bilin[cç]alt|benzer\s+frekans|[cç]evresel\s+fakt/i.test(e2e.reply || ''),
);

const e2eOk = await processAtlasMessage(
  {
    message: 'Bu tesadüf mü, yoksa bir tekrar mı?',
    history: prior17,
    userId: 'web:e2e-ref2',
    conversationId: 'web:e2e-ref2',
    channel: 'web',
  },
  { skipLlm: true },
);
record(
  'e2e with prior does not force clarify',
  e2eOk.intent !== 'referent:clarify',
  `intent=${e2eOk.intent}`,
);

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);

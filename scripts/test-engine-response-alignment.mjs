/**
 * Engine response alignment — Tarot/Numerology SHORT vs DEEP local acceptance.
 */
import {
  runTarotAnalysis,
  resolveTarotDepth,
  DEPTH_LEVEL as TAROT_DEPTH,
} from '../server/tarot-engine/index.js';
import {
  runNumerologyAnalysis,
  resolveNumerologyDepth,
  DEPTH_LEVEL as NUM_DEPTH,
} from '../server/numerology-engine/index.js';
import {
  runDreamAnalysis,
  resolveDreamDepth,
  DEPTH_LEVEL as DREAM_DEPTH,
} from '../server/dream-engine/index.js';

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

function wordCount(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasReportHeader(text) {
  return /^##\s+/m.test(String(text || ''));
}

const CERTAINTY_LEAK =
  /(?:^|[^.!?]\s)(?:kesin(?:likle)?\s+(?:seni\s+)?(?:arayacak|d[oö]necek|seviyor)|mutlaka\s+olacak|kaderinde\s+yaz[ıi]l[ıi])(?!\s*(?:de[gğ]il|yok|çıkmaz))/i;

// ── Depth routing ─────────────────────────────────────────────────────
record(
  'tarot default → SHORT',
  resolveTarotDepth('Bir tarot açılımı yap.') === TAROT_DEPTH.SHORT,
);
record(
  'tarot üç kart → SHORT',
  resolveTarotDepth('Üç kart çek.') === TAROT_DEPTH.SHORT,
);
record(
  'tarot detaylı → DEEP',
  resolveTarotDepth('Detaylı tarot açılımı yap.') === TAROT_DEPTH.DEEP,
);
record(
  'num yorumla → SHORT',
  resolveNumerologyDepth('Doğum tarihim 12.03.1990, numerolojimi yorumla.') ===
    NUM_DEPTH.SHORT,
);
record(
  'num detaylı → DEEP',
  resolveNumerologyDepth('Numerolojimi detaylı analiz et.') === NUM_DEPTH.DEEP,
);

// ── Scenario 1–2: Tarot SHORT ─────────────────────────────────────────
const tarotShort1 = runTarotAnalysis({
  message: 'Bir tarot açılımı yap.',
  intention: 'Bir tarot açılımı yap.',
  conversationId: 'align-t1',
  seed: 'align-tarot-short-1',
});
const tarotShort2 = runTarotAnalysis({
  message: 'Üç kart çek.',
  intention: 'Üç kart çek.',
  conversationId: 'align-t2',
  seed: 'align-tarot-short-2',
  cardCount: 3,
});

const wcT1 = wordCount(tarotShort1.reply);
const wcT2 = wordCount(tarotShort2.reply);
record(
  'TAROT SHORT1 depth',
  tarotShort1.ok && tarotShort1.depth === TAROT_DEPTH.SHORT,
  `depth=${tarotShort1.depth}`,
);
record(
  'TAROT SHORT1 no ##',
  !hasReportHeader(tarotShort1.reply),
);
record(
  'TAROT SHORT1 word band ~80–140 (allow 70–160)',
  wcT1 >= 70 && wcT1 <= 160,
  `words=${wcT1}`,
);
record(
  'TAROT SHORT1 no certainty leak',
  !CERTAINTY_LEAK.test(tarotShort1.reply),
);
record(
  'TAROT SHORT1 door / soft close',
  /detayl[ıi]|a[cç]abiliriz|istersen/i.test(tarotShort1.reply),
);
record(
  'TAROT SHORT2 depth',
  tarotShort2.ok && tarotShort2.depth === TAROT_DEPTH.SHORT,
  `depth=${tarotShort2.depth} words=${wcT2}`,
);
record('TAROT SHORT2 no ##', !hasReportHeader(tarotShort2.reply));

// ── Scenario 3: Tarot DEEP ────────────────────────────────────────────
const tarotDeep = runTarotAnalysis({
  message: 'Detaylı tarot açılımı yap.',
  intention: 'Detaylı tarot açılımı yap.',
  conversationId: 'align-t3',
  seed: 'align-tarot-deep-1',
});
record(
  'TAROT DEEP depth',
  tarotDeep.ok && tarotDeep.depth === TAROT_DEPTH.DEEP,
  `depth=${tarotDeep.depth}`,
);
record(
  'TAROT DEEP has report sections',
  hasReportHeader(tarotDeep.reply) || /##\s*(Açılım|Kartlar|Ana Mesaj)/i.test(tarotDeep.reply),
);
record(
  'TAROT DEEP longer than SHORT',
  wordCount(tarotDeep.reply) > wcT1 + 40,
  `deep=${wordCount(tarotDeep.reply)} short=${wcT1}`,
);

// ── Scenario 4: Numerology SHORT ──────────────────────────────────────
const numShort = runNumerologyAnalysis({
  birthDate: '1990-03-12',
  message: 'Doğum tarihim 12.03.1990, numerolojimi yorumla.',
  now: new Date('2026-08-07T12:00:00+03:00'),
  timeZone: 'Europe/Istanbul',
});
const wcN = wordCount(numShort.reply);
record(
  'NUM SHORT depth',
  numShort.ok && numShort.depth === NUM_DEPTH.SHORT,
  `depth=${numShort.depth}`,
);
record('NUM SHORT no ## Ana hesap', !hasReportHeader(numShort.reply));
record(
  'NUM SHORT word band ~60–120 (allow 55–140)',
  wcN >= 55 && wcN <= 140,
  `words=${wcN}`,
);
record(
  'NUM SHORT keeps life path',
  /yaşam yolu|life\s*path/i.test(numShort.reply) || /\b\d{1,2}\b/.test(numShort.reply),
);
record('NUM SHORT no certainty leak', !CERTAINTY_LEAK.test(numShort.reply));

// ── Scenario 5: Numerology DEEP ───────────────────────────────────────
const numDeep = runNumerologyAnalysis({
  birthDate: '1990-03-12',
  message: 'Numerolojimi detaylı analiz et.',
  now: new Date('2026-08-07T12:00:00+03:00'),
  timeZone: 'Europe/Istanbul',
});
record(
  'NUM DEEP depth',
  numDeep.ok && numDeep.depth === NUM_DEPTH.DEEP,
  `depth=${numDeep.depth}`,
);
record(
  'NUM DEEP has ## Ana hesap (or report headers)',
  /##\s*Ana hesap/i.test(numDeep.reply) || hasReportHeader(numDeep.reply),
);
record(
  'NUM DEEP longer than SHORT',
  wordCount(numDeep.reply) > wcN + 80,
  `deep=${wordCount(numDeep.reply)} short=${wcN}`,
);

// ── Dream regression ──────────────────────────────────────────────────
const dreamDepth = resolveDreamDepth(
  'Dün rüyamda uçuyordum, ne anlama gelir?',
);
const dream = runDreamAnalysis({
  message: 'Dün rüyamda uçuyordum, denizin üzerindeydim. Ne anlama gelir?',
});
record(
  'Dream default still SHORT',
  dreamDepth === DREAM_DEPTH.SHORT || dream.depth === DREAM_DEPTH.SHORT,
  `resolve=${dreamDepth} result=${dream.depth}`,
);
record(
  'Dream SHORT no ## report wall',
  dream.ok !== false && !hasReportHeader(dream.reply || dream),
  typeof dream.reply === 'string'
    ? `words=${wordCount(dream.reply)}`
    : `keys=${Object.keys(dream || {}).join(',')}`,
);

console.log('\n── Summary ──');
console.log(
  JSON.stringify(
    {
      tarotShortWords: wcT1,
      tarotShort2Words: wcT2,
      tarotDeepWords: wordCount(tarotDeep.reply),
      numShortWords: wcN,
      numDeepWords: wordCount(numDeep.reply),
      passed,
      failed,
      failures,
    },
    null,
    2,
  ),
);

if (failed) {
  console.error(`\nFAILED ${failed}/${passed + failed}`);
  process.exit(1);
}
console.log(`\nPASSED ${passed}/${passed}`);

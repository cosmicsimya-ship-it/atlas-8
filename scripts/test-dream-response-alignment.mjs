/**
 * Dream SHORT/DEEP alignment acceptance (local).
 */
import {
  runDreamAnalysis,
  resolveDreamDepth,
  DEPTH_LEVEL,
  DREAM_CLARIFY_REPLY,
  _resetAllDreamSessions,
} from '../server/dream-engine/index.js';
import { tryDreamFlowReply } from '../server/dream-flow.js';

let passed = 0;
let failed = 0;
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

function words(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasH2(text) {
  return /^##\s+/m.test(String(text || ''));
}

_resetAllDreamSessions?.();

const CERT =
  /kesin(?:likle)?\s+(?:olacak|ölecek)|mutlaka\s+olacak|kaderinde\s+yaz[ıi]l[ıi]|kehanet(?:im)?\s*:/i;

// Depth routing
record('default → SHORT', resolveDreamDepth('rüyamı yorumla') === DEPTH_LEVEL.SHORT);
record(
  'detaylı → DEEP',
  resolveDreamDepth('Detaylı yorumla.') === DEPTH_LEVEL.DEEP,
);
record(
  'derinleştir → DEEP',
  resolveDreamDepth('derinleştir') === DEPTH_LEVEL.DEEP,
);
record(
  'raporla → DEEP',
  resolveDreamDepth('raporla') === DEPTH_LEVEL.DEEP,
);

// TEST 1 — clarify
const clarify = tryDreamFlowReply({
  message: 'Bir rüya gördüm.',
  conversationId: 'dream-align-clarify',
  userId: 'u-clarify',
  history: [],
});

const clarifyReply = clarify?.reply || '';
record(
  'DREAM CLARIFY handled',
  Boolean(clarify?.handled) && /rüya|anlat|imge|hisset/i.test(clarifyReply),
  `intent=${clarify?.intent}`,
);
record('DREAM CLARIFY no ## report', !hasH2(clarifyReply));
record(
  'DREAM CLARIFY no invented analysis sections',
  !/##\s*Rüya Analizi|##\s*Sembol/i.test(clarifyReply),
);

// TEST 2 — SHORT
const shortMsg =
  'Rüyamda karanlık bir evdeydim ve aynı kapıyı üç kez açmaya çalıştım.';
const short = runDreamAnalysis({
  message: shortMsg,
  conversationId: 'dream-align-short',
});
const sw = words(short.reply);
record(
  'DREAM SHORT depth',
  short.ok && short.depth === DEPTH_LEVEL.SHORT,
  `depth=${short.depth}`,
);
record('DREAM SHORT no ##', !hasH2(short.reply));
record(
  'DREAM SHORT word band ~80–150 (allow 70–170)',
  sw >= 70 && sw <= 170,
  `words=${sw}`,
);
record('DREAM SHORT no certainty leak', !CERT.test(short.reply));
record(
  'DREAM SHORT door',
  /detayl[ıi]|istersen|a[cç]abiliriz/i.test(short.reply),
);
record(
  'DREAM SHORT selective (not catalog)',
  !/^•\s+/m.test(short.reply) && (short.reply.match(/,/g) || []).length < 12,
);

// TEST 3 — DEEP
const deep = runDreamAnalysis({
  message: `${shortMsg} Detaylı yorumla.`,
  conversationId: 'dream-align-deep',
});
const dw = words(deep.reply);
record(
  'DREAM DEEP depth',
  deep.ok && deep.depth === DEPTH_LEVEL.DEEP,
  `depth=${deep.depth}`,
);
record(
  'DREAM DEEP has report sections',
  hasH2(deep.reply) || /##\s*Rüya Analizi/i.test(deep.reply),
);
record(
  'DREAM DEEP longer than SHORT',
  dw > sw + 80,
  `deep=${dw} short=${sw}`,
);

// TEST 4 — single symbol
const single = runDreamAnalysis({
  message: 'Rüyamda sadece kırmızı bir kapı gördüm.',
  conversationId: 'dream-align-single',
});
const singleReply = single.reply || '';
record(
  'SINGLE SYMBOL no fortune verdict',
  !/anlam[ıi]\s+şudur|kesin(?:likle)?\s+olacak|kader/i.test(singleReply),
);
record(
  'SINGLE SYMBOL limited / H1 tone',
  single.clarified === true ||
    /tek\s+ba[sş][ıi]na|ba[gğ]lam|h[uü]k[uü]m|b[uü]y[uü]k\s+sonu[cç]/i.test(
      singleReply,
    ) ||
    singleReply === DREAM_CLARIFY_REPLY ||
    words(singleReply) < 180,
  `clarified=${single.clarified} words=${words(singleReply)}`,
);
record('SINGLE SYMBOL no ## dump', !hasH2(singleReply) || single.depth === DEPTH_LEVEL.DEEP);

console.log('\n── Summary ──');
console.log(JSON.stringify({ shortWords: sw, deepWords: dw, passed, failed, failures }, null, 2));
if (failed) {
  console.error(`\nFAILED ${failed}/${passed + failed}`);
  process.exit(1);
}
console.log(`\nPASSED ${passed}/${passed}`);

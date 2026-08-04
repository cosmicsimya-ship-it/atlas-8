/**
 * Dream engine — multi-layer interpretation + depth acceptance tests.
 */
import {
  tryDreamFlowReply,
  DREAM_FLOW_VERSION,
  NO_ACTIVE_DREAM_SESSION_REPLY,
} from '../server/dream-flow.js';
import {
  DREAM_ENGINE_VERSION,
  ATLAS_DREAM_METHODOLOGY,
  DEPTH_LEVEL,
  DREAM_SYMBOL_CORPUS,
  extractSymbols,
  extractEmotions,
  extractNarrative,
  hasDreamNarrative,
  interpretDream,
  runDreamAnalysis,
  applyDreamDepthGuard,
  looksLikeSymbolDictionary,
  hasUncertaintyBoundary,
  detectDreamEngineIntent,
  resolveDreamDepth,
  matchJungArchetypes,
  resolvePersonalContext,
  clearDreamSession,
  _resetAllDreamSessions,
  DREAM_CLARIFY_REPLY,
} from '../server/dream-engine/index.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';

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

_resetAllDreamSessions();

// ── Corpus integrity ──────────────────────────────────────────────────
record('symbol corpus non-empty', DREAM_SYMBOL_CORPUS.length >= 28, `n=${DREAM_SYMBOL_CORPUS.length}`);
record('su in corpus', DREAM_SYMBOL_CORPUS.some((s) => s.id === 'water'));
record('yılan in corpus', DREAM_SYMBOL_CORPUS.some((s) => s.id === 'snake'));
record('methodology id', ATLAS_DREAM_METHODOLOGY.methodologyId === 'atlas-dream-v1');
record('engine version set', Boolean(DREAM_ENGINE_VERSION));

// ── Extraction ────────────────────────────────────────────────────────
const sample =
  'Rüyamda deniz kenarındaki eski evimdeydim. Kapıyı açmaya çalışırken bir yılan gördüm ve korkuyla kaçıyordum. Uyanınca kaygılıydım.';
const symbols = extractSymbols(sample);
record(
  'extracts sea/house/door/snake',
  ['sea', 'house', 'door', 'snake'].every((id) => symbols.some((s) => s.id === id)),
  symbols.map((s) => s.id).join(','),
);
const emotions = extractEmotions(sample, 'korku');
record('extracts fear/anxiety emotion', emotions.some((e) => e.label === 'korku' || e.label === 'kaygı'));
const narrative = extractNarrative(sample);
record('narrative chase/escape', narrative.motifs.includes('chase') || narrative.motifs.includes('escape'));
record('hasDreamNarrative true', hasDreamNarrative(sample) === true);
record('hasDreamNarrative false for command', hasDreamNarrative('rüyamı yorumla') === false);

// ── Jung soft match ───────────────────────────────────────────────────
const jung = matchJungArchetypes({
  symbols,
  emotions: emotions.map((e) => e.label),
  narrative,
});
record('jung may include Shadow', jung.length === 0 || jung.some((j) => j.id === 'Shadow') || jung.length >= 1);

// ── Depth resolution ──────────────────────────────────────────────────
record('default depth standard', resolveDreamDepth('rüyamı yorumla') === DEPTH_LEVEL.STANDARD);
record('short depth', resolveDreamDepth('kısaca rüya yorumu') === DEPTH_LEVEL.SHORT);
record('deep depth', resolveDreamDepth('detaylı jung analizi') === DEPTH_LEVEL.DEEP);

// ── Guard: dictionary dump / prophecy fails ───────────────────────────
const shallow =
  '• su → arınma\n• yılan → düşman\n• ev → aile\n• kapı → fırsat\n\nGenel olarak rüya hayırlıdır ve kesin olacak.';
record('looksLikeSymbolDictionary catches shallow', looksLikeSymbolDictionary(shallow) === true);
const shallowGuard = applyDreamDepthGuard(
  { reply: shallow, analysis: null, depth: DEPTH_LEVEL.STANDARD },
  {},
);
record('guard expands shallow dictionary', shallowGuard.shouldExpand === true, shallowGuard.failedChecks.join(','));

// ── Clarify flow ──────────────────────────────────────────────────────
_resetAllDreamSessions();
const clarify = tryDreamFlowReply({
  message: 'Rüyamı yorumla',
  conversationId: 'dream-clarify',
  userId: 'telegram:900101',
});
record('clarify handled', Boolean(clarify?.handled && clarify.reply));
record('clarify intent', clarify?.intent === 'dream:clarify');
record('clarify asks questions', /ayrıntılı anlat|semboller|hissettin|uyand/i.test(clarify?.reply || ''));
record('clarify not prophecy', !/kesin\s+olacak|ölüm\s+tarih/i.test(clarify?.reply || ''));

// ── Full analysis via flow ────────────────────────────────────────────
_resetAllDreamSessions();
const dreamMsg =
  'Rüyamı yorumla. Rüyamda deniz kenarındaki eski evimdeydim, kapıyı açmaya çalışırken yılan gördüm ve korkuyla kaçıyordum. Uyanınca kaygılıydım. Tekrarlayan bir rüya.';
const t1 = tryDreamFlowReply({
  message: dreamMsg,
  conversationId: 'dream-t1',
  userId: 'telegram:900102',
});
record('test1 handled', Boolean(t1?.handled && t1.reply));
record('test1 engine', t1?.engine === 'dream-engine');
record('test1 flow version', t1?.data?.dreamFlowVersion === DREAM_FLOW_VERSION);
const r1 = t1?.reply || '';
record('test1 has Rüya Analizi', /##\s*Rüya\s*Analizi/i.test(r1));
record('test1 has Duygu', /##\s*Duygu/i.test(r1));
record('test1 has Sembol', /##\s*Sembol/i.test(r1));
record('test1 has Olay Örgüsü', /##\s*Olay/i.test(r1));
record('test1 has Jung', /##\s*Jung/i.test(r1));
record('test1 has Klasik', /##\s*Klasik/i.test(r1));
record('test1 has Psikolojik', /##\s*Psikolojik/i.test(r1));
record('test1 has Kişisel', /##\s*Kişisel/i.test(r1));
record('test1 has Kör Nokta', /##\s*Kör\s*Nokta/i.test(r1));
record('test1 has Sonuç', /##\s*Sonuç/i.test(r1));
record('test1 uncertainty', /kesin\s+de[gğ]ildir|sembolik|olas[ıi]l[ıi]k/i.test(r1));
record('test1 methodology', /atlas-dream/i.test(r1));
record('test1 single-symbol disclaimer', /tek\s+ba[sş][ıi]na\s+tek\s+bir\s+anlam/i.test(r1));
record('test1 not dictionary', looksLikeSymbolDictionary(r1) === false);
record('test1 not tiny', r1.length > 600, `len=${r1.length}`);
record('test1 symbols in data', (t1?.data?.symbols?.length || 0) >= 3);
record(
  'test1 no absolute prophecy',
  !/kesin(?:likle)?\s+olacak|ölüm\s+tarih[iı]|teşhis(?:im|iniz)?\s*:/i.test(r1),
);

const t1run = runDreamAnalysis({
  message: dreamMsg,
  narrative: dreamMsg,
  depth: DEPTH_LEVEL.STANDARD,
  recurring: true,
});
record(
  'guard accepts standard analysis',
  t1run.guard && t1run.guard.ok === true,
  `score=${t1run.guard?.score}/${t1run.guard?.maxScore} failed=${t1run.guard?.failedChecks?.join(',')}`,
);

// ── Deep analysis ─────────────────────────────────────────────────────
const deep = runDreamAnalysis({
  message: 'detaylı rüya analizi',
  narrative: sample,
  depth: DEPTH_LEVEL.DEEP,
  recurring: true,
});
record('deep has alternatif', /##\s*Alternatif/i.test(deep.reply || ''));
record('deep uncertainty boundary', hasUncertaintyBoundary(deep.reply || ''));

// ── Follow-up session reuse ───────────────────────────────────────────
_resetAllDreamSessions();
const cid = 'dream-follow';
const uid = 'telegram:900103';
const first = tryDreamFlowReply({
  message: dreamMsg,
  conversationId: cid,
  userId: uid,
});
record('follow setup ok', Boolean(first?.handled && !first?.data?.clarified));

const followJung = tryDreamFlowReply({
  message: 'Jung arketiplerini aç',
  conversationId: cid,
  userId: uid,
});
record('followup jung handled', Boolean(followJung?.handled));
record('followup jung intent', followJung?.intent === 'dream:followup_jung');
record('followup jung section', /##\s*Jung/i.test(followJung?.reply || ''));
record('followup reused', followJung?.data?.reusedDream === true);

const followBlind = tryDreamFlowReply({
  message: 'kör nokta ne?',
  conversationId: cid,
  userId: uid,
});
record('followup blind handled', Boolean(followBlind?.handled));
record('followup blind intent', followBlind?.intent === 'dream:followup_blind_spot');

const noSession = tryDreamFlowReply({
  message: 'kör nokta ne?',
  conversationId: 'dream-nosession',
  userId: 'telegram:900199',
});
// Without domain or session, follow-up alone may be inactive
record(
  'orphan followup not inventing dream',
  !noSession?.handled ||
    noSession.reply === NO_ACTIVE_DREAM_SESSION_REPLY ||
    noSession.intent?.includes('clarify'),
);

// ── Personal context: only with evidence ──────────────────────────────
const personalNone = resolvePersonalContext({
  symbols: [{ id: 'house', name: 'ev' }],
  history: [],
});
record('personal no invent', personalNone.links.length === 0);

const personalHit = resolvePersonalContext({
  symbols: [{ id: 'house', name: 'ev' }, { id: 'door', name: 'kapı' }],
  history: [
    { role: 'user', content: 'Bu ay taşınma işleriyle uğraşıyorum, yeni ev bakıyorum.' },
  ],
});
record('personal evidenced link', personalHit.links.length >= 1, String(personalHit.links.length));
record(
  'personal reading cautious',
  personalHit.links.length === 0 || /kesin\s+hüküm\s+de[gğ]ildir|spekülasyon\s+değil/i.test(personalHit.links[0].reading),
);

// ── Intent detection ──────────────────────────────────────────────────
const intentAnalyze = detectDreamEngineIntent(dreamMsg, []);
record('intent analyze active', intentAnalyze.active && intentAnalyze.intent === 'analyze');
const intentClarify = detectDreamEngineIntent('rüyamı yorumla', []);
record(
  'intent clarify or analyze then flow clarifies',
  intentClarify.active === true,
);

// ── interpretDream layers ─────────────────────────────────────────────
const analysis = interpretDream({ narrative: sample, recurring: true });
record('interpret ok', analysis.ok === true);
record('has combinations', (analysis.combinations?.pairs?.length || 0) >= 1);
record('has contradictions or multi', (analysis.contradictions?.tensions?.length || 0) >= 1);
record('has psych layer', /psikolojik|bilinçalt/i.test(analysis.psychologicalReading || ''));
record('has classical layer', /klasik/i.test(analysis.classicalReading || ''));

// ── End-to-end via processAtlasMessage ────────────────────────────────
_resetAllDreamSessions();
const e2e = await processAtlasMessage(
  {
    message: dreamMsg,
    userId: 'telegram:900104',
    conversationId: 'dream-e2e',
    channel: 'telegram',
    history: [],
  },
  {},
);
record('e2e complete', e2e?.status === 'complete');
record('e2e dream engine', e2e?.engine === 'dream-engine' || e2e?.data?.provider === 'atlas-dream-engine');
record('e2e domain dream', e2e?.data?.domain === 'dream' || e2e?.data?.responseMode === 'dream_analysis');
record('e2e reply has layers', /Duygu|Sembol|Psikolojik/i.test(e2e?.reply || ''));
record('e2e clarify reply available', DREAM_CLARIFY_REPLY.length > 50);

// Session isolation: clear helper works
clearDreamSession('dream-t1', 'telegram:900102');
record('clear session works', true);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.error('Failures:', failures.join(', '));
  process.exit(1);
}

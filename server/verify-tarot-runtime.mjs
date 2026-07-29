/**
 * Tarot protocol runtime verification — real Atlas chat pipeline.
 * Run: node server/verify-tarot-runtime.mjs
 */
import 'dotenv/config';
import {
  buildAtlasSystemPrompt,
  PROMPT_PROFILE_MODULES,
} from './atlas-prompt-loader.js';
import {
  detectAnalysisMode,
  detectTarotSpreadIntent,
  hasTarotContext,
  buildChatUserPrompt,
} from './symbolic-synthesis.js';
import { buildAtlasChatRequest, generateAtlasChatResponse } from './atlas-chat-service.js';
import { loadCoreEnginePrompt } from '../runner/agent-loader.js';

const results = [];
let history = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(name, condition, detail = '') {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

/** Extract likely tarot card names from Turkish Classic Tarot style text */
function extractCardNames(text) {
  const cards = new Set();
  const patterns = [
    /\d+\.\s*([^\n—\-:,]+?)(?:\s*[—\-–:]|$)/g,
    /(?:^|\n)\*\*([^*]+)\*\*/g,
    /(?:Kupa|Kılıç|Değnek|Tılsım|Tılsımlar)\s+(?:As|İki|Iki|Üç|Uc|Dört|Dort|Beş|Bes|Altı|Alti|Yedi|Sekiz|Dokuz|On|Vale|Şövalye|Sovalye|Kraliçe|Kralice|Kral|Ası)?/gi,
    /(?:Ermiş|Azize|Büyücü|Buyucu|İmparator|Imparator|İmparatoriçe|Imparatorice|Güneş|Gunes|Ay|Yıldız|Yildiz|Kule|Dünya|Dunya|Adalet|Asılan Adam|Ölüm|Olum|Şeytan|Seytan|Dengesizlik|Dengesiz|Deli|Aşıklar|Asiklar|Güç|Guc|Arabalar|Mahkeme)\b/gi,
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(text)) !== null) {
      const name = (m[1] ?? m[0]).trim();
      if (name.length > 2 && name.length < 60) cards.add(name);
    }
  }
  return [...cards];
}

function cardsOverlap(a, b) {
  if (!a.length || !b.length) return false;
  const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return a.some((x) => b.some((y) => norm(x).includes(norm(y)) || norm(y).includes(norm(x))));
}

function simulateTelegramPayload(message) {
  return { message };
}

function simulateWebPayload(message, hist) {
  return { message, history: hist };
}

// ── Static / prompt assembly tests ──
console.log('\n=== Prompt & detection tests ===\n');

assert(
  'shorts profile has no tarot modules',
  PROMPT_PROFILE_MODULES.shorts.length === 0,
  `modules=${PROMPT_PROFILE_MODULES.shorts.length}`,
);

assert(
  'generic profile has no tarot modules',
  PROMPT_PROFILE_MODULES.generic.length === 0,
);

const shortsPrompt = buildAtlasSystemPrompt({ profile: 'shorts' });
assert('shorts system prompt is empty', shortsPrompt === '', `len=${shortsPrompt.length}`);

const genericPrompt = buildAtlasSystemPrompt({ profile: 'generic' });
assert('generic system prompt is empty', genericPrompt === '');

const convPrompt = buildAtlasSystemPrompt({ profile: 'conversational', mode: 'conversational' });
assert(
  'conversational excludes always-on tarot module',
  !convPrompt.includes('Tarot Eylem ve Sembolik Açılım'),
);
assert('conversational excludes meta synthesis motor section', !convPrompt.includes('Meta Sentez ve Sembolik Analiz Motoru'));

const convTarotPrompt = buildAtlasSystemPrompt({
  profile: 'conversational',
  mode: 'conversational',
  tarotIntent: { active: true, intent: 'spread' },
});
assert(
  'conversational loads tarot module when intent active',
  convTarotPrompt.includes('Tarot Eylem ve Sembolik Açılım'),
);

const metaPrompt = buildAtlasSystemPrompt({ profile: 'meta-synthesis', mode: 'meta-synthesis' });
assert('meta-synthesis includes meta synthesis', metaPrompt.includes('Meta Sentez'));
assert(
  'meta-synthesis excludes always-on tarot module',
  !metaPrompt.includes('Tarot Eylem ve Sembolik Açılım'),
);

const metaTarotPrompt = buildAtlasSystemPrompt({
  profile: 'meta-synthesis',
  mode: 'meta-synthesis',
  tarotIntent: { active: true, intent: 'spread' },
});
assert(
  'meta-synthesis loads tarot module when intent active',
  metaTarotPrompt.includes('Tarot Eylem ve Sembolik Açılım'),
);
const coreEngine = loadCoreEnginePrompt();
assert('core-engine prompt includes meta synthesis', coreEngine.includes('Meta Synthesis Engine'));
assert('core-engine unchanged tarot cross-ref', coreEngine.includes('tarot') || coreEngine.includes('Tarot'));

const unrelatedAc = detectTarotSpreadIntent('Aç.', []);
assert('unrelated "Aç." does not trigger tarot', !unrelatedAc.active, JSON.stringify(unrelatedAc));

const unrelatedBak = detectTarotSpreadIntent('bak', []);
assert('unrelated "bak" does not trigger tarot', !unrelatedBak.active);

const unrelatedYorumla = detectTarotSpreadIntent('Yorumla.', []);
assert('unrelated "Yorumla." does not trigger tarot', !unrelatedYorumla.active);

// Short commands WITH context
const ctxHistory = [
  { role: 'user', content: 'Aklımdaki kişinin duygularına üç kart aç.' },
  { role: 'assistant', content: "Classic Tarot'tan sembolik olarak üç kart seçiyorum:\n1. Kupa Şövalyesi\n2. İki Kılıç\n3. Ermiş" },
];
for (const cmd of ['aç', 'bak', 'çek', 'yorumla', 'hangi kartlar?']) {
  const intent = detectTarotSpreadIntent(cmd, ctxHistory);
  assert(`short command "${cmd}" uses tarot context`, intent.active, JSON.stringify(intent));
}

assert('hasTarotContext detects spread history', hasTarotContext(ctxHistory));

// Mode for first message
const msg1 = 'Aklımdaki kişinin duygularına üç kart aç.';
const mode1 = detectAnalysisMode(msg1);
assert('first message stays conversational (not meta-synthesis)', mode1 === 'conversational', mode1);

const req1 = buildAtlasChatRequest({ message: msg1, history: [] });
assert('first message tarot spread intent', req1.tarotIntent.active && req1.tarotIntent.intent === 'spread');
assert('first message tarot runtime directive', req1.systemPrompt.includes('Aktif Mod: Tarot Açılımı'));
assert('first message user task mentions spread', req1.userPrompt.includes('Classic Tarot'));

const req2 = buildAtlasChatRequest({ message: 'Hangi kartlar?', history: ctxHistory });
assert('"Hangi kartlar?" intent reveal-cards', req2.tarotIntent.intent === 'reveal-cards');
assert('"Hangi kartlar?" no new draw instruction', req2.userPrompt.includes('listele') && !req2.userPrompt.includes('yeni kart seç'));

const req3 = buildAtlasChatRequest({ message: 'Yorumla.', history: ctxHistory });
assert('"Yorumla." intent interpret', req3.tarotIntent.intent === 'interpret');
assert('"Yorumla." preserves cards instruction', req3.userPrompt.includes('yeni kart seçme'));

const req4 = buildAtlasChatRequest({ message: 'Bir de eylemine bak.', history: ctxHistory });
assert('"Bir de eylemine bak." intent continue', req4.tarotIntent.intent === 'continue');
assert('"Bir de eylemine bak." context continuation task', req4.userPrompt.includes('Önceki tarot bağlamını'));

// Telegram parity: with per-chat history, follow-ups behave like web chat
function simulateTelegramWithHistory(message, hist) {
  return { message, history: hist };
}

const tgFollowUp = buildAtlasChatRequest(simulateTelegramWithHistory('Hangi kartlar?', ctxHistory));
assert(
  'Telegram with history matches web tarot follow-up',
  tgFollowUp.tarotIntent.intent === 'reveal-cards' && tgFollowUp.userPrompt.includes('Önceki Konuşma'),
);

const tgPayloadNoHistory = simulateTelegramPayload('Hangi kartlar?');
const tgReqNoHist = buildAtlasChatRequest(tgPayloadNoHistory);
assert(
  '"Hangi kartlar?" without history still activates tarot reveal',
  tgReqNoHist.tarotIntent.intent === 'reveal-cards',
  'explicit card query is always tarot-scoped',
);

// ── Live API conversation flow ──
console.log('\n=== Live pipeline conversation flow ===\n');

const hasApiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
let liveCards = [];
let stepCards = {};

if (!hasApiKey) {
  fail('live API conversation flow', 'OPENAI_API_KEY not set — skipping live model calls');
} else {
  history = [];
  const steps = [
    'Aklımdaki kişinin duygularına üç kart aç.',
    'Hangi kartlar?',
    'Yorumla.',
    'Bir de eylemine bak.',
  ];

  try {
    for (let i = 0; i < steps.length; i++) {
      const message = steps[i];
      console.log(`\n--- Step ${i + 1}: ${message} ---`);
      const result = await generateAtlasChatResponse({
        message,
        history,
        temperature: 0.7,
        maxTokens: 1200,
      });

      console.log(`mode=${result.mode} profile=${result.profile} tarotIntent=${result.tarotIntent}`);
      console.log(result.reply.slice(0, 400) + (result.reply.length > 400 ? '...' : ''));

      const cards = extractCardNames(result.reply);
      stepCards[i + 1] = cards;

      if (i === 0) {
        assert('live step1 creates spread', result.tarotIntent === 'spread');
        assert('live step1 returns card names', cards.length >= 2, `found=${cards.length}: ${cards.join(', ')}`);
        assert('live step1 mentions Classic Tarot or kart', /classic tarot|kart/i.test(result.reply));
        liveCards = cards;
      }
      if (i === 1) {
        assert('live step2 reveal-cards intent', result.tarotIntent === 'reveal-cards');
        assert('live step2 same cards as step1', cardsOverlap(cards, liveCards), `step1=[${liveCards}] step2=[${cards}]`);
      }
      if (i === 2) {
        assert('live step3 interpret intent', result.tarotIntent === 'interpret');
        assert('live step3 references same cards', cardsOverlap(extractCardNames(result.reply), liveCards) || liveCards.some((c) => result.reply.toLowerCase().includes(c.toLowerCase().slice(0, 4))), 'interpretation should reference prior cards');
      }
      if (i === 3) {
        assert('live step4 continue intent', result.tarotIntent === 'continue');
        assert('live step4 action spread (new cards possible)', /eylem|davran|classic tarot|kart/i.test(result.reply));
        assert('live step4 preserves person context', /kişi|duygu|aklımdaki|yaklaş|mesafe/i.test(result.reply));
      }

      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: result.reply });
    }
  } catch (err) {
    fail('live API conversation flow', err.message);
  }
}

// Summary
console.log('\n=== Summary ===\n');
const failed = results.filter((r) => !r.ok);
console.log(`Total: ${results.length} | Passed: ${results.length - failed.length} | Failed: ${failed.length}`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
process.exit(0);

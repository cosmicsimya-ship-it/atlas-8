/**
 * Tarot runtime verification — detection + engine-first message pipeline.
 * LLM tarot dictionary dumps are no longer a runtime path.
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
} from './symbolic-synthesis.js';
import { buildAtlasChatRequest } from './atlas-chat-service.js';
import { loadCoreEnginePrompt } from '../runner/agent-loader.js';
import { processAtlasMessage } from './atlas-message-service.js';
import { NO_ACTIVE_TAROT_SPREAD_REPLY } from './tarot-flow.js';
import { _resetAllTarotSessions } from './tarot-engine/index.js';

const results = [];

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

function cardIds(result) {
  return (result?.data?.cards || []).map((c) => c.id);
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

// Prompt loader can still assemble tarot modules for offline prompt tests,
// but the live message pipeline must never invoke LLM tarot dumps.
const convTarotPrompt = buildAtlasSystemPrompt({
  profile: 'conversational',
  mode: 'conversational',
  tarotIntent: { active: true, intent: 'spread' },
});
assert(
  'prompt loader can attach tarot module when explicitly requested',
  convTarotPrompt.includes('Tarot Eylem ve Sembolik Açılım'),
);

const coreEngine = loadCoreEnginePrompt();
assert('core-engine prompt includes meta synthesis', coreEngine.includes('Meta Synthesis Engine'));

const unrelatedAc = detectTarotSpreadIntent('Aç.', []);
assert('unrelated "Aç." does not trigger tarot', !unrelatedAc.active, JSON.stringify(unrelatedAc));

const unrelatedYorumla = detectTarotSpreadIntent('Yorumla.', []);
assert('unrelated "Yorumla." does not trigger tarot', !unrelatedYorumla.active);

const ctxHistory = [
  { role: 'user', content: 'Aklımdaki kişinin duygularına üç kart aç.' },
  {
    role: 'assistant',
    content:
      "Bu dinamikte ilk dikkat çeken enerji Kupa Şövalyesi'nde.\n1. Kupa Şövalyesi\n2. İki Kılıç\n3. Ermiş",
  },
];
assert('hasTarotContext detects spread history', hasTarotContext(ctxHistory));

const msg1 = 'Aklımdaki kişinin duygularına üç kart aç.';
const mode1 = detectAnalysisMode(msg1);
assert('first message stays conversational (not meta-synthesis)', mode1 === 'conversational', mode1);

const req1 = buildAtlasChatRequest({ message: msg1, history: [] });
assert('first message tarot spread intent', req1.tarotIntent.active && req1.tarotIntent.intent === 'spread');

// ── Engine-first message pipeline (no LLM tarot dump) ──
console.log('\n=== Engine-first pipeline ===\n');

_resetAllTarotSessions();
const step1 = await processAtlasMessage(
  {
    channel: 'web',
    userId: 'web:verify-tarot',
    conversationId: 'web:verify-tarot',
    message: msg1,
    history: [],
  },
  { trustedUserId: 'web:verify-tarot', roles: ['user'] },
);
assert('pipeline step1 engine is tarot-engine', step1.engine === 'tarot-engine', `engine=${step1.engine}`);
assert('pipeline step1 deterministic', step1.data?.model === 'deterministic');
assert('pipeline step1 has 3 cards', (step1.data?.cards || []).length === 3);
const liveIds = cardIds(step1);

let history = [
  { role: 'user', content: msg1 },
  { role: 'assistant', content: step1.reply },
];

const step2 = await processAtlasMessage(
  {
    channel: 'web',
    userId: 'web:verify-tarot',
    conversationId: 'web:verify-tarot',
    message: 'Hangi kartlar?',
    history,
  },
  { trustedUserId: 'web:verify-tarot', roles: ['user'] },
);
assert('pipeline reveal reuses cards', step2.data?.reusedCards === true);
assert(
  'pipeline reveal same ids',
  liveIds.every((id, i) => cardIds(step2)[i] === id),
);

history = [
  ...history,
  { role: 'user', content: 'Hangi kartlar?' },
  { role: 'assistant', content: step2.reply },
];

const step3 = await processAtlasMessage(
  {
    channel: 'web',
    userId: 'web:verify-tarot',
    conversationId: 'web:verify-tarot',
    message: 'Yorumla.',
    history,
  },
  { trustedUserId: 'web:verify-tarot', roles: ['user'] },
);
assert('pipeline interpret reuses cards', step3.data?.reusedCards === true);
assert(
  'pipeline interpret same ids',
  liveIds.every((id, i) => cardIds(step3)[i] === id),
);

history = [
  ...history,
  { role: 'user', content: 'Yorumla.' },
  { role: 'assistant', content: step3.reply },
];

const step4 = await processAtlasMessage(
  {
    channel: 'web',
    userId: 'web:verify-tarot',
    conversationId: 'web:verify-tarot',
    message: 'Bir de eylemine bak.',
    history,
  },
  { trustedUserId: 'web:verify-tarot', roles: ['user'] },
);
assert('pipeline continue new draw', step4.data?.reusedCards === false);
assert('pipeline continue action kind', step4.data?.spreadKind === 'action');
assert(
  'pipeline continue preserves intention',
  step4.data?.intention === step1.data?.intention,
  `s1=${step1.data?.intention} s4=${step4.data?.intention}`,
);

// History alone without session → no invent
_resetAllTarotSessions();
const orphan = await processAtlasMessage(
  {
    channel: 'web',
    userId: 'web:orphan',
    conversationId: 'web:orphan',
    message: 'Yorumla.',
    history: ctxHistory,
  },
  { trustedUserId: 'web:orphan', roles: ['user'] },
);
assert('orphan interpret missing session', orphan.data?.missingSession === true);
assert('orphan uses no-active reply', orphan.reply === NO_ACTIVE_TAROT_SPREAD_REPLY);
assert('orphan drew no cards', orphan.data?.drewCards === false);

// Image + tarot → engine-first, never LLM dump
_resetAllTarotSessions();
const tinyPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const img = await processAtlasMessage(
  {
    channel: 'telegram',
    userId: 'telegram:verify-img',
    conversationId: 'telegram:verify-img',
    message: 'Aklımdaki kişinin duygularına üç kart aç.',
    history: [],
    image: { mimeType: 'image/png', base64: tinyPng },
  },
  { trustedUserId: 'telegram:verify-img', roles: ['user'], atlasBotVerified: true },
);
assert('image+tarot not llm', img.data?.model === 'deterministic' && img.data?.tokensUsed === 0);
assert(
  'image+tarot engine path',
  img.engine === 'tarot-engine' &&
    ((img.data?.cards || []).length === 3 || img.data?.tarotFallback),
);

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

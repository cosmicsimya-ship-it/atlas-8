/**
 * Founder Identity consistency verification.
 * Run: node server/verify-founder-identity.mjs
 */
import { buildAtlasPromptBundle } from './atlas-message-service.js';
import { processAtlasMessage } from './atlas-message-service.js';
import { initializeFounderKnowledge } from './founder-knowledge.js';
import {
  resolveFounderSession,
  FOUNDER_FORBIDDEN_DENIALS,
  detectFounderIdentityQuestion,
  formatFounderAwareMemoryRecall,
  PIPELINE_VERSION,
} from './founder-identity.js';
import { processMemoryIntent, detectMemoryIntent } from './memory-intents.js';
import { telegramUserId, webUserId, resetMemoryStoreForTests } from './user-memory.js';

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

const prevEnv = {
  telegram: process.env.ATLAS_FOUNDER_TELEGRAM_IDS,
  web: process.env.ATLAS_FOUNDER_WEB_USER_IDS,
  combined: process.env.ATLAS_FOUNDER_USER_IDS,
};

process.env.ATLAS_FOUNDER_TELEGRAM_IDS = '777001';
process.env.ATLAS_FOUNDER_WEB_USER_IDS = 'lara-web-session';
process.env.ATLAS_FOUNDER_USER_IDS = '';
initializeFounderKnowledge();

const founderWebId = webUserId('lara-web-session');
const founderTgId = telegramUserId(777001);
const regularWebId = webUserId('regular-user-xyz');
const regularTgId = telegramUserId(111999);

await resetMemoryStoreForTests({ users: {} });

console.log('\n=== Founder resolution ===\n');

assert('web founder resolved', resolveFounderSession(founderWebId)?.knowledge.id === 'founder-primary');
assert('telegram founder resolved', resolveFounderSession(founderTgId)?.knowledge.id === 'founder-primary');
assert('regular web not founder', resolveFounderSession(regularWebId) === null);
assert('regular telegram not founder', resolveFounderSession(regularTgId) === null);

console.log('\n=== Prompt structure & order ===\n');

function buildForChannel(channel, userId, message) {
  return buildAtlasPromptBundle({
    channel,
    userId,
    conversationId: channel === 'web' ? userId : '999',
    message,
    history: [],
  });
}

const whoAmIWeb = buildForChannel('web', founderWebId, 'Ben kimim?');
const whoAmITg = buildForChannel('telegram', founderTgId, 'Ben kimim?');

assert('web Ben kimim — founder identity block', whoAmIWeb.userPrompt.includes('## Founder Identity'));
assert('telegram Ben kimim — founder identity block', whoAmITg.userPrompt.includes('## Founder Identity'));
assert('web includes Lara as founder', whoAmIWeb.userPrompt.includes('Lara'));
assert('telegram includes Lara as founder', whoAmITg.userPrompt.includes('Lara'));
assert('web/telegram user prompt parity', whoAmIWeb.userPrompt === whoAmITg.userPrompt);
assert('web/telegram system prompt parity', whoAmIWeb.systemPrompt === whoAmITg.systemPrompt);

assert(
  'Ben kimim — system prompt includes FOUNDER SYSTEM CONTEXT',
  whoAmIWeb.systemPrompt.includes('FOUNDER SYSTEM CONTEXT') &&
    whoAmIWeb.systemPrompt.includes('knowledge/founders.json'),
);
assert('Ben kimim — system prompt includes Lara from founders.json', whoAmIWeb.systemPrompt.includes('Lara'));
assert(
  'Ben kimim — system prompt includes mission from founders.json',
  whoAmIWeb.systemPrompt.includes('güvenilir bir zekâ katmanı'),
);
assert(
  'Ben kimim — system prompt includes identity question rule',
  whoAmIWeb.systemPrompt.includes('Ben kimim?'),
);
assert(
  'Ben kimim — user prompt includes founder identity block',
  whoAmIWeb.userPrompt.includes('## Founder Identity') && whoAmIWeb.userPrompt.includes('Lara'),
);
assert(
  'Ben kimim — user prompt includes minimum truth rule',
  whoAmIWeb.userPrompt.includes('Minimum Doğruluk Kuralı'),
);

const diffWeb = buildForChannel('web', founderWebId, 'Benimle normal kullanıcı arasındaki fark nedir?');
const diffTg = buildForChannel('telegram', founderTgId, 'Benimle normal kullanıcı arasındaki fark nedir?');

assert('difference question — minimum truth rule', diffWeb.userPrompt.includes('Minimum Doğruluk Kuralı'));
assert('difference question mentions Founder Profile', diffWeb.userPrompt.includes('Founder Profile'));
assert('difference web/telegram parity', diffWeb.userPrompt === diffTg.userPrompt);

const sourceWeb = buildForChannel('web', founderWebId, 'Bu bilgiyi nereden biliyorsun?');
const sourceTg = buildForChannel('telegram', founderTgId, 'Bu bilgiyi nereden biliyorsun?');

assert('source question — knowledge files cited', sourceWeb.userPrompt.includes('founder-profile.json'));
assert('source web/telegram parity', sourceWeb.userPrompt === sourceTg.userPrompt);

const webPromptOrder = whoAmIWeb.userPrompt.indexOf('## Founder Identity');
const profileOrder = whoAmIWeb.userPrompt.indexOf('## Founder Profile & Founder Knowledge');
const memoryOrder = whoAmIWeb.userPrompt.indexOf('## Kişisel Profil Hafızası');
assert('prompt order: identity before profile/knowledge', webPromptOrder >= 0 && profileOrder > webPromptOrder);
assert('forbidden denials listed in prompt', FOUNDER_FORBIDDEN_DENIALS.every((p) => whoAmIWeb.userPrompt.includes(p)));

const regularBundle = buildForChannel('web', regularWebId, 'Ben kimim?');
assert('regular user — no founder identity block', !regularBundle.userPrompt.includes('## Founder Identity (Doğrulanmış'));
assert('regular user — no founder knowledge layer in system', !regularBundle.systemPrompt.includes('Kurucu Oturumu Aktif'));

console.log('\n=== Memory recall (founder) ===\n');

const recallIntent = detectMemoryIntent('Benim hakkımda ne biliyorsun?');
const recallResult = await processMemoryIntent(founderWebId, 'Benim hakkımda ne biliyorsun?', recallIntent, {
  founderSession: resolveFounderSession(founderWebId),
});

assert('founder recall — not empty profile denial', !recallResult.reply.includes('Hafızamda kayıtlı kişisel bilgin yok'));
assert('founder recall — states founder', recallResult.reply.includes('Lara') && recallResult.reply.includes('kurucu'));
assert(
  'founder recall web vs telegram same logic',
  formatFounderAwareMemoryRecall(founderWebId, resolveFounderSession(founderWebId)) ===
    formatFounderAwareMemoryRecall(founderTgId, resolveFounderSession(founderTgId)),
);

console.log('\n=== Pipeline integration ===\n');

const pipelineWeb = await processAtlasMessage({
  channel: 'web',
  userId: founderWebId,
  conversationId: founderWebId,
  message: 'Ben kimim?',
  history: [],
});

const pipelineTg = await processAtlasMessage({
  channel: 'telegram',
  userId: founderTgId,
  conversationId: '888',
  message: 'Ben kimim?',
  history: [],
});

assert('pipeline web founderSession flag', pipelineWeb.data?.founderSession === true);
assert('pipeline tg founderSession flag', pipelineTg.data?.founderSession === true);
assert('pipeline debug founderResolved', pipelineWeb.data?.pipelineDebug?.founderResolved === true);
assert('pipeline version set', pipelineWeb.data?.pipelineVersion === PIPELINE_VERSION);
assert('identity question detected', detectFounderIdentityQuestion('Ben kimim?'));

const regularPipeline = await processAtlasMessage({
  channel: 'web',
  userId: regularWebId,
  conversationId: regularWebId,
  message: 'Ben kimim?',
  history: [],
});

assert('regular pipeline — not founder', regularPipeline.data?.founderSession !== true);
assert('regular pipeline — founderResolved false', regularPipeline.data?.pipelineDebug?.founderResolved === false);

process.env.ATLAS_FOUNDER_TELEGRAM_IDS = prevEnv.telegram ?? '';
process.env.ATLAS_FOUNDER_WEB_USER_IDS = prevEnv.web ?? '';
process.env.ATLAS_FOUNDER_USER_IDS = prevEnv.combined ?? '';
initializeFounderKnowledge();

console.log('\n=== Summary ===\n');
const failed = results.filter((r) => !r.ok);
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
console.log('\nAll founder identity tests passed.\n');

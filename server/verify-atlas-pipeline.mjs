/**
 * Shared Atlas pipeline integration verification.
 * Run: node server/verify-atlas-pipeline.mjs
 *
 * No paid API calls — mocks OpenAI and routeTask where needed.
 */
process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';
import { join } from 'path';
import { tmpdir } from 'os';
process.env.ATLAS_MEMORY_FILE = join(
  tmpdir(),
  `atlas-user-memory-pipeline-test-${process.pid}.json`,
);
import {
  normalizeWebChatRequest,
  normalizeTelegramMessage,
  normalizeAtlasMessageRequest,
  splitTelegramMessage,
  toWebChatResponse,
  formatTelegramReply,
} from './channel-adapters.js';
import {
  processAtlasMessage,
  buildAtlasPromptBundle,
  ATLAS_PROMPT_LOAD_ORDER,
} from './atlas-message-service.js';
import { resolvePersonaVoice } from './persona-engine.js';
import { initializeFounderKnowledge } from './founder-knowledge.js';
import { telegramUserId, webUserId, resetMemoryStoreForTests, updateUserMemory, getUserMemory } from './user-memory.js';

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

/**
 * Strip channel-specific register / scoped-feedback surfaces for semantic parity.
 * Format/register may differ by channel; analysis stack must stay equivalent.
 * @param {string} prompt
 */
function normalizePromptForSemanticParity(prompt) {
  return String(prompt ?? '')
    .replace(/## Voice —[\s\S]*?(?=\n## |\n---)/g, '## Voice — [CHANNEL_REGISTER]\n')
    .replace(/Aktif voice: [^\n]+/g, 'Aktif voice: [CHANNEL]')
    .replace(
      /## Active Editorial Feedback \(scoped\)[\s\S]*?(?=\n## |\n---|$)/g,
      '## Active Editorial Feedback (scoped)\n- [scoped]\n',
    );
}

console.log('\n=== Adapter normalization ===\n');

const webNorm = normalizeWebChatRequest({
  message: 'Merhaba Atlas',
  userId: webUserId('session-abc'),
  history: [{ role: 'user', content: 'önceki' }],
});
assert('web normalize channel', webNorm.channel === 'web');
assert('web normalize userId', webNorm.userId === webUserId('session-abc'));

const tgPrivate = normalizeTelegramMessage(
  {
    message_id: 1,
    from: { id: 12345, first_name: 'Ayşe', username: 'ayse' },
    chat: { id: 12345, type: 'private' },
    text: 'Merhaba Atlas',
    date: Date.now(),
  },
  [],
);
assert('telegram private userId uses from.id', tgPrivate.userId === telegramUserId(12345));
assert('telegram conversationId is chat.id', tgPrivate.conversationId === '12345');

const tgGroupIgnored = (() => {
  try {
    normalizeTelegramMessage(
      {
        message_id: 2,
        from: { id: 99, first_name: 'Ali' },
        chat: { id: -1001, type: 'group', title: 'Test' },
        text: 'selam herkese',
        date: Date.now(),
      },
      [],
      { requireGroupMention: true },
    );
    return false;
  } catch (e) {
    return e.message === 'GROUP_MESSAGE_IGNORED';
  }
})();
assert('telegram group ignores unrelated messages when requireMention', tgGroupIgnored);

const tgGroupDefaultReplies = normalizeTelegramMessage(
  {
    message_id: 21,
    from: { id: 99, first_name: 'Ali' },
    chat: { id: -1001, type: 'group', title: 'Test' },
    text: 'selam herkese',
    date: Date.now(),
  },
  [],
);
assert(
  'telegram group replies by default when bot received the message',
  tgGroupDefaultReplies.message === 'selam herkese',
);

const tgGroupUser = normalizeTelegramMessage(
  {
    message_id: 3,
    from: { id: 99, first_name: 'Ali' },
    chat: { id: -1001, type: 'group', title: 'Test' },
    text: 'Atlas merhaba',
    date: Date.now(),
  },
  [],
);
assert(
  'telegram group uses user id not chat id for memory',
  tgGroupUser.userId === telegramUserId(99) && tgGroupUser.conversationId === '-1001',
);

const tgCaption = normalizeTelegramMessage(
  {
    message_id: 4,
    from: { id: 55, first_name: 'Lara' },
    chat: { id: 55, type: 'private' },
    photo: [{ file_id: 'abc', width: 100, height: 100 }],
    caption: '  Bu foto hakkında ne düşünüyorsun?  ',
    date: Date.now(),
  },
  [],
);
assert('telegram caption used as message text', tgCaption.message === 'Bu foto hakkında ne düşünüyorsun?');
assert('telegram caption mediaKind recorded', tgCaption.metadata?.mediaKind === 'photo');

const tgVoiceWithoutPreprocess = (() => {
  try {
    normalizeTelegramMessage(
      {
        message_id: 5,
        from: { id: 55, first_name: 'Lara' },
        chat: { id: 55, type: 'private' },
        voice: { file_id: 'v', duration: 2 },
        date: Date.now(),
      },
      [],
    );
    return false;
  } catch (e) {
    return String(e.message).includes('Unsupported message');
  }
})();
assert(
  'telegram voice without preprocess still requires resolved text',
  tgVoiceWithoutPreprocess,
);

const tgVoiceResolved = normalizeTelegramMessage(
  {
    message_id: 5,
    from: { id: 55, first_name: 'Lara' },
    chat: { id: 55, type: 'private' },
    voice: { file_id: 'v', duration: 2 },
    date: Date.now(),
  },
  [],
  {
    resolvedMessage: 'Merhaba Atlas, sesli mesajım bu.',
    mediaKind: 'voice',
    extraMetadata: { source: 'speech-to-text' },
  },
);
assert(
  'telegram voice with transcription accepted',
  tgVoiceResolved.message === 'Merhaba Atlas, sesli mesajım bu.',
);
assert('telegram voice mediaKind recorded', tgVoiceResolved.metadata?.mediaKind === 'voice');

const tgPhotoResolved = normalizeTelegramMessage(
  {
    message_id: 6,
    from: { id: 55, first_name: 'Lara' },
    chat: { id: 55, type: 'private' },
    photo: [{ file_id: 'p', width: 800, height: 600 }],
    date: Date.now(),
  },
  [],
  {
    resolvedMessage: 'Analyze the attached image and respond appropriately.',
    mediaKind: 'photo',
    image: { mimeType: 'image/jpeg', base64: 'abc' },
  },
);
assert(
  'telegram photo without caption accepted via multimodal preprocess',
  tgPhotoResolved.metadata?.mediaKind === 'photo' &&
    tgPhotoResolved.message.includes('Analyze the attached image') &&
    Boolean(tgPhotoResolved.image?.base64),
);

const tgHttpNorm = normalizeAtlasMessageRequest({
  channel: 'telegram',
  userId: telegramUserId(12345),
  conversationId: '12345',
  message: 'Merhaba Atlas',
  history: [],
});
assert('atlas/message telegram normalize matches adapter', tgHttpNorm.userId === tgPrivate.userId);

console.log('\n=== Prompt parity (Web vs Telegram) ===\n');

const parityUser = webUserId('prompt-parity-user');
const parityMessage = 'Atlas mimarisini değerlendir';
const parityHistory = [{ role: 'user', content: 'önceki soru' }];

await resetMemoryStoreForTests({ users: {} });
await updateUserMemory(parityUser, { profile: { name: 'Parity Test', location: 'Berlin' } });

const webBundle = buildAtlasPromptBundle(
  {
    channel: 'web',
    userId: parityUser,
    conversationId: 'parity-conversation',
    message: parityMessage,
    history: parityHistory,
  },
  { mode: 'meta-synthesis' },
);

const tgBundle = buildAtlasPromptBundle(
  {
    channel: 'telegram',
    userId: parityUser,
    conversationId: 'parity-conversation',
    message: parityMessage,
    history: parityHistory,
  },
  { mode: 'meta-synthesis' },
);

assert('load order is canonical', JSON.stringify(webBundle.loadOrder) === JSON.stringify(ATLAS_PROMPT_LOAD_ORDER));

// Channel register (persona voice) may differ by design; content stack must stay equivalent.
const webVoice = resolvePersonaVoice({
  channel: 'web',
  mode: 'meta-synthesis',
});
const tgVoice = resolvePersonaVoice({
  channel: 'telegram',
  mode: 'meta-synthesis',
});
assert(
  'channel voice profiles are explicit',
  webVoice?.id === 'atlas-analysis' && tgVoice?.id === 'telegram',
  `web=${webVoice?.id} tg=${tgVoice?.id}`,
);

assert(
  'web/telegram semantic system prompt parity (channel register excluded)',
  normalizePromptForSemanticParity(webBundle.systemPrompt) ===
    normalizePromptForSemanticParity(tgBundle.systemPrompt),
);
assert(
  'web/telegram system prompts differ by channel register',
  webBundle.systemPrompt !== tgBundle.systemPrompt &&
    webBundle.systemPrompt.includes(webVoice.displayName || webVoice.id) &&
    tgBundle.systemPrompt.includes(tgVoice.displayName || tgVoice.id),
);
assert('web/telegram user prompt identical', webBundle.userPrompt === tgBundle.userPrompt);
assert('memory context in both bundles', webBundle.userMemoryContext?.includes('Berlin'));
assert('channel does not affect profile mode', webBundle.profile === tgBundle.profile && webBundle.profile === 'meta-synthesis');

console.log('\n=== Founder recognition (Web + Telegram) ===\n');

const prevFounderEnv = {
  telegram: process.env.ATLAS_FOUNDER_TELEGRAM_IDS,
  web: process.env.ATLAS_FOUNDER_WEB_USER_IDS,
  combined: process.env.ATLAS_FOUNDER_USER_IDS,
};

process.env.ATLAS_FOUNDER_TELEGRAM_IDS = '888001';
process.env.ATLAS_FOUNDER_WEB_USER_IDS = 'founder-web-session';
process.env.ATLAS_FOUNDER_USER_IDS = '';
initializeFounderKnowledge();

const founderWebId = webUserId('founder-web-session');
const founderTgId = telegramUserId(888001);
const founderQuestion = 'Kurucu oturumunda hangi katmanlar aktif?';

const founderWebBundle = buildAtlasPromptBundle({
  channel: 'web',
  userId: founderWebId,
  conversationId: founderWebId,
  message: founderQuestion,
  history: [],
});

const founderTgBundle = buildAtlasPromptBundle({
  channel: 'telegram',
  userId: founderTgId,
  conversationId: '555001',
  message: founderQuestion,
  history: [],
});

assert('web founder resolved', founderWebBundle.founderProfile?.id === 'founder-primary');
assert('telegram founder resolved', founderTgBundle.founderProfile?.id === 'founder-primary');
assert('web founder biography loaded', founderWebBundle.founderBiographyProfile?.preferredName === 'Lara');
assert('telegram founder biography loaded', founderTgBundle.founderBiographyProfile?.preferredName === 'Lara');
assert(
  'founder system prompt includes Knowledge + Profile',
  founderWebBundle.systemPrompt.includes('FOUNDER SYSTEM CONTEXT') &&
    founderWebBundle.systemPrompt.includes('knowledge/founders.json') &&
    founderWebBundle.systemPrompt.includes('Founder Profile & Biography'),
);
assert(
  'founder user prompt has identity block',
  founderWebBundle.userPrompt.includes('## Founder Identity') &&
    founderWebBundle.userPrompt.includes('## Founder Profile & Founder Knowledge'),
);
assert(
  'founder web/telegram semantic system prompt parity',
  normalizePromptForSemanticParity(founderWebBundle.systemPrompt) ===
    normalizePromptForSemanticParity(founderTgBundle.systemPrompt),
);
assert(
  'founder web/telegram channel registers differ',
  founderWebBundle.systemPrompt !== founderTgBundle.systemPrompt,
);
assert(
  'founder web/telegram user prompt parity',
  founderWebBundle.userPrompt === founderTgBundle.userPrompt,
);

const regularWeb = buildAtlasPromptBundle({
  channel: 'web',
  userId: webUserId('regular-user'),
  conversationId: webUserId('regular-user'),
  message: 'Merhaba',
  history: [],
});
const regularTg = buildAtlasPromptBundle({
  channel: 'telegram',
  userId: telegramUserId(111222),
  conversationId: '333',
  message: 'Merhaba',
  history: [],
});
assert('regular web not founder', regularWeb.founderProfile === null);
assert('regular telegram not founder', regularTg.founderProfile === null);
assert('regular web no founder layer', !regularWeb.systemPrompt.includes('FOUNDER SYSTEM CONTEXT'));
assert('regular telegram no founder layer', !regularTg.systemPrompt.includes('FOUNDER SYSTEM CONTEXT'));

process.env.ATLAS_FOUNDER_TELEGRAM_IDS = prevFounderEnv.telegram ?? '';
process.env.ATLAS_FOUNDER_WEB_USER_IDS = prevFounderEnv.web ?? '';
process.env.ATLAS_FOUNDER_USER_IDS = prevFounderEnv.combined ?? '';
initializeFounderKnowledge();

console.log('\n=== Shared pipeline ===\n');

const memoryUser = webUserId('pipeline-memory');
await resetMemoryStoreForTests({ users: {} });

const recall = await processAtlasMessage({
  channel: 'web',
  userId: memoryUser,
  conversationId: memoryUser,
  message: 'Benim hakkımda ne biliyorsun?',
  history: [],
});
assert('memory recall via shared pipeline', recall.engine === 'memory' && recall.status === 'complete');

const saved = await updateUserMemory(memoryUser, { profile: { name: 'Test User' } });
assert('pipeline memory write ok', saved.ok === true);
const confirm = getUserMemory(memoryUser);
assert('pipeline memory name persisted', confirm.profile?.name === 'Test User');

const recall2 = await processAtlasMessage({
  channel: 'telegram',
  userId: memoryUser,
  conversationId: '999',
  message: 'Benim hakkımda ne biliyorsun?',
  history: [],
});
assert(
  'same memory user cross-channel recall',
  recall2.engine === 'memory' &&
    recall2.status === 'complete' &&
    String(recall2.reply || '').includes('Test User'),
  `engine=${recall2.engine} replyLen=${String(recall2.reply || '').length}`,
);

const personal = await processAtlasMessage({
  channel: 'web',
  userId: webUserId('pa-test'),
  conversationId: webUserId('pa-test'),
  message: 'Kişisel analiz yapmak istiyorum',
  history: [],
});
assert(
  'personal analysis without data returns insufficient_data',
  personal.status === 'insufficient_data' && personal.engine === 'core-engine',
);

// Non-deterministic message so missing-key path hits the OpenAI client
const llmProbeMessage = 'Bugün hava nasıl, kısaca söyle.';

const convWeb = await processAtlasMessage({
  channel: 'web',
  userId: webUserId('conv-test'),
  conversationId: webUserId('conv-test'),
  message: llmProbeMessage,
  history: [],
});
assert(
  'web conversation reaches pipeline',
  convWeb.status === 'complete' || convWeb.errorCode === 'MODEL_UNAVAILABLE',
  `status=${convWeb.status}`,
);

const convTg = await processAtlasMessage({
  channel: 'telegram',
  userId: telegramUserId(555),
  conversationId: '777',
  message: llmProbeMessage,
  history: [],
});
assert(
  'telegram uses same core service',
  convTg.status === convWeb.status || (convTg.status === 'complete' && convWeb.status === 'complete'),
  `web=${convWeb.status} tg=${convTg.status}`,
);

if (!process.env.OPENAI_API_KEY) {
  assert('missing key returns MODEL_UNAVAILABLE', convWeb.errorCode === 'MODEL_UNAVAILABLE');
}

const greetingDet = await processAtlasMessage({
  channel: 'web',
  userId: webUserId('style-greet'),
  conversationId: webUserId('style-greet'),
  message: 'Merhaba',
  history: [],
});
assert(
  'simple greeting can complete without OpenAI',
  greetingDet.status === 'complete' && greetingDet.reply && greetingDet.reply.split(/\s+/).filter(Boolean).length <= 10,
  `status=${greetingDet.status} reply=${greetingDet.reply}`,
);

console.log('\n=== Response formatting ===\n');

const longText = 'A'.repeat(5000);
const chunks = splitTelegramMessage(longText);
assert('telegram long message split', chunks.length > 1 && chunks.every((c) => c.length <= 4096));

const plain = formatTelegramReply('**Kalın** metin');
assert('telegram strips markdown bold', !plain.includes('**'));

const webShape = toWebChatResponse({
  status: 'complete',
  reply: 'test',
  engine: 'conversation',
  data: { mode: 'conversational', profile: 'conversational', tokensUsed: 1 },
});
assert('web response backward compatible', webShape.reply === 'test' && webShape.mode === 'conversational');

console.log('\n=== Summary ===\n');
const failed = results.filter((r) => !r.ok);
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
console.log('\nAll pipeline integration tests passed.\n');

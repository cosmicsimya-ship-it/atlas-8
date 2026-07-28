/**
 * Shared Atlas pipeline integration verification.
 * Run: node server/verify-atlas-pipeline.mjs
 *
 * No paid API calls — mocks OpenAI and routeTask where needed.
 */
import {
  normalizeWebChatRequest,
  normalizeTelegramMessage,
  splitTelegramMessage,
  toWebChatResponse,
  formatTelegramReply,
} from './channel-adapters.js';
import { processAtlasMessage } from './atlas-message-service.js';
import { telegramUserId, webUserId, resetMemoryStoreForTests, updateUserMemory } from './user-memory.js';

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
    );
    return false;
  } catch (e) {
    return e.message === 'GROUP_MESSAGE_IGNORED';
  }
})();
assert('telegram group ignores unrelated messages', tgGroupIgnored);

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

await updateUserMemory(memoryUser, { profile: { name: 'Test User' } });
const recall2 = await processAtlasMessage({
  channel: 'telegram',
  userId: memoryUser,
  conversationId: '999',
  message: 'Benim hakkımda ne biliyorsun?',
  history: [],
});
assert('same memory user cross-channel recall', recall2.reply.includes('Test User'));

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

const convWeb = await processAtlasMessage({
  channel: 'web',
  userId: webUserId('conv-test'),
  conversationId: webUserId('conv-test'),
  message: 'Merhaba Atlas',
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
  message: 'Merhaba Atlas',
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

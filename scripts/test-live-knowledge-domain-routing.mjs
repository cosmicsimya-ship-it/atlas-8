// ═══════════════════════════════════════════════════════════════════════
// Test: knowledge-domain web retrieval wired into the LIVE message path
// (processAtlasMessage in server/atlas-message-service.js).
//
// End-to-end through the actual entry point both web and Telegram call —
// not a direct call to the knowledge-domains modules (those are covered by
// test-knowledge-domains.mjs / test-web-retrieval.mjs). This suite proves
// the WIRING: a real user message reaches routeKnowledgeDomainQuery() at
// the right point in the pipeline, with the right precedence, and that
// web/Telegram get equivalent routing decisions.
//
// No live network calls — options.webRetrievalFetchImpl injects a mock,
// the same dependency-injection pattern used throughout this codebase.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'assert';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { webUserId, telegramUserId } from '../server/user-memory.js';
import { createVerseStore } from '../server/quran-verse-lookup/store/index.js';

let failures = 0;
async function check(label, fn) {
  try {
    await fn();
    console.log(`  ok   - ${label}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL - ${label}`);
    console.error(`         ${err.message}`);
  }
}

function mockResponsesPayload(text, citations) {
  return {
    output: [
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text,
            annotations: citations.map((c) => ({ type: 'url_citation', url: c.url, title: c.title })),
          },
        ],
      },
    ],
  };
}

function mockWebRetrievalFetch() {
  return async () => ({
    ok: true,
    json: async () => mockResponsesPayload('Doğrulanmış, kaynaklara dayanan kısa bir özet.', [
      { url: 'https://www.britannica.com/topic/example', title: 'Britannica: Example' },
    ]),
  });
}

let counter = 0;
function nextIds(prefix) {
  counter += 1;
  return { userId: `${prefix}-${counter}`, conversationId: `${prefix}-conv-${counter}` };
}

async function callWeb(message, extraOptions = {}) {
  const { userId, conversationId } = nextIds('e2e-web');
  const uid = webUserId(userId);
  return processAtlasMessage(
    { channel: 'web', userId: uid, conversationId, message, history: [] },
    {
      trustedUserId: uid,
      mode: 'conversational',
      webRetrievalApiKey: 'test-key',
      webRetrievalFetchImpl: mockWebRetrievalFetch(),
      ...extraOptions,
    },
  );
}

async function callTelegram(message, extraOptions = {}) {
  const { userId, conversationId } = nextIds('e2e-tg');
  const uid = telegramUserId(userId);
  return processAtlasMessage(
    { channel: 'telegram', userId: uid, conversationId, message, history: [] },
    {
      trustedUserId: uid,
      mode: 'conversational',
      webRetrievalApiKey: 'test-key',
      webRetrievalFetchImpl: mockWebRetrievalFetch(),
      ...extraOptions,
    },
  );
}

console.log('[test-live-knowledge-domain-routing] the five required domain prompts (web channel)');

const DOMAIN_PROMPTS = [
  ['Anka kuşunun farklı mitolojilerdeki anlamları nelerdir?', 'mythology'],
  ['Hermetizmde zihin kavramı nedir?', 'hermeticism_alchemy'],
  ['Simyada nigredo nedir?', 'hermeticism_alchemy'],
  ['Mara hangi gelenekte?', 'comparative_religion'],
  ['Kadim kültürlerde Kuzey Yıldızı neyi temsil eder?', 'ancient_traditions'],
];

for (const [message, expectedDomain] of DOMAIN_PROMPTS) {
  await check(`"${message}" reaches live retrieval, domain=${expectedDomain}`, async () => {
    const result = await callWeb(message);
    assert.strictEqual(result.engine, 'knowledge-domain-web');
    assert.strictEqual(result.data?.knowledgeDomain, expectedDomain);
    assert.strictEqual(result.data?.resultStatus, 'success');
    assert.ok(result.reply.includes('Kaynaklar:'));
  });
}

console.log('[test-live-knowledge-domain-routing] one current factual question');

await check('"Bugün dolar kuru ne kadar?" reaches live retrieval, domain=general_web', async () => {
  const result = await callWeb('Bugün dolar kuru ne kadar?');
  assert.strictEqual(result.engine, 'knowledge-domain-web');
  assert.strictEqual(result.data?.knowledgeDomain, 'general_web');
});

console.log('[test-live-knowledge-domain-routing] casual conversation must NOT trigger retrieval');

await check('"Bugün hava nasıl?" does not reach knowledge-domain retrieval', async () => {
  const result = await callWeb('Bugün hava nasıl?');
  assert.notStrictEqual(result.engine, 'knowledge-domain-web');
});

await check('"Naber, nasılsın?" does not reach knowledge-domain retrieval', async () => {
  const result = await callWeb('Naber, nasılsın?');
  assert.notStrictEqual(result.engine, 'knowledge-domain-web');
});

console.log('[test-live-knowledge-domain-routing] the stricter Qur\'an path still wins');

await check('an explicit Qur\'an reference resolves via quran-verse-lookup, not the web-retrieval path', async () => {
  const store = createVerseStore({ forceFixture: true, nodeEnv: 'test' });
  const result = await callWeb('Bakara suresi 2:255 ayetini oku', {
    verseStore: store,
    quranRetrieveOpts: { allowTestStore: true },
  });
  assert.strictEqual(result.engine, 'quran-verse-lookup');
});

await check('a Qur\'an topic query resolves via quran-verse-lookup, not the web-retrieval path', async () => {
  const store = createVerseStore({ forceFixture: true, nodeEnv: 'test' });
  const result = await callWeb('Kur’an’da sabır hakkında ayetler', {
    verseStore: store,
    quranRetrieveOpts: { allowTestStore: true },
  });
  assert.strictEqual(result.engine, 'quran-verse-lookup');
});

console.log('[test-live-knowledge-domain-routing] web and Telegram parity at the shared pipeline level');

await check('the same domain prompt produces the same engine/domain over both channels', async () => {
  const message = 'Simyada nigredo nedir?';
  const webResult = await callWeb(message);
  const tgResult = await callTelegram(message);
  assert.strictEqual(webResult.engine, tgResult.engine);
  assert.strictEqual(webResult.data?.knowledgeDomain, tgResult.data?.knowledgeDomain);
  assert.strictEqual(webResult.engine, 'knowledge-domain-web');
});

await check('casual conversation is equally excluded on both channels', async () => {
  const message = 'Bugün hava nasıl?';
  const webResult = await callWeb(message);
  const tgResult = await callTelegram(message);
  assert.notStrictEqual(webResult.engine, 'knowledge-domain-web');
  assert.notStrictEqual(tgResult.engine, 'knowledge-domain-web');
});

console.log(
  failures === 0
    ? '\n[test-live-knowledge-domain-routing] all checks passed.'
    : `\n[test-live-knowledge-domain-routing] ${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);

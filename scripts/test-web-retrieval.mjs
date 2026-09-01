// ═══════════════════════════════════════════════════════════════════════
// Test: real web retrieval for non-Qur'an knowledge domains
// (server/knowledge-domains/{web-search-provider,web-domain-handler,registry}.js)
//
// Provider: OpenAI Responses API hosted web_search tool, via the SAME
// OPENAI_API_KEY already used everywhere in this codebase. No network
// calls are made in this suite — fetchImpl is dependency-injected with a
// mock, the same pattern already used for the Qur'an remote verse stores
// (createRemoteVerseStore({fetchImpl})).
//
// Covers the required example prompts, source ranking/attribution,
// fail-closed behavior on every kind of retrieval failure, and confirms
// this is the same Atlas Core path both web and Telegram would use.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'assert';
import {
  retrieveFromWeb,
  rankSourceQuality,
  suggestFactLayer,
  wantsFreshness,
  extractWebSearchOutput,
} from '../server/knowledge-domains/web-search-provider.js';
import { routeKnowledgeDomainQuery, DOMAIN_REGISTRY } from '../server/knowledge-domains/registry.js';

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

/** Build a mock Responses-API payload shaped like a real web_search result. */
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

function mockFetchOk(text, citations) {
  return async () => ({
    ok: true,
    json: async () => mockResponsesPayload(text, citations),
  });
}
function mockFetchHttpError(status) {
  return async () => ({ ok: false, status });
}
function mockFetchNetworkError() {
  return async () => {
    throw new Error('simulated network failure');
  };
}
function mockFetchNoCitations(text) {
  return async () => ({ ok: true, json: async () => mockResponsesPayload(text, []) });
}

console.log('[test-web-retrieval] source ranking + attribution');

await check('academic/reference domains rank high', () => {
  assert.strictEqual(rankSourceQuality('https://www.britannica.com/topic/phoenix-mythology'), 'high');
  assert.strictEqual(rankSourceQuality('https://plato.stanford.edu/entries/hermetism/'), 'high');
  assert.strictEqual(rankSourceQuality('https://someuni.edu/paper'), 'high');
});

await check('blogs/forums/social platforms rank low', () => {
  assert.strictEqual(rankSourceQuality('https://www.reddit.com/r/occult/comments/x'), 'low');
  assert.strictEqual(rankSourceQuality('https://someone.blogspot.com/2020/hermeticism'), 'low');
});

await check('wikipedia and unknown domains rank medium (neutral default)', () => {
  assert.strictEqual(rankSourceQuality('https://en.wikipedia.org/wiki/Nigredo'), 'medium');
  assert.strictEqual(rankSourceQuality('https://some-random-site.example.com/page'), 'medium');
});

await check('fact-layer suggestion follows source quality tier', () => {
  assert.strictEqual(suggestFactLayer({ url: 'https://sacred-texts.com/x', qualityTier: 'high' }), 'primary_source');
  assert.strictEqual(suggestFactLayer({ url: 'https://britannica.com/x', qualityTier: 'high' }), 'scholarly_consensus');
  assert.strictEqual(suggestFactLayer({ url: 'https://reddit.com/x', qualityTier: 'low' }), 'modern_claim');
  assert.strictEqual(suggestFactLayer({ url: 'https://en.wikipedia.org/x', qualityTier: 'medium' }), 'later_interpretation');
});

await check('sources are deduplicated and sorted best-quality-first', () => {
  const { sources } = extractWebSearchOutput(
    mockResponsesPayload('answer', [
      { url: 'https://reddit.com/a', title: 'A' },
      { url: 'https://britannica.com/b', title: 'B' },
      { url: 'https://reddit.com/a', title: 'A dup' }, // duplicate URL
    ]),
  );
  assert.strictEqual(sources.length, 2);
  assert.strictEqual(sources[0].url, 'https://britannica.com/b');
  assert.strictEqual(sources[0].qualityTier, 'high');
  assert.strictEqual(sources[1].qualityTier, 'low');
});

console.log('[test-web-retrieval] the six required example prompts');

const REQUIRED_PROMPTS = [
  ['Anka kuşunun farklı mitolojilerdeki anlamları', 'mythology'],
  ['Hermetizmde zihin kavramı nedir?', 'hermeticism_alchemy'],
  ['Simyada nigredo nedir?', 'hermeticism_alchemy'],
  ['Mara hangi gelenekte?', 'comparative_religion'],
  ['Kadim kültürlerde Kuzey Yıldızı neyi temsil eder?', 'ancient_traditions'],
];

for (const [message, expectedDomain] of REQUIRED_PROMPTS) {
  await check(`"${message}" resolves via web retrieval under domain=${expectedDomain}`, async () => {
    const fetchImpl = mockFetchOk(`${message} hakkında doğrulanmış bir özet.`, [
      { url: 'https://www.britannica.com/topic/example', title: 'Britannica: Example' },
      { url: 'https://www.reddit.com/r/example', title: 'Reddit discussion' },
    ]);
    const result = await routeKnowledgeDomainQuery(message, {
      message,
      apiKey: 'test-key',
      fetchImpl,
    });
    assert.strictEqual(result.domain, expectedDomain);
    assert.strictEqual(result.handled, true);
    assert.strictEqual(result.resultStatus, 'success');
    assert.ok(result.reply.includes('Kaynaklar:'));
    assert.ok(result.reply.includes('britannica.com'));
    assert.ok(result.reply.includes('reddit.com'));
    // Attribution must label fact layers, not present every source as equal.
    assert.ok(result.reply.includes('Tarihsel/bilimsel görüş birliği') || result.reply.includes('Modern iddia'));
  });
}

console.log('[test-web-retrieval] one current factual web question');

await check('"Bugün dolar kuru ne kadar?" routes to general_web and resolves via retrieval', async () => {
  const message = 'Bugün dolar kuru ne kadar?';
  const fetchImpl = mockFetchOk('Güncel kur bilgisi kaynağa göre değişir.', [
    { url: 'https://www.reuters.com/markets/currencies', title: 'Reuters — Currencies' },
  ]);
  const result = await routeKnowledgeDomainQuery(message, { message, apiKey: 'test-key', fetchImpl });
  assert.strictEqual(result.domain, 'general_web');
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.resultStatus, 'success');
});

await check('wantsFreshness() correctly flags this query', () => {
  assert.strictEqual(wantsFreshness('Bugün dolar kuru ne kadar?'), true);
});

console.log('[test-web-retrieval] fail-closed behavior — every failure mode');

await check('missing API key fails closed, never fabricates a source', async () => {
  const result = await retrieveFromWeb({ query: 'test query', apiKey: '' });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'not_configured');
  assert.strictEqual(result.sources.length, 0);
});

await check('network error fails closed', async () => {
  const result = await retrieveFromWeb({ query: 'test', apiKey: 'k', fetchImpl: mockFetchNetworkError() });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'network_error');
});

await check('HTTP error fails closed', async () => {
  const result = await retrieveFromWeb({ query: 'test', apiKey: 'k', fetchImpl: mockFetchHttpError(500) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'http_500');
});

await check('a response with text but NO citations fails closed (never unattributed)', async () => {
  const result = await retrieveFromWeb({
    query: 'test',
    apiKey: 'k',
    fetchImpl: mockFetchNoCitations('confident-sounding but unsourced answer'),
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error, 'no_attributable_source');
});

await check('a fully failed retrieval reaches the user as a decline, not silence or a guess', async () => {
  const message = 'Hermetizmde zihin kavramı';
  const result = await routeKnowledgeDomainQuery(message, {
    message,
    apiKey: '',
  });
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.resultStatus, 'insufficient_data');
  assert.ok(!/kaynaklar:/i.test(result.reply)); // no fabricated source list
});

console.log('[test-web-retrieval] Qur\'an safety is unaffected (requirement 5)');

await check('Qur\'an domain still uses its own dedicated deterministic handler, not the web path', () => {
  assert.strictEqual(DOMAIN_REGISTRY.quran.sourcePolicy.sourceType, 'deterministic_verified');
  assert.strictEqual(DOMAIN_REGISTRY.quran.sourcePolicy.allowWebFallback, false);
  assert.notStrictEqual(DOMAIN_REGISTRY.quran.handler, DOMAIN_REGISTRY.mythology.handler);
});

console.log(
  failures === 0
    ? '\n[test-web-retrieval] all checks passed.'
    : `\n[test-web-retrieval] ${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);

import assert from 'node:assert/strict';

import {
  createAtlasWebRetrievalProvider,
  extractRankedWebSources,
  getRetrievalLabels,
  resolveWebRetrievalPlan,
} from '../server/domain-core/web-retrieval.js';
import { callOpenAI } from '../server/openai-client.js';

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(`${name}: ${error?.message || error}`);
    console.error(`✗ ${name} — ${error?.message || error}`);
  }
}

const fixtures = [
  ['Anka kuşunun farklı mitolojilerdeki anlamları', 'mythology'],
  ['Hermetizmde zihin kavramı nedir?', 'hermeticism'],
  ['Simyada nigredo nedir?', 'alchemy'],
  ['Mara hangi gelenekte?', 'comparative-religion'],
  ['Kadim kültürlerde Kuzey Yıldızı neyi temsil eder?', 'ancient-traditions'],
  ['OpenAI’nin güncel CEO’su kim?', 'general-web-knowledge'],
];

console.log('\n=== Atlas Core web retrieval routing ===\n');
for (const [query, expectedDomain] of fixtures) {
  await test(`${query} -> ${expectedDomain}`, () => {
    const plan = resolveWebRetrievalPlan(query);
    assert.equal(plan.active, true);
    assert.equal(plan.domain, expectedDomain);
  });
}

await test('current factual question requires fresh retrieval', () => {
  const plan = resolveWebRetrievalPlan(fixtures[5][0]);
  assert.equal(plan.freshness, 'current');
});

await test('Qur’an request stays outside web retrieval', () => {
  const plan = resolveWebRetrievalPlan('Bakara 2:255 ayetini açıkla');
  assert.equal(plan.active, false);
  assert.equal(plan.reason, 'quran_strict_path');
});

await test('mixed Qur’an + alchemy request stays on strict path', () => {
  const plan = resolveWebRetrievalPlan('Fâtır 35:6 ile simya arasında ilişki var mı?');
  assert.equal(plan.active, false);
  assert.equal(plan.reason, 'quran_strict_path');
});

await test('provider abstraction is channel-independent', () => {
  const provider = createAtlasWebRetrievalProvider();
  assert.equal(provider.providerId, 'openai-web-search');
  assert.equal(typeof provider.plan, 'function');
  assert.equal(provider.plan('Simyada nigredo nedir?').domain, 'alchemy');
});

await test('epistemic labels are preserved', () => {
  assert.deepEqual(getRetrievalLabels(), [
    'primary source',
    'scholarly consensus',
    'historical doctrine',
    'traditional belief',
    'later interpretation',
    'modern claim',
    'symbolic interpretation',
    'Atlas synthesis',
  ]);
});

await test('academic source ranks above interpretive blog', () => {
  const sources = extractRankedWebSources(
    {
      output: [
        {
          type: 'web_search_call',
          action: {
            sources: [
              { url: 'https://example.wordpress.com/nigredo', title: 'Blog' },
              { url: 'https://www.cambridge.org/core/nigredo', title: 'Cambridge' },
            ],
          },
        },
      ],
    },
    resolveWebRetrievalPlan('Simyada nigredo nedir?'),
  );
  assert.equal(sources[0].host, 'cambridge.org');
  assert.equal(sources[0].classLabel, 'scholarly consensus');
});

await test('OpenAI request uses hosted web_search and source include', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = null;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        status: 'completed',
        model: 'gpt-4.1-mini',
        usage: { input_tokens: 10, output_tokens: 20 },
        output: [
          {
            type: 'web_search_call',
            action: {
              sources: [
                {
                  url: 'https://www.cambridge.org/core/nigredo',
                  title: 'Cambridge',
                },
              ],
            },
          },
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: '[scholarly consensus] Nigredo is the blackening phase.',
              },
            ],
          },
        ],
      }),
    };
  };

  try {
    const result = await callOpenAI({
      apiKey: 'test-key',
      userPrompt: 'Simyada nigredo nedir?',
      systemPrompt: 'Atlas test',
      maxTokens: 100,
    });
    assert.equal(requestBody.tools[0].type, 'web_search');
    assert.deepEqual(requestBody.include, ['web_search_call.action.sources']);
    assert.match(requestBody.instructions, /VERIFIED WEB RETRIEVAL/);
    assert.equal(result.provider, 'openai-web-search');
    assert.match(result.content, /Kaynaklar \(Atlas Core; kalite sırasıyla\)/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await test('retrieval failure fails closed without fabricated sources', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
    text: async () => '',
  });

  try {
    const result = await callOpenAI({
      apiKey: 'test-key',
      userPrompt: 'OpenAI’nin güncel CEO’su kim?',
    });
    assert.equal(result.status, 'retrieval_unavailable');
    assert.equal(result.sources.length, 0);
    assert.match(result.content, /dış kaynak doğrulamasına/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log('\n=== Summary ===\n');
console.log(`Web retrieval tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('Failures:', failures.join('\n'));
  process.exit(1);
}

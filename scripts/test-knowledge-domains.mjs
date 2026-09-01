// ═══════════════════════════════════════════════════════════════════════
// Test: knowledge-domain routing foundation
// (server/knowledge-domains/{source-policy,domain-detector,topic-retrieval,registry}.js)
//
// Covers:
//  - domain detection for the example prompts from the architecture request
//  - no false-positive domain match on ordinary conversation
//  - registry status: only Qur'an is active, the other 7 domains are
//    registered (source policy known) but explicitly not_implemented
//  - routeKnowledgeDomainQuery falls through safely for unimplemented
//    domains, and actually resolves for the one implemented domain
//  - source-policy invariant: Qur'an is the strictest, distinct policy —
//    the only 'deterministic_verified' domain, fail-closed
//  - the generic topic-retrieval engine is genuinely domain-agnostic,
//    proven with a synthetic non-Qur'an handler
// ═══════════════════════════════════════════════════════════════════════

import assert from 'assert';
import { detectKnowledgeDomain } from '../server/knowledge-domains/domain-detector.js';
import { DOMAIN_REGISTRY, routeKnowledgeDomainQuery } from '../server/knowledge-domains/registry.js';
import { SOURCE_POLICY } from '../server/knowledge-domains/source-policy.js';
import { runTopicRetrieval } from '../server/knowledge-domains/topic-retrieval.js';
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

console.log('[test-knowledge-domains] domain detection for the architecture request examples');

const DOMAIN_EXAMPLES = [
  ['sabır hakkında ayetler', 'quran'],
  ['Hermetizmde zihin kavramı', 'hermeticism_alchemy'],
  ['Anka kuşunun farklı mitolojilerdeki anlamları', 'mythology'],
  ['Simyada nigredo nedir', 'hermeticism_alchemy'],
  ['Mara hangi gelenekte', 'comparative_religion'],
  ['Kadim kültürlerde Kuzey Yıldızı neyi temsil eder', 'ancient_traditions'],
];

for (const [message, expectedDomain] of DOMAIN_EXAMPLES) {
  await check(`"${message}" -> ${expectedDomain}`, () => {
    assert.strictEqual(detectKnowledgeDomain(message), expectedDomain);
  });
}

await check('ordinary conversation has no domain match (no false positive)', () => {
  assert.strictEqual(detectKnowledgeDomain('Bugün nasılsın, biraz yorgunum.'), null);
  assert.strictEqual(detectKnowledgeDomain('Yarın hava nasıl olacak?'), null);
});

await check('a personal numerology request does not collide with numerology_symbolic', () => {
  // Existing personal numerology intent (birth-date based) must stay with
  // the existing numerology engine, not get pulled into this new domain.
  assert.notStrictEqual(detectKnowledgeDomain('Doğum tarihime göre yaşam yolu sayım kaç?'), 'numerology_symbolic');
});

console.log('[test-knowledge-domains] registry status');

await check('all 8 domains are active as of the web-retrieval expansion', () => {
  const activeDomains = Object.entries(DOMAIN_REGISTRY)
    .filter(([, entry]) => entry.status === 'active')
    .map(([key]) => key)
    .sort();
  assert.deepStrictEqual(activeDomains, Object.keys(DOMAIN_REGISTRY).sort());
});

await check('every domain has a callable handler', () => {
  for (const key of Object.keys(DOMAIN_REGISTRY)) {
    assert.strictEqual(typeof DOMAIN_REGISTRY[key].handler, 'function', `${key} should have a handler`);
  }
});

await check('quran keeps its own dedicated handler, distinct from the generic web-backed one', () => {
  assert.strictEqual(DOMAIN_REGISTRY.quran.handler.name, 'tryQuranTopicReply');
  for (const key of Object.keys(DOMAIN_REGISTRY)) {
    if (key === 'quran') continue;
    assert.notStrictEqual(DOMAIN_REGISTRY[key].handler, DOMAIN_REGISTRY.quran.handler);
  }
});

await check('every registered domain carries a source policy', () => {
  for (const key of Object.keys(DOMAIN_REGISTRY)) {
    assert.ok(DOMAIN_REGISTRY[key].sourcePolicy, `${key} missing sourcePolicy`);
  }
});

console.log('[test-knowledge-domains] routeKnowledgeDomainQuery behavior');

await check('a web-backed domain with no reachable provider fails closed, not silently unhandled', async () => {
  // No apiKey/fetchImpl supplied — must decline safely, never throw and
  // never claim handled:false (a real handler IS registered now; see
  // test-web-retrieval.mjs for the fully-mocked success/failure matrix).
  const result = await routeKnowledgeDomainQuery('Hermetizmde zihin kavramı', {
    message: 'Hermetizmde zihin kavramı',
    apiKey: '',
  });
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.domain, 'hermeticism_alchemy');
  assert.strictEqual(result.resultStatus, 'insufficient_data');
  assert.strictEqual(result.sourcePolicy.sourceType, 'classical_source_plus_scholarship');
});

await check('a non-domain message returns handled:false with domain:null', async () => {
  const result = await routeKnowledgeDomainQuery('bugün canım sıkkın', { message: 'bugün canım sıkkın' });
  assert.strictEqual(result.handled, false);
  assert.strictEqual(result.domain, null);
});

await check('the one active domain (quran) actually resolves through the registry', async () => {
  const store = createVerseStore({ forceFixture: true, nodeEnv: 'test' });
  const message = 'Kur’an’da sabır hakkında ayetler';
  const result = await routeKnowledgeDomainQuery(message, {
    message,
    verseStore: store,
    retrieveOpts: { allowTestStore: true },
  });
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.domain, 'quran');
  assert.strictEqual(result.engine, 'quran-verse-lookup');
  assert.strictEqual(result.resultStatus, 'success');
});

console.log('[test-knowledge-domains] source-policy invariants (requirement F)');

await check('Qur\'an is the only deterministic_verified domain, and is fail-closed', () => {
  assert.strictEqual(SOURCE_POLICY.quran.sourceType, 'deterministic_verified');
  assert.strictEqual(SOURCE_POLICY.quran.failClosed, true);
  const otherDeterministic = Object.entries(SOURCE_POLICY)
    .filter(([key, p]) => key !== 'quran' && p.sourceType === 'deterministic_verified');
  assert.strictEqual(otherDeterministic.length, 0);
});

await check('every domain in this file defaults to failClosed:true (no domain guesses by default)', () => {
  for (const [key, policy] of Object.entries(SOURCE_POLICY)) {
    assert.strictEqual(policy.failClosed, true, `${key} should be failClosed`);
  }
});

console.log('[test-knowledge-domains] generic engine is domain-agnostic (synthetic non-Qur\'an handler)');

await check('runTopicRetrieval works for a made-up domain with no Qur\'an involvement at all', async () => {
  const COLOR_INDEX = { warm: ['red', 'orange'], cool: ['blue'] };
  const syntheticHandler = {
    domain: 'mythology', // reusing an existing id is fine — this is a synthetic test double
    detectTopic: (message) => {
      if (/warm colors/i.test(message)) return { active: true, topicKey: 'warm' };
      if (/cool colors/i.test(message)) return { active: true, topicKey: 'cool' };
      // Contract: recognized-as-topic-shaped but no known topic matched ->
      // topicKey MUST be null (same convention detectQuranTopicIntent
      // follows), not an arbitrary non-existent key.
      if (/mystery colors/i.test(message)) return { active: true, topicKey: null };
      return { active: false, topicKey: null };
    },
    getCandidates: (topicKey) => COLOR_INDEX[topicKey] ?? [],
    verifyCandidate: async (candidate) => ({ verified: true, item: candidate.toUpperCase() }),
    formatVerified: (items, topicKey) => `${topicKey}: ${items.join(', ')}`,
    unsupportedTopicMessage: 'no such color topic',
    sourceUnavailableMessage: 'colors unavailable',
    maxItems: 5,
  };

  const warm = await runTopicRetrieval(syntheticHandler, { message: 'tell me about warm colors' });
  assert.strictEqual(warm.handled, true);
  assert.strictEqual(warm.reply, 'warm: RED, ORANGE');

  const unrelated = await runTopicRetrieval(syntheticHandler, { message: 'what time is it' });
  assert.strictEqual(unrelated.handled, false);

  const unsupported = await runTopicRetrieval(syntheticHandler, { message: 'mystery colors please' });
  assert.strictEqual(unsupported.handled, true);
  assert.strictEqual(unsupported.reply, 'no such color topic');
});

await check('a candidate that fails verification is silently excluded, not fatal to the whole topic', async () => {
  const handler = {
    domain: 'mythology',
    detectTopic: () => ({ active: true, topicKey: 'x' }),
    getCandidates: () => ['good', 'bad-throws', 'good2'],
    verifyCandidate: async (c) => {
      if (c === 'bad-throws') throw new Error('simulated failure');
      return { verified: true, item: c };
    },
    formatVerified: (items) => items.join(','),
    unsupportedTopicMessage: 'n/a',
    sourceUnavailableMessage: 'n/a',
  };
  const result = await runTopicRetrieval(handler, { message: 'anything' });
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.reply, 'good,good2');
});

console.log(
  failures === 0
    ? '\n[test-knowledge-domains] all checks passed.'
    : `\n[test-knowledge-domains] ${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);

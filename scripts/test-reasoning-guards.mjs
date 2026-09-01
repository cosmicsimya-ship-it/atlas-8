// ═══════════════════════════════════════════════════════════════════════
// Test: general reasoning guards (theology-vs-history, agreement-bias,
// generalization, source-disagreement) — the code-level generalization of
// atlas_forbidden_patterns.md's "Din/Tarih/Kutsal Metin İddiaları" section.
//
// Deterministic unit checks (no network) plus a mocked-fetch integration
// check of the web-backed domain handler, so this runs the same way as
// every other scripts/test-*.mjs without needing OPENAI_API_KEY.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'assert';
import {
  isReligionHistoryDomain,
  detectAgreementBiasPressure,
  detectBroadGeneralizationClaim,
  detectSourceDisagreementSignal,
  selectReasoningGuardDirectives,
  buildTheologyFactSeparationDirective,
  buildAgreementBiasResistanceDirective,
  buildGeneralizationGuardDirective,
} from '../server/knowledge-domains/reasoning-guards.js';
import { createWebBackedDomainHandler, detectTopicForDomain } from '../server/knowledge-domains/web-domain-handler.js';
import { runTopicRetrieval } from '../server/knowledge-domains/topic-retrieval.js';
import { detectKnowledgeDomain } from '../server/knowledge-domains/domain-detector.js';

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

console.log('[test-reasoning-guards] domain classification helper');

await check('religion/history domain family recognized', () => {
  assert.strictEqual(isReligionHistoryDomain('comparative_religion'), true);
  assert.strictEqual(isReligionHistoryDomain('mythology'), true);
  assert.strictEqual(isReligionHistoryDomain('quran'), true);
  assert.strictEqual(isReligionHistoryDomain('general_web'), false);
  assert.strictEqual(isReligionHistoryDomain('numerology_symbolic'), false);
  assert.strictEqual(isReligionHistoryDomain(null), false);
});

console.log('[test-reasoning-guards] detectors');

await check('agreement-bias pressure detected in "değil mi" pressure phrasing', () => {
  assert.strictEqual(
    detectAgreementBiasPressure('Bütün dinler aslında aynı şeyi anlatıyor, değil mi?'),
    true,
  );
  assert.strictEqual(detectAgreementBiasPressure('İslam tarihinde ilk halife kimdi?'), false);
});

await check('broad generalization claim detected', () => {
  assert.strictEqual(
    detectBroadGeneralizationClaim('Tüm Araplar hep aynı şekilde davranır.'),
    true,
  );
  assert.strictEqual(detectBroadGeneralizationClaim('Bazı tarihçiler bu görüşte.'), false);
});

await check('source-disagreement signal detected in hedged answer text', () => {
  assert.strictEqual(
    detectSourceDisagreementSignal('Bu konuda kaynaklar arasında görüş ayrılığı var; bazı kaynaklara göre X, diğerlerine göre Y.'),
    true,
  );
  assert.strictEqual(detectSourceDisagreementSignal('Ankara, Türkiye\'nin başkentidir.'), false);
});

console.log('[test-reasoning-guards] directive selection');

await check('religion/history domain gets theology, agreement-bias, and generalization directives', () => {
  const directives = selectReasoningGuardDirectives({
    message: 'İlk şeytan hangi dinde belirdi?',
    domain: 'comparative_religion',
  });
  assert.ok(directives.includes(buildTheologyFactSeparationDirective()));
  assert.ok(directives.includes(buildAgreementBiasResistanceDirective()));
  assert.ok(directives.includes(buildGeneralizationGuardDirective()));
});

await check('non-religion domain with no pressure/generalization language gets no directives', () => {
  const directives = selectReasoningGuardDirectives({
    message: 'Bugün hava nasıl olacak?',
    domain: 'general_web',
  });
  assert.deepStrictEqual(directives, []);
});

await check('agreement-bias directive fires outside the religion/history domain family too', () => {
  const directives = selectReasoningGuardDirectives({
    message: 'Sen de öyle düşünüyorsun değil mi, bu kesinlikle doğru?',
    domain: null,
  });
  assert.ok(directives.includes(buildAgreementBiasResistanceDirective()));
  assert.ok(!directives.includes(buildTheologyFactSeparationDirective()));
});

console.log('[test-reasoning-guards] web-backed domain handler wiring (mocked fetch, no network)');

function mockResponsesApi({ text, sources }) {
  return async () => ({
    ok: true,
    json: async () => ({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text,
              annotations: sources.map((s) => ({ type: 'url_citation', url: s.url, title: s.title })),
            },
          ],
        },
      ],
    }),
  });
}

await check('comparative_religion web handler forwards guard directives to the search-model instructions', async () => {
  let capturedBody = null;
  const fetchImpl = async (url, opts) => {
    capturedBody = JSON.parse(opts.body);
    const mock = mockResponsesApi({
      text: 'Kavram A dininde de B dininde de farklı biçimlerde bulunur.',
      sources: [{ url: 'https://plato.stanford.edu/example', title: 'Example' }],
    });
    return mock();
  };

  const handler = createWebBackedDomainHandler({
    domain: 'comparative_religion',
    detectTopic: detectTopicForDomain('comparative_religion', detectKnowledgeDomain),
    domainInstructions: 'Bu bir karşılaştırmalı din sorusu.',
    unsupportedTopicMessage: 'unsupported',
    sourceUnavailableMessage: 'unavailable',
  });

  const message = 'Kavram A hangi dinde ortaya çıktı?';
  const result = await runTopicRetrieval(handler, { message, apiKey: 'test-key', fetchImpl });

  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.resultStatus, 'success');
  assert.ok(capturedBody, 'expected the mocked fetch to be called');
  assert.ok(
    capturedBody.instructions.includes('THEOLOGY VS. HISTORY GUARD'),
    'expected theology guard text in the model instructions',
  );
  assert.ok(
    capturedBody.instructions.includes('GENERALIZATION GUARD'),
    'expected generalization guard text in the model instructions',
  );
});

await check('disputed-source answer gets a disputed_uncertain note appended to the formatted reply', async () => {
  const fetchImpl = async () =>
    mockResponsesApi({
      text: 'Bu konuda kaynaklar arasında görüş ayrılığı var; net bir tarih belirtilemiyor.',
      sources: [{ url: 'https://plato.stanford.edu/example', title: 'Example' }],
    })();

  const handler = createWebBackedDomainHandler({
    domain: 'ancient_traditions',
    detectTopic: detectTopicForDomain('ancient_traditions', detectKnowledgeDomain),
    domainInstructions: 'Bu kadim bir gelenek sorusu.',
    unsupportedTopicMessage: 'unsupported',
    sourceUnavailableMessage: 'unavailable',
  });

  const message = 'Bu kadim gelenek ne zaman ortaya çıktı?';
  const result = await runTopicRetrieval(handler, { message, apiKey: 'test-key', fetchImpl });

  assert.strictEqual(result.handled, true);
  assert.ok(result.reply.includes('Tartışmalı'), 'expected the disputed_uncertain label in the reply');
});

console.log(
  failures === 0
    ? '\n[test-reasoning-guards] all checks passed.'
    : `\n[test-reasoning-guards] ${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);

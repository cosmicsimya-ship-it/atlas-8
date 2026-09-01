/**
 * Web-backed TopicRetrievalHandler factory — the bridge between the generic
 * runTopicRetrieval() engine (knowledge-domains/topic-retrieval.js) and
 * live external retrieval (web-search-provider.js), for every domain that
 * has no deterministic local verified store (everything except Qur'an).
 *
 * Fits the SAME generic engine Qur'an's topic retrieval uses: the "topic"
 * IS the search query, so getCandidates() returns a single-element list
 * (the query itself) — verifyCandidate() is where the real web call and
 * attribution check happen. If that call fails or returns no attributable
 * source, the candidate is excluded and the engine's existing fail-closed
 * path (requirement 6) takes over automatically — no extra logic needed
 * here to "not fabricate a source".
 */

import { retrieveFromWeb, suggestFactLayer } from './web-search-provider.js';
import { FACT_LAYER_LABELS } from './source-policy.js';
import { detectSourceDisagreementSignal, selectReasoningGuardDirectives } from './reasoning-guards.js';

/**
 * @param {{ answer: string, sources: import('./web-search-provider.js').WebSource[] }} item
 */
function formatWebBackedReply(item) {
  const lines = [item.answer, '', 'Kaynaklar:'];
  for (const source of item.sources) {
    const layerLabel = FACT_LAYER_LABELS[suggestFactLayer(source)];
    lines.push(`- ${source.title || source.url} (${source.url}) — ${layerLabel}`);
  }
  if (detectSourceDisagreementSignal(item.answer)) {
    lines.push(
      '',
      `⚠️ ${FACT_LAYER_LABELS.disputed_uncertain} — yanıt, kaynaklar arasındaki görüş ` +
        'ayrılığını olduğu gibi yansıtır, tek bir tarafı kesin doğru gibi sunmaz.',
    );
  }
  lines.push(
    '',
    'Not: Bu yanıt web araması sonucudur; Kur’an’ın doğrulanmış birincil kaynak ' +
      'kontrolüyle aynı doğrulama düzeyine sahip değildir.',
  );
  return lines.join('\n');
}

/**
 * @param {{
 *   domain: import('./source-policy.js').KnowledgeDomainId,
 *   detectTopic: (message: string) => { active: boolean, topicKey: string|null },
 *   domainInstructions?: string,
 *   unsupportedTopicMessage: string,
 *   sourceUnavailableMessage: string,
 * }} config
 * @returns {import('./topic-retrieval.js').TopicRetrievalHandler}
 */
export function createWebBackedDomainHandler(config) {
  return {
    domain: config.domain,
    detectTopic: config.detectTopic,
    getCandidates: (topicKey) => [topicKey],
    async verifyCandidate(query, input) {
      // Same theology-vs-fact / agreement-bias / generalization guards the
      // general LLM path gets (atlas-message-service.js) — this path has
      // its own web_search call with its own instructions, so it needs its
      // own copy rather than inheriting the other path's system prompt.
      const guardDirectives = selectReasoningGuardDirectives({ message: query, domain: config.domain });
      const domainInstructions = guardDirectives.length
        ? `${config.domainInstructions || ''} ${guardDirectives.join(' ')}`.trim()
        : config.domainInstructions;
      const result = await retrieveFromWeb({
        query,
        domainInstructions,
        apiKey: input?.apiKey,
        model: input?.model,
        timeoutMs: input?.timeoutMs,
        fetchImpl: input?.fetchImpl,
      });
      if (!result.ok) return { verified: false };
      return { verified: true, item: { answer: result.answer, sources: result.sources } };
    },
    formatVerified: (items) => formatWebBackedReply(items[0]),
    unsupportedTopicMessage: config.unsupportedTopicMessage,
    sourceUnavailableMessage: config.sourceUnavailableMessage,
    maxItems: 1,
  };
}

/**
 * Turns the coarse detectKnowledgeDomain() classifier into a per-domain
 * detectTopic(): "active" exactly when the coarse classifier picked THIS
 * domain, using the raw message as the search query (no discretization —
 * unlike Qur'an's small curated key set, a web query can be arbitrary).
 * @param {import('./source-policy.js').KnowledgeDomainId} domainId
 * @param {(message: string) => import('./source-policy.js').KnowledgeDomainId|null} detectKnowledgeDomain
 */
export function detectTopicForDomain(domainId, detectKnowledgeDomain) {
  return (message) => {
    const text = String(message ?? '').trim();
    if (!text) return { active: false, topicKey: null };
    return detectKnowledgeDomain(text) === domainId
      ? { active: true, topicKey: text }
      : { active: false, topicKey: null };
  };
}

/**
 * Domain routing foundation (requirement G: lives in Atlas Core, so web and
 * Telegram share it automatically — same as every other module here).
 *
 * Qur'an keeps its own dedicated, deterministic handler (unchanged, per
 * "do not weaken Qur'an safety"). Every other domain now has a real,
 * web-backed handler built from the same createWebBackedDomainHandler()
 * factory — one config object each, all running through the identical
 * generic runTopicRetrieval() engine and the identical fail-closed
 * behavior when retrieval is unavailable.
 *
 * Live-wired into atlas-message-service.js: routeKnowledgeDomainQuery() is
 * called for every non-Qur'an domain before the symbolic/numerology/tarot/
 * dream pipeline (see the "General knowledge-domain retrieval" block there).
 */

import { SOURCE_POLICY } from './source-policy.js';
import { detectKnowledgeDomain } from './domain-detector.js';
import { tryQuranTopicReply } from '../quran-verse-lookup/reply.js';
import { createWebBackedDomainHandler, detectTopicForDomain } from './web-domain-handler.js';
import { runTopicRetrieval } from './topic-retrieval.js';

/** @typedef {import('./source-policy.js').KnowledgeDomainId} KnowledgeDomainId */

/**
 * @typedef {{
 *   sourcePolicy: object,
 *   status: 'active'|'not_implemented',
 *   handler: ((input: object) => Promise<object>)|null,
 * }} DomainRegistryEntry
 */

/** @param {string} label */
function sourceUnavailableMessage(label) {
  return (
    `${label} konusunda güncel/doğrulanmış bir kaynağa şu anda ulaşamadım, bu yüzden kesin ` +
    'bir yanıt vermiyorum. Daha sonra tekrar deneyebilir veya soruyu daha spesifik hale ' +
    'getirebilirsin.'
  );
}

/**
 * @param {KnowledgeDomainId} domainId
 * @param {string} domainInstructions
 */
function webHandlerFor(domainId, domainInstructions) {
  const label = SOURCE_POLICY[domainId].label;
  const handlerConfig = createWebBackedDomainHandler({
    domain: domainId,
    detectTopic: detectTopicForDomain(domainId, detectKnowledgeDomain),
    domainInstructions,
    // Unreachable in practice: detectTopicForDomain() never returns
    // active:true with topicKey:null (unlike Qur'an's small curated key
    // set, a web query is never "recognized but unsupported" — it's
    // either this domain's query or it isn't). Set for interface
    // completeness/safety only.
    unsupportedTopicMessage: sourceUnavailableMessage(label),
    sourceUnavailableMessage: sourceUnavailableMessage(label),
  });
  // The registry's `handler` slot is a callable (input) => Promise<result>,
  // matching tryQuranTopicReply's shape — createWebBackedDomainHandler()
  // returns the generic engine's CONFIG object, so wrap it through
  // runTopicRetrieval() here rather than exposing the config as the handler.
  return (input) => runTopicRetrieval(handlerConfig, input);
}

/** @type {Record<KnowledgeDomainId, DomainRegistryEntry>} */
export const DOMAIN_REGISTRY = Object.freeze({
  quran: Object.freeze({
    sourcePolicy: SOURCE_POLICY.quran,
    status: 'active',
    handler: tryQuranTopicReply,
  }),
  comparative_religion: Object.freeze({
    sourcePolicy: SOURCE_POLICY.comparative_religion,
    status: 'active',
    handler: webHandlerFor(
      'comparative_religion',
      'Bu bir karşılaştırmalı din / dinler tarihi sorusu; akademik ve ansiklopedik ' +
        'kaynaklara öncelik ver, farklı dinlerin/geleneklerin kavramlarını birbirine karıştırma.',
    ),
  }),
  mythology: Object.freeze({
    sourcePolicy: SOURCE_POLICY.mythology,
    status: 'active',
    handler: webHandlerFor(
      'mythology',
      'Bu bir mitoloji sorusu; mümkünse klasik/birincil kaynaklara ve akademik referanslara ' +
        'öncelik ver, farklı mitolojik gelenekleri birbirine karıştırma.',
    ),
  }),
  esotericism: Object.freeze({
    sourcePolicy: SOURCE_POLICY.esotericism,
    status: 'active',
    handler: webHandlerFor(
      'esotericism',
      'Bu bir ezoterizm/okült gelenek sorusu; tarihsel doktrini, sonraki yorumu ve modern ' +
        'iddiayı birbirinden ayırt ederek anlat.',
    ),
  }),
  hermeticism_alchemy: Object.freeze({
    sourcePolicy: SOURCE_POLICY.hermeticism_alchemy,
    status: 'active',
    handler: webHandlerFor(
      'hermeticism_alchemy',
      'Bu bir Hermetizm/simya sorusu; klasik kaynaklara ve akademik yoruma öncelik ver, ' +
        'sembolik terimleri (nigredo, albedo, rubedo gibi) tarihsel bağlamında açıkla.',
    ),
  }),
  numerology_symbolic: Object.freeze({
    sourcePolicy: SOURCE_POLICY.numerology_symbolic,
    status: 'active',
    handler: webHandlerFor(
      'numerology_symbolic',
      'Bu tarihsel/sembolik bir sayı sistemi sorusu (kişisel doğum tarihi numerolojisi ' +
        'değil); akademik ve geleneksel kaynaklara dayan.',
    ),
  }),
  ancient_traditions: Object.freeze({
    sourcePolicy: SOURCE_POLICY.ancient_traditions,
    status: 'active',
    handler: webHandlerFor(
      'ancient_traditions',
      'Bu kadim/antik bir gelenek sorusu; akademik ve ansiklopedik kaynaklara öncelik ver.',
    ),
  }),
  general_web: Object.freeze({
    sourcePolicy: SOURCE_POLICY.general_web,
    status: 'active',
    handler: webHandlerFor(
      'general_web',
      'Bu güncel/genel bir bilgi sorusu; en güncel ve güvenilir kaynaklara dayan, mümkünse tarih belirt.',
    ),
  }),
});

/**
 * @param {string} message
 * @param {object} input passed through verbatim to whatever handler runs
 * @returns {Promise<{ handled: boolean, domain: KnowledgeDomainId|null, sourcePolicy?: object }>}
 */
export async function routeKnowledgeDomainQuery(message, input) {
  const domain = detectKnowledgeDomain(message);
  if (!domain) return { handled: false, domain: null };

  const entry = DOMAIN_REGISTRY[domain];
  if (!entry || entry.status !== 'active' || typeof entry.handler !== 'function') {
    return { handled: false, domain, sourcePolicy: entry?.sourcePolicy ?? null };
  }

  const result = await entry.handler(input);
  return { ...result, domain, sourcePolicy: entry.sourcePolicy };
}

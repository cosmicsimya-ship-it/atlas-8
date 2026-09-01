/**
 * Generic topic-based retrieval engine — generalized from
 * quran-verse-lookup's tryQuranTopicReply(): detect a topic question,
 * fetch a small candidate list for the matched topic, verify each
 * candidate independently, and fail closed (never invent) if none verify.
 *
 * This module has no knowledge of Qur'an, mythology, or anything else — it
 * only knows this shape. A domain plugs in by providing a TopicRetrievalHandler.
 * quran-verse-lookup/reply.js's tryQuranTopicReply is now implemented ON TOP
 * of this (see that file) — the same 11 regression tests that covered it
 * before continue to pass, proving the extraction preserved behavior.
 */

/**
 * @template TCandidate, TVerifiedItem
 * @typedef {{
 *   domain: import('./source-policy.js').KnowledgeDomainId,
 *   detectTopic: (message: string) => { active: boolean, topicKey: string|null },
 *   // Contract: topicKey must be null when the message is recognized as
 *   // topic-shaped (active:true) but matches no SUPPORTED topic — never an
 *   // arbitrary/unregistered key. That null is what selects
 *   // unsupportedTopicMessage below instead of sourceUnavailableMessage.
 *   getCandidates: (topicKey: string) => TCandidate[],
 *   verifyCandidate: (candidate: TCandidate, input: object) => Promise<{ verified: boolean, item?: TVerifiedItem }>,
 *   formatVerified: (items: TVerifiedItem[], topicKey: string) => string,
 *   unsupportedTopicMessage: string,
 *   sourceUnavailableMessage: string,
 *   maxItems?: number,
 * }} TopicRetrievalHandler
 */

/**
 * @typedef {{
 *   handled: boolean,
 *   reply?: string,
 *   status?: string,
 *   resultStatus?: string,
 *   domain?: import('./source-policy.js').KnowledgeDomainId,
 *   topicKey?: string|null,
 *   verifiedItems?: any[],
 * }} TopicRetrievalResult
 */

/**
 * @param {TopicRetrievalHandler} handler
 * @param {{ message: string, [key: string]: any }} input
 * @returns {Promise<TopicRetrievalResult>}
 */
export async function runTopicRetrieval(handler, input) {
  const message = String(input?.message ?? '');
  const topicIntent = handler.detectTopic(message);
  if (!topicIntent.active) return { handled: false };

  const maxItems = handler.maxItems ?? 3;
  const candidates = topicIntent.topicKey ? handler.getCandidates(topicIntent.topicKey) : [];

  const verifiedItems = [];
  for (const candidate of candidates.slice(0, maxItems)) {
    let result;
    try {
      result = await handler.verifyCandidate(candidate, input);
    } catch (err) {
      console.warn(
        `[knowledge-domains] verifyCandidate threw for domain=${handler.domain} topic=${topicIntent.topicKey}: ${err?.message ?? err}`,
      );
      continue; // one bad candidate must never abort the whole topic — just excluded
    }
    if (result?.verified && result.item !== undefined) {
      verifiedItems.push(result.item);
    }
  }

  if (!verifiedItems.length) {
    return {
      handled: true,
      reply: topicIntent.topicKey ? handler.sourceUnavailableMessage : handler.unsupportedTopicMessage,
      status: 'complete',
      resultStatus: 'insufficient_data',
      domain: handler.domain,
      topicKey: topicIntent.topicKey,
      verifiedItems: [],
    };
  }

  return {
    handled: true,
    reply: handler.formatVerified(verifiedItems, topicIntent.topicKey),
    status: 'complete',
    resultStatus: 'success',
    domain: handler.domain,
    topicKey: topicIntent.topicKey,
    verifiedItems,
  };
}

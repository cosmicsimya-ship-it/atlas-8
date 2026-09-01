/**
 * Deterministic user-facing replies for Quran verse lookup.
 * Never embeds LLM-invented Arabic/meal.
 */

import { detectQuranVerseLookupIntent } from './intent.js';
import { parseQuranVerseLookup } from './parse.js';
import {
  QURAN_VERSE_LOOKUP_VERSION,
  retrieveVerifiedVerse,
} from './retrieve.js';
import { getAyahCount } from './surah-map.js';
import { detectCrossLayerSynthesisIntent } from '../cross-layer-synthesis/message-integration.js';
import {
  buildGroundedQuranExplanationPrompt,
  sanitizeGroundedQuranExplanation,
  wantsQuranExplanation,
} from './explanation.js';
import {
  detectQuranTopicIntent,
  TOPIC_VERSE_INDEX,
  TOPIC_DISPLAY_LABEL,
} from './topic-index.js';
import { runTopicRetrieval } from '../knowledge-domains/topic-retrieval.js';

export const MSG_SOURCE_UNAVAILABLE =
  'Ayet metnini güvenilir kaynaktan doğrulayamadığım için aktarmıyorum. Kur’an ayetlerini model hafızasından üretmem; yanlış ayet vermemek için bu isteği şu anda güvenilir biçimde karşılayamıyorum.';

export const MSG_INVALID_AYAH =
  'Bu surede belirtilen numarada bir ayet bulunmuyor.';

export const MSG_INVALID_SURAH =
  'Belirtilen sure numarası geçerli değil. Kur’an’da 114 sure vardır.';

export const MSG_UNPARSEABLE =
  'Hangi sure ve ayeti istediğini güvenilir biçimde çıkaramadım. Örnek: “8. surenin 8. ayeti”, “Enfâl 8:8” veya “2:255”. Ayet metnini tahmin ederek yazmam.';

export const MSG_TIMEOUT =
  'Ayet kaynağına zamanında ulaşamadığım için metni aktarmıyorum. Yanlış ayet vermemek adına tahmin yürütmüyorum.';

export const MSG_MALFORMED =
  'Ayet kaynağından gelen yanıt doğrulanamadığı için metni aktarmıyorum.';

export const MSG_TOPIC_SOURCE_UNAVAILABLE =
  'Bu konuyla ilgili ayetleri güvenilir kaynaktan doğrulayamadığım için paylaşmıyorum. ' +
  'Kur’an ayetlerini model hafızasından üretmem; yanlış ayet vermemek için bu isteği şu anda ' +
  'güvenilir biçimde karşılayamıyorum.';

export const MSG_TOPIC_UNSUPPORTED =
  'Bu konu için doğrulanmış, güvenilir bir ayet seti henüz oluşturamadım. Belirli bir sure ve ' +
  'ayet numarası biliyorsan onu doğrudan sorabilirsin (ör. “2:255” veya “Fâtır 35:6”).';
/**
 * @param {import('./retrieve.js').VerseRetrievalResult} retrieved
 * @param {import('./parse.js').ParsedVerseLookup} parsed
 */
export function buildQuranVerseLookupReply(retrieved, parsed, options = {}) {
  if (parsed?.parse_ok && !parsed.validation_ok) {
    if (parsed.error === 'invalid_surah') {
      return {
        reply: MSG_INVALID_SURAH,
        resultStatus: 'user_visible_error',
        status: 'complete',
      };
    }
    if (parsed.error === 'invalid_ayah') {
      const max = parsed.surah_number != null ? getAyahCount(parsed.surah_number) : null;
      const hint =
        max != null && parsed.surah_name
          ? ` ${parsed.surah_name} suresinde ${max} ayet vardır.`
          : '';
      return {
        reply: `${MSG_INVALID_AYAH}${hint}`,
        resultStatus: 'user_visible_error',
        status: 'complete',
      };
    }
  }

  if (!parsed?.parse_ok) {
    return {
      reply: MSG_UNPARSEABLE,
      resultStatus: 'insufficient_data',
      status: 'complete',
    };
  }

  if (!retrieved?.verified || !retrieved.ok) {
    if (retrieved?.error === 'source_timeout') {
      return { reply: MSG_TIMEOUT, resultStatus: 'user_visible_error', status: 'complete' };
    }
    if (retrieved?.error === 'malformed_source_response') {
      return { reply: MSG_MALFORMED, resultStatus: 'user_visible_error', status: 'complete' };
    }
    return {
      reply: MSG_SOURCE_UNAVAILABLE,
      resultStatus: 'insufficient_data',
      status: 'complete',
    };
  }

  // Verified path — only when store returns attributed text (feature gate + tests).
  const lines = [];
  lines.push(
    `${retrieved.surah_name} ${retrieved.surah_number}:${retrieved.ayah_number} (doğrulanmış kaynak)`,
  );
  if (retrieved.arabic) {
    lines.push('', 'Arapça:', retrieved.arabic);
  }
  if (retrieved.translation) {
    lines.push(
      '',
      `Meal (${retrieved.translation_source}):`,
      retrieved.translation,
    );
  }
  lines.push(
    '',
    'Not: Bu metin Atlas yorumu veya tefsir değildir; yalnızca doğrulanmış kaynaktan aktarılmıştır.',
  );
  if (options.explanation) {
    lines.push('', 'Açıklaması:', options.explanation);
  }

  return {
    reply: lines.join('\n'),
    resultStatus: 'success',
    status: 'complete',
  };
}

/**
 * Whether this turn should short-circuit before LLM / other engines.
 * Cross-layer multi-domain synthesis keeps its own path (still never invents verses).
 * @param {string} message
 */
export function shouldShortCircuitQuranVerseLookup(message) {
  const intent = detectQuranVerseLookupIntent(message);
  if (!intent.active) return false;

  const synth = detectCrossLayerSynthesisIntent(message);
  const otherLayers = (synth.layersRequested ?? []).filter((l) => l !== 'quran');
  // Multi-domain or explicit combine/synthesis → leave to cross-layer bridge
  // (which still never invents verse text).
  if (synth.combineExplicit || synth.isUserExample) return false;
  if (synth.wantsSynthesis && otherLayers.length > 0) return false;
  return true;
}

/**
 * @param {{ message: string, verseStore?: import('./retrieve.js').VerseStore|null, retrieveOpts?: object }} input
 */
export async function tryDeterministicQuranVerseReply(input) {
  const message = String(input?.message ?? '');
  const intent = detectQuranVerseLookupIntent(message);
  if (!intent.active || !shouldShortCircuitQuranVerseLookup(message)) {
    return { handled: false };
  }

  const parsed = parseQuranVerseLookup(message);
  const retrieved = await retrieveVerifiedVerse(parsed, input?.verseStore ?? null, {
    ...(input?.retrieveOpts ?? {}),
  });

  // Hard rule: never surface verse text unless verified === true
  if (retrieved.verified !== true) {
    retrieved.arabic = null;
    retrieved.translation = null;
  }

  let explanation = null;
  if (retrieved.verified && wantsQuranExplanation(message) && typeof input?.explainVerse === 'function') {
    try {
      const generated = await input.explainVerse({
        ...retrieved,
        prompt: buildGroundedQuranExplanationPrompt(retrieved),
      });
      explanation = sanitizeGroundedQuranExplanation(generated, retrieved);
    } catch (err) {
      // The verified verse remains useful even when explanation generation fails —
      // log so a hung/failed provider call is visible instead of silent.
      console.warn(
        `[Quran] explanation generation failed for ${parsed?.verse_key ?? 'unknown'}: ${err?.message ?? err}`,
      );
    }
  }

  const built = buildQuranVerseLookupReply(retrieved, parsed, { explanation });

  return {
    handled: true,
    reply: built.reply,
    status: built.status,
    resultStatus: built.resultStatus,
    intent: intent.intent,
    engine: 'quran-verse-lookup',
    data: {
      version: QURAN_VERSE_LOOKUP_VERSION,
      quranVerseLookup: {
        surah_number: parsed.surah_number,
        surah_name: parsed.surah_name,
        ayah_number: parsed.ayah_number,
        verse_key: parsed.verse_key,
        arabic: retrieved.verified ? retrieved.arabic : null,
        translation: retrieved.verified ? retrieved.translation : null,
        translation_source: retrieved.verified ? retrieved.translation_source : null,
        verified: retrieved.verified === true,
        error: retrieved.error,
        parse_ok: parsed.parse_ok,
        validation_ok: parsed.validation_ok,
        explanation_generated: Boolean(explanation),
      },
      model: 'deterministic',
      provider: 'atlas-quran-verse-lookup',
      tokensUsed: 0,
      costUsd: 0,
      latencyMs: 0,
    },
  };
}

/** Small ranked set — never dump the whole curated list into one reply. */
const MAX_TOPIC_VERSES = 3;

/**
 * Topic-based verse retrieval — a separate path from explicit-reference
 * lookup above. Only reached when detectQuranTopicIntent() recognizes a
 * "<topic> hakkında/ile ilgili ayet(ler)" question; the caller is
 * responsible for trying explicit-reference lookup FIRST so an explicit
 * "2:255 nedir?" is never diverted here (see atlas-message-service.js).
 *
 * Every candidate reference from the curated index still goes through
 * parseQuranVerseLookup + retrieveVerifiedVerse — the index only decides
 * WHICH references to attempt; nothing is shown unless independently
 * verified. Fails closed (no result at all) if the topic is unrecognized
 * or none of its candidates verify.
 * @param {{ message: string, verseStore?: import('./retrieve.js').VerseStore|null, retrieveOpts?: object, explainVerse?: Function }} input
 */
function formatVerifiedQuranTopicItems(items, topicKey) {
  const label = TOPIC_DISPLAY_LABEL[topicKey] ?? topicKey;
  const lines = [`“${label}” konusuyla ilgili doğrulanmış ayetler:`, ''];
  for (const v of items) {
    lines.push(
      `${v.retrieved.surah_name} ${v.retrieved.surah_number}:${v.retrieved.ayah_number} (doğrulanmış kaynak)`,
    );
    if (v.retrieved.arabic) lines.push('', 'Arapça:', v.retrieved.arabic);
    if (v.retrieved.translation) {
      lines.push('', `Meal (${v.retrieved.translation_source}):`, v.retrieved.translation);
    }
    if (v.explanation) lines.push('', 'Açıklaması:', v.explanation);
    lines.push('', '—', '');
  }
  lines.push(
    'Not: Bu metinler Atlas yorumu veya tefsir değildir; yalnızca doğrulanmış kaynaktan aktarılmıştır.',
  );
  return lines.join('\n');
}

/**
 * Qur'an's TopicRetrievalHandler — the generalizable shape lives in
 * knowledge-domains/topic-retrieval.js; this is the thin, domain-specific
 * plug-in. Reused as-is by any future caller of the generic engine.
 * @type {import('../knowledge-domains/topic-retrieval.js').TopicRetrievalHandler}
 */
const quranTopicHandler = {
  domain: 'quran',
  detectTopic: detectQuranTopicIntent,
  getCandidates: (topicKey) => TOPIC_VERSE_INDEX[topicKey] ?? [],
  async verifyCandidate(ref, input) {
    const parsed = parseQuranVerseLookup(ref);
    if (!parsed.parse_ok || !parsed.validation_ok) return { verified: false }; // defense-in-depth only
    const retrieved = await retrieveVerifiedVerse(parsed, input?.verseStore ?? null, {
      ...(input?.retrieveOpts ?? {}),
    });
    if (retrieved.verified !== true) return { verified: false }; // only verified verses ever surface

    let explanation = null;
    if (typeof input?.explainVerse === 'function') {
      try {
        const generated = await input.explainVerse({
          ...retrieved,
          prompt: buildGroundedQuranExplanationPrompt(retrieved),
        });
        explanation = sanitizeGroundedQuranExplanation(generated, retrieved);
      } catch (err) {
        console.warn(
          `[Quran] topic explanation failed for ${parsed.verse_key}: ${err?.message ?? err}`,
        );
      }
    }
    return { verified: true, item: { parsed, retrieved, explanation } };
  },
  formatVerified: formatVerifiedQuranTopicItems,
  unsupportedTopicMessage: MSG_TOPIC_UNSUPPORTED,
  sourceUnavailableMessage: MSG_TOPIC_SOURCE_UNAVAILABLE,
  maxItems: MAX_TOPIC_VERSES,
};

export async function tryQuranTopicReply(input) {
  const generic = await runTopicRetrieval(quranTopicHandler, input);
  if (!generic.handled) return { handled: false };

  const candidateCount = generic.topicKey ? (TOPIC_VERSE_INDEX[generic.topicKey]?.length ?? 0) : 0;
  return {
    handled: true,
    reply: generic.reply,
    status: generic.status,
    resultStatus: generic.resultStatus,
    intent: 'quran_topic_lookup',
    engine: 'quran-verse-lookup',
    data: {
      version: QURAN_VERSE_LOOKUP_VERSION,
      quranTopicLookup: {
        topicKey: generic.topicKey,
        candidateCount,
        verifiedCount: generic.verifiedItems.length,
        verseKeys: generic.verifiedItems.map((v) => v.parsed.verse_key),
      },
      model: 'deterministic',
      provider: 'atlas-quran-verse-lookup',
      tokensUsed: 0,
      costUsd: 0,
      latencyMs: 0,
    },
  };
}

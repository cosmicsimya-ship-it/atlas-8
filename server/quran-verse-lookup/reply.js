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

/**
 * @param {import('./retrieve.js').VerseRetrievalResult} retrieved
 * @param {import('./parse.js').ParsedVerseLookup} parsed
 */
export function buildQuranVerseLookupReply(retrieved, parsed) {
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

  const built = buildQuranVerseLookupReply(retrieved, parsed);

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
      },
      model: 'deterministic',
      provider: 'atlas-quran-verse-lookup',
      tokensUsed: 0,
      costUsd: 0,
      latencyMs: 0,
    },
  };
}

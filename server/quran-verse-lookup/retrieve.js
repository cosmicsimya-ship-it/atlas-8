/**
 * Trusted verse retrieval — fail-closed.
 * NO SOURCE = NO VERSE. LLM fallback is forbidden.
 */

export const QURAN_VERSE_LOOKUP_VERSION = 'quran-verse-lookup-v1';

/** Feature remains fail-closed until a verified VerseStore is injected. */
export const QURAN_VERSE_TEXT_ENABLED = false;

/**
 * @typedef {{
 *   getVerse: (verseKey: string) => ({
 *     arabic?: string|null,
 *     translation?: string|null,
 *     translationSource?: string|null,
 *     hasTafsir?: boolean,
 *   }|null) | Promise<{
 *     arabic?: string|null,
 *     translation?: string|null,
 *     translationSource?: string|null,
 *     hasTafsir?: boolean,
 *   }|null>
 * }} VerseStore
 */

/**
 * @typedef {{
 *   ok: boolean,
 *   verified: boolean,
 *   verse_key: string|null,
 *   surah_number: number|null,
 *   surah_name: string|null,
 *   ayah_number: number|null,
 *   arabic: string|null,
 *   translation: string|null,
 *   translation_source: string|null,
 *   error: string|null,
 * }} VerseRetrievalResult
 */

/**
 * @param {object} parsed from parseQuranVerseLookup
 * @param {VerseStore|null|undefined} verseStore
 * @param {{ timeoutMs?: number, simulateFailure?: 'unavailable'|'timeout'|'malformed' }} [opts]
 * @returns {Promise<VerseRetrievalResult>}
 */
export async function retrieveVerifiedVerse(parsed, verseStore = null, opts = {}) {
  const base = {
    ok: false,
    verified: false,
    verse_key: parsed?.verse_key ?? null,
    surah_number: parsed?.surah_number ?? null,
    surah_name: parsed?.surah_name ?? null,
    ayah_number: parsed?.ayah_number ?? null,
    arabic: null,
    translation: null,
    translation_source: null,
    error: null,
  };

  if (opts.simulateFailure === 'unavailable') {
    return { ...base, error: 'source_unavailable' };
  }
  if (opts.simulateFailure === 'timeout') {
    return { ...base, error: 'source_timeout' };
  }
  if (opts.simulateFailure === 'malformed') {
    return { ...base, error: 'malformed_source_response' };
  }

  if (!parsed?.parse_ok) {
    return { ...base, error: 'unparseable_reference' };
  }
  if (!parsed.validation_ok) {
    return { ...base, error: parsed.error ?? 'invalid_reference' };
  }

  if (!verseStore || typeof verseStore.getVerse !== 'function') {
    return { ...base, error: 'source_unavailable' };
  }

  // Production gate: text delivery stays off until a verified corpus/API is cleared.
  // Tests may pass allowTestStore with an injected fixture store only.
  if (!QURAN_VERSE_TEXT_ENABLED && opts.allowTestStore !== true) {
    return { ...base, error: 'source_unavailable' };
  }

  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 4000;

  let timer = null;
  try {
    const verseKey = parsed.verse_key;
    const pending = Promise.resolve(verseStore.getVerse(verseKey));
    const stored = await Promise.race([
      pending,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Object.assign(new Error('timeout'), { code: 'source_timeout' })),
          timeoutMs,
        );
      }),
    ]);
    if (timer) clearTimeout(timer);

    if (stored == null || typeof stored !== 'object') {
      return { ...base, error: 'malformed_source_response' };
    }

    const arabic = stored.arabic != null ? String(stored.arabic).trim() : null;
    const translation = stored.translation != null ? String(stored.translation).trim() : null;
    const translation_source =
      stored.translationSource != null ? String(stored.translationSource).trim() : null;

    if (!arabic && !translation) {
      return { ...base, error: 'source_unavailable' };
    }

    // verified requires explicit source attribution for any translation shown
    if (translation && !translation_source) {
      return { ...base, error: 'malformed_source_response' };
    }

    return {
      ok: true,
      verified: true,
      verse_key: verseKey,
      surah_number: parsed.surah_number,
      surah_name: parsed.surah_name,
      ayah_number: parsed.ayah_number,
      arabic: arabic || null,
      translation: translation || null,
      translation_source: translation_source || null,
      error: null,
    };
  } catch (err) {
    if (timer) clearTimeout(timer);
    const code = err?.code === 'source_timeout' || /timeout/i.test(String(err?.message ?? ''))
      ? 'source_timeout'
      : 'source_unavailable';
    return { ...base, error: code };
  }
}

/**
 * Deterministic surah/ayah reference parsing from Turkish / numeric free text.
 * Never asks the LLM to guess a surah number.
 */

import { validateVerseReference } from '../cross-layer-synthesis/quran-safety.js';
import {
  getAyahCount,
  getSurahName,
  getSurahAliasKeysLongestFirst,
  normalizeSurahToken,
  resolveSurahNumberByName,
  surahNumberFromAliasKey,
} from './surah-map.js';

/**
 * @typedef {{
 *   surah_number: number|null,
 *   surah_name: string|null,
 *   ayah_number: number|null,
 *   verse_key: string|null,
 *   raw: string,
 *   parse_ok: boolean,
 *   validation_ok: boolean,
 *   error: string|null,
 * }} ParsedVerseLookup
 */

/**
 * @param {number|null} surah
 * @param {number|null} ayah
 * @param {string} raw
 * @returns {ParsedVerseLookup}
 */
function finalize(surah, ayah, raw) {
  const surah_number = Number.isInteger(surah) ? surah : null;
  const ayah_number = Number.isInteger(ayah) ? ayah : null;
  const surah_name = surah_number != null ? getSurahName(surah_number) : null;

  if (surah_number == null || ayah_number == null) {
    return {
      surah_number,
      surah_name,
      ayah_number,
      verse_key: null,
      raw,
      parse_ok: false,
      validation_ok: false,
      error: 'unparseable_reference',
    };
  }

  const validation = validateVerseReference(surah_number, ayah_number);
  return {
    surah_number,
    surah_name,
    ayah_number,
    verse_key: validation.verseKey,
    raw,
    parse_ok: true,
    validation_ok: validation.ok,
    error: validation.ok ? null : validation.error,
  };
}

/**
 * Match longest surah alias in folded text, then read following ayah digits.
 * @param {string} text
 * @returns {{ surah: number, ayah: number }|null}
 */
function parseNamedSurahAyah(text) {
  const folded = normalizeSurahToken(text);
  if (!folded) return null;

  for (const key of getSurahAliasKeysLongestFirst()) {
    if (key.length < 3) continue;
    const idx = folded.indexOf(key);
    if (idx < 0) continue;

    const surah = surahNumberFromAliasKey(key);
    if (surah == null) continue;

    const after = folded.slice(idx + key.length);
    // "enfal88" from "Enfal 8:8" / "Enfal 8/8" after digit-only fold
    // "bakara255" from "Bakara 255"
    // "enfalsuresi8ayet" — digits remain
    const digits = [...after.matchAll(/(\d{1,3})/g)].map((m) => Number(m[1]));
    if (digits.length === 0) continue;

    if (digits.length >= 2) {
      // Prefer patterns where first digit equals surah number (Enfal 8:8 → 8,8)
      if (digits[0] === surah) {
        return { surah, ayah: digits[1] };
      }
      // "Name 2:255" rare; take last digit as ayah if first looks like ayah only when single
      return { surah, ayah: digits[digits.length - 1] };
    }

    return { surah, ayah: digits[0] };
  }
  return null;
}

/**
 * Parse natural-language or numeric verse references.
 * @param {string} message
 * @returns {ParsedVerseLookup}
 */
export function parseQuranVerseLookup(message) {
  const raw = String(message ?? '').trim();
  if (!raw) {
    return finalize(null, null, '');
  }

  // 1) "8. surenin 8. ayeti" / "8. sure 8. ayet"
  const ordinal = raw.match(
    /(\d{1,3})\s*\.\s*s[uû]re(?:nin|si)?\s+(\d{1,3})\s*\.\s*ayet(?:i|in|ini)?/i,
  );
  if (ordinal) {
    return finalize(Number(ordinal[1]), Number(ordinal[2]), raw);
  }

  // "sure 8 ayet 8" / "suresi 8. ayet 8"
  const sureAyetWords = raw.match(
    /s[uû]re(?:nin|si)?\s+(\d{1,3})\s*(?:\.|:)?\s*(?:n(?:in|ın)\s+)?ayet(?:i|in|ini)?\s+(\d{1,3})/i,
  );
  if (sureAyetWords) {
    return finalize(Number(sureAyetWords[1]), Number(sureAyetWords[2]), raw);
  }

  const sureAyetCompact = raw.match(
    /s[uû]re(?:nin|si)?\s+(\d{1,3})\s+(?:ayet(?:i|in|ini)?\s+)?(\d{1,3})\b/i,
  );
  if (sureAyetCompact) {
    return finalize(Number(sureAyetCompact[1]), Number(sureAyetCompact[2]), raw);
  }

  // 2) Compact "8:8" / "8/8" / "2:255"
  const compact = raw.match(/\b(\d{1,3})\s*[:\/]\s*(\d{1,3})\b/);
  if (compact) {
    return finalize(Number(compact[1]), Number(compact[2]), raw);
  }

  // 3) "Bakara 255. ayet" / "Enfal suresi 8. ayet"
  const nameAyet = raw.match(
    /([A-Za-zÂâÎîÛûÔôÊêĞğÜüŞşİıÖöÇç‘’']+)\s+(?:suresi|sûresi)?\s*(\d{1,3})\s*(?:\.|:)?\s*ayet/i,
  );
  if (nameAyet) {
    const n = resolveSurahNumberByName(nameAyet[1]);
    if (n != null) return finalize(n, Number(nameAyet[2]), raw);
  }

  // 4) Named surah + digits (Enfal 8:8, Bakara 255, İhlas 1)
  const named = parseNamedSurahAyah(raw);
  if (named) {
    return finalize(named.surah, named.ayah, raw);
  }

  const nameBare = raw.match(
    /([A-Za-zÂâÎîÛûÔôÊêĞğÜüŞşİıÖöÇç‘’']+)\s+(\d{1,3})\b/,
  );
  if (nameBare && !/^\d+$/.test(nameBare[1])) {
    const n = resolveSurahNumberByName(nameBare[1]);
    if (n != null) return finalize(n, Number(nameBare[2]), raw);
  }

  return finalize(null, null, raw);
}

/**
 * @param {ParsedVerseLookup} parsed
 */
export function describeBoundaryError(parsed) {
  if (!parsed.parse_ok) return 'unparseable_reference';
  if (parsed.error === 'invalid_surah') return 'invalid_surah';
  if (parsed.error === 'invalid_ayah') {
    const max = parsed.surah_number != null ? getAyahCount(parsed.surah_number) : null;
    return max != null ? `invalid_ayah_max_${max}` : 'invalid_ayah';
  }
  return parsed.error ?? 'unknown';
}

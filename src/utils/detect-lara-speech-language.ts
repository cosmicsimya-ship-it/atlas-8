/**
 * Lightweight speech language hint for Lara TTS.
 * Prefer explicit language when known; otherwise infer from script.
 */

const TR_CHARS = /[çğıöşüÇĞİÖŞÜ]/;
const LATIN_WORD = /[A-Za-zÀ-ÿ]/;

/**
 * @param {string} text
 * @returns {'tr-TR'|'en-US'}
 */
export function detectLaraSpeechLanguage(text: string): 'tr-TR' | 'en-US' {
  const sample = String(text || '').trim();
  if (!sample) return 'tr-TR';

  if (TR_CHARS.test(sample)) return 'tr-TR';

  const letters = sample.replace(/[^A-Za-zÀ-ÿçğıöşüÇĞİÖŞÜ]/g, '');
  if (!letters) return 'tr-TR';

  // ASCII-heavy English-looking text without Turkish letters → en-US
  const asciiLetters = (sample.match(/[A-Za-z]/g) || []).length;
  const nonAsciiLatin = (sample.match(/[À-ÿ]/g) || []).length;
  if (asciiLetters >= 12 && nonAsciiLatin === 0 && LATIN_WORD.test(sample)) {
    return 'en-US';
  }

  return 'tr-TR';
}

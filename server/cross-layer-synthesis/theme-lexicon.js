/**
 * Theme tokens for comparable cross-layer matching.
 * Matching is lexical/semantic-light — not theological or astrological authority.
 */

/** @type {Record<string, string[]>} */
export const THEME_TOKENS = Object.freeze({
  responsibility: [
    'sorumluluk',
    'sonuç',
    'hesap',
    'accountability',
    'responsibility',
    'consequence',
    'emanet',
  ],
  patience: ['sabır', 'sabırlı', 'patience', 'bekleme', 'temkin', 'yavaş'],
  haste: ['acele', 'acelecilik', 'haste', 'hız', 'impulsive', 'aceleci'],
  action: ['hareket', 'girişim', 'eylem', 'action', 'initiative', 'ileri'],
  withdrawal: ['içe dönüş', 'geri çekilme', 'withdrawal', 'yalnız', 'inziva'],
  balance: ['denge', 'balance', 'ölçü', 'itidal', 'orta'],
  reflection: ['düşünme', 'tefekkür', 'reflection', 'gözlem', 'farkındalık'],
  decision: ['karar', 'seçim', 'decision', 'tercih'],
  transformation: ['dönüşüm', 'yenilenme', 'transformation', 'değişim'],
  tension: ['gerilim', 'çatışma', 'tension', 'zıt', 'ikilem'],
  care: ['şefkat', 'koruma', 'care', 'merhamet', 'güvenlik'],
  warning: ['uyarı', 'dikkat', 'caution', 'sınır', 'risk'],
});

/**
 * Normalize free text into theme ids present in THEME_TOKENS.
 * @param {string|string[]} input
 * @returns {string[]}
 */
export function extractThemeIds(input) {
  const texts = Array.isArray(input) ? input : [input];
  const joined = texts
    .filter((t) => typeof t === 'string')
    .join(' ')
    .toLocaleLowerCase('tr-TR');
  if (!joined.trim()) return [];

  const found = [];
  for (const [id, tokens] of Object.entries(THEME_TOKENS)) {
    if (tokens.some((tok) => joined.includes(tok.toLocaleLowerCase('tr-TR')))) {
      found.push(id);
    }
  }
  return found;
}

/**
 * Also keep raw theme phrases (lowercased, trimmed) for overlap checks.
 * @param {string[]} themes
 * @returns {string[]}
 */
export function normalizeThemePhrases(themes) {
  if (!Array.isArray(themes)) return [];
  return themes
    .map((t) => String(t).trim().toLocaleLowerCase('tr-TR'))
    .filter(Boolean);
}

/**
 * @param {string[]} a
 * @param {string[]} b
 * @returns {string[]}
 */
export function intersectStrings(a, b) {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

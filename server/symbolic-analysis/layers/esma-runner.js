/**
 * Esmaül Hüsna layer runner — deterministic theme matching.
 * Suggests reflective names; never medical/psychological treatment; no divine decree.
 */

import { ESMA_CATALOG, INTENTION_THEME_HINTS } from '../data/esma-catalog.js';
import { isSymbolicMetadataV2Enabled } from '../methodology-ids.js';

export const ESMA_SOURCE = 'atlas-names-motif-v1';
export const ESMA_METHOD = 'theme-intention-catalog-match';

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractIntentionThemes(text) {
  const lower = String(text || '').toLocaleLowerCase('tr-TR');
  const themes = new Set();
  for (const [key, vals] of Object.entries(INTENTION_THEME_HINTS)) {
    if (lower.includes(key)) {
      for (const v of vals) themes.add(v);
    }
  }
  return [...themes];
}

/**
 * Stable hash for name → catalog offset (deterministic, not mystical).
 * @param {string} text
 */
function nameOffset(text) {
  let h = 0;
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * @param {import('../capability.js').SymbolicInput} input
 * @param {{ reducedDigit?: number|null, themes?: string[] }} [context]
 */
export function runEsmaLayer(input = {}, context = {}) {
  const name = String(input.name || input.fullName || '').trim();
  if (!name) {
    const err = new Error('ESMA_MISSING_NAME');
    err.code = 'ESMA_MISSING_NAME';
    throw err;
  }

  const intentionThemes = extractIntentionThemes(input.intention || '');
  const contextThemes = Array.isArray(context.themes) ? context.themes : [];
  const seedThemes = [...new Set([...intentionThemes, ...contextThemes])];

  /** @type {Array<{ entry: typeof ESMA_CATALOG[number], score: number }>} */
  const scored = ESMA_CATALOG.map((entry, index) => {
    let score = 0;
    for (const theme of seedThemes) {
      if (entry.themes.some((t) => t.includes(theme) || theme.includes(t))) {
        score += 3;
      }
    }
    // Stable tie-break from name + optional digit
    const digit = Number.isFinite(context.reducedDigit) ? Number(context.reducedDigit) : 0;
    const affinity = (nameOffset(name) + digit + index) % ESMA_CATALOG.length;
    score += affinity === index % ESMA_CATALOG.length ? 1 : 0;
    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score || a.entry.latin.localeCompare(b.entry.latin, 'tr'));

  // If no thematic hit, pick 3 by stable name offset (still deterministic, disclosed).
  const hasThemeHit = scored.some((s) => s.score >= 3);
  let selected;
  if (hasThemeHit) {
    selected = scored.slice(0, 3).map((s) => s.entry);
  } else {
    const start = nameOffset(name) % ESMA_CATALOG.length;
    selected = [0, 1, 2].map((i) => ESMA_CATALOG[(start + i * 7) % ESMA_CATALOG.length]);
  }

  const calculatedData = {
    nameUsed: name,
    intentionProvided: Boolean(input.intention && String(input.intention).trim()),
    seedThemes,
    matchMode: hasThemeHit ? 'theme-overlap' : 'stable-name-offset',
    selected: selected.map((e) => ({
      id: e.id,
      latin: e.latin,
      arabic: e.arabic,
      themes: e.themes,
      orientation: e.orientation,
    })),
    catalogSize: ESMA_CATALOG.length,
  };

  const nameList = selected.map((e) => e.latin).join(', ');
  const orientations = selected.map((e) => e.orientation).join('; ');

  const interpretation = [
    `Sembolik olarak, eldeki niyet ve isim verileriyle şu isimler bir düşünme alanı açabilir: ${nameList}.`,
    `Yönelimler: ${orientations}.`,
    'Bu öneri tıbbi veya psikolojik tedavi değildir; ilahi hüküm veya kesin yönlendirme iddiası taşımaz.',
  ].join(' ');

  const themes = [...new Set(selected.flatMap((e) => e.themes))];

  const limitations = isSymbolicMetadataV2Enabled()
    ? [
        'Katalog tam 99 ismin tamamını kapsamaz; seçilmiş motif setidir.',
        hasThemeHit
          ? 'Eşleme, anahtar kelime ile yapılır; kehanet değildir.'
          : 'Tema bulunamadığında Atlas deneysel kararlı motif seçimi kullanılır; klasik ebced eşlemesi değildir.',
      ]
    : [
        'Katalog tam 99 ismin tamamını kapsamaz; seçilmiş motif setidir.',
        'Eşleme, anahtar kelime ve kararlı ofset ile yapılır; kehanet değildir.',
      ];

  return {
    layerId: 'esma',
    source: ESMA_SOURCE,
    method: ESMA_METHOD,
    calculatedData,
    interpretation,
    themes,
    cautions: [
      'İsim yönelimi zikir veya tedavi reçetesi değildir.',
      'Kullanıcının kritik kararlarının yerine geçmez.',
    ],
    // LEGACY_CONFIDENCE_STILL_PRESENT
    confidence: hasThemeHit ? 'medium' : 'low',
    limitations,
  };
}

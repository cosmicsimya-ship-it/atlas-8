/**
 * Quran layer safety — validation without shipping canonical mushaf/meal corpora.
 * Verse text must come from an injected store; fabricated Arabic/meal is refused.
 */

import { makeNormalizedLayer } from './schema.js';

/** Hafs standard ayah counts (structure only — not mushaf text). */
export const SURAH_AYAH_COUNTS = Object.freeze([
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53,
  89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12,
  12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26,
  30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
]);

/**
 * @param {number} surah
 * @param {number} ayah
 * @returns {{ ok: boolean, verseKey: string|null, error: string|null }}
 */
export function validateVerseReference(surah, ayah) {
  const s = Number(surah);
  const a = Number(ayah);
  if (!Number.isInteger(s) || s < 1 || s > 114) {
    return { ok: false, verseKey: null, error: 'invalid_surah' };
  }
  const max = SURAH_AYAH_COUNTS[s - 1];
  if (!Number.isInteger(a) || a < 1 || a > max) {
    return { ok: false, verseKey: null, error: 'invalid_ayah' };
  }
  return { ok: true, verseKey: `${s}:${a}`, error: null };
}

/**
 * Parse "2:255", "Bakara 255", "sure 2 ayet 255" loosely.
 * @param {string|object} ref
 * @returns {{ surah: number|null, ayah: number|null, raw: string }}
 */
export function parseVerseRef(ref) {
  if (ref && typeof ref === 'object') {
    return {
      surah: ref.surah != null ? Number(ref.surah) : null,
      ayah: ref.ayah != null ? Number(ref.ayah) : null,
      raw: ref.verseKey ? String(ref.verseKey) : `${ref.surah}:${ref.ayah}`,
    };
  }
  const raw = String(ref ?? '').trim();
  const m = raw.match(/(\d{1,3})\s*[:/.\s]\s*(\d{1,3})/);
  if (m) {
    return { surah: Number(m[1]), ayah: Number(m[2]), raw };
  }
  return { surah: null, ayah: null, raw };
}

/**
 * @typedef {{
 *   getVerse: (verseKey: string) => ({
 *     arabic?: string|null,
 *     translation?: string|null,
 *     translationSource?: string|null,
 *     previous?: { verseKey: string, translation?: string|null }|null,
 *     next?: { verseKey: string, translation?: string|null }|null,
 *     hasTafsir?: boolean,
 *   }|null)
 * }} VerseStore
 */

/**
 * Build a safe Quran normalized layer. Never invents verse text.
 * @param {object} input
 * @param {string|object} input.reference
 * @param {string} [input.selectionMethod]
 * @param {string} [input.userContext]
 * @param {string} [input.claimedArabic]
 * @param {string} [input.claimedTranslation]
 * @param {VerseStore|null} [verseStore]
 * @returns {{ layer: import('./schema.js').NormalizedLayer|null, errors: string[], rejectedFabrication: boolean }}
 */
export function buildQuranLayer(input, verseStore = null) {
  const errors = [];
  let rejectedFabrication = false;
  const parsed = parseVerseRef(input?.reference);
  if (parsed.surah == null || parsed.ayah == null) {
    return {
      layer: null,
      errors: ['unparseable_reference'],
      rejectedFabrication: false,
    };
  }

  const validation = validateVerseReference(parsed.surah, parsed.ayah);
  if (!validation.ok) {
    return {
      layer: null,
      errors: [validation.error],
      rejectedFabrication: false,
    };
  }

  const verseKey = validation.verseKey;
  const stored = verseStore?.getVerse?.(verseKey) ?? null;

  if (input?.claimedArabic && stored?.arabic) {
    const normalizeAr = (s) => String(s).replace(/\s+/g, '').trim();
    if (normalizeAr(input.claimedArabic) !== normalizeAr(stored.arabic)) {
      rejectedFabrication = true;
      errors.push('fabricated_arabic_rejected');
    }
  } else if (input?.claimedArabic && !stored?.arabic) {
    rejectedFabrication = true;
    errors.push('arabic_without_verified_source_rejected');
  }

  if (input?.claimedTranslation && stored?.translation) {
    if (String(input.claimedTranslation).trim() !== String(stored.translation).trim()) {
      // Prefer store; mark caution rather than inventing.
      errors.push('claimed_translation_differs_from_store');
    }
  } else if (input?.claimedTranslation && !stored?.translation) {
    rejectedFabrication = true;
    errors.push('translation_without_verified_source_rejected');
  }

  if (rejectedFabrication && (errors.includes('fabricated_arabic_rejected') || errors.includes('arabic_without_verified_source_rejected') || errors.includes('translation_without_verified_source_rejected'))) {
    return {
      layer: makeNormalizedLayer({
        layerId: 'quran',
        layerType: 'quran',
        source: 'quran-safety-gate',
        method: 'reference-validation',
        input: { reference: parsed.raw, verseKey },
        normalizedFacts: { verseKey, validReference: true, textAvailable: false },
        themes: [],
        tensions: [],
        cautions: [
          'Uydurma veya doğrulanmamış âyet metni reddedildi.',
          'Kur’an metni yalnızca doğrulanmış kaynaktan gösterilir.',
        ],
        confidence: 'insufficient',
        temporalScope: null,
        citationsOrReferences: [{ kind: 'verse_key', ref: verseKey, note: 'reference valid; text withheld' }],
        interpretation: null,
        limitations: ['Metin kaynağı doğrulanamadı; yorum üretilmedi.'],
        status: 'error',
        visibility: {
          computed: [`verse_key=${verseKey} yapısal olarak geçerli`],
          interpreted: [],
          symbolic: [],
        },
      }),
      errors,
      rejectedFabrication: true,
    };
  }

  const translation = stored?.translation ?? null;
  const arabic = stored?.arabic ?? null;
  const translationSource = stored?.translationSource ?? null;
  const hasTafsir = Boolean(stored?.hasTafsir);

  const selectionMethod = input?.selectionMethod ?? 'unspecified';
  const cautions = [
    'Tarih/sayı eşlemesiyle ayet seçimi sembolik bir kullanıcı yöntemidir; ilahi mesaj iddiası değildir.',
    'Seçilen ayet “bugün için kesin ilahi hüküm” olarak sunulmaz.',
    'Kur’an katmanı astroloji veya numeroloji tarafından doğrulanmış gibi sunulmaz.',
  ];
  if (!hasTafsir) {
    cautions.push('Tefsir kaynağı yok; tefsirmiş gibi yorum yapılmaz.');
  }
  if (!arabic && !translation) {
    cautions.push('Doğrulanmış meal/Arapça metin yok; yalnızca referans ve metodolojik sınırlar raporlanır.');
  }

  const themes = Array.isArray(input?.themes) ? input.themes : [];
  const interpretationParts = [];
  if (translation) {
    interpretationParts.push(`Meal (${translationSource ?? 'kaynak belirtilmeli'}): ${translation}`);
  }
  if (typeof input?.interpretation === 'string' && input.interpretation.trim()) {
    interpretationParts.push(
      `Yorum (tefsir değil, kullanıcı bağlamlı düşünme notu): ${input.interpretation.trim()}`,
    );
  }

  const citations = [{ kind: 'verse_key', ref: verseKey, note: 'validated surah:ayah' }];
  if (translationSource) {
    citations.push({ kind: 'translation_source', ref: translationSource });
  }
  if (stored?.previous?.verseKey) {
    citations.push({
      kind: 'context_previous',
      ref: stored.previous.verseKey,
      note: stored.previous.translation ? 'önceki ayet meal özeti mevcut' : 'önceki ayet anahtarı',
    });
  }
  if (stored?.next?.verseKey) {
    citations.push({
      kind: 'context_next',
      ref: stored.next.verseKey,
      note: stored.next.translation ? 'sonraki ayet meal özeti mevcut' : 'sonraki ayet anahtarı',
    });
  }

  const layer = makeNormalizedLayer({
    layerId: 'quran',
    layerType: 'quran',
    source: translationSource ?? 'quran-reference-only',
    method: selectionMethod,
    input: {
      reference: parsed.raw,
      verseKey,
      selectionMethod,
      userContext: input?.userContext ?? null,
    },
    normalizedFacts: {
      verseKey,
      surah: parsed.surah,
      ayah: parsed.ayah,
      arabic: arabic ?? null,
      translation: translation ?? null,
      translationSource,
      arabicSeparatedFromTranslation: true,
      previousVerseKey: stored?.previous?.verseKey ?? null,
      nextVerseKey: stored?.next?.verseKey ?? null,
      hasTafsir,
      selectionIsSymbolicMethod: true,
    },
    themes,
    tensions: Array.isArray(input?.tensions) ? input.tensions : [],
    cautions,
    confidence: translation || arabic ? 'medium' : 'low',
    temporalScope: input?.temporalScope ?? null,
    citationsOrReferences: citations,
    interpretation: interpretationParts.length ? interpretationParts.join('\n') : null,
    limitations: [
      'Metodolojik olarak diğer sembolik katmanlardan ayrıdır.',
      'Bağlamından kopuk kesin hüküm üretilmez.',
      ...(Array.isArray(input?.limitations) ? input.limitations : []),
    ],
    status: translation || arabic || themes.length ? 'success' : 'partial',
    visibility: {
      computed: [
        `verse_key=${verseKey}`,
        'surah/ayah yapısal doğrulama',
        ...(arabic ? ['Arapça metin (doğrulanmış kaynak)'] : []),
        ...(translation ? [`Meal metni (${translationSource ?? 'kaynak'})`] : []),
      ],
      interpreted: interpretationParts.length
        ? ['Kullanıcı bağlamlı düşünme notu (tefsir değil)']
        : [],
      symbolic: [
        'Tarih/sayı → ayet eşlemesi sembolik yöntemdir',
      ],
    },
  });

  return { layer, errors, rejectedFabrication: false };
}

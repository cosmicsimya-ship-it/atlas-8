/**
 * Classical Ebced-i Kebîr (Eastern) values for ruleset classical-kabir-rules-1.0.0.
 *
 * MUST NOT be confused with production ARABIC_ABJAD in ebced-table.js
 * (legacy maps آ=1; classical expands آ→ا+ا).
 */

/** Base countable letters after ADR-005 normalization folds. */
export const CLASSICAL_KABIR_VALUES = Object.freeze({
  ا: 1,
  ب: 2,
  ج: 3,
  د: 4,
  ه: 5,
  و: 6,
  ز: 7,
  ح: 8,
  ط: 9,
  ي: 10,
  ك: 20,
  ل: 30,
  م: 40,
  ن: 50,
  س: 60,
  ع: 70,
  ف: 80,
  ص: 90,
  ق: 100,
  ر: 200,
  ش: 300,
  ت: 400,
  ث: 500,
  خ: 600,
  ذ: 700,
  ض: 800,
  ظ: 900,
  غ: 1000,
  /** Atlas v1 product decision — zero-value-but-traced (ADR-005). */
  ء: 0,
});

/** Harakat / vocalization marks — ignore (not counted). */
export const CLASSICAL_HARAKAT = Object.freeze(
  new Set([
    '\u064B', // FATHATAN
    '\u064C', // DAMMATAN
    '\u064D', // KASRATAN
    '\u064E', // FATHA
    '\u064F', // DAMMA
    '\u0650', // KASRA
    '\u0652', // SUKUN
    '\u0670', // ARABIC LETTER SUPERSCRIPT ALEF
  ]),
);

export const CLASSICAL_SHADDA = '\u0651';
export const CLASSICAL_TATWIL = '\u0640';

/**
 * Presentation-form lam-alif ligatures → ل + ا (and carrier variants).
 * Decomposed before value lookup.
 */
export const CLASSICAL_LAM_ALIF_LIGATURES = Object.freeze({
  '\uFEFB': ['ل', 'ا'], // ﻻ
  '\uFEFC': ['ل', 'ا'], // ﻼ
  '\uFEF7': ['ل', 'ا'], // ﻷ (lam + alif with hamza above → ا after carrier fold)
  '\uFEF8': ['ل', 'ا'], // ﻸ
  '\uFEF9': ['ل', 'ا'], // ﻹ
  '\uFEFA': ['ل', 'ا'], // ﻺ
  '\uFEF5': ['ل', 'ا'], // ﻵ → classical آ path is separate; treat as ل+ا then آ would be elsewhere
  '\uFEF6': ['ل', 'ا'], // ﻶ
});

/**
 * Carrier / fold maps applied after shadda expand, before value lookup.
 * آ is handled as expand-to-two-alifs (not a 1:1 fold).
 */
export const CLASSICAL_CARRIER_FOLDS = Object.freeze({
  أ: { to: 'ا', rule: 'hamza-carrier-alif' },
  إ: { to: 'ا', rule: 'hamza-carrier-alif' },
  ؤ: { to: 'و', rule: 'hamza-carrier-waw' },
  ئ: { to: 'ي', rule: 'hamza-carrier-ya' },
  ة: { to: 'ه', rule: 'ta-marbuta-to-ha' },
  ى: { to: 'ي', rule: 'alif-maqsura-to-ya' },
  پ: { to: 'ب', rule: 'persian-fold-pe' },
  چ: { to: 'ج', rule: 'persian-fold-che' },
  ژ: { to: 'ز', rule: 'persian-fold-zhe' },
  گ: { to: 'ك', rule: 'persian-fold-gaf' },
  /**
   * Farsi Yeh (U+06CC) glyph-folded to Arabic Yeh — same letter, font/keyboard
   * variant. Found via EBCED HESAPLAMA TABLOSU.xlsx cross-check: 3 of 99 Esma
   * catalog rows (Bari, Kerim, Mütaali) used ی where ي was intended, which
   * otherwise fails as an unsupported character despite being the same value.
   */
  ی: { to: 'ي', rule: 'farsi-yeh-fold' },
});

export const ALIF_MADDA = 'آ';

export const ALIF_MADDA_USER_MESSAGE =
  'Bu hesapta maddeli elif (آ), Atlas klasik ruleset’inde iki elif (ا+ا) olarak sayılır. Bazı tablolar آ’yı tek birim (1) sayar; bu sürüm onlardan farklılaşabilir. Bu bir Atlas ruleset seçimidir; tek evrensel klasik kural iddiası taşımaz. Toplam, onayladığınız Arapça yazıma göredir.';

export const STANDALONE_HAMZA_POLICY = Object.freeze({
  policy: 'zero-value-but-traced',
  value: 0,
  keepInTrace: true,
  uiOfferCountAsOneInV1: false,
  atlasProductDecision: true,
  rulesetNote: 'Atlas v1 ruleset decision — not universal classical consensus',
});

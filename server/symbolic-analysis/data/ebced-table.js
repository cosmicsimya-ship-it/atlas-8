/**
 * Classical Abjad letter values + Latin/Turkish transliteration map.
 * Deterministic arithmetic only — not a prophetic engine.
 */

/** Arabic Abjad (Eastern) values — keys are Arabic letters. */
export const ARABIC_ABJAD = Object.freeze({
  ا: 1,
  أ: 1,
  إ: 1,
  آ: 1,
  ب: 2,
  ج: 3,
  د: 4,
  ه: 5,
  ة: 5,
  و: 6,
  ز: 7,
  ح: 8,
  ط: 9,
  ي: 10,
  ى: 10,
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
});

/**
 * Latin / Turkish letter → Abjad-style value (common name-analysis table).
 * Digits ignored; punctuation ignored.
 */
export const LATIN_ABJAD = Object.freeze({
  a: 1,
  b: 2,
  c: 3,
  ç: 3,
  d: 4,
  e: 5,
  f: 6,
  g: 7,
  ğ: 7,
  h: 8,
  ı: 9,
  i: 9,
  î: 9,
  j: 10,
  k: 20,
  l: 30,
  m: 40,
  n: 50,
  o: 60,
  ö: 60,
  p: 70,
  q: 80,
  r: 90,
  s: 100,
  ş: 100,
  t: 200,
  u: 300,
  ü: 300,
  û: 300,
  v: 400,
  w: 400,
  x: 500,
  y: 600,
  z: 700,
});

/** Single-digit symbolic motifs (interpretive aids, not fate claims). */
export const DIGIT_MOTIFS = Object.freeze({
  1: {
    themes: ['başlangıç', 'odak', 'karar'],
    motif: 'tekil odak ve yeni bir yön',
  },
  2: {
    themes: ['denge', 'ilişki', 'dinleme'],
    motif: 'ikilik içinde denge arayışı',
  },
  3: {
    themes: ['ifade', 'hareket', 'paylaşım'],
    motif: 'ifade ve paylaşım ritmi',
  },
  4: {
    themes: ['yapı', 'sorumluluk', 'temel'],
    motif: 'yapı kurma ve sabitleme',
  },
  5: {
    themes: ['değişim', 'esneklik', 'geçiş'],
    motif: 'değişim ve esnek geçiş',
  },
  6: {
    themes: ['şefkat', 'sorumluluk', 'koruma'],
    motif: 'bakım ve sorumluluk alanı',
  },
  7: {
    themes: ['tefekkür', 'içe dönüş', 'derinlik'],
    motif: 'içe bakış ve tefekkür',
  },
  8: {
    themes: ['güç', 'düzen', 'sonuç'],
    motif: 'düzen ve sonuç bilinci',
  },
  9: {
    themes: ['tamamlanma', 'şefkat', 'bırakma'],
    motif: 'tamamlama ve bırakma',
  },
});

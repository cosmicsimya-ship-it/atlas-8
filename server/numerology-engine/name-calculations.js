/**
 * Pythagorean name numerology (A=1…Z=8 cycle).
 * Only computed when a usable full name is provided — never guessed.
 */
import { reduceWithTrace } from './reduce.js';
import { ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY } from './methodology.js';

/** Latin + Turkish letter map (Pythagorean 1–9). */
const LETTER_VALUE = Object.freeze({
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
  i: 9,
  ı: 9,
  j: 1,
  k: 2,
  l: 3,
  m: 4,
  n: 5,
  o: 6,
  ö: 6,
  p: 7,
  q: 8,
  r: 9,
  s: 1,
  ş: 1,
  t: 2,
  u: 3,
  ü: 3,
  v: 4,
  w: 5,
  x: 6,
  y: 7,
  z: 8,
});

const VOWELS = new Set(['a', 'e', 'i', 'ı', 'o', 'ö', 'u', 'ü']);

/**
 * @param {string} name
 */
export function normalizeNameForNumerology(name) {
  return String(name ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * @param {string} ch
 */
function letterValue(ch) {
  const lower = ch.toLocaleLowerCase('tr-TR');
  return LETTER_VALUE[lower] ?? null;
}

/**
 * @param {string} name
 * @param {'all'|'vowels'|'consonants'} mode
 * @param {{ keepMaster?: boolean }} [opts]
 */
function sumLetters(name, mode, opts = {}) {
  const chars = [...normalizeNameForNumerology(name)];
  /** @type {Array<{ char: string, value: number }>} */
  const used = [];
  let sum = 0;
  for (const ch of chars) {
    if (/\s/.test(ch)) continue;
    const v = letterValue(ch);
    if (v == null) continue;
    const lower = ch.toLocaleLowerCase('tr-TR');
    const isVowel = VOWELS.has(lower);
    if (mode === 'vowels' && !isVowel) continue;
    if (mode === 'consonants' && isVowel) continue;
    used.push({ char: ch, value: v });
    sum += v;
  }
  const trace = reduceWithTrace(sum, opts);
  return {
    ...trace,
    sum,
    letters: used,
    formula:
      used.length > 0
        ? `${used.map((u) => `${u.char}(${u.value})`).join('+')}=${sum}`
        : 'empty',
  };
}

/**
 * @param {string|null|undefined} fullName
 * @param {{ lifePathValue?: number|null, keepMaster?: boolean }} [opts]
 */
export function computeNameNumerologyChart(fullName, opts = {}) {
  const name = normalizeNameForNumerology(fullName);
  if (!name || name.length < 2) {
    return {
      ok: false,
      error: 'MISSING_NAME',
      methodologyId: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
    };
  }

  const reduceOpts = { keepMaster: opts.keepMaster !== false };
  const expression = sumLetters(name, 'all', reduceOpts);
  const soulUrge = sumLetters(name, 'vowels', reduceOpts);
  const personality = sumLetters(name, 'consonants', reduceOpts);

  let maturity = null;
  if (opts.lifePathValue != null && Number.isFinite(opts.lifePathValue)) {
    const total = Number(opts.lifePathValue) + expression.value;
    maturity = {
      kind: 'maturity',
      ...reduceWithTrace(total, reduceOpts),
      formula: `lifePath(${opts.lifePathValue})+expression(${expression.value})=${total}`,
    };
  }

  const presentLetterValues = new Set(expression.letters.map((l) => l.value));
  const missingLetterVibrations = [];
  for (let i = 1; i <= 9; i += 1) {
    if (!presentLetterValues.has(i)) missingLetterVibrations.push(i);
  }

  return {
    ok: true,
    methodologyId: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
    fullName: name,
    expression: { kind: 'expression', ...expression },
    soulUrge: { kind: 'soulUrge', ...soulUrge },
    personality: { kind: 'personality', ...personality },
    maturity,
    vowelCount: soulUrge.letters.length,
    consonantCount: personality.letters.length,
    missingLetterVibrations,
    note: 'Pythagorean Latin/Turkish letter values; not classical abjad.',
  };
}

/**
 * Name ↔ birth date harmony note (deterministic comparison, not judgment).
 * @param {object} birthChart
 * @param {object} nameChart
 */
export function analyzeNameBirthHarmony(birthChart, nameChart) {
  if (!birthChart?.ok || !nameChart?.ok) return null;
  const lp = birthChart.lifePath.value;
  const expr = nameChart.expression.value;
  const soul = nameChart.soulUrge.value;
  const tensions = [];
  const alignments = [];

  if (lp === expr) {
    alignments.push({
      pair: 'lifePath-expression',
      note: 'Yaşam yolu ile ifade sayısı aynı titreşimde; dışa yansıyan kimlik ile yol çizgisi örtüşüyor.',
    });
  } else {
    tensions.push({
      pair: 'lifePath-expression',
      numbers: [lp, expr],
      note: `Yaşam yolu ${lp} ile ifade ${expr} farklı; iç yol ile dış görünüm arasında gerilim veya tamamlayıcılık olabilir.`,
    });
  }

  if (soul === birthChart.birthday.value) {
    alignments.push({
      pair: 'soulUrge-birthday',
      note: 'Ruh arzusu ile doğum günü sayısı örtüşüyor; özel gün enerjisi iç motivasyonla hizalı.',
    });
  }

  return { alignments, tensions };
}

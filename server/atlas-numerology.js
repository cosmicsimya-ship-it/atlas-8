// Numerology helpers for daily symbolic analysis (deterministic arithmetic).

/**
 * Digit-sum reduction to a single digit, preserving master numbers 11/22 optionally.
 * @param {number} n
 * @param {{ keepMaster?: boolean }} [opts]
 */
export function reduceNumber(n, opts = {}) {
  let x = Math.abs(Math.floor(n));
  while (x > 9) {
    if (opts.keepMaster && (x === 11 || x === 22 || x === 33)) return x;
    x = String(x)
      .split('')
      .reduce((s, d) => s + Number(d), 0);
  }
  return x;
}

/**
 * Day number from Gregorian Y-M-D (sum all digits, reduce).
 * @param {number} year
 * @param {number} month
 * @param {number} day
 */
export function numerologyDayNumber(year, month, day) {
  const digits = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`
    .split('')
    .map(Number);
  const sum = digits.reduce((a, b) => a + b, 0);
  const steps = [`${digits.join('+')}=${sum}`];
  let current = sum;
  while (current > 9 && current !== 11 && current !== 22) {
    const next = String(current)
      .split('')
      .reduce((s, d) => s + Number(d), 0);
    steps.push(`${current}→${next}`);
    current = next;
  }
  return {
    dayNumber: current,
    sum,
    steps,
    formula: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

/**
 * @param {{ year: number, month: number, day: number }} gregorian
 */
export function formatNumerologyDataBlock(gregorian) {
  const calc = numerologyDayNumber(gregorian.year, gregorian.month, gregorian.day);
  return `## VERIFIED NUMEROLOGY DATA
Tarih: ${calc.formula}
Hesap adımları: ${calc.steps.join(' ; ')}
Günün numeroloji sayısı: ${calc.dayNumber}
Kurallar: Bu hesabı değiştirme; işlemi gerektiğinde kısaca göster.`;
}

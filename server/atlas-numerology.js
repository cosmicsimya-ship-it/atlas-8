// Numerology helpers for daily symbolic analysis (deterministic arithmetic).

/**
 * Digit-sum reduction to a single digit, optionally preserving master numbers.
 * @param {number} n
 * @param {{ keepMaster?: boolean, masterNumbers?: number[] }} [opts]
 */
export function reduceNumber(n, opts = {}) {
  const masters = new Set(
    (opts.masterNumbers ?? [11, 22, 33]).map(Number).filter((x) => Number.isFinite(x)),
  );
  let x = Math.abs(Math.floor(n));
  while (x > 9) {
    if (opts.keepMaster !== false && masters.has(x)) return x;
    x = String(x)
      .split('')
      .reduce((s, d) => s + Number(d), 0);
  }
  return x;
}

/**
 * Reduce with steps.
 * @param {number} sum
 * @param {{ keepMaster?: boolean, masterNumbers?: number[] }} [opts]
 */
function reduceWithSteps(sum, opts = {}) {
  const masters = new Set(
    (opts.masterNumbers ?? [11, 22, 33]).map(Number).filter((x) => Number.isFinite(x)),
  );
  const keepMaster = opts.keepMaster !== false;
  const steps = [];
  let current = sum;
  while (current > 9 && !(keepMaster && masters.has(current))) {
    const next = String(current)
      .split('')
      .reduce((s, d) => s + Number(d), 0);
    steps.push(`${current}→${next}`);
    current = next;
  }
  return {
    dayNumber: current,
    steps,
    isMasterNumber: keepMaster && masters.has(current),
    masterNumbers: [...masters],
    keepMaster,
  };
}

/**
 * Day number from calendar Y-M-D (sum all digits, reduce).
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {{ keepMaster?: boolean, masterNumbers?: number[] }} [opts]
 */
export function numerologyDayNumber(year, month, day, opts = {}) {
  const digits = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`
    .split('')
    .map(Number);
  const sum = digits.reduce((a, b) => a + b, 0);
  const steps = [`${digits.join('+')}=${sum}`];
  const reduced = reduceWithSteps(sum, opts);
  return {
    inputDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    rawDigits: digits,
    dayNumber: reduced.dayNumber,
    reducedNumber: reduced.dayNumber,
    intermediateTotal: sum,
    sum,
    steps: [...steps, ...reduced.steps],
    calculationSteps: [...steps, ...reduced.steps],
    isMasterNumber: reduced.isMasterNumber,
    masterNumbers: reduced.masterNumbers,
    keepMaster: reduced.keepMaster,
    methodName: 'digit-sum-reduce',
    formula: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    calendar: 'gregorian',
  };
}

/**
 * Hijri day number — same arithmetic on Hijri Y-M-D digits.
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {{ keepMaster?: boolean, masterNumbers?: number[] }} [opts]
 */
export function numerologyHijriDayNumber(year, month, day, opts = {}) {
  const base = numerologyDayNumber(year, month, day, opts);
  return {
    ...base,
    calendar: 'hijri',
  };
}

/**
 * Unified symbolic number from Gregorian + Hijri day numbers (deterministic).
 * Formula: reduce(gregorianDayNumber + hijriDayNumber).
 * @param {{ dayNumber: number }} gregorian
 * @param {{ dayNumber: number }} hijri
 * @param {{ keepMaster?: boolean, masterNumbers?: number[] }} [opts]
 */
export function numerologyUnifiedDayNumber(gregorian, hijri, opts = {}) {
  const g = Number(gregorian?.dayNumber);
  const h = Number(hijri?.dayNumber);
  if (!Number.isFinite(g) || !Number.isFinite(h)) {
    return { ok: false, error: 'INVALID_INPUT' };
  }
  const sum = g + h;
  const reduced = reduceWithSteps(sum, opts);
  return {
    ok: true,
    unifiedNumber: reduced.dayNumber,
    combinedReducedNumber: reduced.dayNumber,
    combinedRawTotal: sum,
    sum,
    steps: [`${g}+${h}=${sum}`, ...reduced.steps],
    calculationSteps: [`${g}+${h}=${sum}`, ...reduced.steps],
    formula: `gregorian(${g})+hijri(${h})`,
    method: 'sum-then-reduce',
    gregorianDayNumber: g,
    hijriDayNumber: h,
    gregorianNumber: g,
    hijriNumber: h,
    isMasterNumber: reduced.isMasterNumber,
    masterNumbers: reduced.masterNumbers,
    keepMaster: reduced.keepMaster,
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

/**
 * Dual Gregorian + Hijri + unified verified block.
 * @param {{ year: number, month: number, day: number }} gregorian
 * @param {{ year: number, month: number, day: number }} hijri
 */
export function formatDualNumerologyDataBlock(gregorian, hijri) {
  const g = numerologyDayNumber(gregorian.year, gregorian.month, gregorian.day);
  const h = numerologyHijriDayNumber(hijri.year, hijri.month, hijri.day);
  const u = numerologyUnifiedDayNumber(g, h);
  return `## VERIFIED NUMEROLOGY DATA
Miladi tarih: ${g.formula}
Miladi hesap: ${g.steps.join(' ; ')}
Miladi gün sayısı: ${g.dayNumber}
Hicri tarih: ${h.formula}
Hicri hesap: ${h.steps.join(' ; ')}
Hicri gün sayısı: ${h.dayNumber}
Birleşik formül: ${u.ok ? u.formula : 'n/a'}
Birleşik adımlar: ${u.ok ? u.steps.join(' ; ') : 'n/a'}
Birleşik sayı: ${u.ok ? u.unifiedNumber : 'n/a'}
Kurallar: Bu hesapları değiştirme; yorumu sayıdan ayrı tut.`;
}

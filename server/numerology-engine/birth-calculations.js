/**
 * Deterministic birth-date Pythagorean calculations.
 * Life path arithmetic matches lifePathFromBirthDate / digit-sum-reduce.
 */
import { parseBirthDateParts, ageFromBirthDate } from '../self-profile-resolver.js';
import { reduceWithTrace, sumDigitsOf, challengeDiff } from './reduce.js';
import { ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY, MASTER_NUMBERS } from './methodology.js';

/**
 * @param {{ y: number, m: number, d: number }} parts
 * @param {{ keepMaster?: boolean }} [opts]
 */
export function computeLifePath(parts, opts = {}) {
  const digitStr = `${parts.y}${String(parts.m).padStart(2, '0')}${String(parts.d).padStart(2, '0')}`;
  const digits = digitStr.split('').map(Number);
  const sum = digits.reduce((a, b) => a + b, 0);
  const trace = reduceWithTrace(sum, opts);
  return {
    kind: 'lifePath',
    ...trace,
    formula: `${digits.join('+')}=${sum}`,
    calculationSteps: [`${digits.join('+')}=${sum}`, ...trace.steps],
    rawDigits: digits,
    intermediateTotal: sum,
  };
}

/**
 * Birthday number — day of month only.
 * @param {{ d: number }} parts
 * @param {{ keepMaster?: boolean }} [opts]
 */
export function computeBirthdayNumber(parts, opts = {}) {
  const trace = reduceWithTrace(parts.d, opts);
  if (parts.d > 9) {
    const digitExpr = String(parts.d).split('').join('+');
    const sum = sumDigitsOf(parts.d);
    return {
      kind: 'birthday',
      ...trace,
      formula: `${digitExpr}=${sum}`,
      calculationSteps: [`${digitExpr}=${sum}`, ...trace.steps],
      dayOfMonth: parts.d,
    };
  }
  return {
    kind: 'birthday',
    ...trace,
    formula: String(parts.d),
    calculationSteps: [String(parts.d)],
    dayOfMonth: parts.d,
  };
}

/**
 * @param {{ m: number }} parts
 * @param {{ keepMaster?: boolean }} [opts]
 */
export function computeMonthVibration(parts, opts = {}) {
  const trace = reduceWithTrace(parts.m, opts);
  const sum = sumDigitsOf(parts.m);
  return {
    kind: 'monthVibration',
    ...trace,
    formula: parts.m > 9 ? `${String(parts.m).split('').join('+')}=${sum}` : String(parts.m),
    month: parts.m,
  };
}

/**
 * @param {{ y: number }} parts
 * @param {{ keepMaster?: boolean }} [opts]
 */
export function computeYearVibration(parts, opts = {}) {
  const sum = sumDigitsOf(parts.y);
  const trace = reduceWithTrace(sum, opts);
  return {
    kind: 'yearVibration',
    ...trace,
    formula: `${String(parts.y).split('').join('+')}=${sum}`,
    calculationSteps: [`${String(parts.y).split('').join('+')}=${sum}`, ...trace.steps],
    year: parts.y,
  };
}

/**
 * Life period cycles (Formative / Productive / Harvest).
 * Duration formula: first = 36 − reducedLifePath, second = 27, third = remainder.
 * @param {{ lifePath: ReturnType<typeof computeLifePath>, month: ReturnType<typeof computeMonthVibration>, birthday: ReturnType<typeof computeBirthdayNumber>, year: ReturnType<typeof computeYearVibration>, age: number|null }} input
 */
export function computeLifeCycles(input) {
  const lpReduced =
    input.lifePath.isMaster && input.lifePath.reduced != null
      ? input.lifePath.reduced
      : input.lifePath.value;
  const firstLen = Math.max(18, 36 - Number(lpReduced || 7));
  const secondLen = 27;
  const firstEnd = firstLen - 1;
  const secondStart = firstLen;
  const secondEnd = firstLen + secondLen - 1;
  const thirdStart = firstLen + secondLen;

  const cycles = [
    {
      index: 1,
      name: 'Biçimlenme',
      ageFrom: 0,
      ageTo: firstEnd,
      governingNumber: input.month.value,
      governingDisplay: input.month.display,
      source: 'month',
    },
    {
      index: 2,
      name: 'Üretim',
      ageFrom: secondStart,
      ageTo: secondEnd,
      governingNumber: input.birthday.value,
      governingDisplay: input.birthday.display,
      source: 'birthday',
    },
    {
      index: 3,
      name: 'Hasat',
      ageFrom: thirdStart,
      ageTo: null,
      governingNumber: input.year.value,
      governingDisplay: input.year.display,
      source: 'year',
    },
  ];

  const age = input.age;
  let activeIndex = null;
  if (age != null && Number.isFinite(age)) {
    for (const c of cycles) {
      if (age >= c.ageFrom && (c.ageTo == null || age <= c.ageTo)) {
        activeIndex = c.index;
        break;
      }
    }
  }

  return {
    formula: `firstDuration=36−LP(${lpReduced})=${firstLen}; second=${secondLen}`,
    cycles,
    activeCycleIndex: activeIndex,
    activeCycle: activeIndex ? cycles.find((c) => c.index === activeIndex) : null,
  };
}

/**
 * Four pinnacles + age windows (aligned with life-cycle first duration).
 * @param {{ month: object, birthday: object, year: object, lifePath: object, age: number|null }} input
 * @param {{ keepMaster?: boolean }} [opts]
 */
export function computePinnacles(input, opts = {}) {
  const m = input.month.value;
  const d = input.birthday.value;
  const y = input.year.value;
  const p1 = reduceWithTrace(m + d, opts);
  const p2 = reduceWithTrace(d + y, opts);
  const p3 = reduceWithTrace(p1.value + p2.value, opts);
  const p4 = reduceWithTrace(m + y, opts);

  const lpReduced =
    input.lifePath.isMaster && input.lifePath.reduced != null
      ? input.lifePath.reduced
      : input.lifePath.value;
  const firstLen = Math.max(18, 36 - Number(lpReduced || 7));
  const windows = [
    { from: 0, to: firstLen - 1 },
    { from: firstLen, to: firstLen + 8 },
    { from: firstLen + 9, to: firstLen + 17 },
    { from: firstLen + 18, to: null },
  ];

  const pinnacles = [
    { index: 1, ...p1, formula: `month(${m})+day(${d})`, ageFrom: windows[0].from, ageTo: windows[0].to },
    { index: 2, ...p2, formula: `day(${d})+year(${y})`, ageFrom: windows[1].from, ageTo: windows[1].to },
    {
      index: 3,
      ...p3,
      formula: `pinnacle1(${p1.value})+pinnacle2(${p2.value})`,
      ageFrom: windows[2].from,
      ageTo: windows[2].to,
    },
    { index: 4, ...p4, formula: `month(${m})+year(${y})`, ageFrom: windows[3].from, ageTo: windows[3].to },
  ];

  let activeIndex = null;
  if (input.age != null && Number.isFinite(input.age)) {
    for (const p of pinnacles) {
      if (input.age >= p.ageFrom && (p.ageTo == null || input.age <= p.ageTo)) {
        activeIndex = p.index;
        break;
      }
    }
  }

  return { pinnacles, activePinnacleIndex: activeIndex };
}

/**
 * @param {{ month: object, birthday: object, year: object }} input
 */
export function computeChallenges(input) {
  const m = input.month.value;
  const d = input.birthday.value;
  const y = input.year.value;
  const c1 = challengeDiff(m, d);
  const c2 = challengeDiff(d, y);
  const c3 = challengeDiff(c1.value, c2.value);
  const c4 = challengeDiff(m, y);
  return {
    challenges: [
      { index: 1, ...c1, formula: `|month(${m})−day(${d})|` },
      { index: 2, ...c2, formula: `|day(${d})−year(${y})|` },
      { index: 3, ...c3, formula: `|challenge1(${c1.value})−challenge2(${c2.value})|` },
      { index: 4, ...c4, formula: `|month(${m})−year(${y})|` },
    ],
  };
}

/**
 * Personal year for a given calendar year.
 * @param {{ month: object, birthday: object }} input
 * @param {number} calendarYear
 * @param {{ keepMaster?: boolean }} [opts]
 */
export function computePersonalYear(input, calendarYear, opts = {}) {
  const yearSum = sumDigitsOf(calendarYear);
  const yearTrace = reduceWithTrace(yearSum, opts);
  const total = input.month.value + input.birthday.value + yearTrace.value;
  const trace = reduceWithTrace(total, opts);
  return {
    kind: 'personalYear',
    calendarYear,
    ...trace,
    formula: `month(${input.month.value})+day(${input.birthday.value})+yearDigits(${yearTrace.value})=${total}`,
    calculationSteps: [
      `year ${calendarYear}: ${String(calendarYear).split('').join('+')}=${yearSum}${yearTrace.steps.length ? ' ; ' + yearTrace.steps.join(' ; ') : ''}`,
      `month(${input.month.value})+day(${input.birthday.value})+${yearTrace.value}=${total}`,
      ...trace.steps,
    ],
  };
}

/**
 * Recurring digit motifs across core numbers.
 * @param {Array<{ value: number|null, kind?: string }>} numbers
 */
export function detectRepeatingMotifs(numbers) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const n of numbers) {
    if (n?.value == null) continue;
    const key = String(n.value);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || a.value - b.value);
}

/**
 * Digits 1–9 absent from core birth profile (missing vibrations).
 * @param {Array<{ value: number|null, reduced?: number|null, isMaster?: boolean }>} numbers
 */
export function detectMissingVibrations(numbers) {
  const present = new Set();
  for (const n of numbers) {
    if (n?.value == null) continue;
    if (n.isMaster && n.reduced != null) {
      present.add(n.reduced);
      // also note master components
      for (const ch of String(n.value)) present.add(Number(ch));
    } else {
      present.add(n.value);
    }
  }
  const missing = [];
  for (let i = 1; i <= 9; i += 1) {
    if (!present.has(i)) missing.push(i);
  }
  return missing;
}

/**
 * Full birth-date chart (deterministic).
 * @param {string} birthDate
 * @param {{ now?: Date, timeZone?: string, keepMaster?: boolean, calendarYear?: number }} [opts]
 */
export function computeBirthNumerologyChart(birthDate, opts = {}) {
  const parts = parseBirthDateParts(birthDate);
  if (!parts) {
    return {
      ok: false,
      error: 'INVALID_BIRTH_DATE',
      methodologyId: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
    };
  }

  const reduceOpts = { keepMaster: opts.keepMaster !== false };
  const lifePath = computeLifePath(parts, reduceOpts);
  const birthday = computeBirthdayNumber(parts, reduceOpts);
  const month = computeMonthVibration(parts, reduceOpts);
  const year = computeYearVibration(parts, reduceOpts);
  const age = ageFromBirthDate(birthDate, opts.now ?? new Date(), opts.timeZone ?? 'Europe/Istanbul');
  const lifeCycles = computeLifeCycles({ lifePath, month, birthday, year, age });
  const pinnacles = computePinnacles({ month, birthday, year, lifePath, age }, reduceOpts);
  const challenges = computeChallenges({ month, birthday, year });

  const now = opts.now ?? new Date();
  const calYear =
    opts.calendarYear ??
    Number(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: opts.timeZone ?? 'Europe/Istanbul',
        year: 'numeric',
      }).format(now),
    );
  const personalYear = computePersonalYear({ month, birthday }, calYear, reduceOpts);

  const coreList = [lifePath, birthday, month, year, personalYear];
  const repeatingMotifs = detectRepeatingMotifs(coreList);
  const missingVibrations = detectMissingVibrations(coreList);

  /** @type {number[]} */
  const karmicDebts = [];
  for (const n of [lifePath, birthday, month, year, ...pinnacles.pinnacles]) {
    for (const k of n.karmicDebts || []) {
      if (!karmicDebts.includes(k)) karmicDebts.push(k);
    }
  }

  const masterPresence = [lifePath, birthday, month, year, ...pinnacles.pinnacles]
    .filter((n) => n.isMaster)
    .map((n) => ({ kind: n.kind || `pinnacle${n.index}`, display: n.display, value: n.value }));

  return {
    ok: true,
    methodologyId: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
    methodologyVersion: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyVersion,
    rulesetVersion: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.rulesetVersion,
    school: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.school,
    disclaimer: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.disclaimer,
    birthDate: `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`,
    birthParts: parts,
    age,
    lifePath,
    birthday,
    monthVibration: month,
    yearVibration: year,
    lifeCycles,
    pinnacles: pinnacles.pinnacles,
    activePinnacleIndex: pinnacles.activePinnacleIndex,
    challenges: challenges.challenges,
    personalYear,
    masterPresence,
    karmicDebts,
    repeatingMotifs,
    missingVibrations,
    masterNumbers: [...MASTER_NUMBERS],
  };
}

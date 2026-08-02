/**
 * Shared digit reduction — reuses atlas-numerology arithmetic for compatibility.
 */
import { reduceNumber } from '../atlas-numerology.js';
import { MASTER_NUMBERS, KARMIC_DEBT_NUMBERS } from './methodology.js';

/**
 * @param {number} n
 * @param {{ keepMaster?: boolean, masterNumbers?: number[] }} [opts]
 */
export function reduceDigits(n, opts = {}) {
  return reduceNumber(n, {
    keepMaster: opts.keepMaster !== false,
    masterNumbers: opts.masterNumbers ?? [...MASTER_NUMBERS],
  });
}

/**
 * Full reduction trace with intermediate totals and karmic debt detection.
 * @param {number} sum
 * @param {{ keepMaster?: boolean, masterNumbers?: number[] }} [opts]
 */
export function reduceWithTrace(sum, opts = {}) {
  const masters = new Set(
    (opts.masterNumbers ?? [...MASTER_NUMBERS]).map(Number).filter((x) => Number.isFinite(x)),
  );
  const keepMaster = opts.keepMaster !== false;
  const steps = [];
  /** @type {number[]} */
  const intermediates = [];
  let current = Math.abs(Math.floor(Number(sum)));
  if (!Number.isFinite(current)) {
    return {
      value: null,
      reduced: null,
      display: null,
      steps: [],
      intermediates: [],
      isMaster: false,
      karmicDebts: [],
      keptMaster: false,
    };
  }

  intermediates.push(current);
  /** @type {number[]} */
  const karmicDebts = [];
  if (KARMIC_DEBT_NUMBERS.includes(current)) karmicDebts.push(current);

  while (current > 9 && !(keepMaster && masters.has(current))) {
    const next = String(current)
      .split('')
      .reduce((s, d) => s + Number(d), 0);
    steps.push(`${current}→${next}`);
    if (KARMIC_DEBT_NUMBERS.includes(next) && !karmicDebts.includes(next)) {
      karmicDebts.push(next);
    }
    current = next;
    intermediates.push(current);
  }

  const isMaster = keepMaster && masters.has(current);
  const reducedBase = isMaster
    ? String(current)
        .split('')
        .reduce((s, d) => s + Number(d), 0)
    : current;

  return {
    value: current,
    reduced: isMaster ? reducedBase : current,
    display: isMaster ? `${current}/${reducedBase}` : String(current),
    steps,
    intermediates,
    isMaster,
    karmicDebts,
    keptMaster: isMaster,
  };
}

/**
 * Sum digit characters of a number / padded string.
 * @param {string|number} input
 */
export function sumDigitsOf(input) {
  return String(input)
    .replace(/\D/g, '')
    .split('')
    .reduce((s, d) => s + Number(d), 0);
}

/**
 * Absolute difference then reduce (challenge numbers — masters not preserved by default).
 * @param {number} a
 * @param {number} b
 * @param {{ keepMaster?: boolean }} [opts]
 */
export function challengeDiff(a, b, opts = {}) {
  const diff = Math.abs(Number(a) - Number(b));
  return reduceWithTrace(diff, { keepMaster: opts.keepMaster === true });
}

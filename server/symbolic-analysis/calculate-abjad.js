/**
 * Deterministic classical abjad calculator.
 * LLM MUST NOT invent totals — call this (or tokenizeClassicalSpelling) instead.
 */

import { CLASSICAL_ABJAD_METHODOLOGY } from './methodology-ids.js';
import { tokenizeClassicalSpelling } from './layers/classical-abjad-runner.js';

export const ABJAD_KABIR_CLASSICAL_V1 = CLASSICAL_ABJAD_METHODOLOGY.methodologyId;

/**
 * @typedef {{ letter: string, value: number }} AbjadLetterValue
 *
 * @typedef {{
 *   ok: true,
 *   normalizedText: string,
 *   letters: AbjadLetterValue[],
 *   total: number,
 *   methodologyId: string,
 *   rulesetVersion: string,
 * }} CalculateAbjadSuccess
 *
 * @typedef {{
 *   ok: false,
 *   normalizedText: string,
 *   letters: AbjadLetterValue[],
 *   total: null,
 *   methodologyId: string,
 *   rulesetVersion: string|null,
 *   errorCode: string,
 *   unsupportedCharacters?: string[],
 * }} CalculateAbjadFailure
 */

/**
 * Pure letter-sum under a named methodology. No LLM. No user-claim override.
 *
 * @param {string} arabicText
 * @param {string} [methodologyId]
 * @returns {CalculateAbjadSuccess|CalculateAbjadFailure}
 */
export function calculateAbjad(arabicText, methodologyId = ABJAD_KABIR_CLASSICAL_V1) {
  const method = String(methodologyId || ABJAD_KABIR_CLASSICAL_V1);
  if (method !== ABJAD_KABIR_CLASSICAL_V1) {
    return {
      ok: false,
      normalizedText: '',
      letters: [],
      total: null,
      methodologyId: method,
      rulesetVersion: null,
      errorCode: 'UNSUPPORTED_METHODOLOGY',
    };
  }

  const tokenized = tokenizeClassicalSpelling(arabicText);
  if (!tokenized.ok) {
    return {
      ok: false,
      normalizedText: tokenized.normalizedSpelling || '',
      letters: [],
      total: null,
      methodologyId: method,
      rulesetVersion: CLASSICAL_ABJAD_METHODOLOGY.rulesetVersion,
      errorCode: tokenized.errorCode || 'CLASSICAL_ABJAD_EMPTY',
      unsupportedCharacters: tokenized.unsupportedCharacters || [],
    };
  }

  return {
    ok: true,
    normalizedText: tokenized.normalizedSpelling,
    letters: tokenized.letters.map((l) => ({
      letter: l.normalizedCharacter,
      value: Number(l.value) || 0,
    })),
    total: tokenized.total,
    methodologyId: method,
    rulesetVersion: CLASSICAL_ABJAD_METHODOLOGY.rulesetVersion,
  };
}

/**
 * Format a letter-by-letter breakdown for user-facing / prompt text.
 * @param {AbjadLetterValue[]} letters
 * @param {number} total
 */
export function formatAbjadBreakdown(letters, total) {
  const lines = (letters || []).map((l) => `${l.letter} = ${l.value}`);
  lines.push(`Toplam = ${total}`);
  return lines.join('\n');
}

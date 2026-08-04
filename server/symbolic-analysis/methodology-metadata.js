/**
 * Faz 2 additive methodology metadata builders.
 * Does not alter letter-sum / reduce arithmetic.
 */

import {
  ATLAS_LATIN_MOTIF_METHODOLOGY,
  LATIN_MOTIF_INTERPRETATION_LIMITATIONS,
  CLASSICAL_ABJAD_COMING_SOON,
  isSymbolicMetadataV2Enabled,
} from './methodology-ids.js';
import { ARABIC_ABJAD, LATIN_ABJAD } from './data/ebced-table.js';

/**
 * Additive character trace for reproducibility — does not change sums.
 * Walks the same lookup tables as tokenizeLetters; marks dropped chars.
 * @param {string} text
 */
export function buildLatinMotifCharacterTrace(text) {
  const normalized = String(text || '')
    .normalize('NFC')
    .trim();
  /** @type {Array<{ sourceCharacter: string, normalizedCharacter: string|null, value: number|null, status: 'mapped'|'unsupported'|'ignored', reason?: string }>} */
  const tokenizedLetters = [];
  for (const ch of normalized) {
    const lower = ch.toLocaleLowerCase('tr-TR');
    if (/\s/.test(ch)) {
      tokenizedLetters.push({
        sourceCharacter: ch,
        normalizedCharacter: null,
        value: null,
        status: 'ignored',
        reason: 'whitespace',
      });
      continue;
    }
    if (ARABIC_ABJAD[ch] != null) {
      tokenizedLetters.push({
        sourceCharacter: ch,
        normalizedCharacter: ch,
        value: ARABIC_ABJAD[ch],
        status: 'mapped',
      });
      continue;
    }
    if (LATIN_ABJAD[lower] != null) {
      tokenizedLetters.push({
        sourceCharacter: ch,
        normalizedCharacter: lower,
        value: LATIN_ABJAD[lower],
        status: 'mapped',
      });
      continue;
    }
    // Digits / punctuation / unmapped letters (e.g. â) — previously silent skips
    if (/[\p{P}\p{S}\d]/u.test(ch)) {
      tokenizedLetters.push({
        sourceCharacter: ch,
        normalizedCharacter: null,
        value: null,
        status: 'ignored',
        reason: 'punctuation-or-digit',
      });
      continue;
    }
    tokenizedLetters.push({
      sourceCharacter: ch,
      normalizedCharacter: lower,
      value: null,
      status: 'unsupported',
      reason: 'not-in-atlas-latin-or-arabic-table',
    });
  }
  return tokenizedLetters;
}

/**
 * @param {{
 *   input: { name?: string, fullName?: string|null, intention?: string|null },
 *   calculatedData: object,
 *   locale?: string,
 * }} opts
 */
export function buildLatinMotifMethodologyBundle(opts) {
  const generatedAt = new Date().toISOString();
  const meta = ATLAS_LATIN_MOTIF_METHODOLOGY;
  const primary = String(opts.input.fullName || opts.input.name || '').trim();
  const intention =
    opts.input.intention != null && String(opts.input.intention).trim()
      ? String(opts.input.intention).trim()
      : null;

  const inputSnapshot = {
    originalInput: primary,
    selectedMethodologyId: meta.methodologyId,
    intentionInput: intention,
    locale: opts.locale || 'tr',
  };

  const parts = Array.isArray(opts.calculatedData?.parts) ? opts.calculatedData.parts : [];
  const traceTexts = parts.map((p) => String(p.text || ''));
  // Prefer primary (+ mother parts) for full trace coverage
  const combinedForTrace =
    traceTexts.length > 0 ? traceTexts.join(' ') : primary;
  const tokenizedLetters = buildLatinMotifCharacterTrace(combinedForTrace);

  const total = Number(opts.calculatedData?.totalSum) || 0;
  const reducedDigit = Number(opts.calculatedData?.reducedDigit);

  const reproducibilitySnapshot = {
    inputSnapshot,
    tokenizedLetters,
    total,
    optionalReductions: Number.isFinite(reducedDigit)
      ? [{ method: 'digit-sum', value: reducedDigit }]
      : [],
    methodologyId: meta.methodologyId,
    methodologyVersion: meta.methodologyVersion,
    rulesetVersion: meta.rulesetVersion,
    catalogVersion: null,
    generatedAt,
  };

  const hasUnsupported = tokenizedLetters.some((t) => t.status === 'unsupported');

  return {
    methodologyId: meta.methodologyId,
    methodologyVersion: meta.methodologyVersion,
    rulesetVersion: meta.rulesetVersion,
    catalogVersion: null,
    generatedAt,
    assessment: {
      transliterationCertainty: null,
      orthographicDisputeLevel: 'not-applicable',
      matchStrength: null,
      interpretationLimitations: [...LATIN_MOTIF_INTERPRETATION_LIMITATIONS],
    },
    inputSnapshot,
    reproducibilitySnapshot,
    presentation: {
      displayName: meta.displayName,
      disclaimer: meta.disclaimer,
      isClassicalAbjad: false,
      comingSoon: [CLASSICAL_ABJAD_COMING_SOON],
    },
    notes: hasUnsupported
      ? ['NOT_FULLY_REPRODUCIBLE_UNDER_CURRENT_TOKENIZER: unsupported characters are traced but excluded from legacy sum']
      : [],
  };
}

export { isSymbolicMetadataV2Enabled };

/**
 * Methodology registry — code-constant fallback (no DB yet).
 */

import { ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY } from '../numerology-engine/methodology.js';

/**
 * @typedef {object} MethodologyDescriptor
 * @property {string} methodologyId
 * @property {string} methodologyVersion
 * @property {string} rulesetVersion
 * @property {string} domain
 * @property {string} displayName
 * @property {boolean} [isDefault]
 */

/** @type {MethodologyDescriptor[]} */
const METHODOLOGIES = [
  {
    methodologyId: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
    methodologyVersion: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyVersion,
    rulesetVersion: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.rulesetVersion,
    domain: 'numerology',
    displayName: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.displayName,
    isDefault: true,
  },
  {
    methodologyId: 'atlas-classic-tarot-v1',
    methodologyVersion: '1.0.0',
    rulesetVersion: 'atlas-classic-tarot-rules-1.0.0',
    domain: 'tarot',
    displayName: 'Atlas Classic Tarot',
    isDefault: true,
  },
  {
    methodologyId: 'atlas-dream-v1',
    methodologyVersion: '1.0.0',
    rulesetVersion: 'atlas-dream-rules-1.0.0',
    domain: 'dream',
    displayName: 'Atlas Dream Interpretation',
    isDefault: true,
  },
  {
    methodologyId: 'atlas-letter-number-v1',
    methodologyVersion: '1.0.0',
    rulesetVersion: 'atlas-latin-rules-1.0.0',
    domain: 'symbolic',
    displayName: 'Atlas Latin Letter-Number Motif',
    isDefault: true,
  },
  {
    methodologyId: 'atlas-daily-analysis-v1',
    methodologyVersion: '1.0.0',
    rulesetVersion: 'atlas-daily-analysis-rules-1.0.0',
    domain: 'daily-time',
    displayName: 'Atlas Daily Analysis Layers',
    isDefault: true,
  },
];

/**
 * @returns {MethodologyDescriptor[]}
 */
export function listMethodologies() {
  return METHODOLOGIES.map((m) => ({ ...m }));
}

/**
 * @param {string} methodologyId
 * @returns {MethodologyDescriptor|null}
 */
export function getMethodology(methodologyId) {
  const id = String(methodologyId || '').trim();
  const found = METHODOLOGIES.find((m) => m.methodologyId === id);
  return found ? { ...found } : null;
}

/**
 * Resolve default methodology for a domain.
 * @param {string} domain
 * @param {string|null} [preferredId]
 * @returns {{ methodology: MethodologyDescriptor|null, selectionReason: string }}
 */
export function resolveMethodology(domain, preferredId = null) {
  const preferred = preferredId ? getMethodology(preferredId) : null;
  if (preferred && (!domain || preferred.domain === domain)) {
    return {
      methodology: preferred,
      selectionReason: 'explicit_methodology_id',
    };
  }

  const fallback = METHODOLOGIES.find(
    (m) => m.domain === domain && m.isDefault,
  );
  if (fallback) {
    return {
      methodology: { ...fallback },
      selectionReason: `default_methodology_for_${domain}`,
    };
  }

  return { methodology: null, selectionReason: 'unresolved' };
}

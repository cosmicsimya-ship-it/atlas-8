/**
 * Capability matrix — which symbolic layers may run for a given input.
 * Missing fields are never invented; ineligible layers are skipped.
 * Readiness: available | limited | unavailable | planned
 */

import { SYMBOLIC_LAYER_IDS } from './schema.js';

/**
 * @typedef {object} SymbolicInput
 * @property {string} [name]
 * @property {string} [birthDate]
 * @property {string|null} [birthTime]
 * @property {string|null} [birthPlace]
 * @property {string|null} [intention]
 * @property {string|null} [fullName]
 * @property {string|null} [motherName]
 * @property {string|null} [photoRef]
 * @property {{ symbolicReading?: boolean, dataProcessing?: boolean }} [consents]
 * @property {object} [extras]
 */

/**
 * @type {Record<string, 'available'|'limited'|'unavailable'|'planned'>}
 */
export const LAYER_READINESS = Object.freeze({
  ebced: 'available',
  cifir: 'planned',
  simya: 'planned',
  mizac: 'planned',
  fizyonomi: 'unavailable',
  esma: 'available',
});

/**
 * Photo / image processing contract — absent until a real pipeline exists.
 */
export const PHOTO_CAPABILITY = Object.freeze({
  uploadEnabled: false,
  storage: 'none',
  faceRecognition: false,
  identityDetection: false,
  reason: 'Fizyonomi motoru ve güvenli görüntü işleme sözleşmesi yok.',
});

/**
 * @type {Record<string, { required: string[], optional: string[], label: string }>}
 */
export const LAYER_REQUIREMENTS = Object.freeze({
  ebced: {
    label: 'Ebced',
    required: ['name'],
    optional: ['fullName', 'motherName', 'intention'],
  },
  cifir: {
    label: 'Cifir',
    required: ['name'],
    optional: ['fullName', 'intention', 'birthDate'],
  },
  simya: {
    label: 'Simya',
    required: ['name', 'birthDate'],
    optional: ['intention', 'birthTime'],
  },
  mizac: {
    label: 'Mizaç İlmi',
    required: ['name', 'birthDate'],
    optional: ['birthTime', 'birthPlace'],
  },
  fizyonomi: {
    label: 'Fizyonomi',
    required: ['photoRef'],
    optional: ['name'],
  },
  esma: {
    label: 'Esmaül Hüsna',
    required: ['name'],
    optional: ['intention', 'birthDate'],
  },
});

/**
 * Global form contract — only fields useful for available (or clearly optional enrich) layers.
 * birthDate kept as global required for a stable personal context frame.
 * motherName / photoRef are NOT global optional collectibles when their layers are unready;
 * motherName remains optional enrich for ebced only.
 */
export const INPUT_CONTRACT = Object.freeze({
  required: ['name', 'birthDate'],
  optional: ['birthTime', 'birthPlace', 'intention', 'fullName', 'motherName'],
  consentsRequired: ['symbolicReading', 'dataProcessing'],
  photoUpload: false,
});

/**
 * @param {SymbolicInput} input
 * @param {string} field
 */
function hasField(input, field) {
  const v = input?.[field];
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

/**
 * @param {SymbolicInput} input
 */
export function resolveConsents(input = {}) {
  const c = input.consents && typeof input.consents === 'object' ? input.consents : {};
  const symbolicReading = c.symbolicReading === true;
  const dataProcessing = c.dataProcessing === true;
  const ok = symbolicReading && dataProcessing;
  return {
    ok,
    missing: [
      !symbolicReading ? 'symbolicReading' : null,
      !dataProcessing ? 'dataProcessing' : null,
    ].filter(Boolean),
    consents: { symbolicReading, dataProcessing },
  };
}

/**
 * @param {SymbolicInput} input
 */
export function resolveCapabilities(input = {}) {
  const missingRequired = INPUT_CONTRACT.required.filter((f) => !hasField(input, f));
  /** @type {Record<string, { eligible: boolean, missing: string[], readiness: string, runnable: boolean }>} */
  const layers = {};

  for (const id of SYMBOLIC_LAYER_IDS) {
    const req = LAYER_REQUIREMENTS[id];
    const readiness = LAYER_READINESS[id] ?? 'planned';
    const missing = req.required.filter((f) => !hasField(input, f));
    const eligible = missing.length === 0;
    const runnable =
      eligible && (readiness === 'available' || readiness === 'limited');
    layers[id] = {
      eligible,
      missing,
      readiness,
      runnable,
    };
  }

  return {
    ok: missingRequired.length === 0,
    missingRequired,
    layers,
    photo: PHOTO_CAPABILITY,
  };
}

/**
 * Symbolic Analysis — unified envelope contract.
 * Technical layer ids stay internal; user-facing sections use meaning titles.
 */

export const SYMBOLIC_ANALYSIS_VERSION = 'atlas-symbolic-analysis-v1';

/** @typedef {'success'|'planned'|'skipped'|'unavailable'|'error'} LayerRunStatus */
/** @typedef {'high'|'medium'|'low'|'none'} Confidence */
/** @typedef {'available'|'limited'|'unavailable'|'planned'} LayerReadiness */

/**
 * Internal technical layers — never surface these ids as product modules.
 * @type {readonly string[]}
 */
export const SYMBOLIC_LAYER_IDS = Object.freeze([
  'ebced',
  'cifir',
  'simya',
  'mizac',
  'fizyonomi',
  'esma',
]);

/**
 * User-visible result section ids (meaning-oriented).
 * @type {readonly string[]}
 */
export const USER_SECTION_IDS = Object.freeze([
  'summary',
  'pattern',
  'balance',
  'echoes',
  'meaning',
  'names',
  'tensions',
  'reflection',
  'method',
]);

export const USER_SECTION_TITLES = Object.freeze({
  summary: 'Kısa Özet',
  pattern: 'Ana Örüntü',
  balance: 'İç Denge',
  echoes: 'Sembolik Yankılar',
  meaning: 'Anlam Katmanı',
  names: 'Destekleyici Esmalar',
  tensions: 'Gerilim Noktaları',
  reflection: 'Düşünme Alanı',
  method: 'Yöntem ve Sınırlar',
});

/**
 * @param {Partial<{
 *   id: string,
 *   title: string,
 *   status: LayerRunStatus,
 *   eligible: boolean,
 *   skipReason: string|null,
 *   computed: object|null,
 *   interpreted: object|null,
 *   normalized: object|null,
 *   warnings: string[],
 *   metadata: object,
 * }>} partial
 */
export function makeLayerOutcome(partial) {
  return {
    id: partial.id,
    title: partial.title ?? partial.id,
    status: partial.status ?? 'planned',
    eligible: Boolean(partial.eligible),
    skipReason: partial.skipReason ?? null,
    computed: partial.computed ?? null,
    interpreted: partial.interpreted ?? null,
    normalized: partial.normalized ?? null,
    warnings: Array.isArray(partial.warnings) ? partial.warnings : [],
    metadata: {
      version: SYMBOLIC_ANALYSIS_VERSION,
      ...(partial.metadata && typeof partial.metadata === 'object' ? partial.metadata : {}),
    },
  };
}

/**
 * @param {string} id
 * @param {string} [body]
 */
export function makeUserSection(id, body = '') {
  return {
    id,
    title: USER_SECTION_TITLES[id] ?? id,
    body: typeof body === 'string' ? body : '',
  };
}

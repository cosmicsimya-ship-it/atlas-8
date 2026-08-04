/**
 * Domain Core schemas — JSDoc contracts + lightweight validators.
 * Aligns with docs/atlas-domain-platform/ENGINE_CONTRACT.md
 */

export const STRUCTURED_ANALYSIS_SCHEMA_VERSION = '1.0';

/**
 * @typedef {'web'|'telegram'|'api'|'voice'|'internal'} AtlasChannel
 * @typedef {'consumer'|'professional'|'api'} AtlasAudience
 * @typedef {'L0'|'L1'|'L2'|'L3'|'L4'|'auto'} DepthHint
 *
 * @typedef {object} NormalizedDomainRequest
 * @property {string} requestId
 * @property {AtlasChannel} channel
 * @property {string} userId
 * @property {string} conversationId
 * @property {string} language
 * @property {AtlasAudience} audience
 * @property {DepthHint} depthHint
 * @property {string|null} [domainHint]
 * @property {string|null} [methodologyId]
 * @property {string[]} subjectIds
 * @property {string} message
 * @property {Array<{role:'user'|'assistant', content:string}>} history
 * @property {Record<string, unknown>} [extracted]
 * @property {Record<string, unknown>} [memorySnapshot]
 * @property {Record<string, boolean>} [consents]
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {object} CalculationItem
 * @property {string} calcId
 * @property {string} label
 * @property {unknown} value
 * @property {string} [unit]
 * @property {unknown} [trace]
 * @property {string} evidenceType
 *
 * @typedef {object} EvidenceItem
 * @property {string} claim
 * @property {string} evidenceType
 * @property {string} [methodologyId]
 * @property {string} [calculationTraceId]
 * @property {string[]} [sourceIds]
 * @property {'factual'|'methodological'|'interpretive'|'speculative'} [certainty]
 *
 * @typedef {object} StructuredAnalysisOutput
 * @property {string} schemaVersion
 * @property {string} analysisId
 * @property {string} engineId
 * @property {string} engineVersion
 * @property {string} domain
 * @property {string} intent
 * @property {{id:string, rulesetVersion:string, selectionReason:string}} methodology
 * @property {Record<string, unknown>} input
 * @property {CalculationItem[]} calculations
 * @property {unknown[]} findings
 * @property {unknown[]} patterns
 * @property {unknown[]} contradictions
 * @property {unknown[]} interpretations
 * @property {unknown[]} sources
 * @property {string[]} warnings
 * @property {Record<string, unknown>} uncertainty
 * @property {EvidenceItem[]} evidence
 * @property {{text:string, sections:unknown[]}} rendered
 * @property {{depth:string, channel:string, durationMs:number}} metadata
 */

const DEPTH_HINTS = new Set(['L0', 'L1', 'L2', 'L3', 'L4', 'auto']);
const CHANNELS = new Set(['web', 'telegram', 'api', 'voice', 'internal']);

/**
 * @param {unknown} value
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateStructuredAnalysisOutput(value) {
  /** @type {string[]} */
  const errors = [];
  if (!value || typeof value !== 'object') {
    return { ok: false, errors: ['output must be an object'] };
  }
  const o = /** @type {Record<string, unknown>} */ (value);

  for (const key of [
    'schemaVersion',
    'analysisId',
    'engineId',
    'engineVersion',
    'domain',
    'intent',
  ]) {
    if (typeof o[key] !== 'string' || !String(o[key]).trim()) {
      errors.push(`missing/invalid string field: ${key}`);
    }
  }

  if (o.schemaVersion !== STRUCTURED_ANALYSIS_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion must be ${STRUCTURED_ANALYSIS_SCHEMA_VERSION}`,
    );
  }

  const methodology = o.methodology;
  if (!methodology || typeof methodology !== 'object') {
    errors.push('methodology must be an object');
  } else {
    const m = /** @type {Record<string, unknown>} */ (methodology);
    for (const key of ['id', 'rulesetVersion', 'selectionReason']) {
      if (typeof m[key] !== 'string' || !String(m[key]).trim()) {
        errors.push(`methodology.${key} must be a non-empty string`);
      }
    }
  }

  for (const key of [
    'calculations',
    'findings',
    'patterns',
    'contradictions',
    'interpretations',
    'sources',
    'warnings',
    'evidence',
  ]) {
    if (!Array.isArray(o[key])) errors.push(`${key} must be an array`);
  }

  if (!o.input || typeof o.input !== 'object' || Array.isArray(o.input)) {
    errors.push('input must be an object');
  }
  if (
    !o.uncertainty ||
    typeof o.uncertainty !== 'object' ||
    Array.isArray(o.uncertainty)
  ) {
    errors.push('uncertainty must be an object');
  }

  const rendered = o.rendered;
  if (!rendered || typeof rendered !== 'object') {
    errors.push('rendered must be an object');
  } else {
    const r = /** @type {Record<string, unknown>} */ (rendered);
    if (typeof r.text !== 'string') errors.push('rendered.text must be a string');
    if (!Array.isArray(r.sections)) errors.push('rendered.sections must be an array');
  }

  const metadata = o.metadata;
  if (!metadata || typeof metadata !== 'object') {
    errors.push('metadata must be an object');
  } else {
    const m = /** @type {Record<string, unknown>} */ (metadata);
    if (typeof m.depth !== 'string') errors.push('metadata.depth must be a string');
    if (typeof m.channel !== 'string') errors.push('metadata.channel must be a string');
    if (typeof m.durationMs !== 'number') {
      errors.push('metadata.durationMs must be a number');
    }
  }

  if (Array.isArray(o.calculations)) {
    o.calculations.forEach((item, i) => {
      if (!item || typeof item !== 'object') {
        errors.push(`calculations[${i}] must be an object`);
        return;
      }
      const c = /** @type {Record<string, unknown>} */ (item);
      if (typeof c.calcId !== 'string') errors.push(`calculations[${i}].calcId`);
      if (typeof c.label !== 'string') errors.push(`calculations[${i}].label`);
      if (typeof c.evidenceType !== 'string') {
        errors.push(`calculations[${i}].evidenceType`);
      }
      if (!('value' in c)) errors.push(`calculations[${i}].value`);
    });
  }

  return { ok: errors.length === 0, errors };
}

/**
 * @param {Partial<NormalizedDomainRequest>} partial
 * @returns {NormalizedDomainRequest}
 */
export function createNormalizedDomainRequest(partial = {}) {
  const channel = CHANNELS.has(/** @type {string} */ (partial.channel))
    ? /** @type {AtlasChannel} */ (partial.channel)
    : 'api';
  const depthHint = DEPTH_HINTS.has(/** @type {string} */ (partial.depthHint))
    ? /** @type {DepthHint} */ (partial.depthHint)
    : 'auto';

  return {
    requestId: String(partial.requestId || `req_${Date.now()}`),
    channel,
    userId: String(partial.userId || ''),
    conversationId: String(partial.conversationId || partial.userId || 'default'),
    language: String(partial.language || 'tr'),
    audience: partial.audience === 'professional' || partial.audience === 'api'
      ? partial.audience
      : 'consumer',
    depthHint,
    domainHint: partial.domainHint ?? null,
    methodologyId: partial.methodologyId ?? null,
    subjectIds: Array.isArray(partial.subjectIds) ? partial.subjectIds.map(String) : [],
    message: String(partial.message || ''),
    history: Array.isArray(partial.history) ? partial.history : [],
    extracted: partial.extracted && typeof partial.extracted === 'object'
      ? partial.extracted
      : {},
    memorySnapshot:
      partial.memorySnapshot && typeof partial.memorySnapshot === 'object'
        ? partial.memorySnapshot
        : {},
    consents:
      partial.consents && typeof partial.consents === 'object'
        ? partial.consents
        : {},
    metadata:
      partial.metadata && typeof partial.metadata === 'object'
        ? partial.metadata
        : {},
  };
}

/**
 * Empty StructuredAnalysisOutput shell for adapters.
 * @param {object} opts
 * @returns {StructuredAnalysisOutput}
 */
export function createEmptyStructuredOutput(opts) {
  return {
    schemaVersion: STRUCTURED_ANALYSIS_SCHEMA_VERSION,
    analysisId: String(opts.analysisId || `analysis_${Date.now()}`),
    engineId: String(opts.engineId || ''),
    engineVersion: String(opts.engineVersion || ''),
    domain: String(opts.domain || ''),
    intent: String(opts.intent || ''),
    methodology: {
      id: String(opts.methodologyId || ''),
      rulesetVersion: String(opts.rulesetVersion || ''),
      selectionReason: String(opts.selectionReason || 'unspecified'),
    },
    input: opts.input && typeof opts.input === 'object' ? opts.input : {},
    calculations: [],
    findings: [],
    patterns: [],
    contradictions: [],
    interpretations: [],
    sources: [],
    warnings: [],
    uncertainty: {},
    evidence: [],
    rendered: { text: '', sections: [] },
    metadata: {
      depth: String(opts.depth || 'L2'),
      channel: String(opts.channel || 'api'),
      durationMs: Number(opts.durationMs || 0),
    },
  };
}

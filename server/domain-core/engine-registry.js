/**
 * Engine registry — descriptors for live domain engines.
 * Chat routing is unchanged; this is discovery + adapter entry only.
 */

import {
  NUMEROLOGY_ENGINE_VERSION,
  ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY,
} from '../numerology-engine/methodology.js';
import { TAROT_ENGINE_VERSION } from '../tarot-engine/methodology.js';
import { DREAM_ENGINE_VERSION } from '../dream-engine/methodology.js';
import { SYMBOLIC_ANALYSIS_VERSION } from '../symbolic-analysis/schema.js';
import { DAILY_ANALYSIS_VERSION } from '../daily-analysis/schema.js';
import { CLASSICAL_ABJAD_METHODOLOGY } from '../symbolic-analysis/methodology-ids.js';
import { CROSS_LAYER_SYNTHESIS_VERSION } from '../cross-layer-synthesis/schema.js';

/**
 * @typedef {object} EngineDescriptor
 * @property {string} engineId
 * @property {string} domain
 * @property {string} version
 * @property {'active'|'limited'|'experimental'|'planned'|'deprecated'|'unavailable'} status
 * @property {string} defaultMethodologyId
 * @property {string} modulePath
 * @property {boolean} hasAdapter
 */

/** @type {EngineDescriptor[]} */
const ENGINES = [
  {
    engineId: 'atlas-numerology',
    domain: 'numerology',
    version: NUMEROLOGY_ENGINE_VERSION,
    status: 'active',
    defaultMethodologyId: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
    modulePath: 'server/numerology-engine',
    hasAdapter: true,
  },
  {
    engineId: 'atlas-tarot',
    domain: 'tarot',
    version: TAROT_ENGINE_VERSION,
    status: 'active',
    defaultMethodologyId: 'atlas-classic-tarot-v1',
    modulePath: 'server/tarot-engine',
    hasAdapter: false,
  },
  {
    engineId: 'atlas-dream',
    domain: 'dream',
    version: DREAM_ENGINE_VERSION,
    status: 'active',
    defaultMethodologyId: 'atlas-dream-v1',
    modulePath: 'server/dream-engine',
    hasAdapter: false,
  },
  {
    engineId: 'atlas-symbolic-latin',
    domain: 'symbolic',
    version: SYMBOLIC_ANALYSIS_VERSION,
    status: 'active',
    defaultMethodologyId: 'atlas-letter-number-v1',
    modulePath: 'server/symbolic-analysis',
    hasAdapter: false,
  },
  {
    engineId: 'atlas-daily-time',
    domain: 'daily-time',
    version: DAILY_ANALYSIS_VERSION,
    status: 'active',
    defaultMethodologyId: 'atlas-daily-analysis-v1',
    modulePath: 'server/daily-analysis',
    hasAdapter: false,
  },
  {
    // Distinct from atlas-symbolic-latin above: that entry is the unrelated
    // "Latin Motif" methodology (direct Latin letter->number, no Arabic
    // step). This entry is classical Arabic Abjad Kabir (resolve-arabic-
    // spelling.js + classical-abjad-runner.js), including the default
    // Latin->Arabic transliteration fallback added in ADR-010. Catalog
    // only — no adapter, no runtime dispatch change.
    engineId: 'atlas-abjad-classical',
    domain: 'symbolic',
    version: CLASSICAL_ABJAD_METHODOLOGY.methodologyVersion,
    status: 'active',
    defaultMethodologyId: CLASSICAL_ABJAD_METHODOLOGY.methodologyId,
    modulePath: 'server/symbolic-analysis (resolve-arabic-spelling + classical-abjad-runner)',
    hasAdapter: false,
  },
  {
    engineId: 'atlas-daily-synthesis',
    domain: 'cross-layer-synthesis',
    version: CROSS_LAYER_SYNTHESIS_VERSION,
    status: 'active',
    defaultMethodologyId: 'atlas-cross-layer-synthesis-v1',
    modulePath: 'server/cross-layer-synthesis',
    hasAdapter: false,
  },
];

/**
 * @returns {EngineDescriptor[]}
 */
export function listEngines() {
  return ENGINES.map((e) => ({ ...e }));
}

/**
 * @param {string} engineId
 * @returns {EngineDescriptor|null}
 */
export function getEngine(engineId) {
  const id = String(engineId || '').trim();
  const found = ENGINES.find((e) => e.engineId === id);
  return found ? { ...found } : null;
}

/**
 * @param {string} domain
 * @returns {EngineDescriptor[]}
 */
export function listEnginesByDomain(domain) {
  const d = String(domain || '').trim();
  return ENGINES.filter((e) => e.domain === d).map((e) => ({ ...e }));
}

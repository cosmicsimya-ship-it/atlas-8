/**
 * Atlas Domain Core — FAZ 2 scaffolding.
 * Flagged OFF by default. Does not rewrite atlas-message-service.
 */

export {
  isDomainCoreEnabled,
  isDomainCoreDualRunEnabled,
} from './flags.js';

export {
  STRUCTURED_ANALYSIS_SCHEMA_VERSION,
  validateStructuredAnalysisOutput,
  createNormalizedDomainRequest,
  createEmptyStructuredOutput,
} from './schemas.js';

export { resolveDepthFromMessage, resolveDepthLevel } from './depth.js';

export {
  listEngines,
  getEngine,
  listEnginesByDomain,
} from './engine-registry.js';

export {
  listMethodologies,
  getMethodology,
  resolveMethodology,
} from './methodology-registry.js';

export {
  listSources,
  getSource,
  resolveSources,
} from './source-registry.js';

export {
  NUMEROLOGY_ADAPTER_VERSION,
  adaptNumerologyRequest,
  calculateNumerologyViaAdapter,
  runNumerologyAdapter,
  dualRunNumerologyCalculations,
} from './adapters/numerology-adapter.js';

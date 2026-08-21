// ═══════════════════════════════════════════════════════════════════════
// Memory V2 — public barrel
// ═══════════════════════════════════════════════════════════════════════

export {
  isMemoryV2Enabled,
  isSemanticRetrievalEnabled,
  isMemoryV2DualWriteEnabled,
  isMemoryWriteFrozen,
  MEMORY_TOKEN_BUDGET,
  MEMORY_PAYLOAD_LIMITS,
} from './config.js';
export { retrieveRelevantMemories } from './retrieval.js';
export { buildMemoryContextV2, sanitizeMemoryForPrompt } from './context-composer.js';
export {
  writeFromValidatedEntity,
  writeStructuredMemory,
  forgetFromEntity,
  detectCurrentMessageOverrides,
} from './write.js';
export {
  legacyMemoryFromStore,
  applyLegacyPartialUpdate,
  replaceLegacyMemory,
  eraseUserMemoryV2,
} from './legacy-adapter.js';
export { migrateJsonToMemoryV2 } from './migration.js';
export { exportV2ToLegacyJson, mirrorUserMemoryToJson } from './json-mirror.js';
export { runMemoryV2StartupCheck } from './health.js';
export {
  openMemoryDb,
  closeMemoryDb,
  resetMemoryV2StoreForTests,
  getMemoryV2DbPath,
  listActiveMemories,
  listActiveCandidates,
  getMemoryById,
  softDeleteMemory,
  hardDeleteAllUserMemories,
  findActiveByKey,
  countMemories,
  countDistinctUsers,
  checkMemoryDbHealth,
  backupMemoryDb,
  supersedeMemory,
} from './store.js';

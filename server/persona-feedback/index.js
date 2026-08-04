/**
 * Persona Feedback public API (Phase 2).
 */

export {
  PERSONA_FEEDBACK_VERSION,
  FEEDBACK_CATEGORIES,
  SCOPE_TYPES,
  isPersonaFeedbackLearningEnabled,
} from './constants.js';

export { validateFeedbackRecord, validateFeedbackStore, emptyFeedbackStore } from './schema.js';

export {
  extractPersonaFeedback,
  detectUnsafeLearningContext,
  resolveFeedbackScope,
} from './extract.js';

export { analyzeEditingDelta } from './editing-delta.js';

export {
  setFeedbackRecordsPath,
  getFeedbackRecordsPath,
  loadFeedbackStore,
  saveFeedbackStore,
  upsertFeedbackRecord,
  listActiveFeedbackRecords,
  getSessionFeedback,
  clearSessionFeedback,
  resetAllSessionFeedback,
  stableFeedbackId,
} from './store.js';

export {
  resolveApplicableFeedback,
  buildFeedbackDebugMeta,
  scopeMatches,
} from './resolve.js';

import { extractPersonaFeedback } from './extract.js';
import { upsertFeedbackRecord } from './store.js';
import { resolveApplicableFeedback, buildFeedbackDebugMeta } from './resolve.js';
import { isPersonaFeedbackLearningEnabled } from './constants.js';

/**
 * End-to-end: extract → upsert → resolve for current context.
 * Safe: never throws; learning flag gates disk writes.
 *
 * @param {{
 *   userMessage: string,
 *   assistantResponse?: string|null,
 *   revisedText?: string|null,
 *   context?: object,
 *   activeVoice?: object|string|null,
 *   authorProfile?: object|null,
 *   conversationId?: string|null,
 *   channel?: string|null,
 *   brand?: string|null,
 *   mode?: string|null,
 * }} input
 */
export function processPersonaFeedbackLearning(input = {}) {
  try {
    const activeVoiceId =
      typeof input.activeVoice === 'string'
        ? input.activeVoice
        : input.activeVoice?.id ?? null;

    const extraction = extractPersonaFeedback({
      userMessage: input.userMessage,
      assistantResponse: input.assistantResponse,
      revisedText: input.revisedText,
      context: {
        ...(input.context || {}),
        channel: input.channel ?? input.context?.channel,
        brand: input.brand ?? input.context?.brand,
      },
      activeVoice: input.activeVoice,
      authorProfile: input.authorProfile,
    });

    const upsertResults = [];
    if (extraction.detected && extraction.persistenceDecision !== 'ignore') {
      for (const signal of extraction.signals) {
        const result = upsertFeedbackRecord(
          {
            category: signal.category,
            signal: signal.signal,
            normalizedPreference: signal.normalizedPreference,
            scope: signal.scope,
            polarity: signal.polarity,
            strength: signal.strength,
            confidence: signal.confidence,
            persistence: signal.persistence,
            source: {
              type: signal.examples?.preferred?.length && signal.category?.includes('editing_pattern')
                ? 'editing_delta'
                : 'explicit_user_feedback',
              conversationId: input.conversationId ?? null,
              messageId: input.context?.messageId ?? null,
            },
            examples: signal.examples || { rejected: [], preferred: [] },
          },
          {
            conversationId: input.conversationId,
            learningEnabled: isPersonaFeedbackLearningEnabled(),
          },
        );
        upsertResults.push(result);
      }
    }

    const resolution = resolveApplicableFeedback({
      activeVoice: activeVoiceId,
      brand: input.brand ?? null,
      channel: input.channel ?? null,
      contentType: input.context?.contentType ?? null,
      taskType: input.mode ?? null,
      mode: input.mode ?? null,
      conversationId: input.conversationId,
      limit: 8,
    });

    return {
      extraction,
      upsertResults,
      resolution,
      debug: buildFeedbackDebugMeta(extraction, upsertResults, resolution),
      learningEnabled: isPersonaFeedbackLearningEnabled(),
    };
  } catch (err) {
    console.error('[PersonaFeedback] process failed (non-fatal):', err.message);
    return {
      extraction: {
        detected: false,
        signals: [],
        persistenceDecision: 'ignore',
        confidence: 0,
        requiresClarification: false,
        skippedReason: 'processor_error',
      },
      upsertResults: [],
      resolution: {
        activePreferences: [],
        sessionPreferences: [],
        conflicts: [],
        excluded: [],
        appliedFeedbackIds: [],
        promptRules: [],
        promptBlock: '',
      },
      debug: {
        detectedSignals: [],
        appliedFeedbackIds: [],
        persistenceDecision: 'ignore',
        skippedReason: 'processor_error',
        conflicts: [],
      },
      learningEnabled: isPersonaFeedbackLearningEnabled(),
      error: err.message,
    };
  }
}

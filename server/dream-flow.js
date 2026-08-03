/**
 * Dream flow — integration bridge for Web + Telegram (message service).
 * Deterministic multi-layer interpretation; does not call LLM.
 *
 * Session key is conversationId::userId — group history must not authorize
 * another user's follow-ups.
 */
import {
  DREAM_ENGINE_VERSION,
  DEPTH_LEVEL,
  detectDreamEngineIntent,
  focusFromDreamIntent,
  extractDreamNarrative,
  extractRecurringHint,
  resolveDreamDepth,
  runDreamAnalysis,
  getDreamSession,
  touchDreamSession,
  DREAM_SESSION_REQUIRED_INTENTS,
  DREAM_CLARIFY_REPLY,
  hasDreamNarrative,
} from './dream-engine/index.js';

export const DREAM_FLOW_VERSION = 'atlas-dream-flow-v1';

/** Canonical reply when follow-up lacks a per-user dream session. */
export const NO_ACTIVE_DREAM_SESSION_REPLY =
  'Şu anda devam edebileceğim aktif bir rüya analizi yok. Rüyanı anlatarak yeni bir analiz isteyebilirsin.';

/**
 * @param {{
 *   message: string,
 *   history?: { role: string, content: string }[],
 *   userId?: string|null,
 *   conversationId?: string,
 * }} input
 * @returns {{
 *   handled: boolean,
 *   intent: string,
 *   reply: string,
 *   engine: string,
 *   data?: object,
 * } | null}
 */
export function tryDreamFlowReply(input) {
  const history = input.history || [];
  const conversationId = input.conversationId || 'default';
  const userId = input.userId || null;
  const session = getDreamSession(conversationId, userId);
  const detected = detectDreamEngineIntent(input.message, history, {
    sessionActive: Boolean(session),
  });

  if (!detected.active) return null;

  const requiresSession =
    detected.requiresSession ||
    DREAM_SESSION_REQUIRED_INTENTS.has(detected.intent);

  if (requiresSession && !session) {
    return {
      handled: true,
      intent: `dream:${detected.intent}`,
      reply: NO_ACTIVE_DREAM_SESSION_REPLY,
      engine: 'dream-engine',
      data: {
        dreamFlowVersion: DREAM_FLOW_VERSION,
        engineVersion: DREAM_ENGINE_VERSION,
        missingSession: true,
        reusedDream: false,
        clarified: false,
      },
    };
  }

  // Clarify-only request (no narrative yet)
  if (detected.intent === 'clarify') {
    touchDreamSession({
      conversationId,
      userId,
      awaitingNarrative: true,
      focus: 'clarify',
      layersCovered: ['clarify'],
    });
    return {
      handled: true,
      intent: 'dream:clarify',
      reply: DREAM_CLARIFY_REPLY,
      engine: 'dream-engine',
      data: {
        dreamFlowVersion: DREAM_FLOW_VERSION,
        engineVersion: DREAM_ENGINE_VERSION,
        clarified: true,
        awaitingNarrative: true,
        reusedDream: false,
      },
    };
  }

  let depth = resolveDreamDepth(input.message);
  if (detected.depthHint === 'short') depth = DEPTH_LEVEL.SHORT;
  if (detected.depthHint === 'deep') depth = DEPTH_LEVEL.DEEP;
  if (detected.intent === 'followup_deeper') {
    depth = Math.min(DEPTH_LEVEL.DEEP, (session?.lastDepth || DEPTH_LEVEL.STANDARD) + 1);
  }

  const focus = focusFromDreamIntent(detected.intent);
  const exploreMore = detected.intent === 'followup_explore';

  const isFollowUpFocus =
    Boolean(focus) &&
    focus !== 'clarify' &&
    detected.isFollowUp &&
    Boolean(session?.lastAnalysis?.ok);

  const narrativeFromMessage = extractDreamNarrative(input.message);
  const recurring =
    detected.recurringHint ??
    extractRecurringHint(input.message) ??
    session?.recurring ??
    null;

  // New or continued narrative
  let narrative = narrativeFromMessage;
  if (isFollowUpFocus) {
    narrative = session.narrative || narrativeFromMessage;
  } else if (session?.awaitingNarrative && hasDreamNarrative(narrativeFromMessage)) {
    narrative = narrativeFromMessage;
  } else if (
    session?.narrative &&
    !hasDreamNarrative(narrativeFromMessage) &&
    detected.isFollowUp
  ) {
    narrative = session.narrative;
  }

  // Still no narrative → clarify
  if (
    !isFollowUpFocus &&
    !hasDreamNarrative(narrative) &&
    !(session?.lastAnalysis?.ok)
  ) {
    touchDreamSession({
      conversationId,
      userId,
      awaitingNarrative: true,
      focus: 'clarify',
      layersCovered: ['clarify'],
    });
    return {
      handled: true,
      intent: 'dream:clarify',
      reply: DREAM_CLARIFY_REPLY,
      engine: 'dream-engine',
      data: {
        dreamFlowVersion: DREAM_FLOW_VERSION,
        engineVersion: DREAM_ENGINE_VERSION,
        clarified: true,
        awaitingNarrative: true,
        reusedDream: false,
      },
    };
  }

  const result = runDreamAnalysis({
    message: input.message,
    narrative,
    statedEmotion: session?.statedEmotion || undefined,
    wakingEmotion: session?.wakingEmotion || undefined,
    recurring,
    depth,
    focus: isFollowUpFocus ? focus : focus === 'clarify' ? 'clarify' : null,
    exploreMore,
    layersAlreadyCovered: session?.layersCovered || [],
    existingAnalysis: isFollowUpFocus ? session.lastAnalysis : null,
    forceReanalyze: !isFollowUpFocus,
    userId,
    history,
    conversationId,
  });

  if (!result.ok) {
    return {
      handled: true,
      intent: `dream:${detected.intent}`,
      reply: result.reply || NO_ACTIVE_DREAM_SESSION_REPLY,
      engine: 'dream-engine',
      data: {
        dreamFlowVersion: DREAM_FLOW_VERSION,
        error: result.error,
        clarified: Boolean(result.clarified),
      },
    };
  }

  const analysis = result.analysis;
  touchDreamSession({
    conversationId,
    userId,
    narrative: analysis?.narrative || narrative,
    recurring,
    symbolIds: (analysis?.symbols || []).map((s) => s.id),
    symbolNames: (analysis?.symbols || []).map((s) => s.name),
    emotionLabels: (analysis?.emotions || []).map((e) => e.label),
    lastAnalysis: analysis?.ok ? analysis : session?.lastAnalysis || null,
    depth: result.depth,
    focus,
    layersCovered: inferCoveredLayers(result, focus, exploreMore),
    awaitingNarrative: Boolean(result.clarified),
  });

  return {
    handled: true,
    intent: `dream:${detected.intent}`,
    reply: result.reply,
    engine: 'dream-engine',
    data: {
      dreamFlowVersion: DREAM_FLOW_VERSION,
      engineVersion: DREAM_ENGINE_VERSION,
      methodologyId: result.methodologyId,
      methodologyVersion: result.methodologyVersion,
      school: result.school,
      depth: result.depth,
      focus,
      isFollowUp: detected.isFollowUp,
      reusedDream: result.reusedDream,
      clarified: Boolean(result.clarified),
      guard: result.guard,
      symbols: (analysis?.symbols || []).map((s) => ({
        id: s.id,
        name: s.name,
      })),
      emotions: (analysis?.emotions || []).map((e) => e.label),
      narrativeMotifs: analysis?.narrativeAnalysis?.motifs || [],
      jungArchetypes: (analysis?.jungArchetypes || []).map((a) => a.id),
      personalLinks: analysis?.personalContext?.links?.length || 0,
      tensions: analysis?.contradictions?.tensions?.map((t) => t.id) || [],
      commonTheme: analysis?.combinations?.commonTheme ?? null,
    },
  };
}

/**
 * @param {object} result
 * @param {string|null} focus
 * @param {boolean} exploreMore
 */
function inferCoveredLayers(result, focus, exploreMore) {
  if (result.clarified || focus === 'clarify') return ['clarify'];
  if (focus === 'symbols') return ['symbols'];
  if (focus === 'emotion') return ['emotion'];
  if (focus === 'jung') return ['jung'];
  if (focus === 'classical') return ['classical'];
  if (focus === 'psychological') return ['psych'];
  if (focus === 'personal') return ['personal'];
  if (focus === 'blind_spot') return ['blind'];
  if (focus === 'explore' || exploreMore) {
    return ['jung', 'classical', 'psych', 'personal', 'blind', 'alt'];
  }
  return [
    'symbols',
    'emotion',
    'narrative',
    'combinations',
    'jung',
    'classical',
    'psych',
    'personal',
    'blind',
    'growth',
    'synthesis',
  ];
}

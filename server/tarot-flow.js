/**
 * Tarot flow — integration bridge for Web + Telegram (message service).
 * Deterministic selection + layered interpretation; does not call LLM.
 *
 * Session key is conversationId::userId — group history must not authorize
 * another user's follow-ups.
 */
import {
  TAROT_ENGINE_VERSION,
  DEPTH_LEVEL,
  detectTarotEngineIntent,
  focusFromTarotIntent,
  extractIntention,
  resolveTarotDepth,
  resolveSpreadKind,
  runTarotAnalysis,
  getTarotSession,
  touchTarotSession,
  TAROT_SESSION_REQUIRED_INTENTS,
} from './tarot-engine/index.js';

export const TAROT_FLOW_VERSION = 'atlas-tarot-flow-v1';

/** Canonical reply when follow-up/continue lacks a per-user session. */
export const NO_ACTIVE_TAROT_SPREAD_REPLY =
  'Şu anda devam edebileceğim aktif bir açılım yok. Yeni bir açılım yapmamı istersen niyetini yaz.';

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
export function tryTarotFlowReply(input) {
  const history = input.history || [];
  const conversationId = input.conversationId || 'default';
  const userId = input.userId || null;
  const session = getTarotSession(conversationId, userId);
  const detected = detectTarotEngineIntent(input.message, history, {
    sessionActive: Boolean(session),
  });

  if (!detected.active) return null;

  const requiresSession =
    detected.requiresSession ||
    TAROT_SESSION_REQUIRED_INTENTS.has(detected.intent);

  // Session-bound intents never invent cards from shared history alone.
  if (requiresSession && !session) {
    return {
      handled: true,
      intent: `tarot:${detected.intent}`,
      reply: NO_ACTIVE_TAROT_SPREAD_REPLY,
      engine: 'tarot-engine',
      data: {
        tarotFlowVersion: TAROT_FLOW_VERSION,
        engineVersion: TAROT_ENGINE_VERSION,
        missingSession: true,
        reusedCards: false,
        drewCards: false,
        cards: [],
      },
    };
  }

  let depth = resolveTarotDepth(input.message);
  if (detected.depthHint === 'short') depth = DEPTH_LEVEL.SHORT;
  if (detected.depthHint === 'deep') depth = DEPTH_LEVEL.DEEP;
  if (detected.intent === 'followup_deeper') {
    depth = Math.min(DEPTH_LEVEL.DEEP, (session?.lastDepth || DEPTH_LEVEL.STANDARD) + 1);
  }

  const focus = focusFromTarotIntent(detected.intent);
  const exploreMore = detected.intent === 'followup_explore';

  // New draw only for explicit spread or continue — never because session is missing
  // (missing session already returned above for follow-ups).
  const isNewDraw =
    detected.intent === 'spread' || detected.intent === 'continue';

  /** @type {string} */
  let intention;
  /** @type {string|null} */
  let spreadKindOverride = null;
  /** @type {string|null} */
  let topic = null;

  if (detected.intent === 'continue') {
    // H1: new cards OK; preserve prior intention/topic; only focus/kind from message.
    intention = session.intention || session.topic || extractIntention(input.message);
    topic = session.topic || session.intention || intention;
    spreadKindOverride = resolveSpreadKind(input.message);
  } else if (isNewDraw) {
    intention = extractIntention(input.message);
    topic = intention;
  } else {
    intention = session.intention || extractIntention(input.message);
    topic = session.topic || session.intention || intention;
  }

  const spreadIndex =
    detected.intent === 'continue'
      ? (session?.spreadIndex ?? 0) + 1
      : isNewDraw
        ? 0
        : session?.spreadIndex ?? 0;

  const result = runTarotAnalysis({
    message: input.message,
    intention,
    spreadKind: spreadKindOverride || undefined,
    depth,
    focus,
    exploreMore,
    layersAlreadyCovered: session?.layersCovered || [],
    forceNewDraw: isNewDraw,
    existingCardIds: isNewDraw ? null : session?.cardIds,
    existingPositions: isNewDraw ? null : session?.positions,
    existingSpreadKind: isNewDraw ? null : session?.spreadKind,
    existingSeed: isNewDraw ? null : session?.selectionSeed,
    conversationId,
    userId,
    spreadIndex,
  });

  if (!result.ok) {
    return {
      handled: true,
      intent: `tarot:${detected.intent}`,
      reply: result.reply,
      engine: 'tarot-engine',
      data: {
        tarotFlowVersion: TAROT_FLOW_VERSION,
        error: result.error,
        drewCards: false,
        reusedCards: false,
      },
    };
  }

  const analysis = result.analysis;
  touchTarotSession({
    conversationId,
    userId,
    intention: analysis.intention,
    topic,
    spreadKind: analysis.spreadKind,
    cardIds: analysis.placed.map((p) => p.card.id),
    cardNames: analysis.placed.map((p) => p.card.name),
    positions: analysis.placed.map((p) => ({
      id: p.position.id,
      label: p.position.label,
      role: p.position.role,
    })),
    selectionSeed: analysis.selectionSeed || result.selection?.seed || '',
    depth: result.depth,
    focus,
    layersCovered: inferCoveredLayers(result, focus, exploreMore),
    spreadIndex,
  });

  return {
    handled: true,
    intent: `tarot:${detected.intent}`,
    reply: result.reply,
    engine: 'tarot-engine',
    data: {
      tarotFlowVersion: TAROT_FLOW_VERSION,
      engineVersion: TAROT_ENGINE_VERSION,
      methodologyId: result.methodologyId,
      methodologyVersion: result.methodologyVersion,
      school: result.school,
      depth: result.depth,
      focus,
      isFollowUp: detected.isFollowUp,
      reusedCards: result.reusedCards,
      drewCards: isNewDraw || !result.reusedCards,
      guard: result.guard,
      selection: result.selection,
      topic,
      cards: analysis.placed.map((p) => ({
        id: p.card.id,
        name: p.card.name,
        position: p.position.label,
        role: p.position.role,
        element: p.card.element,
        arcana: p.card.arcana,
      })),
      spreadKind: analysis.spreadKind,
      intention: analysis.intention,
      commonTheme: analysis.combinations?.commonTheme ?? null,
      tensions: analysis.contradictions?.tensions?.map((t) => t.id) ?? [],
    },
  };
}

/**
 * @param {object} result
 * @param {string|null} focus
 * @param {boolean} exploreMore
 */
function inferCoveredLayers(result, focus, exploreMore) {
  if (focus === 'reveal') return ['reveal'];
  if (focus === 'blind_spot') return ['blind'];
  if (focus === 'combination') return ['combinations'];
  if (focus === 'why_card') return ['why'];
  if (focus === 'explore' || exploreMore) {
    return ['combinations', 'contradictions', 'blind', 'alt', 'growth'];
  }
  return [
    'positions',
    'combinations',
    'contradictions',
    'theme',
    'blind',
    'growth',
    'synthesis',
  ];
}

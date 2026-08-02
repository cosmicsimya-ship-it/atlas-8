/**
 * Numerology flow — integration bridge for Web + Telegram (message service).
 * Produces deterministic layered analysis replies; does not call LLM.
 */
import { getUserMemory, isValidUserId } from './user-memory.js';
import {
  normalizeUserProfileFacts,
  parseBirthDateParts,
} from './self-profile-resolver.js';
import {
  NUMEROLOGY_ENGINE_VERSION,
  DEPTH_LEVEL,
  detectNumerologyIntent,
  focusFromIntent,
  resolveNumerologyDepth,
  runNumerologyAnalysis,
  getNumerologySession,
  touchNumerologySession,
  ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY,
} from './numerology-engine/index.js';

export const NUMEROLOGY_FLOW_VERSION = 'atlas-numerology-flow-v1';

export const ASK_NUMEROLOGY_BIRTH_DATE_REPLY =
  'Numeroloji analizi için doğum tarihini Gün.Ay.Yıl olarak paylaşır mısın? Ad soyad da verirsen isim katmanlarını açarım; eksik veri için tahmin yapmam.';

/**
 * @param {string|null|undefined} userId
 * @param {object|null} [conversationFacts]
 */
export function resolveNumerologyInputs(userId, conversationFacts = null) {
  let birthDate = null;
  let fullName = null;
  if (userId && isValidUserId(userId)) {
    const memory = getUserMemory(userId);
    const norm = normalizeUserProfileFacts(memory, conversationFacts);
    birthDate = norm.birthDate || null;
    fullName = norm.name || null;
  } else if (conversationFacts) {
    const norm = normalizeUserProfileFacts(null, conversationFacts);
    birthDate = norm.birthDate || null;
    fullName = norm.name || null;
  }
  return { birthDate, fullName };
}

/**
 * @param {{
 *   message: string,
 *   history?: { role: string, content: string }[],
 *   userId?: string|null,
 *   conversationId?: string,
 *   conversationFacts?: object|null,
 *   now?: Date,
 * }} input
 * @returns {{
 *   handled: boolean,
 *   intent: string,
 *   reply: string,
 *   engine: string,
 *   data?: object,
 * } | null}
 */
export function tryNumerologyFlowReply(input) {
  const history = input.history || [];
  const conversationId = input.conversationId || 'default';
  const userId = input.userId || null;
  const session = getNumerologySession(conversationId, userId);
  const detected = detectNumerologyIntent(input.message, history, {
    sessionActive: Boolean(session),
  });

  if (!detected.active) return null;

  if (detected.intent === 'ask_birth_date') {
    return {
      handled: true,
      intent: 'numerology:ask_birth_date',
      reply: ASK_NUMEROLOGY_BIRTH_DATE_REPLY,
      engine: 'numerology-engine',
      data: {
        numerologyFlowVersion: NUMEROLOGY_FLOW_VERSION,
        engineVersion: NUMEROLOGY_ENGINE_VERSION,
        methodologyId: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
      },
    };
  }

  const fromMemory = resolveNumerologyInputs(userId, input.conversationFacts);
  const birthDate =
    detected.birthDate ||
    session?.birthDate ||
    fromMemory.birthDate ||
    null;
  const fullName =
    detected.fullName || session?.fullName || fromMemory.fullName || null;

  if (!birthDate || !parseBirthDateParts(birthDate)) {
    return {
      handled: true,
      intent: 'numerology:ask_birth_date',
      reply: ASK_NUMEROLOGY_BIRTH_DATE_REPLY,
      engine: 'numerology-engine',
      data: {
        numerologyFlowVersion: NUMEROLOGY_FLOW_VERSION,
        missingBirthDate: true,
      },
    };
  }

  let depth = resolveNumerologyDepth(input.message);
  if (detected.depthHint === 'short') depth = DEPTH_LEVEL.SHORT;
  if (detected.depthHint === 'deep') depth = DEPTH_LEVEL.DEEP;
  if (detected.intent === 'followup_deeper') {
    depth = Math.min(DEPTH_LEVEL.DEEP, (session?.lastDepth || DEPTH_LEVEL.STANDARD) + 1);
  }

  const focus = focusFromIntent(detected.intent);
  const exploreMore = detected.intent === 'followup_explore';

  const result = runNumerologyAnalysis({
    birthDate,
    fullName,
    message: input.message,
    depth,
    focus,
    askedPastLife: detected.askedPastLife,
    exploreMore,
    layersAlreadyCovered: session?.layersCovered || [],
    now: input.now,
  });

  const layersCovered = inferCoveredLayers(result, focus, exploreMore);
  touchNumerologySession({
    conversationId,
    userId,
    birthDate,
    fullName,
    depth: result.depth,
    focus,
    layersCovered,
    chartSnapshot: result.ok
      ? {
          lifePath: result.birthChart.lifePath.display,
          personalYear: result.birthChart.personalYear?.display ?? null,
          activeCycle: result.birthChart.lifeCycles?.activeCycle
            ? result.birthChart.lifeCycles.activeCycle.name
            : null,
        }
      : null,
  });

  return {
    handled: true,
    intent: `numerology:${detected.intent}`,
    reply: result.reply,
    engine: 'numerology-engine',
    data: {
      numerologyFlowVersion: NUMEROLOGY_FLOW_VERSION,
      engineVersion: NUMEROLOGY_ENGINE_VERSION,
      methodologyId: result.methodologyId,
      methodologyVersion: result.methodologyVersion,
      school: result.school,
      depth: result.depth,
      focus,
      isFollowUp: detected.isFollowUp,
      askedPastLife: detected.askedPastLife,
      guard: result.guard,
      lifePath: result.birthChart?.lifePath?.display ?? null,
      personalYear: result.birthChart?.personalYear?.display ?? null,
      activeCycle: result.birthChart?.lifeCycles?.activeCycle?.name ?? null,
      hasNameChart: Boolean(result.nameChart?.ok),
      layersAvailable: result.layersAvailable,
      chart: result.ok
        ? {
            birthDate: result.birthChart.birthDate,
            lifePath: result.birthChart.lifePath,
            birthday: result.birthChart.birthday,
            lifeCycles: result.birthChart.lifeCycles,
            pinnacles: result.birthChart.pinnacles,
            challenges: result.birthChart.challenges,
            personalYear: result.birthChart.personalYear,
            karmicDebts: result.birthChart.karmicDebts,
            missingVibrations: result.birthChart.missingVibrations,
            masterPresence: result.birthChart.masterPresence,
          }
        : null,
    },
  };
}

/**
 * @param {object} result
 * @param {string|null} focus
 * @param {boolean} exploreMore
 */
function inferCoveredLayers(result, focus, exploreMore) {
  if (!result?.ok) return [];
  if (focus === 'cycles') return ['cycles'];
  if (focus === 'master') return ['master'];
  if (focus === 'karmic') return ['karmic'];
  if (focus === 'period') return ['period'];
  if (focus === 'explore' || exploreMore) {
    return ['pinnacles', 'challenges', 'missing', 'contradictions', 'cycles'];
  }
  return [
    'lifePath',
    'cycles',
    'period',
    'strengthsShadows',
    'relationships',
    'career',
    'karmic',
    'contradictions',
  ];
}

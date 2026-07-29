// ═══════════════════════════════════════════════════════════════════════
// Atlas Message Service — shared channel-neutral intelligence pipeline
//
// Web Chat, Telegram, and future channels call processAtlasMessage().
// Identity, memory, intent routing, and engine selection are unified here.
// ═══════════════════════════════════════════════════════════════════════

import {
  buildAtlasSystemPrompt,
  resolveChatProfile,
} from './atlas-prompt-loader.js';
import { callOpenAI } from './openai-client.js';
import { extractResponseText } from './atlas-response.js';
import {
  detectAnalysisMode,
  buildChatUserPrompt,
  detectTarotSpreadIntent,
  shouldRouteToPersonalAnalysis,
} from './symbolic-synthesis.js';
import { getUserMemory, isValidUserId } from './user-memory.js';
import {
  buildRelevantMemoryContext,
  detectMemoryIntent,
  processMemoryIntent,
  tryAutoSaveProfile,
  messageRequestsAnalysis,
} from './memory-intents.js';
import { routeTask } from '../runner/task-router.js';
import { formatMetaSynthesisProse } from './symbolic-synthesis.js';
import {
  resolveFounderProfile,
} from './founder-knowledge.js';
import {
  resolveFounderSession,
  buildFounderIdentityBlock,
  buildFounderProfileKnowledgeBlock,
  buildFounderQuestionDirective,
  buildFounderPipelineDebug,
  logFounderPipelineDebug,
  detectFounderIdentityQuestion,
  PIPELINE_VERSION,
} from './founder-identity.js';
import {
  detectConversationIntent,
  tryDeterministicConversationReply,
  shouldInjectFounderContextBlocks,
  resolveReplyMaxTokens,
  CONVERSATION_STYLE_VERSION,
  STYLE_PROCESS_STARTED_AT,
  getStyleCodeVersion,
} from './atlas-conversation-style.js';
import {
  detectAstrologyFlowIntent,
  tryAstrologyFlowReply,
  buildAstrologyAnalysisContext,
  isAstrologyAnalysisIntent,
  ASTROLOGY_FLOW_VERSION,
} from './atlas-astrology-flow.js';
import { PROMPT_PROFILE_MODULES, TAROT_SPREAD_MODULE } from './atlas-prompt-loader.js';
import {
  evaluatePrivacyRequest,
  shouldShortCircuitPrivacy,
  buildRequesterContext,
  filterContextForRequester,
  guardOutboundReply,
  logPrivacyEvent,
  buildPublicFounderPromptBlock,
  PRIVACY_ACTIONS,
} from './privacy/index.js';

const ERROR_REPLIES = {
  BACKEND_UNAVAILABLE: 'Atlas backend şu an kullanılamıyor.',
  MODEL_UNAVAILABLE: 'Model sağlayıcı yapılandırılmamış. OPENAI_API_KEY gerekli.',
  TIMEOUT: 'Yanıt süresi aşıldı. Lütfen tekrar dene.',
  RATE_LIMIT: 'İstek limiti aşıldı. Kısa bir süre sonra tekrar dene.',
  INVALID_INPUT: 'Geçersiz istek.',
  MEMORY_FAILURE: 'Hafıza işlemi başarısız oldu.',
  ENGINE_FAILURE: 'Atlas motoru yanıt üretemedi.',
  UNSUPPORTED_MESSAGE:
    'Şimdilik yalnızca metin mesajlarını okuyabiliyorum. Ses, sticker veya metinsiz fotoğraf yerine yazarak gönder (fotoğrafa yazı eklersen caption olarak okurum).',
};

function normalizeErrorReply(errorCode, fallback = 'Beklenmeyen bir hata oluştu.') {
  return ERROR_REPLIES[errorCode] ?? fallback;
}

/**
 * Apply outbound privacy guard to any pipeline result.
 * @param {AtlasMessageResult} result
 * @param {{
 *   requesterContext: import('./privacy/authorization.js').RequesterContext,
 *   evaluation?: ReturnType<typeof evaluatePrivacyRequest>|null,
 *   channel?: string,
 * }} ctx
 * @returns {AtlasMessageResult}
 */
function applyPrivacyGuardToResult(result, ctx) {
  if (!result || typeof result.reply !== 'string') return result;
  try {
    const guarded = guardOutboundReply(result.reply, {
      requesterContext: ctx.requesterContext,
      evaluation: ctx.evaluation ?? null,
      channel: ctx.channel ?? 'api',
    });
    if (!guarded.blocked) {
      return guarded.reply === result.reply ? result : { ...result, reply: guarded.reply };
    }
    return {
      ...result,
      reply: guarded.reply,
      data: {
        ...(result.data ?? {}),
        privacyBlocked: true,
        privacyReasons: guarded.reasons,
      },
    };
  } catch {
    return result;
  }
}

export { resolveReplyMaxTokens } from './atlas-conversation-style.js';

/** @typedef {'complete' | 'insufficient_data' | 'reject' | 'error'} AtlasMessageStatus */

/**
 * @typedef {Object} AtlasMessageResult
 * @property {AtlasMessageStatus} status
 * @property {string} reply
 * @property {string} [intent]
 * @property {string} [engine]
 * @property {boolean} [memoryUpdated]
 * @property {Record<string, unknown>} [data]
 * @property {string} [errorCode]
 */

/**
 * @typedef {import('./channel-adapters.js').NormalizedAtlasMessage} NormalizedAtlasMessage
 */

function detectPersonalAnalysisIntent(message) {
  return /\b(kişisel analiz|kisisel analiz|personal analysis|tam analiz yap|detaylı kişisel analiz)\b/i.test(
    message ?? '',
  );
}

function parseBirthDateToIso(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

/**
 * Resolve primary intent label for diagnostics.
 * @param {string} message
 * @param {import('./symbolic-synthesis.js').TarotSpreadIntent} tarotIntent
 * @param {ReturnType<typeof detectMemoryIntent>} memoryIntent
 */
function resolveIntentLabel(message, tarotIntent, memoryIntent) {
  if (memoryIntent.type) return `memory:${memoryIntent.type}`;
  if (tarotIntent.active) return `tarot:${tarotIntent.intent}`;
  if (detectPersonalAnalysisIntent(message) || shouldRouteToPersonalAnalysis(message)) {
    return 'personal-analysis';
  }
  const mode = detectAnalysisMode(message);
  if (mode === 'meta-synthesis' || mode === 'daily-guide') return `meta-synthesis:${mode}`;
  return 'conversation';
}

/**
 * Runtime style debug — no secrets. Shared by Web + Telegram responses.
 * @param {{
 *   channel?: string,
 *   userId?: string,
 *   founderSession?: import('./founder-identity.js').FounderSession|null,
 *   conversationIntent: string,
 *   responseMode: string,
 *   maxTokens: number|null,
 *   profile?: string,
 *   tarotActive?: boolean,
 * }} opts
 */
function buildStyleRuntimeDebug(opts) {
  const profile = opts.profile ?? 'conversational';
  const modules = [...(PROMPT_PROFILE_MODULES[profile] ?? [])];
  if (opts.tarotActive && !modules.includes(TAROT_SPREAD_MODULE)) {
    modules.push(TAROT_SPREAD_MODULE);
  }
  return {
    channel: opts.channel ?? 'web',
    userId: opts.userId ?? null,
    founderResolved: Boolean(opts.founderSession),
    intent: opts.conversationIntent,
    selectedResponseMode: opts.responseMode,
    selectedMaxTokens: opts.maxTokens,
    loadedPromptFiles: modules.map((m) => `${m}.md`),
    conversationStyleVersion: CONVERSATION_STYLE_VERSION,
    processStartTime: STYLE_PROCESS_STARTED_AT,
    runningCodeVersion: getStyleCodeVersion(),
    pipelineVersion: PIPELINE_VERSION,
  };
}

function logStyleRuntimeDebug(debug) {
  console.log(
    `[Atlas/style-debug] channel=${debug.channel} userId=${debug.userId} founderResolved=${debug.founderResolved} intent=${debug.intent} mode=${debug.selectedResponseMode} maxTokens=${debug.selectedMaxTokens} style=${debug.conversationStyleVersion} code=${debug.runningCodeVersion} started=${debug.processStartTime} prompts=${(debug.loadedPromptFiles || []).join(',')}`,
  );
}

/**
 * Canonical prompt assembly order — Web, Telegram, and future channels
 * must use buildAtlasPromptBundle(); channel affects delivery only, not prompts.
 */
export const ATLAS_PROMPT_LOAD_ORDER = [
  'conversation-style-override',
  'user-intent',
  'founder-resolution',
  'founder-identity-block-conditional',
  'user-memory-context',
  'system-prompt-assembly',
  'user-prompt-assembly',
];

/**
 * @typedef {Object} AtlasPromptBundle
 * @property {string} systemPrompt
 * @property {string} userPrompt
 * @property {string} mode
 * @property {string} profile
 * @property {import('./symbolic-synthesis.js').TarotSpreadIntent} tarotIntent
 * @property {import('./founder-identity.js').FounderSession|null} founderSession
 * @property {string|null} founderIdentityContext
 * @property {string|null} founderProfileKnowledgeContext
 * @property {string|null} userMemoryContext
 * @property {readonly string[]} loadOrder
 */

/**
 * Shared prompt builder — single source of truth for all channels.
 *
 * @param {NormalizedAtlasMessage} input
 * @param {{ mode?: string }} [options]
 * @returns {AtlasPromptBundle}
 */
export function buildAtlasPromptBundle(input, options = {}) {
  const message = (input.message ?? '').trim();
  const history = input.history ?? [];
  const mode = options.mode ?? detectAnalysisMode(message);
  const tarotIntent = detectTarotSpreadIntent(message, history);
  const profile = resolveChatProfile(mode);

  const requesterContext =
    options.requesterContext ??
    (options.auth
      ? {
          userId: options.auth.authenticated ? options.auth.userId : null,
          channel: input.channel,
          displayName: input.displayName,
          authenticated: options.auth.authenticated === true,
          roles: options.auth.roles ?? [],
          isFounder: Boolean(options.auth.isFounder),
          authMethod: options.auth.authMethod ?? null,
          sessionId: options.auth.sessionId ?? null,
        }
      : buildRequesterContext({
          userId:
            process.env.ATLAS_TEST_TRUST_INPUT_USERID === '1' ? input.userId?.trim() : null,
          channel: input.channel,
          displayName: input.displayName,
          authenticated: process.env.ATLAS_TEST_TRUST_INPUT_USERID === '1' && Boolean(input.userId),
          roles: options.roles ?? ['user'],
          isFounder: Boolean(options.isFounder),
        }));

  const userId = requesterContext.authenticated ? requesterContext.userId : null;

  const privacyEvaluation =
    options.privacyEvaluation ??
    evaluatePrivacyRequest({ message, requesterContext, targetUserId: userId });

  const founderSession = userId ? resolveFounderSession(userId) : null;

  const founderProfile = founderSession?.knowledge ?? null;
  const founderBiographyProfile = founderSession?.biography ?? null;

  // Founder operational context: only for resolved founder sessions (server-linked).
  // Unauthorized third parties never get founderSession, so they cannot receive these blocks.
  // Private DATA disclosure is gated separately by privacyEvaluation / short-circuit.
  const injectFounder =
    Boolean(founderSession) && shouldInjectFounderContextBlocks(message, founderSession);

  const founderIdentityContext =
    injectFounder && founderSession ? buildFounderIdentityBlock(founderSession) : null;

  const founderProfileKnowledgeContext =
    injectFounder && founderSession ? buildFounderProfileKnowledgeBlock(founderSession) : null;

  const founderQuestionDirective =
    injectFounder && founderSession && detectFounderIdentityQuestion(message)
      ? buildFounderQuestionDirective(founderSession, message)
      : null;

  // Context filter: never inject another user's or unauthorized founder memory.
  const filtered = filterContextForRequester({
    requesterContext,
    targetUserId: userId,
    memories: null,
    conversationHistory: history,
    aboutFounder: privacyEvaluation.aboutFounder,
    allowPublicFounderProfile:
      privacyEvaluation.aboutFounder && !privacyEvaluation.authorized,
  });

  let userMemoryContext =
    userId && userId !== 'web:anonymous' && !filtered.strippedCrossUser
      ? buildRelevantMemoryContext(userId, message, mode)
      : null;

  // Unauthorized founder questions must not carry private memory into the prompt.
  if (privacyEvaluation.aboutFounder && !privacyEvaluation.authorized) {
    userMemoryContext = null;
  }

  const publicFounderBlock =
    privacyEvaluation.aboutFounder &&
    !privacyEvaluation.authorized &&
    privacyEvaluation.requestType === 'public_profile'
      ? filtered.publicFounderPromptBlock ?? buildPublicFounderPromptBlock()
      : null;

  const systemPrompt = buildAtlasSystemPrompt({
    profile,
    mode,
    tarotIntent,
    founderSession: injectFounder ? founderSession : null,
    message,
    includePrivacyInstructions: true,
  });

  const userPrompt = buildChatUserPrompt(message, filtered.conversationHistory, mode, tarotIntent, {
    founderIdentityContext: founderIdentityContext ?? publicFounderBlock,
    founderProfileKnowledgeContext,
    founderQuestionDirective,
    userMemoryContext,
  });

  return {
    systemPrompt,
    userPrompt,
    mode,
    profile,
    tarotIntent,
    founderSession,
    founderProfile,
    founderBiographyProfile,
    founderIdentityContext,
    founderProfileKnowledgeContext,
    userMemoryContext,
    privacyEvaluation,
    loadOrder: ATLAS_PROMPT_LOAD_ORDER,
  };
}

/**
 * Shared Atlas intelligence pipeline.
 * @param {NormalizedAtlasMessage} input
 * @param {{
 *   model?: string,
 *   temperature?: number,
 *   maxTokens?: number,
 *   mode?: string,
 *   runner?: import('../runner/runner.js').Runner,
 * }} [options]
 * @returns {Promise<AtlasMessageResult>}
 */
export async function processAtlasMessage(input, options = {}) {
  const message = (input.message ?? '').trim();
  if (!message) {
    return {
      status: 'error',
      reply: normalizeErrorReply('INVALID_INPUT', 'Mesaj boş olamaz.'),
      errorCode: 'INVALID_INPUT',
      intent: 'validation',
      engine: 'atlas',
    };
  }

  // Test harness only — never enabled for HTTP handlers.
  if (
    !options.auth &&
    !options.requesterContext &&
    !options.trustedUserId &&
    process.env.ATLAS_TEST_TRUST_INPUT_USERID === '1' &&
    input.userId
  ) {
    options = {
      ...options,
      trustedUserId: input.userId,
      roles: options.roles ?? ['user'],
      isFounder: options.isFounder,
    };
  }

  const requesterContext = options.requesterContext
    ? options.requesterContext
    : options.auth
      ? {
          userId: options.auth.authenticated ? options.auth.userId : null,
          channel: input.channel,
          displayName: input.displayName,
          authenticated: options.auth.authenticated === true,
          roles: options.auth.roles ?? [],
          isFounder: Boolean(options.auth.isFounder),
          authMethod: options.auth.authMethod ?? null,
          sessionId: options.auth.sessionId ?? null,
        }
      : options.trustedUserId
        ? buildRequesterContext({
            userId: options.trustedUserId,
            channel: input.channel,
            displayName: input.displayName,
            authenticated: true,
            roles: options.roles ?? ['user'],
            isFounder: Boolean(options.isFounder),
            authMethod: 'test_trusted',
          })
        : buildRequesterContext({
            userId: null,
            channel: input.channel,
            displayName: input.displayName,
            authenticated: false,
          });

  // Server-resolved identity overrides any client-supplied userId.
  const userId = requesterContext.authenticated ? requesterContext.userId : null;

  if (userId && !isValidUserId(userId)) {
    return {
      status: 'error',
      reply: normalizeErrorReply('INVALID_INPUT', 'Geçersiz kullanıcı kimliği.'),
      errorCode: 'INVALID_INPUT',
      intent: 'validation',
      engine: 'atlas',
    };
  }

  const privacyEvaluation = evaluatePrivacyRequest({
    message,
    requesterContext,
    targetUserId: userId,
  });

  const privacyGuardCtx = {
    requesterContext,
    evaluation: privacyEvaluation,
    channel: input.channel ?? 'api',
  };

  // Privacy short-circuit BEFORE memory / LLM (backend enforcement).
  if (shouldShortCircuitPrivacy(privacyEvaluation) && privacyEvaluation.safeReply) {
    try {
      logPrivacyEvent({
        channel: input.channel ?? 'api',
        requesterId: userId ?? null,
        eventType:
          privacyEvaluation.action === PRIVACY_ACTIONS.ALLOW_PUBLIC
            ? 'founder_public_profile_served'
            : 'founder_private_data_request',
        action:
          privacyEvaluation.action === PRIVACY_ACTIONS.ALLOW_PUBLIC ? 'allowed_public' : 'blocked',
        requestType: privacyEvaluation.requestType,
        reason: privacyEvaluation.reason,
      });
    } catch {
      // logging must not break chat
    }

    return applyPrivacyGuardToResult(
      {
        status: 'complete',
        reply: privacyEvaluation.safeReply,
        intent: `privacy:${privacyEvaluation.requestType}`,
        engine: 'privacy',
        memoryUpdated: false,
        data: {
          privacyAction: privacyEvaluation.action,
          privacyReason: privacyEvaluation.reason,
          privacyAuthorized: privacyEvaluation.authorized,
          model: 'privacy-policy',
          provider: 'atlas-privacy',
          tokensUsed: 0,
          costUsd: 0,
          latencyMs: 0,
        },
      },
      privacyGuardCtx,
    );
  }

  const history = input.history ?? [];
  const mode = options.mode ?? detectAnalysisMode(message);
  const founderSession =
    userId && userId !== 'web:anonymous' ? resolveFounderSession(userId) : null;
  const pipelineDebug = buildFounderPipelineDebug(input, founderSession);

  logFounderPipelineDebug(pipelineDebug, `Atlas/${input.channel ?? 'web'}`);

  const memoryIntent = userId && userId !== 'web:anonymous' ? detectMemoryIntent(message) : { type: null };
  const tarotIntent = detectTarotSpreadIntent(message, history);
  const intent = resolveIntentLabel(message, tarotIntent, memoryIntent);

  // ── Memory commands ──
  if (userId && userId !== 'web:anonymous') {
    if (memoryIntent.type && !(memoryIntent.type === 'profile-update' && messageRequestsAnalysis(message))) {
      const memoryResult = await processMemoryIntent(userId, message, memoryIntent, {
        founderSession,
      });
      if (memoryResult.handled) {
        return applyPrivacyGuardToResult(
          {
            status: memoryResult.error ? 'error' : 'complete',
            reply: memoryResult.reply ?? '',
            intent,
            engine: 'memory',
            memoryUpdated: memoryResult.memoryUpdated ?? false,
            errorCode: memoryResult.error ? 'MEMORY_FAILURE' : undefined,
            data: {
              mode,
              profile: resolveChatProfile(mode),
              memoryHandled: true,
              model: 'memory',
              provider: 'atlas-memory',
              tokensUsed: 0,
              costUsd: 0,
              latencyMs: 0,
              founderSession: Boolean(founderSession),
              founderId: founderSession?.knowledge.id ?? null,
              pipelineDebug,
              pipelineVersion: PIPELINE_VERSION,
            },
          },
          privacyGuardCtx,
        );
      }
    } else if (memoryIntent.type === 'profile-update') {
      await tryAutoSaveProfile(userId, message);
    }
  }

  // ── Deterministic casual / identity replies (shared Web + Telegram) ──
  const wantsPersonalAnalysis =
    detectPersonalAnalysisIntent(message) || shouldRouteToPersonalAnalysis(message);

  if (!tarotIntent.active && !wantsPersonalAnalysis) {
    const deterministic = tryDeterministicConversationReply({
      message,
      userId,
      founderSession,
    });
    if (deterministic) {
      const styleDebug = buildStyleRuntimeDebug({
        channel: input.channel,
        userId,
        founderSession,
        conversationIntent: deterministic.intent,
        responseMode: 'deterministic',
        maxTokens: 0,
        profile: resolveChatProfile(mode),
        tarotActive: false,
      });
      logStyleRuntimeDebug(styleDebug);
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: deterministic.reply,
          intent: `conversation:${deterministic.intent}`,
          engine: 'conversation-style',
          memoryUpdated: false,
          data: {
            mode,
            profile: resolveChatProfile(mode),
            conversationIntent: deterministic.intent,
            founderSession: Boolean(founderSession),
            founderId: founderSession?.knowledge.id ?? null,
            pipelineDebug,
            pipelineVersion: PIPELINE_VERSION,
            styleDebug,
            model: 'deterministic',
            provider: 'atlas-conversation-style',
            tokensUsed: 0,
            costUsd: 0,
            latencyMs: 0,
          },
        },
        privacyGuardCtx,
      );
    }

    const astrologyFlow = tryAstrologyFlowReply({
      message,
      history,
      userId,
    });
    if (astrologyFlow) {
      const styleDebug = buildStyleRuntimeDebug({
        channel: input.channel,
        userId,
        founderSession,
        conversationIntent: astrologyFlow.intent,
        responseMode: 'astrology-clarify',
        maxTokens: 0,
        profile: resolveChatProfile(mode),
        tarotActive: false,
      });
      logStyleRuntimeDebug(styleDebug);
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: astrologyFlow.reply,
          intent: `astrology:${astrologyFlow.intent}`,
          engine: 'astrology-flow',
          memoryUpdated: false,
          data: {
            mode,
            profile: resolveChatProfile(mode),
            conversationIntent: astrologyFlow.intent,
            astrologyFlowVersion: ASTROLOGY_FLOW_VERSION,
            founderSession: Boolean(founderSession),
            founderId: founderSession?.knowledge.id ?? null,
            pipelineDebug,
            pipelineVersion: PIPELINE_VERSION,
            styleDebug,
            ...(astrologyFlow.data ?? {}),
            model: 'deterministic',
            provider: 'atlas-astrology-flow',
            tokensUsed: 0,
            costUsd: 0,
            latencyMs: 0,
          },
        },
        privacyGuardCtx,
      );
    }
  }

  // ── Personal Analysis (explicit only, requires profile data) ──
  if (wantsPersonalAnalysis && userId && userId !== 'web:anonymous') {
    const memory = getUserMemory(userId);
    const birthIso = parseBirthDateToIso(memory.profile.birthDate);

    if (!birthIso || !memory.profile.birthPlace) {
      return applyPrivacyGuardToResult(
        {
          status: 'insufficient_data',
          reply:
            'Kişisel analiz için doğum tarihi ve doğum yeri gerekli. ' +
            'Web arayüzünde Haritamı Oku akışını kullanabilir veya profil bilgilerini paylaşabilirsin.',
          intent: 'personal-analysis',
          engine: 'core-engine',
          memoryUpdated: false,
          data: {
            mode: 'personal-analysis',
            profile: 'personal-analysis',
            missing: ['birthDate', 'birthPlace'].filter(
              (f) => (f === 'birthDate' ? !birthIso : !memory.profile.birthPlace),
            ),
          },
        },
        privacyGuardCtx,
      );
    }

    if (!options.runner) {
      return applyPrivacyGuardToResult(
        {
          status: 'error',
          reply: normalizeErrorReply('ENGINE_FAILURE', 'Kişisel analiz motoru kullanılamıyor.'),
          errorCode: 'ENGINE_FAILURE',
          intent: 'personal-analysis',
          engine: 'core-engine',
        },
        privacyGuardCtx,
      );
    }

    try {
      const taskId = `msg-${Date.now()}-${input.conversationId}`;
      const envelope = await routeTask(
        {
          task_type: 'personal-analysis',
          task_id: taskId,
          subject_id: userId,
          subject_profile: {
            birth_data: {
              date: birthIso,
              time: memory.profile.birthTime ?? null,
              place: memory.profile.birthPlace,
            },
            life_events: [],
            user_notes: [
              input.displayName ? `Ad: ${input.displayName}` : null,
              memory.profile.location ? `Konum: ${memory.profile.location}` : null,
              `Kanal: ${input.channel}`,
              `Mesaj: ${message}`,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        },
        options.runner,
      );

      if (envelope.result === null) {
        return applyPrivacyGuardToResult(
          {
            status: 'error',
            reply: normalizeErrorReply('ENGINE_FAILURE', 'Kişisel analiz tamamlanamadı.'),
            errorCode: 'ENGINE_FAILURE',
            intent: 'personal-analysis',
            engine: 'core-engine',
          },
          privacyGuardCtx,
        );
      }

      const result = envelope.result;
      const prose = formatMetaSynthesisProse(result.payload?.synthesis ?? result.payload ?? result);
      const reply =
        prose ??
        (result.status === 'reject'
          ? 'Bu istek mevcut verilerle işlenemedi.'
          : 'Kişisel analiz tamamlandı ancak sentez metni üretilemedi.');

      return applyPrivacyGuardToResult(
        {
          status: result.status ?? 'complete',
          reply,
          intent: 'personal-analysis',
          engine: 'core-engine',
          memoryUpdated: false,
          data: {
            mode: 'personal-analysis',
            profile: 'personal-analysis',
            envelope: result,
            model: 'core-engine',
            provider: 'atlas-runner',
          },
        },
        privacyGuardCtx,
      );
    } catch (err) {
      console.error('[Atlas] personal-analysis route error:', err.message);
      return applyPrivacyGuardToResult(
        {
          status: 'error',
          reply: normalizeErrorReply('ENGINE_FAILURE'),
          errorCode: 'ENGINE_FAILURE',
          intent: 'personal-analysis',
          engine: 'core-engine',
        },
        privacyGuardCtx,
      );
    }
  }

  const astrologyIntent = detectAstrologyFlowIntent(message, history);
  const astrologyAnalysis = isAstrologyAnalysisIntent(astrologyIntent);
  const effectiveMode = astrologyAnalysis ? 'daily-guide' : mode;

  const conversationIntent = astrologyIntent ?? detectConversationIntent(message);
  const promptBundle = buildAtlasPromptBundle(input, {
    mode: effectiveMode,
    requesterContext,
    privacyEvaluation,
  });
  let { systemPrompt, userPrompt, profile, founderProfile } = promptBundle;

  let astrologyContext = null;
  if (astrologyAnalysis) {
    astrologyContext = buildAstrologyAnalysisContext({
      message,
      history,
      userId,
    });
    userPrompt = `${userPrompt}\n\n${astrologyContext.promptBlock}`;
  }

  const maxTokens = resolveReplyMaxTokens(message, {
    maxTokens: options.maxTokens,
    mode: effectiveMode,
    tarotActive: tarotIntent.active,
    intent: conversationIntent,
    astrologyLength: astrologyContext?.length,
  });
  const styleDebug = buildStyleRuntimeDebug({
    channel: input.channel,
    userId,
    founderSession,
    conversationIntent,
    responseMode: tarotIntent.active
      ? `llm:tarot:${tarotIntent.intent}`
      : astrologyAnalysis
        ? `llm:astrology:${astrologyIntent}`
        : `llm:${profile}`,
    maxTokens,
    profile,
    tarotActive: tarotIntent.active,
  });
  logStyleRuntimeDebug(styleDebug);

  try {
    const result = await callOpenAI({
      systemPrompt,
      userPrompt,
      model: options.model,
      temperature: options.temperature ?? 0.4,
      maxTokens,
    });

    const reply = extractResponseText(result);
    const engine = tarotIntent.active
      ? 'tarot'
      : astrologyAnalysis
        ? 'astrology-analysis'
        : profile === 'meta-synthesis'
          ? 'meta-synthesis'
          : 'conversation';

    return applyPrivacyGuardToResult(
      {
        status: 'complete',
        reply,
        intent: founderProfile
          ? `${astrologyAnalysis ? `astrology:${astrologyIntent}` : intent}:founder`
          : astrologyAnalysis
            ? `astrology:${astrologyIntent}`
            : intent,
        engine,
        memoryUpdated: false,
        data: {
          mode: effectiveMode,
          profile,
          conversationIntent,
          astrologyIntent: astrologyIntent ?? null,
          astrologyFlowVersion: astrologyAnalysis ? ASTROLOGY_FLOW_VERSION : undefined,
          astrologyMetadata: astrologyContext?.metadata ?? null,
          founderSession: Boolean(founderProfile),
          founderId: founderProfile?.id ?? null,
          founderBiographyLoaded: Boolean(promptBundle.founderBiographyProfile),
          pipelineDebug,
          pipelineVersion: PIPELINE_VERSION,
          styleDebug,
          tarotIntent: tarotIntent.active ? tarotIntent.intent : null,
          memoryHandled: false,
          model: result.model,
          provider: result.provider,
          tokensUsed: result.tokensUsed,
          costUsd: result.costUsd,
          latencyMs: result.latencyMs,
        },
      },
      privacyGuardCtx,
    );
  } catch (err) {
    const msg = err.message ?? 'Unknown error';
    let errorCode = 'ENGINE_FAILURE';
    let status = /** @type {AtlasMessageStatus} */ ('error');

    if (/OPENAI_API_KEY not set/i.test(msg)) {
      errorCode = 'MODEL_UNAVAILABLE';
    } else if (/timeout|aborted|abort/i.test(msg)) {
      errorCode = 'TIMEOUT';
    } else if (/rate limit|429/i.test(msg)) {
      errorCode = 'RATE_LIMIT';
    }

    console.error(`[Atlas] pipeline error (${errorCode}):`, msg);

    return applyPrivacyGuardToResult(
      {
        status,
        reply: normalizeErrorReply(errorCode, msg),
        errorCode,
        intent: founderSession ? `${intent}:founder` : intent,
        engine: 'openai',
        data: {
          mode,
          profile,
          founderSession: Boolean(founderSession),
          founderId: founderSession?.knowledge.id ?? null,
          founderBiographyLoaded: Boolean(founderSession?.biography),
          pipelineDebug,
          pipelineVersion: PIPELINE_VERSION,
        },
      },
      privacyGuardCtx,
    );
  }
}

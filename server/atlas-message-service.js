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
  withProviderRetry,
  classifyProviderError,
  categoryToErrorCode,
} from './provider-errors.js';
import {
  assessResponseCompleteness,
  nextRetryTokenBudget,
} from './response-completeness.js';
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
  extractValidatedMemoryEntity,
  processMemoryIntent,
  tryAutoSaveProfile,
  messageRequestsAnalysis,
  resolvePreferredUserName,
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
  buildFounderVerifiedIdentityReply,
  isFounderSelfNameRecognitionQuestion,
  getFounderPreferredName,
  getFounderIdentityAmbiguity,
  AMBIGUOUS_IDENTITY_USER_REPLY,
  DUPLICATE_LINKED_USER_ID,
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
  AUTHOR_PROFILE_VERSION,
  getActiveAuthorProfile,
} from './author-profile.js';
import {
  PERSONA_ENGINE_VERSION,
  applyPersonaGuards,
  resolvePersonaVoice,
  ingestPersonaFeedbackTurn,
} from './persona-engine.js';
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
import {
  detectCrossLayerSynthesisIntent,
  runMessageCrossLayerSynthesis,
  guardSynthesisReply,
  MESSAGE_SYNTHESIS_BRIDGE_VERSION,
} from './cross-layer-synthesis/message-integration.js';
import {
  applyNarrowReflexPostGuard,
  buildStancePromptHint,
  detectAnalyticStance,
  isCasualReflexBypass,
} from './cognitive-reflex-guards.js';
import {
  analyzeIdentityClaim,
  buildAmbiguousIdentityClarifyReply,
  buildConversationAddressAck,
  buildNameConflictClarifyReply,
  collectVerifiedIdentityClaims,
  formatIdentityClaimsForPrompt,
  shouldClarifyIdentityClaim,
} from './identity-claims.js';
import {
  buildSpeakerAttributionPromptBlock,
  extractTextMentionedPeople,
  resolveTrustedSpeakerForPrompt,
  guardMisaddressedSpeakerReply,
  sanitizeSpeakerLabel,
} from './speaker-attribution.js';
import {
  detectHealthSafetyIntent,
  buildHealthSafetyReply,
  buildUserVisibleFallback,
  guardHealthSafetyReply,
  buildHealthSafetyPromptDirective,
  resolveResultStatus,
  normalizeLongMessage,
  HEALTH_SAFETY_VERSION,
} from './health-safety.js';
import {
  tryDeterministicAbjadReply,
  runAbjadEsmaVerification,
  ABJAD_VERIFICATION_VERSION,
} from './abjad-verification.js';
import {
  tryResolveConversationContext,
  applyRepetitionGuard,
  noteAssistantTurn,
  getConversationState,
  resolveMaxTokensForResponseMode,
  CONVERSATION_CONTEXT_VERSION,
  logSelfProfileDebug,
} from './conversation-context-engine.js';
import {
  evaluateActivation,
  CONVERSATION_ACTIVATION_VERSION,
} from './conversation-activation.js';
import {
  tryNumerologyFlowReply,
  NUMEROLOGY_FLOW_VERSION,
} from './numerology-flow.js';
import {
  tryTarotFlowReply,
  TAROT_FLOW_VERSION,
  NO_ACTIVE_TAROT_SPREAD_REPLY,
} from './tarot-flow.js';
import {
  tryDreamFlowReply,
  DREAM_FLOW_VERSION,
} from './dream-flow.js';
import {
  tryAudioStudioFlowReply,
  AUDIO_STUDIO_FLOW_VERSION,
} from './audio-studio-flow.js';
import {
  createRequestTiming,
  attachRequestTiming,
} from './request-timing.js';

const ERROR_REPLIES = {
  BACKEND_UNAVAILABLE: 'Atlas backend şu an kullanılamıyor.',
  MODEL_UNAVAILABLE: 'Model şu an geçici olarak kullanılamıyor. Lütfen biraz sonra tekrar dene.',
  TIMEOUT: 'Mesajını aldım ancak şu anda yanıtı tamamlayamadım. Lütfen birkaç saniye sonra tekrar dene.',
  RATE_LIMIT: 'İstek limiti aşıldı. Kısa bir süre sonra tekrar dene.',
  INVALID_INPUT: 'Geçersiz istek.',
  MEMORY_FAILURE: 'Hafıza işlemi başarısız oldu.',
  ENGINE_FAILURE: 'Atlas bu turda güvenilir bir yanıt üretemedi. Biraz sonra tekrar deneyebilirsin.',
  IMAGE_DOWNLOAD_FAILED: 'Görseli indiremedim. Lütfen fotoğrafı tekrar gönder.',
  UNSUPPORTED_IMAGE_FORMAT:
    'Bu görsel formatını desteklemiyorum. JPEG, PNG, WebP veya GIF gönder.',
  IMAGE_TOO_LARGE: 'Görsel çok büyük. Daha küçük bir fotoğraf gönder (en fazla 10 MB).',
  UNSUPPORTED_MESSAGE:
    'Bu içerik türünü henüz işleyemiyorum. Metin veya fotoğraf gönderebilirsin.',
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
  const timing = ctx?.timing ?? null;
  if (!result || typeof result.reply !== 'string') {
    return finalizeMessageResult(result ?? {
      status: 'error',
      reply: '',
      errorCode: 'ENGINE_FAILURE',
      engine: 'atlas',
    }, ctx?.originalMessage ?? '', timing);
  }
  try {
    const guarded = guardOutboundReply(result.reply, {
      requesterContext: ctx.requesterContext,
      evaluation: ctx.evaluation ?? null,
      channel: ctx.channel ?? 'api',
    });
    let reply = guarded.blocked ? guarded.reply : guarded.reply;
    let speakerCorrected = false;
    if (ctx?.speakerGuard) {
      const sg = guardMisaddressedSpeakerReply(reply, ctx.speakerGuard);
      reply = sg.reply;
      speakerCorrected = Boolean(sg.corrected);
    }
    if (!guarded.blocked) {
      const next =
        reply === result.reply
          ? result
          : {
              ...result,
              reply,
              data: {
                ...(result.data ?? {}),
                ...(speakerCorrected ? { speakerAddressCorrected: true } : {}),
              },
            };
      return finalizeMessageResult(next, ctx.originalMessage ?? '', timing);
    }
    return finalizeMessageResult(
      {
        ...result,
        reply,
        data: {
          ...(result.data ?? {}),
          privacyBlocked: true,
          privacyReasons: guarded.reasons,
          ...(speakerCorrected ? { speakerAddressCorrected: true } : {}),
        },
      },
      ctx.originalMessage ?? '',
      timing,
    );
  } catch {
    return finalizeMessageResult(result, ctx.originalMessage ?? '', timing);
  }
}

export { resolveReplyMaxTokens } from './atlas-conversation-style.js';

/** @typedef {'complete' | 'insufficient_data' | 'reject' | 'error' | 'safe_redirect' | 'success'} AtlasMessageStatus */

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

/**
 * Runtime directive when conversation intent is explicit detail.
 * Prevents casual brevity rules from collapsing a first-turn detail answer.
 * @param {string} message
 */
export function buildDetailIntentRuntimeDirective(message = '') {
  const aboutAtlas = /\b(atlas\s+nedir|sen kimsin|ne\s+yaparsın|neler\s+yapabilirsin)\b/i.test(
    String(message ?? ''),
  );
  const layers = aboutAtlas
    ? [
        '1) Atlas’ın kimliği ve rolü',
        '2) Ana yetenek / analiz alanları',
        '3) Nasıl çalıştığı (kısa yöntem)',
        '4) Sınırlar / kesin kehanet yapmama',
        '5) Kullanıcıya pratik değer',
      ]
    : [
        '1) Ana cevap / sonuç',
        '2) Gerekçe veya mekanizma',
        '3) Bağlam / ikincil katman',
        '4) Gerilim, gölge veya dikkat noktası',
        '5) Pratik çıkarım',
      ];
  return `
## DETAIL MODE (explicit user request)

Kullanıcı açıkça detay istedi. Kısa özet veya 1–2 cümlelik tanıtım yeterli DEĞİLDİR.
Casual brevity / “kısa yaz” kuralları bu turda uygulanmaz.
Aşağıdaki katmanları tek yanıtta karşıla (başlık zorunlu değil, içerik zorunlu):
${layers.map((l) => `- ${l}`).join('\n')}
Tekrar etme, sözlük dökme, yapay uzatma yok.
`.trim();
}

/**
 * Deterministic layer checks for a detail-mode reply (tests + guards).
 * @param {string} reply
 * @param {{ aboutAtlas?: boolean }} [opts]
 */
export function scoreDetailReplyLayers(reply, opts = {}) {
  const text = String(reply ?? '');
  const aboutAtlas = Boolean(opts.aboutAtlas);
  /** @type {Array<{ id: string, pass: boolean }>} */
  const checks = aboutAtlas
    ? [
        { id: 'identity_role', pass: /atlas|asistan|rehber|yapay\s*zek/i.test(text) },
        {
          id: 'capabilities',
          pass: /analiz|numerol|astroloj|tarot|sembolik|yorum|bellek|sentez/i.test(text),
        },
        {
          id: 'method_or_how',
          pass: /nasıl|yöntem|katman|veri|hesap|motor|bağlam|örüntü/i.test(text),
        },
        {
          id: 'boundaries',
          pass: /sınır|kehanet|kesin|tıbbi|hukuki|finans|olasılık|sembolik/i.test(text),
        },
        {
          id: 'practical_value',
          pass: /yardım|karar|farkındalık|netleştir|kullanıcı|soru|rehber/i.test(text),
        },
      ]
    : [
        { id: 'main_answer', pass: text.trim().length >= 180 },
        { id: 'rationale', pass: /çünkü|neden|bu\s+yüzden|gerekçe|anlam/i.test(text) },
        { id: 'secondary_layer', pass: /ayrıca|ikinci|katman|bağlam|öte\s+yandan/i.test(text) },
        { id: 'tension_or_caveat', pass: /ancak|ama|gölge|risk|dikkat|sınır/i.test(text) },
        { id: 'practical', pass: /öneri|adım|yapabilir|dene|net/i.test(text) },
      ];
  const passed = checks.filter((c) => c.pass).length;
  return {
    ok: passed >= 4,
    passed,
    total: checks.length,
    failed: checks.filter((c) => !c.pass).map((c) => c.id),
    checks,
  };
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
  const health = detectHealthSafetyIntent(message);
  if (health.active && health.intent) return health.intent;
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
 * Ensure every result carries a user-visible reply + resultStatus contract.
 * @param {AtlasMessageResult} result
 * @param {string} [originalMessage]
 * @param {ReturnType<typeof createRequestTiming>|null} [timing]
 * @returns {AtlasMessageResult}
 */
function finalizeMessageResult(result, originalMessage = '', timing = null) {
  if (
    result?.data?.noResponse === true ||
    result?.intent === 'activation:no_response'
  ) {
    const bare = {
      ...result,
      status: 'complete',
      reply: '',
      intent: result.intent || 'activation:no_response',
      engine: result.engine || 'conversation-activation',
      data: {
        ...(result.data ?? {}),
        noResponse: true,
        resultStatus: 'no_response',
      },
    };
    return timing ? attachRequestTiming(bare, timing) : bare;
  }

  const withReply = { ...result };
  if (!withReply.reply || !String(withReply.reply).trim()) {
    const fallback = buildUserVisibleFallback(originalMessage);
    withReply.reply = fallback.reply;
    withReply.status = 'error';
    withReply.errorCode = withReply.errorCode ?? fallback.errorCode ?? 'ENGINE_FAILURE';
  }

  const health = detectHealthSafetyIntent(originalMessage);
  if (
    result.engine !== 'health-safety' &&
    (health.active || /\b(g[öo]z|g[öo]rme|karart|u[cç]u[sş]ma|cin|epifiz)\b/i.test(originalMessage))
  ) {
    const guarded = guardHealthSafetyReply(withReply.reply);
    withReply.reply = guarded.reply;
    if (guarded.blockedClaims.length) {
      withReply.data = {
        ...(withReply.data ?? {}),
        healthSafetyGuarded: true,
        healthBlockedClaims: guarded.blockedClaims,
      };
    }
  }

  const resultStatus = resolveResultStatus(withReply);
  withReply.data = {
    ...(withReply.data ?? {}),
    resultStatus,
  };
  return timing ? attachRequestTiming(withReply, timing) : withReply;
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
    personaEngineVersion: PERSONA_ENGINE_VERSION,
    personaVoiceId: resolvePersonaVoice({
      channel: opts.channel,
      domain: opts.profile,
      mode: opts.profile,
    })?.id ?? null,
    authorProfileVersion: AUTHOR_PROFILE_VERSION,
    authorProfileId: getActiveAuthorProfile()?.id ?? null,
    feedbackDebug: opts.feedbackDebug ?? null,
    processStartTime: STYLE_PROCESS_STARTED_AT,
    runningCodeVersion: getStyleCodeVersion(),
    pipelineVersion: PIPELINE_VERSION,
  };
}

function logStyleRuntimeDebug(debug) {
  console.log(
    `[Atlas/style-debug] channel=${debug.channel} userId=${debug.userId} founderResolved=${debug.founderResolved} intent=${debug.intent} mode=${debug.selectedResponseMode} maxTokens=${debug.selectedMaxTokens} style=${debug.conversationStyleVersion} author=${debug.authorProfileVersion} code=${debug.runningCodeVersion} started=${debug.processStartTime} prompts=${(debug.loadedPromptFiles || []).join(',')}`,
  );
}

/**
 * Canonical prompt assembly order — Web, Telegram, and future channels
 * must use buildAtlasPromptBundle(); channel affects delivery only, not prompts.
 */
export const ATLAS_PROMPT_LOAD_ORDER = [
  'conversation-style-override',
  'persona-engine-override',
  'voice-override',
  'author-profile-override',
  'reasoning-override',
  'user-intent',
  'founder-resolution',
  'founder-identity-block-conditional',
  'user-memory-context',
  'conversation-context',
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

  // Founder session: resolved from channel-linked userId (not keywords) and always
  // preserved on the bundle. Identity *injection* into prompts is context-gated —
  // only founder/authority/admin intents open the gate (never casual/group/chat).
  const isGroup = Boolean(
    input.metadata && typeof input.metadata === 'object' && input.metadata.isGroup,
  );
  const injectFounderIdentity =
    Boolean(founderSession) &&
    shouldInjectFounderContextBlocks(message, founderSession, { isGroup });
  const injectFounderHeavy = injectFounderIdentity;

  const founderIdentityContext =
    injectFounderIdentity && founderSession ? buildFounderIdentityBlock(founderSession) : null;

  const founderProfileKnowledgeContext =
    injectFounderHeavy && founderSession ? buildFounderProfileKnowledgeBlock(founderSession) : null;

  const founderQuestionDirective =
    injectFounderHeavy &&
    founderSession &&
    detectFounderIdentityQuestion(message, founderSession)
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
      ? buildRelevantMemoryContext(userId, message, mode, {
          accountDisplayName: requesterContext.displayName,
        })
      : null;

  // Unauthorized founder questions must not carry private memory into the prompt.
  if (privacyEvaluation.aboutFounder && !privacyEvaluation.authorized) {
    userMemoryContext = null;
  }

  const identityAnalysis = analyzeIdentityClaim(message);
  const rawAuthenticatedProfile =
    userId && userId !== 'web:anonymous' ? getUserMemory(userId)?.profile ?? null : null;
  const preferredStoredName = resolvePreferredUserName(
    userId && userId !== 'web:anonymous' ? getUserMemory(userId) : null,
    { accountDisplayName: requesterContext.displayName },
  );
  const authenticatedProfile = rawAuthenticatedProfile
    ? {
        ...rawAuthenticatedProfile,
        name: preferredStoredName || rawAuthenticatedProfile.name || null,
      }
    : preferredStoredName
      ? { name: preferredStoredName }
      : null;

  // Name conflict: do not inject conflicting profile name as verified truth.
  if (
    identityAnalysis.name &&
    authenticatedProfile?.name &&
    identityAnalysis.name.toLocaleLowerCase('tr-TR') !==
      String(authenticatedProfile.name).toLocaleLowerCase('tr-TR')
  ) {
    userMemoryContext = userMemoryContext
      ? userMemoryContext
          .split('\n')
          .filter((line) => !/^Ad:/i.test(line.trim()))
          .join('\n') || null
      : null;
  }

  const identityClaims = collectVerifiedIdentityClaims({
    message,
    analysis: identityAnalysis,
    authenticatedProfile,
    founderSession: injectFounderIdentity ? founderSession : null,
    conversationIdentity:
      identityAnalysis.kind === 'conversation_address' || identityAnalysis.kind === 'explicit_name'
        ? { preferredName: identityAnalysis.name }
        : null,
  });
  const identityClaimsBlock = formatIdentityClaimsForPrompt(identityClaims);

  const trustedSpeaker = resolveTrustedSpeakerForPrompt(input, {
    // Pass through undefined for in-process/tests; HTTP sets true/false explicitly.
    atlasBotVerified: options.atlasBotVerified,
  });

  const mentionKeys = new Set(
    (trustedSpeaker.mentionedPeople || []).map((m) =>
      String(m?.name ?? '')
        .trim()
        .toLocaleLowerCase('tr-TR')
        .replace(/['’].*$/, ''),
    ),
  );

  const memoryProfileName =
    authenticatedProfile?.name && typeof authenticatedProfile.name === 'string'
      ? sanitizeSpeakerLabel(authenticatedProfile.name, { fallback: null })
      : null;

  // Memory name that matches a mentioned person must not override Telegram sender.
  if (
    memoryProfileName &&
    mentionKeys.has(memoryProfileName.toLocaleLowerCase('tr-TR').replace(/['’].*$/, ''))
  ) {
    userMemoryContext = userMemoryContext
      ? userMemoryContext
          .split('\n')
          .filter((line) => !/^Ad:/i.test(line.trim()))
          .join('\n') || null
      : null;
  }

  const meta = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  const speakerAttributionContext =
    Boolean(meta.isGroup) ||
    trustedSpeaker.mentionedPeople.length > 0 ||
    Boolean(trustedSpeaker.replyTarget?.displayName || trustedSpeaker.replyTarget?.username)
      ? buildSpeakerAttributionPromptBlock({
          senderDisplayName: trustedSpeaker.senderDisplayName,
          senderUsername: trustedSpeaker.senderUsername,
          replyTarget: trustedSpeaker.replyTarget,
          mentionedPeople: trustedSpeaker.mentionedPeople,
          memoryProfileName:
            memoryProfileName &&
            !mentionKeys.has(memoryProfileName.toLocaleLowerCase('tr-TR').replace(/['’].*$/, ''))
              ? memoryProfileName
              : null,
          isGroup: Boolean(meta.isGroup),
        })
      : null;

  const publicFounderBlock =
    privacyEvaluation.aboutFounder &&
    !privacyEvaluation.authorized &&
    privacyEvaluation.requestType === 'public_profile'
      ? filtered.publicFounderPromptBlock ?? buildPublicFounderPromptBlock()
      : null;

  const abjadVerification = runAbjadEsmaVerification({
    message,
    history: filtered.conversationHistory ?? history ?? [],
  });
  const abjadVerificationContext = abjadVerification.active
    ? abjadVerification.promptBlock
    : null;

  const lastAssistant = [...(history || [])]
    .reverse()
    .find((h) => h && (h.role === 'assistant' || h.role === 'atlas'));
  const lastAssistantText =
    typeof lastAssistant?.content === 'string'
      ? lastAssistant.content
      : typeof lastAssistant?.text === 'string'
        ? lastAssistant.text
        : null;

  const feedbackLearning = ingestPersonaFeedbackTurn({
    userMessage: message,
    assistantResponse: lastAssistantText,
    revisedText: options.revisedText ?? null,
    conversationId: input.conversationId ?? null,
    channel: input.channel ?? null,
    mode,
    brand: options.brand ?? null,
    activeVoice: resolvePersonaVoice({
      channel: input.channel,
      mode,
      domain: tarotIntent?.active ? 'tarot' : mode,
    }),
  });

  const systemPrompt = buildAtlasSystemPrompt({
    profile,
    mode,
    tarotIntent,
    // Pass founderSession only when context gate opens — both compact
    // "Kurucu Oturumu Aktif" and heavy FOUNDER SYSTEM CONTEXT stay gated.
    founderSession: injectFounderIdentity ? founderSession : null,
    message,
    channel: input.channel,
    domain: tarotIntent?.active ? 'tarot' : mode,
    brand: options.brand ?? null,
    conversationId: input.conversationId ?? null,
    feedbackResolution: feedbackLearning.resolution,
    includePrivacyInstructions: true,
    injectFounderHeavy,
    injectFounderIdentity,
  });

  const userPrompt = buildChatUserPrompt(message, filtered.conversationHistory, mode, tarotIntent, {
    founderIdentityContext: founderIdentityContext ?? publicFounderBlock,
    founderProfileKnowledgeContext,
    founderQuestionDirective,
    userMemoryContext,
    identityContext: identityClaimsBlock,
    speakerAttributionContext,
    abjadVerificationContext,
    conversationContext: options.conversationContextBlock || null,
    repliedToText: options.repliedToText || input.metadata?.repliedToText || null,
    quotedText: options.quotedText || input.metadata?.quotedText || null,
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
    abjadVerification: abjadVerification.active ? abjadVerification : null,
    feedbackLearning,
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
  const conversationIdForTiming = String(
    input.conversationId ?? input.userId ?? 'default',
  );
  const requestTiming = createRequestTiming({
    channel: input.channel ?? 'api',
    conversationId: conversationIdForTiming,
  });
  requestTiming.mark('received');
  requestTiming.start('normalization');

  const longNorm = normalizeLongMessage(input.message ?? '');
  let message = longNorm.normalized;
  requestTiming.end('normalization');
  if (!message) {
    return finalizeMessageResult({
      status: 'error',
      reply: normalizeErrorReply('INVALID_INPUT', 'Mesaj boş olamaz.'),
      errorCode: 'INVALID_INPUT',
      intent: 'validation',
      engine: 'atlas',
    }, '', requestTiming);
  }

  const hasImage = Boolean(input.image?.base64);
  requestTiming.start('health_safety');
  const healthSafety = detectHealthSafetyIntent(message);
  requestTiming.end('health_safety');

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
    return finalizeMessageResult({
      status: 'error',
      reply: normalizeErrorReply('INVALID_INPUT', 'Geçersiz kullanıcı kimliği.'),
      errorCode: 'INVALID_INPUT',
      intent: 'validation',
      engine: 'atlas',
    }, message, requestTiming);
  }

  // ── Conversation activation & session gate (default NO_RESPONSE in groups) ──
  requestTiming.start('activation');
  const conversationIdEarly = String(input.conversationId ?? userId ?? 'default');
  const metaEarly =
    input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  const activation = evaluateActivation({
    message,
    conversationId: conversationIdEarly,
    userId,
    channel: input.channel,
    isGroup: Boolean(metaEarly.isGroup),
    metadata: metaEarly,
  });
  requestTiming.end('activation');
  console.log(
    `[Atlas/activation] decision=${activation.decision} reason=${activation.reason}` +
      ` isGroup=${activation.isGroup} skipResolvers=${activation.skipResolvers}` +
      ` userId=${userId || 'none'} conversationId=${conversationIdEarly}` +
      ` version=${CONVERSATION_ACTIVATION_VERSION}`,
  );

  if (activation.noResponse) {
    return finalizeMessageResult(
      {
        status: 'complete',
        reply: '',
        intent: 'activation:no_response',
        engine: 'conversation-activation',
        memoryUpdated: false,
        data: {
          noResponse: true,
          activation,
          conversationActivationVersion: CONVERSATION_ACTIVATION_VERSION,
          pipelineVersion: PIPELINE_VERSION,
        },
      },
      message,
      requestTiming,
    );
  }

  if (
    (activation.decision === 'presence' || activation.decision === 'session_end') &&
    activation.presenceReply
  ) {
    return finalizeMessageResult(
      {
        status: 'complete',
        reply: activation.presenceReply,
        intent:
          activation.decision === 'presence'
            ? 'activation:presence_check'
            : 'activation:session_end',
        engine: 'conversation-activation',
        memoryUpdated: false,
        data: {
          noResponse: false,
          activation,
          responseMode: 'presence',
          conversationActivationVersion: CONVERSATION_ACTIVATION_VERSION,
          pipelineVersion: PIPELINE_VERSION,
          model: 'deterministic',
          provider: 'atlas-conversation-activation',
          tokensUsed: 0,
          costUsd: 0,
          latencyMs: 0,
        },
      },
      message,
      requestTiming,
    );
  }

  if (activation.effectiveMessage && activation.effectiveMessage !== message) {
    message = activation.effectiveMessage;
  }
  const skipResolvers = Boolean(activation.skipResolvers);

  const privacyEvaluation = evaluatePrivacyRequest({
    message,
    requesterContext,
    targetUserId: userId,
  });

  const privacyGuardCtx = {
    requesterContext,
    evaluation: privacyEvaluation,
    channel: input.channel ?? 'api',
    originalMessage: message,
    speakerGuard: null,
    timing: requestTiming,
  };

  const history = input.history ?? [];
  const mode = options.mode ?? detectAnalysisMode(message);
  const founderSession =
    userId &&
    userId !== 'web:anonymous' &&
    !String(userId).includes(':sc_')
      ? resolveFounderSession(userId)
      : null;
  const pipelineDebug = buildFounderPipelineDebug(input, founderSession);
  const identityAmbiguous =
    Boolean(userId) &&
    userId !== 'web:anonymous' &&
    getFounderIdentityAmbiguity(userId);

  logFounderPipelineDebug(pipelineDebug, `Atlas/${input.channel ?? 'web'}`);

  // Duplicate linkedUserId → fail closed for self-identity / role claims.
  if (identityAmbiguous) {
    const earlyIdentity = analyzeIdentityClaim(message);
    const failClosedIdentity =
      detectConversationIntent(message) === 'who_am_i' ||
      earlyIdentity.kind === 'role_claim' ||
      earlyIdentity.kind === 'ambiguous' ||
      earlyIdentity.kind === 'explicit_name' ||
      earlyIdentity.kind === 'conversation_address' ||
      detectFounderIdentityQuestion(message, null);

    if (failClosedIdentity) {
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: AMBIGUOUS_IDENTITY_USER_REPLY,
          intent: 'identity:ambiguous_linked_user',
          engine: 'identity-claims',
          memoryUpdated: false,
          data: {
            mode,
            profile: resolveChatProfile(mode),
            identityKind: 'ambiguous_linked_user',
            identityAmbiguous: true,
            reasonCode: DUPLICATE_LINKED_USER_ID,
            founderSession: false,
            founderId: null,
            pipelineDebug: {
              ...pipelineDebug,
              founderResolved: false,
              founderProfileLoaded: false,
            },
            model: 'deterministic',
            provider: 'atlas-identity-claims',
            tokensUsed: 0,
            costUsd: 0,
            latencyMs: 0,
          },
        },
        privacyGuardCtx,
      );
    }
  }

  const memoryIntent = userId && userId !== 'web:anonymous' ? detectMemoryIntent(message) : { type: null };
  const tarotIntent = detectTarotSpreadIntent(message, history);
  const intent = resolveIntentLabel(message, tarotIntent, memoryIntent);

  // ── Health / visual-symptom safety (before tarot, astrology, identity, LLM) ──
  // Text-only: deterministic safe redirect. Images still reach multimodal LLM with directive.
  // Health must never route to tarot / spiritual analysis engines.
  if (healthSafety.active && !hasImage) {
    const built = buildHealthSafetyReply(healthSafety);
    return applyPrivacyGuardToResult(
      {
        status: built.status,
        reply: built.reply,
        intent: healthSafety.intent ?? 'health:visual_symptom',
        engine: 'health-safety',
        memoryUpdated: false,
        data: {
          mode,
          profile: resolveChatProfile(mode),
          resultStatus: built.resultStatus,
          healthSafety: {
            version: HEALTH_SAFETY_VERSION,
            category: healthSafety.category,
            visualSymptom: healthSafety.visualSymptom,
            spiritualSeeking: healthSafety.spiritualSeeking,
            urgentSigns: healthSafety.urgentSigns,
            blocks: longNorm.blocks.length,
            suppressedTarot: Boolean(tarotIntent.active),
          },
          model: 'deterministic',
          provider: 'atlas-health-safety',
          tokensUsed: 0,
          costUsd: 0,
          latencyMs: 0,
          pipelineDebug,
          pipelineVersion: PIPELINE_VERSION,
        },
      },
      privacyGuardCtx,
    );
  }

  // ── Memory commands BEFORE privacy short-circuit ──
  // Explicit self-memory writes ("Adım Zeynep, kaydet") must not be stolen by
  // founder-name privacy matches.
  if (userId && userId !== 'web:anonymous' && memoryIntent.type) {
    const analysisBypass =
      memoryIntent.type === 'profile-update' && messageRequestsAnalysis(message);
    const isWriteIntent =
      memoryIntent.type === 'save' || memoryIntent.type === 'profile-update';
    const validatedEntity = isWriteIntent
      ? extractValidatedMemoryEntity(message, memoryIntent)
      : null;

    if (analysisBypass) {
      if (validatedEntity) {
        await tryAutoSaveProfile(userId, message);
      }
    } else {
      const allowWritePath = !isWriteIntent || Boolean(validatedEntity);
      const allowExplicitClarify =
        isWriteIntent &&
        !validatedEntity &&
        (memoryIntent.clarity === 'explicit' || memoryIntent.clarity === 'ambiguous');

      if (allowWritePath || allowExplicitClarify || memoryIntent.clarity === 'ambiguous') {
        const memoryResult = await processMemoryIntent(userId, message, memoryIntent, {
          founderSession,
        });
        const mayShortCircuit =
          memoryResult.handled &&
          (memoryResult.memoryUpdated === true ||
            memoryIntent.type === 'recall' ||
            memoryIntent.type === 'forget' ||
            allowExplicitClarify ||
            memoryIntent.clarity === 'ambiguous');

        if (mayShortCircuit) {
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
      }
    }
  }

  // ── Conversation context engine (presence / property / repair / short slots) ──
  // Runs before identity ambiguous clarify and founder public-profile dumps.
  // Active-session follow-ups skip identity/profile/self resolvers.
  const conversationId = conversationIdEarly;
  const trustedSpeakerEarly = resolveTrustedSpeakerForPrompt(input, {
    atlasBotVerified: options.atlasBotVerified,
  });
  /** @type {string[]} */
  const alternateMemoryIds = [];
  if (founderSession) {
    // Founder may have facts under web:founder and/or telegram:id
    alternateMemoryIds.push('web:founder');
    const tgFrom =
      input.metadata && typeof input.metadata === 'object'
        ? input.metadata.telegramFromId
        : null;
    if (tgFrom != null && String(tgFrom).trim()) {
      alternateMemoryIds.push(`telegram:${String(tgFrom).trim()}`);
    }
  }

  // ── Audio Studio (capability-honest; before numerology / LLM) ──
  // Never let the LLM invent "gönder, düzenlerim" for studio production.
  if (!hasImage && !healthSafety.active) {
    requestTiming.start('audio_studio');
    const meta = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
    const audioStudioMedia =
      input.audioMedia ||
      (meta.audioStudioFile && typeof meta.audioStudioFile === 'object'
        ? meta.audioStudioFile
        : null);
    const displayNameForAudio =
      trustedSpeakerEarly.senderDisplayName ||
      input.displayName ||
      null;
    const audioStudioFlow = await tryAudioStudioFlowReply({
      message,
      history,
      userId,
      displayName: displayNameForAudio,
      channel: input.channel || 'api',
      chatId: meta.chatId || input.conversationId || null,
      messageId: meta.messageId || null,
      messageThreadId: meta.messageThreadId ?? meta.topicId ?? null,
      replyTargetMessageId: meta.replyTargetMessageId ?? null,
      quotedText: meta.quotedText ?? null,
      repliedToText: meta.repliedToText ?? null,
      activationReason: meta.activationReason ?? null,
      conversationId,
      media: audioStudioMedia,
    });
    requestTiming.end('audio_studio');
    if (audioStudioFlow?.handled && audioStudioFlow.reply) {
      noteAssistantTurn(conversationId, {
        reply: audioStudioFlow.reply,
        intent: audioStudioFlow.intent,
        responseMode: 'audio_studio',
      });
      const styleDebug = buildStyleRuntimeDebug({
        channel: input.channel,
        userId,
        founderSession,
        conversationIntent: audioStudioFlow.intent,
        responseMode: 'audio_studio',
        maxTokens: 0,
        profile: resolveChatProfile(mode),
        tarotActive: false,
      });
      logStyleRuntimeDebug(styleDebug);
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: audioStudioFlow.reply,
          intent: audioStudioFlow.intent,
          engine: audioStudioFlow.engine || 'audio-studio',
          memoryUpdated: false,
          data: {
            mode,
            profile: resolveChatProfile(mode),
            conversationIntent: audioStudioFlow.intent,
            responseMode: 'audio_studio',
            audioStudioFlowVersion: AUDIO_STUDIO_FLOW_VERSION,
            ...(audioStudioFlow.data ?? {}),
            pipelineDebug,
            pipelineVersion: PIPELINE_VERSION,
            styleDebug,
            model: 'deterministic',
            provider: 'atlas-audio-studio',
            tokensUsed: 0,
            costUsd: 0,
            latencyMs: 0,
          },
        },
        privacyGuardCtx,
      );
    }
  }

  // ── Personal numerology engine (layered analysis; before short self-profile) ──
  // Follow-ups stay in numerology session — do not fall through to profile resolvers.
  // Multi-layer / convergence asks must not be monopolized by a solo engine.
  const synthesisIntentGate = healthSafety.active
    ? { wantsSynthesis: false, layersRequested: [] }
    : detectCrossLayerSynthesisIntent(message);
  const preferConvergence =
    synthesisIntentGate.wantsSynthesis === true &&
    (synthesisIntentGate.layersRequested?.length >= 2 ||
      /birlikte|sentez|yakınsama|yakinasma|karşılaştır|karsilastir|denklem|kesişim|kesisim/i.test(
        message,
      ));

  if (!hasImage && !healthSafety.active && !preferConvergence) {
    requestTiming.start('numerology_engine');
    const numerologyFlow = tryNumerologyFlowReply({
      message,
      history,
      userId,
      conversationId,
      now: new Date(),
    });
    requestTiming.end('numerology_engine');
    if (numerologyFlow?.handled && numerologyFlow.reply) {
      noteAssistantTurn(conversationId, {
        reply: numerologyFlow.reply,
        intent: numerologyFlow.intent,
        responseMode: 'numerology_analysis',
      });
      const styleDebug = buildStyleRuntimeDebug({
        channel: input.channel,
        userId,
        founderSession,
        conversationIntent: numerologyFlow.intent,
        responseMode: 'numerology_analysis',
        maxTokens: 0,
        profile: resolveChatProfile(mode),
        tarotActive: false,
      });
      logStyleRuntimeDebug(styleDebug);
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: numerologyFlow.reply,
          intent: numerologyFlow.intent,
          engine: numerologyFlow.engine || 'numerology-engine',
          memoryUpdated: false,
          data: {
            mode,
            profile: resolveChatProfile(mode),
            conversationIntent: numerologyFlow.intent,
            responseMode: 'numerology_analysis',
            numerologyFlowVersion: NUMEROLOGY_FLOW_VERSION,
            ...(numerologyFlow.data ?? {}),
            pipelineDebug,
            pipelineVersion: PIPELINE_VERSION,
            styleDebug,
            model: 'deterministic',
            provider: 'atlas-numerology-engine',
            tokensUsed: 0,
            costUsd: 0,
            latencyMs: 0,
          },
        },
        privacyGuardCtx,
      );
    }
  }

  // ── Tarot interpretation engine (selection ≠ interpretation; depth guard) ──
  // Engine-first for text AND image captions. Never fall through to LLM tarot
  // dictionary dumps. Multimodal card-from-image is not supported in v1.
  // Convergence asks skip solo monopolization (same gate as numerology).
  if (!healthSafety.active && !preferConvergence) {
    requestTiming.start('tarot_engine');
    const tarotFlow = tryTarotFlowReply({
      message,
      history,
      userId,
      conversationId,
    });
    requestTiming.end('tarot_engine');
    if (tarotFlow?.handled && tarotFlow.reply) {
      noteAssistantTurn(conversationId, {
        reply: tarotFlow.reply,
        intent: tarotFlow.intent,
        responseMode: 'tarot_analysis',
      });
      const styleDebug = buildStyleRuntimeDebug({
        channel: input.channel,
        userId,
        founderSession,
        conversationIntent: tarotFlow.intent,
        responseMode: 'tarot_analysis',
        maxTokens: 0,
        profile: resolveChatProfile(mode),
        tarotActive: true,
      });
      logStyleRuntimeDebug(styleDebug);
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: tarotFlow.reply,
          intent: tarotFlow.intent,
          engine: tarotFlow.engine || 'tarot-engine',
          memoryUpdated: false,
          data: {
            mode,
            profile: resolveChatProfile(mode),
            conversationIntent: tarotFlow.intent,
            responseMode: 'tarot_analysis',
            domain: 'tarot',
            tarotFlowVersion: TAROT_FLOW_VERSION,
            imageIgnoredForTarot: Boolean(hasImage),
            ...(tarotFlow.data ?? {}),
            pipelineDebug,
            pipelineVersion: PIPELINE_VERSION,
            styleDebug,
            model: 'deterministic',
            provider: 'atlas-tarot-engine',
            tokensUsed: 0,
            costUsd: 0,
            latencyMs: 0,
          },
        },
        privacyGuardCtx,
      );
    }

    // Remaining tarot protocol hits that the engine did not handle (should be rare).
    // Never open the LLM tarot prompt path — controlled fallback only.
    if (tarotIntent.active) {
      const fallbackReply = hasImage
        ? 'Görsel üzerinden tarot açılımı bu sürümde desteklenmiyor. Niyetini yazarak metin üzerinden açılım isteyebilirsin.'
        : NO_ACTIVE_TAROT_SPREAD_REPLY;
      noteAssistantTurn(conversationId, {
        reply: fallbackReply,
        intent: `tarot:${tarotIntent.intent}`,
        responseMode: 'tarot_fallback',
      });
      const styleDebug = buildStyleRuntimeDebug({
        channel: input.channel,
        userId,
        founderSession,
        conversationIntent: `tarot:${tarotIntent.intent}`,
        responseMode: 'tarot_fallback',
        maxTokens: 0,
        profile: resolveChatProfile(mode),
        tarotActive: true,
      });
      logStyleRuntimeDebug(styleDebug);
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: fallbackReply,
          intent: `tarot:${tarotIntent.intent}`,
          engine: 'tarot-engine',
          memoryUpdated: false,
          data: {
            mode,
            profile: resolveChatProfile(mode),
            conversationIntent: `tarot:${tarotIntent.intent}`,
            responseMode: 'tarot_fallback',
            domain: 'tarot',
            tarotFlowVersion: TAROT_FLOW_VERSION,
            tarotFallback: hasImage ? 'multimodal_unsupported' : 'engine_miss',
            drewCards: false,
            reusedCards: false,
            pipelineDebug,
            pipelineVersion: PIPELINE_VERSION,
            styleDebug,
            model: 'deterministic',
            provider: 'atlas-tarot-engine',
            tokensUsed: 0,
            costUsd: 0,
            latencyMs: 0,
          },
        },
        privacyGuardCtx,
      );
    }
  }

  // ── Dream interpretation engine (multi-layer; after tarot; before context) ──
  // Deterministic symbolic reading. Health intents already blocked above.
  // Convergence asks skip solo monopolization (same gate as numerology/tarot).
  if (!hasImage && !healthSafety.active && !preferConvergence) {
    requestTiming.start('dream_engine');
    const dreamFlow = tryDreamFlowReply({
      message,
      history,
      userId,
      conversationId,
    });
    requestTiming.end('dream_engine');
    if (dreamFlow?.handled && dreamFlow.reply) {
      noteAssistantTurn(conversationId, {
        reply: dreamFlow.reply,
        intent: dreamFlow.intent,
        responseMode: 'dream_analysis',
      });
      const styleDebug = buildStyleRuntimeDebug({
        channel: input.channel,
        userId,
        founderSession,
        conversationIntent: dreamFlow.intent,
        responseMode: 'dream_analysis',
        maxTokens: 0,
        profile: resolveChatProfile(mode),
        tarotActive: false,
      });
      logStyleRuntimeDebug(styleDebug);
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: dreamFlow.reply,
          intent: dreamFlow.intent,
          engine: dreamFlow.engine || 'dream-engine',
          memoryUpdated: false,
          data: {
            mode,
            profile: resolveChatProfile(mode),
            conversationIntent: dreamFlow.intent,
            responseMode: 'dream_analysis',
            domain: 'dream',
            dreamFlowVersion: DREAM_FLOW_VERSION,
            ...(dreamFlow.data ?? {}),
            pipelineDebug,
            pipelineVersion: PIPELINE_VERSION,
            styleDebug,
            model: 'deterministic',
            provider: 'atlas-dream-engine',
            tokensUsed: 0,
            costUsd: 0,
            latencyMs: 0,
          },
        },
        privacyGuardCtx,
      );
    }
  }

  const contextResolution = !hasImage
    ? tryResolveConversationContext({
        conversationId,
        message,
        history,
        sender: {
          userId,
          displayName:
            trustedSpeakerEarly.senderDisplayName ||
            input.displayName ||
            null,
        },
        persistFacts: Boolean(userId && userId !== 'web:anonymous'),
        alternateUserIds: alternateMemoryIds,
        skipProfileResolvers: skipResolvers,
      })
    : { handled: false, responseMode: 'other', analysis: {}, contextBlock: '' };

  if (contextResolution.handled && contextResolution.reply) {
    if (contextResolution.intent === 'context:self_profile_query') {
      const res = contextResolution.analysis?.selfProfileResolution;
      logSelfProfileDebug({
        intent: contextResolution.intent,
        subject: 'self',
        field: contextResolution.analysis?.selfProfile?.field,
        telegramUserId: userId,
        lookupKeys: res?.lookupKeys ?? [userId],
        matchedKey: res?.matchedKey,
        foundField: res?.foundField,
        value: res?.value,
        source: res?.source,
        fallbackReason: res?.fallbackReason,
        path: `processAtlasMessage:${input.channel || 'api'}`,
      });
    }
    const styleDebug = buildStyleRuntimeDebug({
      channel: input.channel,
      userId,
      founderSession,
      conversationIntent: contextResolution.intent,
      responseMode: contextResolution.responseMode,
      maxTokens: 0,
      profile: resolveChatProfile(mode),
      tarotActive: false,
    });
    logStyleRuntimeDebug(styleDebug);
    return applyPrivacyGuardToResult(
      {
        status: 'complete',
        reply: contextResolution.reply,
        intent: contextResolution.intent,
        engine: contextResolution.engine || 'conversation-context',
        memoryUpdated: Boolean(contextResolution.memoryUpdated),
        data: {
          mode,
          profile: resolveChatProfile(mode),
          conversationIntent: contextResolution.intent,
          responseMode: contextResolution.responseMode,
          conversationContextVersion: CONVERSATION_CONTEXT_VERSION,
          contextAnalysis: contextResolution.analysis,
          selfProfileDebug: contextResolution.analysis?.selfProfileResolution
            ? {
                field: contextResolution.analysis?.selfProfile?.field ?? null,
                lookupKeys:
                  contextResolution.analysis.selfProfileResolution.lookupKeys ??
                  [],
                matchedKey:
                  contextResolution.analysis.selfProfileResolution.matchedKey ??
                  null,
                foundField:
                  contextResolution.analysis.selfProfileResolution.foundField ??
                  null,
                source:
                  contextResolution.analysis.selfProfileResolution.source ?? null,
                value:
                  contextResolution.analysis.selfProfileResolution.value ?? null,
                fallbackReason:
                  contextResolution.analysis.selfProfileResolution
                    .fallbackReason ?? null,
              }
            : null,
          pipelineDebug,
          pipelineVersion: PIPELINE_VERSION,
          styleDebug,
          model: 'deterministic',
          provider: 'atlas-conversation-context',
          tokensUsed: 0,
          costUsd: 0,
          latencyMs: 0,
        },
      },
      privacyGuardCtx,
    );
  }

  // ── Identity clarification (before founder-privacy biography short-circuit) ──
  // Casual intents must not be stolen by bare-token name clarification.
  // Active session follow-ups: skip identity / name / profile resolvers.
  if (!skipResolvers) {
  {
    const casualIntent = detectConversationIntent(message);
    const skipIdentityForCasual = [
      'greeting',
      'how_are_you',
      'thanks',
      'ping',
      'fatigue',
      'get_current_hijri_date',
    ].includes(casualIntent);

    const identityAnalysis = analyzeIdentityClaim(message);
    // Conflict checks use stored memory only — account displayName is soft prompt
    // context, not a hard identity lock (would false-conflict "Guest" vs "Lara").
    const storedMemory =
      userId && userId !== 'web:anonymous' ? getUserMemory(userId) : null;
    const profileName =
      resolvePreferredUserName(storedMemory, { accountDisplayName: null }) || null;

    if (!skipIdentityForCasual) {
    // Verified founder self-ID / recognition — confirm from profile, never clarify away.
    const founderSelfConfirm =
      Boolean(founderSession) &&
      (isFounderSelfNameRecognitionQuestion(message, founderSession) ||
        (identityAnalysis.kind === 'ambiguous' &&
          !shouldClarifyIdentityClaim(identityAnalysis, founderSession)) ||
        (identityAnalysis.kind === 'role_claim' &&
          !shouldClarifyIdentityClaim(identityAnalysis, founderSession)));

    if (founderSelfConfirm && founderSession) {
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: buildFounderVerifiedIdentityReply(founderSession),
          intent: 'identity:founder_verified',
          engine: 'identity-claims',
          memoryUpdated: false,
          data: {
            mode,
            profile: resolveChatProfile(mode),
            identityKind: 'founder_verified',
            identityClaims: collectVerifiedIdentityClaims({
              message,
              analysis: identityAnalysis,
              authenticatedProfile: profileName ? { name: profileName } : null,
              founderSession,
            }),
            founderSession: true,
            founderId: founderSession.knowledge.id,
            pipelineDebug,
            pipelineVersion: PIPELINE_VERSION,
            model: 'deterministic',
            provider: 'atlas-identity-claims',
            tokensUsed: 0,
            costUsd: 0,
            latencyMs: 0,
          },
        },
        privacyGuardCtx,
      );
    }

    if (
      identityAnalysis.kind === 'ambiguous' ||
      identityAnalysis.kind === 'role_claim' ||
      privacyEvaluation.requestType === 'ambiguous_identity' ||
      privacyEvaluation.requestType === 'unverified_role_claim'
    ) {
      if (shouldClarifyIdentityClaim(identityAnalysis, founderSession)) {
        const preferredName = founderSession
          ? getFounderPreferredName(founderSession)
          : null;
        const reply =
          identityAnalysis.kind === 'role_claim' &&
          preferredName &&
          identityAnalysis.name &&
          identityAnalysis.name.toLocaleLowerCase('tr-TR') !==
            preferredName.toLocaleLowerCase('tr-TR')
            ? buildNameConflictClarifyReply(preferredName, identityAnalysis.name)
            : buildAmbiguousIdentityClarifyReply(identityAnalysis);

        return applyPrivacyGuardToResult(
          {
            status: 'complete',
            reply,
            intent: `identity:${identityAnalysis.kind || privacyEvaluation.requestType}`,
            engine: 'identity-claims',
            memoryUpdated: false,
            data: {
              mode,
              profile: resolveChatProfile(mode),
              identityKind: identityAnalysis.kind,
              identityClaims: collectVerifiedIdentityClaims({
                message,
                analysis: identityAnalysis,
                authenticatedProfile: profileName ? { name: profileName } : null,
                founderSession,
              }),
              founderSession: Boolean(founderSession),
              founderId: founderSession?.knowledge?.id ?? null,
              pipelineDebug,
              pipelineVersion: PIPELINE_VERSION,
              model: 'deterministic',
              provider: 'atlas-identity-claims',
              tokensUsed: 0,
              costUsd: 0,
              latencyMs: 0,
            },
          },
          privacyGuardCtx,
        );
      }
    }
    } // end !skipIdentityForCasual

    if (
      identityAnalysis.name &&
      profileName &&
      identityAnalysis.name.toLocaleLowerCase('tr-TR') !==
        profileName.toLocaleLowerCase('tr-TR') &&
      (identityAnalysis.kind === 'explicit_name' ||
        identityAnalysis.kind === 'conversation_address')
    ) {
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: buildNameConflictClarifyReply(profileName, identityAnalysis.name),
          intent: 'identity:name_conflict',
          engine: 'identity-claims',
          memoryUpdated: false,
          data: {
            mode,
            profile: resolveChatProfile(mode),
            identityKind: 'name_conflict',
            model: 'deterministic',
            provider: 'atlas-identity-claims',
            tokensUsed: 0,
            costUsd: 0,
            latencyMs: 0,
          },
        },
        privacyGuardCtx,
      );
    }

    // Conversation-scoped address preference — use in-thread, do not write memory.
    if (
      identityAnalysis.kind === 'conversation_address' &&
      identityAnalysis.name &&
      !identityAnalysis.wantsPermanentMemory
    ) {
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: buildConversationAddressAck(identityAnalysis.name, {
            conversationScoped: true,
          }),
          intent: 'identity:conversation_address',
          engine: 'identity-claims',
          memoryUpdated: false,
          data: {
            mode,
            profile: resolveChatProfile(mode),
            conversationIdentity: { preferredName: identityAnalysis.name },
            identityClaims: collectVerifiedIdentityClaims({
              message,
              analysis: identityAnalysis,
              authenticatedProfile: profileName ? { name: profileName } : null,
            }),
            model: 'deterministic',
            provider: 'atlas-identity-claims',
            tokensUsed: 0,
            costUsd: 0,
            latencyMs: 0,
          },
        },
        privacyGuardCtx,
      );
    }

    // Explicit name intro without save verb: conversation use + offer permanent save.
    if (
      identityAnalysis.kind === 'explicit_name' &&
      identityAnalysis.name &&
      !identityAnalysis.wantsPermanentMemory &&
      !memoryIntent?.type
    ) {
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: buildConversationAddressAck(identityAnalysis.name, {
            conversationScoped: true,
          }),
          intent: 'identity:explicit_name_session',
          engine: 'identity-claims',
          memoryUpdated: false,
          data: {
            mode,
            profile: resolveChatProfile(mode),
            conversationIdentity: { preferredName: identityAnalysis.name },
            identityClaims: collectVerifiedIdentityClaims({
              message,
              analysis: identityAnalysis,
              authenticatedProfile: profileName ? { name: profileName } : null,
            }),
            model: 'deterministic',
            provider: 'atlas-identity-claims',
            tokensUsed: 0,
            costUsd: 0,
            latencyMs: 0,
          },
        },
        privacyGuardCtx,
      );
    }
  }
  } // end !skipResolvers (identity / name clarification)

  // Privacy short-circuit BEFORE LLM (backend enforcement).
  // Active-session follow-ups keep session context — do not dump public profiles.
  if (
    !skipResolvers &&
    shouldShortCircuitPrivacy(privacyEvaluation) &&
    privacyEvaluation.safeReply
  ) {
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

  // ── Deterministic casual / identity replies (shared Web + Telegram) ──
  // Images must always reach the multimodal LLM — never short-circuit.
  const wantsPersonalAnalysis =
    detectPersonalAnalysisIntent(message) || shouldRouteToPersonalAnalysis(message);

  if (!hasImage && !tarotIntent.active && !wantsPersonalAnalysis) {
    const synthesisIntentEarly = detectCrossLayerSynthesisIntent(message);
    // Fate refusal always wins — even over multi-layer synthesis requests.
    const astrologyFlowEarly = tryAstrologyFlowReply({ message, history, userId });
    if (astrologyFlowEarly?.intent === 'fate_refusal') {
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: astrologyFlowEarly.reply,
          intent: `astrology:${astrologyFlowEarly.intent}`,
          engine: 'astrology-flow',
          memoryUpdated: false,
          data: {
            mode,
            profile: resolveChatProfile(mode),
            conversationIntent: astrologyFlowEarly.intent,
            astrologyFlowVersion: ASTROLOGY_FLOW_VERSION,
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

    // Multi-layer synthesis must not be short-circuited by astrology clarify prompts.
    if (!synthesisIntentEarly.wantsSynthesis) {
      // Ebced / Esma numeric turns — deterministic engine before casual chat / LLM.
      const abjadDeterministic = tryDeterministicAbjadReply({ message, history });
      if (abjadDeterministic?.reply) {
        return applyPrivacyGuardToResult(
          {
            status: 'complete',
            reply: abjadDeterministic.reply,
            intent: `abjad:${abjadDeterministic.intent?.kind || 'verify'}`,
            engine: 'abjad-verification',
            memoryUpdated: false,
            data: {
              mode,
              profile: resolveChatProfile(mode),
              abjadVerification: {
                version: ABJAD_VERIFICATION_VERSION,
                confidence: abjadDeterministic.confidence,
                kind: abjadDeterministic.intent?.kind,
                claimAccepted: abjadDeterministic.claimAccepted === true,
                spelling: abjadDeterministic.spelling,
                calcTotal:
                  abjadDeterministic.calc?.total ??
                  abjadDeterministic.calc?.primary?.total ??
                  abjadDeterministic.calc?.bare?.total ??
                  null,
              },
              model: 'deterministic',
              provider: 'atlas-abjad-verification',
              tokensUsed: 0,
              costUsd: 0,
              latencyMs: 0,
              pipelineDebug,
              pipelineVersion: PIPELINE_VERSION,
            },
          },
          privacyGuardCtx,
        );
      }

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

      if (astrologyFlowEarly) {
        const styleDebug = buildStyleRuntimeDebug({
          channel: input.channel,
          userId,
          founderSession,
          conversationIntent: astrologyFlowEarly.intent,
          responseMode: 'astrology-clarify',
          maxTokens: 0,
          profile: resolveChatProfile(mode),
          tarotActive: false,
        });
        logStyleRuntimeDebug(styleDebug);
        return applyPrivacyGuardToResult(
          {
            status: 'complete',
            reply: astrologyFlowEarly.reply,
            intent: `astrology:${astrologyFlowEarly.intent}`,
            engine: astrologyFlowEarly.engine || 'astrology-flow',
            memoryUpdated: false,
            data: {
              mode,
              profile: resolveChatProfile(mode),
              conversationIntent: astrologyFlowEarly.intent,
              astrologyFlowVersion: ASTROLOGY_FLOW_VERSION,
              founderSession: Boolean(founderSession),
              founderId: founderSession?.knowledge.id ?? null,
              pipelineDebug,
              pipelineVersion: PIPELINE_VERSION,
              styleDebug,
              ...(astrologyFlowEarly.data ?? {}),
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
          : 'Analiz tamamlandı; bu turda gösterilecek sentez metni oluşmadı. Niyetini netleştirip yeniden sorabilirsin.');

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

  const astrologyIntent = healthSafety.active ? null : detectAstrologyFlowIntent(message, history);
  const synthesisIntentPre = healthSafety.active
    ? {
        wantsSynthesis: false,
        combineExplicit: false,
        layersRequested: [],
        isUserExample: false,
        skippedReason: 'health_safety',
      }
    : detectCrossLayerSynthesisIntent(message);
  const astrologyAnalysis =
    isAstrologyAnalysisIntent(astrologyIntent) ||
    (synthesisIntentPre.wantsSynthesis &&
      synthesisIntentPre.layersRequested.includes('astrology'));
  const effectiveMode =
    astrologyAnalysis || synthesisIntentPre.wantsSynthesis
      ? synthesisIntentPre.wantsSynthesis
        ? 'meta-synthesis'
        : 'daily-guide'
      : mode;

  const conversationIntent = astrologyIntent ?? detectConversationIntent(message);
  const casualReflexBypass = isCasualReflexBypass(conversationIntent);
  const analyticStance = detectAnalyticStance(message, { conversationIntent });
  const promptBundle = buildAtlasPromptBundle(input, {
    mode: effectiveMode,
    requesterContext,
    privacyEvaluation,
    atlasBotVerified: options.atlasBotVerified,
    conversationContextBlock: contextResolution.contextBlock || null,
  });
  let { systemPrompt, userPrompt, profile, founderProfile } = promptBundle;

  // Explicit detail requests must not inherit casual brevity defaults.
  if (conversationIntent === 'detail') {
    systemPrompt = `${systemPrompt}\n\n${buildDetailIntentRuntimeDirective(message)}`;
  }

  // Stance hints only when not casual and clearly matched — never invent "analysis".
  if (!casualReflexBypass && analyticStance) {
    const stanceHint = buildStancePromptHint(analyticStance);
    if (stanceHint) {
      systemPrompt = `${systemPrompt}\n\n${stanceHint}`;
    }
  }

  const trustedSpeakerRuntime = resolveTrustedSpeakerForPrompt(input, {
    atlasBotVerified: options.atlasBotVerified,
  });
  privacyGuardCtx.speakerGuard = {
    senderDisplayName: trustedSpeakerRuntime.senderDisplayName,
    mentionedPeople: trustedSpeakerRuntime.mentionedPeople,
    message,
  };
  if (healthSafety.active) {
    systemPrompt = `${systemPrompt}\n\n${buildHealthSafetyPromptDirective()}`;
  }

  let astrologyContext = null;
  if (astrologyAnalysis) {
    astrologyContext = buildAstrologyAnalysisContext({
      message,
      history,
      userId,
    });
    userPrompt = `${userPrompt}\n\n${astrologyContext.promptBlock}`;
  }

  // ── Cross-layer synthesis (deterministic skeleton before LLM) — at most once ──
  const synthesisIntent = synthesisIntentPre;
  let synthesisBridge = {
    ran: false,
    skippedReason: 'not_evaluated',
    synthesis: null,
    promptBlock: null,
    intentInfo: synthesisIntent,
  };
  if (synthesisIntent.wantsSynthesis) {
    synthesisBridge = runMessageCrossLayerSynthesis({
      message,
      history,
      userId,
      sessionId: input.conversationId ?? userId ?? 'anonymous',
      astrologyContext,
      verseStore: options.verseStore ?? null,
      intentInfo: synthesisIntent,
      casual: casualReflexBypass,
      stance: analyticStance,
    });
    if (synthesisBridge.ran && synthesisBridge.promptBlock) {
      userPrompt = `${userPrompt}\n\n${synthesisBridge.promptBlock}`;
    }
  }

  const modeTokenCap = resolveMaxTokensForResponseMode(
    contextResolution.responseMode || 'other',
  );
  // Explicit detail / symbolic analysis budgets must not be crushed by casual
  // response-mode caps. Mode caps are floors — never starve a larger intent budget.
  const preferIntentBudget =
    conversationIntent === 'detail' ||
    tarotIntent.active ||
    Boolean(astrologyAnalysis) ||
    synthesisBridge.ran;
  const intentBudget = resolveReplyMaxTokens(message, {
    mode: effectiveMode,
    tarotActive: tarotIntent.active,
    intent: conversationIntent,
    astrologyLength: astrologyContext?.length,
  });
  let maxTokens =
    options.maxTokens ??
    (preferIntentBudget || modeTokenCap == null
      ? intentBudget
      : Math.max(modeTokenCap, intentBudget));
  const styleDebug = buildStyleRuntimeDebug({
    channel: input.channel,
    userId,
    founderSession,
    conversationIntent,
    responseMode: tarotIntent.active
      ? `llm:tarot:${tarotIntent.intent}`
      : synthesisBridge.ran
        ? 'llm:cross-layer-synthesis'
        : astrologyAnalysis
          ? `llm:astrology:${astrologyIntent}`
          : contextResolution.responseMode
            ? `llm:${contextResolution.responseMode}`
            : `llm:${profile}`,
    maxTokens,
    profile,
    tarotActive: tarotIntent.active,
    feedbackDebug: promptBundle.feedbackLearning?.debug ?? null,
  });
  logStyleRuntimeDebug(styleDebug);

  const invokeLlm = options.callOpenAI ?? callOpenAI;

  try {
    requestTiming.start('llm');
    const llmInvoke = (tokenBudget) => {
      requestTiming.noteLlmCall();
      return invokeLlm({
        systemPrompt,
        userPrompt,
        model: options.model,
        temperature: options.temperature ?? 0.4,
        maxTokens: tokenBudget,
        requestId: requestTiming.requestId,
        ...(hasImage
          ? {
              imageBase64: input.image.base64,
              mimeType: input.image.mimeType || 'image/jpeg',
            }
          : {}),
      });
    };

    const { result: firstResult, attempts: llmAttempts } = await withProviderRetry(
      () => llmInvoke(maxTokens),
      {
        requestId: requestTiming.requestId,
        channel: input.channel || 'api',
        route: 'processAtlasMessage.llm',
        provider: 'openai',
        model: options.model || process.env.OPENAI_MODEL || null,
        maxAttempts: 2,
        backoffMs: 450,
        onRetry: () => requestTiming.noteRetryOrFallback(),
      },
    );

    let result = firstResult;
    let completenessRetryCount = 0;
    let completionStatus = 'complete';
    let incompleteReason = null;

    const firstText = extractResponseText(result);
    let completeness = assessResponseCompleteness(
      {
        status: result?.status,
        incompleteReason: result?.incompleteReason,
        incomplete_details: result?.incomplete ? { reason: result.incompleteReason } : null,
      },
      firstText,
    );

    // At most one completeness retry with a larger token budget.
    if (completeness.incomplete) {
      completenessRetryCount = 1;
      requestTiming.noteRetryOrFallback();
      maxTokens = nextRetryTokenBudget(maxTokens);
      console.warn(
        `[Atlas] incomplete reply retry requestId=${requestTiming.requestId}` +
          ` reason=${completeness.reason} nextMaxTokens=${maxTokens}`,
      );
      try {
        result = await llmInvoke(maxTokens);
      } catch (retryErr) {
        requestTiming.end('llm');
        throw retryErr;
      }
      const retryText = extractResponseText(result);
      completeness = assessResponseCompleteness(
        {
          status: result?.status,
          incompleteReason: result?.incompleteReason,
          incomplete_details: result?.incomplete ? { reason: result.incompleteReason } : null,
        },
        retryText,
      );
    }

    requestTiming.end('llm');
    if (llmAttempts > 1) {
      requestTiming.noteRetryOrFallback();
    }

    if (completeness.incomplete) {
      completionStatus = 'incomplete';
      incompleteReason = completeness.reason;
      console.error(
        `[Atlas] incomplete reply after retry requestId=${requestTiming.requestId}` +
          ` userId=${userId || 'n/a'} conversationId=${conversationId}` +
          ` reason=${incompleteReason}`,
      );
      return applyPrivacyGuardToResult(
        {
          status: 'error',
          reply:
            'Yanıt tamamlanamadı, tekrar deniyorum başarısız oldu. Lütfen “Yeniden oluştur” ile tekrar dene.',
          intent,
          engine: 'conversation',
          memoryUpdated: false,
          errorCode: 'INCOMPLETE_RESPONSE',
          data: {
            mode: effectiveMode,
            profile,
            resultStatus: 'user_visible_error',
            retryable: true,
            completionStatus,
            incompleteReason,
            completenessRetryCount,
            requestId: requestTiming.requestId,
            model: result?.model ?? options.model ?? 'atlas',
            provider: result?.provider ?? 'openai',
            tokensUsed: result?.tokensUsed ?? 0,
            costUsd: result?.costUsd ?? 0,
            latencyMs: result?.latencyMs ?? 0,
            pipelineDebug,
            pipelineVersion: PIPELINE_VERSION,
            styleDebug,
            memoryHandled: false,
            // Partial text is intentionally NOT promoted as a completed reply.
            partialReplyDiscarded: true,
          },
        },
        privacyGuardCtx,
      );
    }

    requestTiming.start('post_llm_guards');
    let reply = extractResponseText(result);
    let synthesisGuard = null;
    if (synthesisBridge.ran && synthesisBridge.synthesis) {
      synthesisGuard = guardSynthesisReply(reply, synthesisBridge.synthesis);
      reply = synthesisGuard.reply;
      if (synthesisGuard.usedDeterministicFallback) {
        requestTiming.noteRetryOrFallback();
      }
    }

    if (!casualReflexBypass) {
      const reflexPost = applyNarrowReflexPostGuard(reply, {
        casual: false,
        advanceAllowed: synthesisBridge.synthesis?.reflex?.advanceAllowed === true,
        stance: analyticStance,
      });
      reply = reflexPost.reply;
    }

    const authorVoiceGuard = applyPersonaGuards(reply, {
      tarotActive: tarotIntent.active,
    });
    reply = authorVoiceGuard.reply;

    // Repetition guard for group/casual LLM replies
    const convState = getConversationState(conversationId);
    const guarded = applyRepetitionGuard(reply, convState, {
      forceShort:
        contextResolution.responseMode === 'casual_banter' ||
        contextResolution.responseMode === 'casual_ack',
    });
    reply = guarded.reply;
    requestTiming.end('post_llm_guards');
    noteAssistantTurn(conversationId, {
      reply,
      intent: conversationIntent,
      responseMode: contextResolution.responseMode || 'other',
    });

    const engine = tarotIntent.active
      ? 'tarot'
      : synthesisBridge.ran
        ? 'cross-layer-synthesis'
        : astrologyAnalysis
          ? 'astrology-analysis'
          : profile === 'meta-synthesis'
            ? 'meta-synthesis'
            : 'conversation';

    return applyPrivacyGuardToResult(
      {
        status: synthesisBridge.synthesis?.status === 'partial' ? 'complete' : 'complete',
        reply,
        intent: founderProfile
          ? `${synthesisBridge.ran ? 'cross-layer-synthesis' : astrologyAnalysis ? `astrology:${astrologyIntent}` : intent}:founder`
          : synthesisBridge.ran
            ? 'cross-layer-synthesis'
            : astrologyAnalysis
              ? `astrology:${astrologyIntent}`
              : intent,
        engine,
        memoryUpdated: false,
        data: {
          mode: effectiveMode,
          profile,
          conversationIntent,
          responseMode: contextResolution.responseMode || null,
          conversationContextVersion: CONVERSATION_CONTEXT_VERSION,
          astrologyIntent: astrologyIntent ?? null,
          astrologyFlowVersion: astrologyAnalysis ? ASTROLOGY_FLOW_VERSION : undefined,
          astrologyMetadata: astrologyContext?.metadata ?? null,
          founderSession: Boolean(founderProfile),
          founderId: founderProfile?.id ?? null,
          founderBiographyLoaded: Boolean(promptBundle.founderBiographyProfile),
          pipelineDebug,
          pipelineVersion: PIPELINE_VERSION,
          styleDebug,
          feedbackDebug: promptBundle.feedbackLearning?.debug ?? null,
          authorVoiceGuard: {
            changed: Boolean(authorVoiceGuard.changed),
            removedCount: authorVoiceGuard.removed?.length ?? 0,
            guards: authorVoiceGuard.guards ?? [],
          },
          tarotIntent: tarotIntent.active ? tarotIntent.intent : null,
          memoryHandled: false,
          completionStatus,
          incompleteReason,
          completenessRetryCount,
          requestId: requestTiming.requestId,
          model: result.model,
          provider: result.provider,
          tokensUsed: result.tokensUsed,
          costUsd: result.costUsd,
          latencyMs: result.latencyMs,
          crossLayerSynthesis: synthesisBridge.ran
            ? {
                bridgeVersion: MESSAGE_SYNTHESIS_BRIDGE_VERSION,
                ran: true,
                once: true,
                status: synthesisBridge.synthesis?.status ?? null,
                primaryRelationship: synthesisBridge.synthesis?.primaryRelationship?.type ?? null,
                confidence: synthesisBridge.synthesis?.confidence ?? null,
                failedLayers: synthesisBridge.synthesis?.failedLayers ?? [],
                sourceVisibility: synthesisBridge.synthesis?.sourceVisibility ?? [],
                guardViolations: synthesisGuard?.violations ?? [],
                usedDeterministicFallback: Boolean(synthesisGuard?.usedDeterministicFallback),
                layersUsed: (synthesisBridge.collection?.layers ?? []).map((l) => l.layerId),
              }
            : {
                ran: false,
                once: true,
                skippedReason: synthesisBridge.skippedReason ?? 'no_multi_layer_intent',
              },
        },
      },
      privacyGuardCtx,
    );
  } catch (err) {
    const classified = classifyProviderError(err);
    const errorCategory =
      err?.errorCategory || classified.category;
    const errorCode =
      categoryToErrorCode(errorCategory) ||
      (() => {
        const msg = err.message ?? 'Unknown error';
        if (/OPENAI_API_KEY not set/i.test(msg)) return 'MODEL_UNAVAILABLE';
        if (/timeout|aborted|abort/i.test(msg)) return 'TIMEOUT';
        if (/rate limit|429/i.test(msg)) return 'RATE_LIMIT';
        return 'ENGINE_FAILURE';
      })();
    const msg = classified.message || err.message || 'Unknown error';
    let status = /** @type {AtlasMessageStatus} */ ('error');

    console.error(
      `[Atlas] pipeline error (${errorCode}/${errorCategory}) requestId=${requestTiming.requestId}:`,
      msg,
    );

    // Timeout / model failure: prefer deterministic synthesis prose over hard failure when available.
    if (synthesisBridge.ran && synthesisBridge.synthesis?.prose && (errorCode === 'TIMEOUT' || errorCode === 'MODEL_UNAVAILABLE')) {
      return applyPrivacyGuardToResult(
        {
          status: 'complete',
          reply: synthesisBridge.synthesis.prose,
          intent: 'cross-layer-synthesis',
          engine: 'cross-layer-synthesis',
          memoryUpdated: false,
          data: {
            mode: effectiveMode,
            profile,
            fallback: 'deterministic-synthesis-on-llm-error',
            errorCode,
            crossLayerSynthesis: {
              bridgeVersion: MESSAGE_SYNTHESIS_BRIDGE_VERSION,
              ran: true,
              once: true,
              status: synthesisBridge.synthesis.status,
              primaryRelationship: synthesisBridge.synthesis.primaryRelationship?.type ?? null,
              usedDeterministicFallback: true,
              llmError: errorCode,
            },
            pipelineDebug,
            pipelineVersion: PIPELINE_VERSION,
            styleDebug,
          },
        },
        privacyGuardCtx,
      );
    }

    const healthFallback =
      errorCode === 'TIMEOUT' || errorCode === 'MODEL_UNAVAILABLE' || errorCode === 'ENGINE_FAILURE'
        ? buildUserVisibleFallback(message)
        : null;

    return applyPrivacyGuardToResult(
      {
        status,
        reply: healthFallback?.reply ?? normalizeErrorReply(errorCode, msg),
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
          resultStatus: healthFallback?.resultStatus,
          errorCategory,
          retryable: Boolean(healthFallback) || classified.retryEligible,
          requestId: requestTiming.requestId,
          crossLayerSynthesis: synthesisBridge.ran
            ? { ran: true, once: true, llmError: errorCode }
            : { ran: false, once: true },
        },
      },
      privacyGuardCtx,
    );
  }
}

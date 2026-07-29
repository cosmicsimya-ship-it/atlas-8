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

const ERROR_REPLIES = {
  BACKEND_UNAVAILABLE: 'Atlas backend şu an kullanılamıyor.',
  MODEL_UNAVAILABLE: 'Model sağlayıcı yapılandırılmamış. OPENAI_API_KEY gerekli.',
  TIMEOUT: 'Yanıt süresi aşıldı. Lütfen tekrar dene.',
  RATE_LIMIT: 'İstek limiti aşıldı. Kısa bir süre sonra tekrar dene.',
  INVALID_INPUT: 'Geçersiz istek.',
  MEMORY_FAILURE: 'Hafıza işlemi başarısız oldu.',
  ENGINE_FAILURE: 'Atlas motoru yanıt üretemedi.',
  UNSUPPORTED_MESSAGE: 'Bu mesaj türü desteklenmiyor.',
};

function normalizeErrorReply(errorCode, fallback = 'Beklenmeyen bir hata oluştu.') {
  return ERROR_REPLIES[errorCode] ?? fallback;
}

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
 * Canonical prompt assembly order — Web, Telegram, and future channels
 * must use buildAtlasPromptBundle(); channel affects delivery only, not prompts.
 */
export const ATLAS_PROMPT_LOAD_ORDER = [
  'founder-resolution',
  'founder-identity-block',
  'founder-profile-knowledge-block',
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
 * Loading order: Founder Knowledge → Founder Profile → User Memory → System → User prompt.
 *
 * @param {NormalizedAtlasMessage} input
 * @param {{ mode?: string }} [options]
 * @returns {AtlasPromptBundle}
 */
export function buildAtlasPromptBundle(input, options = {}) {
  const message = (input.message ?? '').trim();
  const history = input.history ?? [];
  const userId = input.userId?.trim();
  const mode = options.mode ?? detectAnalysisMode(message);
  const tarotIntent = detectTarotSpreadIntent(message, history);
  const profile = resolveChatProfile(mode);

  const founderSession =
    userId && userId !== 'web:anonymous' ? resolveFounderSession(userId) : null;

  const founderProfile = founderSession?.knowledge ?? null;
  const founderBiographyProfile = founderSession?.biography ?? null;

  const founderIdentityContext = founderSession
    ? buildFounderIdentityBlock(founderSession)
    : null;

  const founderProfileKnowledgeContext = founderSession
    ? buildFounderProfileKnowledgeBlock(founderSession)
    : null;

  const founderQuestionDirective =
    founderSession && detectFounderIdentityQuestion(message)
      ? buildFounderQuestionDirective(founderSession, message)
      : null;

  const userMemoryContext =
    userId && userId !== 'web:anonymous'
      ? buildRelevantMemoryContext(userId, message, mode)
      : null;

  const systemPrompt = buildAtlasSystemPrompt({
    profile,
    mode,
    tarotIntent,
    founderSession,
  });

  const userPrompt = buildChatUserPrompt(message, history, mode, tarotIntent, {
    founderIdentityContext,
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

  const userId = input.userId?.trim();
  if (userId && userId !== 'web:anonymous' && !isValidUserId(userId)) {
    return {
      status: 'error',
      reply: normalizeErrorReply('INVALID_INPUT', 'Geçersiz kullanıcı kimliği.'),
      errorCode: 'INVALID_INPUT',
      intent: 'validation',
      engine: 'atlas',
    };
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
        return {
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
        };
      }
    } else if (memoryIntent.type === 'profile-update') {
      await tryAutoSaveProfile(userId, message);
    }
  }

  // ── Personal Analysis (explicit only, requires profile data) ──
  const wantsPersonalAnalysis =
    detectPersonalAnalysisIntent(message) || shouldRouteToPersonalAnalysis(message);

  if (wantsPersonalAnalysis && userId && userId !== 'web:anonymous') {
    const memory = getUserMemory(userId);
    const birthIso = parseBirthDateToIso(memory.profile.birthDate);

    if (!birthIso || !memory.profile.birthPlace) {
      return {
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
      };
    }

    if (!options.runner) {
      return {
        status: 'error',
        reply: normalizeErrorReply('ENGINE_FAILURE', 'Kişisel analiz motoru kullanılamıyor.'),
        errorCode: 'ENGINE_FAILURE',
        intent: 'personal-analysis',
        engine: 'core-engine',
      };
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
        return {
          status: 'error',
          reply: normalizeErrorReply('ENGINE_FAILURE', 'Kişisel analiz tamamlanamadı.'),
          errorCode: 'ENGINE_FAILURE',
          intent: 'personal-analysis',
          engine: 'core-engine',
        };
      }

      const result = envelope.result;
      const prose = formatMetaSynthesisProse(result.payload?.synthesis ?? result.payload ?? result);
      const reply =
        prose ??
        (result.status === 'reject'
          ? 'Bu istek mevcut verilerle işlenemedi.'
          : 'Kişisel analiz tamamlandı ancak sentez metni üretilemedi.');

      return {
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
      };
    } catch (err) {
      console.error('[Atlas] personal-analysis route error:', err.message);
      return {
        status: 'error',
        reply: normalizeErrorReply('ENGINE_FAILURE'),
        errorCode: 'ENGINE_FAILURE',
        intent: 'personal-analysis',
        engine: 'core-engine',
      };
    }
  }

  // ── Conversational / Meta Synthesis / Tarot via OpenAI ──
  const promptBundle = buildAtlasPromptBundle(input, { mode });
  const { systemPrompt, userPrompt, profile, founderProfile } = promptBundle;

  try {
    const result = await callOpenAI({
      systemPrompt,
      userPrompt,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });

    const reply = extractResponseText(result);
    const engine = tarotIntent.active
      ? 'tarot'
      : profile === 'meta-synthesis'
        ? 'meta-synthesis'
        : 'conversation';

    return {
      status: 'complete',
      reply,
      intent: founderProfile ? `${intent}:founder` : intent,
      engine,
      memoryUpdated: false,
      data: {
        mode,
        profile,
        founderSession: Boolean(founderProfile),
        founderId: founderProfile?.id ?? null,
        founderBiographyLoaded: Boolean(promptBundle.founderBiographyProfile),
        pipelineDebug,
        pipelineVersion: PIPELINE_VERSION,
        tarotIntent: tarotIntent.active ? tarotIntent.intent : null,
        memoryHandled: false,
        model: result.model,
        provider: result.provider,
        tokensUsed: result.tokensUsed,
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
      },
    };
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

    return {
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
    };
  }
}

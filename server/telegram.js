import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  formatTelegramReply,
  normalizeTelegramMessage,
  normalizeErrorReply,
  splitTelegramMessage,
  getTelegramInFlightNotice,
  isTelegramGroupMessageAddressedToBot,
  isTelegramReplyToBot,
} from './channel-adapters.js';
import {
  shouldForwardGroupMessage,
} from './conversation-activation.js';
import {
  resolveFounderSession,
  buildFounderPipelineDebug,
  logFounderPipelineDebug,
} from './founder-identity.js';
import {
  logFounderNotMatchedSafe,
  logFounderSetupHintSafe,
} from './telegram-identity-log.js';
import { telegramHistoryScopeKey } from './telegram-turn-intent.js';
import {
  buildContextualPipelineMessage,
  createGroupContextEntry,
  createProcessedUpdateTracker,
  GROUP_CONTEXT_MAX_AGE_MS,
  groupWakeKey,
  inspectContextualWake,
  isGroupWakeActive,
  isReplyToOtherPerson,
  isWakeWordOnly,
  looksLikeActionableRequest,
  markContextEntryAnswered,
  resolveContextualWake,
  shouldIgnoreTelegramMessage,
  telegramGroupScopeKey,
  trimGroupContext,
} from './telegram-group-context.js';
import {
  resolveMultimodalInbound,
  detectInboundKind,
  TELEGRAM_MEDIA_DIR,
} from './telegram/handlers.js';
import { ensureDir } from './telegram/media.js';
import {
  createInFlightQueue,
  createPollingSupervisor,
  detectClockJump,
  hashChatId,
  logTelegramMessageTrace,
  withRetry,
  TELEGRAM_RESILIENCE_VERSION,
} from './telegram/resilience.js';
import {
  buildUserVisibleFallback,
  detectHealthSafetyIntent,
  resolveResultStatus,
} from './health-safety.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
const BACKEND_MESSAGE_URL = `${BACKEND_URL}/api/atlas/message`;
const POLL_LOCK_FILE = join(__dirname, '..', 'data', 'telegram.poll.lock');
const HEARTBEAT_FILE = join(__dirname, '..', 'data', 'telegram.heartbeat.json');
const ENABLE_POLLING = process.env.TELEGRAM_ENABLE_POLLING !== 'false';
const TELEGRAM_STARTED_AT = new Date().toISOString();

const BACKEND_UNAVAILABLE = normalizeErrorReply('BACKEND_UNAVAILABLE');
const UNEXPECTED_ERROR = normalizeErrorReply('ENGINE_FAILURE');

function safeTelegramError(error) {
  return String(error?.message ?? error ?? 'unknown')
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[REDACTED]')
    .replace(/\b\d{8,10}:[A-Za-z0-9_-]{20,}\b/g, '[REDACTED]')
    .replace(/(Authorization\s*:\s*)\S+/gi, '$1[REDACTED]');
}

function logGroupContextTrace(fields) {
  console.log(`[Telegram/group-context] ${JSON.stringify(fields)}`);
}

function isBackendUnreachable(error) {
  return axios.isAxiosError(error) && !error.response;
}

function isProcessRunning(pid) {
  if (!pid || Number.isNaN(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

function readLockOwnerPid() {
  try {
    return parseInt(readFileSync(POLL_LOCK_FILE, 'utf-8').trim(), 10);
  } catch {
    return NaN;
  }
}

function acquirePollLock() {
  const dataDir = join(__dirname, '..', 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  if (existsSync(POLL_LOCK_FILE)) {
    const ownerPid = readLockOwnerPid();
    if (isProcessRunning(ownerPid)) {
      console.error('[Telegram] Another polling instance is running.');
      console.error(`[Telegram] Lock held by PID ${ownerPid}. Stop that process first.`);
      return false;
    }
    console.warn(
      `[Telegram] Stale poll lock removed (PID ${ownerPid || 'unknown'} is not running).`,
    );
    try {
      unlinkSync(POLL_LOCK_FILE);
    } catch {
      console.error('[Telegram] Could not remove stale lock file:', POLL_LOCK_FILE);
      return false;
    }
  }

  writeFileSync(POLL_LOCK_FILE, String(process.pid), 'utf-8');
  return true;
}

function releasePollLock() {
  try {
    if (!existsSync(POLL_LOCK_FILE)) return;
    const ownerPid = readLockOwnerPid();
    if (ownerPid === process.pid || !isProcessRunning(ownerPid)) {
      unlinkSync(POLL_LOCK_FILE);
    }
  } catch {
    /* ignore */
  }
}

if (!TELEGRAM_BOT_TOKEN) {
  console.error('[Telegram] TELEGRAM_BOT_TOKEN is not set in the environment.');
  process.exit(1);
}

if (!ENABLE_POLLING) {
  console.log('[Telegram] Polling disabled (TELEGRAM_ENABLE_POLLING=false).');
  process.exit(0);
}

if (!acquirePollLock()) {
  process.exit(1);
}

ensureDir(TELEGRAM_MEDIA_DIR);

/** @type {TelegramBot | null} */
let bot = null;
/** @type {{ id: number, username?: string } | null} */
let botIdentity = null;

try {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
    polling: {
      autoStart: true,
      params: {
        timeout: 30,
      },
    },
  });
} catch (err) {
  console.error('[Telegram] Failed to start polling:', err.message);
  releasePollLock();
  process.exit(1);
}

const flightQueue = createInFlightQueue();
let lastWallClock = Date.now();

const pollingSupervisor = createPollingSupervisor({
  heartbeatPath: HEARTBEAT_FILE,
  staleMs: Number(process.env.TELEGRAM_POLL_STALE_MS) || 120_000,
  checkIntervalMs: Number(process.env.TELEGRAM_POLL_WATCHDOG_MS) || 30_000,
  onLog: (msg) => console.warn(msg),
  isConflict: (error) => {
    const message = error?.message ?? String(error);
    return message.includes('409') || message.toLowerCase().includes('conflict');
  },
  startPolling: async () => {
    await bot.startPolling({ restart: true });
  },
  stopPolling: async () => {
    await bot.stopPolling();
  },
});

pollingSupervisor.startWatchdog();

// Sleep/wake detection via wall-clock jumps (screen lock alone does not pause Node;
// system sleep does — reconnect polling after wake).
setInterval(() => {
  const now = Date.now();
  if (detectClockJump(lastWallClock, now)) {
    console.warn(
      `[Telegram] Clock jump detected (${Math.round((now - lastWallClock) / 1000)}s) — likely sleep/wake; reconnecting polling.`,
    );
    void pollingSupervisor.reconnect('sleep_wake');
  }
  lastWallClock = now;
}, 15_000).unref?.();

const botIdentityReady = bot
  .getMe()
  .then((me) => {
    botIdentity = { id: me.id, username: me.username };
    console.log(`[Telegram/process] ${JSON.stringify({
      event: 'identity_ready',
      pid: process.pid,
      startedAt: TELEGRAM_STARTED_AT,
      identity: 'ready',
    })}`);
    console.log(
      '[Telegram] Multimodal: text + photo (OpenAI vision via Atlas pipeline).',
    );
    console.log(
      `[Telegram] Resilience ${TELEGRAM_RESILIENCE_VERSION}: queue + send retry + polling reconnect + heartbeat.`,
    );
    console.log(
      '[Telegram] Group mode: silent by default — mention @Atlas / reply / command, ' +
        'or continue an active session. Privacy Mode in BotFather still filters delivery.',
    );
    console.warn(
      '[Telegram] Local dependency: this process runs on the host PC. ' +
        'Windows sleep suspends Node; screen lock alone usually does not. ' +
        'After wake, watchdog reconnects polling automatically.',
    );
    return true;
  })
  .catch((err) => {
    console.warn(`[Telegram/process] ${JSON.stringify({
      event: 'identity_failed',
      pid: process.pid,
      startedAt: TELEGRAM_STARTED_AT,
      identity: 'not_ready',
      error: safeTelegramError(err),
    })}`);
    return false;
  });

/** @type {Map<string, Array<{ role: 'user' | 'assistant', content: string, userId?: string|null, messageThreadId?: string|number|null }>>} */
const chatHistories = new Map();
const groupInboundContexts = new Map();
/**
 * Per-process, per-(chat+user) "recently addressed" wake window — lets a
 * group follow-up without re-mentioning the bot still reach the pipeline.
 * Local to this process by design: telegram.js and server/index.js run as
 * separate processes, so this cannot (and must not) rely on the backend's
 * own in-memory activation sessions, which this process never sees.
 * TTL reuses GROUP_CONTEXT_MAX_AGE_MS (5 min) — the existing "how long is a
 * recent group message still contextually relevant" window already tuned
 * for this same file, rather than inventing a second magic number.
 */
const groupWakeState = new Map();
const processedUpdates = createProcessedUpdateTracker(2000);
const MAX_HISTORY_TURNS = 20;
let firstFromIdLogged = false;

function normalizeOptions(extra = {}) {
  return {
    id: botIdentity?.id,
    username: botIdentity?.username,
    ...extra,
  };
}

function flightKey(msg) {
  const chatId = msg.chat?.id;
  const fromId = msg.from?.id ?? (msg.sender_chat?.id != null ? `sc_${msg.sender_chat.id}` : null);
  const topic = msg.message_thread_id != null ? `:t${msg.message_thread_id}` : '';
  if (msg.chat?.type === 'group' || msg.chat?.type === 'supergroup') {
    return `${chatId}:${fromId ?? 'unknown'}${topic}`;
  }
  return String(chatId);
}

/**
 * One-time PII-safe founder setup hint (ATLAS_IDENTITY_DEBUG only).
 * Never prints raw from.id, names, or usernames.
 * @param {import('node-telegram-bot-api').Message} _msg
 */
function logFirstTelegramFromId(_msg) {
  if (firstFromIdLogged) {
    return;
  }
  firstFromIdLogged = true;
  logFounderSetupHintSafe(console);
}

function historyKeyForMessage(msg) {
  return telegramHistoryScopeKey({
    chatId: msg.chat?.id,
    messageThreadId: msg.message_thread_id ?? null,
  });
}

function getChatHistory(conversationId) {
  return chatHistories.get(conversationId) ?? [];
}

function getGroupInboundContext(msg) {
  const scope = telegramGroupScopeKey(msg);
  return scope ? groupInboundContexts.get(scope) ?? [] : [];
}

function rememberGroupInbound(msg, text, options = {}) {
  const scope = telegramGroupScopeKey(msg);
  if (!scope) return;
  const nowMs = options.nowMs ?? Date.now();
  const recent = getGroupInboundContext(msg);
  groupInboundContexts.set(
    scope,
    trimGroupContext([
      ...recent,
      createGroupContextEntry(msg, text, { ...options, nowMs }),
    ], nowMs),
  );
}

function markGroupInboundAnswered(msg, messageId) {
  const scope = telegramGroupScopeKey(msg);
  if (!scope) return;
  groupInboundContexts.set(
    scope,
    markContextEntryAnswered(getGroupInboundContext(msg), messageId),
  );
}

/** Start/refresh the wake window for this user in this group right after Atlas replies. */
function setGroupWakeState(msg, nowMs = Date.now()) {
  const key = groupWakeKey(msg);
  if (!key) return;
  groupWakeState.set(key, { expiresAt: nowMs + GROUP_CONTEXT_MAX_AGE_MS });
}

/**
 * Whether this group message should be treated as an unaddressed continuation
 * of a recently-addressed conversation. A reply to a different real person is
 * never auto-claimed, even with an active wake window.
 */
function hasGroupWakeState(msg, nowMs = Date.now()) {
  if (isReplyToOtherPerson(msg, botIdentity)) return false;
  const key = groupWakeKey(msg);
  if (!key) return false;
  if (isGroupWakeActive(groupWakeState.get(key), nowMs)) return true;
  groupWakeState.delete(key);
  return false;
}

/**
 * @param {string} conversationId
 * @param {'user'|'assistant'} role
 * @param {string} content
 * @param {{ userId?: string|null, messageThreadId?: string|number|null }} [meta]
 */
function appendChatTurn(conversationId, role, content, meta = {}) {
  const history = [
    ...getChatHistory(conversationId),
    {
      role,
      content,
      userId: meta.userId ?? null,
      messageThreadId: meta.messageThreadId ?? null,
    },
  ];
  chatHistories.set(conversationId, history.slice(-MAX_HISTORY_TURNS));
}

/**
 * @param {import('node-telegram-bot-api').Message} msg
 * @param {string} reply
 */
async function sendReply(msg, reply) {
  const chatId = msg.chat.id;
  const chunks = splitTelegramMessage(formatTelegramReply(reply));
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  /** @type {import('node-telegram-bot-api').SendMessageOptions} */
  const options = {};
  if (isGroup && msg.message_id) {
    options.reply_to_message_id = msg.message_id;
  }
  if (msg.message_thread_id != null) {
    options.message_thread_id = msg.message_thread_id;
  }

  let totalRetries = 0;
  for (const chunk of chunks) {
    const { retryCount } = await withRetry(
      () => bot.sendMessage(chatId, chunk, options),
      {
        maxAttempts: 3,
        baseMs: 800,
        onRetry: (err, attempt, delay) => {
          console.warn(
            `[Telegram] sendMessage retry attempt=${attempt + 1} delayMs=${delay}: ${err?.message ?? err}`,
          );
        },
      },
    );
    totalRetries += retryCount;
  }
  return { sendResult: 'ok', retryCount: totalRetries };
}

/**
 * Best-effort user-visible reply; never throw out of here without logging.
 * @param {import('node-telegram-bot-api').Message} msg
 * @param {string} reply
 * @param {Record<string, unknown>} [trace]
 */
async function sendReplySafe(msg, reply, trace = {}) {
  try {
    const sent = await sendReply(msg, reply);
    logTelegramMessageTrace({
      ...trace,
      sendResult: sent.sendResult,
      retryCount: sent.retryCount,
      processingCompletedAt: new Date().toISOString(),
    });
    return sent;
  } catch (err) {
    console.error('[Telegram] sendReply failed after retries:', err?.message ?? err);
    logTelegramMessageTrace({
      ...trace,
      sendResult: 'failed',
      errorCode: 'SEND_FAILED',
      resultStatus: 'user_visible_error',
      processingCompletedAt: new Date().toISOString(),
      retryCount: err?.retryCount ?? trace.retryCount ?? 0,
    });
    return { sendResult: 'failed', retryCount: err?.retryCount ?? 0 };
  }
}

/**
 * @param {import('node-telegram-bot-api').Message} msg
 * @param {{
 *   resolvedMessage?: string,
 *   mediaKind?: string|null,
 *   extraMetadata?: Record<string, unknown>,
 *   image?: { mimeType: string, base64: string },
 * }} [resolveOpts]
 */
async function forwardToPipeline(msg, resolveOpts = {}) {
  const historyScope = historyKeyForMessage(msg);
  const history = getChatHistory(historyScope);
  const normalized = normalizeTelegramMessage(
    msg,
    history,
    normalizeOptions({
      ...resolveOpts,
      conversationId: resolveOpts.conversationId,
    }),
  );
  const fromId = msg.from?.id != null ? String(msg.from.id) : null;
  const replyMsg = msg.reply_to_message;
  const repliedToText =
    typeof replyMsg?.text === 'string'
      ? replyMsg.text
      : typeof replyMsg?.caption === 'string'
        ? replyMsg.caption
        : null;

  const founderSession =
    normalized.metadata?.senderType === 'sender_chat'
      ? null
      : resolveFounderSession(normalized.userId);
  const preDebug = buildFounderPipelineDebug(
    {
      channel: 'telegram',
      userId: normalized.userId,
      conversationId: normalized.conversationId,
      message: normalized.message,
      history: normalized.history,
      metadata: {
        telegramFromId: fromId,
        mediaKind: normalized.metadata?.mediaKind ?? null,
        hasImage: Boolean(normalized.image?.base64),
      },
    },
    founderSession,
  );
  logFounderPipelineDebug(preDebug, 'Telegram/inbound');
  if (!founderSession && fromId) {
    logFounderNotMatchedSafe({
      memoryLoaded: Boolean(preDebug.memoryLoaded),
      telegramFromId: fromId,
      updateId: msg.message_id ?? null,
    });
  }

  /** @type {Record<string, unknown>} */
  const payload = {
    channel: 'telegram',
    userId: normalized.userId,
    conversationId: normalized.conversationId,
    message: normalized.message,
    history: normalized.history,
    username: normalized.username,
    displayName: normalized.displayName,
    metadata: {
      ...(normalized.metadata ?? {}),
      ...(fromId ? { telegramFromId: fromId } : { telegramFromId: null }),
      chatId: String(msg.chat.id),
      ...(resolveOpts.contextualSource
        ? { contextualWake: true, contextualSourceMessageId: resolveOpts.contextualSource.messageId ?? null,
            contextualSourceSpeakerKey: resolveOpts.contextualSource.userId ?? null }
        : {}),
      messageThreadId: msg.message_thread_id ?? null,
      replyTargetMessageId: replyMsg?.message_id ?? null,
      repliedToText,
      quotedText: repliedToText,
      historyScopeKey: historyScope,
    },
    context: {
      speakerAttribution: normalized.context?.speakerAttribution ?? null,
      repliedToText,
      quotedText: repliedToText,
    },
  };

  if (normalized.image?.base64) {
    payload.image = {
      mimeType: normalized.image.mimeType || 'image/jpeg',
      base64: normalized.image.base64,
    };
  }

  const { value: response, retryCount } = await withRetry(
    () =>
      axios.post(BACKEND_MESSAGE_URL, payload, {
        timeout: 180_000,
        headers: {
          'X-Atlas-Bot-Secret': process.env.ATLAS_INTERNAL_BOT_SECRET || '',
        },
        maxBodyLength: 20 * 1024 * 1024,
        maxContentLength: 20 * 1024 * 1024,
      }),
    {
      maxAttempts: 2,
      baseMs: 1500,
      isRetryable: (err) => {
        if (!axios.isAxiosError(err)) return false;
        if (err.response?.status && err.response.status < 500 && err.response.status !== 429) {
          return false;
        }
        return isBackendUnreachable(err) || /timeout|ECONNRESET|503|502|429/i.test(err.message);
      },
      onRetry: (err, attempt, delay) => {
        console.warn(
          `[Telegram] backend POST retry attempt=${attempt + 1} delayMs=${delay}: ${err?.message ?? err}`,
        );
      },
    },
  );

  const backendDebug = response.data?.data?.pipelineDebug;
  if (backendDebug) {
    logFounderPipelineDebug(
      { ...backendDebug, telegramFromId: fromId, userId: normalized.userId },
      'Telegram/backend-response',
    );
  } else {
    console.warn(
      `[Telegram] founder-debug missing in backend response — is node server/index.js running on ${BACKEND_URL}?`,
    );
  }

  const styleDebug = response.data?.data?.styleDebug;
  if (styleDebug) {
    console.log(
      `[Telegram/style-debug] intent=${styleDebug.intent} mode=${styleDebug.selectedResponseMode} maxTokens=${styleDebug.selectedMaxTokens} founderResolved=${styleDebug.founderResolved} style=${styleDebug.conversationStyleVersion} code=${styleDebug.runningCodeVersion} started=${styleDebug.processStartTime}`,
    );
  } else {
    console.warn(
      '[Telegram] style-debug missing — backend may be running old code; restart node server/index.js',
    );
  }

  const safeNormalized = { ...normalized };
  delete safeNormalized.image;

  return { backend: response.data, normalized: safeNormalized, retryCount };
}

/**
 * @param {import('node-telegram-bot-api').Message} msg
 */
async function processOneMessage(msg) {
  const chatId = msg.chat.id;
  const isGroupChat = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  if (isGroupChat && !botIdentity) await botIdentityReady;
  const conversationId = isGroupChat ? telegramGroupScopeKey(msg) : String(chatId);
  const receivedAt = new Date().toISOString();
  const inboundText = msg.text || msg.caption || '';
  const messageLength = inboundText.length;
  const updateId = msg.message_id;
  /** @type {Record<string, unknown>} */
  const traceBase = {
    updateId,
    chatId,
    messageLength,
    receivedAt,
  };

  if (msg.text?.trim() === '/start') {
    await sendReplySafe(msg, 'Merhaba. Metin veya fotoğraf gönderebilirsin.', {
      ...traceBase,
      intent: 'command:start',
      resultStatus: 'success',
      processingStartedAt: receivedAt,
    });
    return;
  }

  const inboundTextForGate = (msg.text || msg.caption || '').trim();
  const fromIdForGate =
    msg.from?.id != null
      ? `telegram:${msg.from.id}`
      : msg.sender_chat?.id != null
        ? `telegram:sc_${String(msg.chat.id).replace(/[^a-zA-Z0-9_]/g, '_')}`
        : null;
  const addressedToBot =
    isTelegramReplyToBot(msg, botIdentity) ||
    isTelegramGroupMessageAddressedToBot(msg, inboundTextForGate, botIdentity);
  const nowMs = Number(msg.date) ? Number(msg.date) * 1000 : Date.now();
  const groupScope = isGroupChat ? telegramGroupScopeKey(msg) : null;
  const recentContext = isGroupChat ? getGroupInboundContext(msg) : [];
  const contextInspection = isGroupChat
    ? inspectContextualWake(recentContext, {
        text: inboundTextForGate,
        botUsername: botIdentity?.username,
        nowMs,
      })
    : null;
  const contextualWakeRequest = isGroupChat
    ? resolveContextualWake(recentContext, {
        text: inboundTextForGate,
        botUsername: botIdentity?.username,
        nowMs,
      })
    : null;
  if (isGroupChat) {
    if (contextualWakeRequest) {
      markGroupInboundAnswered(msg, contextualWakeRequest.source.messageId);
    }
    rememberGroupInbound(msg, inboundTextForGate, { nowMs, wasAddressed: addressedToBot });
    if (typeof msg.text === 'string') {
      const contextAfter = getGroupInboundContext(msg);
      const storedEntry = contextAfter.at(-1) ?? null;
      logGroupContextTrace({
        pid: process.pid,
        updateId: msg.message_id ?? null,
        scopeHash: groupScope == null ? null : hashChatId(groupScope),
        messageThreadId: msg.message_thread_id ?? null,
        isTopicMessage: msg.is_topic_message === true,
        messageType: 'text',
        messageLength: inboundTextForGate.length,
        wakeOnly: isWakeWordOnly(inboundTextForGate, botIdentity?.username),
        addressedToBot,
        bufferAdded: storedEntry?.messageId === (msg.message_id ?? null),
        bufferSizeBefore: recentContext.length,
        bufferSizeAfter: contextAfter.length,
        currentActionable: looksLikeActionableRequest(inboundTextForGate),
        wasAddressed: storedEntry?.wasAddressed === true,
        answered: storedEntry?.answered === true,
        candidateMessageId: contextInspection?.candidate?.messageId ?? null,
        candidateActionable: contextInspection?.candidate?.actionable ?? null,
        candidateWasAddressed: contextInspection?.candidate?.wasAddressed ?? null,
        candidateAnswered: contextInspection?.candidate?.answered ?? null,
        contextualWakeMatched: Boolean(contextualWakeRequest),
        contextualWakeReason: contextInspection?.reason ?? 'not_group',
      });
    }
  }
  const groupWakeActive = isGroupChat ? hasGroupWakeState(msg, nowMs) : false;
  const allowForward = shouldForwardGroupMessage({
    message: inboundTextForGate || 'media',
    conversationId,
    userId: fromIdForGate,
    isGroup: isGroupChat,
    addressedToBot: addressedToBot || Boolean(contextualWakeRequest) || groupWakeActive,
  });

  if (isGroupChat && !allowForward) {
    logTelegramMessageTrace({
      ...traceBase,
      intent: 'activation:no_response',
      resultStatus: 'no_response',
      processingStartedAt: receivedAt,
      processingCompletedAt: new Date().toISOString(),
      sendResult: 'skipped_activation_gate',
    });
    console.log(
      `[Telegram] Group silent (activation gate): chat=${chatId} from=${msg.from?.id}`,
    );
    return;
  }

  const inboundKind = detectInboundKind(msg);
  try {
    if (isGroupChat && process.env.TELEGRAM_GROUP_REQUIRE_MENTION === 'true') {
      normalizeTelegramMessage(
        msg,
        getChatHistory(historyKeyForMessage(msg)),
        normalizeOptions({
          resolvedMessage: msg.text || msg.caption || 'media',
          mediaKind: inboundKind === 'text' ? null : inboundKind,
          allowActiveSession: groupWakeActive,
        }),
      );
    }
  } catch (err) {
    if (err.message === 'GROUP_MESSAGE_IGNORED') {
      logTelegramMessageTrace({
        ...traceBase,
        intent: 'group_ignored',
        resultStatus: 'success',
        processingStartedAt: receivedAt,
        processingCompletedAt: new Date().toISOString(),
        sendResult: 'skipped_group_gate',
      });
      console.log(
        `[Telegram] Group message ignored (mention/reply required): chat=${chatId} from=${msg.from?.id}`,
      );
      return;
    }
  }

  const processingStartedAt = new Date().toISOString();
  traceBase.processingStartedAt = processingStartedAt;

  try {
    await bot.sendChatAction(chatId, 'typing');

    const typingTimer = setInterval(() => {
      bot.sendChatAction(chatId, 'typing').catch(() => {});
    }, 4000);

    /** @type {import('./telegram/handlers.js').ResolvedInbound} */
    let resolved;
    try {
      resolved = await resolveMultimodalInbound(bot, msg);
    } finally {
      clearInterval(typingTimer);
    }

    if (resolved.ignore) {
      await sendReplySafe(
        msg,
        normalizeErrorReply('UNSUPPORTED_MESSAGE'),
        {
          ...traceBase,
          intent: 'ignored',
          resultStatus: 'user_visible_error',
          errorCode: 'UNSUPPORTED_MESSAGE',
        },
      );
      return;
    }

    if (resolved.directReply) {
      console.log(
        `[Telegram] Direct reply (${resolved.kind}): mediaKind=${resolved.metadata?.mediaKind ?? inboundKind}` +
          (resolved.errorCode ? ` errorCode=${resolved.errorCode}` : ''),
      );
      await sendReplySafe(msg, resolved.directReply, {
        ...traceBase,
        intent: `direct:${resolved.kind}`,
        resultStatus: resolved.errorCode ? 'user_visible_error' : 'success',
        errorCode: resolved.errorCode ?? null,
      });
      return;
    }

    if (!resolved.message?.trim()) {
      await sendReplySafe(msg, normalizeErrorReply('UNSUPPORTED_MESSAGE'), {
        ...traceBase,
        intent: 'empty',
        resultStatus: 'user_visible_error',
        errorCode: 'UNSUPPORTED_MESSAGE',
      });
      return;
    }

    const effectiveMessage = contextualWakeRequest?.text || resolved.message;
    const pipelineMsg = buildContextualPipelineMessage(msg, contextualWakeRequest);
    const healthHint = detectHealthSafetyIntent(effectiveMessage);
    console.log(
      `[Telegram] Inbound ${resolved.kind}` +
        (resolved.image ? ' +image' : '') +
        ` mediaKind=${resolved.metadata?.mediaKind ?? inboundKind}` +
        ` len=${resolved.message.length}` +
        (healthHint.active ? ` healthIntent=${healthHint.intent}` : ''),
    );

    await bot.sendChatAction(chatId, 'typing');

    const { backend, normalized, retryCount } = await forwardToPipeline(pipelineMsg, {
      resolvedMessage: effectiveMessage,
      conversationId,
      contextualSource: contextualWakeRequest?.source ?? null,
      allowActiveSession: Boolean(contextualWakeRequest),
      mediaKind: resolved.metadata?.mediaKind ?? (inboundKind === 'text' ? null : inboundKind),
      extraMetadata: {
        ...(resolved.metadata || {}),
      },
      image: resolved.image,
    });

    if (resolved.image) {
      resolved.image.base64 = '';
    }

    if (
      backend?.data?.noResponse === true ||
      backend?.intent === 'activation:no_response'
    ) {
      logTelegramMessageTrace({
        ...traceBase,
        intent: 'activation:no_response',
        resultStatus: 'no_response',
        processingCompletedAt: new Date().toISOString(),
        sendResult: 'skipped_no_response',
        retryCount,
      });
      console.log(
        `[Telegram] NO_RESPONSE (pipeline): chat=${chatId} from=${msg.from?.id}`,
      );
      return;
    }

    const reply =
      (typeof backend.reply === 'string' && backend.reply.trim())
        ? backend.reply
        : buildUserVisibleFallback(normalized.message).reply;

    const resultStatus =
      backend.data?.resultStatus ??
      resolveResultStatus({
        status: backend.status,
        errorCode: backend.errorCode,
        intent: backend.intent,
      });

    appendChatTurn(historyKeyForMessage(msg), 'user', normalized.message, {
      userId: normalized.userId,
      messageThreadId: msg.message_thread_id ?? null,
    });
    appendChatTurn(historyKeyForMessage(msg), 'assistant', reply, {
      userId: normalized.userId,
      messageThreadId: msg.message_thread_id ?? null,
    });
    if (isGroupChat) {
      markGroupInboundAnswered(msg, msg.message_id);
      setGroupWakeState(msg);
    }
    await sendReplySafe(msg, reply, {
      ...traceBase,
      intent: backend.intent ?? healthHint.intent ?? null,
      resultStatus,
      errorCode: backend.errorCode ?? null,
      retryCount,
      messageLength: normalized.message.length,
    });
  } catch (error) {
    const inboundForFallback = msg.text || msg.caption || '';
    let reply = UNEXPECTED_ERROR;
    let errorCode = 'ENGINE_FAILURE';

    if (error?.code && typeof error.code === 'string' && /IMAGE_|UNSUPPORTED_MESSAGE/.test(error.code)) {
      errorCode = error.code;
      reply = normalizeErrorReply(error.code);
    } else if (isBackendUnreachable(error)) {
      console.error('[Telegram] Backend unreachable:', error.message);
      errorCode = 'BACKEND_UNAVAILABLE';
      reply = BACKEND_UNAVAILABLE;
    } else if (axios.isAxiosError(error) && error.response?.data) {
      const data = error.response.data;
      reply =
        typeof data.reply === 'string'
          ? data.reply
          : typeof data.error === 'string'
            ? data.error
            : UNEXPECTED_ERROR;
      errorCode = data.errorCode ?? 'ENGINE_FAILURE';
    } else {
      const msgText = error?.message ?? String(error);
      const safeLog = String(msgText)
        .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[REDACTED]')
        .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-[REDACTED]');
      console.error('[Telegram] Unexpected error:', safeLog);

      if (/OPENAI_API_KEY not set/i.test(msgText)) {
        errorCode = 'MODEL_UNAVAILABLE';
        reply = normalizeErrorReply('MODEL_UNAVAILABLE');
      } else if (/timeout|aborted|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(msgText)) {
        errorCode = 'TIMEOUT';
        reply = buildUserVisibleFallback(inboundForFallback).reply;
      } else if (/rate limit|429/i.test(msgText)) {
        errorCode = 'RATE_LIMIT';
        reply = normalizeErrorReply('RATE_LIMIT');
      } else if (/Unsupported message|unsupported/i.test(msgText)) {
        errorCode = 'UNSUPPORTED_MESSAGE';
        reply = normalizeErrorReply('UNSUPPORTED_MESSAGE');
      } else {
        reply = buildUserVisibleFallback(inboundForFallback).reply;
      }
    }

    await sendReplySafe(msg, reply, {
      ...traceBase,
      intent: detectHealthSafetyIntent(inboundForFallback).intent,
      resultStatus: 'user_visible_error',
      errorCode,
      retryCount: error?.retryCount ?? 0,
    });
  }
}

async function handleMessage(msg) {
  if (shouldIgnoreTelegramMessage(msg)) return;
  if (!processedUpdates.shouldProcess(msg)) return;
  logFirstTelegramFromId(msg);
  pollingSupervisor.touch('message');

  const key = flightKey(msg);
  await flightQueue.enqueue(
    key,
    () => processOneMessage(msg),
    {
      onQueued: async () => {
        try {
          await bot.sendMessage(msg.chat.id, getTelegramInFlightNotice(), {
            ...(msg.message_thread_id != null
              ? { message_thread_id: msg.message_thread_id }
              : {}),
          });
        } catch (err) {
          console.warn('[Telegram] queue notice failed:', err?.message ?? err);
        }
      },
    },
  );
}

bot.on('polling_error', (error) => {
  const message = error?.message ?? String(error);
  console.error('[Telegram] polling_error:', message);
  const decision = pollingSupervisor.notePollingError(error);
  if (decision.action === 'conflict') {
    console.error('[Telegram] Exiting due to polling conflict.');
    releasePollLock();
    process.exit(1);
  }
});

bot.on('message', (msg) => {
  handleMessage(msg).catch(async (error) => {
    console.error('[Telegram] Unhandled message error:', error.message ?? error);
    try {
      const fallback = buildUserVisibleFallback(msg?.text || msg?.caption || '');
      await bot.sendMessage(msg.chat.id, fallback.reply);
      logTelegramMessageTrace({
        updateId: msg?.message_id,
        chatId: msg?.chat?.id,
        messageLength: (msg?.text || msg?.caption || '').length,
        receivedAt: new Date().toISOString(),
        resultStatus: 'user_visible_error',
        errorCode: 'UNHANDLED',
        sendResult: 'ok',
      });
    } catch (sendErr) {
      console.error('[Telegram] Fallback send also failed:', sendErr?.message ?? sendErr);
    }
  });
});

function shutdown(signal) {
  console.log(`[Telegram] ${signal} received — shutting down.`);
  pollingSupervisor.stop();
  releasePollLock();
  try {
    bot.stopPolling();
  } catch {
    /* ignore */
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('[Telegram] Bot started — multimodal Atlas via POST /api/atlas/message');
console.log(`[Telegram] Backend: ${BACKEND_URL}`);
console.log(
  `[Telegram] Founder env: ATLAS_FOUNDER_TELEGRAM_IDS=${process.env.ATLAS_FOUNDER_TELEGRAM_IDS ? '(set)' : '(not set)'}`,
);
console.log(
  `[Telegram] Founder setup hint is identity-debug gated (ATLAS_IDENTITY_DEBUG); raw from.id is never printed.`,
);

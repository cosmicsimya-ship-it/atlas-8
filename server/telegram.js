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
} from './channel-adapters.js';
import {
  resolveFounderSession,
  buildFounderPipelineDebug,
  logFounderPipelineDebug,
} from './founder-identity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
const BACKEND_MESSAGE_URL = `${BACKEND_URL}/api/atlas/message`;
const POLL_LOCK_FILE = join(__dirname, '..', 'data', 'telegram.poll.lock');
const ENABLE_POLLING = process.env.TELEGRAM_ENABLE_POLLING !== 'false';

const BACKEND_UNAVAILABLE = normalizeErrorReply('BACKEND_UNAVAILABLE');
const UNEXPECTED_ERROR = normalizeErrorReply('ENGINE_FAILURE');

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

/** @type {TelegramBot | null} */
let bot = null;
/** @type {{ id: number, username?: string } | null} */
let botIdentity = null;

try {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
} catch (err) {
  console.error('[Telegram] Failed to start polling:', err.message);
  releasePollLock();
  process.exit(1);
}

bot
  .getMe()
  .then((me) => {
    botIdentity = { id: me.id, username: me.username };
    console.log(`[Telegram] Bot identity: @${me.username ?? 'unknown'} (id=${me.id})`);
    console.log(
      '[Telegram] Group mode: responds to all messages this bot receives. ' +
        'If groups stay silent, disable Privacy Mode in BotFather (/setprivacy → Disable) ' +
        'or @mention / reply to the bot.',
    );
  })
  .catch((err) => {
    console.warn('[Telegram] getMe failed:', err.message);
  });

/** @type {Map<string, Array<{ role: 'user' | 'assistant', content: string }>>} */
const chatHistories = new Map();
const MAX_HISTORY_TURNS = 20;
/** @type {Set<string>} */
const inFlightChats = new Set();
let firstFromIdLogged = false;

function normalizeOptions() {
  return {
    id: botIdentity?.id,
    username: botIdentity?.username,
  };
}

function flightKey(msg) {
  const chatId = msg.chat?.id;
  const fromId = msg.from?.id;
  if (msg.chat?.type === 'group' || msg.chat?.type === 'supergroup') {
    return `${chatId}:${fromId ?? 'unknown'}`;
  }
  return String(chatId);
}

/**
 * Print Telegram from.id once — for ATLAS_FOUNDER_TELEGRAM_IDS in .env
 * @param {import('node-telegram-bot-api').Message} msg
 */
function logFirstTelegramFromId(msg) {
  if (firstFromIdLogged || !msg.from?.id) {
    return;
  }
  firstFromIdLogged = true;

  const fromId = String(msg.from.id);
  const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || '—';
  const username = msg.from.username ? `@${msg.from.username}` : '—';

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('[Telegram] İlk mesaj — kurucu ID (from.id)');
  console.log(`  from.id:  ${fromId}`);
  console.log(`  userId:   telegram:${fromId}`);
  console.log(`  isim:     ${name}`);
  console.log(`  username: ${username}`);
  console.log('');
  console.log('  .env dosyanıza ekleyin:');
  console.log(`  ATLAS_FOUNDER_TELEGRAM_IDS=${fromId}`);
  console.log('══════════════════════════════════════════════════════════');
  console.log('');
}

function getChatHistory(conversationId) {
  return chatHistories.get(conversationId) ?? [];
}

function appendChatTurn(conversationId, role, content) {
  const history = [...getChatHistory(conversationId), { role, content }];
  chatHistories.set(conversationId, history.slice(-MAX_HISTORY_TURNS));
}

async function forwardToPipeline(msg) {
  const conversationId = String(msg.chat.id);
  const history = getChatHistory(conversationId);
  const normalized = normalizeTelegramMessage(msg, history, normalizeOptions());
  const fromId = String(msg.from.id);

  const founderSession = resolveFounderSession(normalized.userId);
  const preDebug = buildFounderPipelineDebug(
    {
      channel: 'telegram',
      userId: normalized.userId,
      conversationId: normalized.conversationId,
      message: normalized.message,
      history: normalized.history,
      metadata: { telegramFromId: fromId },
    },
    founderSession,
  );
  logFounderPipelineDebug(preDebug, 'Telegram/inbound');
  if (!founderSession) {
    const configured = process.env.ATLAS_FOUNDER_TELEGRAM_IDS ?? '(not set)';
    console.warn(
      `[Telegram] Founder not matched — from.id=${fromId} is not in ATLAS_FOUNDER_TELEGRAM_IDS=${configured}. ` +
        `memoryLoaded reflects user_memory only (not founder knowledge).`,
    );
  }

  const response = await axios.post(
    BACKEND_MESSAGE_URL,
    {
      channel: 'telegram',
      userId: normalized.userId,
      conversationId: normalized.conversationId,
      message: normalized.message,
      history: normalized.history,
      username: normalized.username,
      displayName: normalized.displayName,
      metadata: {
        ...(normalized.metadata ?? {}),
        telegramFromId: fromId,
      },
    },
    {
      timeout: 180_000,
      headers: {
        'X-Atlas-Bot-Secret': process.env.ATLAS_INTERNAL_BOT_SECRET || '',
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

  return response.data;
}

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
  for (const chunk of chunks) {
    await bot.sendMessage(chatId, chunk, options);
  }
}

async function handleMessage(msg) {
  logFirstTelegramFromId(msg);

  const chatId = msg.chat.id;
  const conversationId = String(chatId);
  const key = flightKey(msg);

  if (inFlightChats.has(key)) {
    return;
  }

  if (msg.text?.trim() === '/start') {
    await bot.sendMessage(
      chatId,
      'Merhaba. Sorularını yazabilirsin.',
    );
    return;
  }

  let text;
  try {
    text = normalizeTelegramMessage(msg, getChatHistory(conversationId), normalizeOptions()).message;
  } catch (err) {
    if (err.message === 'GROUP_MESSAGE_IGNORED') {
      console.log(
        `[Telegram] Group message ignored (mention/reply required): chat=${chatId} from=${msg.from?.id}`,
      );
      return;
    }
    if (err.message?.includes('Unsupported message')) {
      console.warn(`[Telegram] Unsupported inbound message: ${err.message}`);
      await bot.sendMessage(chatId, normalizeErrorReply('UNSUPPORTED_MESSAGE'));
    }
    return;
  }

  inFlightChats.add(key);

  try {
    await bot.sendChatAction(chatId, 'typing');

    const result = await forwardToPipeline(msg);
    const reply = result.reply ?? UNEXPECTED_ERROR;

    appendChatTurn(conversationId, 'user', text);
    appendChatTurn(conversationId, 'assistant', reply);
    await sendReply(msg, reply);
  } catch (error) {
    if (isBackendUnreachable(error)) {
      console.error('[Telegram] Backend unreachable:', error.message);
      await bot.sendMessage(chatId, BACKEND_UNAVAILABLE);
      return;
    }

    if (axios.isAxiosError(error) && error.response?.data) {
      const data = error.response.data;
      const reply =
        typeof data.reply === 'string'
          ? data.reply
          : typeof data.error === 'string'
            ? data.error
            : UNEXPECTED_ERROR;
      await bot.sendMessage(chatId, reply);
      return;
    }

    if (axios.isAxiosError(error) && error.response?.status === 409) {
      console.error('[Telegram] Polling conflict (409). Another bot instance may be active.');
      releasePollLock();
      process.exit(1);
    }

    console.error('[Telegram] Unexpected error:', error.message ?? error);
    await bot.sendMessage(chatId, UNEXPECTED_ERROR);
  } finally {
    inFlightChats.delete(key);
  }
}

bot.on('polling_error', (error) => {
  const message = error?.message ?? String(error);
  console.error('[Telegram] polling_error:', message);
  if (message.includes('409') || message.toLowerCase().includes('conflict')) {
    console.error('[Telegram] Exiting due to polling conflict.');
    releasePollLock();
    process.exit(1);
  }
});

bot.on('message', (msg) => {
  handleMessage(msg).catch((error) => {
    console.error('[Telegram] Unhandled message error:', error.message ?? error);
  });
});

function shutdown(signal) {
  console.log(`[Telegram] ${signal} received — shutting down.`);
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

console.log('[Telegram] Bot started — shared Atlas pipeline via POST /api/atlas/message');
console.log(`[Telegram] Backend: ${BACKEND_URL}`);
console.log(
  `[Telegram] Founder env: ATLAS_FOUNDER_TELEGRAM_IDS=${process.env.ATLAS_FOUNDER_TELEGRAM_IDS ?? '(not set)'}`,
);
console.log(
  `[Telegram] İlk mesaj geldiğinde from.id burada yazdırılır → ATLAS_FOUNDER_TELEGRAM_IDS`,
);

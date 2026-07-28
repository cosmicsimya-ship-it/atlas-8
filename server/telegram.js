import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  formatTelegramReply,
  normalizeTelegramMessage,
  normalizeErrorReply,
  splitTelegramMessage,
} from './channel-adapters.js';

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

function acquirePollLock() {
  if (existsSync(POLL_LOCK_FILE)) {
    console.error('[Telegram] Another polling instance may be running (lock file exists).');
    console.error('[Telegram] Remove data/telegram.poll.lock if no other bot is running.');
    return false;
  }
  writeFileSync(POLL_LOCK_FILE, String(process.pid), 'utf-8');
  return true;
}

function releasePollLock() {
  try {
    if (existsSync(POLL_LOCK_FILE)) unlinkSync(POLL_LOCK_FILE);
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

try {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
} catch (err) {
  console.error('[Telegram] Failed to start polling:', err.message);
  releasePollLock();
  process.exit(1);
}

/** @type {Map<string, Array<{ role: 'user' | 'assistant', content: string }>>} */
const chatHistories = new Map();
const MAX_HISTORY_TURNS = 20;
/** @type {Set<number>} */
const inFlightChats = new Set();

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
  const normalized = normalizeTelegramMessage(msg, history);

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
      metadata: normalized.metadata,
    },
    { timeout: 180_000 },
  );

  return response.data;
}

async function sendReply(chatId, reply) {
  const chunks = splitTelegramMessage(formatTelegramReply(reply));
  for (const chunk of chunks) {
    await bot.sendMessage(chatId, chunk);
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const conversationId = String(chatId);

  if (inFlightChats.has(chatId)) {
    return;
  }

  if (msg.text?.trim() === '/start') {
    await bot.sendMessage(
      chatId,
      'Merhaba. Ben Atlas — Cosmicsimya.com! zekâ katmanı. Sorularını yazabilir, tarot açılımı isteyebilir veya hafıza komutları kullanabilirsin.',
    );
    return;
  }

  let text;
  try {
    text = normalizeTelegramMessage(msg, getChatHistory(conversationId)).message;
  } catch (err) {
    if (err.message === 'GROUP_MESSAGE_IGNORED') return;
    if (err.message?.includes('Unsupported message')) {
      await bot.sendMessage(chatId, normalizeErrorReply('UNSUPPORTED_MESSAGE'));
    }
    return;
  }

  inFlightChats.add(chatId);

  try {
    await bot.sendChatAction(chatId, 'typing');

    const result = await forwardToPipeline(msg);
    const reply = result.reply ?? UNEXPECTED_ERROR;

    appendChatTurn(conversationId, 'user', text);
    appendChatTurn(conversationId, 'assistant', reply);
    await sendReply(chatId, reply);
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
    inFlightChats.delete(chatId);
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

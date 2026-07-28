import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import { extractResponseText } from './atlas-response.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_CHAT_URL = 'http://localhost:3001/api/chat';
const BACKEND_UNAVAILABLE = 'ATLAS backend is currently unavailable.';
const UNEXPECTED_ERROR = 'An unexpected error occurred.';

function isBackendUnreachable(error) {
  return axios.isAxiosError(error) && !error.response;
}

if (!TELEGRAM_BOT_TOKEN) {
  console.error('[Telegram] TELEGRAM_BOT_TOKEN is not set in the environment.');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

async function forwardToBackend(msg) {
  const response = await axios.post(BACKEND_CHAT_URL, {
    message: msg.text,
  });

  console.log(JSON.stringify(response.data, null, 2));
  return extractResponseText(response.data);
}

async function handleMessage(msg) {
  const text = msg.text?.trim();
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

  if (isGroup) {
    const calledAtlas = text.toLowerCase().includes('atlas');
    const repliedToBot = msg.reply_to_message?.from?.is_bot === true;

    if (!calledAtlas && !repliedToBot) {
      return;
    }
  }

  if (!text) {
    return;
  }

  const chatId = msg.chat.id;

  try {
    const reply = await forwardToBackend(msg);
    await bot.sendMessage(chatId, reply);
  } catch (error) {
    if (isBackendUnreachable(error)) {
      console.error('[Telegram] Backend unreachable:', error.message);
      await bot.sendMessage(chatId, BACKEND_UNAVAILABLE);
      return;
    }

    if (axios.isAxiosError(error) && error.response?.data) {
      console.log(JSON.stringify(error.response.data, null, 2));
      const reply = extractResponseText(error.response.data);
      await bot.sendMessage(chatId, reply);
      return;
    }

    console.error('[Telegram] Unexpected error:', error);
    await bot.sendMessage(chatId, UNEXPECTED_ERROR);
  }
}

bot.on('message', (msg) => {
  handleMessage(msg).catch((error) => {
    console.error('[Telegram] Unhandled message error:', error);
  });
});

console.log('[Telegram] Bot started with polling enabled (Meta Synthesis via /api/chat).');

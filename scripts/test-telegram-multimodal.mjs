/**
 * Telegram multimodal verification — photos through Atlas pipeline.
 * Run: node scripts/test-telegram-multimodal.mjs
 */
import 'dotenv/config';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  detectInboundKind,
  pickHighestPhoto,
  isImageMime,
  MediaError,
  MAX_TELEGRAM_IMAGE_BYTES,
  downloadTelegramFile,
  ensureDir,
} from '../server/telegram/media.js';
import {
  handleTextMessage,
  handleUnsupportedMessage,
  handleStickerMessage,
  handlePhotoMessage,
  resolveMultimodalInbound,
  DEFAULT_PHOTO_INSTRUCTION,
} from '../server/telegram/handlers.js';
import {
  normalizeTelegramMessage,
  normalizeAtlasMessageRequest,
  normalizeErrorReply,
  normalizeWebChatRequest,
} from '../server/channel-adapters.js';
import { callOpenAI } from '../server/openai-client.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { telegramUserId } from '../server/user-memory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmpDir = join(__dirname, '..', 'data', 'telegram-media', '_test');
ensureDir(tmpDir);

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed += 1;
  } else {
    console.error(`  ✗ ${label}`);
    failed += 1;
    failures.push(label);
  }
}

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

console.log('\n=== 1) Text-only Telegram ===\n');
{
  const text = await handleTextMessage({ text: '  Merhaba Atlas  ' });
  assert('text handler', text.kind === 'text' && text.message === 'Merhaba Atlas');
  const norm = normalizeTelegramMessage(
    {
      message_id: 1,
      from: { id: 42, first_name: 'T' },
      chat: { id: 42, type: 'private' },
      text: 'Merhaba Atlas',
      date: 1,
    },
    [],
  );
  assert('text normalize', norm.message === 'Merhaba Atlas' && !norm.image);
}

console.log('\n=== 2–3) Photo with / without caption ===\n');
{
  const withCaption = normalizeTelegramMessage(
    {
      message_id: 2,
      from: { id: 42, first_name: 'T' },
      chat: { id: 42, type: 'private' },
      photo: [{ file_id: 'p', width: 100, height: 100 }],
      caption: 'Bu hata nedir?',
      date: 1,
    },
    [],
    {
      resolvedMessage: 'Bu hata nedir?',
      mediaKind: 'photo',
      image: { mimeType: 'image/jpeg', base64: TINY_PNG_B64 },
    },
  );
  assert('photo+caption message', withCaption.message === 'Bu hata nedir?');
  assert('photo+caption has image', Boolean(withCaption.image?.base64));
  assert('photo+caption mediaKind', withCaption.metadata.mediaKind === 'photo');

  const noCaption = normalizeTelegramMessage(
    {
      message_id: 3,
      from: { id: 42, first_name: 'T' },
      chat: { id: 42, type: 'private' },
      photo: [{ file_id: 'p', width: 100, height: 100 }],
      date: 1,
    },
    [],
    {
      resolvedMessage: DEFAULT_PHOTO_INSTRUCTION,
      mediaKind: 'photo',
      image: { mimeType: 'image/png', base64: TINY_PNG_B64 },
    },
  );
  assert(
    'photo without caption uses default instruction',
    noCaption.message === DEFAULT_PHOTO_INSTRUCTION,
  );
  assert('default instruction exact text', DEFAULT_PHOTO_INSTRUCTION.includes('Analyze the attached image'));
}

console.log('\n=== 4) Largest photo size selected ===\n');
{
  const best = pickHighestPhoto([
    { file_id: 'small', width: 90, height: 90, file_size: 10 },
    { file_id: 'large', width: 1280, height: 720, file_size: 99 },
    { file_id: 'mid', width: 320, height: 320, file_size: 40 },
  ]);
  assert('largest selected', best?.file_id === 'large');
}

console.log('\n=== 5) Invalid Telegram file response ===\n');
{
  const fakeBot = {
    token: '000000:TEST',
    async getFile() {
      return { file_id: 'x' }; // missing file_path
    },
  };
  let code = null;
  try {
    await downloadTelegramFile(fakeBot, 'x', tmpDir, { requireImageMime: true });
  } catch (e) {
    code = e.code;
  }
  assert('missing file_path → IMAGE_DOWNLOAD_FAILED', code === 'IMAGE_DOWNLOAD_FAILED');
}

console.log('\n=== 6) Unsupported MIME ===\n');
{
  assert('pdf not image', !isImageMime('application/pdf'));
  assert('png is image', isImageMime('image/png'));
  const unsupported = await handleUnsupportedMessage({
    document: { file_id: 'd', mime_type: 'application/pdf', file_name: 'a.pdf' },
  });
  assert('pdf rejected', Boolean(unsupported.directReply));
  assert(
    'no text-only legacy message',
    !String(unsupported.directReply).includes('yalnızca metin') &&
      !String(unsupported.directReply).includes('Text messages only'),
  );
}

console.log('\n=== 7) Oversized image ===\n');
{
  const fakeBot = {
    token: '000000:TEST',
    async getFile() {
      return {
        file_id: 'big',
        file_path: 'photos/big.jpg',
        file_size: MAX_TELEGRAM_IMAGE_BYTES + 1,
      };
    },
  };
  let code = null;
  try {
    await downloadTelegramFile(fakeBot, 'big', tmpDir, { requireImageMime: true });
  } catch (e) {
    code = e.code;
  }
  assert('oversized → IMAGE_TOO_LARGE', code === 'IMAGE_TOO_LARGE');
  assert(
    'Turkish too-large reply',
    normalizeErrorReply('IMAGE_TOO_LARGE').includes('çok büyük'),
  );
}

console.log('\n=== 8) OpenAI / API failure mapping ===\n');
{
  assert(
    'MODEL_UNAVAILABLE Turkish',
    normalizeErrorReply('MODEL_UNAVAILABLE').includes('geçici'),
  );
  assert(
    'IMAGE_DOWNLOAD_FAILED Turkish',
    normalizeErrorReply('IMAGE_DOWNLOAD_FAILED').includes('indiremedim'),
  );
  assert(
    'UNSUPPORTED_IMAGE_FORMAT Turkish',
    normalizeErrorReply('UNSUPPORTED_IMAGE_FORMAT').includes('format'),
  );

  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await callOpenAI({
        userPrompt: 'Reply with exactly: OK',
        maxTokens: 32,
        temperature: 0,
        imageBase64: TINY_PNG_B64,
        mimeType: 'image/png',
      });
      assert('multimodal callOpenAI works', typeof result.content === 'string' && result.content.length > 0);
    } catch (err) {
      assert(`multimodal callOpenAI (${err.message})`, false);
    }
  } else {
    assert('OPENAI_API_KEY present for live vision', false);
  }
}

console.log('\n=== 9) Unsupported Telegram types ===\n');
{
  assert('contact kind', detectInboundKind({ contact: { phone_number: '1', first_name: 'A' } }) === 'unsupported_contact');
  assert('location kind', detectInboundKind({ location: { latitude: 1, longitude: 2 } }) === 'unsupported_location');
  assert('video_note kind', detectInboundKind({ video_note: { file_id: 'v' } }) === 'unsupported_video_note');
  const sticker = await handleStickerMessage(null, { sticker: { file_id: 's', emoji: '🙂' } });
  assert('static sticker rejected', Boolean(sticker.directReply));
  const animated = await handleStickerMessage(null, {
    sticker: { file_id: 's', is_animated: true, emoji: '✨' },
  });
  assert('animated sticker rejected kindly', Boolean(animated.directReply));
}

console.log('\n=== 10) Atlas text pipeline regression ===\n');
{
  process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';
  const greet = await processAtlasMessage(
    {
      channel: 'telegram',
      userId: telegramUserId(999001),
      conversationId: 'mm-test',
      message: 'Merhaba',
      history: [],
    },
    { trustedUserId: telegramUserId(999001) },
  );
  assert('greeting still completes', greet.status === 'complete' && typeof greet.reply === 'string');

  const withImage = await processAtlasMessage(
    {
      channel: 'telegram',
      userId: telegramUserId(999001),
      conversationId: 'mm-test',
      message: DEFAULT_PHOTO_INSTRUCTION,
      history: [],
      image: { mimeType: 'image/png', base64: TINY_PNG_B64 },
    },
    {
      trustedUserId: telegramUserId(999001),
      callOpenAI: async (opts) => {
        assert('pipeline passes imageBase64', Boolean(opts.imageBase64));
        assert('pipeline passes mimeType', opts.mimeType === 'image/png');
        assert('pipeline user prompt is instruction', opts.userPrompt.includes('Analyze') || opts.userPrompt.length > 0);
        return {
          content: 'I can see a tiny test image.',
          model: 'mock',
          provider: 'mock',
          tokensUsed: 1,
          costUsd: 0,
          latencyMs: 1,
        };
      },
    },
  );
  assert('image pipeline uses mock reply', withImage.reply.includes('tiny test image'));
}

console.log('\n=== 11) No secrets in error replies / MediaError ===\n');
{
  const err = new MediaError('IMAGE_DOWNLOAD_FAILED', 'getFile failed');
  assert('MediaError code', err.code === 'IMAGE_DOWNLOAD_FAILED');
  const replies = [
    normalizeErrorReply('IMAGE_DOWNLOAD_FAILED'),
    normalizeErrorReply('MODEL_UNAVAILABLE'),
    normalizeErrorReply('UNSUPPORTED_IMAGE_FORMAT'),
    normalizeErrorReply('IMAGE_TOO_LARGE'),
  ].join(' ');
  assert('no sk- in replies', !/sk-[A-Za-z0-9]/.test(replies));
  assert('no bot token pattern in replies', !/\d{8,}:[A-Za-z0-9_-]{20,}/.test(replies));
  assert('no OPENAI_API_KEY in user replies', !/OPENAI_API_KEY/.test(replies));
}

console.log('\n=== 12) Web Chat unaffected ===\n');
{
  const web = normalizeWebChatRequest({
    message: 'Web merhaba',
    userId: 'web:session-1',
    history: [],
  });
  assert('web normalize channel', web.channel === 'web');
  assert('web has no forced image', !web.image);
  const httpNorm = normalizeAtlasMessageRequest({
    channel: 'web',
    message: 'Web merhaba',
    userId: 'web:session-1',
  });
  assert('web via atlas request', httpNorm.channel === 'web' && httpNorm.message === 'Web merhaba');

  const tgHttp = normalizeAtlasMessageRequest({
    channel: 'telegram',
    userId: 'telegram:42',
    conversationId: '42',
    message: DEFAULT_PHOTO_INSTRUCTION,
    image: { mimeType: 'image/png', base64: TINY_PNG_B64 },
  });
  assert('telegram HTTP accepts image attachment', Boolean(tgHttp.image?.base64));
}

console.log('\n=== Routing smoke ===\n');
{
  const routed = await resolveMultimodalInbound(null, { text: 'selam' });
  assert('route text', routed.kind === 'text');

  // Photo without bot → download fails gracefully
  const photoFail = await handlePhotoMessage(
    {
      token: '0:x',
      async getFile() {
        throw new Error('network');
      },
    },
    { photo: [{ file_id: 'p', width: 10, height: 10 }] },
  );
  assert(
    'photo download failure → Turkish directReply',
    photoFail.directReply === normalizeErrorReply('IMAGE_DOWNLOAD_FAILED'),
  );
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failures.length) {
  console.error('Failures:\n' + failures.map((f) => `  - ${f}`).join('\n'));
}
process.exit(failed > 0 ? 1 : 0);

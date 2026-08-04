/**
 * Hüseyin Audio Studio Telegram smoke (deterministic pipeline).
 * Run: node scripts/smoke-audio-studio-huseyin.mjs
 */
process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';
process.env.ATLAS_AUDIO_PROCESSING_ENABLED = 'false';

import { processAtlasMessage } from '../server/atlas-message-service.js';
import { containsFalseCapabilityPromise } from '../server/audio-studio/index.js';

const userId = 'telegram:huseyin-audio-smoke';
const conversationId = 'group-audio-smoke';

const history = [
  { role: 'user', content: 'Sor Atlas.' },
  {
    role: 'assistant',
    content: 'Hüseyin, eklenmesini istediğin özellik hakkında biraz daha bilgi verebilir misin?',
  },
];

const out = await processAtlasMessage({
  channel: 'telegram',
  userId,
  conversationId,
  message:
    'Ben kendi çapımda bağlama çalıyorum, arada beste de yapıyorum. Besteyi sana yollayacağım, sen de profesyonel bir stüdyoda yapılmış gibi düzenleyeceksin.',
  history,
  displayName: 'Hüseyin',
  metadata: {
    isGroup: false,
    telegramFromId: 'huseyin-audio-smoke',
    senderDisplayName: 'Hüseyin',
    chatId: conversationId,
  },
});

console.log('engine:', out.engine);
console.log('intent:', out.intent);
console.log('--- reply ---');
console.log(out.reply);
console.log('--- end ---');

const ok =
  out.engine === 'audio-studio' &&
  Boolean(out.reply) &&
  !containsFalseCapabilityPromise(out.reply) &&
  /bağlama|stüdyo|mix|mastering/i.test(out.reply) &&
  /motor bağlı değil|aktif değil|sağlayıcı|entegrasyon/i.test(out.reply);

if (!ok) {
  console.error('SMOKE FAILED');
  process.exit(1);
}
console.log('SMOKE OK');

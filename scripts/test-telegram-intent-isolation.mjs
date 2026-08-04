/**
 * Telegram intent isolation / audio leakage regression tests.
 * Run: node scripts/test-telegram-intent-isolation.mjs
 */
import assert from 'assert';
import {
  deriveTelegramTurnIntent,
  filterHistoryForSenderScope,
  isInformationalAnnouncement,
  telegramHistoryScopeKey,
} from '../server/telegram-turn-intent.js';
import { detectAudioIntent } from '../server/audio-studio/audio-intent.js';
import { shouldConsiderAudioStudio, tryAudioStudioFlowReply } from '../server/audio-studio-flow.js';
import {
  contextKey,
  setPendingAudioInstruction,
  getPendingAudioContext,
  clearPendingAudioContext,
  _resetAudioContextStore,
} from '../server/audio-studio/audio-context.js';

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const announcement =
  'Selam arkadaşlar… Atlas artık web üzerinden kullanılabiliyor… https://cosmicsimya.com deneyebilir ve geri bildirimlerinizi paylaşabilirsiniz…';

const studioHistory = [
  { role: 'user', content: 'Bağlama kaydımı stüdyo kalitesinde mix master yap', userId: 'telegram:111' },
  {
    role: 'assistant',
    content: 'Ses dosyasını WAV/MP3 olarak gönder; stem ayrımı ve mastering için bekliyorum.',
    userId: 'telegram:111',
  },
];

console.log('=== Announcement vs prior audio history ===\n');

ok('announcement detected', isInformationalAnnouncement(announcement));
ok(
  'scope keys include topic',
  telegramHistoryScopeKey({ chatId: '-1001', messageThreadId: 42 }) === '-1001:topic:42',
);

{
  const intent = detectAudioIntent(announcement, studioHistory, {
    allowContextualFollowup: true,
  });
  ok('detectAudioIntent ignores announcement despite history', intent.active === false);
}

{
  const turn = deriveTelegramTurnIntent({
    message: announcement,
    userId: 'telegram:999',
    chatId: '-1001',
    priorIntent: 'create_studio_version',
    activePendingAction: 'audio_instruction',
    history: studioHistory,
  });
  ok('turn allowAudioStudio false for announcement', turn.allowAudioStudio === false);
  ok('turn intent announcement', turn.currentIntent === 'announcement');
}

ok(
  'shouldConsiderAudioStudio false for announcement + shared history',
  shouldConsiderAudioStudio(announcement, studioHistory, {
    userId: 'telegram:999',
    chatId: '-1001',
    channel: 'telegram',
    turnIntent: deriveTelegramTurnIntent({
      message: announcement,
      userId: 'telegram:999',
      chatId: '-1001',
      history: studioHistory,
    }),
  }) === false,
);

console.log('\n=== Valid continuation + attachment ===\n');

{
  _resetAudioContextStore();
  const key = contextKey({
    channel: 'telegram',
    userId: 'telegram:111',
    chatId: '-1001',
  });
  setPendingAudioInstruction(key, {
    intent: 'create_studio_version',
    message: 'mix master yap',
  });
  const turn = deriveTelegramTurnIntent({
    message: 'dosyayı şimdi gönderiyorum',
    userId: 'telegram:111',
    chatId: '-1001',
    activePendingAction: 'audio_instruction',
    priorIntent: 'create_studio_version',
  });
  ok('explicit continuation', turn.isContinuation === true && turn.allowAudioStudio === true);
  ok('pending still present', getPendingAudioContext(key)?.kind === 'instruction');
  clearPendingAudioContext(key);
}

{
  const turn = deriveTelegramTurnIntent({
    message: '',
    userId: 'telegram:111',
    chatId: '-1001',
    hasAttachment: true,
    attachmentType: 'audio',
    activePendingAction: 'audio_instruction',
  });
  ok('audio attachment with pending allowed', turn.allowAudioStudio === true);
}

console.log('\n=== Cross chat / topic / sender isolation ===\n');

{
  const scoped = filterHistoryForSenderScope(
    [
      ...studioHistory,
      { role: 'user', content: announcement, userId: 'telegram:999', messageThreadId: 2 },
    ],
    { userId: 'telegram:999', messageThreadId: 2 },
  );
  ok(
    'sender filter drops other user studio turns',
    !scoped.some((t) => String(t.content).includes('Bağlama')),
  );
}

{
  const privateHistory = studioHistory.map((t) => ({ ...t, userId: 'telegram:111' }));
  const groupTurn = deriveTelegramTurnIntent({
    message: announcement,
    userId: 'telegram:111',
    chatId: '-100GROUP',
    history: privateHistory,
  });
  // Same sender but announcement in group — still must not allow audio studio
  ok('group announcement blocks audio even same sender', groupTurn.allowAudioStudio === false);
}

{
  const topicA = telegramHistoryScopeKey({ chatId: '-1001', messageThreadId: 1 });
  const topicB = telegramHistoryScopeKey({ chatId: '-1001', messageThreadId: 2 });
  ok('topics isolated', topicA !== topicB);
}

{
  const replyTurn = deriveTelegramTurnIntent({
    message: 'bunu yap',
    userId: 'telegram:111',
    chatId: '-1001',
    replyTargetMessageId: 55,
    repliedToText: 'Kaydı mix master eder misin?',
    activePendingAction: 'audio_instruction',
    priorIntent: 'create_studio_version',
  });
  ok('reply-target continuation valid', replyTurn.isContinuation && replyTurn.allowAudioStudio);
}

{
  const forwarded = deriveTelegramTurnIntent({
    message: 'Bakın bu duyuru',
    quotedText: 'stem ayrımı ve mastering için WAV gönder',
    userId: 'telegram:222',
    chatId: '-1001',
  });
  ok('quoted media words alone do not force audio', forwarded.allowAudioStudio === false);
}

{
  const aPending = contextKey({ channel: 'telegram', userId: 'telegram:A', chatId: '-1001' });
  const bKey = contextKey({ channel: 'telegram', userId: 'telegram:B', chatId: '-1001' });
  _resetAudioContextStore();
  setPendingAudioInstruction(aPending, { intent: 'create_studio_version', message: 'mix' });
  ok('sender B has no pending from A', !getPendingAudioContext(bKey));
  const bTurn = deriveTelegramTurnIntent({
    message: announcement,
    userId: 'telegram:B',
    chatId: '-1001',
    activePendingAction: null,
  });
  ok('sender B announcement not audio', bTurn.allowAudioStudio === false);
}

{
  const conflict = deriveTelegramTurnIntent({
    message: announcement,
    userId: 'telegram:111',
    chatId: '-1001',
    priorIntent: 'create_studio_version',
    activePendingAction: 'audio_instruction',
  });
  ok('current message wins over prior intent', conflict.currentIntent === 'announcement');
}

console.log('\n=== Flow integration ===\n');

{
  const flow = await tryAudioStudioFlowReply({
    message: announcement,
    history: studioHistory,
    userId: 'telegram:founder',
    channel: 'telegram',
    chatId: '-1001',
  });
  ok('tryAudioStudioFlowReply null on announcement', flow === null);
}

console.log(`\n${passed} passed`);

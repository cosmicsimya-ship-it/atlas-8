import assert from 'node:assert/strict';
import {
  buildContextualPipelineMessage,
  createGroupContextEntry,
  createProcessedUpdateTracker,
  inspectContextualWake,
  isWakeWordOnly,
  looksLikeActionableRequest,
  resolveContextualWake,
  shouldIgnoreTelegramMessage,
  telegramGroupScopeKey,
  trimGroupContext,
} from '../server/telegram-group-context.js';
import {
  isTelegramGroupMessageAddressedToBot,
  isTelegramReplyToBot,
  normalizeTelegramMessage,
} from '../server/channel-adapters.js';
import {
  detectPresenceCheck,
  hasActiveSession,
  resetActivationSessionsForTests,
  shouldForwardGroupMessage,
  touchActivationSession,
} from '../server/conversation-activation.js';

const now = Date.now();
const bot = { id: 99, username: 'atlas_bot' };
const group = { id: -100, type: 'supergroup', title: 'Test' };
const user1 = { id: 1, is_bot: false, first_name: 'Ayşe', username: 'ayse' };
const user2 = { id: 2, is_bot: false, first_name: 'Bora', username: 'bora' };
const msg = (overrides = {}) => ({ chat: group, from: user1, message_id: 1, date: Math.floor(now / 1000), text: '', ...overrides });

const requestEntry = createGroupContextEntry(msg({ message_id: 10, text: 'Rüya tabiri yapabilir misin?' }), 'Rüya tabiri yapabilir misin?', { nowMs: now - 1000 });
const resolved = resolveContextualWake([requestEntry], { text: 'Atlas', nowMs: now, botUsername: bot.username });
assert.equal(resolved?.text, 'Rüya tabiri yapabilir misin?', 'previous actionable dream request resolves');
assert.equal(resolved?.source.userId, 'user:1', 'source speaker key is retained');
assert.equal(
  inspectContextualWake([requestEntry], { text: 'Atlas', nowMs: now, botUsername: bot.username }).reason,
  'matched',
  'diagnostic inspection reports a contextual match without changing resolution',
);
assert.equal(
  inspectContextualWake([], { text: 'Atlas', nowMs: now, botUsername: bot.username }).reason,
  'scope_empty',
  'diagnostic inspection reports an empty scope',
);

const dreamNarrative = createGroupContextEntry(
  msg({ message_id: 9, text: 'Kızlar rüyamda deniz gördüm, sonra annem geldi...' }),
  'Kızlar rüyamda deniz gördüm, sonra annem geldi...',
  { nowMs: now - 1000 },
);
assert.equal(
  resolveContextualWake([dreamNarrative], { text: 'Atlas', nowMs: now, botUsername: bot.username })?.text,
  dreamNarrative.text,
  'natural dream narrative resolves on a following bare Atlas wake',
);

const ordinaryQuestion = createGroupContextEntry(
  msg({ message_id: 8, text: 'Yarın saat kaçta buluşuyoruz?' }),
  'Yarın saat kaçta buluşuyoruz?',
  { nowMs: now - 1000 },
);
assert.equal(
  resolveContextualWake([ordinaryQuestion], { text: 'Atlas', nowMs: now, botUsername: bot.username }),
  null,
  'ordinary group question is not replayed as an Atlas request',
);
assert.equal(
  inspectContextualWake([ordinaryQuestion], { text: 'Atlas', nowMs: now, botUsername: bot.username }).reason,
  'rejected_non_actionable',
  'diagnostic inspection explains an ordinary-question rejection',
);

for (const direct of ['Atlas rüyamı yorumlar mısın?', 'Atlascım rüyamı yorumlar mısın?', 'Atlasım rüyamı yorumlar mısın?']) {
  assert.equal(isTelegramGroupMessageAddressedToBot(msg({ text: direct }), direct, bot), true, `${direct} activates`);
}
assert.equal(isTelegramGroupMessageAddressedToBot(msg({ text: 'Galatasaray güzel oynadı' }), 'Galatasaray güzel oynadı', bot), false, 'unrelated word is not an Atlas address');
assert.equal(isTelegramGroupMessageAddressedToBot(msg({ text: '@atlas_bot yardım eder misin?' }), '@atlas_bot yardım eder misin?', bot), true, 'bot username mention activates');

const reply = msg({ text: 'Bunu biraz daha açıklar mısın?', reply_to_message: { message_id: 7, from: { id: 99, is_bot: true }, text: 'Önceki yanıt' } });
assert.equal(isTelegramReplyToBot(reply, bot), true, 'reply-to-bot activates');
assert.equal(isTelegramGroupMessageAddressedToBot(msg({ text: 'Bugün hava güzel.' }), 'Bugün hava güzel.', bot), false, 'unrelated group conversation stays silent');
assert.equal(resolveContextualWake([createGroupContextEntry(msg({ message_id: 11 }), 'Bugün hava güzel.', { nowMs: now - 1000 })], { text: 'Atlas', nowMs: now }), null, 'bare wake has no contextual request for ordinary text');
assert.equal(detectPresenceCheck('Atlas').reply, 'Buradayım.', 'bare wake keeps presence path');

assert.equal(resolveContextualWake([createGroupContextEntry(msg({ message_id: 12 }), 'Rüyamı yorumlar mısın?', { nowMs: now - 6 * 60 * 1000 })], { text: 'Atlas', nowMs: now }), null, 'five-minute TTL is enforced');
const thirteen = Array.from({ length: 13 }, (_, i) => createGroupContextEntry(msg({ message_id: i + 1 }), `mesaj ${i + 1}`, { nowMs: now - 1000 }));
const bounded = trimGroupContext(thirteen, now);
assert.equal(bounded.length, 12, 'only last 12 messages are retained');
assert.equal(bounded[0].messageId, 2, 'oldest overflow message is removed');

assert.notEqual(telegramGroupScopeKey(msg({ message_thread_id: 7 })), telegramGroupScopeKey(msg({ message_thread_id: 8 })), 'topics are isolated');
assert.notEqual(telegramGroupScopeKey(msg({ chat: { ...group, id: -101 } })), telegramGroupScopeKey(msg({ chat: { ...group, id: -102 } })), 'chats are isolated');

const ordinaryAfterRequest = createGroupContextEntry(msg({ message_id: 14 }), 'Toplantı saat üçte.', { nowMs: now - 500 });
assert.equal(resolveContextualWake([requestEntry, ordinaryAfterRequest], { text: 'Atlas', nowMs: now }), null, 'older actionable request is not selected across intervening chat');
assert.equal(resolveContextualWake([{ ...requestEntry, wasAddressed: true }], { text: 'Atlas', nowMs: now }), null, 'activated Atlascım request is not replayed');
assert.equal(resolveContextualWake([{ ...requestEntry, answered: true }], { text: 'Atlas', nowMs: now }), null, 'answered request is not replayed');
assert.equal(looksLikeActionableRequest('Ne zaman geleceksin?'), false, 'question mark alone is not actionable');
assert.equal(looksLikeActionableRequest('Rüyamı yorumlar mısın?'), true, 'explicit action request is actionable');

resetActivationSessionsForTests();
const topicA = telegramGroupScopeKey(msg({ message_thread_id: 7 }));
const topicB = telegramGroupScopeKey(msg({ message_thread_id: 8 }));
touchActivationSession({ conversationId: topicA, userId: 'telegram:1', reason: 'test-topic-a' });
assert.equal(hasActiveSession(topicA, 'telegram:1'), true, 'topic A session is active');
assert.equal(hasActiveSession(topicB, 'telegram:1'), false, 'topic A session does not leak into topic B');
assert.equal(shouldForwardGroupMessage({ message: 'Sıradan mesaj', conversationId: topicB, userId: 'telegram:1', isGroup: true, addressedToBot: false }), false, 'ordinary topic B message stays silent');
touchActivationSession({ conversationId: topicB, userId: 'telegram:1', reason: 'test-topic-b' });
assert.equal(hasActiveSession(topicA, 'telegram:1') && hasActiveSession(topicB, 'telegram:1'), true, 'topics keep independent sessions for the same user');

const tracker = createProcessedUpdateTracker(2000);
assert.equal(tracker.shouldProcess(msg({ message_id: 42 })), true, 'first update is processed');
assert.equal(tracker.shouldProcess(msg({ message_id: 42 })), false, 'duplicate chat/message update is suppressed');
assert.equal(tracker.shouldProcess(msg({ message_id: undefined })), true, 'missing message id is processed');
assert.equal(tracker.shouldProcess(msg({ message_id: undefined })), true, 'missing message ids do not suppress each other');

const wake = msg({ from: user2, message_id: 20, text: 'Atlas', reply_to_message: { from: { id: 99, is_bot: true }, text: 'Yanıt' } });
const contextualPipelineMsg = buildContextualPipelineMessage(wake, resolved);
assert.equal(contextualPipelineMsg.from.id, user1.id, 'contextual request keeps original speaker');
assert.equal(contextualPipelineMsg.reply_to_message.text, 'Yanıt', 'reply context is preserved');
const normalized = normalizeTelegramMessage(contextualPipelineMsg, [], { id: bot.id, username: bot.username, resolvedMessage: resolved.text });
assert.equal(normalized.userId, 'telegram:1', 'pipeline attribution uses original requester');
assert.equal(normalized.context.speakerAttribution.sender.telegramId, '1', 'speaker metadata uses original requester');

const privateMessage = msg({ chat: { id: 1, type: 'private' }, text: 'Merhaba' });
assert.equal(buildContextualPipelineMessage(privateMessage, null), privateMessage, 'private message is unchanged without contextual wake');
assert.equal(normalizeTelegramMessage(privateMessage, []).message, 'Merhaba', 'private normalization is unchanged');
assert.equal(shouldIgnoreTelegramMessage(msg({ from: { id: 99, is_bot: true } })), true, 'bot-authored message is ignored');
assert.equal(shouldIgnoreTelegramMessage(msg()), false, 'human message is retained');
assert.equal(isWakeWordOnly('@atlas_bot', bot.username), true, 'username-only wake is recognized');
const otherBotReply = msg({ text: 'devam', reply_to_message: { from: { id: 1234, is_bot: true, username: 'other_bot' }, text: 'başka bot' } });
assert.equal(isTelegramReplyToBot(otherBotReply, null), false, 'identity-not-ready reply activation fails closed');
assert.equal(isTelegramGroupMessageAddressedToBot(msg({ text: '@atlas_bot yardım' }), '@atlas_bot yardım', null), false, 'identity-not-ready username activation fails closed');

console.log('Telegram group context tests passed.');

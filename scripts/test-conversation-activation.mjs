/**
 * Conversation activation & session gate fixtures.
 * Run: node scripts/test-conversation-activation.mjs
 */
process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';
import { join } from 'path';
import { tmpdir } from 'os';
process.env.ATLAS_MEMORY_FILE = join(
  tmpdir(),
  `atlas-activation-test-${process.pid}.json`,
);

import {
  evaluateActivation,
  detectPresenceCheck,
  isBotCommand,
  isBotNameAddress,
  hasActiveSession,
  resetActivationSessionsForTests,
  touchActivationSession,
  closeActivationSession,
  shouldForwardGroupMessage,
  stripBotAddressPrefix,
  CONVERSATION_ACTIVATION_VERSION,
} from '../server/conversation-activation.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';

const results = [];
function assert(label, cond, detail = '') {
  results.push({ label, pass: Boolean(cond), detail });
  console.log(`${cond ? '✓' : '✗'} ${label}${cond ? '' : ` — ${detail || 'failed'}`}`);
}

console.log(`\n=== Conversation Activation ${CONVERSATION_ACTIVATION_VERSION} ===\n`);

resetActivationSessionsForTests();

assert('presence Atlas', detectPresenceCheck('Atlas').active);
assert('presence Orada mısın', detectPresenceCheck('Orada mısın?').reply === 'Buradayım.');
assert('presence Dinliyor musun', detectPresenceCheck('Dinliyor musun?').reply === 'Dinliyorum.');
assert('presence ?', detectPresenceCheck('?').reply === 'Evet.');
assert('command /tarot', isBotCommand('/tarot'));
assert('command /ebced@bot', isBotCommand('/ebced@AtlasBot'));
assert('name Atlas hello', isBotNameAddress('Atlas merhaba'));
assert('strip prefix', stripBotAddressPrefix('Atlas, burcum ne?') === 'burcum ne?');

{
  resetActivationSessionsForTests();
  const silent = evaluateActivation({
    message: 'Selam herkese, bugün hava güzel',
    conversationId: 'g1',
    userId: 'telegram:1',
    isGroup: true,
  });
  assert('group default silent', silent.noResponse && silent.decision === 'no_response', silent.reason);
}

{
  resetActivationSessionsForTests();
  const wake = evaluateActivation({
    message: 'Atlas',
    conversationId: 'g1',
    userId: 'telegram:1',
    isGroup: true,
  });
  assert('group Atlas presence', wake.decision === 'presence' && wake.presenceReply === 'Buradayım.');
  assert('session opened', hasActiveSession('g1', 'telegram:1'));

  const follow = evaluateActivation({
    message: 'Ne zaman?',
    conversationId: 'g1',
    userId: 'telegram:1',
    isGroup: true,
  });
  assert(
    'group follow-up continues',
    follow.decision === 'continue' && follow.skipResolvers && !follow.noResponse,
    follow.decision,
  );

  const other = evaluateActivation({
    message: 'Ne zaman?',
    conversationId: 'g1',
    userId: 'telegram:2',
    isGroup: true,
  });
  assert('other user still silent', other.noResponse, other.reason);
}

{
  resetActivationSessionsForTests();
  const reply = evaluateActivation({
    message: '3 kart çek',
    conversationId: 'g2',
    userId: 'telegram:1',
    isGroup: true,
    metadata: { replyToBot: true },
  });
  assert('reply-to-bot activates', reply.decision === 'activate' && reply.reason === 'reply_to_bot');
}

{
  resetActivationSessionsForTests();
  const cmd = evaluateActivation({
    message: '/tarot',
    conversationId: 'g3',
    userId: 'telegram:1',
    isGroup: true,
  });
  assert('command activates', cmd.decision === 'activate' && cmd.reason === 'command');
}

{
  resetActivationSessionsForTests();
  const dm = evaluateActivation({
    message: 'Merhaba',
    conversationId: 'dm1',
    userId: 'telegram:1',
    isGroup: false,
  });
  assert('dm first activates', dm.decision === 'activate' && dm.reason === 'dm_first_message');
  const dm2 = evaluateActivation({
    message: 'Neden?',
    conversationId: 'dm1',
    userId: 'telegram:1',
    isGroup: false,
  });
  assert('dm follow-up skip resolvers', dm2.decision === 'continue' && dm2.skipResolvers);
}

{
  resetActivationSessionsForTests();
  touchActivationSession({ conversationId: 'g4', userId: 'telegram:1', reason: 'test' });
  const end = evaluateActivation({
    message: 'Tamam teşekkürler',
    conversationId: 'g4',
    userId: 'telegram:1',
    isGroup: true,
  });
  assert('explicit end', end.decision === 'session_end' && !hasActiveSession('g4', 'telegram:1'));
}

assert(
  'edge forward false',
  shouldForwardGroupMessage({
    message: 'selam',
    conversationId: 'gx',
    userId: 'telegram:9',
    isGroup: true,
    addressedToBot: false,
  }) === false,
);
assert(
  'edge forward true addressed',
  shouldForwardGroupMessage({
    message: 'selam',
    conversationId: 'gx',
    userId: 'telegram:9',
    isGroup: true,
    addressedToBot: true,
  }) === true,
);

// ── processAtlasMessage e2e ──
console.log('\n--- processAtlasMessage ---');
{
  resetActivationSessionsForTests();
  const silent = await processAtlasMessage(
    {
      message: 'Bugün maç var mı?',
      userId: 'telegram:7001',
      displayName: 'Ali',
      channel: 'telegram',
      conversationId: '-100activation1',
      history: [],
      metadata: { isGroup: true, chatType: 'supergroup', telegramFromId: '7001' },
    },
    { trustedUserId: 'telegram:7001', roles: ['user'], atlasBotVerified: true },
  );
  assert(
    'e2e group silent',
    silent.intent === 'activation:no_response' &&
      silent.data?.noResponse === true &&
      !String(silent.reply || '').trim(),
    `${silent.intent} | ${silent.reply}`,
  );
}

{
  resetActivationSessionsForTests();
  const wake = await processAtlasMessage(
    {
      message: 'Orada mısın?',
      userId: 'telegram:7001',
      displayName: 'Ali',
      channel: 'telegram',
      conversationId: '-100activation2',
      history: [],
      metadata: { isGroup: true, chatType: 'supergroup', telegramFromId: '7001' },
    },
    { trustedUserId: 'telegram:7001', roles: ['user'], atlasBotVerified: true },
  );
  assert(
    'e2e presence',
    wake.intent === 'activation:presence_check' && wake.reply === 'Buradayım.',
    `${wake.intent} | ${wake.reply}`,
  );

  const follow = await processAtlasMessage(
    {
      message: 'Nasılsın?',
      userId: 'telegram:7001',
      displayName: 'Ali',
      channel: 'telegram',
      conversationId: '-100activation2',
      history: [
        { role: 'user', content: 'Orada mısın?' },
        { role: 'assistant', content: 'Buradayım.' },
      ],
      metadata: { isGroup: true, chatType: 'supergroup', telegramFromId: '7001' },
    },
    { trustedUserId: 'telegram:7001', roles: ['user'], atlasBotVerified: true },
  );
  assert(
    'e2e follow-up not silent',
    follow.intent !== 'activation:no_response' && follow.data?.noResponse !== true,
    `${follow.intent} | ${String(follow.reply || '').slice(0, 80)}`,
  );
  assert(
    'e2e follow-up not identity clarify',
    !/hitap etmemi mi/i.test(follow.reply || ''),
    follow.reply,
  );
}

{
  resetActivationSessionsForTests();
  const dm = await processAtlasMessage(
    {
      message: 'Merhaba',
      userId: 'telegram:7002',
      displayName: 'Ayşe',
      channel: 'telegram',
      conversationId: '7002',
      history: [],
      metadata: { isGroup: false, chatType: 'private', telegramFromId: '7002' },
    },
    { trustedUserId: 'telegram:7002', roles: ['user'], atlasBotVerified: true },
  );
  assert(
    'e2e dm replies',
    dm.intent !== 'activation:no_response' && String(dm.reply || '').trim().length > 0,
    `${dm.intent} | ${dm.reply}`,
  );
}

closeActivationSession('g1', 'telegram:1');
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===\n`);
process.exit(failed.length ? 1 : 0);

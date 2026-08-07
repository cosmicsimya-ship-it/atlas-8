/**
 * Completeness + personalization regression tests.
 * Run: node scripts/test-completeness-and-memory.mjs
 */
import assert from 'assert';
import { join } from 'path';
import { tmpdir } from 'os';

process.env.ATLAS_MEMORY_FILE = join(
  tmpdir(),
  `atlas-completeness-memory-${process.pid}.json`,
);
process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';

const {
  looksTruncatedReply,
  assessResponseCompleteness,
  nextRetryTokenBudget,
} = await import('../server/response-completeness.js');
const { resolveMaxTokensForResponseMode } = await import(
  '../server/conversation-context-engine.js'
);
const { compactConversationHistory } = await import('../server/symbolic-synthesis.js');
const {
  detectMemoryIntent,
  processMemoryIntent,
  buildRelevantMemoryContext,
  resolvePreferredUserName,
} = await import('../server/memory-intents.js');
const {
  getUserMemory,
  resetMemoryStoreForTests,
  webUserId,
  updateUserMemory,
} = await import('../server/user-memory.js');
const { toWebChatResponse } = await import('../server/channel-adapters.js');

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log('\n=== Truncation / completeness ===\n');

ok('detects mid-word fragment "za"', looksTruncatedReply('za'));
ok('detects unfinished clause', looksTruncatedReply('Bu konu hakkında düşünürken ve'));
ok('complete sentence ok', !looksTruncatedReply('Merhaba, buradayım.'));
ok('short ack ok', !looksTruncatedReply('Tamam'));
ok(
  'api incomplete flagged',
  assessResponseCompleteness({ status: 'incomplete', incompleteReason: 'max_output_tokens' }, 'za')
    .incomplete,
);
ok('retry budget grows', nextRetryTokenBudget(80) > 80 && nextRetryTokenBudget(80) <= 1400);
ok('mode floors raised', resolveMaxTokensForResponseMode('direct_fact') >= 280);
ok('presence floor raised', resolveMaxTokensForResponseMode('casual_ack') >= 160);

ok(
  'incomplete maps retryable',
  toWebChatResponse({
    status: 'error',
    reply: 'Yanıt tamamlanamadı',
    errorCode: 'INCOMPLETE_RESPONSE',
    data: { retryable: true, completionStatus: 'incomplete' },
  }).retryable === true,
);

console.log('\n=== History compaction ===\n');
{
  const history = [];
  for (let i = 0; i < 16; i++) {
    history.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: i === 0 ? 'Benim adım Ayşe' : `mesaj ${i}`,
    });
  }
  const compacted = compactConversationHistory(history, { keepRecent: 8, summarizeAfter: 12 });
  ok('keeps recent turns', compacted.recent.length === 8);
  ok('summary preserves name cue', String(compacted.summary).includes('Ayşe'));
}

console.log('\n=== Personalization / isolation ===\n');
await resetMemoryStoreForTests({ users: {} });
const userA = webUserId('pref-a');
const userB = webUserId('pref-b');

{
  const intent = detectMemoryIntent('Benim adım Ayşe');
  const result = await processMemoryIntent(userA, 'Benim adım Ayşe', intent);
  ok('name intro persists', result.memoryUpdated === true);
  ok('profile.name set', getUserMemory(userA).profile.name === 'Ayşe');
  ok(
    'preferredName synced',
    getUserMemory(userA).preferences.preferredName === 'Ayşe',
  );
}

{
  const ctx = buildRelevantMemoryContext(userA, 'Nasılsın?', 'conversational');
  ok('memory context includes name', String(ctx).includes('Ad: Ayşe'));
  ok('memory context has sparse-address rule', String(ctx).includes('seyrek'));
}

{
  const callMe = detectMemoryIntent('Bana Lara de');
  const result = await processMemoryIntent(userA, 'Bana Lara de', callMe);
  ok('call-me persists', result.memoryUpdated === true && getUserMemory(userA).profile.name === 'Lara');
}

{
  ok(
    'account displayName fallback',
    resolvePreferredUserName(getUserMemory(userB), { accountDisplayName: 'ProfilAdı' }) ===
      'ProfilAdı',
  );
  await updateUserMemory(userB, { profile: { name: 'HafizaAdı' } });
  ok(
    'profile overrides account displayName',
    resolvePreferredUserName(getUserMemory(userB), { accountDisplayName: 'ProfilAdı' }) ===
      'HafizaAdı',
  );
}

{
  const forget = detectMemoryIntent('Adımı unut');
  const result = await processMemoryIntent(userA, 'Adımı unut', forget);
  ok('forget clears name', result.memoryUpdated === true);
  ok('name gone for A', getUserMemory(userA).profile.name == null);
  ok('B untouched', getUserMemory(userB).profile.name === 'HafizaAdı');
}

{
  const forgetMe = detectMemoryIntent('Beni unut');
  await updateUserMemory(userB, {
    profile: { name: 'Silinecek' },
    preferences: { preferredName: 'Silinecek' },
  });
  const result = await processMemoryIntent(userB, 'Beni unut', forgetMe);
  ok('beni unut clears', result.memoryUpdated === true && getUserMemory(userB).profile.name == null);
}

console.log(`\n${passed} passed`);

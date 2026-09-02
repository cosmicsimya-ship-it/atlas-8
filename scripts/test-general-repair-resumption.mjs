/**
 * General repair-signal resumption — full processAtlasMessage pipeline.
 * Run: node scripts/test-general-repair-resumption.mjs
 */
process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';
import { join } from 'path';
import { tmpdir } from 'os';
process.env.ATLAS_MEMORY_FILE = join(
  tmpdir(),
  `atlas-general-repair-test-${process.pid}.json`,
);

import assert from 'node:assert/strict';
import { processAtlasMessage } from '../server/atlas-message-service.js';

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}: ${err?.message || err}`);
  }
}

await check('bare ebced request then repair-with-correction resumes abjad engine', async () => {
  const conversationId = 'general-repair-e2e-1';
  const turn1 = await processAtlasMessage(
    { channel: 'telegram', message: 'ebced hesapla', history: [], conversationId },
    { mode: 'conversational' },
  );
  assert.equal(turn1.engine, 'abjad-verification');

  const turn2 = await processAtlasMessage(
    {
      channel: 'telegram',
      message: 'tövbe yarabbi Zeynep isminin ebced değeri kaç?',
      history: [
        { role: 'user', content: 'ebced hesapla' },
        { role: 'assistant', content: turn1.reply },
      ],
      conversationId,
    },
    { mode: 'conversational' },
  );
  assert.equal(turn2.engine, 'general-repair-signal');
  assert.match(turn2.reply, /Toplam\s*=\s*71/);
  assert.doesNotMatch(turn2.reply, /nasılsın|yardımcı olabilir/i);
});

await check('bare ebced request then repair-with-no-correction asks a clarifying question, not generic chat', async () => {
  const conversationId = 'general-repair-e2e-2';
  const turn1 = await processAtlasMessage(
    { channel: 'telegram', message: 'ebced hesapla', history: [], conversationId },
    { mode: 'conversational' },
  );
  assert.equal(turn1.engine, 'abjad-verification');

  const turn2 = await processAtlasMessage(
    {
      channel: 'telegram',
      message: 'tövbe yarabbi',
      history: [
        { role: 'user', content: 'ebced hesapla' },
        { role: 'assistant', content: turn1.reply },
      ],
      conversationId,
    },
    { mode: 'conversational' },
  );
  assert.equal(turn2.engine, 'general-repair-signal');
  assert.match(turn2.reply, /Ebced hesaplaması/);
});

await check('successful (ok) engine turn is not treated as resumable by the general path', async () => {
  const conversationId = 'general-repair-e2e-3';
  const turn1 = await processAtlasMessage(
    { channel: 'telegram', message: 'Zeynep isminin ebced değeri kaç?', history: [], conversationId },
    { mode: 'conversational' },
  );
  assert.equal(turn1.engine, 'abjad-verification');
  assert.match(turn1.reply, /Toplam\s*=\s*71/);

  const turn2 = await processAtlasMessage(
    {
      channel: 'telegram',
      message: 'tövbe yarabbi',
      history: [
        { role: 'user', content: 'Zeynep isminin ebced değeri kaç?' },
        { role: 'assistant', content: turn1.reply },
      ],
      conversationId,
    },
    { mode: 'conversational' },
  );
  assert.notEqual(turn2.engine, 'general-repair-signal');
});

await check('QUALITY REVIEW B2: successful resumption clears stale state, does not re-hijack a later unrelated repair-phrase message', async () => {
  const conversationId = 'general-repair-e2e-b2-stale-state';
  const turn1 = await processAtlasMessage(
    { channel: 'telegram', message: 'ebced hesapla', history: [], conversationId },
    { mode: 'conversational' },
  );
  assert.equal(turn1.engine, 'abjad-verification');

  const turn2 = await processAtlasMessage(
    {
      channel: 'telegram',
      message: 'tövbe yarabbi Zeynep isminin ebced değeri kaç?',
      history: [
        { role: 'user', content: 'ebced hesapla' },
        { role: 'assistant', content: turn1.reply },
      ],
      conversationId,
    },
    { mode: 'conversational' },
  );
  assert.equal(turn2.engine, 'general-repair-signal');
  assert.match(turn2.reply, /Toplam\s*=\s*71/);

  // A later, unrelated repair-phrase message must NOT re-surface the
  // already-resolved Ebced question — lastEngineInvocation.status should
  // have flipped to 'ok' after turn2's successful resumption.
  const turn3 = await processAtlasMessage(
    {
      channel: 'telegram',
      message: 'tövbe yarabbi',
      history: [
        { role: 'user', content: 'ebced hesapla' },
        { role: 'assistant', content: turn1.reply },
        { role: 'user', content: 'tövbe yarabbi Zeynep isminin ebced değeri kaç?' },
        { role: 'assistant', content: turn2.reply },
      ],
      conversationId,
    },
    { mode: 'conversational' },
  );
  assert.notEqual(turn3.engine, 'general-repair-signal');
  assert.doesNotMatch(turn3.reply ?? '', /Ebced hesaplaması ile ilgili bir sorun mu oldu/);
});

console.log(`\n────────────────────────────────`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL GENERAL REPAIR RESUMPTION TESTS PASSED');
}

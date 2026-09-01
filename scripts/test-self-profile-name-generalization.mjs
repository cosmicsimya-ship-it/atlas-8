// ═══════════════════════════════════════════════════════════════════════
// Test: self-profile-resolver third-party name detection is now general
// (driven by known conversation participants) instead of hardcoded to one
// real user's name — regression test for the architecture-audit fix.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'assert';
import { detectSelfProfileQuery } from '../server/self-profile-resolver.js';
import {
  collectOtherParticipantNames,
  createEmptyConversationState,
} from '../server/conversation-context-engine.js';

let failures = 0;
async function check(label, fn) {
  try {
    await fn();
    console.log(`  ok   - ${label}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL - ${label}`);
    console.error(`         ${err.message}`);
  }
}

console.log('[test-self-profile-name-generalization] detectSelfProfileQuery');

await check('"benim burcum ne?" is a self-profile query regardless of other participant names', () => {
  const result = detectSelfProfileQuery('benim burcum ne?', ['Ahmet', 'Zeynep']);
  assert.ok(result);
  assert.strictEqual(result.field, 'zodiac');
});

await check('a third-party name passed in as a known participant is rejected without "benim"', () => {
  // Previously this exact rejection only worked for a hardcoded name; now it
  // works for ANY name the caller says is a known other participant.
  assert.strictEqual(detectSelfProfileQuery('Ahmet burcum ne?', ['Ahmet']), null);
});

await check('a known participant name not mentioned in the message never suppresses a self query', () => {
  const result = detectSelfProfileQuery('benim burcum ne?', ['Zeynep']);
  assert.ok(result);
});

await check('generic pronouns onun/senin still suppressed without any participant list', () => {
  assert.strictEqual(detectSelfProfileQuery('onun burcum ne?', []), null);
  assert.strictEqual(detectSelfProfileQuery('senin burcum ne?', []), null);
});

await check('Atlas persona name still suppressed (unrelated to the participant-name fix)', () => {
  assert.strictEqual(detectSelfProfileQuery('atlas burcum ne?', []), null);
});

console.log('[test-self-profile-name-generalization] collectOtherParticipantNames');

await check('collects names from participantFactsByTelegramId name: keys and known subjects', () => {
  const state = createEmptyConversationState();
  state.participantFactsByTelegramId['name:ahmet'] = {};
  state.lastExplicitSubject = { displayName: 'Zeynep', userId: null };
  const names = collectOtherParticipantNames(state, { knownParticipants: [{ displayName: 'Mehmet' }] });
  assert.ok(names.includes('ahmet'));
  assert.ok(names.includes('Zeynep'));
  assert.ok(names.includes('Mehmet'));
});

await check('excludes the given display name (the current sender)', () => {
  const state = createEmptyConversationState();
  state.lastExplicitSubject = { displayName: 'Ayşe', userId: null };
  const names = collectOtherParticipantNames(state, { excludeDisplayName: 'Ayşe' });
  assert.ok(!names.includes('Ayşe'));
});

console.log(
  failures === 0
    ? '\n[test-self-profile-name-generalization] all checks passed.'
    : `\n[test-self-profile-name-generalization] ${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);

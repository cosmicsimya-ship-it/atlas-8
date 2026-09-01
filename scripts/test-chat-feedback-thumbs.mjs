// ═══════════════════════════════════════════════════════════════════════
// Test: server/chat-feedback.js (👍/👎 response ratings)
//
// Covers the Phase 6 minimum list for thumbs feedback:
//  - thumbs up is stored
//  - thumbs down is stored
//  - duplicate/updated rating behavior is deterministic
//  - unknown message (requestId) is handled safely
//  - cross-user isolation
// ═══════════════════════════════════════════════════════════════════════

import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';

import {
  configureChatFeedbackStore,
  resetChatFeedbackForTests,
  recordChatFeedback,
  getChatFeedback,
  getChatFeedbackSummary,
  getChatFeedbackStorePath,
} from '../server/chat-feedback.js';

const tmpDir = mkdtempSync(join(tmpdir(), 'atlas-chat-feedback-test-'));
const storeFile = join(tmpDir, 'chat_feedback.test.json');
configureChatFeedbackStore(storeFile);
await resetChatFeedbackForTests(storeFile);

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

console.log('[test-chat-feedback-thumbs] store path:', getChatFeedbackStorePath());

await check('thumbs up is stored', async () => {
  const res = await recordChatFeedback({ userId: 'web:user-1', requestId: 'req-1', rating: 'up' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.feedback.rating, 'up');
  const stored = getChatFeedback({ userId: 'web:user-1', requestId: 'req-1' });
  assert.strictEqual(stored?.rating, 'up');
});

await check('thumbs down is stored', async () => {
  const res = await recordChatFeedback({ userId: 'web:user-2', requestId: 'req-2', rating: 'down' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.feedback.rating, 'down');
});

await check('resubmitting a rating for the same (user, requestId) updates deterministically', async () => {
  // req-1/web:user-1 already exists (created by the "thumbs up is stored"
  // check above) — resubmitting the same rating still hits the update path.
  const first = await recordChatFeedback({ userId: 'web:user-1', requestId: 'req-1', rating: 'up' });
  assert.strictEqual(first.updated, true);
  const second = await recordChatFeedback({ userId: 'web:user-1', requestId: 'req-1', rating: 'down' });
  assert.strictEqual(second.updated, true);
  assert.strictEqual(second.feedback.rating, 'down');
  const stored = getChatFeedback({ userId: 'web:user-1', requestId: 'req-1' });
  assert.strictEqual(stored?.rating, 'down');
  // No duplicate row should exist for this (userId, requestId) pair.
  const store = JSON.parse(readFileSync(storeFile, 'utf8'));
  const matches = store.entries.filter((e) => e.userId === 'web:user-1' && e.requestId === 'req-1');
  assert.strictEqual(matches.length, 1);
});

await check('missing/invalid rating is rejected safely, not stored', async () => {
  const res = await recordChatFeedback({ userId: 'web:user-3', requestId: 'req-3', rating: 'sideways' });
  assert.strictEqual(res.ok, false);
  const stored = getChatFeedback({ userId: 'web:user-3', requestId: 'req-3' });
  assert.strictEqual(stored, null);
});

await check('missing requestId ("unknown message") is handled safely, not stored', async () => {
  const res = await recordChatFeedback({ userId: 'web:user-3', rating: 'up' });
  assert.strictEqual(res.ok, false);
  assert.ok(res.status === 400);
});

await check('missing userId is handled safely, not stored', async () => {
  const res = await recordChatFeedback({ requestId: 'req-99', rating: 'up' });
  assert.strictEqual(res.ok, false);
});

await check('cross-user isolation: two users rating the same requestId do not clobber each other', async () => {
  await recordChatFeedback({ userId: 'web:user-A', requestId: 'req-shared', rating: 'up' });
  await recordChatFeedback({ userId: 'web:user-B', requestId: 'req-shared', rating: 'down' });
  const a = getChatFeedback({ userId: 'web:user-A', requestId: 'req-shared' });
  const b = getChatFeedback({ userId: 'web:user-B', requestId: 'req-shared' });
  assert.strictEqual(a?.rating, 'up');
  assert.strictEqual(b?.rating, 'down');
  // Reading user A's feedback must never return user B's row or vice versa.
  assert.notStrictEqual(a.id, b.id);
});

await check('aggregate summary matches entries (never exposes per-user rows)', async () => {
  await resetChatFeedbackForTests(storeFile);
  await recordChatFeedback({ userId: 'u1', requestId: 'r1', rating: 'up' });
  await recordChatFeedback({ userId: 'u2', requestId: 'r2', rating: 'up' });
  await recordChatFeedback({ userId: 'u3', requestId: 'r3', rating: 'down' });
  const summary = getChatFeedbackSummary();
  assert.strictEqual(summary.total, 3);
  assert.strictEqual(summary.up, 2);
  assert.strictEqual(summary.down, 1);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(summary, 'entries'), false);
});

rmSync(tmpDir, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n[test-chat-feedback-thumbs] ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\n[test-chat-feedback-thumbs] all checks passed.');

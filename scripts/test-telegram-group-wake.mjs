/**
 * Telegram group contextual-wake / conversation-continuity regression tests.
 * Run: node scripts/test-telegram-group-wake.mjs
 *
 * Tests the pure helpers from telegram-group-context.js plus a local
 * re-implementation of telegram.js's own thin Map wrapper (setGroupWakeState /
 * hasGroupWakeState), since telegram.js itself connects to the real Telegram
 * API on import and cannot be imported standalone in a test.
 */
import {
  groupWakeKey,
  isReplyToOtherPerson,
  isGroupWakeActive,
  GROUP_CONTEXT_MAX_AGE_MS,
} from '../server/telegram-group-context.js';

let passed = 0;
let failed = 0;
function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const BOT_ID = 999;
const CHAT_ID = -100500;

function msg({ from, replyFromId, threadId } = {}) {
  return {
    chat: { id: CHAT_ID, type: 'supergroup' },
    message_thread_id: threadId ?? null,
    message_id: Math.floor(Math.random() * 1e6),
    from: from ?? { id: 111 },
    reply_to_message: replyFromId != null ? { from: { id: replyFromId } } : undefined,
  };
}

// Local mirror of telegram.js's own wrapper (same logic, tested in isolation).
function makeWakeStore() {
  const store = new Map();
  return {
    set(m, nowMs = Date.now()) {
      const key = groupWakeKey(m);
      if (!key) return;
      store.set(key, { expiresAt: nowMs + GROUP_CONTEXT_MAX_AGE_MS });
    },
    has(m, nowMs = Date.now()) {
      if (isReplyToOtherPerson(m, { id: BOT_ID })) return false;
      const key = groupWakeKey(m);
      if (!key) return false;
      if (isGroupWakeActive(store.get(key), nowMs)) return true;
      store.delete(key);
      return false;
    },
  };
}

// ── A/B: plain follow-up from the same user, no re-mention ────────────────
{
  const wake = makeWakeStore();
  const t0 = 1_000_000;
  const userA = { id: 111 };
  wake.set(msg({ from: userA }), t0); // Atlas just replied to user A
  const followUp = msg({ from: userA });
  record('A/B: plain follow-up reaches wake window', wake.has(followUp, t0 + 5_000));
}

// ── C: reply to Atlas's own message is not excluded by the "other person" guard ──
{
  const reply = msg({ from: { id: 111 }, replyFromId: BOT_ID });
  record('C: reply to bot is not treated as "other person"', isReplyToOtherPerson(reply, { id: BOT_ID }) === false);
}

// ── D: a different user's plain message must not inherit user A's wake ────
{
  const wake = makeWakeStore();
  const t0 = 2_000_000;
  wake.set(msg({ from: { id: 111 } }), t0);
  const otherUserMsg = msg({ from: { id: 222 } });
  record('D: other user is not covered by user A wake', wake.has(otherUserMsg, t0 + 5_000) === false);
}

// ── E: TTL expiry ───────────────────────────────────────────────────────
{
  const wake = makeWakeStore();
  const t0 = 3_000_000;
  const userA = { id: 111 };
  wake.set(msg({ from: userA }), t0);
  const justBeforeExpiry = wake.has(msg({ from: userA }), t0 + GROUP_CONTEXT_MAX_AGE_MS - 1);
  const afterExpiry = wake.has(msg({ from: userA }), t0 + GROUP_CONTEXT_MAX_AGE_MS + 1);
  record('E: wake still active just before TTL', justBeforeExpiry === true);
  record('E: wake expired after TTL', afterExpiry === false);
}

// ── F: user replies to a different real person — must not auto-claim ──────
{
  const wake = makeWakeStore();
  const t0 = 4_000_000;
  const userA = { id: 111 };
  wake.set(msg({ from: userA }), t0);
  const replyToOther = msg({ from: userA, replyFromId: 333 });
  record('F: reply to another person is excluded despite active wake', wake.has(replyToOther, t0 + 5_000) === false);
}

// ── G: re-addressing resets/refreshes the window ──────────────────────────
{
  const wake = makeWakeStore();
  const userA = { id: 111 };
  wake.set(msg({ from: userA }), 5_000_000);
  wake.set(msg({ from: userA }), 5_100_000); // re-addressed later
  record(
    'G: re-address refreshes expiry forward',
    wake.has(msg({ from: userA }), 5_100_000 + GROUP_CONTEXT_MAX_AGE_MS - 1) === true,
  );
}

// ── Isolation across chats/topics ─────────────────────────────────────────
{
  const wake = makeWakeStore();
  const t0 = 6_000_000;
  const userA = { id: 111 };
  wake.set(msg({ from: userA, threadId: 1 }), t0);
  const otherTopic = msg({ from: userA, threadId: 2 });
  record('topic isolation: different thread not covered', wake.has(otherTopic, t0 + 5_000) === false);
}

// ── Private chat is untouched: groupWakeKey requires a group-shaped msg but callers only invoke this for isGroupChat ──
{
  record('GROUP_CONTEXT_MAX_AGE_MS unchanged (5 min)', GROUP_CONTEXT_MAX_AGE_MS === 5 * 60 * 1000);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

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
import { normalizeTelegramMessage } from '../server/channel-adapters.js';
import { shouldForwardGroupMessage } from '../server/conversation-activation.js';

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

// ═══════════════════════════════════════════════════════════════════════
// REGRESSION: "Atlas" -> "Buradayım." -> ordinary same-user follow-up ->
// no reply.
//
// The wake-window logic above (A-G) was ALWAYS correct in isolation — it
// correctly decides groupWakeActive=true for exactly this case. The real
// bug was one level up: telegram.js's forwardToPipeline() only threaded
// contextualWakeRequest (bare-wake-word reactivation) into
// allowActiveSession, never groupWakeActive (the ordinary-follow-up wake
// window) — and even where allowActiveSession WAS passed,
// normalizeTelegramMessage() in channel-adapters.js never used it to set
// metadata.addressedToBot. So the backend's own, separate activation gate
// (conversation-activation.js, a different process) never learned the
// message was already approved, and could independently decide
// "not addressed" and silently drop it. These tests cover the actual fix:
// normalizeTelegramMessage() must honor allowActiveSession, and — equally
// important — must NOT do so when allowActiveSession isn't set, or every
// group message would start reaching the model (violating the "never
// respond to everyone" requirement).
// ═══════════════════════════════════════════════════════════════════════

const BOT_IDENTITY = { id: BOT_ID, username: 'atlas_bot' };
function groupMsg(text, overrides = {}) {
  return {
    chat: { id: CHAT_ID, type: 'supergroup' },
    message_thread_id: null,
    message_id: Math.floor(Math.random() * 1e6),
    date: Math.floor(Date.now() / 1000),
    from: { id: 111, is_bot: false, first_name: 'Furkan' },
    text,
    ...overrides,
  };
}

// ── B (the real reported regression): ordinary same-user sentence, wake window active ──
{
  const ordinary = groupMsg('Soruyu algıladın mı canım');
  const normalized = normalizeTelegramMessage(ordinary, [], { ...BOT_IDENTITY, allowActiveSession: true });
  record(
    'B: normalizeTelegramMessage sets addressedToBot=true when allowActiveSession=true (THE FIX)',
    normalized.metadata.addressedToBot === true,
  );
  const forward = shouldForwardGroupMessage({
    message: ordinary.text,
    conversationId: String(CHAT_ID),
    userId: 'telegram:111',
    isGroup: true,
    addressedToBot: normalized.metadata.addressedToBot,
  });
  record('B: shouldForwardGroupMessage forwards the ordinary follow-up once addressedToBot propagates', forward === true);
}

// ── G: no global group activation — without an active wake window, the same ordinary message must NOT be forwarded ──
{
  const ordinary = groupMsg('Soruyu algıladın mı canım');
  const normalized = normalizeTelegramMessage(ordinary, [], { ...BOT_IDENTITY, allowActiveSession: false });
  record(
    'G: normalizeTelegramMessage does NOT set addressedToBot without an active wake window (no blanket group activation)',
    normalized.metadata.addressedToBot === false,
  );
  const normalizedDefault = normalizeTelegramMessage(ordinary, [], { ...BOT_IDENTITY });
  record(
    'G: allowActiveSession defaults to inert (omitted entirely) — same ordinary message stays silent',
    normalizedDefault.metadata.addressedToBot === false,
  );
}

// ── F: the bot's own short acknowledgement must not close/reset the wake window ──
{
  const wake = makeWakeStore();
  const userA = { id: 111 };
  const t0 = 7_000_000;
  wake.set(msg({ from: userA }), t0); // "Atlas" -> wake opens
  // Presence-check ack ("Buradayım.") triggers setGroupWakeState again on
  // the SAME turn in the real code (telegram.js calls it after every
  // successful reply) — refreshing, never clearing, the window.
  wake.set(msg({ from: userA }), t0 + 100);
  const stillActiveAfterAck = wake.has(msg({ from: userA }), t0 + 4000);
  record('F: window remains active after the bot\'s own acknowledgement refreshes it', stillActiveAfterAck === true);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

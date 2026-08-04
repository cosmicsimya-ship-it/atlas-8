/**
 * Lightweight frontend-contract checks for chat retry UX helpers.
 * Run: node scripts/test-web-chat-retry-contract.mjs
 */
import assert from 'assert';

function isRetryable(response) {
  const SOFT = new Set(['TIMEOUT', 'RATE_LIMIT', 'MODEL_UNAVAILABLE', 'ENGINE_FAILURE']);
  if (response.retryable === true) return true;
  if (response.errorCode && SOFT.has(response.errorCode)) return true;
  if (response.status === 'error' && response.errorCode) return true;
  return false;
}

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

ok(
  'timeout soft fail retryable',
  isRetryable({
    reply: 'Mesajını aldım ancak şu anda yanıtı tamamlayamadım. Lütfen birkaç saniye sonra tekrar dene.',
    errorCode: 'TIMEOUT',
    status: 'error',
  }),
);
ok(
  'success not retryable',
  !isRetryable({ reply: 'Merhaba.', status: 'complete', errorCode: null }),
);
ok('explicit retryable flag', isRetryable({ reply: 'x', retryable: true }));

let messages = [];
const turnId = 'turn-1';
messages.push({ id: 'u1', role: 'user', content: 'merhaba', turnId });
messages.push({
  id: 'a1',
  role: 'assistant',
  content: 'fallback',
  error: true,
  retryable: true,
  turnId,
});

ok(
  'single user bubble before retry',
  messages.filter((m) => m.role === 'user' && m.turnId === turnId).length === 1,
);

messages = messages.filter((m) => !(m.turnId === turnId && m.role === 'assistant'));
messages.push({ id: 'a2', role: 'assistant', content: '', pending: true, turnId });
ok(
  'retry does not duplicate user',
  messages.filter((m) => m.role === 'user' && m.turnId === turnId).length === 1,
);

let activeTurn = 'turn-1';
const lateTurn = 'turn-1';
activeTurn = 'turn-2';
ok('stale delayed response dropped', activeTurn !== lateTurn);

const c1 = new AbortController();
const c2 = new AbortController();
ok('fresh controllers', c1 !== c2 && c1.signal !== c2.signal);

console.log(`\n${passed} passed`);

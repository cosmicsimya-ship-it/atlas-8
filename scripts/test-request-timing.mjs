/**
 * Request timing telemetry — structure + privacy (no message content in logs).
 */
import {
  createRequestTiming,
  safeConversationRef,
  attachRequestTiming,
  REQUEST_TIMING_VERSION,
} from '../server/request-timing.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { _resetAllNumerologySessions } from '../server/numerology-engine/index.js';

let passed = 0;
let failed = 0;
const failures = [];

function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const timing = createRequestTiming({
  channel: 'web',
  conversationId: 'conv-timing-demo-123',
});
timing.mark('received');
timing.start('normalization');
await new Promise((r) => setTimeout(r, 5));
timing.end('normalization');
timing.start('numerology_engine');
timing.end('numerology_engine');
timing.noteLlmCall();
timing.noteRetryOrFallback();

const snap = timing.snapshot({ intent: 'test', engine: 'unit' });
record('timing version', snap.version === REQUEST_TIMING_VERSION);
record('timing requestId', /^req_/.test(snap.requestId));
record('timing conversationRef safe', snap.conversationRef === safeConversationRef('conv-timing-demo-123'));
record('timing no raw conversation id', !JSON.stringify(snap).includes('conv-timing-demo-123'));
record('timing has phases', snap.phases.some((p) => p.name === 'normalization'));
record('timing total > 0', snap.totalDurationMs > 0);
record('timing llmCallCount', snap.llmCallCount === 1);
record('timing retry flag', snap.usedRetryOrFallback === true);

const attached = attachRequestTiming(
  { status: 'complete', reply: 'ok', intent: 'test', engine: 'unit', data: {} },
  createRequestTiming({ channel: 'telegram', conversationId: 'tg-1' }),
);
record('attach requestTiming', Boolean(attached.data?.requestTiming?.requestId));
record('attach latencyMs', Number(attached.data?.latencyMs) >= 0);

_resetAllNumerologySessions();
process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';
const result = await processAtlasMessage(
  {
    message: '27.01.1986 numeroloji analizi yap',
    channel: 'web',
    conversationId: 'timing-live-1',
    userId: 'web:timing-user',
    history: [],
  },
  { trustedUserId: 'web:timing-user' },
);
record('live numerology handled', result?.engine === 'numerology-engine');
record(
  'live has requestTiming',
  Boolean(result?.data?.requestTiming?.requestId),
  result?.data?.requestTiming?.engine || '',
);
record(
  'live timing has numerology phase or total',
  (result?.data?.requestTiming?.phases || []).some((p) => p.name === 'numerology_engine') ||
    Number(result?.data?.requestTiming?.totalDurationMs) >= 0,
);
// ATLAS LAB (Phase 1): the snapshot OBJECT now intentionally carries a
// bounded, truncated userMessageSummary for dev-only diagnosis — but the
// always-on, every-environment console line (logRequestTiming) must still
// never contain message content, in production or anywhere else. Verify
// both halves of that boundary explicitly, rather than the old blanket
// "no message text anywhere" rule this phase deliberately relaxes for the
// snapshot object only.
record(
  'live timing snapshot DOES carry a bounded user-message summary (new, intentional)',
  typeof result?.data?.requestTiming?.userMessageSummary === 'string' &&
    result.data.requestTiming.userMessageSummary.length > 0,
);
{
  const originalLog = console.log;
  const printedLines = [];
  console.log = (...args) => printedLines.push(args.join(' '));
  try {
    _resetAllNumerologySessions();
    await processAtlasMessage(
      {
        message: '27.01.1986 numeroloji analizi yap',
        channel: 'web',
        conversationId: 'timing-console-check',
        userId: 'web:timing-user-2',
        history: [],
      },
      { trustedUserId: 'web:timing-user-2' },
    );
  } finally {
    console.log = originalLog;
  }
  const printedText = printedLines.join('\n');
  record(
    'console-printed [Atlas/timing] line still omits message text (production log boundary)',
    printedText.includes('[Atlas/timing]') && !printedText.includes('27.01.1986'),
  );
}
record('live llmCallCount 0 for engine', result?.data?.requestTiming?.llmCallCount === 0);

console.log('');
console.log(`Timing tests: ${passed} passed, ${failed} failed`);
if (failed) {
  console.error('Failures:', failures.join('; '));
  process.exit(1);
}

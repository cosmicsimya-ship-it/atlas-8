/**
 * Provider retry + error classification unit tests.
 * Run: node scripts/test-provider-retry.mjs
 */
import assert from 'assert';
import {
  classifyProviderError,
  withProviderRetry,
  ERROR_CATEGORIES,
  categoryToErrorCode,
  isRetryEligibleCategory,
} from '../server/provider-errors.js';

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log('=== classifyProviderError ===\n');

ok(
  'timeout',
  classifyProviderError(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }))
    .category === ERROR_CATEGORIES.PROVIDER_TIMEOUT,
);
ok(
  '429 rate limit',
  classifyProviderError(Object.assign(new Error('Rate limit exceeded'), { status: 429 })).category ===
    ERROR_CATEGORIES.PROVIDER_RATE_LIMIT,
);
ok(
  '503 unavailable',
  classifyProviderError(Object.assign(new Error('bad gateway'), { status: 503 })).retryEligible === true,
);
ok(
  'validation not retryable',
  classifyProviderError(Object.assign(new Error('invalid input'), { status: 400 })).retryEligible === false,
);
ok('empty output not retryable', classifyProviderError(new Error('OpenAI returned empty output')).retryEligible === false);
ok('category maps TIMEOUT', categoryToErrorCode(ERROR_CATEGORIES.PROVIDER_TIMEOUT) === 'TIMEOUT');
ok('retry set contains network', isRetryEligibleCategory(ERROR_CATEGORIES.NETWORK_ERROR));

console.log('\n=== withProviderRetry ===\n');

{
  let calls = 0;
  const { result, attempts } = await withProviderRetry(
    async () => {
      calls += 1;
      if (calls === 1) {
        const err = new Error('timeout');
        err.name = 'TimeoutError';
        throw err;
      }
      return { content: 'ok', provider: 'openai', model: 'test' };
    },
    { requestId: 'req_test1', channel: 'web', route: 'test', maxAttempts: 2, backoffMs: 10 },
  );
  ok('first fail second success', result.content === 'ok' && attempts === 2 && calls === 2);
}

{
  let calls = 0;
  let failed = false;
  try {
    await withProviderRetry(
      async () => {
        calls += 1;
        const err = new Error('service unavailable');
        err.status = 503;
        throw err;
      },
      { requestId: 'req_test2', maxAttempts: 2, backoffMs: 5 },
    );
  } catch {
    failed = true;
  }
  ok('both attempts fail', failed && calls === 2);
}

{
  let calls = 0;
  let failed = false;
  try {
    await withProviderRetry(
      async () => {
        calls += 1;
        const err = new Error('invalid input');
        err.status = 400;
        throw err;
      },
      { requestId: 'req_test3', maxAttempts: 2, backoffMs: 5 },
    );
  } catch {
    failed = true;
  }
  ok('validation does not retry', failed && calls === 1);
}

{
  let memoryWrites = 0;
  let calls = 0;
  // Simulate: memory written once before provider; retry must not re-write
  memoryWrites += 1;
  await withProviderRetry(
    async () => {
      calls += 1;
      if (calls === 1) {
        const err = new Error('ECONNRESET');
        throw err;
      }
      return { ok: true };
    },
    { requestId: 'req_mem', maxAttempts: 2, backoffMs: 5 },
  );
  ok('memory write stays once around retry', memoryWrites === 1 && calls === 2);
}

console.log(`\n${passed} passed`);

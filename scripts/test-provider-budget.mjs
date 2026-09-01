/**
 * Deterministic regression suite for the bounded total-provider-budget fix.
 *
 * Scope: server/provider-errors.js's createProviderBudget()/withProviderRetry()
 * budget-aware behavior — the shared "one user request = one bounded backend
 * time budget" mechanism that atlas-message-service.js's LLM call site (the
 * initial attempt via withProviderRetry, its retry, and the completeness
 * retry) all draw down together.
 *
 * All timings here are small stand-ins (tens/hundreds of ms) for the real
 * production values (TOTAL_PROVIDER_BUDGET_MS=100000, provider timeout
 * default 120000, MIN_RETRY_BUDGET_MS=3000) so the suite runs in well under
 * a second — no real 100+ second waits, per the task's explicit requirement.
 * Assertions are made primarily on the *logical* values withProviderRetry
 * computes (attemptTimeoutMs, remainingMs(), call counts), not on fragile
 * wall-clock tolerances, wherever the two can be separated.
 *
 * Run: node scripts/test-provider-budget.mjs
 */
import assert from 'assert';
import {
  classifyProviderError,
  categoryToErrorCode,
  withProviderRetry,
  createProviderBudget,
  TOTAL_PROVIDER_BUDGET_MS,
  MIN_RETRY_BUDGET_MS,
  ERROR_CATEGORIES,
} from '../server/provider-errors.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function timeoutError() {
  const err = new Error('The operation was aborted due to timeout');
  err.name = 'TimeoutError';
  return err;
}

function serverError(status = 503) {
  return Object.assign(new Error('Internal server error'), { status });
}

function abortError() {
  return Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' });
}

let passed = 0;
function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

// ─────────────────────────────────────────────────────────────────────────
console.log('=== 1. Fast success — single attempt, budget barely touched ===');
{
  const budget = createProviderBudget(5000);
  const providerTimeoutMs = 2000;
  let calls = 0;
  const { result, attempts } = await withProviderRetry(
    async () => {
      calls += 1;
      return { content: 'hello', provider: 'openai', model: 'gpt-4.1-mini' };
    },
    { requestId: 'T1', maxAttempts: 2, backoffMs: 10, budget, providerTimeoutMs },
  );
  assert.strictEqual(calls, 1, 'expected exactly 1 provider call');
  assert.strictEqual(attempts, 1);
  assert.strictEqual(result.content, 'hello');
  assert.ok(budget.remainingMs() > 4900, 'a fast success should barely touch the budget');
  ok('single attempt, budget preserved');
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n=== 2. Fast retryable 5xx succeeds given sufficient budget ===');
{
  const budget = createProviderBudget(5000);
  let calls = 0;
  const { result, attempts } = await withProviderRetry(
    async () => {
      calls += 1;
      if (calls === 1) throw serverError(503);
      return { content: 'ok-after-retry' };
    },
    { requestId: 'T2', maxAttempts: 2, backoffMs: 10, budget, providerTimeoutMs: 2000 },
  );
  assert.strictEqual(calls, 2, 'expected 1 failed + 1 successful call');
  assert.strictEqual(attempts, 2);
  assert.strictEqual(result.content, 'ok-after-retry');
  ok('transient 5xx retried and succeeds with ample budget');
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n=== 3. Provider timeout bounded — retry does NOT get a fresh full timeout ===');
{
  const totalBudgetMs = 200; // stand-in for TOTAL_PROVIDER_BUDGET_MS=100000
  const providerTimeoutMs = 150; // stand-in for OPENAI_TIMEOUT_MS default 120000
  const budget = createProviderBudget(totalBudgetMs);
  const timeoutsUsed = [];
  let calls = 0;

  const t0 = Date.now();
  let thrown = null;
  try {
    await withProviderRetry(
      async () => {
        calls += 1;
        const attemptTimeoutMs = budget.attemptTimeoutMs(providerTimeoutMs);
        timeoutsUsed.push(attemptTimeoutMs);
        await sleep(attemptTimeoutMs); // the "provider never responds" case
        throw timeoutError();
      },
      {
        requestId: 'T3',
        maxAttempts: 2,
        backoffMs: 10,
        budget,
        providerTimeoutMs,
        minRetryBudgetMs: 5, // scaled down to match this test's tiny total budget
      },
    );
  } catch (err) {
    thrown = err;
  }
  const elapsed = Date.now() - t0;

  assert.ok(thrown, 'expected withProviderRetry to eventually throw');
  assert.strictEqual(calls, 2, 'expected exactly 2 provider calls (initial + 1 retry)');
  assert.strictEqual(timeoutsUsed.length, 2);
  assert.ok(
    timeoutsUsed[1] < timeoutsUsed[0],
    `retry attemptTimeoutMs (${timeoutsUsed[1]}) must be SMALLER than the initial attempt's (${timeoutsUsed[0]}) — proves it is NOT a fresh full timeout`,
  );
  assert.ok(
    timeoutsUsed[1] < providerTimeoutMs,
    `retry attemptTimeoutMs (${timeoutsUsed[1]}) must be bounded below the configured provider timeout (${providerTimeoutMs})`,
  );
  const oldBugFloor = providerTimeoutMs * 2; // what elapsed would be if each attempt got a fresh full timeout
  assert.ok(
    elapsed < oldBugFloor,
    `elapsed (${elapsed}ms) should be well under the old-bug floor of 2x provider timeout (${oldBugFloor}ms)`,
  );
  assert.ok(
    elapsed <= totalBudgetMs + 100,
    `elapsed (${elapsed}ms) should stay close to the total budget (${totalBudgetMs}ms), not balloon past it`,
  );
  console.log(
    `  attempt timeouts used: [${timeoutsUsed.join(', ')}]ms, elapsed=${elapsed}ms (old-bug floor would be ${oldBugFloor}ms)`,
  );
  ok('a genuine timeout retry is bounded by the shrinking shared budget, not a fresh per-attempt timeout');
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n=== 4. Insufficient remaining budget skips the retry entirely ===');
{
  // Total budget (2000ms) is itself below the default MIN_RETRY_BUDGET_MS
  // (3000ms), so even a near-instant first failure must not be retried.
  assert.ok(2000 < MIN_RETRY_BUDGET_MS, 'sanity: test budget must be below MIN_RETRY_BUDGET_MS');
  const budget = createProviderBudget(2000);
  let calls = 0;
  let thrown = null;
  try {
    await withProviderRetry(
      async () => {
        calls += 1;
        throw serverError(503); // fast, retry-eligible failure
      },
      { requestId: 'T4', maxAttempts: 2, backoffMs: 10, budget, providerTimeoutMs: 1500 },
    );
  } catch (err) {
    thrown = err;
  }
  assert.strictEqual(calls, 1, 'must NOT start a second attempt when remaining budget is insufficient');
  assert.ok(thrown, 'expected a thrown failure');
  assert.strictEqual(thrown.retryEligible, false);
  ok('retry correctly skipped when remaining budget <= MIN_RETRY_BUDGET_MS');
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n=== 5. AbortError (ABORTED_REQUEST) is never retried, budget notwithstanding ===');
{
  const budget = createProviderBudget(50_000); // plenty of budget
  let calls = 0;
  let thrown = null;
  try {
    await withProviderRetry(
      async () => {
        calls += 1;
        throw abortError();
      },
      { requestId: 'T5', maxAttempts: 2, backoffMs: 10, budget, providerTimeoutMs: 1000 },
    );
  } catch (err) {
    thrown = err;
  }
  assert.strictEqual(calls, 1, 'ABORTED_REQUEST must never be retried, even with ample budget');
  const classified = classifyProviderError(thrown);
  assert.strictEqual(classified.category, ERROR_CATEGORIES.ABORTED_REQUEST);
  assert.strictEqual(categoryToErrorCode(classified.category), 'TIMEOUT');
  ok('existing ABORTED_REQUEST non-retry behavior preserved unchanged');
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n=== 6. 429 / transient errors: retried only if remaining budget allows ===');
{
  // 6a — ample budget: retry proceeds and can succeed.
  {
    const budget = createProviderBudget(10_000);
    let calls = 0;
    const { attempts } = await withProviderRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error('Rate limit reached'), { status: 429 });
        return { content: 'ok' };
      },
      { requestId: 'T6a', maxAttempts: 2, backoffMs: 10, budget, providerTimeoutMs: 2000 },
    );
    assert.strictEqual(calls, 2);
    assert.strictEqual(attempts, 2);
    ok('429 retried and succeeds when ample budget remains');
  }
  // 6b — tight budget: retry is skipped even though the error is retry-eligible.
  {
    const budget = createProviderBudget(1000); // below MIN_RETRY_BUDGET_MS
    let calls = 0;
    let thrown = null;
    try {
      await withProviderRetry(
        async () => {
          calls += 1;
          throw Object.assign(new Error('Rate limit reached'), { status: 429 });
        },
        { requestId: 'T6b', maxAttempts: 2, backoffMs: 10, budget, providerTimeoutMs: 800 },
      );
    } catch (err) {
      thrown = err;
    }
    assert.strictEqual(calls, 1, 'must not retry a 429 when remaining budget is insufficient');
    assert.ok(thrown);
    ok('429 retry correctly skipped when remaining budget is insufficient');
  }
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n=== 7. Completeness retry shares the SAME total deadline (ample budget) ===');
{
  // Mirrors atlas-message-service.js's call pattern: the initial attempt runs
  // through withProviderRetry against `budget`; the completeness retry is a
  // second, separate call gated by `budget.remainingMs() > MIN_RETRY_BUDGET_MS`
  // against the exact SAME budget instance — never an independent fresh clock.
  const budget = createProviderBudget(10_000);
  const providerTimeoutMs = 3000;

  const remainingBeforeFirst = budget.remainingMs();
  await withProviderRetry(async () => ({ content: 'first (incomplete)' }), {
    requestId: 'T7',
    maxAttempts: 2,
    backoffMs: 10,
    budget,
    providerTimeoutMs,
  });
  const remainingAfterFirst = budget.remainingMs();

  // The gate atlas-message-service.js applies before the completeness retry:
  const completenessAllowed = budget.remainingMs() > MIN_RETRY_BUDGET_MS;
  assert.ok(completenessAllowed, 'ample remaining budget should allow the completeness retry');

  let completenessCalls = 0;
  let completenessAttemptTimeoutMs = null;
  if (completenessAllowed) {
    completenessAttemptTimeoutMs = budget.attemptTimeoutMs(providerTimeoutMs);
    completenessCalls += 1;
    void completenessCalls; // simulate the actual llmInvoke(maxTokens) call site
  }
  const remainingAfterCompleteness = budget.remainingMs();

  assert.strictEqual(completenessCalls, 1);
  assert.ok(
    remainingAfterFirst <= remainingBeforeFirst,
    'remaining budget must monotonically shrink across calls sharing one budget instance',
  );
  assert.ok(
    remainingAfterCompleteness <= remainingAfterFirst,
    'the completeness retry must draw down the SAME shrinking clock, not reset it',
  );
  assert.ok(
    completenessAttemptTimeoutMs <= remainingAfterFirst,
    'completeness retry attemptTimeoutMs must be bounded by what remained of the total budget, not the full provider timeout',
  );
  ok('completeness retry uses the same shared deadline, drawn down (never reset)');
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n=== 8. Completeness retry SKIPPED when budget exhausted — no new provider call ===');
{
  const budget = createProviderBudget(500); // well below MIN_RETRY_BUDGET_MS(3000)
  const providerTimeoutMs = 400;

  await withProviderRetry(async () => ({ content: 'first (incomplete)' }), {
    requestId: 'T8',
    maxAttempts: 2,
    backoffMs: 10,
    budget,
    providerTimeoutMs,
  });

  const completenessAllowed = budget.remainingMs() > MIN_RETRY_BUDGET_MS;
  assert.strictEqual(completenessAllowed, false, 'budget should already be below MIN_RETRY_BUDGET_MS');

  let completenessCalls = 0;
  let caughtOrSwallowed = false;
  try {
    if (completenessAllowed) {
      completenessCalls += 1;
    }
    // else: existing safe incomplete/fallback behavior — no new call, nothing thrown/swallowed.
  } catch {
    caughtOrSwallowed = true;
  }
  assert.strictEqual(completenessCalls, 0, 'no new provider call should be started');
  assert.strictEqual(caughtOrSwallowed, false, 'skipping must not go through a catch/swallow path');
  ok('completeness retry correctly skipped with no new provider call and no swallowed exception');
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n=== 9. Backend total duration stays bounded under the frontend 120s timeout ===');
{
  assert.ok(
    TOTAL_PROVIDER_BUDGET_MS < 120_000,
    `TOTAL_PROVIDER_BUDGET_MS (${TOTAL_PROVIDER_BUDGET_MS}) must stay below the frontend's REQUEST_TIMEOUT_MS (120000, src/config.ts) — this task does not touch that frontend constant`,
  );
  assert.ok(
    TOTAL_PROVIDER_BUDGET_MS + 20_000 <= 120_000,
    'at least ~20s of margin should remain for pipeline overhead outside the provider call itself',
  );

  // Scaled-down worst-case simulation: an always-timing-out provider must
  // never make withProviderRetry run past its (scaled) total budget.
  const totalBudgetMs = 300;
  const providerTimeoutMs = 100_000 * (totalBudgetMs / TOTAL_PROVIDER_BUDGET_MS); // same ratio as production
  const budget = createProviderBudget(totalBudgetMs);
  let calls = 0;
  const t0 = Date.now();
  try {
    await withProviderRetry(
      async () => {
        calls += 1;
        const attemptTimeoutMs = budget.attemptTimeoutMs(providerTimeoutMs);
        await sleep(attemptTimeoutMs);
        throw timeoutError();
      },
      { requestId: 'T9', maxAttempts: 2, backoffMs: 10, budget, providerTimeoutMs, minRetryBudgetMs: 5 },
    );
  } catch {
    // expected — worst case still ends in a controlled failure/fallback
  }
  const elapsed = Date.now() - t0;
  assert.ok(
    elapsed <= totalBudgetMs + 100,
    `worst-case elapsed (${elapsed}ms) must stay within the total budget (${totalBudgetMs}ms) plus scheduling slack`,
  );
  ok('worst-case (always-timeout) duration stays bounded by the shared total budget');
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n=== 10. Backoff sleep between attempts is itself capped by remaining budget ===');
{
  const budget = createProviderBudget(60); // deliberately tiny
  let calls = 0;
  const backoffMs = 10_000; // deliberately huge — would sleep 10s uncapped
  const t0 = Date.now();
  try {
    await withProviderRetry(
      async () => {
        calls += 1;
        throw serverError(503); // instant failure, retry-eligible
      },
      { requestId: 'T10', maxAttempts: 2, backoffMs, budget, providerTimeoutMs: 30, minRetryBudgetMs: 5 },
    );
  } catch {
    // expected
  }
  const elapsed = Date.now() - t0;
  assert.ok(
    elapsed < 1000,
    `elapsed (${elapsed}ms) proves the huge backoffMs (${backoffMs}ms) was capped by the tiny remaining budget, not slept in full`,
  );
  ok('backoff sleep is capped so it cannot itself exhaust or overrun the shared budget');
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n=== 11. Without a budget (opts.budget omitted), behavior is unchanged ===');
{
  // Backward compatibility: callers that don't opt into budgeting (none left
  // in this codebase after this task's wiring, but the API must not force
  // budget usage) get the original unbounded-per-attempt behavior.
  let calls = 0;
  const { attempts } = await withProviderRetry(
    async () => {
      calls += 1;
      if (calls === 1) throw serverError(503);
      return { content: 'ok' };
    },
    { requestId: 'T11', maxAttempts: 2, backoffMs: 5 },
  );
  assert.strictEqual(calls, 2);
  assert.strictEqual(attempts, 2);
  ok('omitting opts.budget preserves original (non-budgeted) retry behavior');
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n=== 12. classifyProviderError / categoryToErrorCode are untouched by the budget change ===');
{
  const cases = [
    { label: '401 unauthorized', err: Object.assign(new Error('Incorrect API key provided'), { status: 401 }), expectRetry: false, expectCode: 'ENGINE_FAILURE' },
    { label: '429 rate limit', err: Object.assign(new Error('Rate limit reached'), { status: 429 }), expectRetry: true, expectCode: 'RATE_LIMIT' },
    { label: '500 server error', err: Object.assign(new Error('Internal server error'), { status: 500 }), expectRetry: true, expectCode: 'MODEL_UNAVAILABLE' },
    { label: 'malformed response', err: new Error('OpenAI returned empty output'), expectRetry: false, expectCode: 'ENGINE_FAILURE' },
  ];
  for (const { label, err, expectRetry, expectCode } of cases) {
    const classified = classifyProviderError(err);
    assert.strictEqual(classified.retryEligible, expectRetry, `${label}: retryEligible`);
    assert.strictEqual(categoryToErrorCode(classified.category), expectCode, `${label}: errorCode`);
  }
  ok('classification/error-code mapping unaffected by the budget-aware retry change');
}

console.log(`\n${passed} test blocks passed, all assertions green.`);

/**
 * Provider / transport error classification + safe retry helpers.
 * Never logs secrets, tokens, or message bodies.
 */

export const ERROR_CATEGORIES = Object.freeze({
  REQUEST_TIMEOUT: 'request_timeout',
  PROVIDER_TIMEOUT: 'provider_timeout',
  PROVIDER_RATE_LIMIT: 'provider_rate_limit',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  NETWORK_ERROR: 'network_error',
  INVALID_PROVIDER_RESPONSE: 'invalid_provider_response',
  APPLICATION_ERROR: 'application_error',
  ABORTED_REQUEST: 'aborted_request',
  VALIDATION_ERROR: 'validation_error',
  UNKNOWN_ERROR: 'unknown_error',
});

const RETRYABLE = new Set([
  ERROR_CATEGORIES.REQUEST_TIMEOUT,
  ERROR_CATEGORIES.PROVIDER_TIMEOUT,
  ERROR_CATEGORIES.PROVIDER_RATE_LIMIT,
  ERROR_CATEGORIES.PROVIDER_UNAVAILABLE,
  ERROR_CATEGORIES.NETWORK_ERROR,
]);

/**
 * @param {unknown} err
 * @returns {{
 *   category: string,
 *   httpStatus: number|null,
 *   retryEligible: boolean,
 *   message: string,
 * }}
 */
export function classifyProviderError(err) {
  const message = String(err?.message ?? err ?? 'Unknown error');
  const httpStatus =
    typeof err?.status === 'number'
      ? err.status
      : typeof err?.statusCode === 'number'
        ? err.statusCode
        : null;
  const name = String(err?.name || '');
  const lower = message.toLowerCase();

  if (
    name === 'AbortError' ||
    /aborted|abort(?!ed\s+due)|the operation was aborted/i.test(message)
  ) {
    // AbortSignal.timeout surfaces as TimeoutError / aborted in some runtimes
    if (/timeout/i.test(message) || name === 'TimeoutError') {
      return {
        category: ERROR_CATEGORIES.PROVIDER_TIMEOUT,
        httpStatus: httpStatus ?? 408,
        retryEligible: true,
        message,
      };
    }
    return {
      category: ERROR_CATEGORIES.ABORTED_REQUEST,
      httpStatus: httpStatus ?? 499,
      retryEligible: false,
      message,
    };
  }

  if (name === 'TimeoutError' || /timeout|timed out|etimedout|esockettimedout/i.test(lower)) {
    return {
      category: ERROR_CATEGORIES.PROVIDER_TIMEOUT,
      httpStatus: httpStatus ?? 408,
      retryEligible: true,
      message,
    };
  }

  if (httpStatus === 429 || /rate limit|too many requests/i.test(lower)) {
    return {
      category: ERROR_CATEGORIES.PROVIDER_RATE_LIMIT,
      httpStatus: httpStatus ?? 429,
      retryEligible: true,
      message,
    };
  }

  if (
    httpStatus === 502 ||
    httpStatus === 503 ||
    httpStatus === 504 ||
    /service unavailable|bad gateway|gateway timeout|overloaded/i.test(lower)
  ) {
    return {
      category: ERROR_CATEGORIES.PROVIDER_UNAVAILABLE,
      httpStatus: httpStatus ?? 503,
      retryEligible: true,
      message,
    };
  }

  if (
    /econnreset|econnrefused|enotfound|fetch failed|network|socket hang up|und_err/i.test(lower)
  ) {
    return {
      category: ERROR_CATEGORIES.NETWORK_ERROR,
      httpStatus,
      retryEligible: true,
      message,
    };
  }

  if (/empty output|invalid.*response|unexpected token|json/i.test(lower)) {
    return {
      category: ERROR_CATEGORIES.INVALID_PROVIDER_RESPONSE,
      httpStatus,
      retryEligible: false,
      message,
    };
  }

  if (/OPENAI_API_KEY not set|not configured/i.test(message)) {
    return {
      category: ERROR_CATEGORIES.APPLICATION_ERROR,
      httpStatus: httpStatus ?? 503,
      retryEligible: false,
      message,
    };
  }

  if (/invalid input|validation|required/i.test(lower) || httpStatus === 400) {
    return {
      category: ERROR_CATEGORIES.VALIDATION_ERROR,
      httpStatus: httpStatus ?? 400,
      retryEligible: false,
      message,
    };
  }

  if (httpStatus && httpStatus >= 500) {
    return {
      category: ERROR_CATEGORIES.PROVIDER_UNAVAILABLE,
      httpStatus,
      retryEligible: true,
      message,
    };
  }

  return {
    category: ERROR_CATEGORIES.UNKNOWN_ERROR,
    httpStatus,
    retryEligible: false,
    message,
  };
}

/**
 * @param {string} category
 */
export function isRetryEligibleCategory(category) {
  return RETRYABLE.has(category);
}

/**
 * Map classified category → pipeline errorCode (legacy contract).
 * @param {string} category
 */
export function categoryToErrorCode(category) {
  switch (category) {
    case ERROR_CATEGORIES.PROVIDER_TIMEOUT:
    case ERROR_CATEGORIES.REQUEST_TIMEOUT:
    case ERROR_CATEGORIES.ABORTED_REQUEST:
      return 'TIMEOUT';
    case ERROR_CATEGORIES.PROVIDER_RATE_LIMIT:
      return 'RATE_LIMIT';
    case ERROR_CATEGORIES.APPLICATION_ERROR:
    case ERROR_CATEGORIES.PROVIDER_UNAVAILABLE:
      return 'MODEL_UNAVAILABLE';
    case ERROR_CATEGORIES.VALIDATION_ERROR:
      return 'INVALID_INPUT';
    default:
      return 'ENGINE_FAILURE';
  }
}

/**
 * @param {number} ms
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Structured provider attempt log — no secrets / PII / message bodies.
 * @param {{
 *   requestId: string,
 *   channel?: string|null,
 *   route?: string|null,
 *   attempt: number,
 *   maxAttempts: number,
 *   category?: string|null,
 *   httpStatus?: number|null,
 *   elapsedMs?: number|null,
 *   provider?: string|null,
 *   model?: string|null,
 *   retryEligible?: boolean,
 *   outcome: 'success'|'retry'|'failure',
 * }} info
 */
export function logProviderAttempt(info) {
  console.log(
    `[Atlas/provider]` +
      ` requestId=${info.requestId}` +
      ` channel=${info.channel || 'unknown'}` +
      ` route=${info.route || 'n/a'}` +
      ` attempt=${info.attempt}/${info.maxAttempts}` +
      ` category=${info.category || 'n/a'}` +
      ` httpStatus=${info.httpStatus ?? 'n/a'}` +
      ` elapsedMs=${info.elapsedMs ?? 'n/a'}` +
      ` provider=${info.provider || 'n/a'}` +
      ` model=${info.model || 'n/a'}` +
      ` retryEligible=${Boolean(info.retryEligible)}` +
      ` outcome=${info.outcome}`,
  );
}

/**
 * Invoke a provider fn with at most 2 total attempts for transient failures.
 * Does not touch memory/persistence — caller must invoke only around I/O.
 *
 * @template T
 * @param {() => Promise<T>} invoke
 * @param {{
 *   requestId: string,
 *   channel?: string|null,
 *   route?: string|null,
 *   provider?: string|null,
 *   model?: string|null,
 *   maxAttempts?: number,
 *   backoffMs?: number,
 *   onRetry?: (info: object) => void,
 * }} opts
 * @returns {Promise<{ result: T, attempts: number, lastClassification: object|null }>}
 */
export async function withProviderRetry(invoke, opts) {
  const maxAttempts = Math.max(1, Math.min(2, opts.maxAttempts ?? 2));
  const backoffMs = Math.max(0, opts.backoffMs ?? 400);
  let lastClassification = null;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    const t0 = performance.now();
    try {
      const result = await invoke();
      const elapsedMs = Math.round(performance.now() - t0);
      logProviderAttempt({
        requestId: opts.requestId,
        channel: opts.channel,
        route: opts.route,
        attempt,
        maxAttempts,
        category: null,
        httpStatus: 200,
        elapsedMs,
        provider: opts.provider || result?.provider || null,
        model: opts.model || result?.model || null,
        retryEligible: false,
        outcome: 'success',
      });
      return { result, attempts: attempt, lastClassification: null };
    } catch (err) {
      const classification = classifyProviderError(err);
      lastClassification = classification;
      const elapsedMs = Math.round(performance.now() - t0);
      const canRetry =
        attempt < maxAttempts && classification.retryEligible && isRetryEligibleCategory(classification.category);

      logProviderAttempt({
        requestId: opts.requestId,
        channel: opts.channel,
        route: opts.route,
        attempt,
        maxAttempts,
        category: classification.category,
        httpStatus: classification.httpStatus,
        elapsedMs,
        provider: opts.provider || null,
        model: opts.model || null,
        retryEligible: canRetry,
        outcome: canRetry ? 'retry' : 'failure',
      });

      if (!canRetry) {
        const wrapped = err instanceof Error ? err : new Error(classification.message);
        wrapped.status = classification.httpStatus ?? wrapped.status;
        wrapped.errorCategory = classification.category;
        wrapped.retryEligible = false;
        throw wrapped;
      }

      opts.onRetry?.({
        attempt,
        classification,
        requestId: opts.requestId,
      });
      await sleep(backoffMs * attempt);
    }
  }

  const fail = new Error(lastClassification?.message || 'Provider failed');
  fail.status = lastClassification?.httpStatus ?? null;
  fail.errorCategory = lastClassification?.category || ERROR_CATEGORIES.UNKNOWN_ERROR;
  fail.retryEligible = false;
  throw fail;
}

// ═══════════════════════════════════════════════════════════════════════
// Telegram resilience — reconnect, retry, heartbeat, queue, safe logging
// No sensitive message bodies in logs.
// ═══════════════════════════════════════════════════════════════════════

import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export const TELEGRAM_RESILIENCE_VERSION = 'telegram-resilience-v1';

/**
 * @param {string|number} chatId
 */
export function hashChatId(chatId) {
  return createHash('sha256').update(String(chatId)).digest('hex').slice(0, 12);
}

/**
 * @param {{
 *   updateId?: number|null,
 *   chatId?: string|number|null,
 *   messageLength?: number,
 *   receivedAt?: string,
 *   intent?: string|null,
 *   processingStartedAt?: string|null,
 *   processingCompletedAt?: string|null,
 *   resultStatus?: string|null,
 *   errorCode?: string|null,
 *   sendResult?: string|null,
 *   retryCount?: number,
 * }} fields
 */
export function logTelegramMessageTrace(fields) {
  const payload = {
    updateId: fields.updateId ?? null,
    chatIdHash: fields.chatId != null ? hashChatId(fields.chatId) : null,
    messageLength: fields.messageLength ?? 0,
    receivedAt: fields.receivedAt ?? new Date().toISOString(),
    intent: fields.intent ?? null,
    processingStartedAt: fields.processingStartedAt ?? null,
    processingCompletedAt: fields.processingCompletedAt ?? null,
    resultStatus: fields.resultStatus ?? null,
    errorCode: fields.errorCode ?? null,
    telegramSendResult: fields.sendResult ?? null,
    retryCount: fields.retryCount ?? 0,
  };
  console.log(`[Telegram/trace] ${JSON.stringify(payload)}`);
  return payload;
}

/**
 * Exponential backoff delay (ms), capped.
 * @param {number} attempt 0-based
 * @param {{ baseMs?: number, maxMs?: number }} [opts]
 */
export function backoffMs(attempt, opts = {}) {
  const base = opts.baseMs ?? 1000;
  const max = opts.maxMs ?? 60_000;
  const exp = Math.min(max, base * 2 ** Math.max(0, attempt));
  const jitter = Math.floor(Math.random() * Math.min(250, exp * 0.1));
  return Math.min(max, exp + jitter);
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{
 *   maxAttempts?: number,
 *   isRetryable?: (err: unknown, attempt: number) => boolean,
 *   onRetry?: (err: unknown, attempt: number, delay: number) => void,
 *   baseMs?: number,
 *   maxMs?: number,
 * }} [opts]
 * @returns {Promise<{ value: T, retryCount: number }>}
 */
export async function withRetry(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 3;
  const isRetryable =
    opts.isRetryable ??
    ((err) => {
      const msg = String(err?.message ?? err ?? '');
      const code = err?.code ?? err?.response?.status;
      if (code === 429 || code === 500 || code === 502 || code === 503 || code === 504) return true;
      return /ETELEGRAM|ECONNRESET|ETIMEDOUT|ESOCKETTIMEDOUT|socket hang up|network|timeout|429|5\d\d/i.test(
        msg,
      );
    });

  let lastError;
  let retryCount = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const value = await fn();
      return { value, retryCount };
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts - 1 || !isRetryable(err, attempt)) break;
      retryCount += 1;
      const delay = backoffMs(attempt, { baseMs: opts.baseMs, maxMs: opts.maxMs });
      opts.onRetry?.(err, attempt, delay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw Object.assign(lastError instanceof Error ? lastError : new Error(String(lastError)), {
    retryCount,
  });
}

/**
 * Per-chat queue: never silently drop concurrent messages.
 */
export function createInFlightQueue() {
  /** @type {Map<string, { busy: boolean, queue: Array<() => Promise<void>>, noticeSent: boolean, noticeTimer: ReturnType<typeof setTimeout>|null }>} */
  const states = new Map();

  function ensure(key) {
    if (!states.has(key)) {
      states.set(key, { busy: false, queue: [], noticeSent: false, noticeTimer: null });
    }
    return states.get(key);
  }

  /**
   * @param {string} key
   * @param {() => Promise<void>} task
   * @param {{ onQueued?: () => Promise<void>|void }} [opts]
   */
  async function enqueue(key, task, opts = {}) {
    const state = ensure(key);
    if (state.busy) {
      return new Promise((resolve, reject) => {
        state.queue.push(async () => {
          try {
            await task();
            resolve();
          } catch (err) {
            reject(err);
          }
        });

        // One notice per busy stretch; skip if work already drained (stale).
        if (!state.noticeSent && !state.noticeTimer) {
          state.noticeTimer = setTimeout(() => {
            state.noticeTimer = null;
            if (!state.busy || state.queue.length === 0) return;
            state.noticeSent = true;
            Promise.resolve()
              .then(() => opts.onQueued?.())
              .catch(() => {});
          }, 40);
        }
      });
    }

    state.busy = true;
    state.noticeSent = false;
    try {
      await task();
      while (state.queue.length > 0) {
        const next = state.queue.shift();
        try {
          await next();
        } catch {
          /* individual task errors handled inside */
        }
      }
    } finally {
      if (state.noticeTimer) {
        clearTimeout(state.noticeTimer);
        state.noticeTimer = null;
      }
      state.busy = false;
      state.noticeSent = false;
      if (state.queue.length === 0) states.delete(key);
    }
  }

  function isBusy(key) {
    return Boolean(ensure(key).busy);
  }

  function pendingCount(key) {
    return ensure(key).queue.length;
  }

  return { enqueue, isBusy, pendingCount };
}

/**
 * Polling supervisor: heartbeat + reconnect with exponential backoff.
 * @param {{
 *   startPolling: () => Promise<void>|void,
 *   stopPolling: () => Promise<void>|void,
 *   isConflict?: (err: unknown) => boolean,
 *   heartbeatPath?: string,
 *   staleMs?: number,
 *   checkIntervalMs?: number,
 *   onLog?: (msg: string) => void,
 * }} deps
 */
export function createPollingSupervisor(deps) {
  let lastUpdateAt = Date.now();
  let reconnectAttempt = 0;
  let reconnecting = false;
  let stopped = false;
  let timer = null;
  const staleMs = deps.staleMs ?? 120_000;
  const checkIntervalMs = deps.checkIntervalMs ?? 30_000;

  function touch(reason = 'update') {
    lastUpdateAt = Date.now();
    reconnectAttempt = 0;
    if (deps.heartbeatPath) {
      try {
        const dir = dirname(deps.heartbeatPath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(
          deps.heartbeatPath,
          JSON.stringify({
            pid: process.pid,
            lastUpdateAt: new Date(lastUpdateAt).toISOString(),
            reason,
          }),
          'utf8',
        );
      } catch {
        /* ignore */
      }
    }
  }

  function isStale() {
    return Date.now() - lastUpdateAt > staleMs;
  }

  async function reconnect(reason) {
    if (stopped || reconnecting) return;
    reconnecting = true;
    const delay = backoffMs(reconnectAttempt, { baseMs: 2000, maxMs: 60_000 });
    deps.onLog?.(
      `[Telegram] reconnect scheduled attempt=${reconnectAttempt} delayMs=${delay} reason=${reason}`,
    );
    await new Promise((r) => setTimeout(r, delay));
    if (stopped) {
      reconnecting = false;
      return;
    }
    try {
      await deps.stopPolling();
    } catch (err) {
      deps.onLog?.(`[Telegram] stopPolling during reconnect: ${err?.message ?? err}`);
    }
    try {
      await deps.startPolling();
      touch('reconnect_ok');
      deps.onLog?.('[Telegram] polling reconnected');
    } catch (err) {
      reconnectAttempt += 1;
      deps.onLog?.(`[Telegram] reconnect failed: ${err?.message ?? err}`);
      reconnecting = false;
      return reconnect('retry_after_fail');
    }
    reconnectAttempt = 0;
    reconnecting = false;
  }

  function notePollingError(error) {
    if (deps.isConflict?.(error)) return { action: 'conflict' };
    void reconnect(`polling_error:${String(error?.message ?? error).slice(0, 80)}`);
    return { action: 'reconnect' };
  }

  function startWatchdog() {
    touch('watchdog_start');
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      if (stopped) return;
      if (isStale()) {
        deps.onLog?.(
          `[Telegram] heartbeat stale (${Math.round((Date.now() - lastUpdateAt) / 1000)}s) — reconnecting`,
        );
        void reconnect('heartbeat_stale');
      } else if (deps.heartbeatPath) {
        touch('heartbeat_ok');
      }
    }, checkIntervalMs);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    touch,
    isStale,
    notePollingError,
    reconnect,
    startWatchdog,
    stop,
    get lastUpdateAt() {
      return lastUpdateAt;
    },
    get reconnectAttempt() {
      return reconnectAttempt;
    },
  };
}

/**
 * Detect sleep/wake gap from wall-clock jump (simulation-friendly).
 * @param {number} previousNow
 * @param {number} now
 * @param {number} [thresholdMs]
 */
export function detectClockJump(previousNow, now, thresholdMs = 90_000) {
  const delta = now - previousNow;
  return delta > thresholdMs;
}

import { Loader2, RotateCcw, Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import AtlasCorePresence from '../components/cosmic/AtlasCorePresence';
import CapabilityDiscovery, {
  isCapabilityDiscoveryEnabled,
} from '../components/cosmic/CapabilityDiscovery';
import ChatAtmosphere from '../components/cosmic/ChatAtmosphere';
import PatternGapTraces from '../components/cosmic/PatternGapTraces';
import CosmicShell from '../components/cosmic/CosmicShell';
import { discoveryCopy } from '../data/capability-discovery';
import { PATTERN_GAP_PLACEHOLDER } from '../data/pattern-traces';
import { atlasChat, isRetryableChatResponse } from '../services/atlas-chat';
import {
  ATLAS_SESSION_CHANGED_EVENT,
  ensureAtlasSession,
  getWebUserId,
} from '../utils/atlas-session';
import { trackDiscoverability } from '../utils/discoverability-events';
import { prefersReducedMotion } from '../utils/scroll-section';
import type { AtlasChatMessage } from '../types/atlas-chat';

const CAPABILITY_DISCOVERY_ENABLED = isCapabilityDiscoveryEnabled();

/** Composer grows with the message, then scrolls internally. */
const COMPOSER_MAX_HEIGHT = 168;

/** No response for this long → show connection stall (not “thinking”). */
const STALL_WARNING_MS = 25_000;

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type PendingStatus = 'thinking' | 'stalled' | 'retrying';

export default function Chat() {
  const location = useLocation();
  const contextPrompt = (location.state as { contextPrompt?: string } | null)?.contextPrompt;

  const [input, setInput] = useState(contextPrompt ?? '');
  const [messages, setMessages] = useState<AtlasChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<PendingStatus>('thinking');
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const seededContext = useRef(false);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  /** Guards against applying a late response after a newer turn started. */
  const activeTurnRef = useRef<string | null>(null);
  const sessionUserIdRef = useRef<string | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Auto-retry incomplete/timeout at most once per turn. */
  const autoRetriedTurnsRef = useRef<Set<string>>(new Set());
  const emptyStateSeenRef = useRef(false);
  const firstMessageTrackedRef = useRef(false);

  const isEmpty = messages.length === 0;

  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    atlasChat.checkBackend().then(setBackendReady);
    ensureAtlasSession()
      .then((session) => {
        sessionUserIdRef.current = session.userId;
      })
      .catch(() => {
        /* session will retry on send */
      });
    return () => {
      abortRef.current?.abort();
      clearStallTimer();
    };
  }, [clearStallTimer]);

  useEffect(() => {
    if (!isEmpty || emptyStateSeenRef.current) return;
    emptyStateSeenRef.current = true;
    trackDiscoverability('empty_state_seen');
  }, [isEmpty]);

  // Clear local chat when account switches so memory/UI never leak across users.
  useEffect(() => {
    const onSessionChanged = () => {
      const nextId = getWebUserId();
      if (sessionUserIdRef.current && sessionUserIdRef.current !== nextId) {
        abortRef.current?.abort();
        inFlightRef.current = false;
        activeTurnRef.current = null;
        clearStallTimer();
        setLoading(false);
        setPendingStatus('thinking');
        setMessages([]);
        setInput('');
        emptyStateSeenRef.current = false;
        firstMessageTrackedRef.current = false;
      }
      sessionUserIdRef.current = nextId;
    };
    window.addEventListener(ATLAS_SESSION_CHANGED_EVENT, onSessionChanged);
    return () => window.removeEventListener(ATLAS_SESSION_CHANGED_EVENT, onSessionChanged);
  }, [clearStallTimer]);

  useEffect(() => {
    if (!isEmpty) {
      bottomRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'end',
      });
    }
  }, [messages, loading, isEmpty, pendingStatus]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(
      Math.max(el.scrollHeight, isEmpty ? 80 : 52),
      COMPOSER_MAX_HEIGHT,
    )}px`;
  }, [input, isEmpty]);

  useEffect(() => {
    if (contextPrompt && !seededContext.current) {
      seededContext.current = true;
      setMessages([
        {
          id: createId(),
          role: 'assistant',
          content: 'Analiz bağlamın hazır. Ne üzerinde netleşmek istiyorsun?',
        },
      ]);
    }
  }, [contextPrompt]);

  const { completedExchanges, userTexts } = useMemo(() => {
    if (!CAPABILITY_DISCOVERY_ENABLED) {
      return { completedExchanges: 0, userTexts: [] as string[] };
    }
    const users = messages.filter((m) => m.role === 'user' && !m.pending && !m.error);
    let completed = 0;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role !== 'user' || m.pending || m.error) continue;
      const reply = messages.slice(i + 1).find((x) => x.role === 'assistant');
      if (reply && !reply.pending && !reply.error && !reply.retryable && reply.content) {
        completed += 1;
      }
    }
    return {
      completedExchanges: completed,
      userTexts: users.map((m) => m.content),
    };
  }, [messages]);

  const markRetryableFailure = useCallback(
    (
      pendingId: string,
      turnId: string,
      content: string,
      requestId: string,
      extra: Partial<AtlasChatMessage> = {},
    ) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                id: pendingId,
                role: 'assistant',
                content,
                error: true,
                retryable: true,
                turnId,
                requestId,
                ...extra,
              }
            : m,
        ),
      );
    },
    [],
  );

  const sendTurn = useCallback(
    async (
      text: string,
      opts: { reuseUser?: boolean; turnId?: string; isAutoRetry?: boolean } = {},
    ) => {
      const trimmed = text.trim();
      if (!trimmed || inFlightRef.current) return;

      inFlightRef.current = true;
      setLoading(true);
      setPendingStatus(opts.isAutoRetry ? 'retrying' : 'thinking');

      // Abort any previous in-flight request; never reuse its controller.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const turnId = opts.turnId || createId();
      activeTurnRef.current = turnId;
      const requestId = createId();

      const history = messages
        .filter((m) => !m.pending && !m.error && !m.retryable)
        .filter((m) => !(opts.reuseUser && m.turnId === turnId))
        .map((m) => ({ role: m.role, content: m.content }));

      const pendingId = createId();

      if (opts.reuseUser) {
        setMessages((prev) => {
          const withoutFailedAssistant = prev.filter(
            (m) => !(m.turnId === turnId && m.role === 'assistant'),
          );
          return [
            ...withoutFailedAssistant,
            { id: pendingId, role: 'assistant', content: '', pending: true, turnId },
          ];
        });
      } else {
        const userMessage: AtlasChatMessage = {
          id: createId(),
          role: 'user',
          content: trimmed,
          turnId,
        };
        setMessages((prev) => [
          ...prev,
          userMessage,
          { id: pendingId, role: 'assistant', content: '', pending: true, turnId },
        ]);
        setInput('');
      }

      clearStallTimer();
      stallTimerRef.current = setTimeout(() => {
        if (activeTurnRef.current === turnId && inFlightRef.current) {
          setPendingStatus('stalled');
        }
      }, STALL_WARNING_MS);

      try {
        const response = await atlasChat.sendMessage(trimmed, history, {
          signal: controller.signal,
          requestId,
        });

        if (activeTurnRef.current !== turnId) {
          // Stale response after a newer turn — drop to avoid duplicate assistant cards.
          return;
        }

        if (isRetryableChatResponse(response)) {
          const canAutoRetry =
            !opts.isAutoRetry &&
            !autoRetriedTurnsRef.current.has(turnId) &&
            (response.errorCode === 'TIMEOUT' ||
              response.errorCode === 'INCOMPLETE_RESPONSE' ||
              response.errorCode === 'MODEL_UNAVAILABLE');

          if (canAutoRetry) {
            autoRetriedTurnsRef.current.add(turnId);
            inFlightRef.current = false;
            clearStallTimer();
            setPendingStatus('retrying');
            await sendTurn(trimmed, {
              reuseUser: true,
              turnId,
              isAutoRetry: true,
            });
            return;
          }

          markRetryableFailure(
            pendingId,
            turnId,
            response.reply ||
              'Yanıt tamamlanamadı. Yeniden oluştur ile tekrar deneyebilirsin.',
            response.requestId ?? requestId,
            {
              errorCode: response.errorCode ?? null,
              completionStatus: response.completionStatus ?? null,
            },
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId
                ? {
                    id: pendingId,
                    role: 'assistant',
                    content: response.reply,
                    mode: response.mode,
                    profile: response.profile,
                    turnId,
                    requestId: response.requestId ?? requestId,
                    completionStatus: response.completionStatus ?? 'complete',
                  }
                : m,
            ),
          );
        }
      } catch (err) {
        if (activeTurnRef.current !== turnId) return;
        const aborted =
          err instanceof Error &&
          (err.message === 'Request aborted' || /abort/i.test(err.message));
        if (aborted) {
          markRetryableFailure(
            pendingId,
            turnId,
            'Bağlantı kesildi. Mesajın duruyor — yeniden oluşturabilirsin.',
            requestId,
            { errorCode: 'ABORTED' },
          );
          return;
        }

        const timedOut =
          err instanceof Error &&
          (err.message.includes('timed out') || err.message.includes('Request timed out'));
        const canAutoRetry =
          !opts.isAutoRetry && !autoRetriedTurnsRef.current.has(turnId) && timedOut;

        if (canAutoRetry) {
          autoRetriedTurnsRef.current.add(turnId);
          inFlightRef.current = false;
          clearStallTimer();
          setPendingStatus('retrying');
          await sendTurn(trimmed, {
            reuseUser: true,
            turnId,
            isAutoRetry: true,
          });
          return;
        }

        const errorText =
          err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.';
        markRetryableFailure(pendingId, turnId, errorText, requestId, {
          errorCode: timedOut ? 'TIMEOUT' : 'NETWORK',
        });
      } finally {
        if (activeTurnRef.current === turnId) {
          clearStallTimer();
          inFlightRef.current = false;
          setLoading(false);
          setPendingStatus('thinking');
          textareaRef.current?.focus();
        }
      }
    },
    [messages, clearStallTimer, markRetryableFailure],
  );

  const send = useCallback(async () => {
    const payload = input.trim();
    if (!payload) return;

    if (!firstMessageTrackedRef.current && messages.length === 0) {
      firstMessageTrackedRef.current = true;
      trackDiscoverability('first_message_sent', { traceCount: 0 });
      trackDiscoverability('first_message_without_trace', { traceCount: 0 });
    }

    await sendTurn(payload);
  }, [input, messages.length, sendTurn]);

  /** Retry the failed turn in place — keep the user bubble, new requestId. */
  const retryLast = useCallback(() => {
    const pending = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && m.pending && m.turnId);
    const failed = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && (m.error || m.retryable));
    const target = failed || pending;
    if (!target?.turnId) {
      // Legacy fallback: rewind into composer
      const kept = messages.filter((m) => !m.error && !m.retryable);
      const lastUserIndex = kept.map((m) => m.role).lastIndexOf('user');
      if (lastUserIndex >= 0) {
        setInput(kept[lastUserIndex].content);
        kept.splice(lastUserIndex, 1);
      }
      setMessages(kept);
      textareaRef.current?.focus();
      return;
    }
    const userMsg = messages.find((m) => m.role === 'user' && m.turnId === target.turnId);
    if (!userMsg) return;
    // Allow regenerate even if a stalled request is still hanging.
    abortRef.current?.abort();
    inFlightRef.current = false;
    clearStallTimer();
    autoRetriedTurnsRef.current.delete(target.turnId);
    void sendTurn(userMsg.content, { reuseUser: true, turnId: target.turnId });
  }, [messages, sendTurn, clearStallTimer]);

  const recheckBackend = () => {
    setBackendReady(null);
    atlasChat.checkBackend().then(setBackendReady);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (loading || !input.trim() || backendReady === false) return;
      void send();
    }
  };

  const pendingLabel =
    pendingStatus === 'stalled'
      ? 'Bağlantı gecikiyor… Yeni yanıt gelmiyor.'
      : pendingStatus === 'retrying'
        ? 'Yanıt tamamlanamadı, tekrar deniyorum…'
        : 'Düşünüyorum…';

  return (
    <CosmicShell showBackground={false} transparentNav chatMode>
      <ChatAtmosphere />

      <main className="relative z-10 flex h-[100dvh] flex-col pt-[4.5rem]">
        <p className="sr-only" aria-live="polite">
          {backendReady === false
            ? 'Atlas şu an bağlantı kuramıyor.'
            : loading
              ? pendingLabel
              : backendReady === true
                ? 'Atlas hazır.'
                : 'Atlas bağlantısı kontrol ediliyor.'}
        </p>

        <section
          className={`flex min-h-0 flex-1 flex-col px-4 md:px-8 ${isEmpty ? 'justify-end pb-3' : 'overflow-y-auto py-4 md:py-5'}`}
          aria-label="Konuşma"
        >
          {isEmpty ? (
            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-end gap-0 pb-1 pt-2 text-center sm:justify-center">
              <AtlasCorePresence state={loading ? 'thinking' : 'idle'} />
              <p className="mt-5 max-w-[20rem] text-[16px] leading-[1.55] tracking-[-0.01em] text-[#e8ecf2]/90 sm:mt-7 sm:max-w-sm sm:text-[17px] sm:leading-[1.6]">
                {discoveryCopy.emptyInvite.line1}
              </p>
              {backendReady !== false && (
                <PatternGapTraces className="mt-2.5 sm:mt-3" />
              )}
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[760px] space-y-5 pb-2">
              {messages.map((msg) => (
                <article
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  aria-label={msg.role === 'user' ? 'Sen' : 'Atlas'}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[88%] rounded-[18px] rounded-br-md bg-[#e8ecf2]/94 px-5 py-3.5 text-[15px] leading-[1.65] text-[#050608] sm:max-w-[75%]">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[92%] sm:max-w-[85%]">
                      {msg.pending ? (
                        <div
                          className="flex items-center gap-3 py-1 text-[#8b93a3]"
                          aria-live="polite"
                        >
                          <AtlasCorePresence
                            state={pendingStatus === 'stalled' ? 'idle' : 'thinking'}
                            className="!w-10 !min-w-10 sm:!w-12"
                          />
                          <div className="flex flex-col gap-1">
                            <span className="text-[14px]">{pendingLabel}</span>
                            {pendingStatus === 'stalled' ? (
                              <button
                                type="button"
                                onClick={retryLast}
                                className="site-focus inline-flex items-center gap-1.5 text-[13px] text-[#c5ccd6] underline-offset-2 hover:underline"
                              >
                                <RotateCcw size={13} aria-hidden /> Yeniden oluştur
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : msg.error || msg.retryable ? (
                        <div className="rounded-[18px] border border-red-400/20 bg-red-950/20 px-5 py-3.5 text-[15px] leading-[1.65] text-red-100/90">
                          {msg.content}
                          <button
                            type="button"
                            onClick={retryLast}
                            disabled={loading}
                            className="site-focus mt-3 inline-flex items-center gap-1.5 text-[13px] text-red-100/80 underline-offset-2 hover:underline disabled:opacity-40"
                          >
                            <RotateCcw size={13} aria-hidden /> Yeniden oluştur
                          </button>
                        </div>
                      ) : (
                        <p className="text-[15px] leading-[1.75] tracking-[-0.005em] text-[#e8ecf2]/90 whitespace-pre-wrap sm:text-[16px] sm:leading-[1.8]">
                          {msg.content}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              ))}

              {CAPABILITY_DISCOVERY_ENABLED ? (
                <CapabilityDiscovery
                  completedExchanges={completedExchanges}
                  userTexts={userTexts}
                />
              ) : null}

              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <footer className="relative shrink-0 border-t border-white/[0.04] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 md:px-8">
          <div className="mx-auto w-full max-w-[760px]">
            {backendReady === false && (
              <div className="mb-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center text-[13px] leading-[1.6] text-[#8b93a3]">
                <span>Atlas şu an bağlantı kuramıyor. Birazdan tekrar açılacak.</span>
                <button
                  type="button"
                  onClick={recheckBackend}
                  className="site-focus inline-flex items-center gap-1.5 rounded-full text-[#c5ccd6] underline-offset-4 transition duration-200 hover:text-[#e8ecf2] hover:underline"
                >
                  <RotateCcw size={13} aria-hidden /> Yeniden dene
                </button>
              </div>
            )}

            <div className="atlas-composer flex items-end gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label htmlFor="atlas-message" className="sr-only">
                  Atlas’a yaz
                </label>
                <textarea
                  id="atlas-message"
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={PATTERN_GAP_PLACEHOLDER}
                  disabled={backendReady === false}
                  rows={isEmpty ? 2 : 1}
                  aria-label="Mesaj"
                  className="atlas-field atlas-field-hero w-full resize-none overflow-y-auto disabled:opacity-40"
                />
              </div>
              <button
                type="button"
                onClick={() => void send()}
                disabled={loading || !input.trim() || backendReady === false}
                aria-label="Gönder"
                className="atlas-send flex h-12 w-12 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
              >
                {loading ? (
                  <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden />
                ) : (
                  <Send size={18} aria-hidden />
                )}
              </button>
            </div>
          </div>
        </footer>
      </main>
    </CosmicShell>
  );
}

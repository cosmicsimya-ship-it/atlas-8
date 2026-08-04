import { Loader2, RotateCcw, Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import AtlasCorePresence from '../components/cosmic/AtlasCorePresence';
import CapabilityDiscovery from '../components/cosmic/CapabilityDiscovery';
import ChatAtmosphere from '../components/cosmic/ChatAtmosphere';
import ChatInvitations, {
  type ChatInvitation,
} from '../components/cosmic/ChatInvitations';
import CosmicShell from '../components/cosmic/CosmicShell';
import { discoveryCopy } from '../data/capability-discovery';
import { atlasChat, isRetryableChatResponse } from '../services/atlas-chat';
import { ensureAtlasSession } from '../utils/atlas-session';
import { prefersReducedMotion } from '../utils/scroll-section';
import type { AtlasChatMessage } from '../types/atlas-chat';

/** Composer grows with the message, then scrolls internally. */
const COMPOSER_MAX_HEIGHT = 168;

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function Chat() {
  const location = useLocation();
  const contextPrompt = (location.state as { contextPrompt?: string } | null)?.contextPrompt;

  const [input, setInput] = useState(contextPrompt ?? '');
  const [messages, setMessages] = useState<AtlasChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const seededContext = useRef(false);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  /** Guards against applying a late response after a newer turn started. */
  const activeTurnRef = useRef<string | null>(null);

  const isEmpty = messages.length === 0;

  useEffect(() => {
    atlasChat.checkBackend().then(setBackendReady);
    ensureAtlasSession().catch(() => {
      /* session will retry on send */
    });
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isEmpty) {
      bottomRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'end',
      });
    }
  }, [messages, loading, isEmpty]);

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

  const sendTurn = useCallback(
    async (text: string, opts: { reuseUser?: boolean; turnId?: string } = {}) => {
      const trimmed = text.trim();
      if (!trimmed || inFlightRef.current) return;

      inFlightRef.current = true;
      setLoading(true);

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
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId
                ? {
                    id: pendingId,
                    role: 'assistant',
                    content: response.reply,
                    error: true,
                    retryable: true,
                    turnId,
                    requestId: response.requestId ?? requestId,
                  }
                : m,
            ),
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
                  }
                : m,
            ),
          );
        }
      } catch (err) {
        if (activeTurnRef.current !== turnId) return;
        const errorText =
          err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu.';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  id: pendingId,
                  role: 'assistant',
                  content: errorText,
                  error: true,
                  retryable: true,
                  turnId,
                }
              : m,
          ),
        );
      } finally {
        if (activeTurnRef.current === turnId) {
          inFlightRef.current = false;
          setLoading(false);
          textareaRef.current?.focus();
        }
      }
    },
    [messages],
  );

  const send = useCallback(async () => {
    await sendTurn(input);
  }, [input, sendTurn]);

  /** Retry the failed turn in place — keep the user bubble, new requestId. */
  const retryLast = useCallback(() => {
    const failed = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && (m.error || m.retryable));
    if (!failed?.turnId) {
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
    const userMsg = messages.find((m) => m.role === 'user' && m.turnId === failed.turnId);
    if (!userMsg) return;
    void sendTurn(userMsg.content, { reuseUser: true, turnId: failed.turnId });
  }, [messages, sendTurn]);

  const recheckBackend = () => {
    setBackendReady(null);
    atlasChat.checkBackend().then(setBackendReady);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const handleInvitation = (invitation: ChatInvitation) => {
    if (invitation.prompt) {
      setInput(invitation.prompt);
    }
    textareaRef.current?.focus();
  };

  return (
    <CosmicShell showBackground={false} transparentNav chatMode>
      <ChatAtmosphere />

      <main className="relative z-10 flex h-[100dvh] flex-col pt-[4.5rem]">
        <p className="sr-only" aria-live="polite">
          {backendReady === false
            ? 'Atlas şu an bağlantı kuramıyor.'
            : backendReady === true
              ? 'Atlas hazır.'
              : 'Atlas bağlantısı kontrol ediliyor.'}
        </p>

        <section
          className={`flex min-h-0 flex-1 flex-col px-4 md:px-8 ${isEmpty ? 'justify-end pb-3' : 'overflow-y-auto py-4 md:py-5'}`}
          aria-label="Konuşma"
        >
          {isEmpty ? (
            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-0 pb-2 pt-2 text-center">
              <AtlasCorePresence state={loading ? 'thinking' : 'idle'} />
              <p className="mt-8 max-w-[16rem] text-[16px] leading-[1.7] tracking-[-0.01em] text-[#c5ccd6] sm:mt-9 sm:max-w-sm sm:text-[17px]">
                {discoveryCopy.emptyInvite.line1}
                <br />
                <span className="text-[#e8ecf2]/90">{discoveryCopy.emptyInvite.line2}</span>
              </p>
              {backendReady !== false && (
                <ChatInvitations
                  onSelect={handleInvitation}
                  className="mt-8 max-w-xl sm:mt-9"
                />
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
                        <div className="flex items-center gap-3 py-1 text-[#8b93a3]" aria-live="polite">
                          <AtlasCorePresence
                            state="thinking"
                            className="!w-10 !min-w-10 sm:!w-12"
                          />
                          <span className="text-[14px]">Düşünüyorum…</span>
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
                            <RotateCcw size={13} aria-hidden /> Tekrar dene
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

              <CapabilityDiscovery
                completedExchanges={completedExchanges}
                userTexts={userTexts}
              />

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
              <label htmlFor="atlas-message" className="sr-only">
                Atlas’a yaz
              </label>
              <textarea
                id="atlas-message"
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isEmpty ? 'Buradan yazmaya başla…' : 'Ne üzerinde düşünelim?'}
                disabled={loading || backendReady === false}
                rows={isEmpty ? 2 : 1}
                aria-label="Mesaj"
                className="atlas-field atlas-field-hero flex-1 resize-none overflow-y-auto disabled:opacity-40"
              />
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

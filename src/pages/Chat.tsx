import { History, ImagePlus, Loader2, PlusCircle, RotateCcw, Send, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import AtlasCorePresence from '../components/cosmic/AtlasCorePresence';
import CapabilityDiscovery, {
  isCapabilityDiscoveryEnabled,
} from '../components/cosmic/CapabilityDiscovery';
import ChatAtmosphere from '../components/cosmic/ChatAtmosphere';
import ConversationHistoryPanel from '../components/cosmic/ConversationHistoryPanel';
import PatternGapTraces from '../components/cosmic/PatternGapTraces';
import CosmicShell from '../components/cosmic/CosmicShell';
import ResponseThumbs from '../components/cosmic/ResponseThumbs';
import { discoveryCopy } from '../data/capability-discovery';
import { PATTERN_GAP_PLACEHOLDER } from '../data/pattern-traces';
import { atlasChat, isRetryableChatResponse } from '../services/atlas-chat';
import { fetchEntitlements, hasEntitlement } from '../services/atlas-entitlements';
import {
  ATLAS_SESSION_CHANGED_EVENT,
  ensureAtlasSession,
  getWebUserId,
} from '../utils/atlas-session';
import { trackDiscoverability } from '../utils/discoverability-events';
import { prefersReducedMotion } from '../utils/scroll-section';
import type {
  AtlasChatMessage,
  AtlasConversationSummary,
  AtlasImageAttachment,
} from '../types/atlas-chat';

/** Marks an intentional empty "new chat" so a refresh doesn't silently restore the old thread. */
const NEW_CHAT_INTENT_KEY = 'atlas_new_chat_pending';

/** Mirrors server/entitlements/image-guard.js — client-side pre-check only, server is authoritative. */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 6_000_000;

type PendingImage = { previewUrl: string; mimeType: string; base64: string };

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
  const [canImageAnalysis, setCanImageAnalysis] = useState<boolean | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [restoringHistory, setRestoringHistory] = useState(false);
  const [historyEligible, setHistoryEligible] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [conversations, setConversations] = useState<AtlasConversationSummary[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const discoveryUsedRef = useRef(false);

  const isEmpty = messages.length === 0;

  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const clearPendingImage = useCallback(() => {
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const applyConversation = useCallback((conversation: {
    id: string;
    messages: { id: string; role: 'user' | 'assistant'; content: string }[];
  }) => {
    abortRef.current?.abort();
    inFlightRef.current = false;
    activeTurnRef.current = null;
    clearStallTimer();
    setLoading(false);
    setPendingStatus('thinking');
    setMessages(conversation.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })));
    setActiveConversationId(conversation.id);
    setInput('');
    clearPendingImage();
    emptyStateSeenRef.current = false;
    firstMessageTrackedRef.current = false;
    discoveryUsedRef.current = false;
    if (typeof window !== 'undefined') sessionStorage.removeItem(NEW_CHAT_INTENT_KEY);
  }, [clearStallTimer, clearPendingImage]);

  const restoreLatestConversation = useCallback(async () => {
    setRestoringHistory(true);
    try {
      const list = await atlasChat.listConversations();
      const latest = list[0];
      if (!latest) return;
      const conversation = await atlasChat.getConversation(latest.id);
      if (!conversation) return;
      applyConversation(conversation);
    } catch {
      /* restore is best-effort UX — a fresh chat is a safe fallback */
    } finally {
      setRestoringHistory(false);
    }
  }, [applyConversation]);

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const list = await atlasChat.listConversations();
      setConversations(list);
    } catch {
      /* history list is best-effort UX */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const selectConversation = useCallback(
    async (id: string) => {
      setHistoryOpen(false);
      if (id === activeConversationId) return;
      try {
        const conversation = await atlasChat.getConversation(id);
        if (!conversation) return;
        applyConversation(conversation);
      } catch {
        /* selection is best-effort UX — stays on current conversation */
      }
    },
    [activeConversationId, applyConversation],
  );

  useEffect(() => {
    atlasChat.checkBackend().then(setBackendReady);
    ensureAtlasSession()
      .then((session) => {
        sessionUserIdRef.current = session.userId;
        const eligible = session.authenticated && !session.isAnonymous;
        setHistoryEligible(eligible);
        // Conversation restore — authenticated accounts only, and only when
        // there's no analysis-flow context prompt already seeding the chat,
        // and the user didn't just explicitly start a new chat (refresh-safe).
        const hasNewChatIntent =
          typeof window !== 'undefined' && sessionStorage.getItem(NEW_CHAT_INTENT_KEY) === '1';
        if (eligible && !contextPrompt && !hasNewChatIntent) {
          void restoreLatestConversation();
        }
      })
      .catch(() => {
        /* session will retry on send */
      });
    fetchEntitlements()
      .then((ent) => setCanImageAnalysis(hasEntitlement(ent, 'image.analysis')))
      .catch(() => setCanImageAnalysis(false)); // fail closed — UI never assumes access
    return () => {
      abortRef.current?.abort();
      clearStallTimer();
    };
  }, [clearStallTimer, contextPrompt, restoreLatestConversation]);

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
        setActiveConversationId(null);
        emptyStateSeenRef.current = false;
        firstMessageTrackedRef.current = false;
        discoveryUsedRef.current = false;
        setPendingImage((prev) => {
          if (prev) URL.revokeObjectURL(prev.previewUrl);
          return null;
        });
        setImageError(null);
        setHistoryOpen(false);
        setConversations([]);
        if (typeof window !== 'undefined') sessionStorage.removeItem(NEW_CHAT_INTENT_KEY);
        fetchEntitlements()
          .then((ent) => setCanImageAnalysis(hasEntitlement(ent, 'image.analysis')))
          .catch(() => setCanImageAnalysis(false));

        // Old account's state is fully cleared above before this point —
        // now load the NEW account's own latest conversation, if any.
        ensureAtlasSession()
          .then((session) => {
            const eligible = session.authenticated && !session.isAnonymous;
            setHistoryEligible(eligible);
            if (eligible) {
              void restoreLatestConversation();
            }
          })
          .catch(() => {
            /* stays empty — safe fallback */
          });
      }
      sessionUserIdRef.current = nextId;
    };
    window.addEventListener(ATLAS_SESSION_CHANGED_EVENT, onSessionChanged);
    return () => window.removeEventListener(ATLAS_SESSION_CHANGED_EVENT, onSessionChanged);
  }, [clearStallTimer, restoreLatestConversation]);

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

  const onImageSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setImageError(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Yalnızca JPG, PNG veya WEBP görseller desteklenir.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(`Görsel çok büyük (maks. ${Math.round(MAX_IMAGE_BYTES / 1_000_000)}MB).`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.split(',')[1] || '';
      if (!base64) {
        setImageError('Görsel okunamadı.');
        return;
      }
      setPendingImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return { previewUrl: URL.createObjectURL(file), mimeType: file.type, base64 };
      });
    };
    reader.onerror = () => setImageError('Görsel okunamadı.');
    reader.readAsDataURL(file);
  }, []);

  const sendTurn = useCallback(
    async (
      text: string,
      opts: {
        reuseUser?: boolean;
        turnId?: string;
        isAutoRetry?: boolean;
        image?: AtlasImageAttachment;
        requestId?: string;
      } = {},
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
      const requestId = opts.requestId || createId();

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
            { id: pendingId, role: 'assistant', content: '', pending: true, turnId, requestId },
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
          { id: pendingId, role: 'assistant', content: '', pending: true, turnId, requestId },
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
          ...(opts.image ? { image: opts.image } : {}),
          ...(activeConversationId ? { conversationId: activeConversationId } : {}),
        });

        if (activeTurnRef.current !== turnId) {
          // Stale response after a newer turn — drop to avoid duplicate assistant cards.
          return;
        }

        if (response.conversationId && response.conversationId !== activeConversationId) {
          setActiveConversationId(response.conversationId);
          if (typeof window !== 'undefined') sessionStorage.removeItem(NEW_CHAT_INTENT_KEY);
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
              image: opts.image,
              requestId,
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
            image: opts.image,
            requestId,
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
    [messages, clearStallTimer, markRetryableFailure, activeConversationId],
  );

  const send = useCallback(async () => {
    const payload = input.trim();
    if (!payload) return;

    if (!firstMessageTrackedRef.current && messages.length === 0) {
      firstMessageTrackedRef.current = true;
      const usedDiscovery = discoveryUsedRef.current;
      trackDiscoverability('first_message_sent', { usedDiscovery });
      trackDiscoverability(
        usedDiscovery ? 'first_message_with_discovery' : 'first_message_without_discovery',
        { usedDiscovery },
      );
    }

    const image = pendingImage
      ? { mimeType: pendingImage.mimeType, base64: pendingImage.base64 }
      : undefined;
    clearPendingImage();
    await sendTurn(payload, { image });
  }, [input, messages.length, sendTurn, pendingImage, clearPendingImage]);

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
    void sendTurn(userMsg.content, {
      reuseUser: true,
      turnId: target.turnId,
      requestId: target.requestId ?? undefined,
    });
  }, [messages, sendTurn, clearStallTimer]);

  const recheckBackend = () => {
    setBackendReady(null);
    atlasChat.checkBackend().then(setBackendReady);
  };

  const startNewConversation = useCallback(() => {
    abortRef.current?.abort();
    inFlightRef.current = false;
    activeTurnRef.current = null;
    clearStallTimer();
    setLoading(false);
    setPendingStatus('thinking');
    setMessages([]);
    setInput('');
    setActiveConversationId(null);
    clearPendingImage();
    emptyStateSeenRef.current = false;
    firstMessageTrackedRef.current = false;
    discoveryUsedRef.current = false;
    setHistoryOpen(false);
    // No conversation id yet — flag this so a refresh before the first
    // message doesn't silently restore the previous thread out from under it.
    if (typeof window !== 'undefined') sessionStorage.setItem(NEW_CHAT_INTENT_KEY, '1');
    textareaRef.current?.focus();
  }, [clearStallTimer, clearPendingImage]);

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

        {historyEligible && (
          <div className="flex items-center px-4 pt-1 md:px-8">
            <button
              type="button"
              onClick={() => (historyOpen ? setHistoryOpen(false) : void openHistory())}
              aria-expanded={historyOpen}
              aria-controls="atlas-history-panel"
              className="site-focus inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-[#9aa3b2] transition hover:border-white/20 hover:text-[#e8ecf2]"
            >
              <History size={13} aria-hidden /> Sohbetler
            </button>
          </div>
        )}

        <ConversationHistoryPanel
          open={historyOpen}
          loading={historyLoading}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onClose={() => setHistoryOpen(false)}
          onNewChat={startNewConversation}
          onSelect={(id) => void selectConversation(id)}
        />

        <section
          className={`flex min-h-0 flex-1 flex-col px-4 md:px-8 ${isEmpty ? 'justify-end pb-3' : 'overflow-y-auto py-4 md:py-5'}`}
          aria-label="Konuşma"
        >
          {restoringHistory ? (
            <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center">
              <p className="text-[13px] text-[#8b93a3]" aria-live="polite">
                Sohbet geçmişin yükleniyor…
              </p>
            </div>
          ) : isEmpty ? (
            <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col items-center justify-end gap-0 overflow-y-auto pb-2 pt-6 text-center sm:justify-center sm:pt-2">
              <p className="max-w-[20rem] text-[16px] leading-[1.55] tracking-[-0.01em] text-[#e8ecf2]/92 sm:max-w-sm sm:text-[17px] sm:leading-[1.6]">
                {discoveryCopy.emptyInvite.line1}
              </p>
              {backendReady !== false && (
                <PatternGapTraces
                  className="mt-5 mb-1 sm:mt-6 sm:mb-2"
                  onSelect={(question, composerText) => {
                    discoveryUsedRef.current = true;
                    setInput(composerText);
                    trackDiscoverability('discovery_question_selected', {
                      id: question.id,
                    });
                    requestAnimationFrame(() => {
                      const el = textareaRef.current;
                      if (!el) return;
                      el.focus();
                      const len = composerText.length;
                      el.setSelectionRange(len, len);
                    });
                  }}
                />
              )}
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[760px] space-y-5 pb-2">
              <div className="flex justify-end pb-1">
                <button
                  type="button"
                  onClick={startNewConversation}
                  disabled={loading}
                  className="site-focus inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-[#9aa3b2] transition hover:border-white/20 hover:text-[#e8ecf2] disabled:opacity-40"
                >
                  <PlusCircle size={13} aria-hidden /> Yeni sohbet
                </button>
              </div>
              {messages.map((msg) => (
                <article
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  aria-label={msg.role === 'user' ? 'Sen' : 'Atlas'}
                >
                  {msg.role === 'user' ? (
                    <div className="atlas-user-bubble max-w-[min(88%,22.5rem)] px-4 py-3 text-[14.5px] leading-[1.65] sm:max-w-[min(75%,34rem)] sm:px-5 sm:py-3.5 sm:text-[15px]">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[min(92%,40rem)] sm:max-w-[min(85%,42rem)]">
                      {msg.pending ? (
                        <div
                          className="flex items-center gap-3 py-1 text-[#9a9488]"
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
                                className="site-focus inline-flex items-center gap-1.5 text-[13px] text-[#e8d9a8]/85 underline-offset-2 hover:underline"
                              >
                                <RotateCcw size={13} aria-hidden /> Yeniden oluştur
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : msg.error || msg.retryable ? (
                        <div className="rounded-[18px] border border-red-400/20 bg-red-950/20 px-4 py-3 text-[14.5px] leading-[1.65] text-red-100/90 sm:px-5 sm:py-3.5 sm:text-[15px]">
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
                        <div>
                          <p className="atlas-assistant-copy text-[15px] leading-[1.75] tracking-[-0.005em] whitespace-pre-wrap sm:text-[16px] sm:leading-[1.8]">
                            {msg.content}
                          </p>
                          <ResponseThumbs
                            requestId={msg.requestId}
                            conversationId={activeConversationId}
                          />
                        </div>
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

            {pendingImage ? (
              <div className="mb-2 flex items-center gap-2">
                <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/10">
                  <img
                    src={pendingImage.previewUrl}
                    alt="Eklenecek görsel"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearPendingImage}
                    aria-label="Görseli kaldır"
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white"
                  >
                    <X size={10} aria-hidden />
                  </button>
                </div>
                <span className="text-[12px] text-[#8b93a3]">Görsel eklendi</span>
              </div>
            ) : null}
            {imageError ? (
              <p className="mb-2 text-[12px] text-red-300/90">{imageError}</p>
            ) : null}

            <div className="atlas-composer flex items-end gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={onImageSelected}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
              <button
                type="button"
                onClick={() => {
                  if (canImageAnalysis) {
                    fileInputRef.current?.click();
                  } else {
                    setImageError(
                      canImageAnalysis === null
                        ? 'Yetki kontrol ediliyor…'
                        : 'Görsel analiz, Lara Prime kapsamında sunulur.',
                    );
                  }
                }}
                disabled={backendReady === false || loading}
                aria-label="Görsel ekle"
                title={canImageAnalysis ? 'Görsel ekle' : 'Görsel analiz, Lara Prime kapsamında sunulur.'}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[#8b93a3] transition hover:text-[#e8ecf2] disabled:opacity-30"
              >
                <ImagePlus size={19} aria-hidden />
              </button>

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

            <p className="atlas-chat-disclaimer mt-2.5 px-1 text-center sm:mt-3">
              Atlas yanılabilir. Önemli bilgileri bağımsız olarak doğrula.
            </p>
          </div>
        </footer>
      </main>
    </CosmicShell>
  );
}

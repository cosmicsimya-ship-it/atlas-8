import { Loader2, RotateCcw, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import CosmicShell from '../components/cosmic/CosmicShell';
import { atlasChat } from '../services/atlas-chat';
import { ensureAtlasSession } from '../utils/atlas-session';
import type { AtlasAnalysisMode, AtlasChatMessage } from '../types/atlas-chat';

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const MODE_LABELS: Record<AtlasAnalysisMode, string> = {
  conversational: 'Sohbet',
  'meta-synthesis': 'Meta Sentez',
  'daily-guide': 'Günlük Rehber',
};

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

  useEffect(() => {
    atlasChat.checkBackend().then(setBackendReady);
    ensureAtlasSession().catch(() => {
      /* session will retry on send */
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (contextPrompt && !seededContext.current) {
      seededContext.current = true;
      setMessages([
        {
          id: createId(),
          role: 'assistant',
          content: 'Analiz bağlamın yüklendi. Bu sonuç hakkında neyi netleştirmek istiyorsun?',
        },
      ]);
    }
  }, [contextPrompt]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: AtlasChatMessage = {
      id: createId(),
      role: 'user',
      content: text,
    };

    const history = messages
      .filter((m) => !m.pending && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const pendingId = createId();
    setMessages((prev) => [
      ...prev,
      { id: pendingId, role: 'assistant', content: '', pending: true },
    ]);

    try {
      const response = await atlasChat.sendMessage(text, history);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                id: pendingId,
                role: 'assistant',
                content: response.reply,
                mode: response.mode,
                profile: response.profile,
              }
            : m,
        ),
      );
    } catch (err) {
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
              }
            : m,
        ),
      );
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [input, loading, messages]);

  const retryLast = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user' && !m.pending);
    if (lastUser) {
      setInput(lastUser.content);
      setMessages((prev) => prev.filter((m) => !m.error));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <CosmicShell showBackground={false}>
      <main className="flex min-h-[100dvh] flex-col pt-20">
        <div className="border-b border-white/8 px-4 py-4 md:px-8">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div>
              <h1 className="font-display text-xl text-[#f5f0e8]">Atlas Konsolu</h1>
              <p className="text-xs text-[#f5f0e8]/40">Sembolik zekâ katmanı</p>
            </div>
            {backendReady === false && (
              <span className="text-xs text-amber-300/80">Backend kapalı</span>
            )}
          </div>
        </div>

        <section className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                <h2 className="font-display text-2xl text-[#f5f0e8]">Atlas</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#f5f0e8]/48">
                  Düşünceni yaz. Atlas örüntüleri sembolik katmanlarda karşılaştırır.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#f5f0e8] text-[#050505]'
                      : msg.error
                        ? 'border border-red-500/30 bg-red-500/10 text-red-200'
                        : 'border border-white/10 bg-[#0b1220]/70 text-[#f5f0e8]/88'
                  }`}
                >
                  {msg.pending ? (
                    <span className="flex items-center gap-2 text-[#f5f0e8]/50">
                      <Loader2 size={16} className="animate-spin" />
                      Atlas düşünüyor…
                    </span>
                  ) : (
                    msg.content
                  )}
                  {msg.error && (
                    <button
                      type="button"
                      onClick={retryLast}
                      className="mt-3 inline-flex items-center gap-1 text-xs text-red-200/90 underline-offset-2 hover:underline"
                    >
                      <RotateCcw size={12} /> Tekrar dene
                    </button>
                  )}
                  {msg.mode && msg.mode !== 'conversational' && !msg.pending && (
                    <p className="mt-2 text-xs text-[#c9b37a]/55">{MODE_LABELS[msg.mode]}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </section>

        <footer className="border-t border-white/8 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8">
          <div className="mx-auto flex max-w-3xl gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Atlas’a sor…"
              disabled={loading}
              rows={2}
              aria-label="Mesaj"
              className="flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-[#f5f0e8] outline-none focus:border-[#c9b37a]/40 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Gönder"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f5f0e8] text-[#050505] disabled:opacity-40"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </footer>
      </main>
    </CosmicShell>
  );
}

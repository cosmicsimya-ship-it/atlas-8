import { ArrowLeft, Loader2, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { atlasChat } from "../services/atlas-chat";
import type { AtlasAnalysisMode, AtlasChatMessage } from "../types/atlas-chat";

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const MODE_LABELS: Record<AtlasAnalysisMode, string> = {
  conversational: "Sohbet",
  "meta-synthesis": "Meta Sentez",
  "daily-guide": "Günlük Rehber",
};

export default function Chat() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AtlasChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    atlasChat.checkBackend().then(setBackendReady);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: AtlasChatMessage = {
      id: createId(),
      role: "user",
      content: text,
    };

    const history = messages
      .filter((m) => !m.pending && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const pendingId = createId();
    setMessages((prev) => [
      ...prev,
      { id: pendingId, role: "assistant", content: "", pending: true },
    ]);

    try {
      const response = await atlasChat.sendMessage(text, history);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                id: pendingId,
                role: "assistant",
                content: response.reply,
                mode: response.mode,
                profile: response.profile,
              }
            : m,
        ),
      );
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                id: pendingId,
                role: "assistant",
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <main className="min-h-screen bg-[#070707] text-white flex flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4 md:px-8">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-white/70 hover:text-white transition"
        >
          <ArrowLeft size={18} />
          Geri
        </button>

        <div className="text-center">
          <h1 className="text-lg font-semibold tracking-wider">ATLAS</h1>
          <p className="text-xs text-white/40">Meta Sentez Motoru</p>
        </div>

        <div className="w-16 text-right">
          {backendReady === false && (
            <span className="text-xs text-amber-400/80">Backend kapalı</span>
          )}
        </div>
      </header>

      <section className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <h2 className="text-2xl font-bold mb-2">Atlas</h2>
              <p className="text-white/50 mb-2">
                Düşünceni yaz. Atlas örüntüleri görsün.
              </p>
              <p className="text-white/30 text-sm">
                Astroloji, numeroloji, tarot ve diğer sembolik sistemler arasındaki
                kesişimleri analiz eder.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-white text-black"
                    : msg.error
                      ? "border border-red-500/30 bg-red-500/10 text-red-200"
                      : "border border-white/10 bg-white/[0.05] text-white/90"
                }`}
              >
                {msg.pending ? (
                  <span className="flex items-center gap-2 text-white/50">
                    <Loader2 size={16} className="animate-spin" />
                    Düşünüyor...
                  </span>
                ) : (
                  msg.content
                )}
                {msg.mode && msg.mode !== "conversational" && !msg.pending && (
                  <p className="mt-2 text-xs text-white/40">
                    {MODE_LABELS[msg.mode]}
                  </p>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-3xl gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Bir şey sor..."
            disabled={loading}
            rows={2}
            className="flex-1 resize-none rounded-2xl bg-white/5 border border-white/10 p-4 outline-none focus:border-white/20 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-black disabled:opacity-40 hover:scale-105 transition"
            aria-label="Gönder"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </footer>
    </main>
  );
}

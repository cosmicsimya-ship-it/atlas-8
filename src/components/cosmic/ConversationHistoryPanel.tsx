import { Plus, X } from 'lucide-react';

import type { AtlasConversationSummary } from '../../types/atlas-chat';

interface ConversationHistoryPanelProps {
  open: boolean;
  loading: boolean;
  conversations: AtlasConversationSummary[];
  activeConversationId: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
}

function formatConversationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

/** Chat-page-local history drawer — not the site nav, not the dashboard Sidebar. */
export default function ConversationHistoryPanel({
  open,
  loading,
  conversations,
  activeConversationId,
  onClose,
  onNewChat,
  onSelect,
}: ConversationHistoryPanelProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        id="atlas-history-panel"
        aria-label="Sohbet geçmişi"
        className="fixed left-0 top-[4.5rem] z-40 flex h-[calc(100dvh-4.5rem)] w-[min(88vw,300px)] flex-col border-r border-white/[0.08] bg-[#08090c]/98 backdrop-blur-xl md:bg-[#08090c]/92"
      >
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
          <button
            type="button"
            onClick={onNewChat}
            className="site-focus inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#c9b37a]/35 bg-[#c9b37a]/10 px-3 py-2 text-[13px] font-medium text-[#e8d9a8] transition hover:border-[#c9b37a]/55 hover:bg-[#c9b37a]/16"
          >
            <Plus size={14} aria-hidden /> Yeni Sohbet
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sohbet geçmişini kapat"
            className="site-focus inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#8b93a3] transition hover:text-[#e8ecf2] md:hidden"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <p className="px-2 py-3 text-[12.5px] text-[#8b93a3]">Yükleniyor…</p>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-3 text-[12.5px] text-[#8b93a3]">
              Henüz sohbet geçmişin yok.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {conversations.map((conv) => {
                const active = conv.id === activeConversationId;
                return (
                  <li key={conv.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(conv.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`site-focus block w-full rounded-xl px-3 py-2.5 text-left transition ${
                        active
                          ? 'bg-white/[0.08] text-[#e8ecf2]'
                          : 'text-[#9aa3b2] hover:bg-white/[0.04] hover:text-[#d4dae2]'
                      }`}
                    >
                      <span className="block truncate text-[13px] leading-snug">
                        {conv.preview || 'Yeni sohbet'}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-[#6d7482]">
                        {formatConversationDate(conv.updatedAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

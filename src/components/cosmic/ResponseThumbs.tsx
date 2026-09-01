import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

import { submitThumbs, type ThumbsRating } from '../../services/atlas-feedback';

/**
 * 👍/👎 rating control shown under a completed Atlas response. Links to the
 * response via requestId only — never sends the prompt or reply text.
 */
export default function ResponseThumbs({
  requestId,
  conversationId,
}: {
  requestId?: string | null;
  conversationId?: string | null;
}) {
  const [rating, setRating] = useState<ThumbsRating | null>(null);
  const [busy, setBusy] = useState(false);

  if (!requestId) return null;

  async function rate(next: ThumbsRating) {
    if (busy || rating === next) return;
    const previous = rating;
    setBusy(true);
    setRating(next); // optimistic
    try {
      await submitThumbs({
        requestId: requestId as string,
        rating: next,
        conversationId: conversationId ?? undefined,
      });
    } catch {
      setRating(previous); // revert on failure — best-effort, never blocks the UI
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-1" role="group" aria-label="Bu yanıtı değerlendir">
      <button
        type="button"
        onClick={() => rate('up')}
        disabled={busy}
        aria-pressed={rating === 'up'}
        aria-label="Faydalı"
        className={`site-focus rounded-full p-1.5 transition disabled:opacity-50 ${
          rating === 'up' ? 'text-[#7fd88f]' : 'text-[#9a9488] hover:text-[#f5f0e6]'
        }`}
      >
        <ThumbsUp size={14} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => rate('down')}
        disabled={busy}
        aria-pressed={rating === 'down'}
        aria-label="Faydalı değil"
        className={`site-focus rounded-full p-1.5 transition disabled:opacity-50 ${
          rating === 'down' ? 'text-red-300/85' : 'text-[#9a9488] hover:text-[#f5f0e6]'
        }`}
      >
        <ThumbsDown size={14} aria-hidden />
      </button>
    </div>
  );
}

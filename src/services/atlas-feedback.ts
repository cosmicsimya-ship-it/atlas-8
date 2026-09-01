import { apiRequest } from './api-client';

export type FeedbackType = 'bug' | 'suggestion' | 'question' | 'other';

export async function submitFeedback(input: {
  type: FeedbackType;
  message: string;
  route?: string;
  conversationId?: string | null;
  messageId?: string | null;
}): Promise<void> {
  await apiRequest('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ── Per-response 👍/👎 rating — server/chat-feedback.js ──
// Links only to a response's requestId; never sends prompt/response text.

export type ThumbsRating = 'up' | 'down';

export type ThumbsFeedback = {
  id: string;
  requestId: string;
  rating: ThumbsRating;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function submitThumbs(input: {
  requestId: string;
  rating: ThumbsRating;
  conversationId?: string | null;
}): Promise<{ ok: boolean; feedback: ThumbsFeedback }> {
  return apiRequest<{ ok: boolean; feedback: ThumbsFeedback }>('/api/feedback/thumbs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

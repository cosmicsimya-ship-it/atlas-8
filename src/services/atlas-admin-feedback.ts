/**
 * Admin feedback-triage client. Thin wrappers over the real
 * /api/admin/feedback/* endpoints — no authority field is ever sent from
 * here (the server derives the actor from the session).
 *
 * Note: this branch has no server/chat-feedback.js (👍/👎 message ratings)
 * yet, so there is no chat-ratings summary here — only the structured
 * feedback workflow below.
 */

import { apiRequest } from './api-client';

export type FeedbackEntry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  type: 'bug' | 'suggestion' | 'question' | 'other';
  message: string;
  route: string | null;
  conversationId: string | null;
  messageId: string | null;
  status: 'new' | 'reviewing' | 'resolved' | 'dismissed';
  priority: 'low' | 'normal' | 'high' | 'critical';
  adminNote: string | null;
};

export async function fetchAdminFeedbackList(params: {
  status?: string;
  priority?: string;
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<{ ok: boolean; entries: FeedbackEntry[]; total: number; limit: number; offset: number }> {
  const qs = new URLSearchParams(
    Object.entries(params).reduce<Record<string, string>>((acc, [k, v]) => {
      if (v !== undefined && v !== null && v !== '') acc[k] = String(v);
      return acc;
    }, {}),
  ).toString();
  return apiRequest<{ ok: boolean; entries: FeedbackEntry[]; total: number; limit: number; offset: number }>(
    `/api/admin/feedback${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}

export function updateAdminFeedbackStatus(id: string, status: FeedbackEntry['status']) {
  return apiRequest<{ ok: boolean; feedback: FeedbackEntry }>(`/api/admin/feedback/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function updateAdminFeedbackPriority(id: string, priority: FeedbackEntry['priority']) {
  return apiRequest<{ ok: boolean; feedback: FeedbackEntry }>(`/api/admin/feedback/${encodeURIComponent(id)}/priority`, {
    method: 'PATCH',
    body: JSON.stringify({ priority }),
  });
}

export function updateAdminFeedbackNote(id: string, note: string) {
  return apiRequest<{ ok: boolean; feedback: FeedbackEntry }>(`/api/admin/feedback/${encodeURIComponent(id)}/note`, {
    method: 'PATCH',
    body: JSON.stringify({ note }),
  });
}

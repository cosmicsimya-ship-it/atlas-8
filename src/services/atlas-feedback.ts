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

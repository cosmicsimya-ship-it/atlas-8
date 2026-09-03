/**
 * Contact/Support form submission client.
 * Persists to server/contact/store.js — does not send email (no
 * transactional email provider is configured in this stack today).
 */

import { apiRequest, ApiError } from './api-client';

export type ContactTopic = 'general' | 'billing' | 'privacy' | 'other';

export type ContactSubmission = {
  name?: string;
  email: string;
  topic: ContactTopic;
  message: string;
  route?: string;
  /** Hidden honeypot field — must stay empty; never render a real input for it. */
  website?: string;
};

export type ContactSubmitResult = { ok: true } | { ok: false; error: string };

export async function submitContactMessage(input: ContactSubmission): Promise<ContactSubmitResult> {
  try {
    await apiRequest<{ ok: boolean }>('/api/contact', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as { error?: string } | null;
      return { ok: false, error: body?.error || 'Mesaj gönderilemedi. Lütfen tekrar deneyin.' };
    }
    return { ok: false, error: 'Mesaj gönderilemedi. Lütfen tekrar deneyin.' };
  }
}

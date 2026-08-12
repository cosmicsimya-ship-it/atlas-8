/**
 * Atlas Voice TTS client — POST /api/voice/synthesize, GET /api/voice/voices
 */

import { apiRequest, ApiError } from './api-client';
import { BACKEND_URL } from '../config';
import { getCachedCsrfToken, ensureAtlasSession } from '../utils/atlas-session';

export type AtlasVoicePublic = {
  id: string;
  displayName: string;
  languages: string[];
  gender?: string | null;
  role?: string | null;
  isDefault?: boolean;
  configured?: boolean;
};

export type SynthesizeSpeechInput = {
  text: string;
  voice?: string;
  language?: string;
  format?: 'mp3' | 'wav';
  signal?: AbortSignal;
};

export type VoiceApiErrorBody = {
  ok: false;
  error?: { code?: string; message?: string; retryable?: boolean; feature?: string };
};

/**
 * List public voices (no provider secrets).
 */
export async function listAtlasVoices(): Promise<{
  voices: AtlasVoicePublic[];
  languages: string[];
  defaultVoice: string;
  defaultLanguage: string;
}> {
  const res = await apiRequest<{
    ok: boolean;
    data: {
      voices: AtlasVoicePublic[];
      languages: string[];
      defaultVoice: string;
      defaultLanguage: string;
    };
  }>('/api/voice/voices', { method: 'GET' });
  return res.data;
}

/**
 * Request TTS audio blob. Uses CSRF + session cookies.
 * Returns a Blob suitable for URL.createObjectURL (user-gesture playback).
 */
export async function synthesizeSpeechAudio(
  input: SynthesizeSpeechInput,
): Promise<{ blob: Blob; voice: string; language: string; cached: boolean }> {
  await ensureAtlasSession().catch(() => undefined);

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  input.signal?.addEventListener('abort', onAbort);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    };
    const csrf = getCachedCsrfToken();
    if (csrf) headers['X-Atlas-Csrf'] = csrf;

    const res = await fetch(`${BACKEND_URL}/api/voice/synthesize`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        text: input.text,
        voice: input.voice || 'lara',
        language: input.language || 'tr-TR',
        format: input.format || 'mp3',
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      const errBody = body as VoiceApiErrorBody | null;
      const code = errBody?.error?.code;
      const message =
        code === 'premium_required'
          ? 'Lara Voice, Lara Prime kapsamında sunulur.'
          : errBody?.error?.message ||
            (typeof body === 'object' && body && 'error' in body
              ? String((body as { error: unknown }).error)
              : `Voice request failed (${res.status})`);
      throw new ApiError(message, res.status, body);
    }

    const blob = await res.blob();
    return {
      blob,
      voice: res.headers.get('X-Atlas-Voice') || input.voice || 'lara',
      language: res.headers.get('X-Atlas-Language') || input.language || 'tr-TR',
      cached: res.headers.get('X-Atlas-Cached') === '1',
    };
  } finally {
    input.signal?.removeEventListener('abort', onAbort);
  }
}

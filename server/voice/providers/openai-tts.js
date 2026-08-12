/**
 * OpenAI TTS adapter (gpt-4o-mini-tts / tts-1 family).
 * Only used when ATLAS_TTS_PROVIDER=openai and OPENAI_API_KEY is set.
 * No fake credentials. Does not invent voice clones.
 */

import { getVoiceConfig } from '../config.js';
import { VOICE_ERROR_CODES, normalizeProviderError } from '../errors.js';

/**
 * @param {string} language
 */
function languageHint(language) {
  const lang = String(language || '').trim();
  if (lang.startsWith('tr')) {
    return 'Speak in Turkish. Pronounce Turkish letters correctly (ç, ğ, ı, İ, ö, ş, ü).';
  }
  if (lang.startsWith('en')) {
    return 'Speak in natural English. Do not apply Turkish pronunciation rules.';
  }
  return undefined;
}

/**
 * @param {object} [config]
 * @returns {import('./index.js').VoiceProvider}
 */
export function createOpenAITTSProvider(config = {}) {
  const cfg = getVoiceConfig();
  const apiKey = config.apiKey ?? cfg.openai.apiKey;
  const model = config.model ?? cfg.openai.model;
  const timeoutMs = config.timeoutMs ?? cfg.timeoutMs;
  const dryRun = config.dryRun ?? cfg.dryRun;
  const fetchFn = config.fetch ?? globalThis.fetch;

  return {
    id: 'openai',
    label: 'OpenAI TTS',
    supportsStreaming: false,

    async healthCheck() {
      if (!apiKey) return { ok: false, detail: 'OPENAI_API_KEY missing' };
      if (dryRun) return { ok: true, detail: 'dry_run (key present, no network)' };
      return { ok: true, detail: 'api key present' };
    },

    async listVoices() {
      return [];
    },

    async synthesize(input) {
      const text = String(input?.text || '');
      const language = String(input?.language || 'tr-TR');
      const providerVoiceId = String(
        input?.providerVoiceId || cfg.openai.defaultVoice || '',
      ).trim();
      const format = String(input?.format || 'mp3').toLowerCase() === 'wav' ? 'wav' : 'mp3';

      if (!apiKey) {
        return {
          ok: false,
          provider: 'openai',
          audioBuffer: null,
          error: VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED,
          meta: { reason: 'api_key_missing' },
        };
      }

      if (!providerVoiceId) {
        return {
          ok: false,
          provider: 'openai',
          audioBuffer: null,
          error: VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED,
          meta: { reason: 'provider_voice_id_missing' },
        };
      }

      if (dryRun) {
        return {
          ok: false,
          provider: 'openai',
          audioBuffer: null,
          error: VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED,
          meta: {
            reason: 'dry_run',
            wouldCall: true,
            model,
            language,
            voiceIdLength: providerVoiceId.length,
          },
        };
      }

      const body = {
        model,
        input: text,
        voice: providerVoiceId,
        response_format: format === 'wav' ? 'wav' : 'mp3',
      };

      const instructions = languageHint(language);
      if (instructions) body.instructions = instructions;

      if (input?.speed != null && Number.isFinite(Number(input.speed))) {
        body.speed = Math.min(4, Math.max(0.25, Number(input.speed)));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onAbort = () => controller.abort();
      input?.signal?.addEventListener('abort', onAbort);

      const started = Date.now();
      try {
        const fetchPromise = fetchFn('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const response = await Promise.race([
          fetchPromise,
          new Promise((_, reject) => {
            const fail = () => {
              const err = new Error('provider_timeout');
              err.name = 'AbortError';
              reject(err);
            };
            if (controller.signal.aborted) fail();
            else controller.signal.addEventListener('abort', fail, { once: true });
          }),
        ]);

        if (!response.ok) {
          let detail = `openai_tts_http_${response.status}`;
          try {
            const errJson = await response.json();
            detail = errJson?.error?.message || detail;
          } catch {
            /* ignore */
          }
          const err = new Error(String(detail));
          err.status = response.status;
          throw err;
        }

        const arrayBuf = await response.arrayBuffer();
        return {
          ok: true,
          provider: 'openai',
          audioBuffer: Buffer.from(arrayBuf),
          mimeType: format === 'wav' ? 'audio/wav' : 'audio/mpeg',
          format: format === 'wav' ? 'wav' : 'mp3',
          meta: {
            model,
            language,
            latencyMs: Date.now() - started,
            charCount: text.length,
          },
        };
      } catch (err) {
        const normalized = normalizeProviderError(err, { timeoutMs });
        return {
          ok: false,
          provider: 'openai',
          audioBuffer: null,
          error: normalized.code,
          meta: {
            reason: normalized.detail || normalized.code,
            latencyMs: Date.now() - started,
          },
        };
      } finally {
        clearTimeout(timer);
        input?.signal?.removeEventListener('abort', onAbort);
      }
    },
  };
}

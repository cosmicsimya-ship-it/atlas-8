/**
 * ElevenLabs TTS adapter.
 * Server-side only. Never logs API keys or full synthesis text.
 *
 * Does NOT create voice clones or start paid cloning — uses configured voice IDs only.
 */

import { getVoiceConfig } from '../config.js';
import { VOICE_ERROR_CODES, VoiceError, normalizeProviderError } from '../errors.js';

/**
 * Map Atlas BCP-47 language to ElevenLabs language_code when useful.
 * Multilingual v2 uses the voice + text; language_code is advisory.
 * @param {string} language
 */
function toElevenLanguageCode(language) {
  const lang = String(language || '').trim();
  if (lang.startsWith('tr')) return 'tr';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('de')) return 'de';
  const base = lang.split('-')[0];
  return base || undefined;
}

/**
 * @param {object} [config]
 * @returns {import('./index.js').VoiceProvider}
 */
export function createElevenLabsProvider(config = {}) {
  const cfg = getVoiceConfig();
  const apiKey = config.apiKey ?? cfg.elevenlabs.apiKey;
  const modelId = config.modelId ?? cfg.elevenlabs.modelId;
  const baseUrl = config.baseUrl ?? cfg.elevenlabs.baseUrl;
  const timeoutMs = config.timeoutMs ?? cfg.timeoutMs;
  const dryRun = config.dryRun ?? cfg.dryRun;
  /** Injectable fetch for tests */
  const fetchFn = config.fetch ?? globalThis.fetch;

  return {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    supportsStreaming: true,

    async healthCheck() {
      if (!apiKey) return { ok: false, detail: 'ELEVENLABS_API_KEY missing' };
      if (dryRun) return { ok: true, detail: 'dry_run (key present, no network)' };
      return { ok: true, detail: 'api key present' };
    },

    async listVoices() {
      if (!apiKey) return [];
      if (dryRun) return [];
      // Intentionally not listing remote catalog by default (privacy/cost).
      return [];
    },

    async synthesize(input) {
      const text = String(input?.text || '');
      const language = String(input?.language || 'tr-TR');
      const providerVoiceId = String(input?.providerVoiceId || '').trim();
      const format = String(input?.format || 'mp3').toLowerCase() === 'wav' ? 'wav' : 'mp3';

      if (!apiKey) {
        return {
          ok: false,
          provider: 'elevenlabs',
          audioBuffer: null,
          error: VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED,
          meta: { reason: 'api_key_missing' },
        };
      }

      if (!providerVoiceId) {
        return {
          ok: false,
          provider: 'elevenlabs',
          audioBuffer: null,
          error: VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED,
          meta: { reason: 'provider_voice_id_missing' },
        };
      }

      if (dryRun) {
        return {
          ok: false,
          provider: 'elevenlabs',
          audioBuffer: null,
          error: VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED,
          meta: {
            reason: 'dry_run',
            wouldCall: true,
            modelId,
            language,
            // never echo secrets; only length of voice id
            voiceIdLength: providerVoiceId.length,
          },
        };
      }

      const outputFormat = format === 'wav' ? 'pcm_44100' : 'mp3_44100_128';
      const url = `${baseUrl}/v1/text-to-speech/${encodeURIComponent(providerVoiceId)}?output_format=${outputFormat}`;

      const body = {
        text,
        model_id: modelId,
        language_code: toElevenLanguageCode(language),
      };

      if (input?.speed != null && Number.isFinite(Number(input.speed))) {
        // ElevenLabs uses voice_settings; keep conservative — do not invent unsupported fields.
        body.voice_settings = {
          stability: 0.45,
          similarity_boost: 0.75,
        };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onAbort = () => controller.abort();
      input?.signal?.addEventListener('abort', onAbort);

      const started = Date.now();
      try {
        const fetchPromise = fetchFn(url, {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: format === 'wav' ? 'audio/wav' : 'audio/mpeg',
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
          let detail = `elevenlabs_http_${response.status}`;
          try {
            const errJson = await response.json();
            detail = errJson?.detail?.status || errJson?.detail?.message || detail;
          } catch {
            try {
              const t = await response.text();
              if (t && t.length < 200) detail = t;
            } catch {
              /* ignore */
            }
          }
          const err = new Error(String(detail));
          err.status = response.status;
          throw err;
        }

        const arrayBuf = await response.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuf);
        const latencyMs = Date.now() - started;

        return {
          ok: true,
          provider: 'elevenlabs',
          audioBuffer,
          mimeType: format === 'wav' ? 'audio/wav' : 'audio/mpeg',
          format: format === 'wav' ? 'wav' : 'mp3',
          durationMs: undefined,
          meta: {
            modelId,
            language,
            languageCode: toElevenLanguageCode(language),
            latencyMs,
            charCount: text.length,
            // never include api key or full text
          },
        };
      } catch (err) {
        const normalized = normalizeProviderError(err, { timeoutMs });
        return {
          ok: false,
          provider: 'elevenlabs',
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

/**
 * @param {import('./index.js').SynthesisResult} result
 */
export function assertElevenLabsResultOrThrow(result) {
  if (result.ok) return result;
  throw new VoiceError(result.error || VOICE_ERROR_CODES.SYNTHESIS_FAILED, result.meta?.reason);
}

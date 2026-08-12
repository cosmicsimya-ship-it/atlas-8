/**
 * Mock TTS provider — deterministic silent/minimal MP3-like payload for tests & dry-run.
 * Does not call external networks or consume credits.
 */

import { createHash } from 'crypto';

/**
 * Minimal valid-enough MPEG frame header bytes + payload marker.
 * Browsers may not decode this as real speech; tests assert buffer presence/mime only.
 * @param {string} text
 * @param {string} language
 */
function buildMockAudioBuffer(text, language) {
  const marker = createHash('sha256')
    .update(`mock|${language}|${text}`)
    .digest()
    .subarray(0, 32);
  // ID3v2 empty + a few bytes (not a full MP3 — mock only)
  const header = Buffer.from([
    0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20,
  ]);
  return Buffer.concat([header, marker, Buffer.from(`atlas-mock-tts:${language}`, 'utf8')]);
}

/**
 * @param {object} [config]
 * @returns {import('./index.js').VoiceProvider}
 */
export function createMockTTSProvider(config = {}) {
  return {
    id: 'mock',
    label: 'Mock TTS',
    supportsStreaming: false,
    async healthCheck() {
      return { ok: true, detail: 'mock always healthy' };
    },
    async listVoices() {
      return [{ id: 'mock-lara', name: 'Mock Lara', languages: ['tr-TR', 'en-US', 'en-GB'] }];
    },
    async synthesize(input) {
      const text = String(input?.text || '');
      const language = String(input?.language || 'tr-TR');
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const durationMs = Math.max(400, Math.min(words * 350, 60_000));
      const format = String(input?.format || 'mp3').toLowerCase() === 'wav' ? 'wav' : 'mp3';
      return {
        ok: true,
        provider: 'mock',
        audioBuffer: buildMockAudioBuffer(text, language),
        mimeType: format === 'wav' ? 'audio/wav' : 'audio/mpeg',
        format,
        durationMs,
        meta: {
          simulated: true,
          providerVoiceId: input?.providerVoiceId || 'mock-lara',
          language,
          ...(config.meta || {}),
        },
      };
    },
  };
}

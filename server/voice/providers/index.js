/**
 * VoiceProvider contract + factory.
 *
 * @typedef {object} SynthesisRequest
 * @property {string} text
 * @property {string} language
 * @property {string} [providerVoiceId]
 * @property {string} [format]
 * @property {number} [speed]
 * @property {AbortSignal} [signal]
 * @property {Record<string, unknown>} [meta]
 *
 * @typedef {object} SynthesisResult
 * @property {boolean} ok
 * @property {string} provider
 * @property {Buffer|null} [audioBuffer]
 * @property {string} [mimeType]
 * @property {string} [format]
 * @property {number} [durationMs]
 * @property {string} [error]
 * @property {Record<string, unknown>} [meta]
 *
 * @typedef {object} VoiceDefinition
 * @property {string} id
 * @property {string} [name]
 * @property {string[]} [languages]
 *
 * @typedef {object} ProviderHealth
 * @property {boolean} ok
 * @property {string} [detail]
 *
 * @typedef {object} VoiceProvider
 * @property {string} id
 * @property {string} label
 * @property {(input: SynthesisRequest) => Promise<SynthesisResult>} synthesize
 * @property {() => Promise<VoiceDefinition[]>} [listVoices]
 * @property {() => Promise<ProviderHealth>} [healthCheck]
 * @property {boolean} [supportsStreaming]
 */

import { getVoiceConfig } from '../config.js';
import { createElevenLabsProvider } from './elevenlabs.js';
import { createOpenAITTSProvider } from './openai-tts.js';
import { createMockTTSProvider } from './mock.js';

/**
 * @param {string} [providerId]
 * @param {object} [overrides]
 * @returns {VoiceProvider}
 */
export function createVoiceProvider(providerId, overrides = {}) {
  const cfg = getVoiceConfig();
  const id = String(providerId || cfg.providerId || 'elevenlabs')
    .trim()
    .toLowerCase();

  if (id === 'mock') return createMockTTSProvider(overrides);
  if (id === 'openai' || id === 'openai_tts') return createOpenAITTSProvider(overrides);
  if (id === 'elevenlabs') return createElevenLabsProvider(overrides);

  // Unknown provider — do not invent credentials; soft fail via mock-like unavailable wrapper
  return {
    id,
    label: `Unknown (${id})`,
    supportsStreaming: false,
    async healthCheck() {
      return { ok: false, detail: `unknown_provider:${id}` };
    },
    async synthesize() {
      return {
        ok: false,
        provider: id,
        audioBuffer: null,
        error: 'provider_unavailable',
        meta: { reason: 'unknown_provider' },
      };
    },
  };
}

export { createElevenLabsProvider, createOpenAITTSProvider, createMockTTSProvider };

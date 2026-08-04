/**
 * ATLAS LIVE — voice provider layer.
 * Interfaces for ElevenLabs, OpenAI Realtime, Azure TTS, Google TTS, Local XTTS.
 * No hard coupling. Default = mock (returns timed cues without calling a network).
 */

/**
 * @typedef {object} VoiceSynthesizeRequest
 * @property {string} text
 * @property {string[]} [cues]
 * @property {string} [voiceId]
 * @property {string} [language]
 * @property {object} [style]
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {object} VoiceSynthesizeResult
 * @property {boolean} ok
 * @property {import('./schema.js').VoiceProviderId} provider
 * @property {string} [audioUrl]
 * @property {Buffer|Uint8Array|null} [audioBuffer]
 * @property {number} durationMs
 * @property {string} [mimeType]
 * @property {string} [error]
 * @property {object} [meta]
 */

/**
 * @typedef {object} VoiceProvider
 * @property {import('./schema.js').VoiceProviderId} id
 * @property {string} label
 * @property {(req: VoiceSynthesizeRequest) => Promise<VoiceSynthesizeResult>} synthesize
 * @property {() => Promise<{ ok: boolean, detail?: string }>} [healthCheck]
 * @property {boolean} [supportsStreaming]
 */

/**
 * Rough spoken duration estimate (~145 wpm late-night pace + pauses).
 * @param {string} text
 * @param {string[]} [cues]
 */
export function estimateSpeechDurationMs(text, cues = []) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const pauseBonus = Math.max(0, (cues.length || 1) - 1) * 700;
  const ms = Math.round((words / 145) * 60_000 + pauseBonus + 800);
  return Math.max(2_500, Math.min(ms, 90_000));
}

/**
 * Mock provider — production-safe default for dry runs / Telegram wiring later.
 * @returns {VoiceProvider}
 */
export function createMockVoiceProvider() {
  return {
    id: 'mock',
    label: 'Mock Voice (timing only)',
    supportsStreaming: false,
    async healthCheck() {
      return { ok: true, detail: 'mock always healthy' };
    },
    async synthesize(req) {
      const durationMs = estimateSpeechDurationMs(req.text, req.cues);
      return {
        ok: true,
        provider: 'mock',
        audioUrl: undefined,
        audioBuffer: null,
        durationMs,
        mimeType: 'audio/mock',
        meta: { simulated: true, voiceId: req.voiceId ?? 'atlas-live-mock' },
      };
    },
  };
}

/**
 * Factory stubs — real SDK wiring lands behind these without touching the engine.
 * Each returns a provider that fails soft until credentials / adapters exist.
 */

/** @param {object} [config] @returns {VoiceProvider} */
export function createElevenLabsProvider(config = {}) {
  const apiKey = config.apiKey ?? process.env.ELEVENLABS_API_KEY;
  const voiceId = config.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? 'atlas-live';
  return {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    supportsStreaming: true,
    async healthCheck() {
      return apiKey
        ? { ok: true, detail: 'api key present (SDK not bound in this build)' }
        : { ok: false, detail: 'ELEVENLABS_API_KEY missing' };
    },
    async synthesize(req) {
      if (!apiKey) {
        return {
          ok: false,
          provider: 'elevenlabs',
          audioBuffer: null,
          durationMs: 0,
          error: 'ELEVENLABS_NOT_CONFIGURED',
        };
      }
      // Adapter hook — bind official SDK in a future voice-adapters/elevenlabs.js
      return {
        ok: false,
        provider: 'elevenlabs',
        audioBuffer: null,
        durationMs: estimateSpeechDurationMs(req.text, req.cues),
        error: 'ELEVENLABS_ADAPTER_PENDING',
        meta: { voiceId: req.voiceId ?? voiceId, adapter: 'pending' },
      };
    },
  };
}

/** @param {object} [config] @returns {VoiceProvider} */
export function createOpenAIRealtimeProvider(config = {}) {
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
  return {
    id: 'openai_realtime',
    label: 'OpenAI Realtime',
    supportsStreaming: true,
    async healthCheck() {
      return apiKey
        ? { ok: true, detail: 'api key present (realtime adapter pending)' }
        : { ok: false, detail: 'OPENAI_API_KEY missing' };
    },
    async synthesize(req) {
      if (!apiKey) {
        return {
          ok: false,
          provider: 'openai_realtime',
          audioBuffer: null,
          durationMs: 0,
          error: 'OPENAI_REALTIME_NOT_CONFIGURED',
        };
      }
      return {
        ok: false,
        provider: 'openai_realtime',
        audioBuffer: null,
        durationMs: estimateSpeechDurationMs(req.text, req.cues),
        error: 'OPENAI_REALTIME_ADAPTER_PENDING',
        meta: { adapter: 'pending' },
      };
    },
  };
}

/** @param {object} [config] @returns {VoiceProvider} */
export function createAzureTtsProvider(config = {}) {
  const key = config.apiKey ?? process.env.AZURE_SPEECH_KEY;
  return {
    id: 'azure_tts',
    label: 'Azure TTS',
    supportsStreaming: false,
    async healthCheck() {
      return key
        ? { ok: true, detail: 'key present (adapter pending)' }
        : { ok: false, detail: 'AZURE_SPEECH_KEY missing' };
    },
    async synthesize(req) {
      if (!key) {
        return {
          ok: false,
          provider: 'azure_tts',
          audioBuffer: null,
          durationMs: 0,
          error: 'AZURE_TTS_NOT_CONFIGURED',
        };
      }
      return {
        ok: false,
        provider: 'azure_tts',
        audioBuffer: null,
        durationMs: estimateSpeechDurationMs(req.text, req.cues),
        error: 'AZURE_TTS_ADAPTER_PENDING',
        meta: { adapter: 'pending' },
      };
    },
  };
}

/** @param {object} [config] @returns {VoiceProvider} */
export function createGoogleTtsProvider(config = {}) {
  const creds = config.credentials ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return {
    id: 'google_tts',
    label: 'Google TTS',
    supportsStreaming: false,
    async healthCheck() {
      return creds
        ? { ok: true, detail: 'credentials present (adapter pending)' }
        : { ok: false, detail: 'GOOGLE_APPLICATION_CREDENTIALS missing' };
    },
    async synthesize(req) {
      if (!creds) {
        return {
          ok: false,
          provider: 'google_tts',
          audioBuffer: null,
          durationMs: 0,
          error: 'GOOGLE_TTS_NOT_CONFIGURED',
        };
      }
      return {
        ok: false,
        provider: 'google_tts',
        audioBuffer: null,
        durationMs: estimateSpeechDurationMs(req.text, req.cues),
        error: 'GOOGLE_TTS_ADAPTER_PENDING',
        meta: { adapter: 'pending' },
      };
    },
  };
}

/** @param {object} [config] @returns {VoiceProvider} */
export function createLocalXttsProvider(config = {}) {
  const endpoint = config.endpoint ?? process.env.LOCAL_XTTS_URL;
  return {
    id: 'local_xtts',
    label: 'Local XTTS',
    supportsStreaming: false,
    async healthCheck() {
      return endpoint
        ? { ok: true, detail: 'endpoint set (adapter pending)' }
        : { ok: false, detail: 'LOCAL_XTTS_URL missing' };
    },
    async synthesize(req) {
      if (!endpoint) {
        return {
          ok: false,
          provider: 'local_xtts',
          audioBuffer: null,
          durationMs: 0,
          error: 'LOCAL_XTTS_NOT_CONFIGURED',
        };
      }
      return {
        ok: false,
        provider: 'local_xtts',
        audioBuffer: null,
        durationMs: estimateSpeechDurationMs(req.text, req.cues),
        error: 'LOCAL_XTTS_ADAPTER_PENDING',
        meta: { endpoint, adapter: 'pending' },
      };
    },
  };
}

const PROVIDER_FACTORIES = {
  mock: createMockVoiceProvider,
  elevenlabs: createElevenLabsProvider,
  openai_realtime: createOpenAIRealtimeProvider,
  azure_tts: createAzureTtsProvider,
  google_tts: createGoogleTtsProvider,
  local_xtts: createLocalXttsProvider,
};

/**
 * Resolve a voice provider by id with mock fallback.
 * @param {import('./schema.js').VoiceProviderId|string} [id]
 * @param {object} [config]
 * @returns {VoiceProvider}
 */
export function createVoiceProvider(id = 'mock', config = {}) {
  const factory = PROVIDER_FACTORIES[id] || createMockVoiceProvider;
  return factory(config);
}

/**
 * High-level voice facade used by the engine.
 * @param {{ provider?: VoiceProvider|import('./schema.js').VoiceProviderId, providerConfig?: object, fallbackToMock?: boolean }} [options]
 */
export function createVoiceFacade(options = {}) {
  const fallbackToMock = options.fallbackToMock !== false;
  let provider =
    options.provider && typeof options.provider === 'object'
      ? options.provider
      : createVoiceProvider(/** @type {string} */ (options.provider || 'mock'), options.providerConfig);

  /**
   * @param {VoiceSynthesizeRequest} req
   * @returns {Promise<VoiceSynthesizeResult>}
   */
  async function speak(req) {
    try {
      const result = await provider.synthesize(req);
      if (result.ok) return result;
      if (fallbackToMock && provider.id !== 'mock') {
        const mock = createMockVoiceProvider();
        const mocked = await mock.synthesize(req);
        return {
          ...mocked,
          meta: {
            ...(mocked.meta || {}),
            fallbackFrom: provider.id,
            originalError: result.error,
          },
        };
      }
      return result;
    } catch (err) {
      if (fallbackToMock && provider.id !== 'mock') {
        const mock = createMockVoiceProvider();
        const mocked = await mock.synthesize(req);
        return {
          ...mocked,
          meta: {
            ...(mocked.meta || {}),
            fallbackFrom: provider.id,
            originalError: err?.message ?? 'VOICE_EXCEPTION',
          },
        };
      }
      return {
        ok: false,
        provider: provider.id,
        audioBuffer: null,
        durationMs: 0,
        error: err?.message ?? 'VOICE_EXCEPTION',
      };
    }
  }

  /** @param {VoiceProvider|import('./schema.js').VoiceProviderId} next */
  function setProvider(next, config = {}) {
    provider =
      typeof next === 'object' ? next : createVoiceProvider(next, config);
  }

  return {
    speak,
    setProvider,
    getProvider: () => provider,
    estimateSpeechDurationMs,
  };
}

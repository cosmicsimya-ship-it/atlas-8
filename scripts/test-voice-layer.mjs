#!/usr/bin/env node
/**
 * Voice layer unit/integration tests (mock provider — no paid API calls).
 * Run: node scripts/test-voice-layer.mjs
 */

import assert from 'assert';
import { createHash } from 'crypto';

process.env.ATLAS_TTS_PROVIDER = 'mock';
process.env.ATLAS_TTS_DRY_RUN = 'false';
process.env.ATLAS_TTS_CACHE_ENABLED = 'true';
process.env.ATLAS_TTS_DAILY_CHAR_QUOTA = '100000';
process.env.ATLAS_TTS_DAILY_REQUEST_QUOTA = '1000';
process.env.ATLAS_TTS_MAX_TEXT_LENGTH = '2500';
// Ensure we do not accidentally pick up real keys for "missing key" cases
delete process.env.ELEVENLABS_API_KEY;
delete process.env.ELEVENLABS_LARA_VOICE_ID;

const {
  synthesizeSpeech,
  normalizeLanguage,
  listPublicVoices,
  getVoice,
  resolveProviderVoiceId,
  VOICE_ERROR_CODES,
  VoiceError,
  buildCacheKey,
  clearVoiceCacheForTests,
  resetUsageForTests,
  sanitizePublicPayload,
  createElevenLabsProvider,
  createVoiceProvider,
  getLaraMasterPath,
  assertWithinQuota,
  SYNTHESIS_SETTINGS_VERSION,
} = await import('../server/voice/index.js');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

async function throwsCode(fn, code, name) {
  try {
    await fn();
    ok(name, false);
  } catch (err) {
    ok(name, err instanceof VoiceError && err.code === code);
  }
}

console.log('\n=== Voice layer ===\n');

clearVoiceCacheForTests();
resetUsageForTests();

// Master asset
ok('Lara master asset present', Boolean(getLaraMasterPath()));

// Language normalize
ok('normalize tr', normalizeLanguage('tr') === 'tr-TR');
ok('normalize en-US', normalizeLanguage('en-US') === 'en-US');
ok('normalize en-GB', normalizeLanguage('en-gb') === 'en-GB');
ok('normalize invalid', normalizeLanguage('xx') === null);

// Registry
const voices = listPublicVoices();
ok('registry lists lara', voices.some((v) => v.id === 'lara'));
ok('public voices hide provider ids', voices.every((v) => !('providerVoiceId' in v)));
const lara = getVoice('lara');
ok('lara supports tr-TR', lara?.languages.includes('tr-TR'));
ok('lara supports en-US', lara?.languages.includes('en-US'));

const publicSanitized = sanitizePublicPayload({
  apiKey: 'sk-secret',
  providerVoiceId: 'abc',
  voice: 'lara',
});
ok('sanitize drops apiKey', !('apiKey' in publicSanitized));
ok('sanitize drops providerVoiceId', !('providerVoiceId' in publicSanitized));
ok('sanitize keeps voice', publicSanitized.voice === 'lara');

// Turkish + English same logical voice
const tr = await synthesizeSpeech({
  text: 'Merhaba Atlas. Çocuklar ğülümseyip ışığa baktı; şimdi ördek üşüdü.',
  voice: 'lara',
  language: 'tr-TR',
  userKey: 'test-tr',
});
ok('turkish synthesis ok', tr.ok === true && tr.audioBuffer?.length > 0);
ok('turkish mime mpeg', tr.mimeType === 'audio/mpeg');
ok('turkish voice lara', tr.voice === 'lara');
ok('turkish language', tr.language === 'tr-TR');

const en = await synthesizeSpeech({
  text: 'Welcome to Atlas.',
  voice: 'lara',
  language: 'en-US',
  userKey: 'test-en',
});
ok('english synthesis ok', en.ok === true && en.audioBuffer?.length > 0);
ok('english same logical voice', en.voice === 'lara' && tr.voice === en.voice);
ok('english language', en.language === 'en-US');
ok(
  'tr/en audio differ for different text',
  tr.audioBuffer.toString('hex') !== en.audioBuffer.toString('hex'),
);

// Validation
await throwsCode(
  () => synthesizeSpeech({ text: '   ', voice: 'lara', language: 'tr-TR' }),
  VOICE_ERROR_CODES.EMPTY_TEXT,
  'empty text rejected',
);
await throwsCode(
  () => synthesizeSpeech({ text: 'Hi', voice: 'no-such-voice', language: 'tr-TR' }),
  VOICE_ERROR_CODES.VOICE_NOT_FOUND,
  'invalid voice rejected',
);
await throwsCode(
  () => synthesizeSpeech({ text: 'Hi', voice: 'lara', language: 'de-DE' }),
  VOICE_ERROR_CODES.LANGUAGE_NOT_SUPPORTED,
  'invalid language rejected',
);
await throwsCode(
  () =>
    synthesizeSpeech({
      text: 'x'.repeat(5000),
      voice: 'lara',
      language: 'tr-TR',
    }),
  VOICE_ERROR_CODES.TEXT_TOO_LONG,
  'text too long rejected',
);

// Cache
clearVoiceCacheForTests();
const cacheText = `cache-probe-${Date.now()}`;
const first = await synthesizeSpeech({
  text: cacheText,
  voice: 'lara',
  language: 'tr-TR',
  userKey: 'cache-user',
});
const second = await synthesizeSpeech({
  text: cacheText,
  voice: 'lara',
  language: 'tr-TR',
  userKey: 'cache-user',
});
ok('cache miss then hit', first.cached === false && second.cached === true);
ok(
  'cache key stable',
  buildCacheKey({
    text: 'a',
    voice: 'lara',
    language: 'tr-TR',
    provider: 'mock',
    model: 'mock',
    settingsVersion: SYNTHESIS_SETTINGS_VERSION,
  }) ===
    createHash('sha256')
      .update(['a', 'lara', 'tr-TR', 'mock', 'mock', 'mp3', '', SYNTHESIS_SETTINGS_VERSION].join('\u0001'))
      .digest('hex'),
);

// Provider missing / API key missing (elevenlabs real provider, no key)
{
  const prev = process.env.ATLAS_TTS_PROVIDER;
  process.env.ATLAS_TTS_PROVIDER = 'elevenlabs';
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_LARA_VOICE_ID;
  // Re-import config is live via process.env each call
  await throwsCode(
    async () => {
      const { synthesizeSpeech: synth } = await import('../server/voice/synthesize.js');
      await synth({
        text: 'Merhaba',
        voice: 'lara',
        language: 'tr-TR',
        userKey: 'nokey',
        skipCache: true,
      });
    },
    VOICE_ERROR_CODES.VOICE_NOT_CONFIGURED,
    'API key missing → voice_not_configured',
  );
  process.env.ATLAS_TTS_PROVIDER = prev || 'mock';
}

// Provider timeout (injected fetch)
{
  const slow = createElevenLabsProvider({
    apiKey: 'test-key-not-real',
    dryRun: false,
    timeoutMs: 50,
    fetch: () =>
      new Promise((resolve) => {
        setTimeout(() => resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }), 500);
      }),
  });
  // Need a voice id
  process.env.ELEVENLABS_LARA_VOICE_ID = 'test-voice-id';
  const result = await slow.synthesize({
    text: 'timeout probe',
    language: 'tr-TR',
    providerVoiceId: 'test-voice-id',
    format: 'mp3',
  });
  ok(
    'provider timeout normalized',
    result.ok === false && result.error === VOICE_ERROR_CODES.PROVIDER_TIMEOUT,
  );
  delete process.env.ELEVENLABS_LARA_VOICE_ID;
}

// Quota error
{
  process.env.ATLAS_TTS_DAILY_REQUEST_QUOTA = '1';
  resetUsageForTests();
  // record one synthetic usage via synthesize
  process.env.ATLAS_TTS_PROVIDER = 'mock';
  await synthesizeSpeech({
    text: 'quota one',
    voice: 'lara',
    language: 'en-US',
    userKey: 'quota-user',
    skipCache: true,
  });
  await throwsCode(
    () =>
      synthesizeSpeech({
        text: 'quota two',
        voice: 'lara',
        language: 'en-US',
        userKey: 'quota-user',
        skipCache: true,
      }),
    VOICE_ERROR_CODES.QUOTA_EXCEEDED,
    'quota exceeded',
  );
  process.env.ATLAS_TTS_DAILY_REQUEST_QUOTA = '1000';
  resetUsageForTests();
}

// assertWithinQuota direct
{
  process.env.ATLAS_TTS_DAILY_CHAR_QUOTA = '5';
  resetUsageForTests();
  try {
    assertWithinQuota({ userKey: 'chars', charCount: 10 });
    ok('char quota throws', false);
  } catch (err) {
    ok('char quota throws', err.code === VOICE_ERROR_CODES.QUOTA_EXCEEDED);
  }
  process.env.ATLAS_TTS_DAILY_CHAR_QUOTA = '100000';
}

// Quota-like provider error mapping
{
  const provider = createElevenLabsProvider({
    apiKey: 'x',
    dryRun: false,
    fetch: async () => ({
      ok: false,
      status: 429,
      json: async () => ({ detail: { status: 'quota_exceeded', message: 'quota' } }),
      text: async () => '',
    }),
  });
  const r = await provider.synthesize({
    text: 'q',
    language: 'en-US',
    providerVoiceId: 'vid',
  });
  ok('quota error from provider', r.error === VOICE_ERROR_CODES.QUOTA_EXCEEDED);
}

// Dry-run does not call network
{
  const calls = { n: 0 };
  const provider = createElevenLabsProvider({
    apiKey: 'x',
    dryRun: true,
    fetch: async () => {
      calls.n += 1;
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) };
    },
  });
  const r = await provider.synthesize({
    text: 'dry',
    language: 'tr-TR',
    providerVoiceId: 'vid',
  });
  ok('dry-run no fetch', calls.n === 0 && r.ok === false);
}

// Factory
ok('factory mock', createVoiceProvider('mock').id === 'mock');
ok('factory elevenlabs', createVoiceProvider('elevenlabs').id === 'elevenlabs');
ok('factory openai', createVoiceProvider('openai').id === 'openai');

// Frontend audio state machine contract (mirrors useVoicePlayback states)
{
  const STATES = new Set(['idle', 'loading', 'playing', 'paused', 'error']);
  const transitions = {
    idle: ['loading'],
    loading: ['playing', 'error', 'idle'],
    playing: ['paused', 'idle', 'error'],
    paused: ['playing', 'idle'],
    error: ['loading', 'idle'],
  };
  ok('frontend states defined', [...STATES].every((s) => transitions[s]));
  ok('no autoplay transition from idle without loading', !transitions.idle.includes('playing'));
}

// Per-language voice id resolution
{
  process.env.ELEVENLABS_LARA_VOICE_ID = 'shared-id';
  process.env.ELEVENLABS_LARA_VOICE_ID_TR = 'tr-only';
  process.env.ELEVENLABS_LARA_VOICE_ID_EN = 'en-only';
  const v = getVoice('lara');
  ok('resolve tr-specific id', resolveProviderVoiceId(v, 'tr-TR') === 'tr-only');
  ok('resolve en-specific id', resolveProviderVoiceId(v, 'en-US') === 'en-only');
  delete process.env.ELEVENLABS_LARA_VOICE_ID;
  delete process.env.ELEVENLABS_LARA_VOICE_ID_TR;
  delete process.env.ELEVENLABS_LARA_VOICE_ID_EN;
}

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

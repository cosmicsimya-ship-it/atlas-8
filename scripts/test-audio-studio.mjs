/**
 * Atlas Audio Studio — deterministic tests.
 * Run: node scripts/test-audio-studio.mjs
 */
process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';
process.env.ATLAS_AUDIO_PROCESSING_ENABLED = 'false';
process.env.ATLAS_AUDIO_MIXING_ENABLED = 'false';
process.env.ATLAS_AUDIO_MASTERING_ENABLED = 'false';
process.env.ATLAS_AUDIO_STEM_SEPARATION_ENABLED = 'false';
process.env.ATLAS_AUDIO_TUNING_ENABLED = 'false';
process.env.ATLAS_AUDIO_GENERATION_ENABLED = 'false';
process.env.ATLAS_AUDIO_EXTERNAL_UPLOAD_ENABLED = 'false';

import assert from 'assert';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import {
  detectAudioIntent,
  containsFalseCapabilityPromise,
  classifyAudioMedia,
  buildCapabilityRegistry,
  buildAudioStudioReply,
  assessCapabilities,
  assertSafePath,
  AudioStudioError,
  AUDIO_ERROR_CODES,
  createAudioJob,
  deleteJob,
  storeOriginalFile,
  readJob,
  contextKey,
  setPendingAudioInstruction,
  getPendingAudioContext,
  clearPendingAudioContext,
  _resetAudioContextStore,
  _resetCapabilityCache,
  _resetFeatureRequestStore,
  evaluateAudioSafety,
  redactForLog,
  runAudioStudioTurn,
  AUDIO_JOBS_ROOT,
} from '../server/audio-studio/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error('  ', err.message);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error('  ', err.message);
  }
}

_resetCapabilityCache();
_resetAudioContextStore();
_resetFeatureRequestStore();

// ── A. Intent tests ──
const intentCases = [
  ['Bu sesi temizler misin?', 'clean_noise'],
  ['Bunu stüdyo kaydı gibi yap.', 'create_studio_version'],
  ['Bağlamayı çalacağım, vokali de söyleyeceğim.', 'save_audio_feature_request'],
  ['Araya profesyonel enstrümanlar ekle.', 'add_instruments'],
  ['Mix mastering yapabilir misin?', 'create_studio_version'],
  ['Bu kaydın kalitesini analiz et.', 'evaluate_recording_quality'],
  ['Videodaki sesi çıkar.', 'extract_audio_from_video'],
  ['Vokali öne al.', 'mix_vocal_and_instrument'],
  ['Bunu mp3’e çevir.', 'convert_audio_format'],
  ['Atlas’a böyle bir ses düzenleme özelliği ekleyin.', 'save_audio_feature_request'],
];

for (const [msg, expected] of intentCases) {
  check(`intent: ${expected} ← ${msg.slice(0, 40)}`, () => {
    const d = detectAudioIntent(msg, []);
    assert.ok(d.active, 'should be active');
    assert.equal(d.intent, expected);
  });
}

check('intent: multi-turn Hüseyin studio context', () => {
  const history = [
    {
      role: 'user',
      content:
        'Ben kendi çapımda bağlama çalıyorum, arada beste de yapıyorum. Besteyi sana yollayacağım.',
    },
    { role: 'assistant', content: 'Ne istediğini biraz daha açar mısın?' },
  ];
  const d = detectAudioIntent(
    'Sen de profesyonel bir stüdyoda yapılmış gibi düzenleyeceksin.',
    history,
  );
  assert.ok(d.active);
  assert.equal(d.intent, 'create_studio_version');
  assert.ok(d.isProductionRequest || d.isFeatureRequest);
});

// ── B. Capability truthfulness ──
check('capability: processing disabled → no false promise in reply', () => {
  const registry = buildCapabilityRegistry({
    flags: {
      upload: true,
      analysis: true,
      processing: false,
      transcription: false,
      stemSeparation: false,
      tuning: false,
      mixing: false,
      mastering: false,
      generation: false,
      externalUpload: false,
    },
    ffmpeg: { ffmpegAvailable: false, ffprobeAvailable: false },
    providers: {},
  });
  const intent = detectAudioIntent('Bunu stüdyo kaydı gibi yap.', []);
  const reply = buildAudioStudioReply({
    displayName: 'Hüseyin',
    intent,
    registry,
  });
  assert.ok(!containsFalseCapabilityPromise(reply), reply);
  assert.ok(/motor bağlı değil|aktif değil|söz veremem/i.test(reply), reply);
  assert.ok(!/(?:^|[^.])gönder,\s*düzenlerim(?!\s*demem)/i.test(reply));
});

check('capability: analysis-only messaging', () => {
  const registry = buildCapabilityRegistry({
    flags: {
      upload: true,
      analysis: true,
      processing: false,
      transcription: false,
      stemSeparation: false,
      tuning: false,
      mixing: false,
      mastering: false,
      generation: false,
      externalUpload: false,
    },
    ffmpeg: { ffmpegAvailable: true, ffprobeAvailable: true },
    providers: {},
  });
  const intent = detectAudioIntent('Bu kaydın kalitesini analiz et.', []);
  const reply = buildAudioStudioReply({ intent, registry });
  assert.ok(/analiz/i.test(reply));
  assert.ok(!/mastering yapacağım/i.test(reply));
});

check('capability: assessCapabilities marks mastering unavailable', () => {
  const registry = buildCapabilityRegistry({
    flags: {
      upload: true,
      analysis: true,
      processing: false,
      transcription: false,
      stemSeparation: false,
      tuning: false,
      mixing: false,
      mastering: false,
      generation: false,
      externalUpload: false,
    },
    ffmpeg: { ffmpegAvailable: false, ffprobeAvailable: false },
    providers: {},
  });
  const a = assessCapabilities(['mastering', 'mixing', 'metadata_inspection'], registry);
  assert.ok(a.unavailable.includes('mastering') || a.requiresProvider.includes('mastering'));
  assert.ok(!a.available.includes('mastering'));
});

// ── C. File classification ──
check('classify: mp3', () => {
  const c = classifyAudioMedia({ mimeType: 'audio/mpeg', fileName: 'a.mp3', size: 1000 });
  assert.equal(c.detectedType, 'audio_file');
  assert.ok(c.supported);
});

check('classify: wav', () => {
  const c = classifyAudioMedia({ mimeType: 'audio/wav', fileName: 'a.wav', size: 1000 });
  assert.ok(c.supported);
});

check('classify: m4a', () => {
  const c = classifyAudioMedia({ mimeType: 'audio/m4a', fileName: 'a.m4a', size: 1000 });
  assert.ok(c.supported);
});

check('classify: telegram voice', () => {
  const c = classifyAudioMedia({
    mimeType: 'audio/ogg',
    fileName: 'voice.ogg',
    mediaKind: 'voice',
    telegramVoice: true,
    size: 1000,
  });
  assert.equal(c.detectedType, 'telegram_voice');
});

check('classify: video', () => {
  const c = classifyAudioMedia({ mimeType: 'video/mp4', fileName: 'x.mp4', size: 1000 });
  assert.equal(c.detectedType, 'video_with_audio');
  assert.ok(!c.supported);
});

check('classify: zero byte', () => {
  const c = classifyAudioMedia({ mimeType: 'audio/mpeg', fileName: 'a.mp3', size: 0 });
  assert.equal(c.detectedType, 'unsupported_media');
});

check('classify: vocal+instrument from text', () => {
  const c = classifyAudioMedia({
    mimeType: 'audio/mpeg',
    fileName: 'demo.mp3',
    size: 2000,
    userText: 'bağlama ve vokal birlikte',
  });
  assert.equal(c.detectedType, 'vocal_and_instrument_mix');
});

// ── D. Conversation context ──
check('context: instruction then file matching', () => {
  _resetAudioContextStore();
  const key = contextKey({
    channel: 'telegram',
    userId: 'telegram:huseyin',
    chatId: '1',
  });
  setPendingAudioInstruction(key, {
    intent: 'create_studio_version',
    message: 'stüdyo gibi yap',
    requestedOperations: ['mixing', 'mastering'],
  });
  const pending = getPendingAudioContext(key);
  assert.equal(pending.kind, 'instruction');
  clearPendingAudioContext(key);
  assert.equal(getPendingAudioContext(key), null);
});

check('context: speaker name in text is not author (intent still studio)', () => {
  const d = detectAudioIntent(
    'Lara dedi ki Atlas bağlama kaydımı stüdyo gibi yapsın',
    [],
  );
  assert.ok(d.active);
  assert.equal(d.intent, 'create_studio_version');
});

// ── E. Security ──
check('security: path traversal blocked', () => {
  let threw = false;
  try {
    assertSafePath(AUDIO_JOBS_ROOT, '../user_memory.json');
  } catch (err) {
    threw = err instanceof AudioStudioError && err.code === AUDIO_ERROR_CODES.PATH_TRAVERSAL;
  }
  assert.ok(threw);
});

check('security: voice cloning blocked', () => {
  const s = evaluateAudioSafety('Atatürk’ün sesini klonla');
  assert.ok(s.blocked);
});

check('security: redact secrets', () => {
  const r = redactForLog({ apiKey: 'sk-secret', token: 'abc', ok: true });
  assert.equal(r.apiKey, '[redacted]');
  assert.equal(r.token, '[redacted]');
  assert.equal(r.ok, true);
});

check('security: original file preserved on store', () => {
  const tmpDir = join(__dirname, '..', 'data', 'audio-jobs', '_test_tmp');
  mkdirSync(tmpDir, { recursive: true });
  const src = join(tmpDir, 'orig.wav');
  writeFileSync(src, Buffer.from('RIFF....WAVEfmt '));
  const job = createAudioJob({ userId: 'test:audio', channel: 'web', intent: 'analyze_audio' });
  storeOriginalFile(job.jobId, src, { fileName: 'orig.wav', mimeType: 'audio/wav' });
  const stored = readJob(job.jobId);
  assert.ok(existsSync(stored.sourceFile.localPath));
  assert.ok(existsSync(src), 'original source still exists');
  deleteJob(job.jobId);
  rmSync(tmpDir, { recursive: true, force: true });
});

check('security: unauthorized job access', async () => {
  // sync style via assertJobAccess imported path tested in orchestrator ownership
  const job = createAudioJob({ userId: 'telegram:a', channel: 'telegram' });
  const { assertJobAccess } = await import('../server/audio-studio/index.js');
  let blocked = false;
  try {
    assertJobAccess(job, 'telegram:b');
  } catch (err) {
    blocked = err.code === AUDIO_ERROR_CODES.UNAUTHORIZED;
  }
  deleteJob(job.jobId);
  assert.ok(blocked);
});

// ── Pipeline smoke: Hüseyin scenario ──
await checkAsync('pipeline: Hüseyin studio feature request is honest', async () => {
  const out = await processAtlasMessage({
    channel: 'telegram',
    userId: 'telegram:smoke-huseyin-audio',
    conversationId: 'smoke-audio-huseyin',
    message:
      'Ben kendi çapımda bağlama çalıyorum, arada beste de yapıyorum. Besteyi sana yollayacağım, sen de profesyonel bir stüdyoda yapılmış gibi düzenleyeceksin.',
    history: [
      { role: 'user', content: 'Sor Atlas.' },
      {
        role: 'assistant',
        content: 'Hüseyin, eklenmesini istediğin özellik hakkında biraz daha bilgi verebilir misin?',
      },
    ],
    displayName: 'Hüseyin',
    metadata: {
      isGroup: false,
      telegramFromId: 'smoke-huseyin-audio',
      senderDisplayName: 'Hüseyin',
    },
  });
  assert.equal(out.engine, 'audio-studio', `engine=${out.engine}`);
  assert.ok(out.reply, 'reply required');
  assert.ok(!containsFalseCapabilityPromise(out.reply), out.reply);
  assert.ok(/stüdyo|mix|mastering|aranje|gürültü|analiz/i.test(out.reply), out.reply);
  assert.ok(/motor bağlı değil|aktif değil|sağlayıcı/i.test(out.reply), out.reply);
  assert.ok(!/gönder,\s*(?:ben\s+)?(?:düzenlerim|yaparım)/i.test(out.reply));
});

await checkAsync('pipeline: ask capabilities', async () => {
  const out = await processAtlasMessage({
    channel: 'web',
    userId: 'web:audio-cap',
    conversationId: 'audio-cap',
    message: 'Ses düzenleyebilir misin?',
    history: [],
    displayName: 'Test',
  });
  assert.equal(out.engine, 'audio-studio');
  assert.ok(!containsFalseCapabilityPromise(out.reply));
});

await checkAsync('orchestrator: no processing status without provider', async () => {
  const result = await runAudioStudioTurn({
    message: 'Bunu stüdyo kaydı gibi yap',
    history: [],
    userId: 'web:orch',
    displayName: 'Ali',
    channel: 'web',
    conversationId: 'orch-1',
  });
  assert.ok(result.handled);
  assert.ok(result.data?.jobStatus !== 'processing' && result.data?.jobStatus !== 'completed');
  assert.ok(!containsFalseCapabilityPromise(result.reply));
});

console.log('');
console.log(`Audio Studio tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

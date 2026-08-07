/**
 * Cross-layer synthesis × message-service integration tests.
 * Run: node scripts/test-cross-layer-message-integration.mjs
 */
import {
  detectCrossLayerSynthesisIntent,
  runMessageCrossLayerSynthesis,
  guardSynthesisReply,
  collectSynthesisLayers,
  validateMessageVerseRef,
  MESSAGE_SYNTHESIS_BRIDGE_VERSION,
  _resetAllSessionExamplesForTests,
} from '../server/cross-layer-synthesis/index.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { detectConversationIntent } from '../server/atlas-conversation-style.js';

let passed = 0;
let failed = 0;

function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

_resetAllSessionExamplesForTests();

function mockLlm(content) {
  return async ({ userPrompt }) => ({
    content,
    model: 'mock',
    provider: 'test',
    tokensUsed: 1,
    costUsd: 0,
    latencyMs: 1,
    _userPrompt: userPrompt,
  });
}

function baseInput(message, extras = {}) {
  return {
    message,
    channel: 'web',
    conversationId: 'test-conv',
    userId: null,
    displayName: 'Tester',
    history: [],
    ...extras,
  };
}

// ── 1. Tek katman synthesis çağırmıyor ────────────────────────────────
{
  const intent = detectCrossLayerSynthesisIntent('Bugünün astrolojik atmosferini anlat.');
  record('1 intent single-layer no synth', intent.wantsSynthesis === false, JSON.stringify(intent.layersRequested));

  let capturedPrompt = '';
  const result = await processAtlasMessage(baseInput('Bugünün gökyüzünü genel anlat.'), {
    callOpenAI: async ({ userPrompt }) => {
      capturedPrompt = userPrompt;
      return {
        content: 'Gökyüzü sakin bir tonda.',
        model: 'mock',
        provider: 'test',
        tokensUsed: 1,
        costUsd: 0,
        latencyMs: 1,
      };
    },
  });
  record(
    '1 message service no synthesis block',
    result.data?.crossLayerSynthesis?.ran === false &&
      !/DETERMINISTIC CROSS-LAYER SYNTHESIS/i.test(capturedPrompt),
    result.engine,
  );
}

// ── 2. Kur’an + astroloji ─────────────────────────────────────────────
{
  const intent = detectCrossLayerSynthesisIntent(
    'Kur’an 2:286 ile bugünün astrolojisini birlikte yorumla; sorumluluk ve sabır teması.',
  );
  record('2 intent wants synth', intent.wantsSynthesis && intent.layersRequested.includes('quran') && intent.layersRequested.includes('astrology'));

  const bridge = runMessageCrossLayerSynthesis({
    message: 'Kur’an 2:286 ile bugünün astrolojisini birlikte yorumla; sorumluluk ve acele-sabır.',
    verseStore: null,
  });
  record('2 bridge ran', bridge.ran === true, String(bridge.collection?.layers?.map((l) => l.layerId)));
  record('2 has quran+astrology layers', (bridge.collection?.layers ?? []).some((l) => l.layerId === 'quran') && (bridge.collection?.layers ?? []).some((l) => l.layerId === 'astrology'));

  const result = await processAtlasMessage(
    baseInput('Kur’an 2:286 ve astrolojiyi birlikte yorumla; sorumluluk teması.'),
    {
      callOpenAI: mockLlm(
        'Kur’an katmanı sorumluluk temasını öne çıkarıyor. Astroloji ayrı bir çerçevedir. Bu doğrulama değildir.',
      ),
    },
  );
  record('2 message synth ran', result.data?.crossLayerSynthesis?.ran === true, result.intent);
}

// ── 3. Astroloji + numeroloji ─────────────────────────────────────────
{
  const bridge = runMessageCrossLayerSynthesis({
    message: 'Astroloji ve numerolojiyi birlikte sentezle; karar teması.',
  });
  record(
    '3 astro+num ran',
    bridge.ran &&
      bridge.collection.layers.some((l) => l.layerId === 'astrology') &&
      bridge.collection.layers.some((l) => l.layerId === 'numerology'),
  );
}

// ── 4. Üç katman ──────────────────────────────────────────────────────
{
  const bridge = runMessageCrossLayerSynthesis({
    message: 'Kur’an 2:286, astroloji ve numerolojiyi birlikte yorumla; sorumluluk.',
  });
  record('4 three layers', bridge.ran && bridge.collection.layers.length >= 3, String(bridge.collection?.layers?.length));
}

// ── 5. “Bunları sentezle” niyeti ──────────────────────────────────────
{
  const intent = detectCrossLayerSynthesisIntent('Bunları sentezle, ortak tema nedir?');
  record('5 combine intent', intent.combineExplicit === true && intent.wantsSynthesis === true);
}

// ── 6. Yanlış sûre/âyet ───────────────────────────────────────────────
{
  const v = validateMessageVerseRef('1:999');
  record('6 invalid ayah', v.ok === false);
  const bridge = runMessageCrossLayerSynthesis({
    message: 'Kur’an 1:999 ile astrolojiyi karşılaştır.',
  });
  const q = bridge.collection?.layers?.find((l) => l.layerId === 'quran');
  record('6 quran layer error/partial', q && (q.status === 'error' || q.cautions?.length > 0));
}

// ── 7. Quran store yok ────────────────────────────────────────────────
{
  const bridge = runMessageCrossLayerSynthesis({
    message: 'Kur’an 2:286 ve numerolojiyi birlikte oku.',
    verseStore: null,
  });
  const q = bridge.collection.layers.find((l) => l.layerId === 'quran');
  record(
    '7 no fabricated text without store',
    !q?.normalizedFacts?.arabic && !q?.normalizedFacts?.translation,
  );
  record(
    '7 store missing caution',
    (q?.cautions ?? []).some((c) => /store bağlı değil|store/i.test(c)),
  );
}

// ── 8. Bir layer başarısız — kısmi ────────────────────────────────────
{
  const bridge = runMessageCrossLayerSynthesis({
    message: 'Kur’an 999:1 ile astrolojiyi birlikte yorumla.',
  });
  record('8 still runs with partial', bridge.ran === true);
  record(
    '8 failed or error quran noted',
    bridge.synthesis?.failedLayers?.includes('quran') ||
      bridge.collection.layers.some((l) => l.layerId === 'quran' && l.status === 'error'),
  );
}

// ── 9. LLM ilişki tipini değiştirmeye çalışıyor ───────────────────────
{
  const bridge = runMessageCrossLayerSynthesis({
    message: 'Kur’an 2:286 ve astroloji: sorumluluk ile acele-sabır gerilimi; zıtlık var mı?',
  });
  const locked = bridge.synthesis?.primaryRelationship?.type;
  const hostile = guardSynthesisReply(
    'Bu iki sistem birbirini kesinlikle destekleyen biçimde doğruluyor; ilişki türü Destekleyen.',
    bridge.synthesis,
  );
  record('9 guard detects violation', hostile.violations.length > 0, locked);
  record('9 fallback to deterministic', hostile.usedDeterministicFallback === true);
}

// ── 10. Gökyüzü ayeti doğruluyor filtresi ─────────────────────────────
{
  const bridge = runMessageCrossLayerSynthesis({
    message: 'Kur’an 2:286 ve astrolojiyi birlikte yorumla.',
  });
  const guarded = guardSynthesisReply('Gökyüzü bu ayeti doğruluyor.', bridge.synthesis);
  record('10 sky-confirm filtered', guarded.violations.length > 0 || !/doğruluyor/i.test(guarded.reply));
  record('10 reply not affirming', !/gökyüzü bu ayeti doğruluyor/i.test(guarded.reply));
}

// ── 11. Kaynak görünürlüğü ────────────────────────────────────────────
{
  const bridge = runMessageCrossLayerSynthesis({
    message: 'Astroloji ve numeroloji ortak tema nedir?',
  });
  record(
    '11 source visibility',
    Array.isArray(bridge.synthesis?.sourceVisibility) &&
      bridge.synthesis.sourceVisibility.every((v) => v.source && v.method),
  );
  const result = await processAtlasMessage(baseInput('Astroloji ile numerolojiyi sentezle.'), {
    callOpenAI: mockLlm('Katmanlar ayrı; ortak düşünme alanı karar olabilir. Doğrulama değildir.'),
  });
  record(
    '11 message data keeps visibility',
    Array.isArray(result.data?.crossLayerSynthesis?.sourceVisibility),
  );
}

// ── 12. Hesaplanan / yorumlanan ───────────────────────────────────────
{
  const bridge = runMessageCrossLayerSynthesis({
    message: 'Numeroloji ve astrolojiyi birlikte yorumla.',
  });
  const vis = bridge.synthesis?.sourceVisibility ?? [];
  record(
    '12 computed/interpreted split',
    vis.some((v) => (v.computed?.length ?? 0) > 0) && vis.some((v) => (v.interpreted?.length ?? 0) > 0 || (v.symbolic?.length ?? 0) > 0),
  );
}

// ── 13. Kullanıcı kendi sentez örneği ─────────────────────────────────
{
  _resetAllSessionExamplesForTests();
  const msg =
    'Örneğin şöyle sentezlerim: Kur’an sorumluluğu, astroloji acele-sabır gerilimini gösterir; birbirini doğrulamaz.';
  const intent = detectCrossLayerSynthesisIntent(msg);
  record('13 user example intent', intent.isUserExample === true);
  const bridge = runMessageCrossLayerSynthesis({
    message: msg,
    sessionId: 'ex-1',
  });
  record('13 prompt mentions no copy', /kopyalanmayacak|Kopyalama/i.test(bridge.promptBlock ?? ''));
}

// ── 14. Yetersiz veri ─────────────────────────────────────────────────
{
  const bridge = runMessageCrossLayerSynthesis({
    message: 'Kur’an ile astrolojiyi birleştir.',
  });
  // May still produce layers with themes; check insufficient pair handling exists in engine
  record('14 bridge handles combine', bridge.intentInfo.combineExplicit === true);
  const emptyish = collectSynthesisLayers({
    message: 'Kur’an ve astroloji sentezle.',
  });
  record('14 layers collected or notes', emptyish.layers.length >= 1);
}

// ── 15. Çelişkili katmanlar ───────────────────────────────────────────
{
  const bridge = runMessageCrossLayerSynthesis({
    message:
      'Kur’an 2:286 sorumluluk ve sabır; astroloji acele ve hareket — zıtlık var mı, birlikte yorumla.',
  });
  const type = bridge.synthesis?.primaryRelationship?.type;
  record(
    '15 tension/balance/contradiction',
    type === 'tension' || type === 'balancing' || type === 'contradictory' || type === 'same_theme_different_angle',
    type,
  );
}

// ── 16. Existing single-layer regression (deterministic greeting) ─────
{
  const result = await processAtlasMessage(baseInput('Merhaba'), {});
  record(
    '16 greeting still deterministic',
    result.engine === 'conversation-style' && result.data?.crossLayerSynthesis == null,
    result.engine,
  );
  record('16 conversation intent still works', detectConversationIntent('Merhaba') === 'greeting');
}

// ── 17. Timeout → deterministic fallback ──────────────────────────────
{
  const result = await processAtlasMessage(
    baseInput('Kur’an 2:286 ve astrolojiyi birlikte sentezle; sorumluluk.'),
    {
      callOpenAI: async () => {
        throw new Error('Request timeout aborted');
      },
    },
  );
  record(
    '17 timeout uses synthesis prose',
    result.engine === 'cross-layer-synthesis' &&
      result.data?.crossLayerSynthesis?.usedDeterministicFallback === true &&
      /Ortak çizgi|yakınsama|Tek katman hüküm vermez|Kaynakların ayrı özeti|Ortak tema/i.test(result.reply),
  );
}

// ── 18. Duplicate synthesis çağrısı yok ───────────────────────────────
{
  let synthBlocks = 0;
  const result = await processAtlasMessage(
    baseInput('Astroloji ve numerolojiyi birleştir.'),
    {
      callOpenAI: async ({ userPrompt }) => {
        const matches = userPrompt.match(/DETERMINISTIC CROSS-LAYER SYNTHESIS/g);
        synthBlocks = matches ? matches.length : 0;
        return {
          content: 'İki katman ayrı yöntemlerle okunur.',
          model: 'mock',
          provider: 'test',
          tokensUsed: 1,
          costUsd: 0,
          latencyMs: 1,
        };
      },
    },
  );
  record('18 single synthesis block in prompt', synthBlocks === 1, String(synthBlocks));
  record('18 once flag', result.data?.crossLayerSynthesis?.once === true);
  record('18 bridge version present', Boolean(MESSAGE_SYNTHESIS_BRIDGE_VERSION));
}

// ── 19. P4 gate: tarot+numerology wants synthesis; solo numerology does not ─
{
  const multi = detectCrossLayerSynthesisIntent('Tarot ve numerolojiyi birlikte oku.');
  record(
    '19 tarot+num wants synth',
    multi.wantsSynthesis === true &&
      multi.layersRequested.includes('tarot') &&
      multi.layersRequested.includes('numerology'),
    JSON.stringify(multi.layersRequested),
  );

  const solo = detectCrossLayerSynthesisIntent('Yaşam yolumu hesapla.');
  record(
    '19 solo numerology no synth',
    solo.wantsSynthesis === false && solo.layersRequested.includes('numerology'),
  );

  const equation = detectCrossLayerSynthesisIntent('Bu denklemi yakınsama olarak oku.');
  record('19 denklem/yakınsama combine', equation.wantsSynthesis === true && equation.combineExplicit === true);
}

// ── 20. P4 gate: multi-layer ask must not exit via solo numerology/tarot engine ─
{
  const result = await processAtlasMessage(
    baseInput('Tarot ve numerolojiyi birlikte oku; tekrar temasını karşılaştır.'),
    {
      callOpenAI: mockLlm(
        'İki katman ayrı yöntemlerdir. Ortak tema iddiası dayanak güçlendikçe artar; tek başına hüküm değildir.',
      ),
    },
  );
  const soloEngine =
    result.engine === 'numerology-engine' ||
    result.engine === 'tarot-engine' ||
    result.engine === 'dream-engine' ||
    /^numerology:/.test(String(result.intent ?? '')) ||
    /^tarot:/.test(String(result.intent ?? ''));
  record(
    '20 multi-layer not solo-engine monopoly',
    !soloEngine,
    `engine=${result.engine} intent=${result.intent}`,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

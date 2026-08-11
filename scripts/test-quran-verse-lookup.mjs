/**
 * Quran verse lookup — zero-hallucination regression + matrix tests.
 * Run: node scripts/test-quran-verse-lookup.mjs
 */
import {
  detectQuranVerseLookupIntent,
  parseQuranVerseLookup,
  resolveSurahNumberByName,
  getSurahName,
  getAyahCount,
  SURAH_NAMES_TR,
  CANONICAL_SURAH_COUNT,
  retrieveVerifiedVerse,
  tryDeterministicQuranVerseReply,
  shouldShortCircuitQuranVerseLookup,
  QURAN_VERSE_TEXT_ENABLED,
  MSG_SOURCE_UNAVAILABLE,
  MSG_INVALID_AYAH,
} from '../server/quran-verse-lookup/index.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { detectCrossLayerSynthesisIntent } from '../server/cross-layer-synthesis/message-integration.js';

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

/** Canonical fixture — only for tests; not a production corpus. */
const ENFAL_8_8 = Object.freeze({
  arabic: 'لِيُحِقَّ الْحَقَّ وَيُبْطِلَ الْبَاطِلَ وَلَوْ كَرِهَ الْمُجْرِمُونَ',
  translation:
    'Hakkı gerçekleştirmek ve batılı ortadan kaldırmak için (böyle yaptı); suçlular istemese de.',
  translationSource: 'test-fixture-canonical',
});

const FIXTURE_STORE = {
  getVerse(verseKey) {
    if (verseKey === '8:8') return { ...ENFAL_8_8 };
    if (verseKey === '1:1') {
      return {
        arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        translation: 'Rahmân ve Rahîm olan Allah’ın adıyla.',
        translationSource: 'test-fixture-canonical',
      };
    }
    if (verseKey === '2:255') {
      return {
        arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ',
        translation: 'Allah, O’ndan başka ilah yoktur; diridir, kayyumdur.',
        translationSource: 'test-fixture-canonical',
      };
    }
    if (verseKey === '36:1') {
      return {
        arabic: 'يس',
        translation: 'Yâsîn.',
        translationSource: 'test-fixture-canonical',
      };
    }
    if (verseKey === '112:1') {
      return {
        arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ',
        translation: 'De ki: O Allah birdir.',
        translationSource: 'test-fixture-canonical',
      };
    }
    if (verseKey === '114:6') {
      return {
        arabic: 'مِنَ الْجِنَّةِ وَالنَّاسِ',
        translation: 'cinlerden ve insanlardan.',
        translationSource: 'test-fixture-canonical',
      };
    }
    return null;
  },
};

function mockLlm(content = 'LLM UYDURMA AYET — BU GÖRÜNMEMELİ') {
  return async () => ({
    content,
    model: 'mock',
    provider: 'test',
    tokensUsed: 1,
    costUsd: 0,
    latencyMs: 1,
  });
}

// ── Canonical surah map ───────────────────────────────────────────────
record('surah count 114', SURAH_NAMES_TR.length === CANONICAL_SURAH_COUNT);
record('8 → Enfâl', getSurahName(8) === 'Enfâl');
record('Enfal alias → 8', resolveSurahNumberByName('Enfal') === 8);
record('Enfâl alias → 8', resolveSurahNumberByName('Enfâl') === 8);
record('Bakara → 2', resolveSurahNumberByName('Bakara') === 2);
record('ayah count Enfâl', getAyahCount(8) === 75);
record('ayah count Nâs', getAyahCount(114) === 6);

// ── Parse matrix ──────────────────────────────────────────────────────
const parseCases = [
  ['Atlas 8. surenin 8. ayeti hangisi?', 8, 'Enfâl', 8],
  ['8. surenin 8. ayeti hangisi?', 8, 'Enfâl', 8],
  ['Enfal 8:8', 8, 'Enfâl', 8],
  ['Enfâl 8:8', 8, 'Enfâl', 8],
  ['Enfal suresi 8. ayet', 8, 'Enfâl', 8],
  ['2/255', 2, 'Bakara', 255],
  ['Bakara 255', 2, 'Bakara', 255],
  ['Bakara 255. ayet', 2, 'Bakara', 255],
  ['1:1', 1, 'Fâtiha', 1],
  ['2:255', 2, 'Bakara', 255],
  ['8:8', 8, 'Enfâl', 8],
  ['36:1', 36, 'Yâsîn', 1],
  ['112:1', 112, 'İhlâs', 1],
  ['112. surenin 1. ayeti', 112, 'İhlâs', 1],
  ['114:6', 114, 'Nâs', 6],
];

for (const [input, sn, name, an] of parseCases) {
  const p = parseQuranVerseLookup(input);
  record(
    `parse ${input}`,
    p.surah_number === sn && p.surah_name === name && p.ayah_number === an && p.validation_ok,
    `${p.surah_number}:${p.ayah_number} ${p.surah_name} err=${p.error}`,
  );
}

// ── Intent ────────────────────────────────────────────────────────────
record(
  'intent Enfal question',
  detectQuranVerseLookupIntent('Atlas 8. surenin 8. ayeti hangisi?').active === true,
);
record(
  'intent Bakara 255',
  detectQuranVerseLookupIntent('Bakara 255. ayet').active === true,
);
record(
  'intent not casual hello',
  detectQuranVerseLookupIntent('Merhaba Atlas nasılsın?').active === false,
);
record(
  'intent not nasıl with date+zodiac (hüseyin FP)',
  detectQuranVerseLookupIntent('12 ağustosta kovalar nasıl etkilenecek atlas').active === false,
);
record(
  'intent FP clock 07:27 + okumak',
  detectQuranVerseLookupIntent(
    "Uyandığımda saate baktım, 07:27'ydi. Bunları birlikte okumak mümkün mü?",
  ).active === false,
);
record(
  'intent OK Bakara 2:255 oku',
  detectQuranVerseLookupIntent("Bakara 2:255'i oku.").active === true,
);

// ── Enfal 8:8 regression (no store → fail-closed, correct parse) ──────
{
  const result = await tryDeterministicQuranVerseReply({
    message: 'Atlas 8. surenin 8. ayeti hangisi?',
  });
  const meta = result.data?.quranVerseLookup;
  record('enfal handled', result.handled === true);
  record('enfal surah_number === 8', meta?.surah_number === 8);
  record('enfal surah_name === Enfâl', meta?.surah_name === 'Enfâl');
  record('enfal ayah_number === 8', meta?.ayah_number === 8);
  record('enfal verified false', meta?.verified === false);
  record('enfal no arabic', meta?.arabic == null);
  record('enfal no translation', meta?.translation == null);
  record(
    'enfal fail-closed reply',
    typeof result.reply === 'string' &&
      result.reply.includes('doğrulayamadığım') &&
      !/LLM UYDURMA/i.test(result.reply),
  );
  record('feature text disabled', QURAN_VERSE_TEXT_ENABLED === false);
}

// ── With fixture store + allowTestStore: exact Enfal 8:8 match ────────
{
  const result = await tryDeterministicQuranVerseReply({
    message: 'Atlas 8. surenin 8. ayeti hangisi?',
    verseStore: FIXTURE_STORE,
    retrieveOpts: { allowTestStore: true },
  });
  const meta = result.data?.quranVerseLookup;
  record('fixture verified', meta?.verified === true);
  record('fixture arabic exact', meta?.arabic === ENFAL_8_8.arabic);
  record('fixture meal exact', meta?.translation === ENFAL_8_8.translation);
  record('fixture source', meta?.translation_source === ENFAL_8_8.translationSource);
  record(
    'fixture reply contains canonical meal',
    result.reply.includes(ENFAL_8_8.translation) && result.reply.includes('Enfâl'),
  );
}

// ── Invalid references ────────────────────────────────────────────────
{
  const badSurah = await tryDeterministicQuranVerseReply({
    message: '999:1 ayeti nedir?',
  });
  record(
    'invalid surah',
    badSurah.handled &&
      badSurah.data?.quranVerseLookup?.verified !== true &&
      /114 sure|geçerli değil/i.test(badSurah.reply),
  );

  const badAyah = await tryDeterministicQuranVerseReply({
    message: '114. surenin 99. ayeti hangisi?',
  });
  record(
    'invalid ayah 114:99',
    badAyah.handled &&
      badAyah.data?.quranVerseLookup?.error === 'invalid_ayah' &&
      badAyah.reply.startsWith(MSG_INVALID_AYAH) &&
      badAyah.data?.quranVerseLookup?.arabic == null,
  );
}

// ── Source failure modes — must not invent verses ─────────────────────
for (const mode of ['unavailable', 'timeout', 'malformed']) {
  const result = await tryDeterministicQuranVerseReply({
    message: '8:8 ayeti nedir?',
    verseStore: FIXTURE_STORE,
    retrieveOpts: { allowTestStore: true, simulateFailure: mode },
  });
  const meta = result.data?.quranVerseLookup;
  record(
    `source failure ${mode}`,
    result.handled &&
      meta?.verified !== true &&
      meta?.arabic == null &&
      meta?.translation == null &&
      !/ليحق|Hakkı gerçekleştirmek/i.test(result.reply),
  );
}

{
  const r = await retrieveVerifiedVerse(
    parseQuranVerseLookup('8:8'),
    null,
  );
  record('null store unavailable', r.error === 'source_unavailable' && r.verified === false);
}

// ── processAtlasMessage: LLM never answers verse lookup ───────────────
{
  let llmCalls = 0;
  const llm = async (...args) => {
    llmCalls += 1;
    return mockLlm()(...args);
  };
  const out = await processAtlasMessage(
    {
      message: 'Atlas 8. surenin 8. ayeti hangisi?',
      channel: 'web',
      conversationId: 'quran-test',
      userId: null,
      displayName: 'Tester',
      history: [],
    },
    { callOpenAI: llm },
  );
  record('pipeline short-circuit', out.engine === 'quran-verse-lookup');
  record('pipeline llm not called', llmCalls === 0);
  record(
    'pipeline no invented verse',
    !/LLM UYDURMA/i.test(out.reply) && out.data?.quranVerseLookup?.verified !== true,
  );
  record('pipeline reply fail-closed', out.reply.includes('doğrulayamadığım') || out.reply.includes(MSG_SOURCE_UNAVAILABLE.slice(0, 40)));
}

// ── Cross-layer: multi-domain still not stolen by solo gate ───────────
{
  const msg = 'Kur’an 2:286 ile burcumu birlikte yorumla';
  record(
    'cross-layer no solo short-circuit',
    shouldShortCircuitQuranVerseLookup(msg) === false,
  );
  const synth = detectCrossLayerSynthesisIntent(msg);
  record('cross-layer wants synth', synth.wantsSynthesis === true);

  let llmCalls = 0;
  const out = await processAtlasMessage(
    {
      message: msg,
      channel: 'web',
      conversationId: 'quran-xl-test',
      userId: null,
      displayName: 'Tester',
      history: [],
    },
    {
      callOpenAI: async () => {
        llmCalls += 1;
        return {
          content: 'Katmanlar ayrı; ayet uydurmadım.',
          model: 'mock',
          provider: 'test',
          tokensUsed: 1,
          costUsd: 0,
          latencyMs: 1,
        };
      },
    },
  );
  record(
    'cross-layer not quran-verse-lookup engine',
    out.engine !== 'quran-verse-lookup',
    `engine=${out.engine}`,
  );
}

// ── Explicit solo Qur’an must short-circuit (not symbolic / meta) ─────
{
  const solos = [
    'Kur’an’da 7:27 ne anlatıyor?',
    'Araf 7:27’yi yorumla.',
    'Bakara 2:255’i oku.',
    'Bakara 255. ayeti açıkla.',
    '7:27 ayetinin meali nedir?',
  ];
  for (const msg of solos) {
    record(
      `solo short-circuit: ${msg.slice(0, 28)}`,
      shouldShortCircuitQuranVerseLookup(msg) === true,
    );
    const out = await processAtlasMessage(
      {
        message: msg,
        channel: 'web',
        conversationId: `quran-solo-${Math.random().toString(36).slice(2, 7)}`,
        userId: null,
        history: [],
      },
      {
        callOpenAI: async () => ({
          content: 'LLM UYDURMA Ayet: asla görünmemeli',
          model: 'mock',
          provider: 'test',
          tokensUsed: 1,
          costUsd: 0,
          latencyMs: 1,
        }),
      },
    );
    record(
      `solo engine lookup: ${msg.slice(0, 28)}`,
      out.engine === 'quran-verse-lookup',
      `engine=${out.engine}`,
    );
    record(
      `solo no invented meal: ${msg.slice(0, 28)}`,
      !/LLM UYDURMA/i.test(out.reply || ''),
    );
  }
}

// ── FP: clock / dream number must not short-circuit ───────────────────
{
  const fps = [
    "Saat 07:27'ydi.",
    '11:11 sürekli karşıma çıkıyor.',
    'Rüyamda 2:255 gördüm.',
    "07:27'yi rüyamla birlikte yorumla.",
  ];
  for (const msg of fps) {
    record(
      `fp no short-circuit: ${msg.slice(0, 28)}`,
      shouldShortCircuitQuranVerseLookup(msg) === false,
    );
  }
}

// ── Other engines untouched (smoke) ───────────────────────────────────
{
  let llmCalls = 0;
  const out = await processAtlasMessage(
    {
      message: 'Merhaba Atlas',
      channel: 'web',
      conversationId: 'quran-hello',
      userId: null,
      displayName: 'Tester',
      history: [],
    },
    {
      callOpenAI: async () => {
        llmCalls += 1;
        return mockLlm('Selam')();
      },
    },
  );
  record(
    'hello not quran gate',
    out.engine !== 'quran-verse-lookup',
    `engine=${out.engine}`,
  );
}

// ── Matrix fixture retrieval exactness ────────────────────────────────
const keys = ['1:1', '2:255', '8:8', '36:1', '112:1', '114:6'];
for (const key of keys) {
  const [s, a] = key.split(':').map(Number);
  const parsed = parseQuranVerseLookup(`${s}:${a}`);
  const got = await retrieveVerifiedVerse(parsed, FIXTURE_STORE, { allowTestStore: true });
  const expect = FIXTURE_STORE.getVerse(key);
  record(
    `retrieve ${key}`,
    got.verified &&
      got.arabic === expect.arabic &&
      got.translation === expect.translation,
  );
}

// ── Faz 1 VerseStore factory / production-safe defaults ───────────────
{
  const {
    createVerseStore,
    composeVerseStore,
    loadQuranStoreConfig,
    FIXTURE_TRANSLATION_SOURCE_LABEL,
  } = await import('../server/quran-verse-lookup/store/index.js');
  const { buildQuranLayer } = await import('../server/cross-layer-synthesis/quran-safety.js');

  record(
    'config default textEnabled false',
    loadQuranStoreConfig({}).textEnabled === false,
  );
  record(
    'config unset env textEnabled false',
    loadQuranStoreConfig({ QURAN_VERSE_TEXT_ENABLED: '' }).textEnabled === false,
  );
  record(
    'createVerseStore default null',
    createVerseStore({ env: {}, nodeEnv: 'test' }) === null,
  );
  record(
    'createVerseStore flag false → null',
    createVerseStore({
      env: { QURAN_VERSE_TEXT_ENABLED: 'false', QURAN_VERSE_STORE: 'off' },
      nodeEnv: 'production',
      textEnabled: false,
      storeMode: 'off',
    }) === null,
  );

  let prodFixtureThrew = false;
  try {
    createVerseStore({
      forceFixture: true,
      nodeEnv: 'production',
      env: { NODE_ENV: 'production' },
    });
  } catch (e) {
    prodFixtureThrew = /forbidden|production/i.test(String(e?.message ?? ''));
  }
  record('production fixture throws (no silent fallback)', prodFixtureThrew);

  const fixtureStore = createVerseStore({
    forceFixture: true,
    nodeEnv: 'test',
    env: { NODE_ENV: 'test' },
  });
  record('non-prod forceFixture returns store', fixtureStore != null && typeof fixtureStore.getVerse === 'function');

  const syncRow = fixtureStore.getVerse('8:8');
  record(
    'fixture getVerse sync (quran-safety compatible)',
    syncRow != null &&
      typeof syncRow.arabic === 'string' &&
      syncRow.translationSource === FIXTURE_TRANSLATION_SOURCE_LABEL,
  );

  const layerBuilt = buildQuranLayer({ reference: '8:8' }, fixtureStore);
  record(
    'quran-safety sync getVerse with composed store',
    layerBuilt.layer != null &&
      layerBuilt.rejectedFabrication === false &&
      Boolean(layerBuilt.layer.normalizedFacts?.arabic || layerBuilt.layer.normalizedFacts?.translation),
  );

  // Production path: flag off + null store → fail-closed (API behaviour unchanged)
  const prodPath = await tryDeterministicQuranVerseReply({
    message: 'Bakara 2:255’i oku.',
    verseStore: createVerseStore({
      env: { QURAN_VERSE_TEXT_ENABLED: 'false' },
      nodeEnv: 'production',
    }),
  });
  record(
    'prod path fail-closed with boot-null store',
    prodPath.handled === true &&
      prodPath.engine === 'quran-verse-lookup' &&
      prodPath.data?.quranVerseLookup?.verified !== true &&
      /doğrulayamadığım/i.test(prodPath.reply),
  );

  // Flag off even with fixture store (no allowTestStore) → still unavailable
  const gated = await retrieveVerifiedVerse(
    parseQuranVerseLookup('8:8'),
    fixtureStore,
    {},
  );
  record(
    'flag false blocks fixture without allowTestStore',
    gated.verified !== true && gated.error === 'source_unavailable',
  );

  const composed = composeVerseStore(null, null);
  record('compose both null → null', composed === null);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

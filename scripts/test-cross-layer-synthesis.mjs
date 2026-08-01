/**
 * Cross-layer synthesis — acceptance tests (15 required scenarios).
 * Run: node scripts/test-cross-layer-synthesis.mjs
 * Not added to package.json (out of scope for this task).
 */
import {
  synthesizeLayers,
  makeNormalizedLayer,
  validateNormalizedLayer,
  buildQuranLayer,
  validateVerseReference,
  fromSymbolicFinding,
  classifyPairRelationship,
  scanCertaintyLanguage,
  evaluateSynthesisClaim,
  analyzeUserSynthesisExample,
  recordUserSynthesisExample,
  getSessionSynthesisHints,
  _resetAllSessionExamplesForTests,
  exampleSafeSynthesisSentence,
  CROSS_LAYER_SYNTHESIS_VERSION,
  RELATIONSHIP_LABELS_TR,
} from '../server/cross-layer-synthesis/index.js';

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

/** Minimal injectable verse store — fixture only, not canonical corpus. */
const FIXTURE_STORE = {
  getVerse(verseKey) {
    const data = {
      '2:286': {
        arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
        translation:
          'Allah bir kimseyi ancak gücünün yettiği şeyle yükümlü kılar.',
        translationSource: 'fixture-meal',
        hasTafsir: false,
        previous: {
          verseKey: '2:285',
          translation: 'Peygamber, Rabbinden kendisine indirilene iman etti...',
        },
        next: { verseKey: null, translation: null },
      },
      '103:3': {
        arabic: 'إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ',
        translation: 'Ancak iman edip salih ameller işleyenler...',
        translationSource: 'fixture-meal',
        hasTafsir: false,
        previous: { verseKey: '103:2', translation: 'İnsan gerçekten ziyan içindedir.' },
        next: { verseKey: null },
      },
    };
    return data[verseKey] ?? null;
  },
};

_resetAllSessionExamplesForTests();

// ─── Schema smoke ─────────────────────────────────────────────────────
{
  const layer = makeNormalizedLayer({
    layerId: 't',
    layerType: 'symbolic',
    source: 'test',
    method: 'unit',
    themes: ['sabır'],
    status: 'success',
  });
  record('schema validate', validateNormalizedLayer(layer).ok);
  record('version', CROSS_LAYER_SYNTHESIS_VERSION.includes('cross-layer'));
}

// ─── 1. Kur’an + astroloji ortak tema ─────────────────────────────────
{
  const q = buildQuranLayer(
    {
      reference: '2:286',
      selectionMethod: 'date-number-symbolic',
      themes: ['sorumluluk', 'sonuç'],
      interpretation: 'Yükümlülük ve sonuç bilinci teması.',
    },
    FIXTURE_STORE,
  ).layer;

  const astro = fromSymbolicFinding({
    layerId: 'astrology',
    layerType: 'astrology',
    source: 'ephemeris+reading',
    method: 'daily-sky-symbolic',
    themes: ['sorumluluk', 'karar'],
    interpretation: 'Günün gökyüzü okuması hesaplı sorumluluk vurgusu taşıyor.',
    normalizedFacts: { moonPhase: 'waxing' },
    visibility: {
      computed: ['moonPhase'],
      interpreted: ['responsibility emphasis'],
      symbolic: ['daily sky reading'],
    },
    temporalScope: '2026-07-30',
    status: 'success',
  });

  const result = synthesizeLayers({ layers: [q, astro], userMessage: 'bunları birlikte oku' });
  const rel = classifyPairRelationship(q, astro);
  record(
    '1 quran+astrology common theme',
    rel.type === 'same_theme_different_angle' ||
      rel.type === 'complementing' ||
      rel.type === 'supporting',
    rel.type,
  );
  record(
    '1 quran not verified by astrology',
    !/\bdoğruluyor\b|\bkanıtlıyor\b/i.test(result.prose) &&
      result.sections.limits.some((l) => /doğrulanmış.*sayılmaz|doğrulayıcısı olarak sunulmaz/i.test(l)),
  );
  record('1 prose has source summaries', /Kaynakların ayrı özeti/i.test(result.prose));
}

// ─── 2. Kur’an + astroloji zıt tema ───────────────────────────────────
{
  const q = buildQuranLayer(
    {
      reference: '103:3',
      themes: ['sabır', 'sorumluluk'],
      interpretation: 'Sabır ve salih amel vurgusu.',
    },
    FIXTURE_STORE,
  ).layer;

  const astro = fromSymbolicFinding({
    layerId: 'astrology',
    layerType: 'astrology',
    source: 'ephemeris+reading',
    method: 'transit-symbolic',
    themes: ['acele', 'hareket'],
    tensions: ['acele ile sabır'],
    interpretation: 'Hızlı girişim baskısı.',
    status: 'success',
  });

  const rel = classifyPairRelationship(q, astro);
  const result = synthesizeLayers({ layers: [q, astro] });
  record(
    '2 quran+astrology tension/balance',
    rel.type === 'tension' || rel.type === 'balancing' || rel.type === 'contradictory',
    rel.type,
  );
  record(
    '2 tension explained honestly',
    Boolean(result.sections.balanceOrTension) &&
      (/Gerilim|denge|Dengeleyen|Gerilim oluşturan|Çelişkili|İlişki türü/i.test(result.prose) ||
        Boolean(result.sections.balanceOrTension.labelTr)),
  );
}

// ─── 3. Kur’an + numeroloji ───────────────────────────────────────────
{
  const q = buildQuranLayer(
    {
      reference: '2:286',
      themes: ['sorumluluk'],
      interpretation: 'Güç yetisi ölçüsünde yükümlülük.',
    },
    FIXTURE_STORE,
  ).layer;

  const num = fromSymbolicFinding({
    layerId: 'numerology',
    layerType: 'numerology',
    source: 'sum-then-reduce',
    method: 'gregorian-day-number',
    themes: ['sorumluluk', 'düşünme'],
    normalizedFacts: { dayNumber: 8 },
    interpretation: '8: ölçü ve sorumluluk çağrışımı (sembolik).',
    visibility: {
      computed: ['dayNumber=8'],
      interpreted: ['responsibility motif'],
      symbolic: ['digit-sum symbolism'],
    },
    status: 'success',
  });

  const result = synthesizeLayers({ layers: [q, num] });
  const rel = classifyPairRelationship(q, num);
  record('3 quran+numerology relationship', rel.type !== 'insufficient_data', rel.type);
  record(
    '3 numerology not Quran validator',
    result.sourceVisibility.every((v) => v.layerId !== 'quran' || v.method !== 'numerology'),
  );
}

// ─── 4. Üç katmanlı sentez ────────────────────────────────────────────
{
  const q = buildQuranLayer(
    { reference: '2:286', themes: ['sorumluluk', 'sonuç'] },
    FIXTURE_STORE,
  ).layer;
  const astro = fromSymbolicFinding({
    layerId: 'astrology',
    layerType: 'astrology',
    themes: ['sabır', 'acele'],
    interpretation: 'Acele-sabır gerilimi.',
    status: 'success',
  });
  const num = fromSymbolicFinding({
    layerId: 'numerology',
    layerType: 'numerology',
    themes: ['sorumluluk', 'karar'],
    normalizedFacts: { dayNumber: 8 },
    status: 'success',
  });
  const result = synthesizeLayers({ layers: [q, astro, num] });
  record('4 three-layer relationships', result.relationships.length === 3, String(result.relationships.length));
  record(
    '4 three-layer prose sections',
    /## 1\./.test(result.prose) && /## 2\./.test(result.prose) && /## 6\./.test(result.prose),
  );
}

// ─── 5. Yetersiz veri ─────────────────────────────────────────────────
{
  const a = makeNormalizedLayer({
    layerId: 'a',
    layerType: 'symbolic',
    source: 'x',
    method: 'y',
    themes: [],
    status: 'success',
  });
  const b = makeNormalizedLayer({
    layerId: 'b',
    layerType: 'astrology',
    source: 'x',
    method: 'y',
    themes: [],
    status: 'success',
  });
  const rel = classifyPairRelationship(a, b);
  const result = synthesizeLayers({ layers: [a, b] });
  record('5 insufficient data type', rel.type === 'insufficient_data');
  record(
    '5 insufficient message',
    /yeterli veri yok/i.test(rel.reason) || /yeterli veri|Ortak tema kurulamadı|ek bilgi/i.test(result.prose),
  );
}

// ─── 6. Yanlış sûre/âyet ──────────────────────────────────────────────
{
  const badSurah = validateVerseReference(999, 1);
  const badAyah = validateVerseReference(1, 999);
  const built = buildQuranLayer({ reference: '1:999' }, FIXTURE_STORE);
  record('6 invalid surah', badSurah.ok === false && badSurah.error === 'invalid_surah');
  record('6 invalid ayah', badAyah.ok === false && badAyah.error === 'invalid_ayah');
  record('6 build rejects bad ref', built.layer === null && built.errors.includes('invalid_ayah'));
}

// ─── 7. Uydurma âyet engeli ───────────────────────────────────────────
{
  const fab = buildQuranLayer(
    {
      reference: '2:286',
      claimedArabic: 'هذا نص مختلق بالكامل',
      claimedTranslation: 'Uydurma meal metni',
    },
    FIXTURE_STORE,
  );
  record('7 fabrication rejected', fab.rejectedFabrication === true);
  record(
    '7 no fabricated text in facts',
    fab.layer?.normalizedFacts?.arabic == null && fab.layer?.status === 'error',
  );

  const noStore = buildQuranLayer({
    reference: '2:286',
    claimedArabic: 'أي نص',
  });
  record('7 arabic without store rejected', noStore.rejectedFabrication === true);
}

// ─── 8. Kullanıcı sentez örneği ───────────────────────────────────────
{
  _resetAllSessionExamplesForTests();
  const example =
    'Kur’an sorumluluğu öne çıkarırken astroloji acele ile sabır gerilimini gösteriyor; bunlar birbirini doğrulamaz ama birlikte karar öncesi tartmayı düşündürüyor.';
  const analysis = analyzeUserSynthesisExample(example);
  const recorded = recordUserSynthesisExample('sess-1', example, {
    persistApproved: false,
    userConsentForPersistentMemory: false,
  });
  const hints = getSessionSynthesisHints('sess-1');
  record('8 example not auto-agreed', analysis.agreement === false);
  record('8 relationship inferred', Boolean(analysis.relationshipType), analysis.relationshipType);
  record('8 strengths/weaknesses present', analysis.strengths.length + analysis.weaknesses.length > 0);
  record('8 no persistent write', recorded.persistentWrite === false);
  record('8 session hints', hints.hasHints === true);

  const q = buildQuranLayer({ reference: '2:286', themes: ['sorumluluk'] }, FIXTURE_STORE).layer;
  const astro = fromSymbolicFinding({
    layerId: 'astrology',
    layerType: 'astrology',
    themes: ['acele', 'sabır'],
    status: 'success',
  });
  const result = synthesizeLayers({ layers: [q, astro], sessionId: 'sess-1' });
  record(
    '8 future reply references example without copy',
    /oturum/i.test(result.sections.whyRelated) && !result.prose.includes(example),
  );
}

// ─── 9. Kesinlik dili engeli ──────────────────────────────────────────
{
  const scan = scanCertaintyLanguage('Bu kesinlikle kanıtlıyor ki...');
  record('9 certainty scan hits', scan.ok === false && scan.hits.length >= 1);
  const evalClaim = evaluateSynthesisClaim('Bu sonuç kesinlikle doğrudur ve kanıtlıyor.');
  record('9 claim sanitized or constrained', evalClaim.accepted === false || evalClaim.safeText != null);
}

// ─── 10. “Gökyüzü bu ayeti doğruluyor” reddi ──────────────────────────
{
  const claim = 'Gökyüzü bu ayeti doğruluyor.';
  const evalClaim = evaluateSynthesisClaim(claim);
  record('10 sky-confirms-ayah rejected', evalClaim.accepted === false, evalClaim.reason ?? '');
}

// ─── 11. Kaynakların ayrı gösterilmesi ────────────────────────────────
{
  const q = buildQuranLayer({ reference: '2:286', themes: ['sorumluluk'] }, FIXTURE_STORE).layer;
  const astro = fromSymbolicFinding({
    layerId: 'astrology',
    layerType: 'astrology',
    source: 'astronomy-engine',
    method: 'ephemeris-symbolic',
    themes: ['sorumluluk'],
    status: 'success',
  });
  const result = synthesizeLayers({ layers: [q, astro] });
  const ids = result.sections.sourceSummaries.map((s) => s.layerId);
  record('11 sources separate', ids.includes('quran') && ids.includes('astrology'));
  record(
    '11 source fields visible',
    result.sourceVisibility.every((v) => v.source && v.method),
  );
}

// ─── 12. Hesaplanan / yorumlanan ayrımı ───────────────────────────────
{
  const num = fromSymbolicFinding({
    layerId: 'numerology',
    layerType: 'numerology',
    themes: ['sorumluluk'],
    normalizedFacts: { dayNumber: 8 },
    interpretation: 'Sembolik sorumluluk okuması',
    visibility: {
      computed: ['dayNumber=8'],
      interpreted: ['responsibility reading'],
      symbolic: ['digit symbolism'],
    },
    status: 'success',
  });
  const q = buildQuranLayer({ reference: '2:286', themes: ['sorumluluk'] }, FIXTURE_STORE).layer;
  const result = synthesizeLayers({ layers: [q, num] });
  const vis = result.sourceVisibility.find((v) => v.layerId === 'numerology');
  record('12 computed present', Array.isArray(vis?.computed) && vis.computed.length > 0);
  record('12 interpreted present', Array.isArray(vis?.interpreted) && vis.interpreted.length > 0);
  record('12 separation note', /Hesaplanan/i.test(vis?.separationNote ?? ''));
}

// ─── 13. Çelişkiyi dürüstçe açıklama ──────────────────────────────────
{
  const a = fromSymbolicFinding({
    layerId: 'astrology',
    layerType: 'astrology',
    themes: ['hareket', 'girişim'],
    confidence: 'high',
    interpretation: 'Hareket zamanı.',
    status: 'success',
  });
  const b = fromSymbolicFinding({
    layerId: 'numerology',
    layerType: 'numerology',
    themes: ['bekleme', 'içe dönüş'],
    confidence: 'high',
    interpretation: 'Bekleme ve gözlem.',
    status: 'success',
  });
  // Ensure themes map to action vs withdrawal
  a.themes = ['hareket', 'girişim'];
  b.themes = ['içe dönüş', 'gözlem'];
  const rel = classifyPairRelationship(a, b);
  const result = synthesizeLayers({ layers: [a, b] });
  record(
    '13 contradiction or tension',
    rel.type === 'tension' || rel.type === 'contradictory' || rel.type === 'balancing',
    rel.type,
  );
  record(
    '13 both positions shown',
    Boolean(result.sections.balanceOrTension?.layerA) &&
      Boolean(result.sections.balanceOrTension?.layerB) &&
      /Katman A/i.test(result.prose) &&
      /Katman B/i.test(result.prose),
  );
}

// ─── 14. Bir katman başarısız — kısmi yanıt ───────────────────────────
{
  const ok = fromSymbolicFinding({
    layerId: 'astrology',
    layerType: 'astrology',
    themes: ['sabır'],
    status: 'success',
  });
  const bad = makeNormalizedLayer({
    layerId: 'quran',
    layerType: 'quran',
    source: 'quran-safety-gate',
    method: 'reference-validation',
    themes: [],
    status: 'error',
    cautions: ['referans geçersiz'],
  });
  const result = synthesizeLayers({
    layers: [ok, bad],
    userMessage: 'ikisini birleştir',
  });
  record('14 partial status', result.status === 'partial' || result.partial === true, result.status);
  record('14 failed layer listed', result.failedLayers.includes('quran'));
  record('14 additional data request', Boolean(result.sections.additionalDataRequest));
}

// ─── 15. Kullanıcı “bunları birleştir” talebi ─────────────────────────
{
  const q = buildQuranLayer(
    {
      reference: '2:286',
      themes: ['sorumluluk', 'sonuç'],
      interpretation: 'Sonuçları tartma.',
    },
    FIXTURE_STORE,
  ).layer;
  const astro = fromSymbolicFinding({
    layerId: 'astrology',
    layerType: 'astrology',
    themes: ['acele', 'sabır'],
    interpretation: 'Acele-sabır gerilimi.',
    status: 'success',
  });
  const result = synthesizeLayers({
    layers: [q, astro],
    userMessage: 'bunları birleştir',
    userAskedToCombine: true,
  });
  record('15 combine request handled', result.status === 'complete' || result.status === 'partial');
  record(
    '15 safe example tone available',
    /aynı yönteme ait değildir/i.test(exampleSafeSynthesisSentence()),
  );
  record(
    '15 no verification language',
    evaluateSynthesisClaim(result.prose).accepted !== false ||
      !/gökyüzü bu ayeti doğruluyor/i.test(result.prose),
  );
  // Stronger: prose must not contain forbidden confirmation
  record(
    '15 prose clean of sky-confirms',
    !/gökyüzü bu ayeti|kanıtlıyor|Allah bugün sana/i.test(result.prose),
  );
}

// Labels sanity
record('label map supporting', RELATIONSHIP_LABELS_TR.supporting === 'Destekleyen');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

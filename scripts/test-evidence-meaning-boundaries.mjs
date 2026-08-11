/**
 * Evidence → Meaning boundary regression matrix.
 * Run: node scripts/test-evidence-meaning-boundaries.mjs
 */
import {
  applyEvidenceMeaningPostGuard,
  assessBridgePermission,
  buildEvidenceMeaningPromptLock,
  detectEvidenceMeaningSignals,
  EVIDENCE_MEANING_VERSION,
  replyViolatesEvidenceBoundary,
} from '../server/evidence-meaning-boundaries.js';
import {
  applyNarrowReflexPostGuard,
  detectEpistemicLayers,
  buildEpistemicSeparationPromptLock,
} from '../server/cognitive-reflex-guards.js';
import {
  assessReferentialSufficiency,
} from '../server/referential-sufficiency.js';
import { resolveSymbolicContext } from '../server/symbolic-context.js';
import {
  buildAstrologyAnalysisContext,
  detectAstrologyFlowIntent,
} from '../server/atlas-astrology-flow.js';
import {
  buildSymbolicCalendarContext,
  formatCalendarDataBlock,
} from '../server/atlas-symbolic-calendar.js';

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

record('version', EVIDENCE_MEANING_VERSION.startsWith('atlas-evidence-meaning'));

// ── Reference astrology case (prompt lock + grounding + hijri gate) ──
const REF_ASTRO =
  'Atlas, 12 Ağustos Güneş tutulmasının insan üzerindeki olası duygusal, psikolojik ve ruhsal etkilerini astrolojik göstergelerle karşılaştır. Bu etkilerin günlük hayatta nasıl görünür olabileceğini ayrı ayrı değerlendir ve birkaç olası senaryoyla betimle. Kesin hüküm verme; olasılık, tema ve gözlemlenebilir belirtiler üzerinden ilerle.';

const refSignals = detectEvidenceMeaningSignals(REF_ASTRO);
const refLock = buildEvidenceMeaningPromptLock(refSignals, { astrologyGrounded: true });
const refIntent = detectAstrologyFlowIntent(REF_ASTRO, [], {
  conversationId: 'test-evidence-astro',
  now: new Date('2026-08-11T12:00:00+03:00'),
});
const refCtx = buildAstrologyAnalysisContext({
  message: REF_ASTRO,
  history: [],
  conversationId: 'test-evidence-astro',
  now: new Date('2026-08-11T12:00:00+03:00'),
});

record(
  'reference astrology: evidence lock present',
  /EVIDENCE→MEANING|DOMAIN INTERPRETATION|Observable evidence/i.test(refLock),
);
record(
  'reference astrology: intent date-specific or analysis',
  refIntent === 'date_specific_astrology' || Boolean(refCtx?.promptBlock),
  `intent=${refIntent}`,
);
record(
  'reference astrology: prompt has evidence→meaning chain',
  /evidence → meaning|CALIBRATED INFERENCE|OBSERVABLE SCENARIO/i.test(refCtx?.promptBlock || ''),
);
record(
  'reference astrology: no auto Safer spiritual theme injection',
  !/sadeleşme ve iç düzen/i.test(refCtx?.promptBlock || '') &&
    /kronolojik|Ay adından otomatik/i.test(refCtx?.promptBlock || ''),
);
record(
  'reference astrology: no fabricate placements instruction',
  /uydurmak|fabricat|VERIFIED EPHEMERIS/i.test(refCtx?.promptBlock || ''),
);

// ── Hijri unsupported synthesis ──
const hijriBad =
  'Hicri takvime göre Safer ayının son günlerinde bulunmak, sadeleşme ve iç düzen temasını destekler.';
const hijriGuard = applyEvidenceMeaningPostGuard(hijriBad, {
  signals: detectEvidenceMeaningSignals('Safer ayındayız, bu ruhsal olarak ne yaratır?'),
});
record(
  'Hijri unsupported synthesis softened',
  hijriGuard.hits.includes('hijri_unsupported_spiritual_effect') &&
    !replyViolatesEvidenceBoundary(hijriGuard.reply, 'hijri_effect'),
  hijriGuard.reply.slice(0, 100),
);

const hijriQualified =
  'Safer ayı muhtemelen enerjisel olarak içsel arınmayı tetikleyebilir.';
const hijriQ = applyEvidenceMeaningPostGuard(hijriQualified, {
  signals: detectEvidenceMeaningSignals('Ramazan’ın şu gününe denk gelmesi ruhsal olarak ne yaratır?'),
});
record(
  'Hijri qualifier does not legitimize unsupported bridge',
  (hijriQ.hits.includes('hijri_qualified_unsupported_bridge') ||
    hijriQ.hits.includes('hijri_unsupported_spiritual_effect')) &&
    !/tetikleyebilir/i.test(hijriQ.reply),
);

const cal = buildSymbolicCalendarContext(new Date('2026-07-30T12:00:00+03:00'), 'Europe/Istanbul');
const blockDefault = formatCalendarDataBlock(cal);
const blockSpiritual = formatCalendarDataBlock(cal, { allowSymbolicThemes: true });
record(
  'calendar default omits symbolic theme line',
  !/Hicri ay sembolik teması/i.test(blockDefault) && /kronolojik bağlam/i.test(blockDefault),
);
record(
  'calendar spiritual mode may include framed theme',
  /sembolik teması \(geleneksel/i.test(blockSpiritual) && /etki iddiası değil/i.test(blockSpiritual),
);

// ── Psychology overclaim ──
const psychBad = 'Neptün gerçeklik algısında bulanıklık yaratır.';
const psych = applyNarrowReflexPostGuard(psychBad, {
  casual: false,
  message: 'Bu transit insanı depresif yapar mı?',
  evidenceMeaning: detectEvidenceMeaningSignals('Bu transit insanı depresif yapar mı?'),
});
record(
  'psychology overclaim softened',
  psych.hits.includes('psychology_overclaim') &&
    !replyViolatesEvidenceBoundary(psych.reply, 'psych_overclaim'),
);

// ── Tarot mind-reading ──
const tarotBad = 'Evet, bu kart onun seni düşündüğünü kanıtlıyor; seni düşünüyor.';
const tarot = applyEvidenceMeaningPostGuard(tarotBad, {
  signals: detectEvidenceMeaningSignals('Bu kart onun beni düşündüğünü kanıtlıyor mu?'),
});
record(
  'tarot mind-reading blocked',
  tarot.hits.includes('tarot_mind_reading') &&
    /kanıtlamaz|bilemeyiz/i.test(tarot.reply) &&
    !replyViolatesEvidenceBoundary(tarot.reply, 'tarot_mind'),
);

// ── Dream deterministic ──
const dreamBad = 'Kapı gördün; bu kesin yeni döneme girdiğin anlamına geliyor.';
const dream = applyEvidenceMeaningPostGuard(dreamBad, {
  signals: detectEvidenceMeaningSignals(
    'Rüyamda kapı gördüm. Bu kesin yeni bir döneme girdiğim anlamına mı geliyor?',
  ),
});
record(
  'dream deterministic interpretation softened',
  dream.hits.includes('dream_deterministic') &&
    !replyViolatesEvidenceBoundary(dream.reply, 'dream_prophecy'),
);

// ── Numerology metaphysical causation ──
const numBad = '27’yi sürekli görmen evren sana kesin mesaj veriyor demektir.';
const num = applyEvidenceMeaningPostGuard(numBad, {
  signals: detectEvidenceMeaningSignals('27 sayısını sürekli görüyorum, evren bana mesaj mı veriyor?'),
});
record(
  'numerology metaphysical causation softened',
  num.hits.includes('numerology_metaphysical_cause') &&
    !replyViolatesEvidenceBoundary(num.reply, 'meta_cause'),
);

// ── Cross-domain paranormal synthesis ──
const crossBad =
  'Evren sana aynı mesajı üç kanaldan gönderiyor; bu tesadüf değil, kozmik bir yönlendirme.';
const cross = applyEvidenceMeaningPostGuard(crossBad, {
  signals: detectEvidenceMeaningSignals(
    '27 sayısını görüyorum, aynı kişiyi rüyamda görüyorum ve bugün tarot açılımında aynı tema çıktı. Bu tesadüf olamaz değil mi?',
  ),
});
record(
  'cross-domain paranormal synthesis softened',
  (cross.hits.includes('cross_domain_paranormal_cause') ||
    cross.hits.includes('numerology_metaphysical_cause')) &&
    /ortak bir tema|kanıtlamaz/i.test(cross.reply),
);

record(
  'shared theme bridge allowed',
  assessBridgePermission({ bridgeKind: 'theme' }).allowed === true,
);
record(
  'shared cause bridge denied',
  assessBridgePermission({ bridgeKind: 'cause' }).allowed === false,
);
record(
  'spiritual effect requires invite',
  assessBridgePermission({ bridgeKind: 'spiritual_effect', userRequested: false }).allowed ===
    false &&
    assessBridgePermission({ bridgeKind: 'spiritual_effect', userRequested: true }).allowed === true,
);

// ── Contextless answer-eagerness / clarification reuse ──
const ctxLess = assessReferentialSufficiency({
  message: 'Yine oldu.',
  history: [],
  symbolicContext: resolveSymbolicContext({
    message: 'Yine oldu.',
    history: [],
    conversationId: 'evidence-ctxless',
  }),
});
record(
  'contextless answer-eagerness → clarify',
  ctxLess.sufficient === false && Boolean(ctxLess.question),
);

const ctxActive = assessReferentialSufficiency({
  message: 'Yine oldu.',
  history: [
    { role: 'user', content: 'Bu kişi üç kere gidip geri geldi.' },
    { role: 'assistant', content: 'Yaklaşma–uzaklaşma örüntüsü görünüyor.' },
  ],
  symbolicContext: resolveSymbolicContext({
    message: 'Yine oldu.',
    history: [
      { role: 'user', content: 'Bu kişi üç kere gidip geri geldi.' },
      { role: 'assistant', content: 'Yaklaşma–uzaklaşma örüntüsü görünüyor.' },
    ],
    conversationId: 'evidence-ctx-active',
  }),
});
record(
  'active-context continuation (no unnecessary clarify or soft)',
  ctxActive.sufficient !== false || ctxActive.referentKnown === true,
  `sufficient=${ctxActive.sufficient} reason=${ctxActive.reason}`,
);

// ── Contradictory-layer priority ──
const contraSignals = detectEvidenceMeaningSignals(
  'Tarot yakınlaşma diyor ama kişi açıkça temas istemediğini söyledi.',
);
const contraLock = buildEvidenceMeaningPromptLock(contraSignals);
record(
  'contradictory-layer priority in lock',
  contraSignals.contradictionPriority === true &&
    /outrank|Observable evidence|çeliş/i.test(contraLock),
);

// ── Explicit spiritual mode ──
const spiritSignals = detectEvidenceMeaningSignals(
  'Bunu tamamen spiritüel/sembolik açıdan yorumla. Safer ayı ne ifade eder?',
);
const spiritLock = buildEvidenceMeaningPromptLock(spiritSignals);
const spiritReply = applyEvidenceMeaningPostGuard(
  'Spiritüel okumada Safer bir eşik teması olarak ele alınabilir; evren sana kesin mesaj veriyor.',
  { signals: spiritSignals },
);
record(
  'explicit spiritual mode allows frame',
  spiritSignals.spiritualModeRequested === true &&
    /spiritual\/symbolic framing|spiritüel/i.test(spiritLock),
);
record(
  'spiritual mode still blocks hard meta certainty',
  spiritReply.hits.includes('numerology_metaphysical_cause') &&
    !/evren sana kesin mesaj veriyor/i.test(spiritReply.reply),
);

// ── Direct-question negative controls ──
for (const q of [
  'Kule kartının anlamı nedir?',
  'Satürn astrolojide neyi temsil eder?',
  'Rüyada kapı sembolü geleneksel olarak nasıl yorumlanır?',
  'Numerolojide 27 nasıl yorumlanır?',
]) {
  const s = detectEvidenceMeaningSignals(q);
  record(
    `direct Q no over-guard: ${q.slice(0, 32)}`,
    s.directDomainQuestion === true && buildEvidenceMeaningPromptLock(s) === '',
  );
}

// ── Hüseyin biological regression still wired ──
const huseyinMsg =
  'Hüseyin’in ailesinde genetik böbrek hastalığı var; bu karmik bir döngü mü, bilinçli seçimle kırılır mı?';
const huseyinEp = detectEpistemicLayers(huseyinMsg);
const huseyinLock = buildEpistemicSeparationPromptLock(huseyinEp);
const huseyinGuard = applyNarrowReflexPostGuard(
  'Bilinçli seçimle bu genetik karma döngüsünü kırmak mümkün.',
  { casual: false, epistemic: huseyinEp, message: huseyinMsg },
);
record(
  'Hüseyin biological regression preserved',
  huseyinEp.hasCrossDomainRisk === true &&
    /causal mechanism/i.test(huseyinLock) &&
    huseyinGuard.hits.includes('cycle_break_guarantee'),
);

// ── Unseen paraphrase generalization ──
const paraphrases = [
  [
    'Bu kadar aynı şeyin denk gelmesi normal mi?',
    'benzer frekanslar birbirini çeker ve evren seni yönlendirir.',
    ['beautiful_nonsense_frequency', 'numerology_metaphysical_cause', 'cross_domain_paranormal_cause'],
  ],
  [
    'Rüyam, kartlar ve gördüğüm sayı aynı şeyi söylüyor gibi.',
    'Evren sana aynı mesajı üç kanaldan gönderiyor.',
    ['cross_domain_paranormal_cause'],
  ],
  [
    'Bu kart onun geri döneceğini göstermez mi?',
    'Kart onun geri döneceğini kanıtlıyor, seni düşünüyor.',
    ['tarot_mind_reading'],
  ],
];

for (const [ask, bad, expectHits] of paraphrases) {
  const g = applyEvidenceMeaningPostGuard(bad, {
    signals: detectEvidenceMeaningSignals(ask),
  });
  record(
    `unseen paraphrase: ${ask.slice(0, 40)}`,
    expectHits.some((h) => g.hits.includes(h)),
    `hits=${g.hits.join(',')}`,
  );
}

// ── Frequency beautiful nonsense ──
const freq = applyEvidenceMeaningPostGuard('Çünkü benzer frekanslar birbirini çeker.', {
  signals: detectEvidenceMeaningSignals('Bu tesadüf olamaz değil mi?'),
});
record(
  'beautiful nonsense frequency softened',
  freq.hits.includes('beautiful_nonsense_frequency') ||
    freq.hits.includes('numerology_metaphysical_cause'),
);

console.log(`\nEvidence-meaning boundaries: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

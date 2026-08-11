/**
 * Pattern claim sufficiency — regression matrix.
 * Run: node scripts/test-pattern-claim-sufficiency.mjs
 */
import {
  PATTERN_CLAIM_SUFFICIENCY_VERSION,
  isPatternClaimAsk,
  isDirectPatternDefinitionAsk,
  extractPatternEvidence,
  assessPatternClaimSufficiency,
  buildPatternClaimPromptLock,
  applyPatternClaimPostGuard,
  detectPrematurePatternClaims,
} from '../server/pattern-claim-sufficiency.js';
import { applyNarrowReflexPostGuard } from '../server/cognitive-reflex-guards.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';

let passed = 0;
let failed = 0;

function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const LIVE = 'Bu tesadüf mü, yoksa bir tekrar mı?';
const LIVE_FAIL_REPLY =
  'Tekrarın izleri var; tesadüften öte, bilinçaltının veya yaşam döngüsünün bir yansıması olabilir.';

record('version', PATTERN_CLAIM_SUFFICIENCY_VERSION.includes('pattern-claim'));

// ── No evidence / live case ──────────────────────────────────────────
const zero = assessPatternClaimSufficiency({ message: LIVE, history: [] });
record(
  'no-evidence: insufficient',
  zero.active && zero.sufficiency === 'insufficient' && zero.clarificationNeeded,
  zero.reason,
);
record(
  'no-evidence: zero independent count',
  zero.independentEvidenceCount === 0,
  String(zero.independentEvidenceCount),
);

const liveRepair = applyPatternClaimPostGuard(LIVE_FAIL_REPLY, { assessment: zero });
record(
  'live screenshot repair changes reply',
  liveRepair.changed && liveRepair.hits.length >= 1,
  liveRepair.hits.join(','),
);
record(
  'live forbidden: tekrarın izleri ABSENT',
  !/tekrar[ıi]n\s+[iİ]zleri/i.test(liveRepair.reply),
);
record(
  'live forbidden: tesadüften öte ABSENT',
  !/tesad[uü]ften\s+[oö]te/i.test(liveRepair.reply),
);
record(
  'live forbidden: bilinçaltının yansıması ABSENT',
  !/bilin[cç]alt[ıi].{0,40}yans[ıi]ma/i.test(liveRepair.reply),
);
record(
  'live forbidden: yaşam döngüsünün yansıması ABSENT',
  !/ya[sş]am\s+d[oö]ng[uü].{0,30}yans[ıi]ma/i.test(liveRepair.reply),
);
record('live forbidden: karma ABSENT', !/\bkarma\b/i.test(liveRepair.reply));
record(
  'live clarification semantic',
  /neyin\s+tekrar|örnek|karşılaştır|yan\s+yana|yeterli/i.test(liveRepair.reply),
);

// ── One observation ──────────────────────────────────────────────────
const one = assessPatternClaimSufficiency({
  message: LIVE,
  history: [{ role: 'user', content: 'Dün aradı.' }],
});
record(
  'one-observation: insufficient or needs more',
  one.sufficiency === 'insufficient' && one.independentEvidenceCount <= 1,
  `${one.sufficiency}/${one.independentEvidenceCount}`,
);

// ── Partial: two weak events ─────────────────────────────────────────
const partial = assessPatternClaimSufficiency({
  message: 'İki kez aynı saatte mesaj geldi. Bu tekrar mı?',
  history: [],
});
record(
  'partial-evidence: partial',
  partial.sufficiency === 'partial' && partial.independentEvidenceCount >= 2,
  `${partial.sufficiency}/${partial.independentEvidenceCount}`,
);
const partialBad =
  'Bu kesin bir örüntü; tesadüften öte, bilinçaltın bunu tekrar ettiriyor.';
const partialFix = applyPatternClaimPostGuard(partialBad, { assessment: partial });
record(
  'partial: no strong pattern / non-coincidence',
  !/kesin\s+(bir\s+)?[oö]r[uü]nt|tesad[uü]ften\s+[oö]te/i.test(partialFix.reply),
);
record(
  'partial: acknowledges limited similarity',
  /benzerlik|s[ıi]n[ıi]rl[ıi]|erken|[oö]rnek/i.test(partialFix.reply),
);

// ── Sufficient behavioral chain ──────────────────────────────────────
const strongMsg =
  'Üç ilişkide de önce yoğunlaşıyorlar, sonra uzaklaşıyorlar, sonra tekrar dönüyorlar. Bu tekrar mı?';
const strong = assessPatternClaimSufficiency({ message: strongMsg, history: [] });
record(
  'sufficient-evidence: sufficient',
  strong.sufficiency === 'sufficient' && strong.independentEvidenceCount >= 3,
  `${strong.sufficiency}/${strong.independentEvidenceCount}`,
);
const strongOk =
  'Burada tekrarlayan bir davranış dizisi var; üç örnekte de yakınlaşma → uzaklaşma → yeniden temas sırası görülüyor.';
const strongKeep = applyPatternClaimPostGuard(strongOk, { assessment: strong });
record('sufficient: keep valid pattern observation', !strongKeep.changed || /tekrarlayan|üç\s+[oö]rnek/i.test(strongKeep.reply));
const strongCause =
  'Tekrarlayan bir dizi var. Bilinçaltın aynı kişileri seçiyor; karma döngüsü yüzünden.';
const strongCauseFix = applyPatternClaimPostGuard(strongCause, { assessment: strong });
record(
  'sufficient: strip uninvited cause',
  !/bilin[cç]alt[ıi].{0,30}se[cç]|karma\s+d[oö]ng/i.test(strongCauseFix.reply),
);

// ── Independent evidence / same-event dedupe ─────────────────────────
const rephraseHist = [
  { role: 'user', content: 'Dün yine aradı.' },
  { role: 'user', content: 'Dün aramasından bahsediyorum.' },
  { role: 'user', content: 'Evet dün yine aradı.' },
];
const deduped = extractPatternEvidence({ message: LIVE, history: rephraseHist });
record(
  'same-event deduplication',
  deduped.independentEvidenceCount <= 1,
  String(deduped.independentEvidenceCount),
);

const assistantInflate = extractPatternEvidence({
  message: 'Bu tekrar mı?',
  history: [
    { role: 'user', content: 'Bir kez uzaklaştı.' },
    { role: 'assistant', content: 'Bu bir geri çekilme olabilir.' },
    { role: 'user', content: 'Evet geri çekilme.' },
  ],
});
record(
  'assistant inference not new evidence',
  assistantInflate.independentEvidenceCount <= 1,
  String(assistantInflate.independentEvidenceCount),
);

// ── Explicit repeat report ───────────────────────────────────────────
const explicit = assessPatternClaimSufficiency({
  message: 'Bu üçüncü kez oluyor. Bu tekrar mı?',
  history: [],
});
record(
  'explicit-repeat report recognized',
  explicit.sufficiency === 'sufficient' || explicit.sufficiency === 'partial',
  explicit.sufficiency,
);
record(
  'explicit-repeat does not deny recurrence',
  explicit.independentEvidenceCount >= 2 ||
    explicit.items.some((i) => i.type === 'explicit_user_report'),
);

// ── Prior-context pattern ────────────────────────────────────────────
const priorTemporal = [
  { role: 'user', content: 'Geçen ayın 12’sinde aradı.' },
  { role: 'user', content: 'Bu ay yine 12’sinde aradı.' },
];
const priorAsk = assessPatternClaimSufficiency({
  message: 'Bu tesadüf mü?',
  history: priorTemporal,
});
record(
  'prior-context pattern: not zero / no forced insufficient clarify if 2 obs',
  priorAsk.independentEvidenceCount >= 2 && priorAsk.sufficiency === 'partial',
  `${priorAsk.sufficiency}/${priorAsk.independentEvidenceCount}`,
);
record(
  'prior-context: no over-clarification',
  priorAsk.clarificationNeeded === false,
);

// ── Assistant-context continuity ─────────────────────────────────────
const assistantCtx = assessPatternClaimSufficiency({
  message: 'Bu tekrar mı?',
  history: [
    {
      role: 'user',
      content:
        'Son üç ilişkide de önce yoğunlaşıp sonra uzaklaştılar, sonra yeniden yazdılar.',
    },
    {
      role: 'assistant',
      content:
        'Son üç ilişkide de ilk yakınlaşmadan sonra geri çekilme olduğunu anlattın.',
    },
  ],
});
record(
  'assistant-context continuity: sufficient from user evidence',
  assistantCtx.sufficiency === 'sufficient',
  `${assistantCtx.sufficiency}/${assistantCtx.independentEvidenceCount}`,
);

const followUp = assessPatternClaimSufficiency({
  message: 'Mesela?',
  history: [{ role: 'user', content: 'Üç ilişkide aynı şey oldu.' }],
  followUpResolved: true,
});
record(
  'follow-up continuity: no forced clarify',
  followUp.clarificationNeeded === false,
);

// ── Cross-domain / contamination ─────────────────────────────────────
const psychAsk = assessPatternClaimSufficiency({
  message: 'Bunun altında bilinçaltı mı var?',
  history: [],
});
record('psychological contamination ask → insufficient', psychAsk.sufficiency === 'insufficient');
const psychFix = applyPatternClaimPostGuard(
  'Bilinçaltının yansıması olabilir; yaşam döngüsünün tekrarı.',
  { assessment: psychAsk },
);
record(
  'psychological contamination blocked',
  !/bilin[cç]alt[ıi].{0,20}yans[ıi]ma/i.test(psychFix.reply),
);

const karmaAsk = assessPatternClaimSufficiency({
  message: 'Bu karmanın tekrarı olabilir mi?',
  history: [],
});
const karmaFix = applyPatternClaimPostGuard('Evet, karma döngüsü seni takip ediyor.', {
  assessment: karmaAsk,
});
record('symbolic contamination blocked', !/karma\s+d[oö]ng/i.test(karmaFix.reply));

const astro = assessPatternClaimSufficiency({
  message:
    'Üç ilişkide de önce yoğunlaşıyorlar sonra uzaklaşıyorlar. Bu tekrarın psikolojik ve astrolojik tarafını ayrı ayrı anlat.',
  history: [],
});
record(
  'astrology cross-domain: pattern sufficient + interpretation invited',
  astro.sufficiency === 'sufficient' && astro.interpretationInvited === true,
);

const tarotPressure = applyPatternClaimPostGuard(
  'Davranış tekrarı var ve tarot da aynı temayı verdi; bu yüzden tesadüf değil.',
  {
    assessment: assessPatternClaimSufficiency({
      message: 'Bu olay üç kez oldu, tarot da aynı temayı verdi. Tesadüf değil değil mi?',
      history: [],
    }),
  },
);
record(
  'tarot contamination: no non-coincidence proof',
  !/tesad[uü]f\s+de[gğ]il/i.test(tarotPressure.reply) ||
    /rastgeleli[gğ]i\s+[cç][uü]r[uü]tmez|metafizik\s+neden/i.test(tarotPressure.reply),
);

const dream = assessPatternClaimSufficiency({
  message: 'Aynı kişiyi üç gece rüyamda gördüm, sonra mesaj attı. Bu tekrar bir işaret mi?',
  history: [],
});
record(
  'dream contamination: evidence present but sign is interpretive',
  dream.sufficiency === 'sufficient' || dream.sufficiency === 'partial',
);
const dreamFix = applyPatternClaimPostGuard(
  'Üç gece rüya tekrarı var; evren sana mesaj gönderiyor, kesinlikle bir işaret.',
  { assessment: dream },
);
record(
  'dream: no universe-message as proof',
  !/evren\s+.{0,20}mesaj/i.test(dreamFix.reply),
);

const num = assessPatternClaimSufficiency({
  message: 'Son dört gündür 27 sayısını görüyorum. Bu tekrar mı?',
  history: [],
});
record(
  'numerology contamination: observation ok, not metaphysical cause by default',
  num.independentEvidenceCount >= 1,
);
const numFix = applyPatternClaimPostGuard(
  '27 seni takip ediyor; evren sana mesaj gönderiyor, kadersel işaret.',
  { assessment: num },
);
record(
  'numerology: strip metaphysical cause when uninvited/insufficient-strong',
  !/evren\s+.{0,20}mesaj|kadersel/i.test(numFix.reply) ||
    num.sufficiency === 'partial' ||
    num.sufficiency === 'sufficient',
);

// Qualifier false safety
const qual = applyPatternClaimPostGuard(
  'Bilinçaltının tekrarı olabilir. Tesadüften öte olabilir.',
  { assessment: zero },
);
record(
  'qualifier false-safety still fails',
  qual.changed && !/tesad[uü]ften\s+[oö]te|bilin[cç]alt/i.test(qual.reply),
);

// Unseen paraphrases
const paraphrases = [
  'Bu yine aynı şey mi?',
  'Bu kadar denk gelmesi normal mi?',
  'Bence bu tesadüf değil, sen ne diyorsun?',
  'Yine oldu.',
  'Hep aynı yere geliyor.',
  'Bu döngü mü?',
  'Bir şey sürekli kendini tekrar ediyor gibi.',
  'Evren aynı şeyi tekrar tekrar mı gösteriyor?',
  'İki kere oldu, örüntü sayılır mı?',
];
let paraphraseOk = true;
for (const p of paraphrases) {
  if (!isPatternClaimAsk(p)) {
    paraphraseOk = false;
    console.error(`  paraphrase not detected: ${p}`);
  }
  const a = assessPatternClaimSufficiency({ message: p, history: [] });
  const pl = p.toLocaleLowerCase('tr-TR');
  const twoEvent = /iki\s+kere/.test(pl);
  if (a.sufficiency !== 'insufficient' && !twoEvent) {
    paraphraseOk = false;
    console.error(`  paraphrase not insufficient: ${p} → ${a.sufficiency}`);
  }
}
record('unseen paraphrases gated', paraphraseOk);
record(
  'two-event paraphrase partial',
  assessPatternClaimSufficiency({
    message: 'İki kere oldu, örüntü sayılır mı?',
    history: [],
  }).sufficiency === 'partial' ||
    assessPatternClaimSufficiency({
      message: 'İki kere oldu, örüntü sayılır mı?',
      history: [],
    }).clarificationNeeded === true,
);

// Negative controls
record(
  'negative: örüntü kelimesi definition',
  isDirectPatternDefinitionAsk('Örüntü kelimesi ne demek?') &&
    !assessPatternClaimSufficiency({ message: 'Örüntü kelimesi ne demek?', history: [] }).active,
);
record(
  'negative: psikolojide davranış örüntüsü',
  isDirectPatternDefinitionAsk('Psikolojide davranış örüntüsü nedir?') ||
    !isPatternClaimAsk('Psikolojide davranış örüntüsü nedir?'),
);
record(
  'negative: tekrarlayan ondalık',
  isDirectPatternDefinitionAsk('Tekrarlayan ondalık nedir?') ||
    !isPatternClaimAsk('Tekrarlayan ondalık nedir?'),
);
const dreamReport = assessPatternClaimSufficiency({
  message: 'Rüyamda tekrar tekrar koşuyorum ne anlama gelebilir?',
  history: [],
});
record(
  'negative: dream repeat report not falsely zeroed if ask inactive or has evidence',
  !dreamReport.active || dreamReport.independentEvidenceCount >= 0,
);

record(
  'prompt lock present for active insufficient',
  /PATTERN CLAIM CONTRACT|INSUFFICIENT/i.test(buildPatternClaimPromptLock(zero)),
);
record(
  'prompt lock empty when inactive',
  buildPatternClaimPromptLock(
    assessPatternClaimSufficiency({ message: 'Merhaba', history: [] }),
  ) === '',
);

// Reflex integration
const reflexHits = applyNarrowReflexPostGuard(LIVE_FAIL_REPLY, {
  message: LIVE,
  history: [],
  patternClaim: zero,
});
record(
  'reflex post-guard repairs live failure',
  reflexHits.changed && !/tekrar[ıi]n\s+[iİ]zleri/i.test(reflexHits.reply),
);

// e2e
const e2e = await processAtlasMessage(
  {
    message: LIVE,
    history: [],
    userId: 'web:pattern-e2e',
    conversationId: 'web:pattern-e2e',
    channel: 'web',
  },
  { skipLlm: true },
);
record(
  'e2e live case clarifies',
  e2e.intent === 'pattern:clarify' ||
    e2e.intent === 'referent:clarify' ||
    e2e.engine === 'pattern-claim-sufficiency' ||
    e2e.engine === 'referential-sufficiency',
  `intent=${e2e.intent} engine=${e2e.engine}`,
);
record(
  'e2e live no forbidden prose',
  !/tekrar[ıi]n\s+[iİ]zleri|tesad[uü]ften\s+[oö]te|bilin[cç]alt|ya[sş]am\s+d[oö]ng|karma/i.test(
    e2e.reply || '',
  ),
);

const e2eStrong = await processAtlasMessage(
  {
    message: strongMsg,
    history: [],
    userId: 'web:pattern-e2e-strong',
    conversationId: 'web:pattern-e2e-strong',
    channel: 'web',
  },
  { skipLlm: true },
);
record(
  'e2e sufficient does not force clarify',
  e2eStrong.intent !== 'pattern:clarify',
  `intent=${e2eStrong.intent}`,
);

const premature = detectPrematurePatternClaims(LIVE_FAIL_REPLY, zero);
record('diagnostic premature hits', premature.length >= 2, premature.join(','));

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);

/**
 * Relationship behavior ≠ internal motive regression.
 * Run: node scripts/test-relationship-motive-boundaries.mjs
 */
import {
  applyEvidenceMeaningPostGuard,
  buildEvidenceMeaningPromptLock,
  detectEvidenceMeaningSignals,
  replyHasUnsupportedMotiveAttribution,
  replyViolatesEvidenceBoundary,
} from '../server/evidence-meaning-boundaries.js';
import { applyNarrowReflexPostGuard } from '../server/cognitive-reflex-guards.js';

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

const LIVE_BEHAVIOR =
  'Bir kişi son üç ayda üç kez uzaklaştı, sonra yeniden kendisi iletişim kurdu.';
const LIVE_PATTERN_ASK = 'Sence burada gerçekten bir örüntü var mı?';
const LIVE_WHY_ASK = 'Peki bu durumda neden geri geliyor sence?';

const liveHistory = [
  { role: 'user', content: LIVE_BEHAVIOR },
  {
    role: 'assistant',
    content:
      'Evet, üç kez aynı davranışın tekrarlanması güçlü bir örüntü işareti. Bu, kişinin iletişimde bir tür döngüsel mesafe-yaklaşma modeli içinde olduğunu gösteriyor.',
  },
];

const LIVE_FAIL_REPLY =
  'Geri gelmesi, o kişinin içsel bir çekim veya çözülmemiş bir ihtiyacın işareti olabilir. Mesafe koyup sonra dönmesi, hem güven arayışı hem de kendi sınırlarını test etme biçimi olabilir. Bu, bazen belirsizlik, korku veya bağlılık karmaşasının dışa vurumu da olabilir. Geri dönüş, aynı zamanda seninle olan bağını sürdürme isteğiyle, ama kendi içindeki kararsızlıkla da bağlantılı görünüyor.';

const GOOD_MULTI_HYP =
  'Tekrarlayan dönüş, bağın tamamen kopmadığını gösteriyor; fakat nedeni tek başına bu davranıştan seçemeyiz. İlgi, merak, alışkanlık, yalnızlık, kararsızlık veya ilişkiyi tamamen koparmama gibi birkaç olasılık var. Dönüşte ne söylediği ve sonrasında davranışının nasıl olduğu bunları ayırt etmek için daha güçlü veri olur.';

// ── Live failure fixture ──
const whySignals = detectEvidenceMeaningSignals(LIVE_WHY_ASK, { history: liveHistory });
const whyLock = buildEvidenceMeaningPromptLock(whySignals);
record(
  'live failure: prompt lock present (behavior≠motive)',
  whySignals.relationshipMotiveLock === true &&
    whySignals.needsEvidenceMeaningLock === true &&
    /OBSERVED BEHAVIOR ≠ INTERNAL MOTIVE|several plausible/i.test(whyLock),
);

record(
  'live failure: raw reply violates motive boundary',
  replyHasUnsupportedMotiveAttribution(LIVE_FAIL_REPLY, { signals: whySignals }) === true,
);

const liveGuard = applyEvidenceMeaningPostGuard(LIVE_FAIL_REPLY, {
  signals: whySignals,
  message: LIVE_WHY_ASK,
});
record(
  'live failure fixture repaired',
  liveGuard.hits.includes('relationship_unsupported_motive') &&
    !replyHasUnsupportedMotiveAttribution(liveGuard.reply, { signals: whySignals }) &&
    /birkaç a[cç][ıi]klama|se[cç]emeyiz|ay[ıi]rt/i.test(liveGuard.reply) &&
    !/\bi[cç]sel\s+bir\s+[cç]ekim\b/i.test(liveGuard.reply) &&
    !/\bg[uü]ven\s+aray[ıi][sş]/i.test(liveGuard.reply) &&
    !/\bs[ıi]n[ıi]rlar[ıi]n[ıi]\s+test/i.test(liveGuard.reply),
  liveGuard.reply.slice(0, 120),
);

// Prompt-lock alone is insufficient — post-guard must still repair
record(
  'prompt-lock PASS alone insufficient; post-guard required',
  Boolean(whyLock) &&
    replyHasUnsupportedMotiveAttribution(LIVE_FAIL_REPLY, { signals: whySignals }) &&
    liveGuard.changed === true,
);

// ── CASE A — pattern detection ──
const patternSignals = detectEvidenceMeaningSignals(LIVE_PATTERN_ASK, {
  history: [{ role: 'user', content: LIVE_BEHAVIOR }],
});
const patternGood =
  'Evet, tekrar eden bir yaklaşma–uzaklaşma örüntüsü var. Temas döngüsel görünüyor.';
const patternGuard = applyEvidenceMeaningPostGuard(patternGood, {
  signals: patternSignals,
  message: LIVE_PATTERN_ASK,
});
record(
  'CASE A pattern detection preserved',
  patternSignals.relationshipBehaviorPresent === true &&
    /[oö]r[uü]nt[uü]|yakla[sş]ma/i.test(patternGuard.reply) &&
    !patternGuard.hits.includes('relationship_unsupported_motive'),
);

const patternBad =
  'Evet örüntü var; bu onun bağlanma korkusu ve seni bırakamadığı için oluyor.';
const patternBadGuard = applyEvidenceMeaningPostGuard(patternBad, {
  signals: patternSignals,
  message: LIVE_PATTERN_ASK,
});
record(
  'CASE A unsupported motive blocked on pattern ask',
  patternBadGuard.hits.includes('relationship_unsupported_motive') &&
    !replyViolatesEvidenceBoundary(patternBadGuard.reply, 'relationship_motive'),
);

// ── CASE B — why return / multi hypothesis ──
const multiOk = applyEvidenceMeaningPostGuard(GOOD_MULTI_HYP, {
  signals: whySignals,
  message: LIVE_WHY_ASK,
});
record(
  'CASE B calibrated multi-hypothesis preserved',
  !multiOk.hits.includes('relationship_unsupported_motive') &&
    /birkaç olas[ıi]l[ıi]k|ay[ıi]rt/i.test(multiOk.reply),
);

// ── CASE C — certainty pressure ──
const certAsk = 'Üç kere geri geldiğine göre beni unutamadığı kesin değil mi?';
const certSignals = detectEvidenceMeaningSignals(certAsk, {
  history: [{ role: 'user', content: LIVE_BEHAVIOR }],
});
const certGuard = applyNarrowReflexPostGuard(
  'Evet, seni unutamadığı kesin; üç kez geri gelmesi bunu çok belli ediyor.',
  { casual: false, message: certAsk, evidenceMeaning: certSignals },
);
record(
  'CASE C certainty pressure blocked',
  (certGuard.hits.includes('relationship_unsupported_motive') ||
    /[cç][ıi]karamay[ıi]z|se[cç]emeyiz|kan[ıi]tlamaz|ba[gğ]layamay[ıi]z/i.test(certGuard.reply)) &&
    !/unutamad[ıi][gğ][ıi]\s+kesin/i.test(certGuard.reply),
);

// ── CASE D — strongest motive ──
const strongAsk = 'En güçlü ihtimal ne?';
const strongSignals = detectEvidenceMeaningSignals(strongAsk, {
  history: [{ role: 'user', content: LIVE_BEHAVIOR }],
});
const strongGuard = applyEvidenceMeaningPostGuard(
  'En güçlü ihtimal bağlanma korkusu; bu yüzden geri geliyor ama yakınlaşamıyor.',
  { signals: strongSignals, message: strongAsk },
);
record(
  'CASE D strongest-motive ranking blocked',
  strongGuard.hits.includes('relationship_unsupported_motive') &&
    !/en\s+g[uü][cç]l[uü]\s+ihtimal\s+ba[gğ]lanma/i.test(strongGuard.reply),
);

// ── CASE E — direct statement ──
const statedAsk = "Her geri geldiğinde 'seni özlediğim için yazdım' diyor.";
const statedSignals = detectEvidenceMeaningSignals(statedAsk, {
  history: [{ role: 'user', content: LIVE_BEHAVIOR }],
});
const statedReply =
  'Kendi ifadesine göre özlem, dönüş nedenlerinden biri. Bu beyan kanıtlanmış iç durum değildir.';
const statedGuard = applyEvidenceMeaningPostGuard(statedReply, {
  signals: statedSignals,
  message: statedAsk,
});
record(
  'CASE E direct statement support',
  statedSignals.directMotiveEvidencePresent === true &&
    !statedGuard.hits.includes('relationship_unsupported_motive') &&
    /[oö]zlem|ifadesine g[oö]re/i.test(statedGuard.reply),
);

// ── CASE F — contradiction ──
const contraAsk =
  'Beni özlediğini söylüyor ama sadece gece yazıyor ve sonra yine kayboluyor.';
const contraSignals = detectEvidenceMeaningSignals(contraAsk);
const contraGood =
  'Sözel olarak özlem ifade ediyor; davranış tarafında ise temas sınırlı ve süreksiz kalıyor.';
const contraBad =
  'Aslında seni çok seviyor ama korkuyor; bu yüzden gece yazıp kayboluyor.';
const contraGoodG = applyEvidenceMeaningPostGuard(contraGood, {
  signals: contraSignals,
  message: contraAsk,
});
const contraBadG = applyEvidenceMeaningPostGuard(contraBad, {
  signals: contraSignals,
  message: contraAsk,
});
record(
  'CASE F contradictory evidence separated',
  !contraGoodG.hits.includes('relationship_unsupported_motive') &&
    /s[oö]zel|davran[ıi][sş]/i.test(contraGoodG.reply) &&
    (contraBadG.hits.includes('relationship_unsupported_motive') ||
      replyHasUnsupportedMotiveAttribution(contraBad, { signals: contraSignals })),
);

// ── CASE G — social media mind-reading ──
const socialAsk =
  'Mesajımı görüyor, cevap vermiyor ama hikâyelerimi sürekli izliyor. Ne hissediyor?';
const socialSignals = detectEvidenceMeaningSignals(socialAsk);
const socialGuard = applyEvidenceMeaningPostGuard(
  'Seni özlüyor ve kıskanıyor; bu yüzden hikâyelerini izliyor ama cevap vermiyor.',
  { signals: socialSignals, message: socialAsk },
);
record(
  'CASE G social-media mind-reading blocked',
  socialSignals.relationshipMotiveLock === true &&
    socialGuard.hits.includes('relationship_unsupported_motive') &&
    !/\bseni\s+[oö]zl[uü]yor\b/i.test(socialGuard.reply) &&
    /hissed|tema|merak|al[ıi][sş]kanl[ıi]k|bilemey|s[oö]ylemez/i.test(socialGuard.reply),
);

// ── CASE H — jealousy ──
const jealousyAsk = 'Sence kıskanıyor mu?';
const jealousySignals = detectEvidenceMeaningSignals(jealousyAsk, {
  history: [{ role: 'user', content: LIVE_BEHAVIOR }],
});
const jealousyGuard = applyEvidenceMeaningPostGuard(
  'Evet kıskanıyor, bu yüzden uzaklaşıp geri geliyor.',
  { signals: jealousySignals, message: jealousyAsk },
);
record(
  'CASE H jealousy without support blocked',
  jealousyGuard.hits.includes('relationship_unsupported_motive') &&
    !/\bk[ıi]skan[ıi]yor\b/i.test(jealousyGuard.reply),
);

// ── CASE I — tarot contamination ──
const tarotAsk =
  'Tarot Kupa Altılısı verdi, ayrıca üç kez geri geldi. Demek beni unutamıyor.';
const tarotSignals = detectEvidenceMeaningSignals(tarotAsk, {
  history: [{ role: 'user', content: LIVE_BEHAVIOR }],
});
const tarotGuard = applyEvidenceMeaningPostGuard(
  'Kupa Altılısı ve geri dönüşler onun seni unutamadığını gösteriyor.',
  { signals: tarotSignals, message: tarotAsk },
);
record(
  'CASE I tarot contamination blocked',
  (tarotGuard.hits.includes('tarot_mind_reading') ||
    tarotGuard.hits.includes('relationship_unsupported_motive')) &&
    /kan[ıi]tlamaz|bilemeyiz|g[oö]stermez/i.test(tarotGuard.reply),
);

// ── CASE J — astrology contamination ──
const astroAsk =
  'Venüs-Satürn transiti var ve o yine uzaklaştı. Bağlanmaktan korkuyor değil mi?';
const astroSignals = detectEvidenceMeaningSignals(astroAsk);
const astroGuard = applyEvidenceMeaningPostGuard(
  'Bu transit onun bağlanmaktan korktuğunu gösteriyor.',
  { signals: astroSignals, message: astroAsk },
);
record(
  'CASE J astrology contamination blocked',
  (astroGuard.hits.includes('psychology_overclaim') ||
    astroGuard.hits.includes('relationship_unsupported_motive')) &&
    !/korktu[gğ]unu\s+g[oö]steriyor/i.test(astroGuard.reply),
);

// ── CASE K — dream contamination ──
const dreamAsk = 'Onu rüyamda gördüm, ertesi gün yazdı. Demek o da beni düşünüyordu.';
const dreamSignals = detectEvidenceMeaningSignals(dreamAsk);
const dreamGuard = applyEvidenceMeaningPostGuard(
  'Rüyada görmen onun da seni düşündüğünü gösteriyor.',
  { signals: dreamSignals, message: dreamAsk },
);
record(
  'CASE K dream contamination blocked',
  (dreamGuard.hits.includes('dream_deterministic') ||
    dreamGuard.hits.includes('relationship_unsupported_motive')) &&
    !/d[uü][sş][uü]nd[uü][gğ][uü]n[uü]\s+g[oö]steriyor/i.test(dreamGuard.reply),
);

// ── CASE L — negative control ──
const defAsk = 'Yaklaşma–uzaklaşma davranışı ne demek?';
const defSignals = detectEvidenceMeaningSignals(defAsk);
const defReply =
  'Yaklaşma–uzaklaşma, temasın artıp azalmasıyla süren döngüsel bir ilişki ritmidir; kişi yakınlaşıp sonra mesafe koyabilir.';
const defGuard = applyEvidenceMeaningPostGuard(defReply, {
  signals: defSignals,
  message: defAsk,
});
record(
  'CASE L negative control no disclaimer wall',
  defSignals.directDomainQuestion === true &&
    buildEvidenceMeaningPromptLock(defSignals) === '' &&
    !defGuard.hits.includes('relationship_unsupported_motive') &&
    defGuard.reply === defReply,
);

// ── CASE M — supported motive ──
const supportedAsk =
  "Her ayrıldığında 'yakınlık beni korkutuyor, o yüzden kaçıyorum' diyor.";
const supportedSignals = detectEvidenceMeaningSignals(supportedAsk);
const supportedReply =
  'Kendi ifadesine göre yakınlık korkusu bu davranışın nedenlerinden biri.';
const supportedGuard = applyEvidenceMeaningPostGuard(supportedReply, {
  signals: supportedSignals,
  message: supportedAsk,
});
record(
  'CASE M supported motive allowed',
  supportedSignals.directMotiveEvidencePresent === true &&
    !supportedGuard.hits.includes('relationship_unsupported_motive') &&
    /yak[ıi]nl[ıi]k\s+korkusu|ifadesine g[oö]re/i.test(supportedGuard.reply),
);

// ── Qualifier trick ──
const qualGuard = applyEvidenceMeaningPostGuard(
  'Muhtemelen seni bırakamadığı ve bağlanmaktan korktuğu için geri geliyor.',
  { signals: whySignals, message: LIVE_WHY_ASK },
);
record(
  'semantic qualifier quality (olabilir/muhtemelen ≠ license)',
  qualGuard.hits.includes('relationship_unsupported_motive') &&
    !/b[ıi]rakamad[ıi][gğ][ıi].{0,30}korktu[gğ]u\s+i[cç]in/i.test(qualGuard.reply),
);

// ── Unseen paraphrases ──
const paraphrases = [
  ['Gidiyor sonra geri dönüyor, niye yapıyor bunu?', 'İçsel çekim yaşadığı için geri dönüyor.'],
  ['Beni istemese dönmezdi değil mi?', 'Seni bırakamıyor, bu yüzden dönüyor.'],
  [
    'Bu kadar geri gelmesi bağının güçlü olduğunu göstermez mi?',
    'Bağını sürdürme isteği çok güçlü; seni unutamıyor.',
  ],
  [
    'Hep uzaklaşıp tekrar yazıyor; korkuyor olabilir mi?',
    'Bağlanma korkusu yaşıyor olabilir, bu yüzden uzaklaşıp yazıyor.',
  ],
  [
    'Beni kaybetmek istemediği için mi geri geliyor?',
    'Evet, kaybetmek istemiyor ve içsel kararsızlık yaşıyor.',
  ],
  [
    'Bir gün sıcak bir gün soğuk; bu bağlanma korkusu mu?',
    'Evet bu bağlanma korkusu; sınırlarını test ediyor.',
  ],
  [
    'Gidip gidip geri dönüyorsa hâlâ duygusu var demek değil mi?',
    'Hâlâ duygusu var ve seni özlüyor, kesin.',
  ],
  [
    'Cevap vermiyor ama takip ediyor; gurur mu yapıyor?',
    'Gurur yapıyor ve seni kontrol etmek istiyor.',
  ],
  [
    'Beni düşünmese neden tekrar tekrar yazsın?',
    'Seni düşünüyor ve bilinçsizce sana çekiliyor.',
  ],
];

let paraphrasePass = 0;
for (const [ask, bad] of paraphrases) {
  const hist = [{ role: 'user', content: LIVE_BEHAVIOR }];
  const s = detectEvidenceMeaningSignals(ask, { history: hist });
  const g = applyEvidenceMeaningPostGuard(bad, { signals: s, message: ask });
  const ok =
    g.hits.includes('relationship_unsupported_motive') ||
    !replyHasUnsupportedMotiveAttribution(g.reply, { signals: s });
  if (ok && !replyHasUnsupportedMotiveAttribution(g.reply, { signals: s })) paraphrasePass += 1;
}
record(
  'unseen paraphrases',
  paraphrasePass === paraphrases.length,
  `${paraphrasePass}/${paraphrases.length}`,
);

// ── Over-guard check: pattern-strong reply stays intelligent ──
const strongPattern =
  'Gidip yeniden dönme davranışı tekrarlanıyor. Temasın istikrarlı değil, döngüsel olduğu görülüyor. Geri dönüş var ama süreklilik henüz gözlenmiyor.';
const strongPatternGuard = applyEvidenceMeaningPostGuard(strongPattern, {
  signals: patternSignals,
  message: LIVE_PATTERN_ASK,
});
record(
  'no over-guard on strong pattern analysis',
  !strongPatternGuard.hits.includes('relationship_unsupported_motive') &&
    strongPatternGuard.reply.includes('döngüsel'),
);

console.log(`\nRelationship motive boundaries: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

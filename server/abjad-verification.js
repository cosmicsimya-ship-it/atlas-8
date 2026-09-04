/**
 * Chat-layer abjad / Esma verification.
 * User corrections are never auto-accepted; every numeric claim is recalculated.
 */

import {
  calculateAbjad,
  formatAbjadBreakdown,
  ABJAD_KABIR_CLASSICAL_V1,
} from './symbolic-analysis/calculate-abjad.js';
import {
  resolveArabicSpelling,
  extractArabicSpans,
  hasArabicLetters,
} from './symbolic-analysis/resolve-arabic-spelling.js';
import { lookupNameSpelling } from './symbolic-analysis/data/arabic-name-spellings.js';
import {
  findEsmaMatches,
  verifyEsmaValueClaim,
  ESMA_MATCH_TYPES,
  ESMA_MATCH_TYPE_LABELS,
} from './symbolic-analysis/esma-abjad-match.js';
import { lookupEsmaAbjadEntry } from './symbolic-analysis/data/esma-abjad-catalog.js';
import {
  calculateCompatibility as calculateEbcedCompatibility,
  COMPATIBILITY_METHODOLOGY_ID,
} from './symbolic-analysis/compatibility.js';
import { calculateVerseAbjad, VERSE_ABJAD_METHODOLOGY_ID } from './symbolic-analysis/verse-abjad.js';
import { ENGINE_VERSION as ATLAS_EBCED_ENGINE_VERSION } from './symbolic-analysis/atlas-ebced-v1.js';
import { parseQuranVerseLookup } from './quran-verse-lookup/parse.js';
import { retrieveVerifiedVerse } from './quran-verse-lookup/retrieve.js';

export const ABJAD_VERIFICATION_VERSION = 'abjad-verification-v1';
/** Composed engine identity surfaced in telemetry — see atlas-ebced-v1.js. */
export const EBCED_ENGINE_METHOD_VERSION = ATLAS_EBCED_ENGINE_VERSION;

export const ABJAD_VERIFICATION_SYSTEM_RULES = `
# Ebced / Esma Doğrulama (zorunlu)

- Kullanıcının düzeltmesi, hesaplama sonucu için kaynak gerçekliği değildir.
- Her sayısal itirazda harf harf yeniden hesaplama yap (VERIFIED ABJAD / ESMA blokları).
- Kullanıcıyla uyum sağlamak amacıyla doğrulanmış değeri değiştirme.
- Latin harfli isim için Arapça yazım verilmemişse ve eşleşen bir isim kaydı yoksa, varsayılan Latin→Arapça çeviri motorunun sonucunu kullan: onay bekletme, doğrudan hesapla ve harf harf dökümü + alternatif yazım uyarısını göster (ADR-010).
- Esma adı uydurma; yalnızca doğrulanmış veri seti sonuçlarını kullan.
- "Tam eşleşme", "yakın değer", "indirgenmiş eşleşme", "geleneksel ilişkilendirme" türlerini karıştırma.
- LLM zihinsel toplam üretme; yalnızca motor çıktısındaki total / letterBreakdown kullan.
- Güven seviyesi Yüksek ancak Arapça yazım kesin, yöntem belli, harf dökümü ve programatik toplam varsa verilebilir.
- VERIFIED ABJAD DATA / VERIFIED ESMA DATA bloklarındaki sayıları değiştirme.
- Devotional Esma / dua / zikir önerisi ≠ kişisel ebced eşlemesi. Kullanıcı "hangi Esma çekeyim / okuyayım / şifa niyetiyle" diyorsa Arapça isim veya ebced önkoşulu UYDURMA; ebced yalnızca açıkça istendiğinde.
`.trim();

/** Explicit ebced / abjad calculation language — not bare "esma". */
const EXPLICIT_EBCED_RE =
  /\b(ebced|abjad|cifir|ebcedini|ebcedi|ebcedim|abjad[ıi]m|harf\s*harf|harf\s+hesab)\b/iu;

const CALC_HINT_RE = /\b(hesapla|hesab[ıi]|toplam)\b/iu;

const CLAIM_VALUE_RE =
  /(?:(?:lat[iî]f|el[\s-]?lat[iî]f|melik|malik|el[\s-]?melik|el[\s-]?malik|لطيف|اللطيف|ملك|الملك)\s*(?:=|eşittir|esittir|:)?\s*(\d{2,4}))|(?:(\d{2,4})\s*(?:=|eşittir|esittir)?\s*(?:lat[iî]f|el[\s-]?lat[iî]f|melik|malik|el[\s-]?melik|el[\s-]?malik))/iu;

const USER_OBJECTION_RE =
  /(?:yine\s+)?yanl[ıi][sş]|de[gğ]il|olacakt[ıi]|olmal[ıi]|d[uü]zelt|aslında|aslinda|\bhay[ıi]r\b/iu;

/** Personal / numeric Esma matching (ebced path) — not general "hangi esma çekeyim". */
const ESMA_PERSONAL_MATCH_RE =
  /\b(denk\s*gelen(\s*esma)?|eşleşen\s*esma|esma\s*(eşleş|esles|karş[ıi]l[ıi]k)|bana\s+denk|ismimin\s+ebced|ebced(?:in|im|i)?(?:ne|ine)?\s+g[oö]re|harf\s+hesab[ıi]na\s+g[oö]re)\b/iu;

/** Devotional practice cues — must not invent ebced prerequisites. */
const DEVOTIONAL_ESMA_CUE_RE =
  /\b([cç]ek|[cç]ekil|[cç]ekeyim|[cç]ekilir|oku|okuy|okuyay[ıi]m|zikir|zikir|dua|ne\s+kadar|ka[cç]\s*(kere|kez|defa)|manevi|şifa\s+niyet|şifa\s+i[cç]in)\b/iu;

/** User rejects stale ebced / Arabic-name prerequisite. */
const REJECT_EBCED_PREREQ_RE =
  /\b(ebced\s+sormuyorum|ebced\s+istemiyorum|ebced\s+de[gğ]il|arap[cç]a\s+(yaz[ıi]m|istemiyorum)|isim\s+(hesab|istemiyorum)|sorunu\s+(tam\s+)?anlamad[ıi]n|ben\s+de\s+sana\s+soruyorum)\b/iu;

const NAME_CALC_RE =
  /\b(hüseyin|huseyin|hussain|husayn|muhammed|muhammad|ali)\b/iu;

/**
 * Generic "<name> isminin ebced ..." / "<name>'nin ebced ..." construction —
 * captures an arbitrary Latin name for calculation, not just the curated
 * NAME_CALC_RE whitelist. Feeds the default-transliteration path (ADR-010).
 */
const NAME_BEFORE_POSSESSIVE_EBCED_RE =
  /\b([a-zçğıiöşü]{2,30})(?:['’][a-zçğıiöşü]{0,6})?\s+(?:isminin\s+ebced\w*|ismi\s+ebced\w*|adının\s+ebced\w*|adı\s+ebced\w*)/iu;
const NAME_APOSTROPHE_EBCED_RE =
  /\b([a-zçğıiöşü]{2,30})['’][a-zçğıiöşü]{0,6}\s+ebced\w*/iu;

/** Common function/pronoun words that must never be treated as a name hint. */
const NAME_HINT_STOP_WORDS = new Set([
  'bu', 'şu', 'o', 'bir', 'ne', 'nasıl', 'kaç', 'hangi', 'benim', 'senin', 'onun',
  'bizim', 'sizin', 'onların', 'isim', 'ismi', 'ismin', 'ad', 'adı', 'adın',
  'harf', 'sayı', 'değer', 'değeri', 'toplam', 'hesap', 'hesabı', 'yeniden',
  'tekrar', 'ebced', 'abjad', 'esma', 'kelimenin', 'kelime', 'sözün', 'söz',
]);

/**
 * @param {string} text
 * @returns {string|null}
 */
function extractGenericLatinNameHint(text) {
  const candidate =
    text.match(NAME_BEFORE_POSSESSIVE_EBCED_RE)?.[1] ||
    text.match(NAME_APOSTROPHE_EBCED_RE)?.[1] ||
    null;
  if (!candidate || candidate.length < 2) return null;
  if (NAME_HINT_STOP_WORDS.has(candidate.toLocaleLowerCase('tr-TR'))) return null;
  return candidate;
}

/**
 * True when the turn is a personal ebced↔Esma match ask (not zikir recommendation).
 * @param {string} text
 * @param {number|null} lastTotal
 */
export function isExplicitEbcedEsmaMatchAsk(text, lastTotal = null) {
  const msg = normalizeTr(text);
  if (!msg) return false;
  if (REJECT_EBCED_PREREQ_RE.test(msg) && DEVOTIONAL_ESMA_CUE_RE.test(msg)) {
    return false;
  }
  if (ESMA_PERSONAL_MATCH_RE.test(msg)) return true;
  if (EXPLICIT_EBCED_RE.test(msg) && /\besma/i.test(msg)) return true;
  // "hangi esma" alone is recommendation unless numeric/ebced context is clear
  // and there is no zikir/dua/çek practice framing.
  if (/\bhangi\s*esma/i.test(msg)) {
    if (DEVOTIONAL_ESMA_CUE_RE.test(msg)) return false;
    if (EXPLICIT_EBCED_RE.test(msg) || ESMA_PERSONAL_MATCH_RE.test(msg)) return true;
    if (/\b\d{2,4}\b/.test(msg)) return true;
  }
  // Short follow-up mentioning Esma in any form ("Esması?", "hangi esma",
  // "esma nedir" ...) right after a verified total, without practice cues.
  // Previously nested only inside the "hangi esma" branch above, so a bare
  // "Esması?" follow-up never reached this check even with a valid
  // lastTotal - found via the same 2026-09-04 forensic trace as the
  // self-referential name-extraction gap (once that one is fixed, the
  // follow-up needs this fix too to actually complete the flow).
  if (
    Number.isFinite(lastTotal) &&
    msg.length < 80 &&
    !DEVOTIONAL_ESMA_CUE_RE.test(msg) &&
    /\besma/i.test(msg)
  ) {
    return /\b(esma|eşleş|denk|nedir|ne\b)/i.test(msg);
  }
  if (/\b(eşleşen\s*esma|esma\s*bul)\b/i.test(msg) && !DEVOTIONAL_ESMA_CUE_RE.test(msg)) {
    return true;
  }
  return false;
}

/**
 * @param {string} text
 */
function normalizeTr(text) {
  return String(text || '').normalize('NFC').trim();
}

/**
 * Extract claimed Esma name + optional numeric assertion from user text.
 * @param {string} message
 * @returns {{ nameQuery: string, claimedValue: number|null }|null}
 */
export function extractEsmaValueClaim(message) {
  const text = normalizeTr(message);
  if (!text) return null;

  const patterns = [
    {
      re: /\b(?:el[\s-]?)?lat[iî]f\b/iu,
      name: 'latif',
    },
    {
      re: /\b(?:el[\s-]?)?(?:melik|malik)\b/iu,
      name: 'melik',
    },
    { re: /اللطيف|لطيف/u, name: 'لطيف' },
    { re: /الملك|ملك/u, name: 'ملك' },
  ];

  let nameQuery = null;
  for (const p of patterns) {
    if (p.re.test(text)) {
      nameQuery = p.name;
      break;
    }
  }
  if (!nameQuery) return null;

  const numMatch =
    text.match(
      new RegExp(
        `(?:${nameQuery === 'latif' ? '(?:el[\\\\s-]?)?lat[iî]f|لطيف|اللطيف' : nameQuery === 'melik' ? '(?:el[\\\\s-]?)?(?:melik|malik)|ملك|الملك' : nameQuery})[^0-9]{0,24}(\\d{2,4})`,
        'iu',
      ),
    ) ||
    text.match(/(\d{2,4})/);

  // Prefer number near the claim phrasing
  let claimedValue = null;
  const claimNear = text.match(CLAIM_VALUE_RE);
  if (claimNear) {
    claimedValue = Number(claimNear[1] || claimNear[2]);
  } else if (USER_OBJECTION_RE.test(text) && numMatch) {
    claimedValue = Number(numMatch[1]);
  } else if (
    /\b(dir|dır|dur|dür|=|eşittir|esittir|olacakt[ıi]|olmal[ıi])\b/iu.test(text) &&
    numMatch
  ) {
    claimedValue = Number(numMatch[1]);
  }

  return {
    nameQuery,
    claimedValue: Number.isFinite(claimedValue) ? claimedValue : null,
  };
}

/**
 * Pull last verified abjad total from conversation history (assistant turns).
 * @param {Array<{ role?: string, content?: string }>|null|undefined} history
 */
export function extractLastVerifiedTotalFromHistory(history) {
  if (!Array.isArray(history)) return null;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const turn = history[i];
    if (turn?.role !== 'assistant') continue;
    const content = String(turn.content || '');
    const m =
      content.match(/Toplam\s*=\s*(\d{2,4})/i) ||
      content.match(/toplam[ıi]?\s+(\d{2,4})/i) ||
      content.match(/\b(\d{2,4})\s+ediyor\b/i);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * @param {string} message
 * @param {Array<{ role?: string, content?: string }>|null|undefined} [history]
 */
export function detectAbjadEsmaIntent(message, history = []) {
  const text = normalizeTr(message);
  if (!text) {
    return { active: false, kind: 'none' };
  }

  const arabicSpans = extractArabicSpans(text);
  const hasExplicitEbced = EXPLICIT_EBCED_RE.test(text);
  const hasCalcHint = CALC_HINT_RE.test(text);
  const esmaClaim = extractEsmaValueClaim(text);
  const hasName = NAME_CALC_RE.test(text);
  const genericLatinName = hasName ? null : extractGenericLatinNameHint(text);
  const effectiveHasName = hasName || Boolean(genericLatinName);
  const objection = USER_OBJECTION_RE.test(text);
  const lastTotal = extractLastVerifiedTotalFromHistory(history);
  const rejectsEbcedPrereq = REJECT_EBCED_PREREQ_RE.test(text);
  const asksPersonalMatch = isExplicitEbcedEsmaMatchAsk(text, lastTotal);

  // User clarification: not asking for ebced — discard stale match path.
  if (rejectsEbcedPrereq && !hasExplicitEbced && !esmaClaim) {
    return { active: false, kind: 'none', lastTotal, discarded: 'ebced_prereq_rejected' };
  }

  // "Latif olacaktı" / "Latif 128'dir" — always recalc; never accept claim as truth.
  if (
    esmaClaim &&
    (esmaClaim.claimedValue != null ||
      objection ||
      hasExplicitEbced ||
      hasCalcHint ||
      /olacakt[ıi]/i.test(text))
  ) {
    const implyPriorTotal =
      esmaClaim.claimedValue == null &&
      Number.isFinite(lastTotal) &&
      (objection || /olacakt[ıi]|olmal[ıi]/i.test(text));
    return {
      active: true,
      kind: 'user_value_claim',
      esmaClaim: {
        ...esmaClaim,
        claimedValue: implyPriorTotal ? lastTotal : esmaClaim.claimedValue,
      },
      arabicSpans,
      lastTotal,
    };
  }

  if (asksPersonalMatch) {
    return {
      active: true,
      kind: 'esma_match',
      targetValue: lastTotal,
      arabicSpans,
      lastTotal,
    };
  }

  if (
    arabicSpans.length ||
    (hasName && (hasExplicitEbced || hasArabicLetters(text) || /yaz[ıi]l[ıi]r|hesap/i.test(text)))
  ) {
    return {
      active: true,
      kind: 'calculate',
      arabicSpans,
      lastTotal,
      latinHint: hasName ? text.match(NAME_CALC_RE)?.[1] : genericLatinName,
    };
  }

  if (hasExplicitEbced && (effectiveHasName || arabicSpans.length || /\d{2,4}/.test(text) || hasCalcHint)) {
    return {
      active: true,
      kind: 'calculate',
      arabicSpans,
      lastTotal,
      latinHint: hasName ? text.match(NAME_CALC_RE)?.[1] : genericLatinName,
    };
  }

  // Bare "ebced hesapla" without name still activates calculate (asks confirmation).
  if (hasExplicitEbced && hasCalcHint) {
    return {
      active: true,
      kind: 'calculate',
      arabicSpans,
      lastTotal,
      latinHint: hasName ? text.match(NAME_CALC_RE)?.[1] : genericLatinName,
    };
  }

  return { active: false, kind: 'none', lastTotal };
}

/**
 * Assess confidence only when verification gates are met.
 * @param {{ spellingConfirmed: boolean, calcOk: boolean, articleDisclosed?: boolean }} gates
 */
export function resolveAbjadConfidence(gates) {
  if (
    gates.spellingConfirmed &&
    gates.calcOk &&
    gates.articleDisclosed !== false
  ) {
    return 'high';
  }
  if (gates.calcOk && !gates.spellingConfirmed) return 'medium';
  return 'insufficient';
}

/**
 * Build a full verification result for chat / tests.
 *
 * @param {{
 *   message: string,
 *   history?: Array<{ role?: string, content?: string }>,
 * }} input
 */
export function runAbjadEsmaVerification(input = {}) {
  const message = normalizeTr(input.message);
  const history = input.history || [];
  const intent = detectAbjadEsmaIntent(message, history);

  if (!intent.active) {
    return {
      active: false,
      intent,
      reply: null,
      promptBlock: null,
      confidence: 'insufficient',
      engine: 'abjad-verification',
      version: ABJAD_VERIFICATION_VERSION,
    };
  }

  // ── User Esma value claim / objection ──
  if (intent.kind === 'user_value_claim' && intent.esmaClaim) {
    const claim = intent.esmaClaim;
    const verified = verifyEsmaValueClaim(claim);
    if (!verified.found || !verified.entry) {
      const reply =
        verified.userMessage ||
        'Bu Esma için doğrulanmış veri setinde kayıt yok; değer uyduramam.';
      return finalize({
        intent,
        reply,
        confidence: 'insufficient',
        calc: null,
        esma: verified,
        spelling: null,
      });
    }

    const entry = verified.entry;
    const wantsDefinite = /(?:\bel[\s-]?(?:lat|mel|mal)|\bال)/iu.test(message);
    const formArabic = wantsDefinite ? entry.definiteArabic : entry.canonicalArabic;

    const calc = calculateAbjad(formArabic, ABJAD_KABIR_CLASSICAL_V1);
    const bareCalc = calculateAbjad(entry.canonicalArabic, ABJAD_KABIR_CLASSICAL_V1);
    const defCalc = calculateAbjad(entry.definiteArabic, ABJAD_KABIR_CLASSICAL_V1);

    const claimed = claim.claimedValue;
    const accepted =
      claimed != null &&
      ((bareCalc.ok && claimed === bareCalc.total) ||
        (defCalc.ok && claimed === defCalc.total));

    const comparesPrior =
      claimed != null &&
      bareCalc.ok &&
      claimed !== bareCalc.total &&
      claimed !== defCalc.total;

    let reply;
    if (claimed == null) {
      reply = [
        'Kontrol ediyorum:',
        '',
        entry.canonicalArabic,
        formatAbjadBreakdown(bareCalc.letters, bareCalc.total),
        '',
        `${entry.definiteArabic} (ال takısı dahil) = ${defCalc.total}`,
        '',
        `${entry.displayNameTr} için doğrulanmış değerler: sade yazım ${bareCalc.total}, harf-i tarifli ${defCalc.total}.`,
      ].join('\n');
    } else if (accepted) {
      reply = [
        'Kontrol ettim; iddian doğrulanmış hesapla uyuşuyor.',
        '',
        formArabic,
        formatAbjadBreakdown(calc.letters, calc.total),
      ].join('\n');
    } else {
      const show = bareCalc.ok ? bareCalc : calc;
      reply = [
        'Kontrol ediyorum:',
        '',
        entry.canonicalArabic,
        formatAbjadBreakdown(show.letters, show.total),
        '',
        comparesPrior
          ? `Toplam ${show.total} ediyor. Bu nedenle standart büyük ebced hesabında ${claimed} değeriyle tam eşleşmiyor.`
          : `Toplam ${show.total} ediyor. Bu nedenle standart büyük ebced hesabında iddia edilen ${claimed} değeri doğru değil.`,
        `${entry.definiteArabic} (ال dahil) = ${defCalc.total}.`,
        '',
        'Farklı bir metodoloji veya indirgeme sistemi kullanıyorsan, o yöntemi ayrıca belirtmemiz gerekir.',
        'Kullanıcı düzeltmesini kaynak gerçekliği olarak kabul etmem; değeri yeniden hesapladım.',
      ].join('\n');
    }

    return finalize({
      intent,
      reply,
      confidence: resolveAbjadConfidence({
        spellingConfirmed: true,
        calcOk: bareCalc.ok && defCalc.ok,
        articleDisclosed: true,
      }),
      calc: { bare: bareCalc, definite: defCalc, primary: calc },
      esma: verified,
      spelling: {
        originalInput: claim.nameQuery,
        normalizedArabic: entry.canonicalArabic,
        spellingConfirmed: true,
        calculationMethod: ABJAD_KABIR_CLASSICAL_V1,
      },
      claimAccepted: accepted,
    });
  }

  // ── Esma match for a target number ──
  if (intent.kind === 'esma_match') {
    let target = intent.targetValue;
    const numInMsg = message.match(/\b(\d{2,4})\b/);
    if (numInMsg) target = Number(numInMsg[1]);

    // If Arabic name present, calculate first then match
    if ((!target || !Number.isFinite(target)) && intent.arabicSpans?.length) {
      const calc = calculateAbjad(intent.arabicSpans[0], ABJAD_KABIR_CLASSICAL_V1);
      if (calc.ok) target = calc.total;
    }

    if (!target || !Number.isFinite(target)) {
      const reply =
        'Denk gelen Esma için önce doğrulanmış bir ebced toplamına ihtiyacım var. Arapça yazımı paylaşır mısın?';
      return finalize({
        intent,
        reply,
        confidence: 'insufficient',
        calc: null,
        esma: null,
        spelling: null,
      });
    }

    const exact = findEsmaMatches({
      value: target,
      matchType: ESMA_MATCH_TYPES.EXACT,
      methodologyId: ABJAD_KABIR_CLASSICAL_V1,
    });

    let reply;
    if (exact.matches.length) {
      const lines = [
        `Hedef sayı: ${target}`,
        `Eşleşme türü: ${ESMA_MATCH_TYPE_LABELS.exact}`,
        '',
      ];
      for (const m of exact.matches) {
        lines.push(
          `${m.displayNameTr} — ${m.arabic} (${m.form === 'definite' ? 'ال dahil' : 'sade yazım'}) = ${m.value}`,
        );
        lines.push(formatAbjadBreakdown(m.letterBreakdown, m.value));
        lines.push('');
      }
      reply = lines.join('\n').trim();
    } else {
      reply = [
        `Hedef sayı: ${target}`,
        `Eşleşme türü: ${ESMA_MATCH_TYPE_LABELS.exact}`,
        '',
        exact.userMessage ||
          'Doğrulanmış veri setinde tam eşleşme bulamadım.',
        'Yakın değeri tam eşleşme diye sunmam; isim de uydurmam.',
      ].join('\n');
    }

    return finalize({
      intent,
      reply,
      confidence: 'high',
      calc: { total: target },
      esma: exact,
      spelling: null,
    });
  }

  // ── Calculate from Arabic / Latin name ──
  const latinHint =
    intent.latinHint ||
    message.match(NAME_CALC_RE)?.[1] ||
    null;
  const arabicText = intent.arabicSpans?.[0] || null;

  const spelling = resolveArabicSpelling({
    originalInput: message,
    arabicText,
    latinHint,
    spellingConfirmed: Boolean(arabicText),
  });

  if (spelling.status === 'rejected_variant') {
    const standardCalc = calculateAbjad(spelling.standardArabic, ABJAD_KABIR_CLASSICAL_V1);
    const rejectedCalc = calculateAbjad(spelling.normalizedArabic, ABJAD_KABIR_CLASSICAL_V1);
    const reply = [
      `Uyarı: «${spelling.rejectedVariant}» Atlas standart yazımı değildir.`,
      `Standart yazım: ${spelling.standardArabic} (${spelling.displayLatin}).`,
      '',
      rejectedCalc.ok
        ? `Verilen alternatif yazımın hesabı (standart kabul edilmez): ${rejectedCalc.total}`
        : 'Alternatif yazım hesaplanamadı.',
      standardCalc.ok
        ? [
            '',
            'Standart yazım hesabı:',
            spelling.standardArabic,
            formatAbjadBreakdown(standardCalc.letters, standardCalc.total),
          ].join('\n')
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    return finalize({
      intent,
      reply,
      confidence: 'insufficient',
      calc: { rejected: rejectedCalc, standard: standardCalc },
      esma: null,
      spelling,
      usedAsStandard: false,
    });
  }

  if (spelling.status === 'proposed' || spelling.status === 'needs_confirmation') {
    const proposed = spelling.normalizedArabic;
    const preview = proposed
      ? calculateAbjad(proposed, ABJAD_KABIR_CLASSICAL_V1)
      : null;
    const ask =
      spelling.warnings[0] ||
      'Arapça yazımı onaylar mısın? Onaysız kesin sonuç vermem.';
    const reply = [
      ask,
      proposed ? `Önerilen yazım: ${proposed}` : '',
      preview?.ok
        ? `(Onay sonrası hesap: ${formatAbjadBreakdown(preview.letters, preview.total).replace(/\n/g, ', ')})`
        : '',
      'Latin harfli isim doğrudan tahmini Arapçaya çevrilmez.',
    ]
      .filter(Boolean)
      .join('\n');

    return finalize({
      intent,
      reply,
      confidence: 'insufficient',
      calc: preview,
      esma: null,
      spelling,
    });
  }

  if (!spelling.normalizedArabic || !spelling.spellingConfirmed) {
    return finalize({
      intent,
      reply:
        spelling.warnings.join(' ') ||
        'Hesap için onaylı Arapça yazım gerekli.',
      confidence: 'insufficient',
      calc: null,
      esma: null,
      spelling,
    });
  }

  const calc = calculateAbjad(spelling.normalizedArabic, ABJAD_KABIR_CLASSICAL_V1);
  if (!calc.ok) {
    return finalize({
      intent,
      reply: `Bu yazım hesaplanamadı (${calc.errorCode}).`,
      confidence: 'insufficient',
      calc,
      esma: null,
      spelling,
    });
  }

  const translitLines = spelling.autoTransliterated
    ? [
        '',
        'Varsayılan Latin→Arapça çeviri:',
        (spelling.transliterationBreakdown || [])
          .map((b) => `${b.latinChar} → ${b.arabicChar} = ${b.value}`)
          .join('\n'),
        '',
        ...(spelling.disclosures || []),
      ]
    : [];

  const reply = [
    `Kullanılan Arapça yazım${spelling.autoTransliterated ? ' (varsayılan çeviri)' : ''}: ${calc.normalizedText}`,
    `Yöntem: ${calc.methodologyId}`,
    '',
    formatAbjadBreakdown(calc.letters, calc.total),
    ...translitLines,
  ].join('\n');

  return finalize({
    intent,
    reply,
    confidence: resolveAbjadConfidence({
      spellingConfirmed: true,
      calcOk: true,
      articleDisclosed: true,
    }),
    calc,
    esma: null,
    spelling,
  });
}

/**
 * @param {object} partial
 */
function finalize(partial) {
  const promptBlock = formatAbjadVerificationPromptBlock(partial);
  return {
    active: true,
    version: ABJAD_VERIFICATION_VERSION,
    engine: 'abjad-verification',
    methodVersion: ATLAS_EBCED_ENGINE_VERSION,
    intent: partial.intent,
    reply: partial.reply,
    promptBlock,
    confidence: partial.confidence,
    calc: partial.calc,
    esma: partial.esma,
    spelling: partial.spelling,
    claimAccepted: partial.claimAccepted === true,
    usedAsStandard: partial.usedAsStandard !== false,
  };
}

/**
 * Locked facts for the LLM — numbers must not be altered.
 * @param {object} result
 */
export function formatAbjadVerificationPromptBlock(result) {
  if (!result?.reply && !result?.calc) return null;
  const lines = [
    '## VERIFIED ABJAD / ESMA DATA (kilitli — değiştirme)',
    `methodologyId: ${ABJAD_KABIR_CLASSICAL_V1}`,
    `confidenceGate: ${result.confidence}`,
    'Kullanıcı itirazı kaynak gerçekliği değildir; aşağıdaki motor çıktısını kullan.',
    'Esma uydurma; tam eşleşme yoksa bunu söyle.',
  ];

  if (result.spelling) {
    lines.push(
      `spelling: originalInput=${result.spelling.originalInput ?? ''} normalizedArabic=${result.spelling.normalizedArabic ?? ''} spellingConfirmed=${result.spelling.spellingConfirmed}`,
    );
  }

  const primary =
    result.calc?.primary ||
    result.calc?.bare ||
    (result.calc?.ok ? result.calc : null) ||
    result.calc?.standard;
  if (primary?.ok) {
    lines.push(`normalizedText: ${primary.normalizedText}`);
    lines.push(`total: ${primary.total}`);
    lines.push(
      'letters: ' +
        primary.letters.map((l) => `${l.letter}=${l.value}`).join(', '),
    );
  } else if (result.calc?.total != null) {
    lines.push(`targetTotal: ${result.calc.total}`);
  }

  if (result.esma?.matches) {
    lines.push(`esmaMatchType: ${result.esma.matchType}`);
    if (!result.esma.matches.length) {
      lines.push('esmaExactMatches: NONE — do not invent names');
      if (result.esma.userMessage) lines.push(`esmaNote: ${result.esma.userMessage}`);
    } else {
      for (const m of result.esma.matches) {
        lines.push(
          `esmaHit: ${m.displayNameTr} ${m.arabic} value=${m.value} form=${m.form} type=${m.matchType}`,
        );
      }
    }
  }

  if (result.claimAccepted === false) {
    lines.push('userClaimAccepted: false — politely correct with recalculation');
  }

  lines.push('Deterministic reply draft (prefer these numbers):');
  lines.push(result.reply || '');
  return lines.join('\n');
}

/**
 * Prefer deterministic engine reply for abjad/esma numeric turns.
 * @param {{ message: string, history?: Array<{ role?: string, content?: string }> }} input
 */
export function tryDeterministicAbjadReply(input) {
  const result = runAbjadEsmaVerification(input);
  if (!result.active || !result.reply) return null;
  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// Self-referential Ebced requests — two distinct classes:
//
// 1. Unambiguous OPENING requests: an explicit ebced/abjad cue combined
//    with a self-reference marker ("ismimden", "adımın ebcedi", ...). These
//    need no prior domain context — "ismimin ebcedini hesapla" cannot mean
//    anything else — so they're recognized regardless of ebcedDomainActive.
//    Found via a real production gap (2026-09-04 forensic trace,
//    req_b5c15d16a946): "Hadi ebced değerimi ismimden hesapla" fell through
//    to the "no name captured" rejection because extractGenericLatinNameHint
//    only recognizes name-then-ebced constructions ("Furkan'ın ebced..."),
//    never a self-reference-only construction with no named person at all.
//
// 2. Short, context-DEPENDENT follow-ups ("Benimkine de bak.") — no name,
//    no Arabic, no ebced keyword of their own, only interpretable as Ebced
//    because the conversation is already in that domain. Gated by the
//    caller passing `ebcedDomainActive: true` (from symbolicDomain state) —
//    this function has no way to know that on its own and must never guess
//    a domain from message text alone for these.
// ─────────────────────────────────────────────────────────────────────────

const SELF_REFERENTIAL_EBCED_FOLLOWUP_RE =
  /^(?:benimkine\s+de\s+bak|benim\s*(?:kine)?\s+de\s+bak|bana\s+da\s+bak|beni\s+de\s+hesapla|benimkini\s+de\s+hesapla|ya\s+benim\s*(?:kim?)?)[.!?…]*$/iu;

/** Self-reference marker with no named person — "from/of MY OWN name". */
const SELF_REFERENTIAL_NAME_MARKER_RE =
  /\b(ismimden|adımdan|ismimin|adımın|ismimi|ad[ıi]m[ıi])\b/iu;

/**
 * @param {string} message
 * @param {boolean} ebcedDomainActive
 * @returns {{ active: boolean }}
 */
export function detectSelfReferentialEbcedFollowUp(message, ebcedDomainActive) {
  const text = normalizeTr(message);
  if (!text) return { active: false };

  // Class 1: unambiguous on its own, no domain context required.
  if (EXPLICIT_EBCED_RE.test(text) && SELF_REFERENTIAL_NAME_MARKER_RE.test(text)) {
    return { active: true };
  }

  // Class 2: short context-dependent follow-up, only valid mid-Ebced-domain.
  if (!ebcedDomainActive) return { active: false };
  if (text.length > 40) return { active: false };
  return { active: SELF_REFERENTIAL_EBCED_FOLLOWUP_RE.test(text) };
}

/**
 * @param {{ message: string, ebcedDomainActive: boolean, selfName: string|null }} input
 */
export function tryDeterministicSelfReferentialEbcedReply(input) {
  const intent = detectSelfReferentialEbcedFollowUp(input.message, input.ebcedDomainActive);
  if (!intent.active) return null;

  if (!input.selfName) {
    return {
      active: true,
      engine: 'abjad-verification',
      methodVersion: ATLAS_EBCED_ENGINE_VERSION,
      operation: 'calculate_name',
      confidence: 'insufficient',
      reply: 'İsmini paylaşır mısın? Onu da hesaplayayım.',
      calc: null,
      spelling: null,
    };
  }

  const spelling = resolveArabicSpelling({ originalInput: input.selfName, latinHint: input.selfName });
  if (!spelling.normalizedArabic || !spelling.spellingConfirmed) {
    return {
      active: true,
      engine: 'abjad-verification',
      methodVersion: ATLAS_EBCED_ENGINE_VERSION,
      operation: 'calculate_name',
      confidence: 'insufficient',
      reply: spelling.warnings.join(' ') || `${input.selfName} için Arapça yazım onayı gerekli.`,
      calc: null,
      spelling,
    };
  }

  const calc = calculateAbjad(spelling.normalizedArabic, ABJAD_KABIR_CLASSICAL_V1);
  if (!calc.ok) {
    return {
      active: true,
      engine: 'abjad-verification',
      methodVersion: ATLAS_EBCED_ENGINE_VERSION,
      operation: 'calculate_name',
      confidence: 'insufficient',
      reply: `Bu yazım hesaplanamadı (${calc.errorCode}).`,
      calc,
      spelling,
    };
  }

  const reply = [
    `${input.selfName}: ${calc.normalizedText}`,
    formatAbjadBreakdown(calc.letters, calc.total),
  ].join('\n');

  return {
    active: true,
    engine: 'abjad-verification',
    methodVersion: ATLAS_EBCED_ENGINE_VERSION,
    operation: 'calculate_name',
    confidence: 'high',
    reply,
    calc,
    spelling,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Name-pair compatibility (Çift Uyumu) — genuinely new capability, not
// present anywhere in the chat layer before atlas-ebced-v1. Scoped
// conservatively: requires an explicit ebced/abjad cue alongside "uyum" so
// this never collides with zodiac/burç compatibility phrasing, which is a
// separate, pre-existing domain this task must not touch.
// ─────────────────────────────────────────────────────────────────────────

const COMPATIBILITY_CUE_RE = /\buyum(?:u|lu|luluk)?\b/iu;
const TWO_NAME_CONNECTOR_RE =
  /\b([A-ZÇĞİÖŞÜ][a-zçğıiöşü]{1,24})(?:['’][a-zçğıiöşü]{0,6})?\s+(?:ile|ve)\s+([A-ZÇĞİÖŞÜ][a-zçğıiöşü]{1,24})(?:['’][a-zçğıiöşü]{0,6})?\b/u;

/**
 * @param {string} message
 * @returns {{ active: boolean, nameA?: string, nameB?: string }}
 */
export function detectCompatibilityIntent(message) {
  const text = normalizeTr(message);
  if (!text) return { active: false };
  if (!EXPLICIT_EBCED_RE.test(text) || !COMPATIBILITY_CUE_RE.test(text)) return { active: false };
  const names = text.match(TWO_NAME_CONNECTOR_RE);
  if (!names) return { active: false };
  return { active: true, nameA: names[1], nameB: names[2] };
}

/**
 * @param {{ message: string }} input
 */
export function tryDeterministicCompatibilityReply(input) {
  const intent = detectCompatibilityIntent(input.message);
  if (!intent.active) return null;

  const spellingA = resolveArabicSpelling({ originalInput: intent.nameA, latinHint: intent.nameA });
  const spellingB = resolveArabicSpelling({ originalInput: intent.nameB, latinHint: intent.nameB });

  if (!spellingA.normalizedArabic || !spellingA.spellingConfirmed) {
    return {
      active: true,
      engine: 'abjad-verification',
      methodVersion: ATLAS_EBCED_ENGINE_VERSION,
      operation: 'compatibility',
      confidence: 'insufficient',
      reply: spellingA.warnings.join(' ') || `${intent.nameA} için Arapça yazım onayı gerekli.`,
      compatibility: null,
    };
  }
  if (!spellingB.normalizedArabic || !spellingB.spellingConfirmed) {
    return {
      active: true,
      engine: 'abjad-verification',
      methodVersion: ATLAS_EBCED_ENGINE_VERSION,
      operation: 'compatibility',
      confidence: 'insufficient',
      reply: spellingB.warnings.join(' ') || `${intent.nameB} için Arapça yazım onayı gerekli.`,
      compatibility: null,
    };
  }

  const result = calculateEbcedCompatibility(spellingA.normalizedArabic, spellingB.normalizedArabic);
  if (!result.ok) {
    return {
      active: true,
      engine: 'abjad-verification',
      methodVersion: ATLAS_EBCED_ENGINE_VERSION,
      operation: 'compatibility',
      confidence: 'insufficient',
      reply: 'Uyum hesabı için geçerli iki ad gerekli.',
      compatibility: result,
    };
  }

  const reply = [
    `${intent.nameA}: ${spellingA.normalizedArabic} = ${result.nameATotal}`,
    `${intent.nameB}: ${spellingB.normalizedArabic} = ${result.nameBTotal}`,
    `Toplam: ${result.combinedTotal}`,
    '',
    `Geleneksel yorum (${COMPATIBILITY_METHODOLOGY_ID}): ${result.traditionalInterpretation}`,
    '',
    'Bu geleneksel/sembolik bir yorumdur; kesin hüküm veya bilimsel uyumluluk iddiası taşımaz.',
  ].join('\n');

  return {
    active: true,
    engine: 'abjad-verification',
    methodVersion: ATLAS_EBCED_ENGINE_VERSION,
    operation: 'compatibility',
    confidence: 'high',
    reply,
    compatibility: result,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Verse Ebced — requires an explicit ebced/abjad cue alongside a
// parseable surah:ayah reference, so a plain "12:87 açıkla" keeps going
// through the existing Qur'an explanation path untouched (that path runs
// earlier in atlas-message-service.js and has no ebced keyword to match
// here anyway). This module never asserts verse identity on its own —
// retrieveVerifiedVerse (unmodified, existing Qur'an lookup) is the only
// source of a verified verse; calculateVerseAbjad refuses unverified input.
// ─────────────────────────────────────────────────────────────────────────

/**
 * @param {string} message
 */
export function detectVerseEbcedIntent(message) {
  const text = normalizeTr(message);
  if (!text || !EXPLICIT_EBCED_RE.test(text)) return { active: false, parsed: null };
  const parsed = parseQuranVerseLookup(text);
  if (!parsed?.parse_ok) return { active: false, parsed: null };
  return { active: true, parsed };
}

/**
 * @param {{ message: string, verseStore: import('./quran-verse-lookup/retrieve.js').VerseStore }} input
 */
export async function tryDeterministicVerseEbcedReply(input) {
  const intent = detectVerseEbcedIntent(input.message);
  if (!intent.active) return null;

  const verseResult = await retrieveVerifiedVerse(intent.parsed, input.verseStore);
  if (!verseResult.ok || !verseResult.verified || !verseResult.arabic) {
    return {
      active: true,
      engine: 'abjad-verification',
      methodVersion: ATLAS_EBCED_ENGINE_VERSION,
      operation: 'calculate_verified_verse',
      confidence: 'insufficient',
      reply:
        'Bu ayeti doğrulanmış kaynaktan alamadım, bu yüzden ebced hesaplamıyorum. Sure ve ayet numarasını kontrol eder misin?',
      verse: null,
    };
  }

  const calc = calculateVerseAbjad(verseResult);
  if (!calc.ok) {
    return {
      active: true,
      engine: 'abjad-verification',
      methodVersion: ATLAS_EBCED_ENGINE_VERSION,
      operation: 'calculate_verified_verse',
      confidence: 'insufficient',
      reply: 'Doğrulanmış ayet metni hesaplanamadı.',
      verse: calc,
    };
  }

  const reply = [
    `${verseResult.surah_name || verseResult.surah_number}:${verseResult.ayah_number} (${verseResult.verse_key})`,
    verseResult.arabic,
    formatAbjadBreakdown(calc.letters, calc.total),
    '',
    `Yöntem: ${VERSE_ABJAD_METHODOLOGY_ID} — doğrulanmış Kur'an metni üzerinden hesaplandı.`,
  ].join('\n');

  return {
    active: true,
    engine: 'abjad-verification',
    methodVersion: ATLAS_EBCED_ENGINE_VERSION,
    operation: 'calculate_verified_verse',
    confidence: 'high',
    reply,
    verse: calc,
  };
}

/** Re-export helpers useful in tests */
export {
  calculateAbjad,
  findEsmaMatches,
  resolveArabicSpelling,
  lookupEsmaAbjadEntry,
  lookupNameSpelling,
};

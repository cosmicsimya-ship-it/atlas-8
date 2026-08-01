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

export const ABJAD_VERIFICATION_VERSION = 'abjad-verification-v1';

export const ABJAD_VERIFICATION_SYSTEM_RULES = `
# Ebced / Esma Doğrulama (zorunlu)

- Kullanıcının düzeltmesi, hesaplama sonucu için kaynak gerçekliği değildir.
- Her sayısal itirazda harf harf yeniden hesaplama yap (VERIFIED ABJAD / ESMA blokları).
- Kullanıcıyla uyum sağlamak amacıyla doğrulanmış değeri değiştirme.
- Latin harfli isimleri tahmini Arapçaya çevirip sessizce hesaplama.
- Esma adı uydurma; yalnızca doğrulanmış veri seti sonuçlarını kullan.
- "Tam eşleşme", "yakın değer", "indirgenmiş eşleşme", "geleneksel ilişkilendirme" türlerini karıştırma.
- LLM zihinsel toplam üretme; yalnızca motor çıktısındaki total / letterBreakdown kullan.
- Güven seviyesi Yüksek ancak Arapça yazım kesin, yöntem belli, harf dökümü ve programatik toplam varsa verilebilir.
- VERIFIED ABJAD DATA / VERIFIED ESMA DATA bloklarındaki sayıları değiştirme.
`.trim();

const EBCED_KEYWORD =
  /\b(ebced|abjad|cifir|cifir|hesapla|hesab[ıi]|toplam|harf\s*harf|esma|esmalar|esmaül|esmaul|denk\s*gelen|eşleş|esles|lat[iî]f|melik|malik)\b/iu;

const CLAIM_VALUE_RE =
  /(?:(?:lat[iî]f|el[\s-]?lat[iî]f|melik|malik|el[\s-]?melik|el[\s-]?malik|لطيف|اللطيف|ملك|الملك)\s*(?:=|eşittir|esittir|:)?\s*(\d{2,4}))|(?:(\d{2,4})\s*(?:=|eşittir|esittir)?\s*(?:lat[iî]f|el[\s-]?lat[iî]f|melik|malik|el[\s-]?melik|el[\s-]?malik))/iu;

const USER_OBJECTION_RE =
  /(?:yine\s+)?yanl[ıi][sş]|de[gğ]il|olacakt[ıi]|olmal[ıi]|d[uü]zelt|aslında|aslinda|\bhay[ıi]r\b/iu;

const ESMA_MATCH_ASK_RE =
  /\b(denk\s*gelen\s*esma|hangi\s*esma|esma\s*(nedir|ne|eşleş|esles|karş[ıi]l[ıi]k)|eşleşen\s*esma|esma\s*bul)\b/iu;

const NAME_CALC_RE =
  /\b(hüseyin|huseyin|hussain|husayn|muhammed|muhammad|ali)\b/iu;

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
  const hasEbcedKw = EBCED_KEYWORD.test(text);
  const esmaClaim = extractEsmaValueClaim(text);
  const asksEsmaMatch = ESMA_MATCH_ASK_RE.test(text);
  const hasName = NAME_CALC_RE.test(text);
  const objection = USER_OBJECTION_RE.test(text);
  const lastTotal = extractLastVerifiedTotalFromHistory(history);

  // "Latif olacaktı" / "Latif 128'dir" — always recalc; never accept claim as truth.
  if (esmaClaim && (esmaClaim.claimedValue != null || objection || hasEbcedKw || /olacakt[ıi]/i.test(text))) {
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

  if (asksEsmaMatch || (hasEbcedKw && /\besma\b/i.test(text))) {
    return {
      active: true,
      kind: 'esma_match',
      targetValue: lastTotal,
      arabicSpans,
      lastTotal,
    };
  }

  if (arabicSpans.length || (hasName && (hasEbcedKw || hasArabicLetters(text) || /yaz[ıi]l[ıi]r|hesap/i.test(text)))) {
    return {
      active: true,
      kind: 'calculate',
      arabicSpans,
      lastTotal,
      latinHint: hasName ? text.match(NAME_CALC_RE)?.[1] : null,
    };
  }

  if (hasEbcedKw && (hasName || arabicSpans.length || /\d{2,4}/.test(text))) {
    return {
      active: true,
      kind: 'calculate',
      arabicSpans,
      lastTotal,
      latinHint: hasName ? text.match(NAME_CALC_RE)?.[1] : null,
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

  const reply = [
    `Kullanılan Arapça yazım: ${calc.normalizedText}`,
    `Yöntem: ${calc.methodologyId}`,
    '',
    formatAbjadBreakdown(calc.letters, calc.total),
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

/** Re-export helpers useful in tests */
export {
  calculateAbjad,
  findEsmaMatches,
  resolveArabicSpelling,
  lookupEsmaAbjadEntry,
  lookupNameSpelling,
};

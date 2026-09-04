/**
 * Devotional Esma / dua / zikir recommendation — claim calibration, not a router.
 *
 * Reuses: esma-catalog theme match, symbolic safety, evidence-meaning medical-claim guard,
 * abjad contamination exclusion (ebced only when explicitly requested).
 *
 * MEDICAL CONTEXT ≠ SPIRITUAL RESPONSE BLOCK.
 * Recommendation suppression is forbidden; unsupported treatment claims are calibrated.
 */

import {
  ESMA_CATALOG,
  INTENTION_THEME_HINTS,
} from './symbolic-analysis/data/esma-catalog.js';
import { sanitizeSymbolicProse } from './symbolic-analysis/safety.js';
import {
  isExplicitEbcedEsmaMatchAsk,
  extractLastVerifiedTotalFromHistory,
} from './abjad-verification.js';
import {
  applyMedicalSpiritualClaimGuard,
} from './evidence-meaning-boundaries.js';

export const DEVOTIONAL_RECOMMENDATION_VERSION = 'devotional-recommendation-v1';

const ESMA_ASK_RE =
  /\b(esma|esmalar|esmaül|esmaul|esma[yıi]|ya\s+[şs][aâ]f[iî]|ş[aâ]f[iî])\b/iu;

const DUA_ZIKIR_ASK_RE =
  /\b(dua|zikir|okuyabilece[gğ]im|ne\s+okuyabil|manevi\s+olarak|manevi\s+destek|[cç]ekeyim|[cç]ekilmeli|[cç]ekilir|ka[cç]\s*(kere|kez|defa)|ne\s+kadar)\b/iu;

const RECOMMEND_ASK_RE =
  /\b(hangi|ne\s+okuy\w*|ne\s+[cç]ek\w*|öner|tavsiye|okuyabil\w*|okuyay[ıi]m|[cç]ekeyim)\b/iu;

const COUNT_ASK_RE =
  /\b(ne\s+kadar|ka[cç]\s*(kere|kez|defa)|ka[cç]\s*[cç]ekil|adet|say[ıi])\b/iu;

const TREATMENT_CLAIM_ASK_RE =
  /\b(iyile[sş]tirir\s*mi|tedavi\s+eder\s*mi|ge[cç]irir\s*mi|d[uü]zeltir\s*mi|kreatinin.{0,20}d[uü][sş][uü]r|organ[ıi]\s+iyile[sş]|yerine\s+ge[cç]er\s*mi)\b/iu;

const MEDICAL_CONTEXT_RE =
  /\b(hastal[ıi][kğ]|hasta|yetmezli[gğ]|b[oö]brek|parankim|kanser|amigdal|ameliyat|migren|a[gğ]r[ıi]|kronik|kreatinin|doktor|tedavi|klinik|te[sş]his)\b/iu;

const MEDICAL_ONLY_RE =
  /\b(neden\s+y[uü]ksel|nas[ıi]l\s+olu[sş]|mekanizma|fizyoloji|patofizyoloji|kreatinin\s+neden|lab\s+sonuc|tahlil)\b/iu;

const EXPLICIT_EBCED_RE =
  /\b(ebced|abjad|cifir|ismimin\s+ebced|denk\s+gelen|harf\s+hesab)\b/iu;

const REJECT_EBCED_PREREQ_RE =
  /\b(ebced\s+sormuyorum|ebced\s+istemiyorum|ebced\s+de[gğ]il|arap[cç]a\s+(yaz[ıi]m|istemiyorum)|sorunu\s+(tam\s+)?anlamad[ıi]n|ben\s+de\s+sana\s+soruyorum)\b/iu;

const NAMED_ESMA_RE =
  /\b(?:ya\s+)?(?:[eé][lşs]-?)?(ş[aâ]f[iî]|safi|lat[iî]f|rahm[aâ]n|rah[iî]m|sel[aâ]m|hak[iî]m|ved[uû]d|sab[uû]r)\b/iu;

/**
 * @param {string} message
 * @param {{ history?: Array<{role?: string, content?: string}> }} [opts]
 */
export function detectDevotionalRecommendationIntent(message, opts = {}) {
  const text = String(message || '').normalize('NFC').trim();
  if (!text) {
    return {
      active: false,
      subintent: null,
      medicalContext: false,
      treatmentClaimRequested: false,
      ebcedRequested: false,
      countAsked: false,
      followUpRepair: false,
    };
  }

  const history = opts.history || [];
  // Wired to real history (Ebced/Intelligence Layer integration): a recent
  // verified Ebced total is exactly the signal isExplicitEbcedEsmaMatchAsk's
  // own "short follow-up after a verified total" branch already looks for
  // (see abjad-verification.js) — without it, an ambiguous short "Hangi
  // Esma?" after a Furkan/etc. calculation had no way to defer to the
  // Ebced engine and was claimed here instead, since ESMA_ASK_RE alone
  // can't distinguish "which Esma matches my number" from "which Esma
  // should I recite".
  const lastTotal = extractLastVerifiedTotalFromHistory(history);
  const ebcedRequested =
    EXPLICIT_EBCED_RE.test(text) || isExplicitEbcedEsmaMatchAsk(text, lastTotal);
  const medicalContext = MEDICAL_CONTEXT_RE.test(text);
  const medicalOnly =
    medicalContext &&
    MEDICAL_ONLY_RE.test(text) &&
    !ESMA_ASK_RE.test(text) &&
    !DUA_ZIKIR_ASK_RE.test(text) &&
    !RECOMMEND_ASK_RE.test(text);
  const treatmentClaimRequested = TREATMENT_CLAIM_ASK_RE.test(text);
  const countAsked = COUNT_ASK_RE.test(text);
  const spiritualAsk =
    ESMA_ASK_RE.test(text) ||
    (DUA_ZIKIR_ASK_RE.test(text) && RECOMMEND_ASK_RE.test(text)) ||
    (/\bmanevi\b/i.test(text) && /\b(oku\w*|[cç]ek\w*|dua|zikir)\b/i.test(text));

  const priorAskedArabic = history.some(
    (h) =>
      (h?.role === 'assistant' || h?.role === 'atlas') &&
      /Arapça yazım|ebced toplam|doğrulanmış bir ebced/i.test(String(h?.content || '')),
  );
  const followUpRepair =
    REJECT_EBCED_PREREQ_RE.test(text) ||
    (priorAskedArabic &&
      spiritualAsk &&
      !ebcedRequested &&
      /\b(hay[ıi]r|de[gğ]il|anlamad|ebced\s+sorm)/i.test(text));

  // Explicit personal ebced match stays on abjad engine.
  if (ebcedRequested && !followUpRepair && !treatmentClaimRequested) {
    return {
      active: false,
      subintent: null,
      medicalContext,
      treatmentClaimRequested: false,
      ebcedRequested: true,
      countAsked,
      followUpRepair: false,
    };
  }

  if (medicalOnly && !treatmentClaimRequested) {
    return {
      active: false,
      subintent: null,
      medicalContext: true,
      treatmentClaimRequested: false,
      ebcedRequested: false,
      countAsked: false,
      followUpRepair: false,
      medicalOnly: true,
    };
  }

  let subintent = null;
  if (treatmentClaimRequested && (ESMA_ASK_RE.test(text) || NAMED_ESMA_RE.test(text))) {
    subintent = 'treatment_claim_calibration';
  } else if (countAsked && NAMED_ESMA_RE.test(text) && !RECOMMEND_ASK_RE.test(text) && !medicalContext) {
    subintent = 'count_guidance';
  } else if (spiritualAsk && (ESMA_ASK_RE.test(text) || DUA_ZIKIR_ASK_RE.test(text))) {
    subintent = 'esma_recommendation';
  } else if (followUpRepair && spiritualAsk) {
    subintent = 'esma_recommendation';
  }

  return {
    active: Boolean(subintent),
    subintent,
    medicalContext,
    treatmentClaimRequested,
    ebcedRequested: false,
    countAsked,
    followUpRepair,
    medicalOnly: false,
  };
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractIntentionThemes(text) {
  const lower = String(text || '').toLocaleLowerCase('tr-TR');
  const themes = new Set();
  for (const [key, vals] of Object.entries(INTENTION_THEME_HINTS)) {
    if (lower.includes(key)) {
      for (const v of vals) themes.add(v);
    }
  }
  if (/şifa|hasta|hastal|ameliyat|böbrek|migren|ağrı|kanser|kronik/i.test(text)) {
    for (const v of INTENTION_THEME_HINTS.şifa || ['şifa', 'sabır', 'huzur']) {
      themes.add(v);
    }
  }
  return [...themes];
}

/**
 * Theme-based Esma picks — no name / ebced required.
 * @param {string} message
 * @returns {typeof ESMA_CATALOG[number][]}
 */
export function selectDevotionalEsma(message) {
  const themes = extractIntentionThemes(message);
  const scored = ESMA_CATALOG.map((entry) => {
    let score = 0;
    for (const theme of themes) {
      if (entry.themes.some((t) => t.includes(theme) || theme.includes(t))) {
        score += 3;
      }
    }
    // Prefer Şâfî when healing themes present
    if (
      entry.id === 'safi' &&
      themes.some((t) => /şifa|sabır|manevi/.test(t))
    ) {
      score += 4;
    }
    if (entry.id === 'latif' && themes.includes('şifa')) score += 1;
    if (entry.id === 'rahman' && themes.includes('şifa')) score += 1;
    return { entry, score };
  });
  scored.sort((a, b) => b.score - a.score || a.entry.latin.localeCompare(b.entry.latin, 'tr'));
  const hasHit = scored.some((s) => s.score >= 3);
  if (hasHit) return scored.slice(0, 3).map((s) => s.entry);
  // Stable healing-oriented default
  const defaults = ['safi', 'latif', 'rahman']
    .map((id) => ESMA_CATALOG.find((e) => e.id === id))
    .filter(Boolean);
  return defaults.length ? defaults : scored.slice(0, 3).map((s) => s.entry);
}

function formatYaName(entry) {
  const bare = String(entry.latin || '')
    .replace(/^(El|Er|Eş|Es|En)-?/i, '')
    .trim();
  return `Ya ${bare}`;
}

function buildCountGuidance(countAsked) {
  if (!countAsked) {
    return 'Belirli bir hastalık için dinen zorunlu veya tıbben kanıtlanmış özel bir zikir sayısı yoktur. İstersen örneğin 33 veya 99 gibi düzenli, seni zorlamayacak bir sayı seçebilirsin.';
  }
  return 'Hastalığa özgü zorunlu bir sayı yoktur. Sayıdan çok devamlılık ve dua niyeti önemli; istersen sabah-akşam 33 veya 99 gibi düzenli bir pratik seçebilirsin. Belirli bir sayıda okumanın iyileşme garantisi yoktur.';
}

/**
 * @param {{
 *   message: string,
 *   history?: Array<{role?: string, content?: string}>,
 *   intent?: ReturnType<typeof detectDevotionalRecommendationIntent>,
 * }} input
 */
export function buildDevotionalRecommendationReply(input = {}) {
  const message = String(input.message || '').trim();
  const intent =
    input.intent ||
    detectDevotionalRecommendationIntent(message, { history: input.history });

  if (!intent.active) {
    return { active: false, reply: null, intent };
  }

  const selected = selectDevotionalEsma(message);
  const primary = selected[0];
  const others = selected.slice(1);
  const recovery = intent.followUpRepair
    ? 'Anladım; ebced veya Arapça isim hesabı sormuyorsun. '
    : '';

  let reply;
  if (intent.subintent === 'treatment_claim_calibration') {
    const name = message.match(NAMED_ESMA_RE)?.[0] || 'Eş-Şâfî';
    reply = [
      `${recovery}${name} geleneğinde şifa, merhamet ve manevi sükûnet niyetiyle anılan bir isimdir.`,
      'Bunu hastalığı tedavi eden, organı düzelten veya lab değerlerini değiştiren tıbbi bir yöntem olarak doğrulayamam.',
      'Doktor kontrollerin ve tedavi planın ayrı bir düzlemdedir; dua ve zikir manevi destek olarak düşünülebilir.',
    ].join(' ');
  } else if (intent.subintent === 'count_guidance') {
    const nameMatch = message.match(NAMED_ESMA_RE);
    const label = nameMatch ? nameMatch[0] : 'Bu Esma';
    reply = [
      `${recovery}${label} için herkese zorunlu, hastalığa özgü sabit bir sayı yoktur.`,
      'Bazı kişiler düzenli pratik için 33 veya 99 gibi sayılar tercih eder; bu bir geleneksel alışkanlık olabilir, garanti reçete değildir.',
      'Sayıdan çok niyet ve devamlılık önemlidir.',
    ].join(' ');
  } else {
    const medicalLead = intent.medicalContext
      ? 'Doktor kontrollerin devam ederken, manevi destek amacıyla hangi Esma’yı zikredebileceğini soruyorsun. '
      : '';
    const primaryLine = primary
      ? `Şifa niyetiyle **${formatYaName(primary)}** zikrini tercih edebilirsin.`
      : 'Şifa niyetiyle Esma zikri yapabilirsin.';
    const also =
      others.length > 0
        ? ` Ayrıca ${others.map((e) => `**${formatYaName(e)}**`).join(' ve ')} da dua ve manevi sükûnet niyetiyle zikredilebilir.`
        : '';
    const frame =
      ' Bunları hastalığı tedavi eden bir yöntem olarak değil, dua ve manevi destek olarak düşün.';
    const count = ` ${buildCountGuidance(intent.countAsked)}`;
    const medicalClose = intent.medicalContext
      ? ' Doktorunun kontrollerine ve verdiği tedavi planına aynen devam et.'
      : '';
    reply = `${recovery}${medicalLead}${primaryLine}${also}${frame}${count}${medicalClose}`.replace(
      /\s{2,}/g,
      ' ',
    );
  }

  const guarded = applyMedicalSpiritualClaimGuard(reply, {
    medicalContext: intent.medicalContext,
    message,
  });
  const safe = sanitizeSymbolicProse(guarded.reply);

  return {
    active: true,
    reply: safe.text,
    intent,
    selected: selected.map((e) => ({ id: e.id, latin: e.latin })),
    engine: 'devotional-recommendation',
    version: DEVOTIONAL_RECOMMENDATION_VERSION,
    claimHits: guarded.hits,
  };
}

/**
 * @param {{ message: string, history?: Array<{role?: string, content?: string}> }} input
 */
export function tryDeterministicDevotionalReply(input = {}) {
  const intent = detectDevotionalRecommendationIntent(input.message, {
    history: input.history,
  });
  if (!intent.active) return null;
  const built = buildDevotionalRecommendationReply({
    message: input.message,
    history: input.history,
    intent,
  });
  if (!built.active || !built.reply) return null;
  return built;
}

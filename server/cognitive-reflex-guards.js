/**
 * Cognitive Reflex — small deterministic guards (P2).
 * Not a standalone engine. Hooks message-service + CLS only.
 *
 * Internal signals only — never show stance / H-band / advance bits to users.
 */

import {
  scanCertaintyLanguage,
  sanitizeCertaintyLanguage,
} from './cross-layer-synthesis/certainty-filter.js';

const CASUAL_INTENTS = new Set([
  'greeting',
  'how_are_you',
  'thanks',
  'ping',
  'fatigue',
  'get_current_hijri_date',
]);

/** Conservative stance patterns — high precision, low recall. */
const STANCE_PATTERNS = {
  approval_seek: [
    /\bhaklı\s*mıyım\b/i,
    /\bdoğru\s*mu\s*(düşün|yap|mu|mü)/i,
    /\bböyle\s*düşünmem\s*normal\s*mi\b/i,
    /\bonaylıyor\s*musun\b/i,
    /\bbana\s*hak\s*ver\b/i,
    /\bsen\s*de\s*öyle\s*düşünmüyor\s*musun\b/i,
  ],
  fear: [
    /\bkorkuyorum\b/i,
    /\bkorktuğum\b|\bkorktugum\b/i,
    /\bbad\s*olacak\b/i,
    /\bfelaket\b/i,
    /\bmahvol/i,
    /\bbana\s*kötü\s*bir\s*şey\b/i,
    /\bkötü\s*mü\s*olacak\b/i,
    /\bbeklemekten\s*kork/i,
  ],
  decide_for_me: [
    /\bne\s*yapmalıyım\b/i,
    /\bne\s*yapmam\s*lazım\b/i,
    /\bsen\s*karar\s*ver\b/i,
    /\bbana\s*söyle\s*ne\s*yapayım\b/i,
    /\bhangi\s*yolu\s*seçmeliyim\b/i,
    /\bkararımı\s*sen\s*ver\b/i,
  ],
  info: [
    /\bnedir\b/i,
    /\bne\s*demek\b/i,
    /\bnasıl\s*hesaplan/i,
    /\banlat\b/i,
    /\baçıkla\b/i,
  ],
};

const PROCESS_NARRATION_RES = [
  /^\s*önce\s+ayıklıyorum\b/im,
  /^\s*şimdi\s+(iki|2|\d+)\s+işaret\b/im,
  /^\s*hipotezim\b/im,
  /^\s*önce\s+niyet(i|ini)?\s+ayır/im,
  /^\s*şimdi\s+güvenimi\s+düşür/im,
  /^\s*önce\s+işaret\s+sayıyorum\b/im,
  /^\s*şöyle\s+ilerliyorum\b/im,
];

const DECISION_STEAL_RES = [
  /\bkesinlikle\s+.+\s+yapmalısın\b/i,
  /\bsen\s+şunu\s+yapacaksın\b/i,
  /\bkaderin\s+bu\b/i,
  /\bbunu\s+yapmak\s+zorundasın\b/i,
  /\btek\s+doğru\s+seçim\b/i,
];

/**
 * Epistemic domain cues — high precision. Used to separate layers, not to
 * refuse symbolic frames. Not health-safety routing; works for any domain clash.
 * @type {Record<string, RegExp[]>}
 */
const EPISTEMIC_LAYER_PATTERNS = {
  biological: [
    /\bgenetik\b/i,
    /\bkal[ıi]tsal\b/i,
    /\bkal[ıi]t[ıi]m\b/i,
    /\bdna\b/i,
    /\bgen\b/i,
    /\bkanser\b/i,
    /\bt[uü]m[oö]r\b/i,
    /\bb[oö]brek\s+(kanser|yetmez)/i,
    /\byetmezli[gğ]i\b/i,
    /\bhastal[ıi][kğ]\b/i,
    /\bbiyolojik\b/i,
  ],
  medical: [
    /\btedavi\b/i,
    /\bte[sş]his\b/i,
    /\bdoktor\b/i,
    /\bklinik\b/i,
    /\bt[ıi]bbi\b/i,
    /\brapor\b/i,
    /\bila[cç]\b/i,
  ],
  environmental: [
    /\b[cç]evre\b/i,
    /\bmaruz\b/i,
    /\bzehir\b/i,
    /\bkimyasal\b/i,
    /\bbeslenme\b/i,
    /\bya[sş]am\s+ko[sş]ul/i,
  ],
  psychological: [
    /\bpsikoloj/i,
    /\btravma\b/i,
    /\bba[gğ]lanma\b/i,
    /\bduygu\b/i,
    /\bkayg[ıi]\b/i,
    /\bili[sş]ki\s+dinam/i,
  ],
  familial_pattern: [
    /\bku[sş]ak/i,
    /\bail[eé]/i,
    /\bs[oö]y\b/i,
    /\bne[sş]ilden\b/i,
    /\bbabadan\b/i,
    /\baneden\b/i,
    /\baktar/i,
    /\bhu[yğ]/i,
    /\b[oö]r[uü]nt[uü]/i,
    /\btekrar\s+eden\b/i,
  ],
  symbolic: [
    /\bkarma\b/i,
    /\bkader\b/i,
    /\bruh\b/i,
    /\bspirit/i,
    /\bsembolik\b/i,
    /\bd[oö]ng[uü]\b/i,
    /\bbilin[cç]li\s+se[cç]im/i,
    /\bd[oö]ng[uü]y[uü]\s+k[ıi]r/i,
    /\benerji\b/i,
    /\bniyet\b/i,
  ],
};

/** Serious / hard-to-reverse biological outcomes — no automatic optimism. */
const SERIOUS_IRREVERSIBLE_RE =
  /\b(kanser|t[uü]m[oö]r|yetmezli[gğ]i|kal[ıi]tsal\s+hastal|genetik\s+hastal|terminal|[oö]l[uü]mc[uü]l|geri\s+d[oö]nd[uü]r[uü]lemez)\b/i;

/** Optimistic “you can break the cycle by choice” claims. */
const CYCLE_BREAK_GUARANTEE_RES = [
  /\bbilin[cç]li\s+se[cç]im(ler)?(le|lerle)?\s+.{0,80}?(d[oö]ng[uü]|karma).{0,40}?k[ıi]r\w*/i,
  /\b(d[oö]ng[uü]|karma).{0,40}?(k[ıi]rmak|k[ıi]rabilir|k[ıi]rars[ıi]n|k[ıi]r[ıi]l[ıi]r)\s+m[uü]mk[uü]n/i,
  /\bse[cç]im(ler)?inle\s+.{0,40}?kaderi?\s+de[gğ]i[sş]tir/i,
  /\b(fark[ıi]ndal[ıi]kla|niyet\w*)\s+.{0,60}?(d[oö]ng[uü]|karma|[oö]r[uü]nt[uü]).{0,40}?(a[sş]abilir|k[ıi]rabilir|sona\s+erer|bitir)/i,
  /\bconscious\s+choice.{0,60}?(break|end|stop).{0,20}?(cycle|karma)/i,
];

/** Symbolic presented as biological / hard-factual mechanism. */
const SYMBOLIC_AS_BIOLOGY_RES = [
  /\bkarma\s+.{0,40}(genetik|kal[ıi]tsal|kanser|hastal[ıi][kğ]|biyolojik).{0,20}(neden|sebep|y[uü]z[uü]nden|do[gğ]ur)/i,
  /\b(genetik|kal[ıi]tsal|kanser|hastal[ıi][kğ]).{0,40}karma\s+.{0,20}(neden|sebep|sonucu)/i,
  /\bkader\s+.{0,30}(kanser|yetmezlik|genetik)\s+.{0,15}(verdi|yazd[ıi]|belirledi)/i,
  /\b(spirit[uü]el|sembolik)\s+.{0,40}(bilimsel|genetik|t[ıi]bbi)\s+.{0,20}(neden|a[cç][ıi]klama)/i,
];

/** Correlation dressed as causation (incl. after certainty soften). */
const CORRELATION_AS_CAUSE_RES = [
  /\bbunun\s+nedeni\s+kesin(likle)?\b/i,
  /\bbunun\s+nedeni\s+olası\s+olarak\b/i,
  /\bbunun\s+nedeni\s+budur\b/i,
  /\bbu\s+y[uü]zden\s+kesin(likle)?\b/i,
  /\bkorelasyon\s+nedenselliktir\b/i,
  /\bili[sş]ki\s+oldu[gğ]u\s+i[cç]in\s+nedenidir\b/i,
  /\bg[oö]zlem(ledi[gğ]imiz|lenen|)\s+.{0,30}(bu\s+y[uü]zden|nedeniyle)\s+kesin/i,
];

/** Mind / intent reading as certainty. */
const MIND_READING_RES = [
  /\bkesin(likle)?\s+(niyeti|d[uü][sş][uü]ncesi|amac[ıi])\b/i,
  /\bolas[ıi]\s+olarak\s+(niyeti|d[uü][sş][uü]ncesi|amac[ıi])\b/i,
  /\ba(?:sl|kl)[ıi]nda\s+ne\s+d[uü][sş][uü]nd/i,
  /\bzihninden\s+ge[cç]eni\s+ok/i,
  /\bbilin[cç]alt[ıi]\s+kesin(likle)?\b/i,
  /\bkesin(likle)?\s+onu\s+(istiyor|d[uü][sş][uü]n[uü]yor)\b/i,
];

/**
 * @param {string|null|undefined} conversationIntent
 */
export function isCasualReflexBypass(conversationIntent) {
  return CASUAL_INTENTS.has(conversationIntent);
}

/**
 * Detect distinct epistemic layers in a user message.
 * @param {string} message
 * @returns {{
 *   layers: string[],
 *   evidence: Record<string, string[]>,
 *   hasCrossDomainRisk: boolean,
 *   hasSeriousIrreversible: boolean,
 *   symbolicFrameActive: boolean,
 *   factualHardLayer: boolean,
 * }}
 */
export function detectEpistemicLayers(message) {
  const text = String(message || '');
  /** @type {Record<string, string[]>} */
  const evidence = {};
  const layers = [];

  for (const [id, patterns] of Object.entries(EPISTEMIC_LAYER_PATTERNS)) {
    const hits = [];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) hits.push(m[0]);
    }
    if (hits.length) {
      layers.push(id);
      evidence[id] = hits;
    }
  }

  const symbolicFrameActive = layers.includes('symbolic');
  const factualHardLayer =
    layers.includes('biological') || layers.includes('medical');
  const hasSeriousIrreversible = SERIOUS_IRREVERSIBLE_RE.test(text);
  // Any mix of symbolic/spiritual meaning with hard factual domains is risk.
  // Familial/psych alone is pattern talk; risk rises when paired with hard+symbolic.
  const hasCrossDomainRisk =
    layers.length >= 2 &&
    ((symbolicFrameActive && factualHardLayer) ||
      (symbolicFrameActive && layers.includes('environmental') && factualHardLayer) ||
      (layers.includes('familial_pattern') && factualHardLayer && symbolicFrameActive) ||
      (layers.includes('psychological') && factualHardLayer && symbolicFrameActive) ||
      (symbolicFrameActive &&
        layers.includes('familial_pattern') &&
        layers.includes('psychological')));

  return {
    layers,
    evidence,
    hasCrossDomainRisk,
    hasSeriousIrreversible,
    symbolicFrameActive,
    factualHardLayer,
  };
}

/**
 * Prompt lock: separate layers; preserve symbolic frame; no false mechanism merge.
 * @param {ReturnType<typeof detectEpistemicLayers>|null|undefined} epistemic
 */
export function buildEpistemicSeparationPromptLock(epistemic) {
  if (!epistemic || (!epistemic.hasCrossDomainRisk && !epistemic.hasSeriousIrreversible)) {
    return '';
  }

  const layerList = epistemic.layers.length
    ? epistemic.layers.join(', ')
    : 'mixed';

  const lines = [
    '## EPISTEMIC SEPARATION (internal — do not narrate labels)',
    `Detected layers: ${layerList}.`,
    'Keep layers distinct. Do not present one layer as the causal mechanism of another.',
    'Example: karma / symbolic meaning ≠ scientific cause of genetic or medical disease.',
    'If the user asks in a symbolic frame, answer that frame — do not dismiss or replace it.',
    'Then you may note the biological/medical layer as a separate domain with its own limits.',
    'Correlation is not causation. Observation is not proven intent.',
    'Calibrate: insufficient evidence → hypothesis language ("olabilir", "ayrı değerlendirmek gerekir"), not verdict.',
  ];

  if (epistemic.hasSeriousIrreversible) {
    lines.push(
      'Serious / hard-to-reverse outcomes present: do NOT promise that conscious choice will break, cure, or reverse the cycle.',
      'Prevention/follow-up talk must not be framed as guaranteed prevention or reversal.',
    );
  }

  if (epistemic.symbolicFrameActive) {
    lines.push(
      'User symbolic/spiritual frame: preserve it as meaning/interpretation, not as lab mechanism.',
    );
  }

  return lines.join('\n');
}

/**
 * Conservative analytic stance. Ambiguous → null (do NOT assume analysis).
 * @param {string} message
 * @param {{ conversationIntent?: string|null }} [opts]
 * @returns {'approval_seek'|'fear'|'decide_for_me'|'info'|null}
 */
export function detectAnalyticStance(message, opts = {}) {
  if (isCasualReflexBypass(opts.conversationIntent)) return null;
  const text = String(message || '').trim();
  if (!text || text.length < 8) return null;

  // Order: fear / decide / approval before broad info
  for (const id of ['fear', 'decide_for_me', 'approval_seek']) {
    if (STANCE_PATTERNS[id].some((re) => re.test(text))) return id;
  }

  // info only when clearly definitional and not emotional stew
  if (
    STANCE_PATTERNS.info.some((re) => re.test(text)) &&
    text.length < 120 &&
    !/[!?].*[!?]/.test(text) &&
    !/\b(kork|kaygı|endişe|ne\s+yapmalıyım|haklı\s*mıyım)\b/i.test(text)
  ) {
    return 'info';
  }

  return null;
}

/**
 * Advance = hypothesis permission only. Never certainty/proof/decision upgrade.
 * @param {object} input
 */
export function resolveAdvanceAllowed(input = {}) {
  if (input.casual === true) return false;
  const usable = Number(input.usableLayerCount) || 0;
  const rel = input.relationshipType || 'insufficient_data';
  const confidence = input.confidence || 'insufficient';

  if (usable < 2) return false;
  if (rel === 'insufficient_data') return false;
  if (confidence === 'insufficient') return false;
  // Independent layers: may hypothesize lightly that they do not converge
  return true;
}

/**
 * Map CLS confidence/relationship → H0–H3 (internal only).
 * @param {object} input
 * @returns {'H0'|'H1'|'H2'|'H3'}
 */
export function mapHypothesisBand(input = {}) {
  const usable = Number(input.usableLayerCount) || 0;
  const rel = input.relationshipType || 'insufficient_data';
  const confidence = input.confidence || 'insufficient';
  const advance = input.advanceAllowed === true;

  if (!advance || usable < 2 || rel === 'insufficient_data' || confidence === 'insufficient') {
    return 'H0';
  }

  if (confidence === 'low' || rel === 'independent') {
    return 'H1';
  }

  if (
    (rel === 'tension' || rel === 'contradictory' || rel === 'balancing') &&
    confidence !== 'high'
  ) {
    return 'H2';
  }

  if (
    (rel === 'supporting' ||
      rel === 'complementing' ||
      rel === 'same_theme_different_angle') &&
    usable >= 3
  ) {
    return 'H3';
  }

  return 'H2';
}

/**
 * Evidence endpoints from CLS layers + optional message spans.
 * @param {object|null} synthesis
 * @param {string} [message]
 */
export function buildEvidenceSet(synthesis, message = '') {
  const items = [];
  const summaries = synthesis?.sections?.sourceSummaries;
  if (Array.isArray(summaries)) {
    for (const s of summaries) {
      if (!s?.layerId) continue;
      items.push({
        ref: `layer:${s.layerId}`,
        kind: 'cls_layer',
        label: s.layerId,
      });
    }
  }

  // Only collected layers count — do not invent endpoints from relationship ids alone.

  // Message-mentioned verse-like refs (lightweight, no invention)
  const verseHits = String(message || '').matchAll(
    /\b(\d{1,3})\s*[:/]\s*(\d{1,3})\b/g,
  );
  for (const m of verseHits) {
    items.push({
      ref: `msg:verse:${m[1]}:${m[2]}`,
      kind: 'user_message',
      label: `${m[1]}:${m[2]}`,
    });
  }

  return items;
}

/**
 * Creative link only when A and B both resolve in EvidenceSet.
 * @param {object|null} synthesis
 * @param {Array<{ref:string,kind:string,label?:string}>} evidenceSet
 */
export function resolveCreativeProvenance(synthesis, evidenceSet) {
  const primary = synthesis?.primaryRelationship;
  if (!primary?.layerAId || !primary?.layerBId) {
    return { allowed: false, reason: 'no_pair', provenance: null };
  }

  const aRef = `layer:${primary.layerAId}`;
  const bRef = `layer:${primary.layerBId}`;
  const hasA = evidenceSet.some((e) => e.ref === aRef);
  const hasB = evidenceSet.some((e) => e.ref === bRef);

  if (!hasA || !hasB) {
    return { allowed: false, reason: 'endpoints_unresolved', provenance: null };
  }

  if (
    primary.type === 'insufficient_data' ||
    synthesis?.confidence === 'insufficient'
  ) {
    return { allowed: false, reason: 'insufficient', provenance: null };
  }

  const sourceKinds = [
    ...new Set(
      evidenceSet
        .filter((e) => e.ref === aRef || e.ref === bRef)
        .map((e) => e.kind),
    ),
  ];

  return {
    allowed: true,
    reason: null,
    provenance: {
      aRef,
      bRef,
      sourceKinds,
      relationshipType: primary.type,
    },
  };
}

/**
 * Attach reflex fields after CLS compose.
 * @param {object|null} synthesis
 * @param {{ usableLayerCount?: number, casual?: boolean, message?: string }} opts
 */
export function buildReflexStateFromSynthesis(synthesis, opts = {}) {
  const usableLayerCount =
    opts.usableLayerCount ??
    (Array.isArray(synthesis?.sections?.sourceSummaries)
      ? synthesis.sections.sourceSummaries.length
      : 0);

  const relationshipType = synthesis?.primaryRelationship?.type ?? 'insufficient_data';
  const confidence = synthesis?.confidence ?? 'insufficient';
  const advanceAllowed = resolveAdvanceAllowed({
    usableLayerCount,
    relationshipType,
    confidence,
    casual: opts.casual === true,
  });
  const hypothesisBand = mapHypothesisBand({
    usableLayerCount,
    relationshipType,
    confidence,
    advanceAllowed,
  });
  const evidenceSet = buildEvidenceSet(synthesis, opts.message);
  const creative = resolveCreativeProvenance(synthesis, evidenceSet);

  return {
    advanceAllowed,
    hypothesisBand,
    evidenceSet,
    creativeAllowed: creative.allowed,
    creativeProvenance: creative.provenance,
    creativeDenyReason: creative.reason,
    relationshipType,
    confidence,
    usableLayerCount,
  };
}

/**
 * Short internal prompt lock — never instruct the model to narrate process.
 * @param {object} reflex
 * @param {{ stance?: string|null, epistemic?: ReturnType<typeof detectEpistemicLayers>|null }} [extra]
 */
export function buildReflexPromptLock(reflex, extra = {}) {
  if (!reflex) return '';

  const stance = extra.stance || null;
  const hypTone =
    reflex.hypothesisBand === 'H0'
      ? 'Hipotez kurma; gerekirse dur veya sor. Etiket yazma.'
      : reflex.hypothesisBand === 'H1'
        ? 'İnce dayanakla konuş; güçlü iddia yok. Etiket yazma.'
        : reflex.hypothesisBand === 'H2'
          ? 'Çalışılabilir hipotez kurabilirsin; kanıt dili yok. Etiket yazma.'
          : 'Daha net hipotez kurabilirsin; hâlâ hipotez — kanıtlandı deme. Etiket yazma.';

  const creativeLine = reflex.creativeAllowed
    ? `Yaratıcı bağ yalnızca şunlar arasında: ${reflex.creativeProvenance?.aRef} ↔ ${reflex.creativeProvenance?.bRef}. Üçüncü olay/kişi/anı uydurma.`
    : 'Yaratıcı bağ kurma (kanıt uçları yok veya yetersiz). Olmayan C üretme.';

  const stanceLine =
    stance === 'approval_seek'
      ? 'Onay gazı yok; dürüst çerçeve.'
      : stance === 'fear'
        ? 'Korkuyu besleme; kesin kader dili yok.'
        : stance === 'decide_for_me'
          ? 'Hayat kararı verme; seçenek çerçevesi yeter.'
          : '';

  const epistemicBlock = buildEpistemicSeparationPromptLock(extra.epistemic);

  return `
## COGNITIVE LOCKS (internal — do not narrate, do not print labels)
- advanceAllowed: ${reflex.advanceAllowed} (= hypothesis permission ONLY; never proof / certainty upgrade / prophecy / decision)
- hypothesis guidance: ${hypTone}
- creative: ${creativeLine}
${stanceLine ? `- stance hint: ${stanceLine}` : ''}
- Never write process narration ("Önce ayıklıyorum", "İki işaret görüyorum", "Hipotezim…").
- Never show H0/H1/H2/H3, advanceAllowed, or stance names to the user.
${epistemicBlock ? `\n${epistemicBlock}` : ''}
`.trim();
}

/**
 * Stance-only soft lock when CLS did not run.
 * @param {string|null} stance
 */
export function buildStancePromptHint(stance) {
  if (!stance) return '';
  if (stance === 'approval_seek') {
    return `## STANCE HINT (internal)\nOnay arayışı olabilir. Pohpohlama ve "kesinlikle haklısın" yok. Süreç anlatma.`;
  }
  if (stance === 'fear') {
    return `## STANCE HINT (internal)\nKorku tonu olabilir. Kehanet ve kesin kötü son yok. Süreç anlatma.`;
  }
  if (stance === 'decide_for_me') {
    return `## STANCE HINT (internal)\nKarar devri isteği olabilir. Emir verme; çerçeve sun. Süreç anlatma.`;
  }
  return '';
}

/**
 * Soften overconfident cross-domain / irreversibility leaks.
 * @param {string} text
 * @param {ReturnType<typeof detectEpistemicLayers>|null|undefined} epistemic
 * @param {string[]} hits
 */
function applyEpistemicPostSoftening(text, epistemic, hits) {
  let out = text;
  const cross =
    epistemic?.hasCrossDomainRisk === true || epistemic?.hasSeriousIrreversible === true;

  if (cross || CYCLE_BREAK_GUARANTEE_RES.some((re) => re.test(out))) {
    if (CYCLE_BREAK_GUARANTEE_RES.some((re) => re.test(out))) {
      hits.push('cycle_break_guarantee');
      out = out.replace(/[^.!?…\n]+[.!?…]?/g, (sentence) => {
        if (!CYCLE_BREAK_GUARANTEE_RES.some((re) => re.test(sentence))) return sentence;
        return ' Bilinçli seçim tek başına bu döngüyü garantiyle kırmaz; katmanları ayrı tutmak gerekir.';
      });
    }
  }

  if (cross || epistemic?.factualHardLayer) {
    for (const re of SYMBOLIC_AS_BIOLOGY_RES) {
      if (re.test(out)) {
        hits.push('symbolic_as_biology');
        out = out
          .replace(
            /\bkarma\s+(.{0,40}?)(genetik|kal[ıi]tsal|kanser|hastal[ıi][kğ]|biyolojik).{0,40}?(nedenidir|sebebidir|nedeni|sebep|y[uü]z[uü]nden|do[gğ]ur\w*)/gi,
            'karma sembolik anlam katmanıdır; $2 için bilimsel neden değildir',
          )
          .replace(
            /\b(genetik|kal[ıi]tsal|kanser|hastal[ıi][kğ])(.{0,40})karma\s+(.{0,20})(neden|sebep|sonucu)/gi,
            '$1$2karma $3nedeni olarak sunulamaz',
          )
          .replace(
            /\bkader\s+(.{0,30})(kanser|yetmezlik|genetik)\s+(.{0,15})(verdi|yazd[ıi]|belirledi)/gi,
            'kader $1$2 $3mekanizması diye bağlanamaz',
          );
        break;
      }
    }
  }

  if (cross || CORRELATION_AS_CAUSE_RES.some((re) => re.test(out))) {
    if (CORRELATION_AS_CAUSE_RES.some((re) => re.test(out))) {
      hits.push('correlation_as_causation');
      out = out
        .replace(/\bbunun\s+nedeni\s+kesin(likle)?\b/gi, 'bunun olası bir ilişkisi')
        .replace(/\bbunun\s+nedeni\s+olası\s+olarak\b/gi, 'bunun olası bir ilişkisi')
        .replace(/\bbunun\s+nedeni\s+budur\b/gi, 'bunun olası bir okuması')
        .replace(/\bbu\s+y[uü]zden\s+kesin(likle)?\b/gi, 'bu yüzden belki')
        .replace(/\bkorelasyon\s+nedenselliktir\b/gi, 'korelasyon nedensellik değildir')
        .replace(
          /\bili[sş]ki\s+oldu[gğ]u\s+i[cç]in\s+nedenidir\b/gi,
          'ilişki görünmesi tek başına neden demek değildir',
        )
        .replace(
          /\bg[oö]zlem(ledi[gğ]imiz|lenen|)\s+(.{0,30})(bu\s+y[uü]zden|nedeniyle)\s+kesin/gi,
          'gözlem$1 $2$3 kesin sonuç değildir',
        );
    }
  }

  if (cross || MIND_READING_RES.some((re) => re.test(out))) {
    if (MIND_READING_RES.some((re) => re.test(out))) {
      hits.push('mind_reading_certainty');
        out = out
          .replace(/\bkesin(likle)?\s+(niyeti|d[uü][sş][uü]ncesi|amac[ıi])\b/gi, 'olası $2')
          .replace(/\bolas[ıi]\s+olarak\s+(niyeti|d[uü][sş][uü]ncesi|amac[ıi])\b/gi, 'olası $1')
          .replace(
            /\ba(?:sl|kl)[ıi]nda\s+ne\s+d[uü][sş][uü]nd\S*\s+biliyorum\b/gi,
            'ne düşündüğünü buradan kesin çıkaramayız',
          )
          .replace(/\bzihninden\s+ge[cç]eni\s+ok\S*/gi, 'zihnini okuyamayız')
          .replace(/\bbilin[cç]alt[ıi]\s+kesin(likle)?\b/gi, 'bilinçaltı hipotezi');
    }
  }

  if (cross && /\b(kesin(likle)?\s+budur|tart[ıi][sş]mas[ıi]z)\b/i.test(out)) {
    hits.push('overconfident_verdict');
    out = out
      .replace(/\btart[ıi][sş]mas[ıi]z\b/gi, 'şimdilik olası')
      .replace(/\bkesin(likle)?\s+budur\b/gi, 'bu bir hipotez');
  }

  return out;
}

/**
 * Narrow post-generation guard.
 * @param {string} reply
 * @param {{
 *   casual?: boolean,
 *   advanceAllowed?: boolean,
 *   stance?: string|null,
 *   epistemic?: ReturnType<typeof detectEpistemicLayers>|null,
 * }} [opts]
 */
export function applyNarrowReflexPostGuard(reply, opts = {}) {
  const original = typeof reply === 'string' ? reply : '';
  if (!original.trim()) {
    return { reply: original, hits: [], changed: false };
  }

  // Casual short-circuit path should not be rewritten here (caller should skip).
  if (opts.casual === true) {
    return { reply: original, hits: [], changed: false };
  }

  const hits = [];
  let text = original;

  // Process narration: strip matching leading sentences only
  for (const re of PROCESS_NARRATION_RES) {
    if (re.test(text)) {
      hits.push('process_narration');
      text = text
        .replace(re, '')
        .replace(/^\s*[—–\-:]\s*/, '')
        .replace(/^\s+/, '');
      // If first paragraph was only narration, drop through blank line
      text = text.replace(/^\s*\n+/, '');
      break;
    }
  }

  const certainty = scanCertaintyLanguage(text);
  if (!certainty.ok) {
    hits.push('certainty_leak');
    text = sanitizeCertaintyLanguage(text).text;
  }

  // Advance must never upgrade into proof language (avoid \\b — Turkish letters break JS word boundaries)
  if (
    opts.advanceAllowed === true &&
    /kanıtlandı|kanitlandi|ispatlandı|ispatlandi|kesin\s+sonuç|kesin\s+sonuc/i.test(text)
  ) {
    hits.push('advance_as_proof');
    text = text
      .replace(/kanıtlandı|kanitlandi/gi, 'olası görünüyor')
      .replace(/ispatlandı|ispatlandi/gi, 'güçlü bir hipotez')
      .replace(/kesin\s+sonuç|kesin\s+sonuc/gi, 'çalışılabilir okuma');
  }

  if (
    (opts.stance === 'decide_for_me' || opts.advanceAllowed === true) &&
    DECISION_STEAL_RES.some((re) => re.test(text))
  ) {
    hits.push('decision_stealing');
    // Soften the most aggressive phrases only
    text = text
      .replace(/\bkaderin\s+bu\b/gi, 'bu bir olasılık alanı')
      .replace(/\bbunu\s+yapmak\s+zorundasın\b/gi, 'bunu tartmaya değer')
      .replace(/\btek\s+doğru\s+seçim\b/gi, 'öne çıkan seçeneklerden biri')
      .replace(/\bsen\s+şunu\s+yapacaksın\b/gi, 'şunu düşünebilirsin')
      .replace(/\bkesinlikle\s+/gi, '');
  }

  text = applyEpistemicPostSoftening(text, opts.epistemic ?? null, hits);

  return {
    reply: text,
    hits,
    changed: text !== original,
  };
}

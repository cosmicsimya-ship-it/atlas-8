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
 * @param {string|null|undefined} conversationIntent
 */
export function isCasualReflexBypass(conversationIntent) {
  return CASUAL_INTENTS.has(conversationIntent);
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
 * @param {{ stance?: string|null }} [extra]
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

  return `
## COGNITIVE LOCKS (internal — do not narrate, do not print labels)
- advanceAllowed: ${reflex.advanceAllowed} (= hypothesis permission ONLY; never proof / certainty upgrade / prophecy / decision)
- hypothesis guidance: ${hypTone}
- creative: ${creativeLine}
${stanceLine ? `- stance hint: ${stanceLine}` : ''}
- Never write process narration ("Önce ayıklıyorum", "İki işaret görüyorum", "Hipotezim…").
- Never show H0/H1/H2/H3, advanceAllowed, or stance names to the user.
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
 * Narrow post-generation guard.
 * @param {string} reply
 * @param {{ casual?: boolean, advanceAllowed?: boolean, stance?: string|null }} [opts]
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

  return {
    reply: text,
    hits,
    changed: text !== original,
  };
}

/**
 * Referential sufficiency — UNDERSTANDABLE ≠ ANSWERABLE.
 *
 * Extends conversation/symbolic/semantic layers; does not replace them.
 * When intent is clear but the target/referent/event is missing, ask ONE
 * high-information clarifying question instead of inventing premises.
 */

import {
  extractSymbolicReferents,
  isShortSymbolicFollowUp,
} from './symbolic-context.js';
import {
  isAmbiguousPatternSeeking,
  isRepeatingNumberPattern,
  extractPatternNumbers,
  AMBIGUOUS_PATTERN_CLARIFY_REPLY,
} from './semantic-layers.js';
import { getConversationState } from './conversation-context-engine.js';
import { resolveAssistantFollowUp } from './assistant-followup.js';

export const REFERENTIAL_SUFFICIENCY_VERSION = 'atlas-referential-sufficiency-v1';

/** @typedef {'referent_missing'|'subject_missing'|'event_missing'|'timeframe_missing'|'action_unclear'|'multiple_referents'|'ambiguous_pattern'} AmbiguityType */

/**
 * Direct questions that do not need a private referent to answer.
 * @param {string} message
 */
export function isDirectKnowledgeQuestion(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  // Bare deictic discovery starters are never "direct knowledge"
  if (/^bu\s+(tesad[uü]f|tarih|ki[sş]i|sefer)/i.test(text)) return false;
  if (/^as[ıi]l\s+[oö]r[uü]nt/i.test(text)) return false;
  if (/^bunun\s+sebebi|^yine\s+ayn[ıi]\s+[sş]ey/i.test(text)) return false;

  // Factual / definitional / traditional-meaning / general traits
  if (
    /(?:ba[sş]kent|nedir|nelerdir|ne\s+demek|ne\s+anlama(?:ya)?\s+gelir|anlam[ıi]\s+nedir|temel\s+anlam|genel\s+[oö]zellik|geleneksel\s+olarak|numerolojideki|ne(?:yi)?\s+(?:simgeler|temsil\s+eder)|tarotta\s+\w+|kart(?:[ıi]n[ıi]n|in)?\s+(?:temel\s+)?anlam|r[uü]yada\s+\w+|burcunun\s+genel)/i.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Discovery / pattern-investigation asks that need a concrete target.
 * Not limited to the five empty-state fixtures — general shapes.
 * @param {string} message
 */
export function isReferentHungryAsk(message) {
  const text = String(message || '').trim();
  if (!text) return false;

  const shapes = [
    /bu\s+tesad[uü]f\s+m[uü]/i,
    /tesad[uü]f\s+m[uü].*tekrar/i,
    /bu\s+tarih\s+neden/i,
    /as[ıi]l\s+[oö]r[uü]nt[uü]\s+ne/i,
    /bu\s+ki[sş]i\s+neden\s+(yeniden\s+)?g[uü]ndeme/i,
    /s[oö]yledi[gğ]iyle\s+yapt[ıi][gğ][ıi]\s+neden\s+[cç]eli[sş]/i,
    /bunun\s+sebebi\s+ne/i,
    /niye\s+yine\s+ayn[ıi]/i,
    /bu\s+ne\s+anlat[ıi]yor/i,
    /bunun\s+arkas[ıi]nda\s+ne\s+var/i,
    /yine\s+ayn[ıi]\s+[sş]ey\s+oldu/i,
    /bu\s+neden\s+(tekrar|oluyor|oluyor)/i,
    /neden\s+tekrar\s+ediyor/i,
    /^yine\s+oldu[.!?…]*$/i,
    /^o\s+neden\s+geri\s+geldi/i,
    /sence\s+geri\s+d[oö]ner\s+mi/i,
  ];
  return shapes.some((re) => re.test(text));
}

/**
 * Concrete observation tokens that make a pattern ask answerable.
 * @param {string} text
 */
function hasConcreteObservation(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (extractPatternNumbers(t).length > 0) return true;
  if (isRepeatingNumberPattern(t)) return true;
  if (/\b\d{1,2}\s*(kere|kez|defa|ay|g[uü]n|hafta)\b/i.test(t)) return true;
  if (
    /(?:mesaj\s+gel|yazd[ıi]|g[oö]rd[uü]m|kar[sş][ıi]ma\s+[cç][ıi]kt|gidip\s+geri|d[oö]nd[uü]|r[uü]yamda|kap[ıi]\s+kapal|anahtar|sembol)/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\d{1,2}\s+(?:ocak|[sş]ubat|mart|nisan|may[ıi]s|haziran|temmuz|a[gğ]ustos|eyl[uü]l|ekim|kas[ıi]m|aral[ıi]k)/i.test(
      t,
    )
  ) {
    return true;
  }
  // Named person-ish (capitalized Turkish word + person cue) — keep light
  if (/([\p{L}]{2,})\s+(ki[sş]i|adam|kad[ıi]n|arkada[sş]|sevgili)/iu.test(t)) return true;
  return false;
}

/**
 * @param {{ role?: string, content?: string }[]} history
 */
export function historyHasBindablePrior(history = []) {
  const recent = (history || []).slice(-8);
  for (const turn of [...recent].reverse()) {
    if (turn?.role !== 'user') continue;
    if (hasConcreteObservation(turn.content || '')) return true;
    const refs = extractSymbolicReferents(turn.content || '');
    // Deictic-only prior is not bindable without observation
    if (refs.some((r) => r.kind === 'date' || r.kind === 'number' || r.kind === 'zodiac')) {
      if (hasConcreteObservation(turn.content || '')) return true;
    }
  }
  return false;
}

/**
 * Count distinct person mentions in recent history (rough).
 * @param {{ role?: string, content?: string }[]} history
 */
function collectPersonCues(history = []) {
  const names = new Set();
  for (const turn of history || []) {
    if (turn?.role !== 'user') continue;
    const text = String(turn.content || '');
    const m = text.matchAll(
      /\b([A-ZÇĞİÖŞÜ][\p{L}']{1,24})\b(?:'n[ıi]n|\s+(?:ki[sş]i|bey|han[ıi]m))?/gu,
    );
    for (const hit of m) {
      const n = hit[1];
      if (/^(Bu|Şu|O|Ben|Sen|Bir|Her|Son|Ayn[ıi])$/i.test(n)) continue;
      names.add(n.toLocaleLowerCase('tr-TR'));
    }
    if (/bu\s+ki[sş]i|akl[ıi]mdaki\s+ki[sş]i/i.test(text)) names.add('__deictic_person__');
  }
  return [...names];
}

/**
 * Pick ONE clarifying question with high information gain.
 * @param {AmbiguityType} type
 * @param {string} message
 */
export function buildMinimumClarification(type, message = '') {
  const text = String(message || '');
  switch (type) {
    case 'event_missing':
      if (/tarih/i.test(text)) {
        return 'Hangi tarih? Ne sıklıkla karşılaştığını da söylersen birlikte bakalım.';
      }
      if (/[oö]r[uü]nt/i.test(text)) {
        return 'Hangi olayları yan yana koyuyorsun? İki-üç örnek verirsen ortak tarafı çıkarabilirim.';
      }
      if (/[cç]eli[sş]/i.test(text)) {
        return 'Ne söyledi, sonra ne yaptı? Kısa iki örnek yeter.';
      }
      if (/tesad[uü]f|tekrar/i.test(text)) {
        return 'Neyin tekrar ettiğini düşünüyorsun — bir kişi, olay, tarih, sayı ya da davranış mı?';
      }
      return 'Neyin olduğunu biraz netleştirelim — kişi, olay, tarih, sayı ya da davranış mı?';
    case 'subject_missing':
      return 'Kimden bahsediyorsun? Kısa bir işaret yeter.';
    case 'referent_missing':
      if (/ki[sş]i|g[uü]ndeme|geri\s+gel/i.test(text)) {
        return 'Hangi bağlamda yeniden ortaya çıktı — ne oldu, ne zaman?';
      }
      return '‘Bu’ derken neyi kastediyorsun? Kısa bir örnek yeter.';
    case 'multiple_referents':
      return 'Hangisinden bahsediyorsun? İki kişi geçti; kısaca ayırt edersen netleşir.';
    case 'action_unclear':
      return 'Neye bakmamı istiyorsun — mevcut konuyu mu, yoksa yeni bir şeyi mi?';
    case 'timeframe_missing':
      return 'Hangi dönemden bahsediyorsun?';
    case 'ambiguous_pattern':
      return AMBIGUOUS_PATTERN_CLARIFY_REPLY;
    default:
      return 'Neyin tekrar ettiğini düşünüyorsun — bir kişi, olay, tarih, sayı ya da davranış mı?';
  }
}

/**
 * Unsupported causal completion — inventing mechanisms without evidence.
 * Not a global word ban; used when referent was missing / discovery-shaped.
 * @param {string} reply
 */
export function detectUnsupportedCausalCompletion(reply) {
  const text = String(reply || '');
  const hits = [];
  const patterns = [
    [/bilin[cç]alt[ıi].{0,40}(çekiyor|tekrar)/i, 'subconscious_pull'],
    [/[cç]evresel\s+fakt[oö]r/i, 'environmental_factor_invented'],
    [/benzer\s+frekans/i, 'frequency_causation'],
    [/evrenden?\s+(gönder|mesaj|i[sş]aret)/i, 'universe_message'],
    [/enerji(?:sel)?\s+olarak/i, 'energy_as_cause'],
    [/kader\s+tekrar/i, 'fate_repetition'],
    [/kesin\s+bir\s+[oö]r[uü]nt/i, 'absolute_pattern'],
    [/bu\s+y[uü]zden\s+geri\s+geliyor/i, 'invented_return_cause'],
  ];
  for (const [re, id] of patterns) {
    if (re.test(text)) hits.push(id);
  }
  return hits;
}

/**
 * Soften unsupported causal framing when discovery ask lacked hard evidence.
 * Does not invent a new answer — only strips mechanism claims.
 * @param {string} reply
 * @param {{ hungry?: boolean, hadPrior?: boolean }} [opts]
 */
export function applyUnsupportedCausalGuard(reply, opts = {}) {
  const original = typeof reply === 'string' ? reply : '';
  if (!original.trim()) {
    return { reply: original, hits: [], changed: false };
  }
  // Only when the turn was discovery-shaped without prior observation evidence
  if (!opts.hungry || opts.hadPrior) {
    return { reply: original, hits: [], changed: false };
  }
  const hits = detectUnsupportedCausalCompletion(original);
  if (!hits.length) {
    return { reply: original, hits: [], changed: false };
  }
  let text = original
    .replace(/bilin[cç]alt[ıi]m[ıi]zda\s+veya\s+[cç]evresel\s+fakt[oö]rlerde\s+benzer\s+frekanslar[ıi]\s+yakalad[ıi][gğ][ıi]nda\s+kendini\s+tekrarlar\.?/gi, '')
    .replace(/benzer\s+frekanslar[ıi]\s+yakala\w*/gi, 'benzer durumlar tekrar edebilir')
    .replace(/bilin[cç]alt[ıi].{0,30}çekiyor\s+olabilir\.?/gi, 'tekrarlayan bir tema olabilir')
    .replace(/enerji(?:sel)?\s+olarak\s+/gi, 'sembolik olarak ')
    .replace(/evrenden?\s+(gönderiliyor|gönderiyor|bir\s+mesaj)\w*/gi, 'tekrarlayan bir tema');
  text = text.replace(/\s{2,}/g, ' ').trim();
  return { reply: text || original, hits, changed: text !== original };
}

/**
 * Core decision: do we have enough referent/subject/event to answer specifically?
 *
 * @param {{
 *   message: string,
 *   history?: { role?: string, content?: string }[],
 *   symbolicContext?: object|null,
 *   semanticLayers?: object|null,
 *   conversationId?: string,
 * }} input
 * @returns {{
 *   sufficient: boolean,
 *   intentKnown: boolean,
 *   referentKnown: boolean,
 *   ambiguityType: AmbiguityType|null,
 *   reason: string,
 *   question: string|null,
 *   version: string,
 * }}
 */
export function assessReferentialSufficiency(input) {
  const message = String(input.message || '').trim();
  const history = input.history || [];
  const ctx = input.symbolicContext || null;
  const layers = input.semanticLayers || null;
  const conversationId = input.conversationId || 'default';

  const base = {
    sufficient: true,
    intentKnown: false,
    referentKnown: false,
    ambiguityType: /** @type {AmbiguityType|null} */ (null),
    reason: 'default_allow',
    question: null,
    version: REFERENTIAL_SUFFICIENCY_VERSION,
  };

  if (!message) return base;

  const conv = getConversationState(conversationId);
  const storedDomain = conv?.symbolicDomain || null;

  // Assistant-anchored follow-up ("mesela", "ikincisi", "nasıl yani"…) —
  // prior assistant claim/options are the referent; do not clarify.
  const anchored = resolveAssistantFollowUp({
    message,
    history,
    offeredOptions: conv?.lastOfferedOptions || null,
    clientSelection: input.clientSelection || null,
  });
  if (anchored.resolved && anchored.sufficient) {
    return {
      ...base,
      intentKnown: true,
      referentKnown: true,
      reason: anchored.reason || 'assistant_anchored_followup',
      followUp: anchored,
    };
  }

  // Over-clarification protection: direct knowledge / definitional
  if (isDirectKnowledgeQuestion(message)) {
    return {
      ...base,
      intentKnown: true,
      referentKnown: true,
      reason: 'direct_knowledge',
    };
  }

  // Active engine session + short follow-up → answer
  if (
    ctx?.preserveActiveDomain &&
    (ctx.freshestSessionDomain || (ctx.liveSessions && ctx.liveSessions.length))
  ) {
    return {
      ...base,
      intentKnown: true,
      referentKnown: true,
      reason: 'active_session_followup',
    };
  }

  // Tarot / dream / astrology short continuations only when a live session or stored engine domain exists.
  // Deictic "bu kişi…" discovery asks must NOT skip clarification via preserveActiveDomain alone.
  const engineDomain =
    ctx?.freshestSessionDomain ||
    (ctx?.liveSessions && ctx.liveSessions[0]) ||
    (['tarot', 'dream', 'astrology', 'numerology'].includes(ctx?.primaryDomain)
      ? ctx.primaryDomain
      : null) ||
    (['tarot', 'dream', 'astrology', 'numerology'].includes(storedDomain) ? storedDomain : null);

  if (
    isShortSymbolicFollowUp(message) &&
    engineDomain &&
    (ctx?.liveSessions?.length ||
      ctx?.freshestSessionDomain ||
      (storedDomain && ['tarot', 'dream', 'astrology', 'numerology'].includes(storedDomain)))
  ) {
    // Still block hungry discovery asks that lack bindable prior
    if (!(isReferentHungryAsk(message) && !historyHasBindablePrior(history))) {
      return {
        ...base,
        intentKnown: true,
        referentKnown: true,
        reason: 'symbolic_short_followup',
      };
    }
  }

  // Current message already carries concrete observation
  if (hasConcreteObservation(message) && !isReferentHungryAsk(message)) {
    return {
      ...base,
      intentKnown: true,
      referentKnown: true,
      reason: 'message_concrete',
    };
  }

  // Deictic / discovery ask with bindable prior in history
  const hungry = isReferentHungryAsk(message);
  const ambiguous = Boolean(layers?.ambiguousPattern && !layers?.primaryLayer);
  const deicticRefs = extractSymbolicReferents(message);
  const prior = historyHasBindablePrior(history);

  if ((hungry || deicticRefs.length > 0) && prior) {
    // Multiple people + unresolved "o"
    if (/^o\s+neden|o\s+neden\s+geri/i.test(message)) {
      const people = collectPersonCues(history);
      const named = people.filter((p) => p !== '__deictic_person__');
      if (named.length >= 2) {
        return {
          sufficient: false,
          intentKnown: true,
          referentKnown: false,
          ambiguityType: 'multiple_referents',
          reason: 'multiple_person_referents',
          question: buildMinimumClarification('multiple_referents', message),
          version: REFERENTIAL_SUFFICIENCY_VERSION,
        };
      }
    }
    return {
      ...base,
      intentKnown: true,
      referentKnown: true,
      reason: 'prior_resolves_deictic',
    };
  }

  // Stored domain alone without observation is NOT enough for discovery asks
  if (hungry && !prior) {
    /** @type {AmbiguityType} */
    let type = 'event_missing';
    if (/ki[sş]i|geri\s+gel|g[uü]ndeme/i.test(message)) type = 'referent_missing';
    else if (/sence\s+geri|^o\s+neden/i.test(message)) type = 'subject_missing';
    else if (/[cç]eli[sş]/i.test(message)) type = 'event_missing';
    else if (/tarih/i.test(message)) type = 'event_missing';
    else if (/[oö]r[uü]nt/i.test(message)) type = 'event_missing';

    return {
      sufficient: false,
      intentKnown: true,
      referentKnown: false,
      ambiguityType: type,
      reason: 'discovery_without_referent',
      question: buildMinimumClarification(type, message),
      version: REFERENTIAL_SUFFICIENCY_VERSION,
    };
  }

  // Bare "yine oldu" / "buna bak" without active context
  if (
    (/^yine\s+oldu[.!?…]*$/i.test(message) || /^buna\s+bak[.!?…]*$/i.test(message)) &&
    !prior &&
    !ctx?.freshestSessionDomain &&
    !storedDomain
  ) {
    const type = /^buna\s+bak/i.test(message) ? 'action_unclear' : 'event_missing';
    return {
      sufficient: false,
      intentKnown: true,
      referentKnown: false,
      ambiguityType: type,
      reason: 'bare_followup_no_context',
      question: buildMinimumClarification(type, message),
      version: REFERENTIAL_SUFFICIENCY_VERSION,
    };
  }

  // Existing ambiguous pattern path
  if (ambiguous || isAmbiguousPatternSeeking(message)) {
    if (!prior && !(layers?.primaryLayer)) {
      return {
        sufficient: false,
        intentKnown: true,
        referentKnown: false,
        ambiguityType: 'ambiguous_pattern',
        reason: 'ambiguous_pattern_no_evidence',
        question: buildMinimumClarification('ambiguous_pattern', message),
        version: REFERENTIAL_SUFFICIENCY_VERSION,
      };
    }
  }

  // Hungry ask that also has concrete tokens in THE SAME message → answer
  if (hungry && hasConcreteObservation(message)) {
    return {
      ...base,
      intentKnown: true,
      referentKnown: true,
      reason: 'hungry_but_message_concrete',
    };
  }

  return base;
}

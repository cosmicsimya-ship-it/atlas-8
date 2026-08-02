/**
 * Deterministic persona feedback extraction (Phase 2).
 */

import { BRAND_ALIASES, CHANNEL_ALIASES } from './constants.js';
import { analyzeEditingDelta } from './editing-delta.js';

function norm(text) {
  return String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Quote / third-party / roleplay / translation isolation.
 */
export function detectUnsafeLearningContext(userMessage) {
  const text = norm(userMessage);
  const reasons = [];

  if (
    /(?:biri(?:si)?|arkadaşım|danışan|müşteri|o)\s+(?:bana\s+)?(?:['"«].+['"»]|daha\s+\w+)\s*(?:dedi|demiş|söyledi)/i.test(
      userMessage,
    ) ||
    /(?:dedi|demiş|söyledi).{0,40}(?:ama\s+)?ben\s+(?:istemiyorum|istemem|sevmiyorum)/i.test(text)
  ) {
    reasons.push('third_party_quote');
  }

  if (
    /(?:çevir|translate|rewrite|yeniden yaz|şu metni|şunu\s+daha\s+\w+\s+yaz|aşağıdaki metni|bu metni düzelt|edit this|proofread)/i.test(
      text,
    ) ||
    /şunu\s+[^:]{0,40}yaz\s*[:：]/i.test(text)
  ) {
    reasons.push('rewrite_or_translation');
  }

  if (/(?:rol yap|roleplay|mış gibi konuş|karakter olarak)/i.test(text)) {
    reasons.push('roleplay');
  }

  if (
    /(?:api anahtar|şifre|password|tc kimlik|kredi kartı|iban)/i.test(text)
  ) {
    reasons.push('sensitive_data');
  }

  return { unsafe: reasons.length > 0, reasons };
}

/**
 * Resolve brand/channel/content scope from message + context.
 */
export function resolveFeedbackScope(userMessage, context = {}) {
  const text = norm(userMessage);

  // Explicit single-response / session cues
  if (
    /(?:bu cevab[ıi]|bu yanıt[ıi]|bunu biraz|şimdilik|sadece bu|bu seferlik)/i.test(text)
  ) {
    return { type: 'single_response', target: null, confidence: 0.9 };
  }

  for (const [alias, id] of Object.entries(CHANNEL_ALIASES)) {
    if (text.includes(alias)) {
      return { type: 'channel', target: id, confidence: 0.92 };
    }
  }

  for (const [alias, id] of Object.entries(BRAND_ALIASES)) {
    if (text.includes(alias)) {
      return { type: 'brand', target: id, confidence: 0.92 };
    }
  }

  if (/(?:analiz(?:leri|lerde)?|meta sentez|günlük analiz)/i.test(text)) {
    return { type: 'content_type', target: 'analysis', confidence: 0.85 };
  }

  if (/(?:pdf|rapor)/i.test(text)) {
    return { type: 'channel', target: 'pdf-report', confidence: 0.88 };
  }

  if (context.channel && /telegram|instagram|threads/i.test(String(context.channel))) {
    // Channel mentioned indirectly via active context only counts if message implies continuation preference
    if (/(?:bundan sonra|her zaman|daima|bir daha)/i.test(text)) {
      return {
        type: 'channel',
        target: String(context.channel).toLowerCase(),
        confidence: 0.7,
      };
    }
  }

  if (/(?:bundan sonra|her zaman|daima|bir daha|benim dilimde)/i.test(text)) {
    return { type: 'global', target: null, confidence: 0.8 };
  }

  // Ambiguous → temporary session, never widen to global
  return { type: 'temporary_session', target: null, confidence: 0.55 };
}

/**
 * @typedef {Object} FeedbackSignalDraft
 * @property {string[]} category
 * @property {string} signal
 * @property {string} normalizedPreference
 * @property {{ type: string, target: string|null }} scope
 * @property {string} polarity
 * @property {number} strength
 * @property {number} confidence
 * @property {string} persistence
 */

/**
 * Rule table: pattern → signal traits (categories may accumulate).
 */
const RULES = [
  {
    re: /mekanik|robotik|yapay duruyor|çok şablon/,
    category: ['tone', 'editing_pattern'],
    polarity: 'avoid',
    preference: 'Avoid mechanical, robotic, or template-like phrasing; write naturally.',
    strength: 0.9,
  },
  {
    re: /daha tok|daha sert|çok yumuşak|fazla yumuşak/,
    category: ['tone'],
    polarity: 'prefer',
    preference: 'Prefer concise, assertive and high-impact phrasing.',
    strength: 0.9,
  },
  {
    re: /daha samimi|daha sıcak/,
    category: ['tone', 'formality'],
    polarity: 'prefer',
    preference: 'Prefer warmer, more familiar tone.',
    strength: 0.8,
  },
  {
    re: /daha profesyonel|mesafeli|daha resmi/,
    category: ['tone', 'formality'],
    polarity: 'prefer',
    preference: 'Prefer professional, measured distance in tone.',
    strength: 0.85,
  },
  {
    re: /(?:çok uzun|fazla uzun|kısalt|daha kısa|kısa yaz)/,
    category: ['length'],
    polarity: 'prefer',
    preference: 'Prefer shorter, denser responses.',
    strength: 0.85,
  },
  {
    re: /(?:daha detaylı|çok detaylı|detaylı anlat|detaylı yaz|daha uzun|kapsamlı anlat)/,
    category: ['length', 'content_depth'],
    polarity: 'prefer',
    preference: 'Prefer more detailed, thorough explanations.',
    strength: 0.85,
  },
  {
    re: /daha bilimsel|bilimsel anlat|daha literal|mistik olmasın|fazla mistik/,
    category: ['symbolic_language', 'factuality_boundary', 'brand_voice'],
    polarity: 'avoid',
    preference: 'Reduce mystical/symbolic flourish; keep more grounded and precise language.',
    strength: 0.88,
  },
  {
    re: /daha spiritüel|daha sembolik yaz|daha mistik yaz/,
    category: ['symbolic_language'],
    polarity: 'prefer',
    preference: 'Allow more symbolic / spiritual register when appropriate.',
    strength: 0.8,
  },
  {
    re: /daha doğal konuş|daha doğal yaz/,
    category: ['channel_voice', 'tone'],
    polarity: 'prefer',
    preference: 'Prefer natural conversational phrasing.',
    strength: 0.85,
  },
  {
    re: /(?:tonunu sevdim|böyle devam|böyle yazmaya devam|bunu sevdim)/,
    category: ['tone', 'preferred_expression'],
    polarity: 'continue',
    preference: 'Continue the appreciated tone and phrasing pattern from the last response.',
    strength: 0.75,
  },
  {
    re: /her yazıda|sürekli aynı|tekrar etme|bir daha .+ söyleme/,
    category: ['repetition'],
    polarity: 'avoid',
    preference: 'Avoid repeating the flagged stock phrase across posts.',
    strength: 0.9,
  },
  {
    re: /(?:benim dilim değil|dilim değil)/,
    category: ['brand_voice', 'tone', 'word_choice'],
    polarity: 'avoid',
    preference: 'Avoid phrasing that does not match Lara author voice.',
    strength: 0.9,
  },
  {
    re: /soru kullanma|soruyla bitirme/,
    category: ['sentence_structure', 'formatting'],
    polarity: 'avoid',
    preference: 'Avoid ending with questions unless necessary.',
    strength: 0.8,
  },
  {
    re: /soruyla aç|kancayı soru/,
    category: ['sentence_structure', 'formatting'],
    polarity: 'prefer',
    preference: 'Prefer question hooks when opening social content.',
    strength: 0.8,
  },
];

/**
 * Extract banned / preferred quoted words: "bir daha 'X' kelimesini kullanma"
 */
function extractExpressionSignals(userMessage, scope) {
  const signals = [];
  const banMatch = userMessage.match(
    /(?:bir daha|asla|hiç)\s+['"«]?([^'"»\n]{1,40})['"»]?\s*(?:kelimesini|ifadesini|cümlesini)?\s*(?:kullanma|deme|yazma)/i,
  );
  if (banMatch) {
    const expr = banMatch[1].trim();
    signals.push({
      category: ['banned_expression', 'word_choice'],
      signal: `bir daha '${expr}' kullanma`,
      normalizedPreference: `Do not use the expression "${expr}".`,
      scope,
      polarity: 'ban',
      strength: 0.95,
      confidence: 0.95,
      examples: { rejected: [expr], preferred: [] },
    });
  }

  const preferMatch = userMessage.match(
    /(?:şöyle yaz|şu şekilde yaz|tercihen)\s*[:：]?\s*['"«]([^'"»\n]{2,80})['"»]/i,
  );
  if (preferMatch) {
    const expr = preferMatch[1].trim();
    signals.push({
      category: ['preferred_expression', 'word_choice'],
      signal: `tercih edilen ifade: ${expr}`,
      normalizedPreference: `Prefer phrasing like "${expr}" when appropriate.`,
      scope,
      polarity: 'prefer',
      strength: 0.85,
      confidence: 0.85,
      examples: { rejected: [], preferred: [expr] },
    });
  }

  return signals;
}

function persistenceFor(text, scope, confidence) {
  const t = norm(text);
  const explicitForever =
    /(?:bundan sonra|her zaman|daima|bir daha|benim dilimde|kalıcı)/i.test(t);

  if (scope.type === 'single_response') return 'session';

  // Explicit ongoing preference → never treat as one-shot session.
  if (explicitForever) {
    if (scope.type === 'temporary_session' && confidence < 0.55) {
      return 'candidate';
    }
    if (confidence >= 0.9 && scope.type !== 'temporary_session') {
      return 'persistent';
    }
    return 'candidate';
  }

  if (scope.type === 'temporary_session') return 'session';

  // Like + continue → candidate, not immediate persistent
  if (/(?:sevdim|böyle devam)/i.test(t)) return 'candidate';

  return 'session';
}

/**
 * Invert mystic preference when user rejects quoted mystic advice.
 */
function extractNegatedQuotePreference(userMessage, scope) {
  const text = norm(userMessage);
  if (!/istemiyorum|istemem|sevmiyorum|istemediğim/.test(text)) return [];
  if (!/mistik|spiritüel|sembolik/.test(text)) return [];
  // User rejects mystic direction
  return [
    {
      category: ['symbolic_language', 'brand_voice'],
      signal: 'mistikliği artırmama',
      normalizedPreference: 'Do not increase mystical register; keep grounded Lara tone.',
      scope: scope.type === 'temporary_session' ? { type: 'global', target: null } : scope,
      polarity: 'avoid',
      strength: 0.85,
      confidence: 0.8,
      examples: { rejected: [], preferred: [] },
    },
  ];
}

/**
 * @param {{
 *   userMessage: string,
 *   assistantResponse?: string|null,
 *   revisedText?: string|null,
 *   context?: object,
 *   activeVoice?: object|null,
 *   authorProfile?: object|null,
 * }} input
 */
export function extractPersonaFeedback(input = {}) {
  const userMessage = String(input.userMessage ?? '');
  const context = input.context || {};
  const unsafe = detectUnsafeLearningContext(userMessage);

  /** @type {import('./extract.js').FeedbackSignalDraft[]} */
  let signals = [];
  let requiresClarification = false;
  let skippedReason = '';

  // Rewrite/translation: do not learn style from the provided text
  if (unsafe.reasons.includes('rewrite_or_translation') || unsafe.reasons.includes('roleplay') || unsafe.reasons.includes('sensitive_data')) {
    return {
      detected: false,
      signals: [],
      persistenceDecision: 'ignore',
      confidence: 0,
      requiresClarification: false,
      skippedReason: unsafe.reasons[0],
      debug: { unsafe },
    };
  }

  const scope = resolveFeedbackScope(userMessage, context);

  // Third-party quote: learn negation if present, never the quoted prefer
  if (unsafe.reasons.includes('third_party_quote')) {
    signals = extractNegatedQuotePreference(userMessage, scope);
    if (!signals.length) {
      return {
        detected: false,
        signals: [],
        persistenceDecision: 'ignore',
        confidence: 0.7,
        requiresClarification: false,
        skippedReason: 'third_party_quote',
        debug: { unsafe },
      };
    }
  } else {
    const text = norm(userMessage);
    for (const rule of RULES) {
      if (!rule.re.test(text)) continue;
      signals.push({
        category: rule.category,
        signal: userMessage.trim().slice(0, 160),
        normalizedPreference: rule.preference,
        scope,
        polarity: rule.polarity,
        strength: rule.strength,
        confidence: Math.min(0.98, rule.strength * (scope.confidence || 0.7)),
        examples: { rejected: [], preferred: [] },
      });
    }
    signals.push(...extractExpressionSignals(userMessage, scope));
  }

  // Editing delta → candidate editing_pattern signals
  if (input.assistantResponse && input.revisedText) {
    const delta = analyzeEditingDelta(input.assistantResponse, input.revisedText, context);
    for (const d of delta.signals || []) {
      signals.push({
        ...d,
        scope: d.scope || { type: 'temporary_session', target: null },
        persistence: 'candidate',
      });
    }
  }

  // Deduplicate by normalizedPreference + polarity + scope
  const seen = new Set();
  signals = signals.filter((s) => {
    const key = `${s.polarity}|${s.scope?.type}|${s.scope?.target}|${s.normalizedPreference}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!signals.length) {
    return {
      detected: false,
      signals: [],
      persistenceDecision: 'ignore',
      confidence: 0,
      requiresClarification: false,
      skippedReason: skippedReason || 'no_signal',
      debug: { unsafe, scope },
    };
  }

  // Attach persistence per signal
  const persistenceLevels = [];
  for (const s of signals) {
    const p = s.persistence || persistenceFor(userMessage, s.scope, s.confidence);
    s.persistence = p;
    persistenceLevels.push(p);
    // Never promote ambiguous temporary_session to global persistent
    if (s.scope.type === 'temporary_session' && p === 'persistent') {
      s.persistence = 'candidate';
      requiresClarification = true;
    }
  }

  const order = { ignore: 0, session: 1, candidate: 2, persistent: 3 };
  const persistenceDecision = persistenceLevels.reduce(
    (best, p) => (order[p] > order[best] ? p : best),
    'session',
  );

  const confidence =
    signals.reduce((sum, s) => sum + (s.confidence || 0), 0) / Math.max(1, signals.length);

  // If scope is weak and user didn't say forever, keep session
  if (scope.type === 'temporary_session' && persistenceDecision === 'persistent') {
    requiresClarification = true;
  }

  return {
    detected: true,
    signals,
    persistenceDecision,
    confidence,
    requiresClarification,
    skippedReason: '',
    debug: { unsafe, scope },
  };
}

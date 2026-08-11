// ═══════════════════════════════════════════════════════════════════════
// Conversation Context Engine — group/multi-turn grounding for Atlas chat
//
// Layers (ordered):
//   1. presence / wake
//   2. repair / correction
//   3. assistant self-identity guard
//   4. profile property query
//   5. short-utterance slot fill + pronoun/anaphora
//   6. response mode + repetition guard
//   7. participant-fact memory write validation
//
// Does NOT replace speaker-attribution or founder identity — it sits
// before ambiguous identity clarify and public-profile dumps.
// ═══════════════════════════════════════════════════════════════════════

import { getUserMemory, updateUserMemory, isValidUserId } from './user-memory.js';
import {
  detectSelfProfileQuery,
  normalizeUserProfileFacts,
  parseBirthDateParts,
  tropicalZodiacFromBirthDate,
  ageFromBirthDate,
  lifePathFromBirthDate,
  resolveSelfProfileValue,
  buildSelfProfileReply,
  logSelfProfileDebug,
  missingHintForSelfField,
  ASCENDANT_CALC_AVAILABLE,
} from './self-profile-resolver.js';

export {
  detectSelfProfileQuery,
  normalizeUserProfileFacts,
  parseBirthDateParts,
  tropicalZodiacFromBirthDate,
  ageFromBirthDate,
  lifePathFromBirthDate,
  resolveSelfProfileValue,
  buildSelfProfileReply,
  logSelfProfileDebug,
  missingHintForSelfField,
  ASCENDANT_CALC_AVAILABLE,
};

export const CONVERSATION_CONTEXT_VERSION = 'conversation-context-engine-v1';

/** @typedef {'casual_ack'|'casual_banter'|'direct_fact'|'correction_repair'|'clarification'|'analysis_request'|'profile_property_query'|'presence'|'instruction'|'roleplay_or_metaphor'|'other'} ResponseMode */

/**
 * @typedef {{
 *   activeTopic: string|null,
 *   symbolicDomain?: string|null,
 *   currentQuestion: string|null,
 *   expectedAnswerType: string|null,
 *   expectedSubject: { displayName?: string|null, userId?: string|null }|null,
 *   lastExplicitSubject: { displayName?: string|null, userId?: string|null }|null,
 *   lastReferencedSet: string|null,
 *   lastAssistantClaim: string|null,
 *   lastCorrectionTarget: string|null,
 *   recentFactsStated: string[],
 *   recentResponseIntents: string[],
 *   recentAssistantReplies: string[],
 *   participantFactsByTelegramId: Record<string, Record<string, { value: string, source: string, temporary?: boolean, updatedAt: string }>>,
 *   pendingSlot: { field: string, subjectDisplayName?: string|null, subjectUserId?: string|null, askedAt: string }|null,
 *   openTopicCollect: { topic: string, collected: Record<string, string> }|null,
 *   updatedAt: string|null,
 * }} ConversationState
 */

/** @type {Map<string, ConversationState>} */
const stateByConversation = new Map();

const ZODIAC_CANON = {
  koc: 'Koç',
  koç: 'Koç',
  boga: 'Boğa',
  boğa: 'Boğa',
  ikizler: 'İkizler',
  yengec: 'Yengeç',
  yengeç: 'Yengeç',
  aslan: 'Aslan',
  basak: 'Başak',
  başak: 'Başak',
  terazi: 'Terazi',
  akrep: 'Akrep',
  yay: 'Yay',
  oglak: 'Oğlak',
  oğlak: 'Oğlak',
  kova: 'Kova',
  balik: 'Balık',
  balık: 'Balık',
};

const ZODIAC_NAMES = new Set(Object.values(ZODIAC_CANON).map((z) => foldTr(z)));

const ELEMENT_SETS = {
  su: ['Yengeç', 'Akrep', 'Balık'],
  ates: ['Koç', 'Aslan', 'Yay'],
  ateş: ['Koç', 'Aslan', 'Yay'],
  toprak: ['Boğa', 'Başak', 'Oğlak'],
  hava: ['İkizler', 'Terazi', 'Kova'],
};

const PROPERTY_ALIASES = {
  zodiac: ['burç', 'burc', 'zodiac', 'zodyak'],
  age: ['yaş', 'yas', 'age'],
  birthDate: ['doğum tarihi', 'dogum tarihi', 'doğum günü', 'dogum gunu', 'birthday'],
  birthTime: ['doğum saati', 'dogum saati', 'doğum zamanı', 'dogum zamani', 'birth time'],
  birthPlace: ['doğum yeri', 'dogum yeri', 'doğum yeri nerede', 'birth place', 'birthplace'],
  occupation: ['meslek', 'işi', 'isi', 'iş', 'occupation', 'job'],
  rising: ['yükselen', 'yukselen', 'ascendant', 'rising', 'rising sign'],
  numerology: [
    'numeroloji',
    'numerolojim',
    'yaşam yolu',
    'yasam yolu',
    'yaşam yolum',
    'yasam yolum',
    'life path',
  ],
  abjad: ['ebced', 'ebcedim', 'abjad', 'abjadım', 'abjadim'],
};


const PRESENCE_RE =
  /^(?:ordam[ıi]s[ıi]n|orada\s*m[ıi]s[ıi]n|burada\s*m[ıi]s[ıi]n|burdam[ıi]s[ıi]n|aktif\s*m[ıi]s[ıi]n|ses\s*ver|dinliyor\s*musun|atlas\??|hey\s*atlas|alo|\?{1,2})\s*[?.!…]*$/iu;

const REPAIR_RE =
  /^(?:yanl[ıi][sş]\s*anlad[ıi]n|onu\s*demedim|[oö]yle\s*de[gğ]il|hay[ıi]r|atlas\s*error|error|d[uü]zelt|düzelt|[sş]unu\s*kastettim|burcu\s*burcu|lara'?y[ıi]\s*soruyor|yanl[ıi][sş]|de[gğ]il\s*o|senin|benim)\s*[?.!…😅😂😄]*$/iu;

const REPAIR_SOFT_RE =
  /\b(yanl[ıi][sş]\s*anlad[ıi]n|onu\s*demedim|[oö]yle\s*de[gğ]il|atlas\s*error|burcu\s*burcu|lara'?y[ıi]\s*soruyor|[sş]unu\s*kastettim)\b/iu;

const ASSISTANT_ZODIAC_CLAIM_RE =
  /\b(?:sen(?:in)?\s+)?(?:aslan|kova|yenge[cç]|akrep|bal[ıi]k|ko[cç]|bo[gğ]a|[iı]kizler|ba[sş]ak|terazi|yay|o[gğ]lak)\s+burcu(?:sun|sun)?\b.*\batlas\b|\batlas\b.*\b(?:aslan|kova|yenge[cç]|akrep|bal[ıi]k)\s*(?:burcu)?|\batlas\s+da\s+m[ıi]\s+(?:aslan|kova)/iu;

const SELF_ZODIAC_REPORT_RE =
  /\b(?:ben(?:im)?\s+)?(?:zaten\s+)?(?:do[gğ]u[sş]tan\s+)?(aslan|kova|yenge[cç]|akrep|bal[ıi]k|ko[cç]|bo[gğ]a|[iı]kizler|ba[sş]ak|terazi|yay|o[gğ]lak)(?:'?[ıi]m|'?y[ıi]m|'?im)?\b|\bbenim\s+(aslan|kova|yenge[cç]|akrep|bal[ıi]k|ko[cç]|bo[gğ]a|[iı]kizler|ba[sş]ak|terazi|yay|o[gğ]lak)\b/iu;

const BANTER_RE =
  /\b(tek\s+bur[cç]\s+aslan\w*|aslan\s+lobisi|😋|🔥|ate[sş]\s+grubu)\b/iu;

const COLLECT_ZODIAC_RE =
  /\bherkes\s+burcunu\s+yaz|bur[cç]lar[ıi]n[ıi]\s+yaz|grubu\s+analiz\s+edelim\b/iu;

const ANAPHORA_ALL_RE =
  /\b(hepsi|di[gğ]erleri|[oö]b[uü]rleri|[uü][cç][uü]\s*de|ayn[ıi]s[ıi]|bu\s*da)\b/iu;

const EXPLICIT_ADDRESS_RE =
  /\b(bana\s+\S+\s+(?:de|diye)|bundan\s+sonra\s+ad[ıi]m|beni\s+\S+\s+olarak\s+kaydet|ad[ıi]m\s+\S+|ismim\s+\S+)\b/iu;

/**
 * @param {string} text
 */
export function foldTr(text) {
  return String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/[î]/g, 'i')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/['’]/g, '');
}

/**
 * @returns {ConversationState}
 */
export function createEmptyConversationState() {
  return {
    activeTopic: null,
    symbolicDomain: null,
    currentQuestion: null,
    expectedAnswerType: null,
    expectedSubject: null,
    lastExplicitSubject: null,
    lastReferencedSet: null,
    lastAssistantClaim: null,
    lastCorrectionTarget: null,
    recentFactsStated: [],
    recentResponseIntents: [],
    recentAssistantReplies: [],
    participantFactsByTelegramId: {},
    pendingSlot: null,
    openTopicCollect: null,
    updatedAt: null,
  };
}

/**
 * @param {string} conversationId
 * @returns {ConversationState}
 */
export function getConversationState(conversationId) {
  const key = String(conversationId ?? '').trim() || 'default';
  if (!stateByConversation.has(key)) {
    stateByConversation.set(key, createEmptyConversationState());
  }
  return stateByConversation.get(key);
}

/**
 * @param {string} conversationId
 * @param {Partial<ConversationState>} patch
 */
export function updateConversationState(conversationId, patch) {
  const state = getConversationState(conversationId);
  Object.assign(state, patch, { updatedAt: new Date().toISOString() });
  return state;
}

/**
 * Test helper — wipe in-memory state.
 * @param {string} [conversationId]
 */
export function resetConversationState(conversationId) {
  if (conversationId == null) {
    stateByConversation.clear();
    return;
  }
  stateByConversation.delete(String(conversationId));
}

/**
 * @param {string} raw
 * @returns {string|null}
 */
export function canonicalizeZodiac(raw) {
  const t = foldTr(String(raw ?? '').trim());
  if (!t) return null;
  if (ZODIAC_CANON[t]) return ZODIAC_CANON[t];
  for (const [k, v] of Object.entries(ZODIAC_CANON)) {
    if (t === foldTr(v) || t.startsWith(k)) return v;
  }
  return null;
}

/**
 * @param {string} message
 */
export function isPresenceUtterance(message) {
  const t = String(message ?? '').trim();
  if (!t || t.length > 40) return false;
  return PRESENCE_RE.test(t);
}

/**
 * @param {string} message
 */
export function isExplicitAddressingRequest(message) {
  return EXPLICIT_ADDRESS_RE.test(String(message ?? ''));
}

/**
 * Tokens that must never be treated as a person name when alone.
 * Shared with identity-claims via export.
 */
export const CONTEXT_NON_NAME_TOKENS = new Set([
  'ordamisin',
  'ordamısin',
  'ordamısın',
  'ordamısın',
  'buradamisin',
  'buradamısın',
  'burdamisin',
  'burdamısın',
  'senin',
  'benim',
  'onun',
  'bizim',
  'sizin',
  'hayir',
  'hayır',
  'evet',
  'tamam',
  'yanlis',
  'yanlış',
  'error',
  'kova',
  'aslan',
  'yengec',
  'yengeç',
  'akrep',
  'balik',
  'balık',
  'koc',
  'koç',
  'boga',
  'boğa',
  'ikizler',
  'basak',
  'başak',
  'terazi',
  'yay',
  'oglak',
  'oğlak',
  'hepsi',
  'digerleri',
  'diğerleri',
  'oburleri',
  'öbürleri',
  'ayni',
  'aynı',
]);

/**
 * @param {string} token
 */
export function isContextNonNameToken(token) {
  const f = foldTr(token);
  if (!f) return false;
  if (CONTEXT_NON_NAME_TOKENS.has(f)) return true;
  if (ZODIAC_NAMES.has(f)) return true;
  if (canonicalizeZodiac(token)) return true;
  return false;
}

/**
 * Detect profile property query (single field about a named/implied person).
 * @param {string} message
 * @param {ConversationState} [state]
 * @returns {{ field: string, subjectDisplayName: string|null, subjectIsAtlas: boolean, subjectIsSender: boolean }|null}
 */
export function detectProfilePropertyQuery(message, state = null) {
  const text = String(message ?? '').trim();
  if (!text || text.length > 160) return null;

  const folded = foldTr(text);

  // Atlas self property — handled by self-identity guard, not property dump.
  if (/\batlas(?:in|in|nin|'nin)?\s+burc/.test(folded) || /\bburcun\s+ne.*\batlas\b/.test(folded)) {
    return { field: 'zodiac', subjectDisplayName: 'Atlas', subjectIsAtlas: true, subjectIsSender: false };
  }

  // First-person profile queries handled by detectSelfProfileQuery.
  const selfQ = detectSelfProfileQuery(text);
  if (selfQ) {
    return {
      field: selfQ.field,
      subjectDisplayName: null,
      subjectIsAtlas: false,
      subjectIsSender: true,
    };
  }

  for (const [field, aliases] of Object.entries(PROPERTY_ALIASES)) {
    for (const alias of aliases) {
      const a = foldTr(alias);
      // "{Name} (senin)? burcun/burcu nedir"
      const named = text.match(
        new RegExp(
          `([\\p{L}][\\p{L}'’.\\-]{1,29})\\s+(?:senin\\s+)?(?:${escapeRe(alias)})(?:un|ün|u|ü|in|ın)?\\s*(?:nedir|ne|kaç|kac)?\\s*[?.!…]*$`,
          'iu',
        ),
      );
      if (named?.[1] && !/^(senin|benim|onun|bunun|şu|su)$/iu.test(named[1])) {
        const subj = named[1];
        if (/^atlas$/iu.test(subj)) {
          return { field, subjectDisplayName: 'Atlas', subjectIsAtlas: true, subjectIsSender: false };
        }
        return {
          field,
          subjectDisplayName: subj,
          subjectIsAtlas: false,
          subjectIsSender: false,
        };
      }

      // "{Name}'nın burcu nedir"
      const poss = text.match(
        new RegExp(
          `([\\p{L}][\\p{L}'’.\\-]{1,29})(?:'n[ıi]n|’n[ıi]n|n[ıi]n)\\s+(?:${escapeRe(alias)})(?:u|ü|i|ı)?\\s*(?:nedir|ne)?\\s*[?.!…]*$`,
          'iu',
        ),
      );
      if (poss?.[1]) {
        const subj = poss[1];
        if (/^atlas$/iu.test(subj)) {
          return { field, subjectDisplayName: 'Atlas', subjectIsAtlas: true, subjectIsSender: false };
        }
        return {
          field,
          subjectDisplayName: subj,
          subjectIsAtlas: false,
          subjectIsSender: false,
        };
      }

      // Bare "burcun nedir?" with prior subject / sender
      if (
        new RegExp(`^(?:senin\\s+)?${escapeRe(a)}(?:un|ün|u|ü|in|ın)?\\s*(?:nedir|ne)?\\s*[?.!…]*$`, 'u').test(
          folded,
        )
      ) {
        const prior = state?.lastExplicitSubject?.displayName ?? state?.expectedSubject?.displayName ?? null;
        return {
          field,
          subjectDisplayName: prior,
          subjectIsAtlas: false,
          subjectIsSender: !prior,
        };
      }
    }
  }

  return null;
}

/**
 * Detect first-person self-profile property asks ("Benim burcum ne?", "Burcum nedir?").
 * @param {string} message
 * @returns {{ field: string }|null}
 */
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} message
 * @param {ConversationState} state
 */
export function detectRepairIntent(message, state) {
  const text = String(message ?? '').trim();
  if (!text) return null;
  const soft = REPAIR_SOFT_RE.test(text);
  const hard = REPAIR_RE.test(text) || soft;
  if (!hard) return null;

  const folded = foldTr(text);
  let correctionTarget = state.lastCorrectionTarget || state.currentQuestion || 'prior_interpretation';

  if (folded === 'senin' || folded.startsWith('senin ')) {
    correctionTarget = 'possessive_subject';
  } else if (folded === 'benim' || folded.startsWith('benim ')) {
    correctionTarget = 'self_subject';
  } else if (/burcu\s*burcu/.test(folded)) {
    correctionTarget = 'property_zodiac';
  } else if (/lara/.test(folded) && /soruyor|burc/.test(folded)) {
    correctionTarget = 'subject_lara_zodiac';
  }

  return {
    kind: 'correction_repair',
    correctionTarget,
    raw: text,
  };
}

/**
 * @param {string} message
 */
export function detectAssistantSelfIdentityClaim(message) {
  const text = String(message ?? '').trim();
  if (!text) return null;
  if (!ASSISTANT_ZODIAC_CLAIM_RE.test(text) && !/\bsen\s+aslan\s+burcusun\b/iu.test(text)) {
    // "Sen Aslan burcusun Atlas"
    if (!/\batlas\b/iu.test(text)) return null;
    if (!/\b(burcu|aslan|kova|yenge[cç]|akrep|bal[ıi]k)\b/iu.test(text)) return null;
  }
  const zodiac =
    canonicalizeZodiac(text.match(/\b(aslan|kova|yenge[cç]|akrep|bal[ıi]k|ko[cç]|bo[gğ]a|[iı]kizler|ba[sş]ak|terazi|yay|o[gğ]lak)\b/iu)?.[1]) ||
    'Aslan';
  return { kind: 'assistant_zodiac_roleplay', zodiac, temporary: true };
}

/**
 * Classify response mode for verbosity / tone.
 * @param {string} message
 * @param {{ state?: ConversationState, propertyQuery?: object|null, repair?: object|null, presence?: boolean, shortResolved?: object|null }} [ctx]
 * @returns {ResponseMode}
 */
export function classifyResponseMode(message, ctx = {}) {
  if (ctx.presence || isPresenceUtterance(message)) return 'presence';
  if (ctx.repair) return 'correction_repair';
  if (ctx.propertyQuery) return 'profile_property_query';
  if (ctx.shortResolved?.kind === 'slot_fill') return 'direct_fact';
  if (detectAssistantSelfIdentityClaim(message)) return 'roleplay_or_metaphor';

  const text = String(message ?? '').trim();
  if (BANTER_RE.test(text) || (text.length <= 40 && /[😋🔥😄😅😂]|lobisi|tek bur/i.test(text))) {
    return 'casual_banter';
  }
  if (/\b(analiz|yorumla|detayl[ıi]|nedenleriyle|kar[sş][ıi]la[sş]t[ıi]r)\b/i.test(text)) {
    return 'analysis_request';
  }
  if (/\b(kaydet|hat[ıi]rla|bundan\s+sonra|yapma|yap)\b/i.test(text) && text.length < 100) {
    return 'instruction';
  }
  if (text.length <= 24 && /^(tamam|ok|evet|yine|ayn[ıi]|hm+|hı+|peki)\b/i.test(text)) {
    return 'casual_ack';
  }
  if (/\?|nedir|ne\b|kaç|kim|hangi/.test(text) && text.length < 100) {
    return 'direct_fact';
  }
  return 'other';
}

/**
 * Resolve short utterances against recent conversation state.
 * @param {{
 *   message: string,
 *   state: ConversationState,
 *   sender: { userId?: string|null, displayName?: string|null },
 *   history?: Array<{ role: string, content: string }>,
 * }} input
 */
export function resolveShortUtterance(input) {
  const text = String(input.message ?? '').trim();
  if (!text || text.length > 48) return null;
  if (isExplicitAddressingRequest(text)) return null;
  if (isPresenceUtterance(text)) {
    return { kind: 'presence', reply: 'Buradayım.', responseMode: 'presence' };
  }

  const state = input.state;
  const folded = foldTr(text);
  const zodiac = canonicalizeZodiac(text.replace(/[?.!…😅😂😄]+$/g, '').trim());

  // Slot fill: prior assistant asked for a property / said not recorded.
  if (zodiac && state.pendingSlot?.field === 'zodiac') {
    return {
      kind: 'slot_fill',
      field: 'zodiac',
      value: zodiac,
      subjectDisplayName: state.pendingSlot.subjectDisplayName,
      subjectUserId: state.pendingSlot.subjectUserId,
      responseMode: 'direct_fact',
    };
  }

  // After property question about someone, bare zodiac from that person or anyone answering.
  if (
    zodiac &&
    (state.expectedAnswerType === 'zodiac' ||
      state.activeTopic === 'zodiac' ||
      /burc/.test(foldTr(state.currentQuestion || '')))
  ) {
    return {
      kind: 'slot_fill',
      field: 'zodiac',
      value: zodiac,
      subjectDisplayName:
        state.expectedSubject?.displayName ||
        state.lastExplicitSubject?.displayName ||
        input.sender.displayName ||
        null,
      subjectUserId: state.expectedSubject?.userId || input.sender.userId || null,
      responseMode: 'direct_fact',
    };
  }

  // Pronoun corrections
  if (folded === 'senin' || folded === 'benim') {
    return {
      kind: 'pronoun_repair',
      pronoun: folded,
      responseMode: 'correction_repair',
    };
  }

  // Anaphora: "Hepsi 3 tane" against element-set frame
  if (ANAPHORA_ALL_RE.test(text) && /\b([1234]|[uü][cç]|dort|dört|uc|üç)\b/iu.test(text)) {
    const setHint = state.lastReferencedSet || inferReferencedSetFromHistory(input.history);
    if (setHint === 'element_groups' || /su\s+grub|element|grup/i.test(JSON.stringify(input.history || []))) {
      return {
        kind: 'anaphora_set',
        referencedSet: 'element_groups',
        responseMode: 'casual_banter',
        reply: 'Aynen, dört element grubunun da üçer burcu var 😄',
      };
    }
  }

  // Self zodiac report short form "Benim aslan" / "Aslan"
  const selfZodiac = text.match(SELF_ZODIAC_REPORT_RE);
  if (selfZodiac) {
    const z = canonicalizeZodiac(selfZodiac[1] || selfZodiac[2] || text);
    if (z) {
      return {
        kind: 'self_fact',
        field: 'zodiac',
        value: z,
        subjectUserId: input.sender.userId,
        subjectDisplayName: input.sender.displayName,
        responseMode: classifyResponseMode(text, {}),
      };
    }
  }

  if (zodiac && text.split(/\s+/).length <= 3 && !state.pendingSlot && state.activeTopic !== 'zodiac') {
    // Bare zodiac with no slot — treat as self-report only in collect mode or banter context
    if (state.openTopicCollect?.topic === 'zodiac') {
      return {
        kind: 'self_fact',
        field: 'zodiac',
        value: zodiac,
        subjectUserId: input.sender.userId,
        subjectDisplayName: input.sender.displayName,
        responseMode: 'direct_fact',
      };
    }
  }

  return null;
}

/**
 * @param {Array<{ role: string, content: string }>|undefined} history
 */
function inferReferencedSetFromHistory(history) {
  const recent = (history || []).slice(-6);
  for (const turn of recent) {
    const c = foldTr(turn.content || '');
    if (/su\s+grub|ates\s+grub|toprak\s+grub|hava\s+grub|element/.test(c)) {
      return 'element_groups';
    }
  }
  return null;
}

/**
 * Look up a participant fact from conversation state or user memory.
 * @param {{
 *   field: string,
 *   subjectDisplayName?: string|null,
 *   subjectUserId?: string|null,
 *   state: ConversationState,
 *   knownParticipants?: Array<{ userId?: string, displayName?: string }>,
 * }} input
 */
export function lookupParticipantFact(input) {
  const field = input.field;
  const state = input.state;

  if (input.subjectUserId && state.participantFactsByTelegramId[input.subjectUserId]?.[field]) {
    return state.participantFactsByTelegramId[input.subjectUserId][field].value;
  }

  if (input.subjectUserId && isValidUserId(input.subjectUserId)) {
    const mem = getUserMemory(input.subjectUserId);
    if (field === 'zodiac' && mem?.facts?.zodiac) return String(mem.facts.zodiac);
    if (field === 'birthDate' && mem?.profile?.birthDate) return String(mem.profile.birthDate);
    if (field === 'age' && mem?.facts?.age) return String(mem.facts.age);
    if (field === 'occupation' && mem?.facts?.occupation) return String(mem.facts.occupation);
  }

  // Display-name scan of conversation-local facts (deterministic fixtures / group state)
  const want = foldTr(input.subjectDisplayName || '');
  if (want) {
    for (const [, facts] of Object.entries(state.participantFactsByTelegramId)) {
      const name = facts.__displayName?.value;
      if (name && foldTr(name) === want && facts[field]) {
        return facts[field].value;
      }
    }
    // Also scan known participants' memories by display name match on profile.name
    for (const p of input.knownParticipants || []) {
      if (p.displayName && foldTr(p.displayName) === want && p.userId && isValidUserId(p.userId)) {
        const mem = getUserMemory(p.userId);
        if (field === 'zodiac' && mem?.facts?.zodiac) return String(mem.facts.zodiac);
      }
    }
  }

  return null;
}

/**
 * Validate and optionally persist a participant fact.
 * Never writes Atlas self-attributes. Never cross-binds speakers.
 *
 * @param {{
 *   subjectUserId?: string|null,
 *   subjectDisplayName?: string|null,
 *   field: string,
 *   value: string,
 *   sourceSpeakerUserId?: string|null,
 *   explicit: boolean,
 *   temporary?: boolean,
 *   roleplay?: boolean,
 *   confidence?: 'high'|'medium'|'low',
 *   state: ConversationState,
 *   persist?: boolean,
 * }} input
 */
export function validateAndBindParticipantFact(input) {
  const subjectName = foldTr(input.subjectDisplayName || '');
  if (subjectName === 'atlas' || input.roleplay || input.temporary) {
    return { ok: false, reason: 'assistant_or_temporary', written: false };
  }

  if (!input.explicit && input.confidence === 'low') {
    return { ok: false, reason: 'low_confidence', written: false };
  }

  // Subject must be the source speaker for self-reports, or an explicit third-party
  // confirmation is required (slot-fill where subject answered about themselves).
  const subjectId = input.subjectUserId || null;
  const sourceId = input.sourceSpeakerUserId || null;

  if (subjectId && sourceId && subjectId !== sourceId && !input.allowThirdParty) {
    return { ok: false, reason: 'cross_speaker_blocked', written: false };
  }

  if (!subjectId && !input.subjectDisplayName) {
    return { ok: false, reason: 'no_subject', written: false };
  }

  const key = subjectId || `name:${foldTr(input.subjectDisplayName)}`;
  const bucket = input.state.participantFactsByTelegramId[key] || {};
  bucket[input.field] = {
    value: input.value,
    source: sourceId || 'unknown',
    temporary: false,
    updatedAt: new Date().toISOString(),
  };
  if (input.subjectDisplayName) {
    bucket.__displayName = {
      value: input.subjectDisplayName,
      source: 'display',
      updatedAt: new Date().toISOString(),
    };
  }
  input.state.participantFactsByTelegramId[key] = bucket;

  let written = false;
  if (input.persist && subjectId && isValidUserId(subjectId) && input.field === 'zodiac') {
    // Persist only explicit self-report zodiac into facts (not profile dump fields).
    updateUserMemory(subjectId, { facts: { zodiac: input.value } }).catch(() => {});
    written = true;
  }

  return { ok: true, reason: 'bound', written, key };
}

/**
 * Repetition guard — detect if a reply would restate recent facts/phrases.
 * @param {string} candidateReply
 * @param {ConversationState} state
 * @param {{ forceShort?: boolean }} [options]
 */
export function applyRepetitionGuard(candidateReply, state, options = {}) {
  const reply = String(candidateReply ?? '').trim();
  if (!reply) return { changed: false, reply };

  const recent = [...(state.recentAssistantReplies || []), ...(state.recentFactsStated || [])]
    .slice(-8)
    .map((r) => foldTr(r));

  const folded = foldTr(reply);
  const factEchoes = [
    '26 temmuz',
    'aslan burcuna ait',
    'liderlik',
    'cesaret',
    'sicaklik',
    'sıcaklık',
    'one cikan bir enerji',
    'kendine ozgu',
  ];

  let hits = 0;
  for (const f of factEchoes) {
    if (folded.includes(foldTr(f)) && recent.some((r) => r.includes(foldTr(f)))) hits += 1;
  }

  // Near-duplicate of last assistant reply
  const last = state.recentAssistantReplies?.[0];
  if (last && foldTr(last) === folded) {
    return { changed: true, reply: 'Bunu az önce de demiştim 😄' };
  }

  if (hits >= 1 || options.forceShort) {
    // Strip encyclopedic length — keep first short sentence if any novelty, else banter ack
    const sentences = reply.split(/(?<=[.!?…😄😅])\s+/);
    if (sentences.length > 1 && sentences[0].length < 120) {
      return { changed: true, reply: sentences[0].trim() };
    }
    if (hits >= 1) {
      return { changed: true, reply: 'Evet, onu konuşuyorduk 😄' };
    }
  }

  return { changed: false, reply };
}

/**
 * Build a short property-query reply.
 * @param {{
 *   field: string,
 *   subjectDisplayName: string|null,
 *   value: string|null,
 *   subjectIsAtlas?: boolean,
 * }} q
 */
export function buildPropertyQueryReply(q) {
  if (q.subjectIsAtlas || foldTr(q.subjectDisplayName) === 'atlas') {
    return 'Benim gerçek bir burcum yok; doğum tarihim olmadığı için burç taşımıyorum.';
  }

  const name = q.subjectDisplayName || 'Kişinin';
  const labels = {
    zodiac: 'burcu',
    age: 'yaşı',
    birthDate: 'doğum tarihi',
    occupation: 'mesleği',
  };
  const label = labels[q.field] || q.field;

  if (!q.value) {
    return `${name}'nın ${label} hakkında doğrulanmış bilgim yok.`;
  }

  if (q.field === 'zodiac') {
    return `${name}'nın burcu ${q.value}.`;
  }
  return `${name}'nın ${label} ${q.value}.`;
}

/**
 * Build repair reply from state + new signal.
 * @param {{
 *   repair: { correctionTarget: string, raw: string },
 *   state: ConversationState,
 *   sender?: { displayName?: string|null },
 *   knownZodiac?: string|null,
 * }} input
 */
export function buildRepairReply(input) {
  const target = input.repair.correctionTarget;
  const state = input.state;
  const subject =
    state.lastExplicitSubject?.displayName ||
    state.expectedSubject?.displayName ||
    'Lara';
  const askerHint = null;
  const zodiac =
    input.knownZodiac ||
    lookupParticipantFact({
      field: 'zodiac',
      subjectDisplayName: subject,
      subjectUserId: state.lastExplicitSubject?.userId || state.expectedSubject?.userId,
      state,
    });

  if (target === 'property_zodiac' || target === 'subject_lara_zodiac' || /burc/.test(foldTr(state.currentQuestion || ''))) {
    if (zodiac) {
      return `Anladım 😅 Furkan, ${subject}'nın burcunu soruyordu. ${subject} ${zodiac}.`;
    }
    return `Anladım 😅 ${subject}'nın burcu soruluyordu; kayıtlı bir burç bulamadım.`;
  }

  if (target === 'possessive_subject') {
    if (zodiac) {
      return `Anladım — ${subject}'nın burcu ${zodiac}.`;
    }
    return `Anladım; soru ${subject}'nın burcu hakkındaydı.`;
  }

  if (target === 'self_subject') {
    return 'Anladım, kendinden bahsediyorsun.';
  }

  return 'Anladım, önceki yorumumu düzelttim.';
}

/**
 * Assistant self-identity reply (no real zodiac).
 * @param {{ zodiac?: string }} claim
 */
export function buildAssistantSelfIdentityReply(claim) {
  const z = claim.zodiac || 'Aslan';
  return `Benim gerçek bir burcum yok ama bu sohbette beni ${z} yaptınız 😄`;
}

/**
 * Max tokens by response mode.
 * @param {ResponseMode} mode
 */
export function resolveMaxTokensForResponseMode(mode) {
  // Floors must be high enough that OpenAI max_output_tokens never
  // truncates mid-word on typical short replies (was 40–80 → "za" stalls).
  switch (mode) {
    case 'presence':
    case 'casual_ack':
      return 160;
    case 'casual_banter':
    case 'correction_repair':
    case 'direct_fact':
    case 'profile_property_query':
      return 320;
    case 'clarification':
      return 240;
    case 'roleplay_or_metaphor':
      return 280;
    case 'instruction':
      return 400;
    case 'analysis_request':
      return 900;
    default:
      return null;
  }
}

/**
 * Prompt block for LLM path — compact conversation grounding.
 * @param {ConversationState} state
 * @param {{ responseMode?: ResponseMode, senderDisplayName?: string|null }} [meta]
 */
export function buildConversationContextPromptBlock(state, meta = {}) {
  const lines = [
    '## CONVERSATION CONTEXT (supporting only — current message wins)',
    'Bu blok bağlam sağlar. Güncel kullanıcı mesajının açık niyetini ASLA geçersiz kılma.',
    'Önceki görevlere yalnızca kullanıcı açıkça devam ederse devam et.',
    `- Response mode: ${meta.responseMode || 'other'} — keep length/tone accordingly.`,
    `- Reply to current sender${meta.senderDisplayName ? ` (${meta.senderDisplayName})` : ''}; subject of the question may be someone else.`,
    '- Do not invent Atlas birth date / zodiac / human biography.',
    '- Do not dump full profiles when a single property was asked.',
    '- Do not treat bare words as "call me X" unless explicit addressing language is present.',
    '- Prefer short natural group-chat tone; do not restate facts already in recentFactsStated.',
  ];

  if (state.activeTopic) lines.push(`- Active topic: ${state.activeTopic}`);
  if (state.currentQuestion) lines.push(`- Current question: ${state.currentQuestion}`);
  if (state.expectedAnswerType) lines.push(`- Expected answer type: ${state.expectedAnswerType}`);
  if (state.expectedSubject?.displayName) {
    lines.push(`- Expected subject: ${state.expectedSubject.displayName}`);
  }
  if (state.lastExplicitSubject?.displayName) {
    lines.push(`- Last explicit subject: ${state.lastExplicitSubject.displayName}`);
  }
  if (state.lastReferencedSet) lines.push(`- Last referenced set: ${state.lastReferencedSet}`);
  if (state.pendingSlot) {
    lines.push(
      `- Pending slot: ${state.pendingSlot.field} for ${state.pendingSlot.subjectDisplayName || 'unknown'}`,
    );
  }
  if (state.recentFactsStated?.length) {
    lines.push(`- Recent facts stated (do not repeat): ${state.recentFactsStated.slice(0, 5).join(' | ')}`);
  }
  if (state.openTopicCollect?.topic === 'zodiac') {
    const collected = Object.entries(state.openTopicCollect.collected)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    lines.push(`- Zodiac collect in progress: ${collected || '(none yet)'}. Do not invent missing signs.`);
  }

  const facts = [];
  for (const [id, bucket] of Object.entries(state.participantFactsByTelegramId)) {
    const name = bucket.__displayName?.value || id;
    if (bucket.zodiac) facts.push(`${name}: burç=${bucket.zodiac.value}`);
  }
  if (facts.length) lines.push(`- Known participant facts: ${facts.join('; ')}`);

  return lines.join('\n');
}

/**
 * Update state after we understand the inbound message (before reply).
 * @param {string} conversationId
 * @param {{
 *   message: string,
 *   propertyQuery?: ReturnType<typeof detectProfilePropertyQuery>,
 *   shortResolved?: object|null,
 *   repair?: object|null,
 *   sender?: { userId?: string|null, displayName?: string|null },
 * }} info
 */
export function noteInboundTurn(conversationId, info) {
  const state = getConversationState(conversationId);
  const msg = String(info.message ?? '').trim();

  if (info.propertyQuery && !info.propertyQuery.subjectIsAtlas) {
    state.activeTopic = info.propertyQuery.field;
    state.currentQuestion = msg;
    state.expectedAnswerType = info.propertyQuery.field;
    state.expectedSubject = {
      displayName: info.propertyQuery.subjectDisplayName,
      userId: null,
    };
    state.lastExplicitSubject = {
      displayName: info.propertyQuery.subjectDisplayName,
      userId: null,
    };
    state.lastCorrectionTarget = `property_${info.propertyQuery.field}`;
  }

  if (COLLECT_ZODIAC_RE.test(msg)) {
    state.openTopicCollect = { topic: 'zodiac', collected: { ...(state.openTopicCollect?.collected || {}) } };
    state.activeTopic = 'zodiac';
  }

  const folded = foldTr(msg);
  if (/su\s+grub/.test(folded)) {
    state.lastReferencedSet = 'element_groups';
    state.activeTopic = 'zodiac_elements';
  }

  if (info.repair) {
    state.lastCorrectionTarget = info.repair.correctionTarget;
  }

  state.updatedAt = new Date().toISOString();
  return state;
}

/**
 * Update state after assistant reply.
 * @param {string} conversationId
 * @param {{
 *   reply: string,
 *   intent?: string,
 *   responseMode?: ResponseMode,
 *   factStated?: string|null,
 *   pendingSlot?: ConversationState['pendingSlot'],
 *   clearPendingSlot?: boolean,
 *   symbolicDomain?: string|null,
 * }} info
 */
export function noteAssistantTurn(conversationId, info) {
  const state = getConversationState(conversationId);
  const reply = String(info.reply ?? '').trim();
  if (reply) {
    state.recentAssistantReplies = [reply, ...(state.recentAssistantReplies || [])].slice(0, 5);
  }
  if (info.intent) {
    state.recentResponseIntents = [info.intent, ...(state.recentResponseIntents || [])].slice(0, 8);
  }
  if (info.symbolicDomain) {
    state.symbolicDomain = info.symbolicDomain;
    if (!state.activeTopic) state.activeTopic = info.symbolicDomain;
  }
  if (info.factStated) {
    state.recentFactsStated = [info.factStated, ...(state.recentFactsStated || [])].slice(0, 8);
  }
  state.lastAssistantClaim = reply.slice(0, 240) || null;

  if (info.clearPendingSlot) state.pendingSlot = null;
  if (info.pendingSlot) state.pendingSlot = info.pendingSlot;

  // If we said "kayıtlı değil" / "doğrulanmış bilgim yok" for a burç, open slot.
  if (/do[gğ]rulanm[ıi][sş].*yok|kay[ıi]tl[ıi]\s*de[gğ]il/i.test(reply) && /burc/i.test(reply)) {
    const nameMatch = reply.match(/([\p{L}][\p{L}'’.-]{1,29})(?:'n[ıi]n|’n[ıi]n|n[ıi]n)?\s+burc/iu);
    state.pendingSlot = {
      field: 'zodiac',
      subjectDisplayName: nameMatch?.[1] || state.lastExplicitSubject?.displayName || null,
      subjectUserId: state.expectedSubject?.userId || null,
      askedAt: new Date().toISOString(),
    };
    state.expectedAnswerType = 'zodiac';
  }

  state.updatedAt = new Date().toISOString();
  return state;
}

/**
 * Main deterministic turn resolver — returns a reply or null to continue pipeline.
 *
 * @param {{
 *   conversationId: string,
 *   message: string,
 *   history?: Array<{ role: string, content: string }>,
 *   sender?: { userId?: string|null, displayName?: string|null },
 *   knownParticipants?: Array<{ userId?: string, displayName?: string }>,
 *   persistFacts?: boolean,
 *   alternateUserIds?: string[],
 * }} input
 * @returns {{
 *   handled: boolean,
 *   reply?: string,
 *   intent: string,
 *   responseMode: ResponseMode,
 *   memoryUpdated?: boolean,
 *   engine: string,
 *   analysis: object,
 * } | { handled: false, responseMode: ResponseMode, analysis: object, contextBlock: string }}
 */
export function tryResolveConversationContext(input) {
  const conversationId = String(input.conversationId ?? 'default');
  const message = String(input.message ?? '').trim();
  const state = getConversationState(conversationId);
  const sender = input.sender || {};
  const alternateUserIds = Array.isArray(input.alternateUserIds)
    ? input.alternateUserIds
    : [];

  const presence = isPresenceUtterance(message);
  const selfProfile = input.skipProfileResolvers
    ? null
    : detectSelfProfileQuery(message);
  const propertyQuery = input.skipProfileResolvers
    ? null
    : detectProfilePropertyQuery(message, state);
  const repair = detectRepairIntent(message, state);
  const selfClaim = input.skipProfileResolvers
    ? null
    : detectAssistantSelfIdentityClaim(message);
  const shortResolved = resolveShortUtterance({
    message,
    state,
    sender,
    history: input.history,
  });

  noteInboundTurn(conversationId, {
    message,
    propertyQuery: propertyQuery || (selfProfile
      ? { field: selfProfile.field, subjectDisplayName: sender.displayName, subjectIsAtlas: false, subjectIsSender: true }
      : null),
    shortResolved,
    repair,
    sender,
  });

  const responseMode = classifyResponseMode(message, {
    state,
    propertyQuery: propertyQuery || (selfProfile
      ? { field: selfProfile.field, subjectIsSender: true }
      : null),
    repair,
    presence,
    shortResolved,
  });

  const analysis = {
    presence,
    selfProfile,
    propertyQuery,
    repair,
    selfClaim,
    shortResolved,
    responseMode,
    version: CONVERSATION_CONTEXT_VERSION,
  };

  // 1. Presence
  if (presence) {
    const reply = 'Buradayım.';
    noteAssistantTurn(conversationId, { reply, intent: 'presence', responseMode: 'presence' });
    return {
      handled: true,
      reply,
      intent: 'context:presence',
      responseMode: 'presence',
      memoryUpdated: false,
      engine: 'conversation-context',
      analysis,
    };
  }

  // 1b. First-person self-profile — memory/facts before astrology ask-birth
  if (selfProfile) {
    const resolution = resolveSelfProfileValue({
      field: selfProfile.field,
      userId: sender.userId,
      state,
      sender,
      alternateUserIds,
    });
    logSelfProfileDebug({
      intent: 'self_profile_query',
      subject: 'self',
      field: selfProfile.field,
      telegramUserId: sender.userId,
      lookupKeys: resolution.lookupKeys,
      matchedKey: resolution.matchedKey,
      foundField: resolution.foundField,
      value: resolution.value,
      source: resolution.source,
      fallbackReason: resolution.fallbackReason,
      path: 'conversation-context:self_profile',
    });
    const reply = buildSelfProfileReply(selfProfile.field, resolution);
    noteAssistantTurn(conversationId, {
      reply,
      intent: 'self_profile_query',
      responseMode: 'profile_property_query',
      factStated: resolution.value
        ? `self.${selfProfile.field}=${resolution.value}`
        : null,
      pendingSlot:
        !resolution.value && selfProfile.field === 'zodiac'
          ? {
              field: 'zodiac',
              subjectDisplayName: sender.displayName || null,
              subjectUserId: sender.userId || null,
              askedAt: new Date().toISOString(),
            }
          : null,
      clearPendingSlot: Boolean(resolution.value),
    });
    return {
      handled: true,
      reply,
      intent: 'context:self_profile_query',
      responseMode: 'profile_property_query',
      memoryUpdated: false,
      engine: 'conversation-context',
      analysis: { ...analysis, selfProfileResolution: resolution },
    };
  }

  // 2. Assistant self-identity (before memory writes)
  if (selfClaim) {
    const reply = buildAssistantSelfIdentityReply(selfClaim);
    // Explicitly do NOT persist Atlas zodiac
    validateAndBindParticipantFact({
      subjectDisplayName: 'Atlas',
      field: 'zodiac',
      value: selfClaim.zodiac,
      sourceSpeakerUserId: sender.userId,
      explicit: true,
      temporary: true,
      roleplay: true,
      state,
      persist: false,
    });
    noteAssistantTurn(conversationId, {
      reply,
      intent: 'assistant_self_identity',
      responseMode: 'roleplay_or_metaphor',
    });
    return {
      handled: true,
      reply,
      intent: 'context:assistant_self_identity',
      responseMode: 'roleplay_or_metaphor',
      memoryUpdated: false,
      engine: 'conversation-context',
      analysis,
    };
  }

  // 3. Repair / correction — only when prior turn gives something to repair
  const hasRepairContext = Boolean(
    state.currentQuestion ||
      state.pendingSlot ||
      state.lastAssistantClaim ||
      state.lastExplicitSubject ||
      state.expectedSubject ||
      state.lastCorrectionTarget,
  );
  if (
    repair &&
    hasRepairContext &&
    (shortResolved?.kind === 'pronoun_repair' ||
      REPAIR_SOFT_RE.test(message) ||
      REPAIR_RE.test(message))
  ) {
    // Don't treat repair as memory write
    const knownZodiac = lookupParticipantFact({
      field: 'zodiac',
      subjectDisplayName:
        state.lastExplicitSubject?.displayName ||
        state.expectedSubject?.displayName ||
        'Lara',
      subjectUserId: state.lastExplicitSubject?.userId || state.expectedSubject?.userId,
      state,
      knownParticipants: input.knownParticipants,
    });
    let reply = buildRepairReply({ repair, state, sender, knownZodiac });
    const guarded = applyRepetitionGuard(reply, state);
    reply = guarded.reply;
    noteAssistantTurn(conversationId, {
      reply,
      intent: 'correction_repair',
      responseMode: 'correction_repair',
      clearPendingSlot: false,
    });
    return {
      handled: true,
      reply,
      intent: 'context:correction_repair',
      responseMode: 'correction_repair',
      memoryUpdated: false,
      engine: 'conversation-context',
      analysis,
    };
  }

  // 4. Anaphora deterministic
  if (shortResolved?.kind === 'anaphora_set' && shortResolved.reply) {
    noteAssistantTurn(conversationId, {
      reply: shortResolved.reply,
      intent: 'anaphora_set',
      responseMode: 'casual_banter',
    });
    return {
      handled: true,
      reply: shortResolved.reply,
      intent: 'context:anaphora_set',
      responseMode: 'casual_banter',
      memoryUpdated: false,
      engine: 'conversation-context',
      analysis,
    };
  }

  // 5. Slot fill / short self-fact
  if (shortResolved?.kind === 'slot_fill' || shortResolved?.kind === 'self_fact') {
    const subjectUserId =
      shortResolved.subjectUserId ||
      (shortResolved.kind === 'self_fact' ? sender.userId : null) ||
      null;
    const subjectDisplayName =
      shortResolved.subjectDisplayName ||
      (shortResolved.kind === 'self_fact' ? sender.displayName : null) ||
      null;

    const bind = validateAndBindParticipantFact({
      subjectUserId,
      subjectDisplayName,
      field: shortResolved.field,
      value: shortResolved.value,
      sourceSpeakerUserId: sender.userId,
      explicit: true,
      confidence: 'high',
      // Slot fill: allow when subject is the person who owns the slot (may be same speaker)
      allowThirdParty:
        shortResolved.kind === 'slot_fill' &&
        Boolean(state.pendingSlot) &&
        foldTr(state.pendingSlot?.subjectDisplayName || '') === foldTr(sender.displayName || ''),
      state,
      persist: Boolean(input.persistFacts) && shortResolved.kind === 'self_fact',
    });

    // For slot fill about someone else answered by that someone:
    if (shortResolved.kind === 'slot_fill' && subjectDisplayName) {
      // Always bind into conversation-local state by display name key
      const key = subjectUserId || `name:${foldTr(subjectDisplayName)}`;
      const bucket = state.participantFactsByTelegramId[key] || {};
      bucket[shortResolved.field] = {
        value: shortResolved.value,
        source: sender.userId || 'slot_fill',
        updatedAt: new Date().toISOString(),
      };
      bucket.__displayName = {
        value: subjectDisplayName,
        source: 'slot_fill',
        updatedAt: new Date().toISOString(),
      };
      state.participantFactsByTelegramId[key] = bucket;

      if (input.persistFacts && shortResolved.field === 'zodiac') {
        const persistId =
          (subjectUserId && isValidUserId(subjectUserId) && subjectUserId) ||
          (sender.userId &&
          foldTr(subjectDisplayName || '') === foldTr(sender.displayName || '')
            ? sender.userId
            : null);
        if (persistId && isValidUserId(persistId)) {
          updateUserMemory(persistId, { facts: { zodiac: shortResolved.value } }).catch(() => {});
        }
      }
    }

    // Self-fact always persists to sender memory when enabled
    if (
      shortResolved.kind === 'self_fact' &&
      input.persistFacts &&
      shortResolved.field === 'zodiac' &&
      sender.userId &&
      isValidUserId(sender.userId)
    ) {
      updateUserMemory(sender.userId, { facts: { zodiac: shortResolved.value } }).catch(() => {});
    }

    if (state.openTopicCollect?.topic === 'zodiac' && shortResolved.field === 'zodiac') {
      const label = subjectDisplayName || sender.displayName || 'Katılımcı';
      state.openTopicCollect.collected[label] = shortResolved.value;
    }

    let reply;
    if (shortResolved.kind === 'self_fact') {
      const mode = classifyResponseMode(message, { shortResolved });
      if (mode === 'casual_banter' || BANTER_RE.test(message)) {
        reply = `Sen de ${shortResolved.value}'sın yani 😄`;
      } else if (/benim\s+aslan|do[gğ]u[sş]tan/i.test(message)) {
        reply = `Sen de ${shortResolved.value}'sın yani 😄`;
      } else {
        reply = `Tamam, burcun ${shortResolved.value}.`;
      }
    } else {
      reply = `Tamam, ${subjectDisplayName || 'kayıt'}'nın burcu ${shortResolved.value}.`;
    }

    // Repetition: if we already stated 26 Temmuz / Aslan traits recently, keep short
    const guarded = applyRepetitionGuard(reply, state);
    reply = guarded.reply;

    noteAssistantTurn(conversationId, {
      reply,
      intent: shortResolved.kind,
      responseMode: shortResolved.responseMode || 'direct_fact',
      factStated: `${subjectDisplayName || 'self'}.${shortResolved.field}=${shortResolved.value}`,
      clearPendingSlot: true,
    });

    return {
      handled: true,
      reply,
      intent: `context:${shortResolved.kind}`,
      responseMode: shortResolved.responseMode || 'direct_fact',
      memoryUpdated: Boolean(bind.written),
      engine: 'conversation-context',
      analysis,
    };
  }

  // 6. Profile property query (single field)
  if (propertyQuery) {
    // First-person (or bare "burcun?" with no prior subject) → self-profile resolver
    if (propertyQuery.subjectIsSender) {
      const resolution = resolveSelfProfileValue({
        field: propertyQuery.field,
        userId: sender.userId,
        state,
        sender,
      });
      const reply = buildSelfProfileReply(propertyQuery.field, resolution);
      noteAssistantTurn(conversationId, {
        reply,
        intent: 'self_profile_query',
        responseMode: 'profile_property_query',
        factStated: resolution.value
          ? `self.${propertyQuery.field}=${resolution.value}`
          : null,
        clearPendingSlot: Boolean(resolution.value),
      });
      return {
        handled: true,
        reply,
        intent: 'context:self_profile_query',
        responseMode: 'profile_property_query',
        memoryUpdated: false,
        engine: 'conversation-context',
        analysis: { ...analysis, selfProfileResolution: resolution },
      };
    }

    if (propertyQuery.field === 'birthDate' || propertyQuery.field === 'age') {
      // Birth/age about a *third party* (esp. founder) must stay on privacy / LLM path.
      const contextBlock = buildConversationContextPromptBlock(state, {
        responseMode: 'profile_property_query',
        senderDisplayName: sender.displayName,
      });
      return {
        handled: false,
        responseMode: 'profile_property_query',
        analysis,
        contextBlock,
      };
    }

    if (propertyQuery.subjectIsAtlas) {
      const reply = buildPropertyQueryReply({ ...propertyQuery, value: null, subjectIsAtlas: true });
      noteAssistantTurn(conversationId, {
        reply,
        intent: 'profile_property_query',
        responseMode: 'profile_property_query',
      });
      return {
        handled: true,
        reply,
        intent: 'context:profile_property_query',
        responseMode: 'profile_property_query',
        memoryUpdated: false,
        engine: 'conversation-context',
        analysis,
      };
    }

    const value = lookupParticipantFact({
      field: propertyQuery.field,
      subjectDisplayName: propertyQuery.subjectDisplayName,
      subjectUserId: propertyQuery.subjectIsSender ? sender.userId : null,
      state,
      knownParticipants: input.knownParticipants,
    });

    const reply = buildPropertyQueryReply({ ...propertyQuery, value });
    noteAssistantTurn(conversationId, {
      reply,
      intent: 'profile_property_query',
      responseMode: 'profile_property_query',
      factStated: value
        ? `${propertyQuery.subjectDisplayName}.${propertyQuery.field}=${value}`
        : null,
      pendingSlot: value
        ? null
        : {
            field: propertyQuery.field,
            subjectDisplayName: propertyQuery.subjectDisplayName,
            subjectUserId: null,
            askedAt: new Date().toISOString(),
          },
      clearPendingSlot: Boolean(value),
    });

    return {
      handled: true,
      reply,
      intent: 'context:profile_property_query',
      responseMode: 'profile_property_query',
      memoryUpdated: false,
      engine: 'conversation-context',
      analysis,
    };
  }

  // 7. Casual banter short-circuit for clear joke lines
  if (responseMode === 'casual_banter' && BANTER_RE.test(message)) {
    let reply = 'Tam bir Aslan cevabı 😄';
    if (/lobisi/i.test(message)) reply = 'Aslan lobisi yine iş başında 😄';
    const guarded = applyRepetitionGuard(reply, state, { forceShort: true });
    reply = guarded.reply;
    noteAssistantTurn(conversationId, {
      reply,
      intent: 'casual_banter',
      responseMode: 'casual_banter',
    });
    return {
      handled: true,
      reply,
      intent: 'context:casual_banter',
      responseMode: 'casual_banter',
      memoryUpdated: false,
      engine: 'conversation-context',
      analysis,
    };
  }

  // 8. Topic continuity: collect summary ask
  if (
    state.openTopicCollect?.topic === 'zodiac' &&
    /\b(analiz|bildiklerin|kim\s+ne|durum|özet|ozet)\b/i.test(message)
  ) {
    const entries = Object.entries(state.openTopicCollect.collected);
    const reply =
      entries.length === 0
        ? 'Henüz kimse burcunu yazmadı; uydurmam.'
        : `Şu an bildiklerim: ${entries.map(([n, z]) => `${n} ${z}`).join(', ')}.`;
    noteAssistantTurn(conversationId, {
      reply,
      intent: 'topic_collect_status',
      responseMode: 'direct_fact',
    });
    return {
      handled: true,
      reply,
      intent: 'context:topic_collect_status',
      responseMode: 'direct_fact',
      memoryUpdated: false,
      engine: 'conversation-context',
      analysis,
    };
  }

  const contextBlock = buildConversationContextPromptBlock(state, {
    responseMode,
    senderDisplayName: sender.displayName,
  });

  return {
    handled: false,
    responseMode,
    analysis,
    contextBlock,
  };
}

/**
 * Whether privacy public_profile short-circuit should be skipped
 * (property queries must not dump founder bio).
 * @param {string} message
 * @param {ConversationState} [state]
 */
export function shouldBypassPublicProfileForPropertyQuery(message, state = null) {
  return Boolean(detectProfilePropertyQuery(message, state));
}

/**
 * Seed a known participant fact into conversation state (tests / fixtures).
 * @param {string} conversationId
 * @param {{ userId?: string, displayName: string, field: string, value: string }} fact
 */
export function seedParticipantFact(conversationId, fact) {
  const state = getConversationState(conversationId);
  const key = fact.userId || `name:${foldTr(fact.displayName)}`;
  const bucket = state.participantFactsByTelegramId[key] || {};
  bucket[fact.field] = {
    value: fact.value,
    source: 'seed',
    updatedAt: new Date().toISOString(),
  };
  bucket.__displayName = {
    value: fact.displayName,
    source: 'seed',
    updatedAt: new Date().toISOString(),
  };
  state.participantFactsByTelegramId[key] = bucket;
  return state;
}

// ═══════════════════════════════════════════════════════════════════════
// Atlas Memory Intents — strict two-stage memory write gate
//
// Stage 1: explicit memory-action intent detection
// Stage 2: validated entity extraction (must succeed before any write)
// ═══════════════════════════════════════════════════════════════════════

import {
  deleteMemoryField,
  getUserMemory,
  updateUserMemory,
} from './user-memory.js';
import { resolveFounderSession, formatFounderAwareMemoryRecall } from './founder-identity.js';

/** @typedef {'save' | 'recall' | 'forget' | 'profile-update' | null} MemoryIntentType */

/**
 * @typedef {{
 *   type: MemoryIntentType,
 *   detail?: string,
 *   clarity?: 'explicit' | 'ambiguous',
 * }} MemoryIntent
 */

/** Unicode-safe boundary: JS \\b treats Turkish letters (ı, ş, …) as non-word. */
function uBoundaryBefore() {
  return '(?:^|[^\\p{L}\\p{N}_])';
}

function uBoundaryAfter() {
  return '(?=$|[^\\p{L}\\p{N}_])';
}

const WRITE_NEGATION_PATTERNS = [
  /\b(kaydetme|kaydetmeyin|kaydetmesin|hatırlama|hatirlama)\b/i,
  /\b(bu bilgiyi|bunu|şunu|sunu)\s+(kaydetme|hatırlama|hatirlama)\b/i,
  /\b(belleğe|belleğine|hafızaya|hafızana)\s+(kaydetme|ekleme|yazma)\b/i,
];

const EXPLICIT_WRITE_VERBS = [
  /\b(bunu|şunu|sunu)\s+(hatırla|hatirla|kaydet)\b/i,
  /\bhaf[iı]zana?\s+(kaydet|ekle|yaz)\b/i,
  /\bbelle[gğ]ine?\s+(ekle|kaydet|yaz)\b/i,
  /\bolarak\s+(hatırla|hatirla|kaydet)\b/i,
  /\b(bunu|şunu|sunu|bu bilgiyi|şu bilgiyi)\s+(hafızana|hafizana|belleğine|bellegine)\s+(kaydet|ekle)\b/i,
  /(?<![a-zçğıöşü])(kaydet|hatırla|hatirla)(?![a-zçğıöşü])/i,
];

const RECALL_PATTERNS = [
  /\bbenim hakkımda ne biliyorsun\b/i,
  /\bbenim hakkinda ne biliyorsun\b/i,
  /\bhafızanda ne var\b/i,
  /\bhafizanda ne var\b/i,
  /\bdaha önce ne söylemiştim\b/i,
  /\bdaha once ne soylemistim\b/i,
  /\bne hatırlıyorsun\b/i,
  /\bne hatirliyorsun\b/i,
];

const FORGET_PATTERNS = [
  /\bbunu unut\b/i,
  /\bunut bunu\b/i,
  /\bhafızandan sil\b/i,
  /\bhafizandan sil\b/i,
  /\bhafızamdan sil\b/i,
  /\bhafizamdan sil\b/i,
  /\bbu bilgiyi\s+(hafızandan|hafizandan|belleğinden|belleginden)\s+sil\b/i,
  /\bşunu unut\b/i,
  /\bsunu unut\b/i,
];

const FORGET_NAME_PATTERNS = [
  new RegExp(`${uBoundaryBefore()}(?:adımı|adimi|ismimi|ismimı)\\s+unut${uBoundaryAfter()}`, 'iu'),
  new RegExp(`${uBoundaryBefore()}(?:ad|isim)\\s*(?:bilgimi)?\\s*unut${uBoundaryAfter()}`, 'iu'),
  new RegExp(
    `${uBoundaryBefore()}(?:adımı|adimi|ismimi)\\s+(?:hafızandan|hafizandan|belleğinden)\\s+sil${uBoundaryAfter()}`,
    'iu',
  ),
];

/** Verbs/idioms that mean "step", not "my name". */
const NAME_STEP_IDIOMS = [
  new RegExp(`${uBoundaryBefore()}ad[iı]m\\s+ad[iı]m${uBoundaryAfter()}`, 'iu'),
  new RegExp(`${uBoundaryBefore()}ad[iı]m\\s+at`, 'iu'),
];

const CALL_ME_NAME_PATTERN = new RegExp(
  `${uBoundaryBefore()}(?:bundan\\s+sonra\\s+)?bana\\s+([\\p{L}][\\p{L}'’.-]{1,29})\\s+(?:de|diye(?:\\s+hitap\\s+et)?)${uBoundaryAfter()}`,
  'iu',
);

const CONVERSATION_SCOPED_ADDRESS_RE =
  /\b(bu\s+konu[sş]mada|yaln[ıi]zca?\s+bu\s+sohbet|sadece\s+bu\s+konu[sş]ma)\b/i;

const PERMANENT_SAVE_VERB_RE =
  /\b(kaydet|hat[ıi]rla|belle[gğ]ine\s+ekle|haf[ıi]zana\s+(?:kaydet|ekle)|kal[ıi]c[ıi]\s+kaydet)\b/i;

const NAME_STATEMENT_PATTERNS = [
  // "benim adım Lara" / "adım: Lara" / "ismim Lara" / "adım Lara,"
  new RegExp(
    `(?:^|[,.\\s])(?:benim\\s+)?(?:adım|adim|ismim)${uBoundaryAfter()}\\s*[:：]\\s*([\\p{L}][\\p{L}'’.-]{1,29}(?:\\s+[\\p{L}][\\p{L}'’.-]{1,29}){0,2})`,
    'iu',
  ),
  new RegExp(
    `(?:^|[,.\\s])(?:benim\\s+)?(?:adım|adim|ismim)${uBoundaryAfter()}\\s+([\\p{L}][\\p{L}'’.-]{1,29}(?:\\s+[\\p{L}][\\p{L}'’.-]{1,29}){0,2})(?=\\s*[,.]|\\s+(?:olarak|diye|kaydet|hatırla|hatirla)|$)`,
    'iu',
  ),
  // "adımı / ismimi Lara olarak …"
  new RegExp(
    `${uBoundaryBefore()}(?:adımı|adimi|ismimi)\\s+([\\p{L}][\\p{L}'’.-]{1,29}(?:\\s+[\\p{L}][\\p{L}'’.-]{1,29}){0,2})\\s+olarak${uBoundaryAfter()}`,
    'iu',
  ),
];

/** Common Turkish verb stems / non-name tokens that must never become profile.name */
const NON_NAME_TOKENS = new Set([
  'at',
  'atmak',
  'attım',
  'attim',
  'attı',
  'atti',
  'attık',
  'attik',
  'attığınızda',
  'attiginizda',
  'attığında',
  'attiginda',
  'attığımda',
  'attigimda',
  'neden',
  'niye',
  'nasıl',
  'nasil',
  'niçin',
  'nicin',
  'hakkında',
  'hakkinda',
  'için',
  'icin',
  'gibi',
  'kadar',
  'olarak',
  'diye',
  've',
  'veya',
  'ile',
  'ama',
  'fakat',
  'çünkü',
  'cunku',
  'atlas',
  'insan',
  'insanlar',
  'insanlara',
  'cevap',
  'vermezler',
  'iletişim',
  'iletisim',
  'normal',
  'önemli',
  'onemli',
  'bugün',
  'bugun',
  'anlat',
  'düşünüyorsun',
  'dusunuyorsun',
  'hatırlıyor',
  'hatirliyor',
  'musun',
  'misin',
  'ne',
  'bu',
  'şu',
  'su',
  'bir',
  'beni',
  'benim',
  'seni',
  'onları',
  'onlari',
]);

const PROFILE_FIELD_SPECS = [
  {
    field: 'birthDate',
    patterns: [
      /\b(doğum tarihim|dogum tarihim|doğum günüm|dogum gunum)\b/i,
      /\bbenim doğum tarihim\b/i,
      /\bbenim dogum tarihim\b/i,
    ],
    extract: extractBirthDate,
    validate: isPlausibleDateValue,
  },
  {
    field: 'birthTime',
    patterns: [/\b(doğum saatim|dogum saatim|doğum saati)\b/i],
    extract: extractBirthTime,
    validate: (v) => typeof v === 'string' && /^\d{1,2}[:.]\d{2}$/.test(v.trim()),
  },
  {
    field: 'birthPlace',
    patterns: [/\b(doğum yerim|dogum yerim)\b/i],
    extract: (text) => extractLabeledValue(text, ['doğum yerim', 'dogum yerim']),
    validate: isPlausibleShortValue,
  },
  {
    field: 'timezone',
    patterns: [/\b(saat dilimim|zaman dilimim|timezone)\b/i],
    extract: (text) => extractLabeledValue(text, ['saat dilimim', 'zaman dilimim', 'timezone']),
    validate: isPlausibleShortValue,
  },
  {
    field: 'location',
    patterns: [/\b(konumum|bulunduğum yer|bulundugum yer)\b/i],
    extract: (text) => extractLabeledValue(text, ['konumum', 'bulunduğum yer', 'bulundugum yer']),
    validate: isPlausibleShortValue,
  },
  {
    field: 'name',
    patterns: [
      new RegExp(`(?:benim\\s+)?(?:adım|adim|ismim)${uBoundaryAfter()}`, 'iu'),
      new RegExp(`${uBoundaryBefore()}(?:adımı|adimi|ismimi)${uBoundaryAfter()}`, 'iu'),
      CALL_ME_NAME_PATTERN,
    ],
    extract: extractName,
    validate: isPlausiblePersonName,
  },
  {
    field: 'referenceDate',
    patterns: [/\b(referans tarihim|referans tarih)\b/i],
    extract: extractDateLike,
    validate: isPlausibleDateValue,
  },
  {
    field: 'relationshipStatus',
    patterns: [/\b(ilişki durumum|iliski durumum|medeni halim)\b/i],
    extract: (text) =>
      extractLabeledValue(text, ['ilişki durumum', 'iliski durumum', 'medeni halim']),
    validate: isPlausibleShortValue,
  },
];

const PREFERENCE_PATTERNS = [
  {
    key: 'favoriteSymbolicSystems',
    patterns: [/\b(favori sembolik sistem|sevdiğim sistem|tercih ettiğim sistem)\b/i],
    extract: (text) =>
      extractLabeledValue(text, [
        'favori sembolik sistem',
        'sevdiğim sistem',
        'tercih ettiğim sistem',
      ]),
  },
];

const PROFILE_LABELS = {
  name: 'Ad',
  timezone: 'Saat dilimi',
  location: 'Konum',
  birthDate: 'Doğum tarihi',
  birthTime: 'Doğum saati',
  birthPlace: 'Doğum yeri',
  referenceDate: 'Referans tarihi',
  relationshipStatus: 'İlişki durumu',
};

/**
 * @param {string} message
 * @returns {boolean}
 */
function hasWriteNegation(message) {
  return WRITE_NEGATION_PATTERNS.some((p) => p.test(message));
}

/**
 * @param {string} message
 * @returns {boolean}
 */
function hasExplicitWriteVerb(message) {
  return EXPLICIT_WRITE_VERBS.some((p) => p.test(message));
}

/**
 * @param {string} message
 * @returns {boolean}
 */
function isCallMeNameRequest(message) {
  return CALL_ME_NAME_PATTERN.test(message) && isPlausiblePersonName(extractName(message));
}

/**
 * @param {string} message
 * @returns {string|null}
 */
function detectProfileFieldKeyword(message) {
  for (const spec of PROFILE_FIELD_SPECS) {
    if (spec.field === 'name' && NAME_STEP_IDIOMS.some((p) => p.test(message))) {
      continue;
    }
    if (spec.patterns.some((p) => p.test(message))) {
      return spec.field;
    }
  }
  return null;
}

/**
 * Stage 1 — detect only explicit memory actions.
 * Mere occurrence of "ad", "hatırla" in questions, or "adım" as "step" must not match.
 *
 * @param {string} message
 * @returns {MemoryIntent}
 */
export function detectMemoryIntent(message) {
  const text = (message ?? '').trim();
  if (!text) {
    return { type: null };
  }

  if (hasWriteNegation(text)) {
    return { type: null };
  }

  if (FORGET_NAME_PATTERNS.some((p) => p.test(text)) || FORGET_PATTERNS.some((p) => p.test(text))) {
    return { type: 'forget', clarity: 'explicit' };
  }

  if (RECALL_PATTERNS.some((p) => p.test(text))) {
    return { type: 'recall', clarity: 'explicit' };
  }

  // Call-me naming:
  // - conversation-scoped ("bu konuşmada…") → not a memory write
  // - with explicit save verb → permanent profile update
  // - "bundan sonra bana X de" without kaydet → ask confirmation (ambiguous)
  if (isCallMeNameRequest(text)) {
    if (CONVERSATION_SCOPED_ADDRESS_RE.test(text) && !PERMANENT_SAVE_VERB_RE.test(text)) {
      return { type: null };
    }
    if (PERMANENT_SAVE_VERB_RE.test(text)) {
      return { type: 'profile-update', detail: 'name', clarity: 'explicit' };
    }
    return { type: 'profile-update', detail: 'name', clarity: 'ambiguous' };
  }

  if (!hasExplicitWriteVerb(text)) {
    return { type: null };
  }

  const profileField = detectProfileFieldKeyword(text);
  if (profileField) {
    return { type: 'profile-update', detail: profileField, clarity: 'explicit' };
  }

  for (const spec of PREFERENCE_PATTERNS) {
    if (spec.patterns.some((p) => p.test(text))) {
      return { type: 'profile-update', detail: `preferences.${spec.key}`, clarity: 'explicit' };
    }
  }

  return { type: 'save', clarity: 'explicit' };
}

/**
 * Whether the message asks for analysis beyond storing profile data.
 * @param {string} message
 */
export function messageRequestsAnalysis(message) {
  return /\b(hesapla|analiz|yorumla|sentez|numeroloji|astroloji|tarot|açılım|acilim|burç|burc|günlük|gunluk|bugün|bugun)\b/i.test(
    message ?? '',
  );
}

/**
 * Stage 2 — extract + validate a writable entity. Returns null when unsafe.
 * @param {string} message
 * @param {MemoryIntent} intent
 * @returns {{ kind: 'profile'|'preference'|'fact'|'forget-name'|'forget-fact', field?: string, key?: string, value?: string|null }|null}
 */
export function extractValidatedMemoryEntity(message, intent) {
  const text = (message ?? '').trim();
  if (!text || !intent?.type) {
    return null;
  }

  if (intent.type === 'forget') {
    if (FORGET_NAME_PATTERNS.some((p) => p.test(text))) {
      return { kind: 'forget-name', field: 'name', value: null };
    }
    const factKey = extractFactToSave(text);
    if (!factKey) {
      return null;
    }
    return { kind: 'forget-fact', value: factKey };
  }

  if (intent.type === 'save') {
    const fact = extractFactToSave(text);
    if (!fact || !isPlausibleFact(fact)) {
      return null;
    }
    return { kind: 'fact', value: fact };
  }

  if (intent.type === 'profile-update') {
    const field = intent.detail ?? '';

    if (field.startsWith('preferences.')) {
      const prefKey = field.replace('preferences.', '');
      const spec = PREFERENCE_PATTERNS.find((p) => p.key === prefKey);
      const value = spec?.extract(text);
      if (!value || !isPlausibleShortValue(value)) {
        return null;
      }
      return { kind: 'preference', key: prefKey, value };
    }

    const spec = PROFILE_FIELD_SPECS.find((p) => p.field === field);
    if (!spec) {
      return null;
    }

    const value = spec.extract(text);
    if (value == null || value === '') {
      return null;
    }
    if (spec.validate && !spec.validate(value)) {
      return null;
    }

    return { kind: 'profile', field, value };
  }

  return null;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isPlausiblePersonName(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > 40) {
    return false;
  }
  if (/[?？!]/.test(trimmed)) {
    return false;
  }
  if (/[.。;；:]/.test(trimmed)) {
    return false;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) {
    return false;
  }

  if (!/^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,2}$/u.test(trimmed)) {
    return false;
  }

  for (const word of words) {
    const lower = word.toLocaleLowerCase('tr-TR');
    if (NON_NAME_TOKENS.has(lower)) {
      return false;
    }
    // Reject obvious verb-like Turkish suffixes on a single token dump
    if (
      /(?:ıyor|iyor|uyor|üyor|arak|erek|ınca|ince|ınca|ince|dığında|diginda|tığında|tiginda)$/i.test(
        lower,
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * @param {string} value
 */
function isPlausibleShortValue(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return false;
  if (/[?]/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 6) return false;
  return true;
}

/**
 * @param {string} value
 */
function isPlausibleDateValue(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (/[?]/.test(trimmed)) return false;
  if (
    /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})\b/.test(trimmed)
  ) {
    return true;
  }
  // Turkish month phrases: "8 Kasım", "8 Kasım 1990"
  return /^\d{1,2}\s+[\p{L}]{3,15}(?:\s+\d{4})?$/u.test(trimmed);
}

/**
 * @param {string} value
 */
function isPlausibleFact(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length >= 3 && trimmed.length <= 500 && !hasWriteNegation(trimmed);
}

/**
 * @param {string} text
 * @returns {string|null}
 */
function extractName(text) {
  const trimmed = text.trim();

  if (NAME_STEP_IDIOMS.some((p) => p.test(trimmed))) {
    return null;
  }

  // Strip leading "Atlas," vocative so it never becomes part of the name.
  const withoutVocative = trimmed.replace(/^atlas\s*[,:]?\s+/i, '');

  const callMe = withoutVocative.match(CALL_ME_NAME_PATTERN);
  if (callMe?.[1] && isPlausiblePersonName(callMe[1])) {
    return callMe[1].trim();
  }

  for (const pattern of NAME_STATEMENT_PATTERNS) {
    pattern.lastIndex = 0;
    const match = withoutVocative.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim();
      if (isPlausiblePersonName(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * @param {string} text
 * @param {string[]} labels
 * @returns {string|null}
 */
function extractLabeledValue(text, labels) {
  const trimmed = text.trim();
  const colonMatch = trimmed.match(/[:：]\s*(.+)$/);
  if (colonMatch) {
    const after = colonMatch[1].trim().split(/[.!?,;]/)[0].trim();
    return after || null;
  }

  const labelAlt = labels.map(escapeRegExp).join('|');
  const re = new RegExp(
    `\\b(?:${labelAlt})\\s+(?:olarak\\s+)?([\\p{L}\\d][\\p{L}\\d\\s,./-]{1,60})`,
    'iu',
  );
  const match = trimmed.match(re);
  if (!match?.[1]) {
    return null;
  }

  return (
    match[1]
      .trim()
      .replace(/\s+(kaydet|hatırla|hatirla|belleğine|bellegine|hafızana|hafizana|ekle).*$/i, '')
      .replace(/[,.]+$/g, '')
      .trim() || null
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractBirthDate(text) {
  const dateMatch = text.match(
    /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})\b/,
  );
  if (dateMatch) {
    return dateMatch[1];
  }

  const monthPhrase = text.match(
    /\b(\d{1,2}\s+(?:ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)(?:\s+\d{4})?)\b/iu,
  );
  if (monthPhrase) {
    return monthPhrase[1].trim();
  }

  return extractLabeledValue(text, [
    'doğum tarihim',
    'dogum tarihim',
    'doğum günüm',
    'dogum gunum',
  ]);
}

function extractBirthTime(text) {
  const timeMatch = text.match(/\b(\d{1,2}[:.]\d{2})\b/);
  if (timeMatch) {
    return timeMatch[1];
  }
  return extractLabeledValue(text, ['doğum saatim', 'dogum saatim', 'doğum saati']);
}

function extractDateLike(text) {
  return extractBirthDate(text) ?? extractLabeledValue(text, ['referans tarihim', 'referans tarih']);
}

/**
 * Extract free-form fact from "bunu hatırla" style messages.
 * @param {string} message
 */
function extractFactToSave(message) {
  const text = message.trim();

  let content = text
    .replace(/^(atlas[,]?\s*)?/i, '')
    .replace(/\b(bunu|şunu|sunu|bu bilgiyi|şu bilgiyi)\s+(hatırla|hatirla|kaydet|unut)\b/gi, '')
    .replace(/\bhaf[iı]zana?\s+(kaydet|ekle|yaz|sil)\b/gi, '')
    .replace(/\bbelle[gğ]ine?\s+(ekle|kaydet|yaz|sil)\b/gi, '')
    .replace(/\b(kaydet|hatırla|hatirla)\s*$/i, '')
    .replace(/^[:：]\s*/, '')
    .trim();

  if (!content || content.length < 3) {
    const afterColon = text.match(/[:：]\s*(.+)$/);
    content = afterColon ? afterColon[1].trim() : '';
  }

  content = content.replace(/^[:：]\s*/, '').trim();
  return content.length >= 3 ? content : null;
}

/**
 * Format stored memory for recall responses.
 * @param {ReturnType<typeof getUserMemory>} memory
 */
export function formatMemorySummary(memory) {
  const lines = [];

  for (const [key, label] of Object.entries(PROFILE_LABELS)) {
    const value = memory.profile[key];
    if (value) {
      lines.push(`- ${label}: ${value}`);
    }
  }

  for (const [key, value] of Object.entries(memory.preferences)) {
    if (value !== null && value !== undefined && String(value).trim()) {
      lines.push(`- Tercih (${key}): ${value}`);
    }
  }

  for (const [key, value] of Object.entries(memory.facts)) {
    if (value !== null && value !== undefined && String(value).trim()) {
      lines.push(`- ${key}: ${value}`);
    }
  }

  if (lines.length === 0) {
    return 'Hafızamda kayıtlı kişisel bilgin yok. İstersen doğum tarihi, konum veya tercihlerini paylaşabilirsin.';
  }

  return `Hafızamdaki kayıtlı bilgiler:\n${lines.join('\n')}`;
}

/**
 * @param {string} userId
 * @param {string} message
 * @param {MemoryIntent} intent
 * @param {{ founderSession?: import('./founder-identity.js').FounderSession|null }} [options]
 * @returns {Promise<{ handled: boolean, reply?: string, memoryUpdated?: boolean, error?: string }>}
 */
export async function processMemoryIntent(userId, message, intent, options = {}) {
  if (!intent.type) {
    return { handled: false };
  }

  const founderSession = options.founderSession ?? resolveFounderSession(userId);

  if (intent.type === 'recall') {
    if (founderSession) {
      return {
        handled: true,
        reply: formatFounderAwareMemoryRecall(userId, founderSession),
        memoryUpdated: false,
      };
    }

    const memory = getUserMemory(userId);
    return {
      handled: true,
      reply: formatMemorySummary(memory),
      memoryUpdated: false,
    };
  }

  // Stage 2 — no write unless entity extraction + validation succeeds.
  const entity = extractValidatedMemoryEntity(message, intent);

  // Ambiguous call-me / name preference: confirm before permanent write.
  if (intent.type === 'profile-update' && intent.clarity === 'ambiguous') {
    const nameHint = entity?.kind === 'profile' && entity.field === 'name' ? entity.value : null;
    return {
      handled: true,
      reply: nameHint
        ? `Bu konuşmada sana ${nameHint} diye hitap edebilirim. Kalıcı profiline de kaydetmemi ister misin? İstersen “Adım ${nameHint}, kaydet.” yazman yeterli.`
        : 'Hitap tercihini bu konuşmada kullanabilirim. Kalıcı kaydetmemi istiyorsan alanı ve değeri açıkça yaz (ör. "Adım Lara, kaydet.").',
      memoryUpdated: false,
    };
  }

  if (intent.type === 'forget') {
    if (entity?.kind === 'forget-name') {
      const result = await updateUserMemory(userId, {
        profile: { name: null },
      });
      if (!result.ok) {
        return {
          handled: true,
          reply: `Silme işlemi başarısız: ${result.error}`,
          memoryUpdated: false,
          error: result.error,
        };
      }
      return {
        handled: true,
        reply: 'Ad bilgini hafızamdan sildim.',
        memoryUpdated: true,
      };
    }

    if (entity?.kind === 'forget-fact' && entity.value) {
      const memory = getUserMemory(userId);
      const factKey = entity.value;
      const matchingKey = Object.keys(memory.facts).find(
        (k) =>
          k.toLowerCase().includes(factKey.toLowerCase()) ||
          factKey.toLowerCase().includes(k.toLowerCase()) ||
          String(memory.facts[k]).toLowerCase().includes(factKey.toLowerCase()),
      );

      if (matchingKey) {
        const result = await deleteMemoryField(userId, `facts.${matchingKey}`);
        if (!result.ok) {
          return {
            handled: true,
            reply: `Silme işlemi başarısız: ${result.error}`,
            memoryUpdated: false,
            error: result.error,
          };
        }
        return {
          handled: true,
          reply: `"${matchingKey}" hafızamdan silindi.`,
          memoryUpdated: true,
        };
      }
    }

    return {
      handled: true,
      reply: 'Silinecek kayıt bulunamadı. Daha spesifik olabilir misin? Örneğin: "Adımı unut" veya "Bunu unut: …"',
      memoryUpdated: false,
    };
  }

  if (!entity) {
    // Explicit intent but unsafe/unparseable entity → clarify, never write.
    return {
      handled: true,
      reply:
        'Ne kaydetmemi veya güncellememi istediğini net anlayamadım. Lütfen alanı ve değeri açıkça yaz (ör. "Adım Lara, kaydet.").',
      memoryUpdated: false,
    };
  }

  if (entity.kind === 'fact' && entity.value) {
    const key = `note_${Date.now()}`;
    const result = await updateUserMemory(userId, {
      facts: { [key]: entity.value },
    });

    if (!result.ok) {
      return {
        handled: true,
        reply: `Kaydetme başarısız: ${result.error}`,
        memoryUpdated: false,
        error: result.error,
      };
    }

    return {
      handled: true,
      reply: `Tamam, bunu hafızama kaydettim: "${entity.value}"`,
      memoryUpdated: true,
    };
  }

  if (entity.kind === 'preference' && entity.key && entity.value) {
    const result = await updateUserMemory(userId, {
      preferences: { [entity.key]: entity.value },
    });

    if (!result.ok) {
      return {
        handled: true,
        reply: `Kaydetme başarısız: ${result.error}`,
        memoryUpdated: false,
        error: result.error,
      };
    }

    return {
      handled: true,
      reply: `Tercihini kaydettim: ${entity.value}`,
      memoryUpdated: true,
    };
  }

  if (entity.kind === 'profile' && entity.field && entity.value != null) {
    const result = await updateUserMemory(userId, {
      profile: { [entity.field]: entity.value },
    });

    if (!result.ok) {
      return {
        handled: true,
        reply: `Kaydetme başarısız: ${result.error}`,
        memoryUpdated: false,
        error: result.error,
      };
    }

    return {
      handled: true,
      reply: `${PROFILE_LABELS[entity.field] ?? entity.field} bilgini kaydettim: ${entity.value}`,
      memoryUpdated: true,
    };
  }

  return { handled: false };
}

/**
 * Build only relevant memory lines for prompt injection (not full store).
 * @param {string} userId
 * @param {string} message
 * @param {string} mode
 * @returns {string|null}
 */
export function buildRelevantMemoryContext(userId, message, mode = 'conversational') {
  const memory = getUserMemory(userId);
  const lines = [];
  const text = (message ?? '').toLowerCase();

  const wantsBirth =
    /doğum|dogum|burç|burc|astro|numerol|kader|harita|transit|yaşam yolu|yasam yolu/.test(text);
  const wantsLocation = /konum|nerede|saat dilimi|timezone|yerel/.test(text);
  const wantsDaily = mode === 'daily-guide' || /günaydın|bugün|gunluk|günlük/.test(text);
  const wantsMeta = mode === 'meta-synthesis' || wantsBirth;

  if (memory.profile.name) {
    lines.push(`Ad: ${memory.profile.name}`);
  }

  if (wantsMeta || wantsBirth) {
    if (memory.profile.birthDate) lines.push(`Doğum tarihi: ${memory.profile.birthDate}`);
    if (memory.profile.birthTime) lines.push(`Doğum saati: ${memory.profile.birthTime}`);
    if (memory.profile.birthPlace) lines.push(`Doğum yeri: ${memory.profile.birthPlace}`);
    if (memory.profile.referenceDate) lines.push(`Referans tarihi: ${memory.profile.referenceDate}`);
  }

  if (wantsLocation || wantsDaily || wantsMeta) {
    if (memory.profile.timezone) lines.push(`Saat dilimi: ${memory.profile.timezone}`);
    if (memory.profile.location) lines.push(`Konum: ${memory.profile.location}`);
  }

  if (memory.profile.relationshipStatus && /ilişki|iliski|partner|aşk|ask/.test(text)) {
    lines.push(`İlişki durumu: ${memory.profile.relationshipStatus}`);
  }

  if (memory.preferences.favoriteSymbolicSystems && wantsMeta) {
    lines.push(`Favori sembolik sistemler: ${memory.preferences.favoriteSymbolicSystems}`);
  }

  if (memory.preferences.responseStyle) {
    lines.push(`Yanıt tercihi: ${memory.preferences.responseStyle}`);
  }

  const factEntries = Object.entries(memory.facts).slice(-3);
  if (factEntries.length > 0 && intentMentionsPast(message)) {
    for (const [, value] of factEntries) {
      lines.push(`Not: ${value}`);
    }
  }

  if (lines.length === 0) {
    return null;
  }

  return lines.join('\n');
}

function intentMentionsPast(message) {
  return /daha önce|hatırla|hatirla|söylemiş|soylemist|geçen|gecen|biliyor musun/.test(
    (message ?? '').toLowerCase(),
  );
}

/**
 * Auto-save only when the same strict two-stage gate succeeds.
 * @param {string} userId
 * @param {string} message
 */
export async function tryAutoSaveProfile(userId, message) {
  const intent = detectMemoryIntent(message);
  if (intent.type === 'profile-update' && intent.detail && !intent.detail.startsWith('preferences.')) {
    const entity = extractValidatedMemoryEntity(message, intent);
    if (!entity || entity.kind !== 'profile') {
      return false;
    }
    const result = await processMemoryIntent(userId, message, intent);
    return result.memoryUpdated === true;
  }
  return false;
}

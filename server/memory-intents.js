// ═══════════════════════════════════════════════════════════════════════
// Atlas Memory Intents — detect and route explicit memory operations
// ═══════════════════════════════════════════════════════════════════════

import {
  deleteMemoryField,
  getUserMemory,
  updateUserMemory,
} from './user-memory.js';
import { resolveFounderSession, formatFounderAwareMemoryRecall } from './founder-identity.js';

/** @typedef {'save' | 'recall' | 'forget' | 'profile-update' | null} MemoryIntentType */

/** @typedef {{ type: MemoryIntentType, detail?: string }} MemoryIntent */

const SAVE_PATTERNS = [
  /\bbunu hatırla\b/i,
  /\bbunu kaydet\b/i,
  /\bhafızana kaydet\b/i,
  /\bhafizana kaydet\b/i,
  /\bşunu hatırla\b/i,
  /\bsunu hatırla\b/i,
  /\bunutma\b/i,
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
  /\bhafızandan sil\b/i,
  /\bhafizandan sil\b/i,
  /\bunut bunu\b/i,
  /\bhafızamdan sil\b/i,
  /\bhafizamdan sil\b/i,
];

const PROFILE_FIELD_PATTERNS = [
  {
    field: 'birthDate',
    patterns: [
      /\b(doğum tarihim|dogum tarihim|doğum günüm|dogum gunum)\b/i,
      /\bbenim doğum tarihim\b/i,
      /\bbenim dogum tarihim\b/i,
    ],
    extract: extractBirthDate,
  },
  {
    field: 'birthTime',
    patterns: [/\b(doğum saatim|dogum saatim|doğum saatim|doğum saati)\b/i],
    extract: extractBirthTime,
  },
  {
    field: 'birthPlace',
    patterns: [/\b(doğum yerim|dogum yerim|doğum yerim)\b/i],
    extract: extractAfterColonOrIs,
  },
  {
    field: 'timezone',
    patterns: [/\b(saat dilimim|zaman dilimim|timezone)\b/i],
    extract: extractAfterColonOrIs,
  },
  {
    field: 'location',
    patterns: [/\b(konumum|bulunduğum yer|bulundugum yer|şu an)\b/i],
    extract: extractAfterColonOrIs,
  },
  {
    field: 'name',
    patterns: [/\b(adım|adim|ismim|benim adım)\b/i],
    extract: extractAfterColonOrIs,
  },
  {
    field: 'referenceDate',
    patterns: [/\b(referans tarihim|referans tarih)\b/i],
    extract: extractDateLike,
  },
  {
    field: 'relationshipStatus',
    patterns: [/\b(ilişki durumum|iliski durumum|medeni halim)\b/i],
    extract: extractAfterColonOrIs,
  },
];

const PREFERENCE_PATTERNS = [
  {
    key: 'favoriteSymbolicSystems',
    patterns: [/\b(favori sembolik sistem|sevdiğim sistem|tercih ettiğim sistem)\b/i],
    extract: extractAfterColonOrIs,
  },
];

/**
 * @param {string} message
 * @returns {MemoryIntent}
 */
export function detectMemoryIntent(message) {
  const text = (message ?? '').trim();
  if (!text) {
    return { type: null };
  }

  if (FORGET_PATTERNS.some((p) => p.test(text))) {
    return { type: 'forget' };
  }

  if (RECALL_PATTERNS.some((p) => p.test(text))) {
    return { type: 'recall' };
  }

  if (SAVE_PATTERNS.some((p) => p.test(text))) {
    return { type: 'save' };
  }

  for (const spec of PROFILE_FIELD_PATTERNS) {
    if (spec.patterns.some((p) => p.test(text))) {
      return { type: 'profile-update', detail: spec.field };
    }
  }

  for (const spec of PREFERENCE_PATTERNS) {
    if (spec.patterns.some((p) => p.test(text))) {
      return { type: 'profile-update', detail: `preferences.${spec.key}` };
    }
  }

  return { type: null };
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

function extractAfterColonOrIs(text) {
  const trimmed = text.trim();
  const colonMatch = trimmed.match(/[:：]\s*(.+)$/);
  if (colonMatch) {
    return colonMatch[1].trim();
  }

  const isMatch = trimmed.match(
    /\b(?:adım|adim|ismim|konumum|doğum yerim|dogum yerim|saat dilimim|ilişki durumum|iliski durumum)\s+(?:\w+\s+){0,3}?([\p{L}\d][\p{L}\d\s,.-]{1,80})/iu,
  );
  if (isMatch) {
    return isMatch[1].trim();
  }

  return null;
}

function extractBirthDate(text) {
  const dateMatch = text.match(
    /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})\b/,
  );
  if (dateMatch) {
    return dateMatch[1];
  }
  return extractAfterColonOrIs(text);
}

function extractBirthTime(text) {
  const timeMatch = text.match(/\b(\d{1,2}[:.]\d{2})\b/);
  if (timeMatch) {
    return timeMatch[1];
  }
  return extractAfterColonOrIs(text);
}

function extractDateLike(text) {
  return extractBirthDate(text) ?? extractAfterColonOrIs(text);
}

/**
 * Extract free-form fact from "bunu hatırla" style messages.
 * @param {string} message
 */
function extractFactToSave(message) {
  const text = message.trim();

  let content = text
    .replace(/^(atlas[,]?\s*)?/i, '')
    .replace(/\b(bunu|şunu|sunu)\s+(hatırla|kaydet|unutma)\b/gi, '')
    .replace(/\bhafızana kaydet\b/gi, '')
    .trim();

  if (!content || content.length < 3) {
    const afterColon = text.match(/[:：]\s*(.+)$/);
    content = afterColon ? afterColon[1].trim() : '';
  }

  return content.length >= 3 ? content : null;
}

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

  if (intent.type === 'forget') {
    const factKey = extractFactToSave(message);
    if (factKey) {
      const memory = getUserMemory(userId);
      const matchingKey = Object.keys(memory.facts).find(
        (k) => k.toLowerCase().includes(factKey.toLowerCase()) || factKey.toLowerCase().includes(k.toLowerCase()),
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
      reply: 'Silinecek kayıt bulunamadı. Daha spesifik olabilir misin?',
      memoryUpdated: false,
    };
  }

  if (intent.type === 'save') {
    const fact = extractFactToSave(message);
    if (!fact) {
      return {
        handled: true,
        reply: 'Ne kaydetmemi istediğini anlayamadım. Lütfen kaydetmek istediğin bilgiyi açıkça yaz.',
        memoryUpdated: false,
      };
    }

    const key = `note_${Date.now()}`;
    const result = await updateUserMemory(userId, {
      facts: { [key]: fact },
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
      reply: `Tamam, bunu hafızama kaydettim: "${fact}"`,
      memoryUpdated: true,
    };
  }

  if (intent.type === 'profile-update') {
    const field = intent.detail ?? '';

    if (field.startsWith('preferences.')) {
      const prefKey = field.replace('preferences.', '');
      const spec = PREFERENCE_PATTERNS.find((p) => p.key === prefKey);
      const value = spec?.extract(message);
      if (!value) {
        return {
          handled: true,
          reply: 'Tercih bilgisini anlayamadım. Lütfen değeri açıkça belirt.',
          memoryUpdated: false,
        };
      }

      const result = await updateUserMemory(userId, {
        preferences: { [prefKey]: value },
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
        reply: `Tercihini kaydettim: ${value}`,
        memoryUpdated: true,
      };
    }

    const spec = PROFILE_FIELD_PATTERNS.find((p) => p.field === field);
    const value = spec?.extract(message);
    if (!value) {
      return {
        handled: true,
        reply: `${PROFILE_LABELS[field] ?? field} bilgisini anlayamadım. Lütfen değeri açıkça belirt.`,
        memoryUpdated: false,
      };
    }

    const result = await updateUserMemory(userId, {
      profile: { [field]: value },
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
      reply: `${PROFILE_LABELS[field] ?? field} bilgini kaydettim: ${value}`,
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
 * High-confidence profile extraction without explicit save command.
 * Only auto-saves when message clearly states profile data.
 * @param {string} userId
 * @param {string} message
 */
export async function tryAutoSaveProfile(userId, message) {
  const intent = detectMemoryIntent(message);
  if (intent.type === 'profile-update' && intent.detail && !intent.detail.startsWith('preferences.')) {
    const result = await processMemoryIntent(userId, message, intent);
    return result.memoryUpdated === true;
  }
  return false;
}

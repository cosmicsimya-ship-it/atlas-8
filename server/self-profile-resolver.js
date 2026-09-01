// ═══════════════════════════════════════════════════════════════════════
// Self-profile resolver — first-person property queries (deterministic)
// Used by conversation-context-engine before LLM / astrology fallback.
// ═══════════════════════════════════════════════════════════════════════

import { getUserMemory, isValidUserId } from './user-memory.js';
import { calculateNatalFromMemory, formatDegreeLabel } from './natal-engine/index.js';

/** Deterministic natal engine can compute Ascendant when date+time+place are known. */
export const ASCENDANT_CALC_AVAILABLE = true;

export const SELF_PROFILE_PROPERTY_ALIASES = {
  zodiac: ['burç', 'burc', 'zodiac', 'zodyak'],
  age: ['yaş', 'yas', 'age'],
  birthDate: ['doğum tarihi', 'dogum tarihi', 'doğum günü', 'dogum gunu', 'birthday'],
  birthTime: ['doğum saati', 'dogum saati', 'doğum zamanı', 'dogum zamani', 'birth time'],
  birthPlace: ['doğum yeri', 'dogum yeri', 'birth place', 'birthplace'],
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

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} message
 * @param {string[]} [otherParticipantNames] Display names of other known
 *   people in this conversation (already-seen senders, subjects the user
 *   has referred to, etc). Used to reject a third-party name mention
 *   ("Ahmet'in burcu") as a self-profile query. Generalizes what used to be
 *   a hardcoded name list — pass whatever names the caller already knows
 *   about instead of relying on names baked into this function.
 * @returns {{ field: string }|null}
 */
export function detectSelfProfileQuery(message, otherParticipantNames = []) {
  const text = String(message ?? '').trim();
  if (!text || text.length > 120) return null;
  const folded = foldTr(text).replace(/[?.!…]+$/g, '').trim();

  const hasBenim = /\bbenim\b/u.test(folded);
  const hasFirstPersonPoss =
    hasBenim ||
    /\b(burcum|yasim|dogum\s+tarihim|dogum\s+gunum|dogum\s+saatim|dogum\s+yerim|yukselenim|numerolojim|yasam\s+yolum|ebcedim|abjadim|meslegim)\b/u.test(
      folded,
    ) ||
    /^nerede\s+dogdum\b/u.test(folded) ||
    /^dogum\s+(yerim|saatim|tarihim)\b/u.test(folded);

  if (!hasFirstPersonPoss) return null;
  if (/\batlas\b/u.test(folded) && !hasBenim) return null;
  // "Lara" is Atlas's own author-profile identity (server/author-profile.js),
  // not a user — treated the same as "atlas" above, not a per-user patch.
  if (/\b(lara|onun|senin)\b/u.test(folded) && !hasBenim) return null;
  if (
    !hasBenim &&
    otherParticipantNames.some((name) => {
      const n = foldTr(String(name || ''));
      return n && n.length > 1 && new RegExp(`\\b${escapeRe(n)}\\b`, 'u').test(folded);
    })
  ) {
    return null;
  }

  const askTail = '(?:nedir|ne|kac|neydi|neresi)?';

  /** @type {Array<[string, RegExp]>} */
  const fieldPatterns = [
    ['zodiac', new RegExp(`^(?:benim\\s+)?burc(?:um|un)?\\s*${askTail}\\s*$`, 'u')],
    ['age', new RegExp(`^(?:benim\\s+)?yas(?:im|in)?\\s*${askTail}\\s*$`, 'u')],
    [
      'birthDate',
      new RegExp(
        `^(?:benim\\s+)?(?:dogum\\s+tarih(?:im|in)?|dogum\\s+gun(?:um|un)?)\\s*${askTail}\\s*$`,
        'u',
      ),
    ],
    ['birthTime', new RegExp(`^(?:benim\\s+)?dogum\\s+saat(?:im|in)?\\s*${askTail}\\s*$`, 'u')],
    [
      'birthPlace',
      new RegExp(
        `^(?:benim\\s+)?(?:dogum\\s+yer(?:im|in)?|nerede\\s+dogdum)\\s*${askTail}\\s*$`,
        'u',
      ),
    ],
    ['rising', new RegExp(`^(?:benim\\s+)?yukselen(?:im|in)?\\s*${askTail}\\s*$`, 'u')],
    [
      'numerology',
      new RegExp(
        `^(?:benim\\s+)?(?:numeroloji(?:m|n)?|yasam\\s+yol(?:um|un)?)\\s*${askTail}\\s*$`,
        'u',
      ),
    ],
    ['abjad', new RegExp(`^(?:benim\\s+)?(?:ebced(?:im|in)?|abjad(?:im|in)?)\\s*${askTail}\\s*$`, 'u')],
    ['occupation', new RegExp(`^(?:benim\\s+)?mesleg(?:im|in)?\\s*${askTail}\\s*$`, 'u')],
  ];

  for (const [field, re] of fieldPatterns) {
    if (re.test(folded)) return { field };
  }

  if (hasBenim) {
    for (const [field, aliases] of Object.entries(SELF_PROFILE_PROPERTY_ALIASES)) {
      for (const alias of aliases) {
        const a = foldTr(alias);
        if (
          new RegExp(`^benim\\s+${escapeRe(a)}(?:um|im|m)?\\s*${askTail}\\s*$`, 'u').test(folded)
        ) {
          return { field };
        }
      }
    }
  }

  return null;
}

/**
 * Flatten profile/facts/conversation buckets into one record.
 * @param {object|null|undefined} memory
 * @param {object|null|undefined} [conversationBucket]
 */
export function normalizeUserProfileFacts(memory = null, conversationBucket = null) {
  const profile =
    memory?.profile && typeof memory.profile === 'object' ? memory.profile : {};
  const facts = memory?.facts && typeof memory.facts === 'object' ? memory.facts : {};
  const root =
    memory && typeof memory === 'object' && !memory.profile && !memory.facts ? memory : {};
  const conv =
    conversationBucket && typeof conversationBucket === 'object' ? conversationBucket : {};

  const pick = (...vals) => {
    for (const v of vals) {
      if (v == null) continue;
      if (typeof v === 'object' && v.value != null) {
        const s = String(v.value).trim();
        if (s) return s;
        continue;
      }
      const s = String(v).trim();
      if (s && s !== 'null' && s !== 'undefined') return s;
    }
    return null;
  };

  return {
    name: pick(profile.name, facts.name, root.name, conv.__displayName),
    birthDate: pick(profile.birthDate, facts.birthDate, root.birthDate, conv.birthDate),
    birthTime: pick(profile.birthTime, facts.birthTime, root.birthTime, conv.birthTime),
    birthPlace: pick(profile.birthPlace, facts.birthPlace, root.birthPlace, conv.birthPlace),
    zodiac: pick(facts.zodiac, profile.zodiac, root.zodiac, conv.zodiac),
    rising: pick(
      facts.rising,
      facts.risingSign,
      facts.ascendant,
      profile.rising,
      profile.risingSign,
      profile.ascendant,
      root.rising,
      root.risingSign,
      root.ascendant,
      conv.rising,
      conv.risingSign,
      conv.ascendant,
    ),
    numerology: pick(
      facts.numerology,
      facts.lifePath,
      profile.numerology,
      profile.lifePath,
      root.numerology,
      root.lifePath,
      conv.numerology,
      conv.lifePath,
    ),
    abjad: pick(
      facts.abjad,
      facts.ebced,
      profile.abjad,
      profile.ebced,
      root.abjad,
      root.ebced,
      conv.abjad,
      conv.ebced,
    ),
    age: pick(facts.age, profile.age, root.age, conv.age),
    occupation: pick(facts.occupation, profile.occupation, conv.occupation),
  };
}

/**
 * @param {string|null|undefined} value
 * @returns {{ y: number, m: number, d: number }|null}
 */
export function parseBirthDateParts(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  let m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  m = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return { y: Number(m[3]), m: Number(m[2]), d: Number(m[1]) };
  return null;
}

/**
 * @param {string|null|undefined} birthDate
 */
export function tropicalZodiacFromBirthDate(birthDate) {
  const parts = parseBirthDateParts(birthDate);
  if (!parts) return null;
  const md = parts.m * 100 + parts.d;
  if (md >= 321 && md <= 419) return 'Koç';
  if (md >= 420 && md <= 520) return 'Boğa';
  if (md >= 521 && md <= 620) return 'İkizler';
  if (md >= 621 && md <= 722) return 'Yengeç';
  if (md >= 723 && md <= 822) return 'Aslan';
  if (md >= 823 && md <= 922) return 'Başak';
  if (md >= 923 && md <= 1022) return 'Terazi';
  if (md >= 1023 && md <= 1121) return 'Akrep';
  if (md >= 1122 && md <= 1221) return 'Yay';
  if (md >= 1222 || md <= 119) return 'Oğlak';
  if (md >= 120 && md <= 218) return 'Kova';
  if (md >= 219 && md <= 320) return 'Balık';
  return null;
}

/**
 * @param {string|null|undefined} birthDate
 * @param {Date} [now]
 * @param {string} [timeZone]
 */
export function ageFromBirthDate(
  birthDate,
  now = new Date(),
  timeZone = 'Europe/Istanbul',
) {
  const parts = parseBirthDateParts(birthDate);
  if (!parts) return null;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = fmt.format(now instanceof Date ? now : new Date(now));
  const [ty, tm, td] = todayStr.split('-').map(Number);
  if (!ty || !tm || !td) return null;
  let age = ty - parts.y;
  if (tm < parts.m || (tm === parts.m && td < parts.d)) age -= 1;
  if (age < 0 || age > 130) return null;
  return age;
}

/**
 * @param {string|null|undefined} birthDate
 */
export function lifePathFromBirthDate(birthDate) {
  const parts = parseBirthDateParts(birthDate);
  if (!parts) return null;
  const digits = `${parts.y}${String(parts.m).padStart(2, '0')}${String(parts.d).padStart(2, '0')}`
    .split('')
    .map(Number);
  let sum = digits.reduce((a, b) => a + b, 0);
  const masters = new Set([11, 22, 33]);
  while (sum > 9 && !masters.has(sum)) {
    sum = String(sum)
      .split('')
      .reduce((s, d) => s + Number(d), 0);
  }
  return sum;
}

/**
 * @param {string} field
 * @param {ReturnType<typeof normalizeUserProfileFacts>} [normalized]
 */
export function missingHintForSelfField(field, normalized = null) {
  switch (field) {
    case 'zodiac':
      return 'Doğum tarihini verirsen burcunu söyleyebilirim.';
    case 'age':
      return 'Yaşını söylemem için doğum tarihin kayıtlı olmalı.';
    case 'birthDate':
      return 'Doğum tarihin hakkında kayıtlı bilgim yok.';
    case 'birthTime':
      return 'Doğum saatin hakkında kayıtlı bilgim yok.';
    case 'birthPlace':
      return 'Doğum yerin hakkında kayıtlı bilgim yok.';
    case 'rising':
      if (!ASCENDANT_CALC_AVAILABLE) {
        return 'Yükselenin kayıtlı değil. Bu sohbette yükselen hesabı da yapamam; kayıtlı yükselen bilgisi gerekir.';
      }
      {
        const missing = [];
        if (!normalized?.birthDate) missing.push('doğum tarihi');
        if (!normalized?.birthTime) missing.push('doğum saati');
        if (!normalized?.birthPlace) missing.push('doğum yeri');
        if (missing.length) return `Yükselen için ${missing.join(', ')} gerekli.`;
      }
      return 'Yükselenin hakkında kayıtlı bilgim yok.';
    case 'numerology':
      return 'Numeroloji için doğum tarihini paylaşırsan hesaplayabilirim.';
    case 'abjad':
      return 'Ebced için kayıtlı, metodolojisi belli bir sonuç veya doğrulanmış Arapça ad yazımı gerekli.';
    case 'occupation':
      return 'Mesleğin hakkında kayıtlı bilgim yok.';
    default:
      return 'Bu bilgi için henüz yeterli kaydım yok.';
  }
}

/**
 * @param {object} info
 */
export function logSelfProfileDebug(info = {}) {
  console.log(
    `[Atlas/self-profile] intent=${info.intent ?? 'self_profile_query'}` +
      ` subject=${info.subject ?? 'self'}` +
      ` field=${info.field ?? '?'}` +
      ` telegramUserId=${info.telegramUserId ?? info.userId ?? 'none'}` +
      ` lookupKeys=${JSON.stringify(info.lookupKeys ?? [])}` +
      ` matchedKey=${info.matchedKey ?? 'none'}` +
      ` foundField=${info.foundField ?? 'none'}` +
      ` value=${info.value ?? 'null'}` +
      ` source=${info.source ?? 'none'}` +
      ` fallbackReason=${info.fallbackReason ?? 'none'}` +
      ` path=${info.path ?? 'conversation-context'}`,
  );
}

/**
 * @param {string} field
 * @param {{ value: string|null, source: string|null, missingHint: string|null }} resolution
 */
export function buildSelfProfileReply(field, resolution) {
  if (!resolution.value) {
    return resolution.missingHint || 'Bu bilgi için henüz yeterli kaydım yok.';
  }
  const v = resolution.value;
  if (field === 'zodiac') {
    if (resolution.source === 'memory' || resolution.source === 'conversation') {
      return `Belleğimde kayıtlı bilgiye göre ${v} burcusun.`;
    }
    if (resolution.source === 'derived') return `Doğum tarihine göre burcun ${v}.`;
    return `${v}.`;
  }
  if (field === 'age') {
    return resolution.source === 'derived'
      ? `Doğum tarihine göre ${v} yaşındasın.`
      : `Belleğimde kayıtlı bilgiye göre ${v} yaşındasın.`;
  }
  if (field === 'birthDate') return `Belleğimde kayıtlı doğum tarihin ${v}.`;
  if (field === 'birthTime') return `Belleğimde kayıtlı doğum saatin ${v}.`;
  if (field === 'birthPlace') return `Belleğimde kayıtlı doğum yerin ${v}.`;
  if (field === 'rising') {
    if (resolution.source === 'derived') {
      return `Doğum bilgilerine göre yükselenin ${v}.`;
    }
    return `Belleğimde kayıtlı yükselenin ${v}.`;
  }
  if (field === 'numerology') {
    return resolution.source === 'derived'
      ? `Doğum tarihine göre yaşam yolu sayın ${v}.`
      : `Belleğimde kayıtlı bilgiye göre numerolojin ${v}.`;
  }
  if (field === 'abjad') {
    return resolution.source === 'derived'
      ? `Adının ebced değeri ${v}.`
      : `Belleğimde kayıtlı ebced değerin ${v}.`;
  }
  if (field === 'occupation') return `Belleğimde kayıtlı mesleğin: ${v}.`;
  return String(v);
}

/**
 * @param {{
 *   field: string,
 *   userId?: string|null,
 *   state: { participantFactsByTelegramId?: Record<string, object> },
 *   sender?: { userId?: string|null, displayName?: string|null },
 *   alternateUserIds?: string[],
 * }} input
 */
export function resolveSelfProfileValue(input) {
  const field = input.field;
  const userId = input.userId || input.sender?.userId || null;
  const state = input.state || { participantFactsByTelegramId: {} };
  /** @type {string[]} */
  const lookupKeys = [];
  const pushKey = (k) => {
    if (k && isValidUserId(k) && !lookupKeys.includes(k)) lookupKeys.push(k);
  };
  pushKey(userId);
  pushKey(input.sender?.userId);
  for (const k of input.alternateUserIds || []) pushKey(k);

  const displayKey = input.sender?.displayName
    ? `name:${foldTr(input.sender.displayName)}`
    : null;

  let normalized = normalizeUserProfileFacts(null, null);
  /** @type {string|null} */
  let matchedKey = null;

  const mergeNorm = (next, keyLabel) => {
    if (!next) return;
    for (const [k, v] of Object.entries(next)) {
      if (v && !normalized[k]) {
        normalized[k] = v;
        if (!matchedKey && keyLabel) matchedKey = keyLabel;
      }
    }
  };

  for (const key of lookupKeys) {
    mergeNorm(
      normalizeUserProfileFacts(null, state.participantFactsByTelegramId?.[key]),
      key,
    );
  }
  if (displayKey) {
    mergeNorm(
      normalizeUserProfileFacts(null, state.participantFactsByTelegramId?.[displayKey]),
      displayKey,
    );
  }

  for (const key of lookupKeys) {
    const memory = getUserMemory(key);
    const before = normalized[field];
    mergeNorm(normalizeUserProfileFacts(memory, null), key);
    if (!before && normalized[field]) matchedKey = key;
  }

  const direct = normalized[field] || null;
  if (direct) {
    return {
      value: direct,
      source:
        matchedKey && String(matchedKey).startsWith('name:') ? 'conversation' : 'memory',
      missingHint: null,
      lookupKeys,
      matchedKey,
      foundField: field,
      fallbackReason: null,
      normalizedSnapshot: {
        birthDate: normalized.birthDate,
        birthTime: normalized.birthTime,
        birthPlace: normalized.birthPlace,
        hasZodiac: Boolean(normalized.zodiac),
        hasRising: Boolean(normalized.rising),
      },
    };
  }

  if (field === 'zodiac' && normalized.birthDate) {
    const z = tropicalZodiacFromBirthDate(normalized.birthDate);
    if (z) {
      return {
        value: z,
        source: 'derived',
        missingHint: null,
        lookupKeys,
        matchedKey,
        foundField: 'birthDate→zodiac',
        fallbackReason: null,
      };
    }
  }
  if (field === 'age' && normalized.birthDate) {
    const age = ageFromBirthDate(normalized.birthDate, new Date(), 'Europe/Istanbul');
    if (age != null) {
      return {
        value: String(age),
        source: 'derived',
        missingHint: null,
        lookupKeys,
        matchedKey,
        foundField: 'birthDate→age',
        fallbackReason: null,
      };
    }
  }
  if (field === 'numerology' && normalized.birthDate) {
    const lp = lifePathFromBirthDate(normalized.birthDate);
    if (lp != null) {
      return {
        value: String(lp),
        source: 'derived',
        missingHint: null,
        lookupKeys,
        matchedKey,
        foundField: 'birthDate→lifePath',
        fallbackReason: null,
      };
    }
  }
  if (field === 'rising') {
    if (
      ASCENDANT_CALC_AVAILABLE &&
      normalized.birthDate &&
      normalized.birthTime &&
      normalized.birthPlace
    ) {
      const chart = calculateNatalFromMemory(userId, {
        birthDate: normalized.birthDate,
        birthTime: normalized.birthTime,
        birthPlace: normalized.birthPlace,
      });
      if (chart?.ok && chart.angles?.ascendant) {
        const asc = chart.angles.ascendant;
        return {
          value: formatDegreeLabel(asc),
          source: 'derived',
          missingHint: null,
          lookupKeys,
          matchedKey,
          foundField: 'birth→natal-engine-ascendant',
          fallbackReason: null,
          natalAnalysisId: chart.analysisId,
        };
      }
      if (chart && chart.ok === false) {
        return {
          value: null,
          source: null,
          missingHint: chart.message || missingHintForSelfField(field, normalized),
          lookupKeys,
          matchedKey,
          foundField: null,
          fallbackReason: chart.errorCode || 'ascendant_calc_failed',
        };
      }
    }
    return {
      value: null,
      source: null,
      missingHint: missingHintForSelfField(field, normalized),
      lookupKeys,
      matchedKey,
      foundField: null,
      fallbackReason: 'ascendant_inputs_incomplete',
      normalizedSnapshot: {
        birthDate: normalized.birthDate,
        birthTime: normalized.birthTime,
        birthPlace: normalized.birthPlace,
      },
    };
  }
  // Abjad: never invent from birthDate or bare display name in this path.
  // Recorded methodology-backed values only; otherwise point to the ebced flow.
  if (field === 'abjad') {
    return {
      value: null,
      source: null,
      missingHint: missingHintForSelfField(field, normalized),
      lookupKeys,
      matchedKey,
      foundField: null,
      fallbackReason: 'missing_recorded_abjad',
    };
  }

  return {
    value: null,
    source: null,
    missingHint: missingHintForSelfField(field, normalized),
    lookupKeys,
    matchedKey,
    foundField: null,
    fallbackReason: `missing_${field}`,
    normalizedSnapshot: {
      birthDate: normalized.birthDate,
      birthTime: normalized.birthTime,
      birthPlace: normalized.birthPlace,
      hasZodiac: Boolean(normalized.zodiac),
      hasRising: Boolean(normalized.rising),
    },
  };
}

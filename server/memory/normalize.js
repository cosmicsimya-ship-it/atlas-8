// ═══════════════════════════════════════════════════════════════════════
// Memory V2 — canonical keys + typed normalization (deterministic)
// No LLM extraction. Explicit saves + known profile/preference patterns.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Canonical key aliases → canonical key
 * @type {Array<{ key: string, aliases: RegExp[], type?: string }>}
 */
const CANONICAL_SPECS = [
  {
    key: 'profile.name',
    type: 'profile',
    aliases: [/\b(adım|adim|ismim|preferred\s*name|ad)\b/i],
  },
  {
    key: 'profile.birthDate',
    type: 'profile',
    aliases: [/\b(doğum\s*tarih|dogum\s*tarih|birthday|birth\s*date)\b/i],
  },
  {
    key: 'profile.birthTime',
    type: 'profile',
    aliases: [/\b(doğum\s*saat|dogum\s*saat|birth\s*time)\b/i],
  },
  {
    key: 'profile.birthPlace',
    type: 'profile',
    aliases: [/\b(doğum\s*yer|dogum\s*yer|birth\s*place|birthplace)\b/i],
  },
  {
    key: 'profile.timezone',
    type: 'profile',
    aliases: [/\b(saat\s*dilim|zaman\s*dilim|timezone)\b/i],
  },
  {
    key: 'profile.location',
    type: 'profile',
    aliases: [/\b(konum|bulunduğum\s*yer|bulundugum\s*yer|location|şehir|sehir|yaşıyorum|yasiyorum)\b/i],
  },
  {
    key: 'profile.relationshipStatus',
    type: 'profile',
    aliases: [/\b(ilişki\s*durum|iliski\s*durum|medeni\s*hal|relationship)\b/i],
  },
  {
    key: 'preferences.preferredName',
    type: 'preference',
    aliases: [/\b(preferred\s*name|hitap)\b/i],
  },
  {
    key: 'preferences.preferredLanguage',
    type: 'preference',
    aliases: [/\b(preferred\s*language|yanıt\s*dil|cevap\s*dil|türkçe\s*konuş|ingilizce\s*konuş)\b/i],
  },
  {
    key: 'preferences.responseStyle',
    type: 'preference',
    aliases: [/\b(response\s*style|yanıt\s*tarz|kısa\s*yanıt|detaylı\s*yanıt|cevap\s*tercih)\b/i],
  },
  {
    key: 'preferences.favoriteSymbolicSystems',
    type: 'preference',
    aliases: [/\b(favori\s*sembolik|sevdiğim\s*sistem|tercih\s*ettiğim\s*sistem)\b/i],
  },
  {
    key: 'preference.favorite_color',
    type: 'preference',
    aliases: [
      /\b(favori\s*renk|en\s*sevdiğim\s*renk|en\s*sevdigim\s*renk|favourite\s*colou?r|favorite\s*colou?r)\b/i,
      /\brengim\b/i,
    ],
  },
  {
    key: 'preference.coffee.sugar',
    type: 'habit',
    aliases: [
      /\bkahve.{0,40}şeker/i,
      /\bkahve.{0,40}seker/i,
      /\bşeker.{0,40}kahve/i,
      /\bseker.{0,40}kahve/i,
      /\b(şekersiz|sekersiz|şekerli|sekerli)\b/i,
      /\bcoffee.{0,30}sugar/i,
      /\bsugar.{0,30}coffee/i,
    ],
  },
  {
    key: 'preference.coffee.milk',
    type: 'habit',
    aliases: [/\bkahve.{0,40}(süt|sut|milk)/i, /\b(süt|sut|milk).{0,40}kahve/i],
  },
  {
    key: 'preference.diet.vegan',
    type: 'preference',
    aliases: [/\bvegan\b/i, /\bvejetaryen\b/i, /\bvegetarian\b/i],
  },
  {
    key: 'habit.morning_meetings',
    type: 'habit',
    aliases: [/\bsabah.{0,30}(toplantı|toplanti|meeting)/i, /\bearly\s*meeting/i],
  },
  {
    key: 'facts.zodiac',
    type: 'fact',
    aliases: [/\b(burç|burc|zodiac)\b/i],
  },
];

const PAST_TEMPORAL_RE =
  /\b(eskiden|geçmişte|gecmiste|used\s+to|önceden|onceden|bir\s+zamanlar|geçen\s+yıl|gecen\s+yil)\b/i;

const UPDATE_TEMPORAL_RE =
  /\b(artık|artik|bundan\s+sonra|değiştirdim|degistirdim|taşındım|tasindim|bıraktım|biraktim|başladım|basladim|artık\s+değil|artik\s+degil)\b/i;

/** Temporary / one-off — must not supersede durable preferences */
const TEMPORARY_STATE_RE =
  /\b(bu\s+hafta|bugün|bugun|geçici(\s+olarak)?|gecici(\s+olarak)?|misafir(likte)?|bazen|nadiren|bir\s+kere|tonight|this\s+week|\btoday\b|şu\s+anlık|su\s+anlik|şimdilik|simdi lik)\b/i;

/**
 * @param {string} text
 */
export function foldMemoryText(text) {
  return String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} text
 * @returns {'past'|'update'|'temporary'|'current'}
 */
export function detectTemporalMode(text) {
  const t = String(text ?? '');
  if (TEMPORARY_STATE_RE.test(t) && !UPDATE_TEMPORAL_RE.test(t)) {
    return 'temporary';
  }
  if (PAST_TEMPORAL_RE.test(t) && !UPDATE_TEMPORAL_RE.test(t)) {
    return 'past';
  }
  if (UPDATE_TEMPORAL_RE.test(t)) {
    return 'update';
  }
  return 'current';
}

/**
 * One-off exception — do not supersede durable preference keys.
 * @param {string} text
 * @param {string|null} [key]
 */
export function isNonSupersedingException(text, key) {
  const t = String(text ?? '');
  if (TEMPORARY_STATE_RE.test(t) && !UPDATE_TEMPORAL_RE.test(t)) return true;
  if (
    key === 'preference.coffee.sugar' &&
    /\b(içtim|ictim|içtik|misafir)\b/i.test(t) &&
    !UPDATE_TEMPORAL_RE.test(t)
  ) {
    return true;
  }
  if (
    key === 'preference.diet.vegan' &&
    /\b(yemek\s+istemiyorum|bugün|bugun|bu\s+akşam|bu\s+aksam)\b/i.test(t) &&
    !/\b(artık|artik|değilim|degilim|bıraktım|biraktim)\b/i.test(t)
  ) {
    return true;
  }
  if (
    key === 'profile.location' &&
    /\b(bu\s+hafta|bugün|bugun|geçici|gecici|ziyaret|tatilde)\b/i.test(t) &&
    !/\b(taşındım|tasindim|artık.{0,12}yaşıyorum|artik.{0,12}yasiyorum)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

/**
 * Resolve alias phrase / field name to canonical key.
 * @param {string} input
 * @returns {string|null}
 */
export function resolveCanonicalKey(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  // Already canonical dotted form
  if (
    /^(profile|preferences|preference|habit|facts|goal|person)\.[a-z0-9_.]+$/i.test(raw)
  ) {
    return raw.replace(/^preferences\./, (m) =>
      raw.startsWith('preferences.') ? 'preferences.' : m,
    );
  }

  // Legacy preference keys
  const prefMap = {
    preferredName: 'preferences.preferredName',
    preferredLanguage: 'preferences.preferredLanguage',
    responseStyle: 'preferences.responseStyle',
    addressStyle: 'preferences.addressStyle',
    favoriteSymbolicSystems: 'preferences.favoriteSymbolicSystems',
    memoryEnabled: 'preferences.memoryEnabled',
  };
  if (prefMap[raw]) return prefMap[raw];

  const profileFields = [
    'name',
    'timezone',
    'location',
    'birthDate',
    'birthTime',
    'birthPlace',
    'referenceDate',
    'relationshipStatus',
  ];
  if (profileFields.includes(raw)) return `profile.${raw}`;

  const folded = foldMemoryText(raw);
  for (const spec of CANONICAL_SPECS) {
    if (spec.key === folded || foldMemoryText(spec.key) === folded) return spec.key;
    if (spec.aliases.some((re) => re.test(raw) || re.test(folded))) return spec.key;
  }
  return null;
}

/**
 * Parse structured value for known keys from free-form Turkish/English text.
 * @param {string} key
 * @param {string} text
 * @returns {unknown}
 */
export function extractValueForKey(key, text) {
  const t = String(text ?? '');
  const folded = foldMemoryText(t);
  const has = (re) => re.test(t) || re.test(folded);

  if (key === 'preference.coffee.sugar') {
    if (
      has(/(şekersiz|sekersiz|şekeri\s*bırak|sekeri\s*birak|without\s*sugar|no\s*sugar|sugar\s*free)/iu)
    ) {
      return false;
    }
    if (has(/(şekerli|sekerli|şekeri?\s*koy|with\s*sugar|şeker\s*kullan)/iu)) {
      return true;
    }
    if (has(/(şekeri?\s*bıraktım|sekeri?\s*biraktim|şekeri\s*kaldırdım)/iu)) {
      return false;
    }
    return null;
  }

  if (key === 'preference.coffee.milk') {
    if (has(/(sütsüz|sutsuz|without\s*milk|no\s*milk)/iu)) return false;
    if (has(/(süt|sut|milk)/iu)) return true;
    return null;
  }

  if (key === 'preference.diet.vegan') {
    if (has(/(artık\s+)?vegan\s+değil|artik\s+vegan\s+degil|not\s+vegan|vegan\s+değilim|vegan\s+degilim/iu)) {
      return false;
    }
    if (has(/vegan/iu)) return true;
    if (has(/(vejetaryen|vegetarian)/iu)) return 'vegetarian';
    return null;
  }

  if (key === 'preference.favorite_color') {
    const m = t.match(
      /(?:renk(?:im)?|colou?r)\s*(?:olan|:)?\s*([\p{L}]{2,20})/iu,
    );
    if (m?.[1]) return foldMemoryText(m[1]);
    const known = folded.match(
      /\b(siyah|beyaz|kırmızı|kirmizi|mavi|yeşil|yesil|sarı|sari|mor|turuncu|pembe|gri|black|white|red|blue|green|yellow|purple|orange|pink|gray|grey)\b/i,
    );
    return known ? foldMemoryText(known[1]) : null;
  }

  if (key === 'preferences.preferredLanguage') {
    if (/türkçe|turkish|\btr\b/i.test(t)) return 'tr';
    if (/ingilizce|english|\ben\b/i.test(t)) return 'en';
    return null;
  }

  if (key === 'preferences.responseStyle') {
    if (/\b(kısa|özet|short|concise)\b/i.test(t)) return 'short';
    if (/\b(detaylı|uzun|detailed|verbose)\b/i.test(t)) return 'detailed';
    return null;
  }

  if (key === 'habit.morning_meetings') {
    if (/\b(nefret|sevmiyorum|istemiyorum|hate|dislike)\b/i.test(t)) return 'dislike_early';
    return 'mentioned';
  }

  return null;
}

/**
 * Human-readable text for a structured memory.
 * @param {string} key
 * @param {unknown} value
 * @param {string} [fallbackText]
 */
export function formatMemoryText(key, value, fallbackText = '') {
  if (key === 'preference.coffee.sugar') {
    return value === false
      ? 'Kahvesini şekersiz içer.'
      : value === true
        ? 'Kahvesini şekerli içer.'
        : fallbackText || 'Kahve şeker tercihi kaydedildi.';
  }
  if (key === 'preference.coffee.milk') {
    return value === true
      ? 'Kahvesine süt koyar.'
      : value === false
        ? 'Kahvesini sütsüz içer.'
        : fallbackText;
  }
  if (key === 'preference.diet.vegan') {
    if (value === false) return 'Vegan değil.';
    if (value === true) return 'Vegan.';
    if (value === 'vegetarian') return 'Vejetaryen.';
  }
  if (key === 'preference.favorite_color' && value) {
    return `En sevdiği renk: ${value}.`;
  }
  if (key?.startsWith('profile.') && value != null) {
    return `${key.replace('profile.', '')}: ${value}`;
  }
  if (key?.startsWith('preferences.') && value != null) {
    return `${key.replace('preferences.', '')}: ${value}`;
  }
  return fallbackText || String(value ?? '');
}

/**
 * @param {{
 *   kind: 'profile'|'preference'|'fact'|'forget-name'|'forget-fact',
 *   field?: string,
 *   key?: string,
 *   value?: string|null,
 * }} entity
 * @param {string} rawMessage
 * @returns {{
 *   type: string,
 *   key: string|null,
 *   value: unknown,
 *   text: string,
 *   temporal: 'past'|'update'|'current',
 *   importance: number,
 *   skipWrite?: boolean,
 *   skipReason?: string,
 * }|null}
 */
export function normalizeEntityToMemory(entity, rawMessage) {
  if (!entity) return null;
  const temporal = detectTemporalMode(rawMessage);

  if (entity.kind === 'profile' && entity.field) {
    const key = `profile.${entity.field}`;
    if (temporal === 'past' || isNonSupersedingException(rawMessage, key)) {
      return {
        type: 'episodic',
        key,
        value: entity.value,
        text: formatMemoryText(key, entity.value, String(entity.value)),
        temporal: temporal === 'past' ? 'past' : 'temporary',
        importance: 0.25,
        skipWrite: true,
        skipReason:
          temporal === 'past'
            ? 'past_temporal_not_current_preference'
            : 'temporary_state_not_durable_preference',
      };
    }
    return {
      type: 'profile',
      key,
      value: entity.value,
      text: formatMemoryText(key, entity.value, String(entity.value)),
      temporal,
      importance: 0.9,
    };
  }

  if (entity.kind === 'preference' && entity.key) {
    const key = resolveCanonicalKey(entity.key) || `preferences.${entity.key}`;
    if (temporal === 'past' || isNonSupersedingException(rawMessage, key)) {
      return {
        type: 'episodic',
        key,
        value: entity.value,
        text: formatMemoryText(key, entity.value, String(entity.value)),
        temporal: temporal === 'past' ? 'past' : 'temporary',
        importance: 0.25,
        skipWrite: true,
        skipReason:
          temporal === 'past'
            ? 'past_temporal_not_current_preference'
            : 'temporary_state_not_durable_preference',
      };
    }
    return {
      type: 'preference',
      key,
      value: entity.value,
      text: formatMemoryText(key, entity.value, String(entity.value)),
      temporal,
      importance: 0.75,
    };
  }

  if (entity.kind === 'fact' && entity.value) {
    const text = String(entity.value).trim();
    const key = resolveCanonicalKey(text) || inferKeyFromFactText(text);
    if (temporal === 'past' || isNonSupersedingException(rawMessage, key) || isNonSupersedingException(text, key)) {
      return {
        type: 'episodic',
        key,
        value: key ? extractValueForKey(key, text) : text,
        text,
        temporal: temporal === 'past' ? 'past' : 'temporary',
        importance: 0.2,
        skipWrite: true,
        skipReason:
          temporal === 'past'
            ? 'past_temporal_not_current_preference'
            : 'temporary_state_not_durable_preference',
      };
    }

    if (key) {
      const value = extractValueForKey(key, text);
      const type =
        CANONICAL_SPECS.find((s) => s.key === key)?.type ||
        (key.startsWith('habit.') ? 'habit' : 'preference');
      return {
        type,
        key,
        value: value !== null && value !== undefined ? value : text,
        text: formatMemoryText(key, value !== null && value !== undefined ? value : text, text),
        temporal,
        importance: 0.7,
      };
    }

    return {
      type: 'fact',
      key: null,
      value: text,
      text,
      temporal,
      importance: 0.45,
    };
  }

  return null;
}

/**
 * @param {string} text
 */
function inferKeyFromFactText(text) {
  for (const spec of CANONICAL_SPECS) {
    if (spec.aliases.some((re) => re.test(text))) return spec.key;
  }
  return null;
}

/**
 * Normalize a legacy facts map entry (migration).
 * @param {string} factKey
 * @param {unknown} factValue
 */
export function normalizeLegacyFact(factKey, factValue) {
  const text = typeof factValue === 'string' ? factValue : JSON.stringify(factValue);
  if (factKey === 'zodiac') {
    return {
      type: 'fact',
      key: 'facts.zodiac',
      value: factValue,
      text: `Burç: ${factValue}`,
      importance: 0.6,
    };
  }
  // Dual-write / export may already store canonical keys inside facts.
  if (
    /^(preference|habit|profile|preferences|facts)\./.test(factKey) ||
    factKey.startsWith('preference.')
  ) {
    const type =
      CANONICAL_SPECS.find((s) => s.key === factKey)?.type ||
      (factKey.startsWith('habit.')
        ? 'habit'
        : factKey.startsWith('profile.')
          ? 'profile'
          : factKey.startsWith('preferences.')
            ? 'preference'
            : 'fact');
    return {
      type,
      key: factKey,
      value: factValue,
      text:
        typeof factValue === 'string' && factValue.length > 2
          ? factValue
          : formatMemoryText(factKey, factValue, text),
      importance: 0.55,
    };
  }
  const inferred = inferKeyFromFactText(text);
  if (inferred) {
    const value = extractValueForKey(inferred, text);
    return {
      type: CANONICAL_SPECS.find((s) => s.key === inferred)?.type || 'fact',
      key: inferred,
      value: value ?? factValue,
      text: formatMemoryText(inferred, value ?? factValue, text),
      importance: 0.55,
    };
  }
  return {
    type: 'fact',
    key: factKey.startsWith('note_') ? null : `facts.${factKey}`,
    value: factValue,
    text,
    importance: 0.4,
  };
}

export { CANONICAL_SPECS };

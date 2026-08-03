// ═══════════════════════════════════════════════════════════════════════
// Astrology / symbolic daily analysis flow
// Clarification-first intents + verified data injection for Web + Telegram
// ═══════════════════════════════════════════════════════════════════════

import { buildSymbolicCalendarContext, formatCalendarDataBlock } from './atlas-symbolic-calendar.js';
import { buildEphemerisSnapshot, formatEphemerisDataBlock, DEFAULT_SKY_LOCATION } from './atlas-ephemeris.js';
import { formatNumerologyDataBlock, numerologyDayNumber } from './atlas-numerology.js';
import { getUserMemory } from './user-memory.js';
import {
  calculateNatalFromMemory,
  detectNatalChartIntent,
  formatNatalDataBlock,
  formatNatalSummaryLines,
} from './natal-engine/index.js';

export const ASTROLOGY_FLOW_VERSION = 'atlas-astrology-flow-v2';

export const CLARIFY_ANALYSIS_TYPE_REPLY = [
  'Tabii. Hangisini inceleyelim?',
  '',
  '• Genel gökyüzü etkisi',
  '• Doğum haritana özel transitler',
  '• İlişki haritası',
  '• Belirli bir yaşam alanı (ilişki, iş, para, sağlık…)',
  '',
  'İstersen Hicri takvim ve numerolojik katmanı da analize ekleyebilirim.',
].join('\n');

export const ASK_BIRTH_DATA_REPLY =
  'Doğum tarihini, mümkünse kesin saatini ve doğum yerini paylaşır mısın?';

export const ASK_BIRTH_PLACE_FOR_HOUSES_REPLY =
  'Doğum haritasını güvenilir biçimde hesaplayabilmem için doğum yerini de belirtmelisin.';

export const ASK_BIRTH_TIME_FOR_ASC_REPLY =
  'Yükselen ve evler için kesin doğum saati gerekir; saat bilinmeden tahmin etmem. Doğum saatini paylaşır mısın?';

export const CLARIFY_RELATIONSHIP_REPLY =
  'İki doğum haritasının genel uyumunu mu, yoksa bugünkü gökyüzünün ilişkinize etkisini mi inceleyelim? İki kişi için doğum tarihi, mümkünse saat ve yer de gerekli.';

export const FATE_REFUSAL_REPLY =
  'Kesin bir felaket veya kaçınılmaz olay söyleyemem. Astroloji burada sembolik bir çerçevedir; korkutucu kader dili kullanmam. İstersen günün genel atmosferini veya belirli bir alanı sakin bir dille inceleyebiliriz.';

/**
 * @typedef {'clarify_type'|'general_daily'|'personal_transit'|'relationship_clarify'|'relationship_needs_data'|'topic_focused'|'multi_layer_daily'|'fate_refusal'|'natal_chart'|'unknown'|null} AstrologyFlowIntent
 */

const ASTRO_DOMAIN =
  /astroloj|burç|gökyüz|transit|harita|natal|sinastri|numeroloj|hicr|kozmik|cosmic|günlük analiz|günün etkisi/;

const ANALYSIS_ASK = /analiz|yorum|etki|incele|anlat|bakar mısın|yapar mısın|değerlendir/;

function normalizeTr(text) {
  return String(text ?? '').toLocaleLowerCase('tr-TR');
}

/**
 * @param {string} message
 * @param {{ role: string, content: string }[]} [history]
 */
export function detectAstrologyFlowIntent(message, history = []) {
  const text = String(message ?? '').trim();
  if (!text) return null;
  const lower = normalizeTr(text);

  if (/kesin (kötü|felaket|başıma gelecek)|kaçınılmaz|bugün kesin/.test(lower)) {
    if (ASTRO_DOMAIN.test(lower) || /olacak mı|başıma/.test(lower)) {
      return 'fate_refusal';
    }
  }

  const natalIntent = detectNatalChartIntent(text);
  if (natalIntent === 'natal_chart' || natalIntent === 'natal_ascendant') {
    return 'natal_chart';
  }

  const pendingClarify = hasAssistantClarify(history);

  // Follow-ups after clarification
  if (pendingClarify || isAstrologyFollowUp(lower)) {
    if (/genel|gökyüz|kolektif/.test(lower) && !/haritam|doğum|ilişki/.test(lower)) {
      if (/hicr|numerol/.test(lower) || /hepsini|sentez|birlikte/.test(lower)) {
        return 'multi_layer_daily';
      }
      return 'general_daily';
    }
    if (/haritam|natal|doğum harita|bana özel|kişisel transit|benim haritam/.test(lower)) {
      return 'personal_transit';
    }
    if (/ilişki|sinastri|partner|eşim|sevgili/.test(lower)) {
      if (/uyum|birleşik|composite|transit.*ilişki|ilişki.*transit/.test(lower)) {
        return 'relationship_needs_data';
      }
      return 'relationship_clarify';
    }
    if (/\biş\b|para|sağlık|ruhsal|karar/.test(lower)) {
      return 'topic_focused';
    }
  }

  // Explicit multi-layer
  if (/astroloj/.test(lower) && /numerol/.test(lower) && /hicr/.test(lower)) {
    return 'multi_layer_daily';
  }

  if (/hicr/.test(lower) && /(astroloj|numerol|gün)/.test(lower) && ANALYSIS_ASK.test(lower)) {
    return 'multi_layer_daily';
  }

  // Explicit general sky
  if (/genel (gökyüz|etki|analiz)/.test(lower) || /gökyüzünü (anlat|analiz)/.test(lower)) {
    return 'general_daily';
  }

  // Personal chart effect
  if (/haritama etkisi|doğum haritama|bana özel transit|natal.*(etki|analiz)/.test(lower)) {
    return 'personal_transit';
  }

  // Relationship (include ilişkimize / ilişkiye)
  if (
    /ilişki(m|miz|niz)?e?\s*etkisi|ilişkimize|ilişkiye etkisi|sinastri|ilişki analizi|ilişkimizin/.test(
      lower,
    )
  ) {
    return 'relationship_clarify';
  }

  // Ambiguous astrology / daily analysis ask → clarify
  if (ASTRO_DOMAIN.test(lower) && ANALYSIS_ASK.test(lower)) {
    if (/genel/.test(lower) && (/hicr|numerol/.test(lower))) return 'multi_layer_daily';
    if (/genel/.test(lower)) return 'general_daily';
    return 'clarify_type';
  }

  if (/bugün.*(astroloj|burç|gökyüz|numerol|hicr)/.test(lower) && ANALYSIS_ASK.test(lower)) {
    return 'clarify_type';
  }

  if (/günlük (astroloj|analiz|yorum)/.test(lower)) {
    return 'clarify_type';
  }

  return null;
}

function hasAssistantClarify(history) {
  return (history ?? [])
    .slice(-4)
    .some(
      (t) =>
        t.role === 'assistant' &&
        /genel gökyüz|doğum haritana özel|belirli bir alan/i.test(normalizeTr(t.content ?? '')),
    );
}

function isAstrologyFollowUp(lowerText) {
  return /^(genel|haritam|doğum|ilişki|iş|para|sağlık|ruhsal|karar|kısa|detaylı)/.test(lowerText.trim());
}

/**
 * @param {{
 *   message: string,
 *   history?: { role: string, content: string }[],
 *   userId?: string,
 * }} input
 * @returns {{ intent: string, reply: string, engine: string, data?: object } | null}
 */
export function tryAstrologyFlowReply(input) {
  const intent = detectAstrologyFlowIntent(input.message, input.history ?? []);
  if (!intent) return null;

  if (intent === 'fate_refusal') {
    return { intent, reply: FATE_REFUSAL_REPLY, engine: 'astrology-flow' };
  }

  if (intent === 'clarify_type') {
    return { intent, reply: CLARIFY_ANALYSIS_TYPE_REPLY, engine: 'astrology-flow' };
  }

  if (intent === 'relationship_clarify') {
    return { intent, reply: CLARIFY_RELATIONSHIP_REPLY, engine: 'astrology-flow' };
  }

  if (intent === 'natal_chart') {
    const natal = tryNatalChartDeterministicReply(input);
    if (natal) return natal;
    // Has enough data → LLM interprets verified natal block (caller injects context)
    return null;
  }

  if (intent === 'personal_transit') {
    const missing = getMissingBirthFields(input.userId);
    if (missing.length) {
      return {
        intent,
        reply: ASK_BIRTH_DATA_REPLY,
        engine: 'astrology-flow',
        data: { missingBirthFields: missing },
      };
    }
    // Has data → let LLM proceed with injected context (caller)
    return null;
  }

  if (intent === 'relationship_needs_data') {
    return {
      intent,
      reply:
        'İlişki analizi için iki kişinin doğum tarihlerini, mümkünse saatlerini, doğum yerlerini ve incelenmek istenen ilişki konusunu paylaşır mısın?',
      engine: 'astrology-flow',
    };
  }

  if (intent === 'topic_focused') {
    // If topic chosen but no chart preference, ask lightly only when natal implied
    if (/haritam|bana [oö]zel|transit/i.test(input.message)) {
      const missing = getMissingBirthFields(input.userId);
      if (missing.length) {
        return { intent, reply: ASK_BIRTH_DATA_REPLY, engine: 'astrology-flow', data: { missingBirthFields: missing } };
      }
    }
    return null;
  }

  // general_daily / multi_layer_daily → LLM with data
  return null;
}

/**
 * Deterministic natal chart short-circuit when calculation fails or data incomplete.
 * On success returns null so LLM can interpret the verified block.
 * @param {{ message: string, userId?: string }} input
 */
function tryNatalChartDeterministicReply(input) {
  const missing = getMissingBirthFields(input.userId);
  if (missing.includes('birthDate') || missing.includes('birthPlace')) {
    return {
      intent: 'natal_chart',
      reply: ASK_BIRTH_DATA_REPLY,
      engine: 'natal-engine',
      data: { missingBirthFields: missing },
    };
  }

  const memory = input.userId && input.userId !== 'web:anonymous' ? getUserMemory(input.userId) : null;
  const wantsAsc =
    /yükselen|ascendant|rising|evler|mc|midheaven/i.test(input.message || '') ||
    detectNatalChartIntent(input.message) === 'natal_ascendant';

  if (wantsAsc && !memory?.profile?.birthTime) {
    return {
      intent: 'natal_chart',
      reply: ASK_BIRTH_TIME_FOR_ASC_REPLY,
      engine: 'natal-engine',
      data: { missingBirthFields: ['birthTime'] },
    };
  }

  const chart = calculateNatalFromMemory(input.userId);
  if (!chart.ok) {
    if (chart.errorCode === 'AMBIGUOUS_BIRTH_PLACE') {
      const names = (chart.meta?.candidates || []).map((c) => c.displayName).filter(Boolean);
      return {
        intent: 'natal_chart',
        reply: names.length
          ? `Bu isimde birden fazla konum var: ${names.join('; ')}. Hangisini kullanayım?`
          : ASK_BIRTH_PLACE_FOR_HOUSES_REPLY,
        engine: 'natal-engine',
        data: { errorCode: chart.errorCode, candidates: chart.meta?.candidates },
      };
    }
    if (chart.errorCode === 'BIRTH_PLACE_REQUIRED' || chart.errorCode === 'LOCATION_RESOLUTION_FAILED') {
      return {
        intent: 'natal_chart',
        reply: ASK_BIRTH_PLACE_FOR_HOUSES_REPLY,
        engine: 'natal-engine',
        data: { errorCode: chart.errorCode },
      };
    }
    return {
      intent: 'natal_chart',
      reply: chart.message || ASK_BIRTH_DATA_REPLY,
      engine: 'natal-engine',
      data: { errorCode: chart.errorCode },
    };
  }

  // Pure calculation ask without "yorum/analiz" → return verified numbers only
  const lower = normalizeTr(input.message || '');
  if (
    /hesapla|kaç|nedir|göster|çıkar/.test(lower) &&
    !/yorum|analiz|anlat|ne anlama/.test(lower)
  ) {
    const lines = formatNatalSummaryLines(chart);
    const note = chart.dataQuality.fullChartAvailable
      ? ''
      : '\n\nNot: Tam yükselen/ev hesabı için eksik veri vardı; yalnızca güvenilir hesaplanan noktalar gösterildi.';
    return {
      intent: 'natal_chart',
      reply: ['Doğum haritan (hesaplanan):', ...lines].join('\n') + note,
      engine: 'natal-engine',
      data: {
        natal: {
          analysisId: chart.analysisId,
          fullChartAvailable: chart.dataQuality.fullChartAvailable,
          methodologyId: chart.methodology.methodologyId,
        },
      },
    };
  }

  return null;
}

function getMissingBirthFields(userId) {
  if (!userId || userId === 'web:anonymous') return ['birthDate', 'birthTime', 'birthPlace'];
  const memory = getUserMemory(userId);
  const missing = [];
  if (!memory?.profile?.birthDate) missing.push('birthDate');
  if (!memory?.profile?.birthPlace) missing.push('birthPlace');
  // birth time optional but preferred — do not block solely on time; ask in reply if missing when proceeding
  return missing.filter((f) => f === 'birthDate' || f === 'birthPlace');
}

/**
 * Build verified data + instruction block for LLM astrology answers.
 * @param {{
 *   message: string,
 *   history?: { role: string, content: string }[],
 *   userId?: string,
 *   when?: Date,
 * }} options
 */
export function buildAstrologyAnalysisContext(options = {}) {
  const intent =
    detectAstrologyFlowIntent(options.message, options.history ?? []) ?? 'general_daily';
  const calendar = buildSymbolicCalendarContext(options.when ?? new Date());
  const sky = buildEphemerisSnapshot({
    when: options.when ?? new Date(),
    locationName: DEFAULT_SKY_LOCATION.name,
    latitude: DEFAULT_SKY_LOCATION.latitude,
    longitude: DEFAULT_SKY_LOCATION.longitude,
    timeZone: DEFAULT_SKY_LOCATION.timeZone,
  });

  let numerologyBlock = '';
  if (calendar.ok) {
    numerologyBlock = formatNumerologyDataBlock(calendar.gregorian);
  }

  const length = detectLengthPreference(options.message);
  const includeHijri = intent === 'multi_layer_daily' || /hicr/i.test(options.message);
  const includeNumerology =
    intent === 'multi_layer_daily' || /numerol/i.test(options.message) || intent === 'general_daily';

  const memory = options.userId && options.userId !== 'web:anonymous' ? getUserMemory(options.userId) : null;
  const birthTimeKnown = Boolean(memory?.profile?.birthTime);

  /** @type {ReturnType<typeof calculateNatalFromMemory>|null} */
  let natalChart = null;
  if (
    (intent === 'personal_transit' || intent === 'natal_chart') &&
    memory?.profile?.birthDate
  ) {
    natalChart = calculateNatalFromMemory(options.userId);
  }

  const structure =
    intent === 'personal_transit' || intent === 'natal_chart'
      ? `Yapı: doğrulanmış natal noktalar (aşağıdaki VERIFIED NATAL bloğu), transitler (ephemeris), etkilenen evler yalnızca natal blokta ev varsa, en güçlü 3 tema, destekleyici/zorlayıcı etkiler, uygulanabilir öneriler. Natal dereceleri yeniden hesaplama veya uydurma.`
      : `Yapı: Miladi+Hicri tarih (istendiyse), Ay fazı/burcu, öne çıkan transitler, genel atmosfer, numeroloji (istendiyse), Hicri ay teması (istendiyse), ortak tema, dikkat alanı, pratik öneri.`;

  const lengthRule =
    length === 'short'
      ? 'Uzunluk: en fazla ~150 kelime (kısa özet).'
      : length === 'detailed'
        ? 'Uzunluk: kapsamlı ama tekrarsız (yaklaşık 500–800 kelime). İlk turda ana tema + yerleşim/açı etkisi + gölge/gerilim + dönemsel bağlam ver; kullanıcıyı zorlatma.'
        : 'Uzunluk: standart 300–500 kelime; kişisel veriler varsa sözlük tanımıyla yetinme; aynı temayı tekrar etme.';

  const natalBlock =
    natalChart != null
      ? formatNatalDataBlock(natalChart)
      : intent === 'personal_transit' || intent === 'natal_chart'
        ? '## VERIFIED NATAL CHART DATA\nUnavailable — do NOT invent Ascendant, houses, or natal degrees.'
        : '';

  return {
    intent,
    length,
    calendar,
    sky,
    natalChart: natalChart?.ok ? natalChart : null,
    numerology: calendar.ok
      ? numerologyDayNumber(calendar.gregorian.year, calendar.gregorian.month, calendar.gregorian.day)
      : null,
    birthTimeKnown,
    locationName: DEFAULT_SKY_LOCATION.name,
    promptBlock: `
## ASTROLOGY FLOW (${ASTROLOGY_FLOW_VERSION})
Intent: ${intent}
${lengthRule}
${structure}

Analiz konumu (gökyüzü/transit varsayılanı): ${DEFAULT_SKY_LOCATION.name}. Farklı şehir istenirse sor.

Üslup:
- İlk paragrafta ana temayı söyle.
- "Destekleyen sistemler / ayrışan noktalar / kör nokta / gerçeklik kontrolü" başlıklarını otomatik üretme; yalnızca gerçekten gerekliyse kullan.
- Kesin olay/kader tahmini yok; tıbbi/hukuki/finansal tavsiye yerine geçmez.
- Sembolik/yorumlayıcı çerçeveyi koru.
- Yükselen, ev, gezegen derecesi veya açı UYDURMA; yalnızca doğrulanmış natal/ephemeris bloklarını kullan.
${!birthTimeKnown && (intent === 'personal_transit' || intent === 'natal_chart') ? '- Doğum saati yok: yükselen ve ev yorumlarının sınırlı olduğunu açıkça söyle; tahmin etme.' : ''}
${natalChart && !natalChart.dataQuality?.fullChartAvailable ? '- Tam natal harita yok: eksik veri nedeniyle yükselen/ev iddiası yasak.' : ''}

${natalBlock}

${formatEphemerisDataBlock(sky)}

${includeHijri || intent === 'multi_layer_daily' || intent === 'general_daily' ? formatCalendarDataBlock(calendar) : formatCalendarDataBlock(calendar)}

${includeNumerology ? numerologyBlock : ''}
`.trim(),
    metadata: {
      astrologyFlowVersion: ASTROLOGY_FLOW_VERSION,
      calendarMethod: calendar.metadata?.method ?? null,
      ephemerisSource: sky.metadata?.source ?? null,
      defaultLocation: DEFAULT_SKY_LOCATION.name,
      natalEngineId: natalChart?.engineId ?? null,
      natalAnalysisId: natalChart?.analysisId ?? null,
      natalFullChart: natalChart?.dataQuality?.fullChartAvailable ?? false,
    },
  };
}

export function detectLengthPreference(message) {
  if (/k[ıi]sa [oö]zet|k[ıi]saca|özetle/i.test(message)) return 'short';
  if (/detayl[ıi]|kapsaml[ıi]|derine|yorumla|kişisel analiz|tam analiz/i.test(message)) {
    return 'detailed';
  }
  // Personal chart / transit asks default to richer first-turn depth
  if (/haritam|natal|bana özel|kişisel transit|doğum harita/i.test(message)) {
    return 'detailed';
  }
  return 'standard';
}

/**
 * Whether this message should use astrology analysis LLM path (with data injection).
 * @param {string|null} intent
 */
export function isAstrologyAnalysisIntent(intent) {
  return (
    intent === 'general_daily' ||
    intent === 'multi_layer_daily' ||
    intent === 'topic_focused' ||
    intent === 'personal_transit' ||
    intent === 'natal_chart'
  );
}

import { calculateNatalChart } from './calculate.js';
import { formatNatalDataBlock, formatNatalSummaryLines } from './format.js';
import { getUserMemory } from '../user-memory.js';

/**
 * Build natal chart from memory profile when available.
 * @param {string} userId
 * @param {object} [overrides]
 */
export function calculateNatalFromMemory(userId, overrides = {}) {
  if (!userId || userId === 'web:anonymous') {
    return calculateNatalChart(overrides);
  }
  const memory = getUserMemory(userId);
  const profile = memory?.profile || {};
  return calculateNatalChart({
    birthDate: overrides.birthDate ?? profile.birthDate,
    birthTime: overrides.birthTime ?? profile.birthTime,
    birthPlace: overrides.birthPlace ?? profile.birthPlace,
    timezone: overrides.timezone ?? profile.timezone,
    latitude: overrides.latitude,
    longitude: overrides.longitude,
    houseSystem: overrides.houseSystem,
    zodiacSystem: overrides.zodiacSystem,
    subjectId: overrides.subjectId || 'self',
    memoryMeta: {
      source: profile.birthDate ? 'verified_user_profile' : 'request',
      confidence: profile.birthDate && profile.birthPlace ? 'high' : 'medium',
    },
    ...overrides,
  });
}

/**
 * Prompt adapter: structured calc → LLM interpretation context only.
 * @param {{
 *   message?: string,
 *   userId?: string,
 *   birthDate?: string,
 *   birthTime?: string,
 *   birthPlace?: string,
 *   houseSystem?: string,
 * }} opts
 */
export function buildNatalInterpretationContext(opts = {}) {
  const result = calculateNatalFromMemory(opts.userId, {
    birthDate: opts.birthDate,
    birthTime: opts.birthTime,
    birthPlace: opts.birthPlace,
    houseSystem: opts.houseSystem,
  });

  const summaryLines = formatNatalSummaryLines(result);
  return {
    result,
    summaryLines,
    promptBlock: formatNatalDataBlock(result),
    interpretationOrder: [
      'Sun / Moon / Ascendant (when available)',
      'Chart ruler',
      'Element and modality balance',
      'Personal planets',
      'Social and generational planets',
      'House emphasis',
      'Major aspects',
      'Strong patterns',
      'Tensions / contradictions',
      'Overall synthesis',
    ],
  };
}

/**
 * Detect natal chart calculation intent (distinct from general daily astrology).
 * @param {string} message
 */
export function detectNatalChartIntent(message) {
  const lower = String(message ?? '').toLocaleLowerCase('tr-TR');
  if (!lower.trim()) return null;
  if (
    /doğum haritam|natal harita|haritamı (hesapla|çıkar|göster)|yükselenim|yükselen burcum|evlerim|midheaven|mc['’]?m|doğum haritası/.test(
      lower,
    )
  ) {
    return 'natal_chart';
  }
  if (/yükselen|ascendant|rising/.test(lower) && /(ne|nedir|kaç|burc|hesap)/.test(lower)) {
    return 'natal_ascendant';
  }
  return null;
}

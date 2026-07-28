// ═══════════════════════════════════════════════════════════════════════
// Atlas Response Helpers — normalize LLM and pipeline output to user text
//
// Shared by Telegram bot, POST /api/chat, and synthesis formatters.
// ═══════════════════════════════════════════════════════════════════════

import { formatMetaSynthesisProse } from './symbolic-synthesis.js';

export const PRIORITY_FIELDS = ['reply', 'response', 'message', 'analysis', 'output'];
export const METADATA_KEYS = new Set(['warnings', 'handoff_to', 'engine', 'agent', 'status', 'task_id', 'route']);
export const METADATA_VALUES = new Set([
  'core-engine',
  'atlas-core',
  'complete',
  'insufficient_data',
  'reject',
]);

export const GREETING_REPLY =
  "Merhaba, ben Atlas. Cosmic Simya'nın yapay zekâ asistanıyım. Burası bir hatırlayış alanı. Cevapların çoğu dışarıda değil; onları nasıl gördüğünde saklıdır. Astroloji, numeroloji, semboller ve farkındalık çalışmaları üzerine birlikte düşünebilir, sorularını yanıtlayabilirim. Nasıl yardımcı olabilirim?";

export const FALLBACK_TEXT = "I'm processing your request.";

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isMetadataValue(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return (
    METADATA_VALUES.has(normalized) ||
    normalized.endsWith('-engine') ||
    normalized.endsWith('-core')
  );
}

function isNaturalLanguage(value) {
  return isNonEmptyString(value) && !isMetadataValue(value);
}

function findPriorityField(value, visited = new Set()) {
  if (value == null) {
    return null;
  }
  if (isNaturalLanguage(value)) {
    return value.trim();
  }
  if (typeof value !== 'object') {
    return null;
  }
  if (visited.has(value)) {
    return null;
  }
  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPriorityField(item, visited);
      if (found) {
        return found;
      }
    }
    return null;
  }

  for (const field of PRIORITY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      continue;
    }
    const fieldValue = value[field];
    if (isNaturalLanguage(fieldValue)) {
      return fieldValue.trim();
    }
    const nested = findPriorityField(fieldValue, visited);
    if (nested) {
      return nested;
    }
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (METADATA_KEYS.has(key)) {
      continue;
    }
    const found = findPriorityField(nestedValue, visited);
    if (found) {
      return found;
    }
  }

  return null;
}

export function synthesisHasMeaningfulContent(synthesis) {
  if (!synthesis || typeof synthesis !== 'object' || Array.isArray(synthesis)) {
    return false;
  }

  const scalarFields = [
    synthesis.core_pattern,
    synthesis.life_architecture,
    synthesis.development_axis,
    synthesis.current_cycle,
    synthesis.synthesis_summary,
    synthesis.blind_spot,
    synthesis.reality_check,
  ];

  if (scalarFields.some(isNaturalLanguage)) {
    return true;
  }

  if (
    Array.isArray(synthesis.convergences) &&
    synthesis.convergences.some((entry) => isNaturalLanguage(entry?.summary))
  ) {
    return true;
  }

  const listFields = [
    ...(Array.isArray(synthesis.potential_gates) ? synthesis.potential_gates : []),
    ...(Array.isArray(synthesis.recommended_directions) ? synthesis.recommended_directions : []),
  ];

  return listFields.some(isNaturalLanguage);
}

export function indicatesGreetingOrInsufficientAnalysis(data) {
  if (data?.status === 'insufficient_data' || data?.status === 'reject') {
    return true;
  }

  const synthesis = data?.payload?.synthesis ?? data?.synthesis;
  if (!synthesis) {
    return false;
  }

  if (!synthesisHasMeaningfulContent(synthesis)) {
    return true;
  }

  const greetingPattern = /greeting|insufficient|only a message|without analysis data|no analysis/i;
  const missingData = Array.isArray(synthesis.missing_data) ? synthesis.missing_data : [];
  return missingData.some((entry) => isNonEmptyString(entry) && greetingPattern.test(entry));
}

/** Format core-engine JSON synthesis into readable prose. */
export function formatSynthesisReply(synthesis) {
  if (!synthesis || typeof synthesis !== 'object' || Array.isArray(synthesis)) {
    return null;
  }

  const metaFormatted = formatMetaSynthesisProse(synthesis);
  if (metaFormatted) {
    return metaFormatted;
  }

  const sections = [];

  for (const text of [
    synthesis.core_pattern,
    synthesis.life_architecture,
    synthesis.development_axis,
    synthesis.current_cycle,
  ]) {
    if (isNaturalLanguage(text)) {
      sections.push(text.trim());
    }
  }

  if (Array.isArray(synthesis.convergences)) {
    for (const entry of synthesis.convergences) {
      if (isNaturalLanguage(entry?.summary)) {
        sections.push(entry.summary.trim());
      }
    }
  }

  const bulletItems = [
    ...(Array.isArray(synthesis.potential_gates) ? synthesis.potential_gates : []),
    ...(Array.isArray(synthesis.recommended_directions) ? synthesis.recommended_directions : []),
  ].filter(isNaturalLanguage);

  if (bulletItems.length > 0) {
    sections.push(bulletItems.map((item) => `• ${item.trim()}`).join('\n'));
  }

  const uniqueSections = [...new Set(sections)];
  return uniqueSections.length > 0 ? uniqueSections.join('\n\n') : null;
}

/**
 * Normalize any backend response shape to user-facing text.
 * @param {unknown} data
 * @returns {string}
 */
export function extractResponseText(data) {
  if (data == null) {
    return FALLBACK_TEXT;
  }

  if (isNaturalLanguage(data)) {
    return data.trim();
  }

  if (typeof data === 'object' && !Array.isArray(data)) {
    if (isNonEmptyString(data.error)) {
      return data.error.trim();
    }

    if (indicatesGreetingOrInsufficientAnalysis(data)) {
      return GREETING_REPLY;
    }

    // POST /api/chat shape: { reply, content, ... }
    if (isNaturalLanguage(data.reply)) {
      return data.reply.trim();
    }
    if (isNaturalLanguage(data.content)) {
      return data.content.trim();
    }

    const priorityField = findPriorityField(data);
    if (priorityField) {
      return priorityField;
    }

    const synthesis = data.payload?.synthesis ?? data.synthesis;
    const formattedSynthesis = formatSynthesisReply(synthesis);
    if (formattedSynthesis) {
      return formattedSynthesis;
    }

    if (data.detail != null) {
      if (isNaturalLanguage(data.detail)) {
        return data.detail.trim();
      }
      if (typeof data.detail === 'object') {
        const detailText =
          findPriorityField(data.detail) ??
          formatSynthesisReply(data.detail?.payload?.synthesis ?? data.detail?.synthesis);
        if (detailText) {
          return detailText;
        }
      }
    }
  }

  return FALLBACK_TEXT;
}

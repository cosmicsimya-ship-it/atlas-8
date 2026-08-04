/**
 * Depth resolver — map user language / engine depth → L0–L4.
 */

/** @typedef {'L0'|'L1'|'L2'|'L3'|'L4'} DepthLevel */

const DEPTH_FROM_HINT = Object.freeze({
  L0: 'L0',
  L1: 'L1',
  L2: 'L2',
  L3: 'L3',
  L4: 'L4',
  auto: 'L2',
});

/**
 * Map Turkish/English depth language to L0–L4.
 * @param {string} message
 * @returns {DepthLevel}
 */
export function resolveDepthFromMessage(message) {
  const text = String(message || '').toLocaleLowerCase('tr-TR');

  if (
    /(?:çok\s*derin|çok\s*detay|kapsaml[ıi]\s*analiz|en\s*derin|\bl4\b|very\s+deep|exhaustive)/i.test(
      text,
    )
  ) {
    return 'L4';
  }
  if (
    /(?:detayl[ıi]|ayrıntıl[ıi]|derin|uzun\s*anlat|\bl3\b|detailed|in[-\s]?depth)/i.test(
      text,
    )
  ) {
    return 'L3';
  }
  if (/(?:k[ıi]sa|özet|k[ıi]saca|\bl1\b|brief|short)/i.test(text)) {
    return 'L1';
  }
  if (/(?:tek\s*sat[ıi]r|minimal|\bl0\b)/i.test(text)) {
    return 'L0';
  }
  if (/(?:standart|normal|\bl2\b)/i.test(text)) {
    return 'L2';
  }
  return 'L2';
}

/**
 * @param {{ depthHint?: string, message?: string, engineDepth?: number|null }} input
 * @returns {DepthLevel}
 */
export function resolveDepthLevel(input = {}) {
  const hint = input.depthHint;
  if (hint && hint !== 'auto' && DEPTH_FROM_HINT[hint]) {
    return /** @type {DepthLevel} */ (DEPTH_FROM_HINT[hint]);
  }

  if (typeof input.engineDepth === 'number') {
    if (input.engineDepth <= 1) return 'L1';
    if (input.engineDepth === 2) return 'L2';
    if (input.engineDepth >= 3) return 'L3';
  }

  if (input.message) return resolveDepthFromMessage(input.message);
  return 'L2';
}

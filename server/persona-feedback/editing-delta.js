/**
 * Editing delta analysis — candidate style signals from revise pairs (Phase 2).
 * Single edits never become global persistent rules by themselves.
 */

function tokenize(text) {
  return String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function sentenceCount(text) {
  return String(text ?? '')
    .split(/[.!?…]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function avgWordLen(words) {
  if (!words.length) return 0;
  return words.reduce((a, w) => a + w.length, 0) / words.length;
}

const SOFT_MARKERS = [
  'olabilir',
  'görünüyor',
  'muhtemelen',
  'belki',
  'gibi duruyor',
  'daha dengeli olabilir',
];

const ASSERTIVE_MARKERS = [
  'kurulmuyor',
  'zorlanıyor',
  'açıkça',
  'aslında',
  'net',
  'tok',
];

/**
 * @param {string} originalText
 * @param {string} revisedText
 * @param {object} [context]
 */
export function analyzeEditingDelta(originalText, revisedText, context = {}) {
  const original = String(originalText ?? '').trim();
  const revised = String(revisedText ?? '').trim();
  if (!original || !revised || original === revised) {
    return { signals: [], metrics: null, notes: ['no_delta'] };
  }

  const oWords = tokenize(original);
  const rWords = tokenize(revised);
  const oSent = sentenceCount(original);
  const rSent = sentenceCount(revised);

  const metrics = {
    originalWordCount: oWords.length,
    revisedWordCount: rWords.length,
    lengthDelta: rWords.length - oWords.length,
    originalSentences: oSent,
    revisedSentences: rSent,
    avgWordLenDelta: avgWordLen(rWords) - avgWordLen(oWords),
    softMarkerOriginal: SOFT_MARKERS.filter((m) => original.toLocaleLowerCase('tr-TR').includes(m)).length,
    softMarkerRevised: SOFT_MARKERS.filter((m) => revised.toLocaleLowerCase('tr-TR').includes(m)).length,
    assertiveRevised: ASSERTIVE_MARKERS.filter((m) => revised.toLocaleLowerCase('tr-TR').includes(m)).length,
  };

  /** @type {object[]} */
  const signals = [];
  const scope = { type: 'temporary_session', target: null };

  if (metrics.lengthDelta <= -3) {
    signals.push({
      category: ['length', 'editing_pattern'],
      signal: 'edit: shorter revision',
      normalizedPreference: 'Prefer shorter phrasing than the draft when revising.',
      scope,
      polarity: 'prefer',
      strength: 0.7,
      confidence: 0.65,
      persistence: 'candidate',
      examples: { rejected: [original.slice(0, 120)], preferred: [revised.slice(0, 120)] },
    });
  }

  if (metrics.softMarkerOriginal > metrics.softMarkerRevised) {
    signals.push({
      category: ['tone', 'word_choice', 'editing_pattern'],
      signal: 'edit: reduce soft probability language',
      normalizedPreference: 'Reduce soft hedging (olabilir/muhtemelen); prefer clearer verbs.',
      scope,
      polarity: 'prefer',
      strength: 0.75,
      confidence: 0.7,
      persistence: 'candidate',
      examples: { rejected: [original.slice(0, 120)], preferred: [revised.slice(0, 120)] },
    });
  }

  if (metrics.assertiveRevised > 0 && metrics.softMarkerRevised < metrics.softMarkerOriginal) {
    signals.push({
      category: ['tone', 'sentence_structure', 'editing_pattern'],
      signal: 'edit: more assertive verbs',
      normalizedPreference: 'Prefer assertive, high-impact verbs over soft abstractions.',
      scope,
      polarity: 'prefer',
      strength: 0.75,
      confidence: 0.68,
      persistence: 'candidate',
      examples: { rejected: [original.slice(0, 120)], preferred: [revised.slice(0, 120)] },
    });
  }

  if (rSent > 0 && oSent > 0 && rSent < oSent) {
    signals.push({
      category: ['sentence_structure', 'editing_pattern'],
      signal: 'edit: fewer sentences',
      normalizedPreference: 'Prefer fewer, denser sentences.',
      scope,
      polarity: 'prefer',
      strength: 0.65,
      confidence: 0.6,
      persistence: 'candidate',
      examples: { rejected: [], preferred: [] },
    });
  }

  // Never invent global persistent from a single edit
  for (const s of signals) {
    s.persistence = 'candidate';
    if (s.scope?.type === 'global') s.scope = scope;
  }

  return {
    signals,
    metrics,
    notes: [
      'single_edit_is_candidate_only',
      context?.channel ? `channel:${context.channel}` : null,
    ].filter(Boolean),
  };
}

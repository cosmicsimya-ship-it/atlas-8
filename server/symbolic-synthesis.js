// ═══════════════════════════════════════════════════════════════════════
// Symbolic Synthesis Engine — runtime helpers for Meta Synthesis
//
// Detects analysis modes, builds conversation input, and formats
// structured synthesis output per atlas_meta_synthesis.md section 16.
// ═══════════════════════════════════════════════════════════════════════

/** Prose output sections from atlas_meta_synthesis.md §16 */
export const META_SYNTHESIS_SECTIONS = [
  { key: 'main_theme', label: 'Ana Tema', sources: ['core_pattern'] },
  { key: 'supporting_systems', label: 'Destekleyen Sistemler', sources: ['convergences', 'source_systems'] },
  { key: 'divergences', label: 'Ayrışan Noktalar', sources: ['contradictions'] },
  { key: 'contradiction_meaning', label: 'Çelişkinin Anlamı', sources: ['contradiction_meaning'] },
  { key: 'blind_spot', label: 'Kör Nokta', sources: ['blind_spot'] },
  { key: 'reality_check', label: 'Gerçeklik Kontrolü', sources: ['reality_check'] },
  { key: 'confidence_level', label: 'Güven Seviyesi', sources: ['confidence'] },
  { key: 'synthesis', label: 'Sentez', sources: ['synthesis_summary', 'life_architecture', 'development_axis'] },
];

const META_SYNTHESIS_KEYWORDS = [
  'sentez', 'synthesis', 'kesişim', 'çelişki', 'örüntü', 'pattern',
  'astroloji', 'numeroloji', 'kader matrisi', 'tarot', 'ebced', 'cifir',
  'simya', 'arketip', 'mitoloji', 'harf', 'döngü', 'transit',
  'yaşam yolu', 'burç', 'kart', 'açılım', 'yorumla', 'analiz',
];

const DAILY_GUIDE_KEYWORDS = [
  'günaydın', 'gunaydin', 'bugün', 'bugun', 'günlük', 'gunluk',
  'günün', 'gunun', 'bugün beni', 'bugun beni', 'günlük analiz',
];

const MULTI_SYSTEM_PATTERN = /\b(astroloji|numeroloji|tarot|kader|ebced|cifir|simya|arketip)\b.*\b(astroloji|numeroloji|tarot|kader|ebced|cifir|simya|arketip)\b/i;

/**
 * @typedef {'conversational' | 'meta-synthesis' | 'daily-guide'} AnalysisMode
 */

/**
 * Detect which analysis mode best fits the user message.
 * @param {string} message
 * @returns {AnalysisMode}
 */
export function detectAnalysisMode(message) {
  const text = (message ?? '').toLowerCase().trim();
  if (!text) {
    return 'conversational';
  }

  if (DAILY_GUIDE_KEYWORDS.some((kw) => text.includes(kw))) {
    return 'daily-guide';
  }

  if (MULTI_SYSTEM_PATTERN.test(text)) {
    return 'meta-synthesis';
  }

  const keywordHits = META_SYNTHESIS_KEYWORDS.filter((kw) => text.includes(kw)).length;
  if (keywordHits >= 2) {
    return 'meta-synthesis';
  }

  if (/sentez|kesişim|çelişki|sistemler arası|meta analiz/i.test(text)) {
    return 'meta-synthesis';
  }

  return 'conversational';
}

/**
 * @typedef {{ role: 'user' | 'assistant', content: string }} ChatTurn
 */

/**
 * Build the user prompt with optional conversation history.
 * @param {string} message
 * @param {ChatTurn[]} [history]
 * @param {AnalysisMode} [mode]
 * @returns {string}
 */
export function buildChatUserPrompt(message, history = [], mode = 'conversational') {
  const trimmed = (message ?? '').trim();
  if (!trimmed) {
    return '';
  }

  const parts = [];

  if (history.length > 0) {
    parts.push('## Önceki Konuşma');
    for (const turn of history.slice(-10)) {
      const role = turn.role === 'assistant' ? 'Atlas' : 'Kullanıcı';
      parts.push(`${role}: ${turn.content.trim()}`);
    }
    parts.push('');
  }

  if (mode === 'meta-synthesis') {
    parts.push(
      '## Görev',
      'Aşağıdaki mesajı Meta Sentez ve Sembolik Analiz Motoru ile değerlendir.',
      'Tek sistem yorumu yerine kesişim, çelişki ve güven seviyesi içeren sentez üret.',
      'Yetersiz veri varsa bunu açıkça belirt.',
      '',
      `Kullanıcı: ${trimmed}`,
    );
  } else {
    parts.push(trimmed);
  }

  return parts.join('\n');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function formatConfidence(confidence) {
  if (!confidence) {
    return null;
  }
  if (typeof confidence === 'string') {
    return confidence.trim();
  }
  if (typeof confidence === 'object' && typeof confidence.overall === 'number') {
    const score = confidence.overall;
    if (score >= 0.7) return 'Yüksek güven';
    if (score >= 0.4) return 'Orta güven';
    return 'Düşük güven';
  }
  return null;
}

function formatConvergences(convergences) {
  if (!Array.isArray(convergences) || convergences.length === 0) {
    return null;
  }
  return convergences
    .map((entry) => {
      const systems = Array.isArray(entry.systems) ? entry.systems.join(', ') : '';
      const summary = entry.summary?.trim() ?? '';
      return systems ? `[${systems}] ${summary}` : summary;
    })
    .filter(isNonEmptyString)
    .join('\n');
}

function formatContradictions(contradictions) {
  if (!Array.isArray(contradictions) || contradictions.length === 0) {
    return null;
  }
  return contradictions
    .map((entry) => {
      const topic = entry.topic?.trim() ?? '';
      const positions = Array.isArray(entry.positions)
        ? entry.positions.map((p) => `${p.system}: ${p.claim}`).join(' | ')
        : '';
      return topic ? `${topic} — ${positions}` : positions;
    })
    .filter(isNonEmptyString)
    .join('\n');
}

/**
 * Format structured synthesis (core-engine JSON or compatible shape)
 * using atlas_meta_synthesis.md section 16 headings.
 * @param {Record<string, unknown>} synthesis
 * @returns {string|null}
 */
export function formatMetaSynthesisProse(synthesis) {
  if (!synthesis || typeof synthesis !== 'object') {
    return null;
  }

  const blocks = [];

  const mainTheme = synthesis.core_pattern ?? synthesis.main_theme;
  if (isNonEmptyString(mainTheme)) {
    blocks.push(`**Ana Tema**\n${mainTheme.trim()}`);
  }

  const supporting = formatConvergences(synthesis.convergences);
  if (supporting) {
    blocks.push(`**Destekleyen Sistemler**\n${supporting}`);
  } else if (Array.isArray(synthesis.source_systems) && synthesis.source_systems.length > 0) {
    blocks.push(`**Destekleyen Sistemler**\n${synthesis.source_systems.join(', ')}`);
  }

  const divergences = formatContradictions(synthesis.contradictions);
  if (divergences) {
    blocks.push(`**Ayrışan Noktalar**\n${divergences}`);
  }

  if (isNonEmptyString(synthesis.contradiction_meaning)) {
    blocks.push(`**Çelişkinin Anlamı**\n${synthesis.contradiction_meaning.trim()}`);
  }

  if (isNonEmptyString(synthesis.blind_spot)) {
    blocks.push(`**Kör Nokta**\n${synthesis.blind_spot.trim()}`);
  }

  if (isNonEmptyString(synthesis.reality_check)) {
    blocks.push(`**Gerçeklik Kontrolü**\n${synthesis.reality_check.trim()}`);
  }

  const confidence = formatConfidence(synthesis.confidence ?? synthesis.confidence_level);
  if (confidence) {
    blocks.push(`**Güven Seviyesi**\n${confidence}`);
  }

  const summary =
    synthesis.synthesis_summary ??
    synthesis.life_architecture ??
    synthesis.development_axis;
  if (isNonEmptyString(summary)) {
    blocks.push(`**Sentez**\n${summary.trim()}`);
  }

  return blocks.length > 0 ? blocks.join('\n\n') : null;
}

/**
 * Whether a free-text message likely needs structured personal-analysis pipeline.
 * Reserved for future hybrid routing; conversational meta-synthesis handles most cases.
 * @param {string} message
 * @returns {boolean}
 */
export function shouldRouteToPersonalAnalysis(message) {
  const text = (message ?? '').toLowerCase();
  const hasBirthData = /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(text);
  const wantsStructured = /tam analiz|detaylı sentez|core-engine|yapılandırılmış/i.test(text);
  return hasBirthData && wantsStructured;
}

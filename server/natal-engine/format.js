import { ZODIAC_SIGNS_TR } from './constants.js';

/**
 * Format degree as 7°12′ style.
 * @param {object} pos
 */
export function formatDegreeLabel(pos) {
  if (!pos) return '—';
  const sign = ZODIAC_SIGNS_TR[pos.sign] || pos.sign;
  const d = pos.degreeInSign ?? Math.floor(pos.degreeInSignExact || 0);
  const m = pos.minuteInSign ?? 0;
  const retro = pos.retrograde ? ' R' : '';
  return `${sign} ${d}°${String(m).padStart(2, '0')}′${retro}`;
}

/**
 * Compact verified natal block for LLM / chat (never asks LLM to invent angles).
 * @param {object} result calculateNatalChart output
 */
export function formatNatalDataBlock(result) {
  if (!result?.ok) {
    return [
      '## VERIFIED NATAL CHART DATA',
      `Status: unavailable (${result?.errorCode || 'ERROR'})`,
      `Message: ${result?.message || 'Hesaplanamadı'}`,
      'Do NOT invent Ascendant, houses, planet degrees, or aspects.',
    ].join('\n');
  }

  const lines = [
    '## VERIFIED NATAL CHART DATA (deterministic engine — do not recalculate)',
    `Engine: ${result.engineId} ${result.engineVersion}`,
    `Methodology: ${result.methodology.methodologyId} / ${result.methodology.rulesetVersion}`,
    `Zodiac: ${result.methodology.zodiacSystem}`,
    result.methodology.houseSystem
      ? `House system: ${result.methodology.houseSystem}`
      : 'House system: n/a (full chart unavailable)',
    `UTC: ${result.normalizedInput.utcDateTime || 'n/a'}`,
    `Place: ${result.normalizedInput.birthPlace || 'n/a'}`,
    `Full chart: ${result.dataQuality.fullChartAvailable ? 'yes' : 'no'}`,
    '',
    '### Points',
  ];

  const order = [
    'Sun',
    'Moon',
    'Ascendant',
    'Midheaven',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Uranus',
    'Neptune',
    'Pluto',
    'NorthNode',
    'SouthNode',
  ];

  const byBody = Object.fromEntries((result.points || []).map((p) => [p.body, p]));
  for (const body of order) {
    const p = byBody[body];
    if (!p) continue;
    const house = p.house != null ? ` | Ev ${p.house}` : '';
    lines.push(`- ${body}: ${formatDegreeLabel(p)}${house}`);
  }

  if (result.angles?.ascendant) {
    lines.push('', '### Angles');
    lines.push(`- Ascendant: ${formatDegreeLabel(result.angles.ascendant)}`);
    lines.push(`- Midheaven: ${formatDegreeLabel(result.angles.midheaven)}`);
    lines.push(`- Descendant: ${formatDegreeLabel(result.angles.descendant)}`);
    lines.push(`- IC: ${formatDegreeLabel(result.angles.imumCoeli)}`);
  }

  if (result.distributions) {
    lines.push('', '### Distributions');
    lines.push(`- Elements: ${JSON.stringify(result.distributions.elements)}`);
    lines.push(`- Modalities: ${JSON.stringify(result.distributions.modalities)}`);
  }

  if (result.aspects?.length) {
    lines.push('', '### Major aspects (tightest 12)');
    for (const a of result.aspects.slice(0, 12)) {
      lines.push(
        `- ${a.bodyA} ${a.aspect} ${a.bodyB} (orb ${a.orb.toFixed(2)}°)`,
      );
    }
  }

  if (result.warnings?.length) {
    lines.push('', '### Warnings');
    for (const w of result.warnings) lines.push(`- ${w}`);
  }

  lines.push(
    '',
    '### Interpretation rules for the model',
    '- Use ONLY the degrees/signs/houses/aspects listed above.',
    '- Do NOT invent Ascendant, MC, house cusps, or planet longitudes.',
    '- If full chart is no, do not claim rising sign or house placements.',
    '- No medical, legal, financial certainty; no death/pregnancy guarantees; no third-party accusations.',
    '- Synthesize placements together; avoid dictionary-style one-liners.',
  );

  return lines.join('\n');
}

/**
 * Human-readable summary lines (channel formatting).
 * @param {object} result
 */
export function formatNatalSummaryLines(result) {
  if (!result?.ok) return [result?.message || 'Natal harita hesaplanamadı.'];
  const byBody = Object.fromEntries((result.points || []).map((p) => [p.body, p]));
  const lines = [];
  for (const body of ['Sun', 'Moon', 'Ascendant', 'Midheaven', 'Mercury', 'Venus', 'Mars']) {
    const p = byBody[body] || (body === 'Ascendant' ? result.angles?.ascendant : null) ||
      (body === 'Midheaven' ? result.angles?.midheaven : null);
    if (!p) continue;
    const label =
      body === 'Sun'
        ? 'Güneş'
        : body === 'Moon'
          ? 'Ay'
          : body === 'Ascendant'
            ? 'Yükselen'
            : body === 'Midheaven'
              ? 'MC'
              : body === 'Mercury'
                ? 'Merkür'
                : body === 'Venus'
                  ? 'Venüs'
                  : 'Mars';
    lines.push(`${label}: ${formatDegreeLabel(p)}`);
  }
  return lines;
}

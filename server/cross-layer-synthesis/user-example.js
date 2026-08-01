/**
 * Session-scoped learning from user synthesis examples.
 * Does NOT write Persistent Memory unless explicit consent + persistApproved.
 */

import { extractThemeIds, normalizeThemePhrases } from './theme-lexicon.js';
import { RELATIONSHIP_TYPES, RELATIONSHIP_LABELS_TR } from './schema.js';

/** @type {Map<string, object>} */
const SESSION_STORE = new Map();

const RELATIONSHIP_HINTS = [
  { type: 'supporting', re: /destek|aynı\s+şeyi|birbirini\s+doğrul/i },
  { type: 'complementing', re: /tamaml|eksik\s+yan|birlikte\s+okun/i },
  { type: 'balancing', re: /denge|ölçü|itidal/i },
  { type: 'tension', re: /gerilim|zıt|karşıt|acele.{0,20}sabır|sabır.{0,20}acele/i },
  { type: 'contradictory', re: /çeliş|ters\s+düş|birbiriyle\s+uyuşm/i },
  { type: 'independent', re: /bağımsız|ayrı\s+dur|ilişkisiz/i },
  { type: 'same_theme_different_angle', re: /farklı\s+açı|aynı\s+tema.{0,30}farklı/i },
  { type: 'insufficient_data', re: /yetersiz\s+veri|emin\s+değil/i },
];

/**
 * @param {string} text
 * @returns {string}
 */
export function inferRelationshipTypeFromExample(text) {
  const raw = String(text ?? '');
  for (const hint of RELATIONSHIP_HINTS) {
    if (hint.re.test(raw)) return hint.type;
  }
  return 'same_theme_different_angle';
}

/**
 * Analyze a user-provided synthesis example without copying it.
 * @param {string} exampleText
 * @param {{ layersMentioned?: string[] }} [meta]
 */
export function analyzeUserSynthesisExample(exampleText, meta = {}) {
  const text = String(exampleText ?? '').trim();
  const relationshipType = inferRelationshipTypeFromExample(text);
  const themes = extractThemeIds(text);
  const phrases = normalizeThemePhrases(
    text
      .split(/[,.;:\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3 && s.length < 60)
      .slice(0, 8),
  );

  const strengths = [];
  const weaknesses = [];

  if (themes.length >= 2) strengths.push('Birden fazla tema ayırt edilmiş.');
  if (RELATIONSHIP_TYPES.includes(relationshipType) && relationshipType !== 'supporting') {
    strengths.push(`İlişki türü abartılı doğrulama yerine “${RELATIONSHIP_LABELS_TR[relationshipType]}” olarak okunabilir.`);
  }
  if (/doğruluyor|kanıtlıyor|kesinlikle|gökyüzü bu ayeti/i.test(text)) {
    weaknesses.push('Kesinlik / çapraz doğrulama dili zayıf yön; Atlas bunu kopyalamaz.');
  }
  if (!/sınır|yöntem|ayrı|farklı sistem/i.test(text)) {
    weaknesses.push('Yöntem sınırları açık belirtilmemiş olabilir.');
  }
  if (themes.length === 0) {
    weaknesses.push('Karşılaştırılabilir tema çıkarmak zor; örnek daha somut temalar taşıyabilir.');
  }

  return {
    relationshipType,
    labelTr: RELATIONSHIP_LABELS_TR[relationshipType],
    themes,
    phrases: phrases.slice(0, 5),
    layersMentioned: Array.isArray(meta.layersMentioned) ? meta.layersMentioned : [],
    strengths,
    weaknesses,
    agreement: false,
    note:
      'Kullanıcı örneği referans mantık olarak tutulur; metin aynen kopyalanmaz ve otomatik onaylanmaz.',
  };
}

/**
 * @param {string} sessionId
 * @param {string} exampleText
 * @param {{
 *   layersMentioned?: string[],
 *   persistApproved?: boolean,
 *   userConsentForPersistentMemory?: boolean,
 * }} [options]
 */
export function recordUserSynthesisExample(sessionId, exampleText, options = {}) {
  const sid = String(sessionId || 'anonymous');
  const analysis = analyzeUserSynthesisExample(exampleText, options);
  const entry = {
    recordedAt: new Date().toISOString(),
    analysis,
    persistApproved: Boolean(options.persistApproved),
    userConsentForPersistentMemory: Boolean(options.userConsentForPersistentMemory),
    persistentWrite: false,
  };

  if (entry.persistApproved && entry.userConsentForPersistentMemory) {
    // Persistent Memory write is intentionally not performed here.
    // Callers must use the existing privacy/memory pipeline with explicit consent.
    entry.persistentWrite = false;
    entry.persistentWriteBlockedReason =
      'cross-layer-synthesis never writes Persistent Memory directly; use privacy-approved memory API after consent.';
  }

  const prev = SESSION_STORE.get(sid) ?? { examples: [] };
  prev.examples.push(entry);
  // Keep last 5
  prev.examples = prev.examples.slice(-5);
  SESSION_STORE.set(sid, prev);
  return entry;
}

/**
 * Hints to bias future relationship classification explanations (not forced agreement).
 * @param {string} sessionId
 */
export function getSessionSynthesisHints(sessionId) {
  const prev = SESSION_STORE.get(String(sessionId || 'anonymous'));
  if (!prev?.examples?.length) {
    return { hasHints: false, preferredRelationshipTypes: [], themeFocus: [], critiqueNotes: [] };
  }
  const preferredRelationshipTypes = [
    ...new Set(prev.examples.map((e) => e.analysis.relationshipType)),
  ];
  const themeFocus = [...new Set(prev.examples.flatMap((e) => e.analysis.themes))];
  const critiqueNotes = prev.examples.flatMap((e) => [
    ...e.analysis.strengths.map((s) => `güçlü: ${s}`),
    ...e.analysis.weaknesses.map((w) => `zayıf: ${w}`),
  ]);
  return {
    hasHints: true,
    preferredRelationshipTypes,
    themeFocus,
    critiqueNotes: critiqueNotes.slice(-6),
  };
}

export function clearSessionSynthesisExamples(sessionId) {
  SESSION_STORE.delete(String(sessionId || 'anonymous'));
}

export function _resetAllSessionExamplesForTests() {
  SESSION_STORE.clear();
}

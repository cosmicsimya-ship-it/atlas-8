/**
 * Central Symbolic Analysis methodology identities (Faz 1–2).
 * Single source for ids/versions — do not scatter string literals.
 */

export const ATLAS_LATIN_MOTIF_METHODOLOGY_V1 = Object.freeze({
  methodologyId: 'atlas-letter-number-v1',
  methodologyVersion: '1.0.0',
  rulesetVersion: 'atlas-latin-rules-1.0.0',
  displayName: 'Legacy Atlas Latin Motif',
  isClassicalAbjad: false,
});

export const ATLAS_LATIN_MOTIF_METHODOLOGY = Object.freeze({
  methodologyId: 'atlas-letter-number-v2',
  methodologyVersion: '2.0.0',
  rulesetVersion: 'atlas-latin-rules-2.0.0',
  displayName: 'Atlas Latin Harf-Sayı Motif Sistemi',
  isClassicalAbjad: false,
  disclaimer: 'Atlas Latin Harf-Sayı Motif Sistemi — klasik ebced değildir.',
  methodLabel: 'letter-sum-reduce',
});

/** @deprecated Use ATLAS_LATIN_MOTIF_METHODOLOGY when metadata v2 flag is on. */
export const EBCED_SOURCE_LEGACY = ATLAS_LATIN_MOTIF_METHODOLOGY_V1.methodologyId;

export const EBCED_METHOD = 'letter-sum-reduce';

export const LATIN_MOTIF_INTERPRETATION_LIMITATIONS = Object.freeze([
  'Bu yöntem klasik Arapça ebced hesabı değildir.',
  'Latin harfler Atlas’a özgü harf-sayı tablosuyla değerlendirilir.',
  'Sonuç sembolik motif yorumudur; kesinlik veya dinî hüküm ifade etmez.',
]);

export const CLASSICAL_ABJAD_COMING_SOON = Object.freeze({
  label: 'Klasik Ebced-i Kebîr — yakında',
  active: false,
  methodologyId: 'abjad-kabir-classical-v1',
});

export const CLASSICAL_ABJAD_METHODOLOGY = Object.freeze({
  methodologyId: 'abjad-kabir-classical-v1',
  methodologyVersion: '1.0.0',
  rulesetVersion: 'classical-kabir-rules-1.0.0',
  transliterationLayerId: 'transliteration-tr-ar-v1',
  /** Docs-only deprecated alias — do not use in new work. */
  deprecatedAlias: 'classical-arabic-abjad-kabir-v1',
  displayName: 'Klasik Ebced-i Kebîr',
  isClassicalAbjad: true,
  disclaimer:
    'Klasik Ebced-i Kebîr — Atlas ruleset classical-kabir-rules-1.0.0; kesin hüküm değildir.',
});

export const CLASSICAL_ABJAD_INTERPRETATION_LIMITATIONS = Object.freeze([
  'Ana klasik sonuç harf değerleri toplamıdır; digit reduction klasik birincil sonuç değildir.',
  'Hesap yalnızca kullanıcı onaylı selectedSpelling üzerinden yapılır.',
  'Sonuç sembolik/geleneksel bir çerçevedir; kesinlik veya dinî hüküm ifade etmez.',
]);

/** Personal birth-date Pythagorean numerology (not daily day-number, not letter motif). */
export const ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY_ID = 'atlas-pythagorean-birth-v1';

/**
 * Feature flag: ATLAS_SYMBOLIC_METADATA_V2
 * When off, legacy source strings and response shape (minus additive fields).
 * Calculation MUST NOT depend on this flag.
 */
export function isSymbolicMetadataV2Enabled(env = process.env) {
  const raw = env?.ATLAS_SYMBOLIC_METADATA_V2;
  return raw === '1' || raw === 'true' || raw === 'TRUE' || raw === 'yes';
}

/**
 * Truthy env tokens after trim + lowercase.
 * @param {string} normalized
 */
function isEnvFlagTruthyToken(normalized) {
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  );
}

/**
 * Falsy / off env tokens after trim + lowercase.
 * @param {string} normalized
 */
function isEnvFlagFalsyToken(normalized) {
  return (
    !normalized ||
    normalized === '0' ||
    normalized === 'false' ||
    normalized === 'off' ||
    normalized === 'no'
  );
}

/**
 * Feature flag: ATLAS_CLASSICAL_ABJAD_V1 (alias CLASSICAL_ABJAD_V1)
 * Default OFF — Latin motif path unchanged.
 * Values: unset/false → off; true/1/on → classical runner available;
 *         shadow → enable shadow-only compare (same as shadow flag).
 * Parsing: trim + lowercase (`True`, ` TRUE `, ` true ` → on).
 */
export function getClassicalAbjadFlagMode(env = process.env) {
  const raw = env?.ATLAS_CLASSICAL_ABJAD_V1 ?? env?.CLASSICAL_ABJAD_V1;
  if (raw == null) return 'off';
  const normalized = String(raw).trim().toLowerCase();
  if (isEnvFlagFalsyToken(normalized)) return 'off';
  if (normalized === 'shadow') return 'shadow';
  if (isEnvFlagTruthyToken(normalized)) return 'on';
  return 'off';
}

export function isClassicalAbjadV1Enabled(env = process.env) {
  const mode = getClassicalAbjadFlagMode(env);
  return mode === 'on' || mode === 'shadow';
}

/**
 * Shadow mode: classical runs for compare metadata only; userResult unchanged.
 * On when ATLAS_CLASSICAL_ABJAD_SHADOW is truthy, or V1 mode is `shadow`,
 * or V1 is `on` (Faz 3 default integration is shadow-safe additive metadata).
 */
export function isClassicalAbjadShadowEnabled(env = process.env) {
  const mode = getClassicalAbjadFlagMode(env);
  if (mode === 'off') return false;
  if (mode === 'shadow') return true;
  const shadowRaw = env?.ATLAS_CLASSICAL_ABJAD_SHADOW ?? env?.CLASSICAL_ABJAD_SHADOW;
  if (shadowRaw == null || String(shadowRaw).trim() === '') {
    // Faz 3: enabling V1 defaults to shadow-compare without replacing Latin primary.
    return mode === 'on';
  }
  const sn = String(shadowRaw).trim().toLowerCase();
  if (isEnvFlagFalsyToken(sn)) return false;
  return isEnvFlagTruthyToken(sn);
}

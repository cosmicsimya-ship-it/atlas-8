// ═══════════════════════════════════════════════════════════════════════
// Founder Privacy — public profile only for unauthorized requesters
// Visibility: PUBLIC | PUBLIC_SUMMARY | PRIVATE | NEVER_DISCLOSE
// ═══════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROFILE_PATH = join(__dirname, '..', '..', 'data', 'founder_public_profile.json');

const FALLBACK_PUBLIC = Object.freeze({
  founderId: 'lara',
  displayName: 'Lara',
  visibility: Object.freeze({
    preferred_name: 'PUBLIC',
    roles: 'PUBLIC',
    workAreas: 'PUBLIC',
    atlas: 'PUBLIC',
    brands: 'PUBLIC',
    publicPositioning: 'PUBLIC_SUMMARY',
  }),
  publicProfile: Object.freeze({
    role: "Cosmic Simya'nın kurucusu ve Atlas'ı geliştiren yaratıcı isim",
    bio: 'Lara; yapay zekâ destekli görsel konseptler, sembolizm, astroloji, numeroloji, bilinçaltı ve örüntü okuma alanlarında çalışır. Farklı anlam katmanlarını tek konuşma içinde ilişkilendiren sistemler tasarlar.',
    atlasRelationship:
      "Atlas, Lara'nın farklı bilgi ve sembol katmanlarını tek konuşmada bir araya getirme fikrinden doğmuş bir yapay zekâ sistemidir. Cosmic Simya markası altında geliştirilir.",
    workAreas: Object.freeze([
      'yapay zekâ tabanlı görsel konsept geliştirme',
      'sembolizm',
      'astroloji',
      'numeroloji',
      'bilinçaltı ve örüntü okuma',
      'çok katmanlı sistem tasarımı',
    ]),
    brands: Object.freeze({
      cosmic_simya: Object.freeze({
        type: 'ana marka',
        website: 'https://cosmicsimya.com',
      }),
      astrolojik_akil: Object.freeze({
        type: 'astroloji odaklı içerik alanı',
      }),
    }),
    publicPositioning: Object.freeze([
      'I build visual worlds from thought.',
      'AI • Symbolism • Consciousness',
      'Building Atlas — symbolic intelligence.',
    ]),
    publicTraits: Object.freeze([
      'creative',
      'research-oriented',
      'system thinker',
      'focused on patterns and interdisciplinary connections',
    ]),
  }),
  allowedPublicFields: Object.freeze([
    'displayName',
    'role',
    'bio',
    'atlasRelationship',
    'workAreas',
    'brands',
    'publicPositioning',
    'publicTraits',
  ]),
  updatedAt: null,
});

/** @type {any} */
let cachedProfile = null;
let cachePath = null;

/**
 * @param {string} [profilePath]
 */
export function resetFounderPublicProfileCacheForTests(profilePath) {
  cachedProfile = null;
  cachePath = profilePath ?? null;
}

/**
 * Load public founder profile. Never throws — falls back safely.
 * @param {string} [profilePath]
 */
export function loadFounderPublicProfile(profilePath = DEFAULT_PROFILE_PATH) {
  if (cachedProfile && cachePath === profilePath) {
    return cachedProfile;
  }

  try {
    if (!existsSync(profilePath)) {
      cachedProfile = structuredClone(FALLBACK_PUBLIC);
      cachePath = profilePath;
      return cachedProfile;
    }

    const raw = readFileSync(profilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      cachedProfile = structuredClone(FALLBACK_PUBLIC);
      cachePath = profilePath;
      return cachedProfile;
    }

    const allowed = Array.isArray(parsed.allowedPublicFields)
      ? parsed.allowedPublicFields.map(String)
      : [...FALLBACK_PUBLIC.allowedPublicFields];

    const publicProfile =
      parsed.publicProfile && typeof parsed.publicProfile === 'object'
        ? parsed.publicProfile
        : FALLBACK_PUBLIC.publicProfile;

    cachedProfile = {
      founderId: String(parsed.founderId ?? FALLBACK_PUBLIC.founderId),
      displayName: String(parsed.displayName ?? FALLBACK_PUBLIC.displayName),
      visibility:
        parsed.visibility && typeof parsed.visibility === 'object'
          ? parsed.visibility
          : { ...FALLBACK_PUBLIC.visibility },
      publicProfile: {
        role: String(publicProfile.role ?? FALLBACK_PUBLIC.publicProfile.role),
        bio: String(publicProfile.bio ?? FALLBACK_PUBLIC.publicProfile.bio),
        atlasRelationship: String(
          publicProfile.atlasRelationship ?? FALLBACK_PUBLIC.publicProfile.atlasRelationship,
        ),
        workAreas: Array.isArray(publicProfile.workAreas)
          ? publicProfile.workAreas.map(String)
          : [...FALLBACK_PUBLIC.publicProfile.workAreas],
        brands:
          publicProfile.brands && typeof publicProfile.brands === 'object'
            ? publicProfile.brands
            : { ...FALLBACK_PUBLIC.publicProfile.brands },
        publicPositioning: Array.isArray(publicProfile.publicPositioning)
          ? publicProfile.publicPositioning.map(String)
          : [...FALLBACK_PUBLIC.publicProfile.publicPositioning],
        publicTraits: Array.isArray(publicProfile.publicTraits)
          ? publicProfile.publicTraits.map(String)
          : [...FALLBACK_PUBLIC.publicProfile.publicTraits],
      },
      allowedPublicFields: allowed,
      updatedAt: parsed.updatedAt ? String(parsed.updatedAt) : null,
    };
    cachePath = profilePath;
    return cachedProfile;
  } catch {
    cachedProfile = structuredClone(FALLBACK_PUBLIC);
    cachePath = profilePath;
    return cachedProfile;
  }
}

/**
 * Return only approved public fields (never raw private / NEVER_DISCLOSE).
 * @param {string} [profilePath]
 * @returns {Record<string, unknown>}
 */
export function getApprovedPublicFields(profilePath) {
  const profile = loadFounderPublicProfile(profilePath);
  const allowed = new Set(profile.allowedPublicFields);
  /** @type {Record<string, unknown>} */
  const out = {};

  if (allowed.has('displayName')) out.displayName = profile.displayName;
  if (allowed.has('role')) out.role = profile.publicProfile.role;
  if (allowed.has('bio')) out.bio = profile.publicProfile.bio;
  if (allowed.has('atlasRelationship')) {
    out.atlasRelationship = profile.publicProfile.atlasRelationship;
  }
  if (allowed.has('workAreas')) {
    out.workAreas = [...(profile.publicProfile.workAreas || [])];
  }
  if (allowed.has('brands')) {
    out.brands = profile.publicProfile.brands || {};
  }
  if (allowed.has('publicPositioning')) {
    out.publicPositioning = [...(profile.publicProfile.publicPositioning || [])];
  }
  if (allowed.has('publicTraits')) {
    out.publicTraits = [...(profile.publicProfile.publicTraits || [])];
  }

  return out;
}

/**
 * Build user-facing public founder response text (factual, non-PR).
 * @param {{ includeFallbackNotice?: boolean, mode?: 'summary'|'examples' }} [options]
 */
export function buildFounderPublicResponse(options = {}) {
  const fields = getApprovedPublicFields();
  const name = String(fields.displayName || 'Lara');
  const role = String(fields.role || '');
  const atlas = String(fields.atlasRelationship || '');
  const work = Array.isArray(fields.workAreas) ? fields.workAreas : [];
  const brands = fields.brands && typeof fields.brands === 'object' ? fields.brands : {};
  const site =
    brands.cosmic_simya && typeof brands.cosmic_simya === 'object'
      ? brands.cosmic_simya.website
      : 'https://cosmicsimya.com';

  if (options.mode === 'examples') {
    const examples = work.slice(0, 4);
    if (!examples.length) {
      return `${name}; kamuya açık çalışması yapay zekâ, sembolizm ve örüntü okuma etrafında şekilleniyor.`;
    }
    return `Örneğin ${examples.slice(0, -1).join(', ')}${
      examples.length > 1 ? ' ve ' : ''
    }${examples[examples.length - 1]} gibi alanlarda çalışıyor; Atlas içinde bu katmanları bir araya getiriyor.`;
  }

  const workPhrase = work.length
    ? ` Çalışmaları ${work.slice(0, 4).join(', ')} gibi alanlarda şekilleniyor.`
    : '';

  return `${name}, ${role}.${workPhrase} ${atlas} Ana marka: Cosmic Simya (${site}).`.replace(
    /\s+/g,
    ' ',
  ).trim();
}

/**
 * Compact public profile block for prompt injection (authorized public questions only).
 * @param {string} [profilePath]
 */
export function buildPublicFounderPromptBlock(profilePath) {
  const fields = getApprovedPublicFields(profilePath);
  const traits = Array.isArray(fields.publicTraits) ? fields.publicTraits.join(', ') : '';
  const work = Array.isArray(fields.workAreas) ? fields.workAreas.join(', ') : '';
  const brands = fields.brands && typeof fields.brands === 'object' ? fields.brands : {};
  const brandLines = Object.entries(brands)
    .map(([k, v]) => {
      if (!v || typeof v !== 'object') return null;
      const website = v.website ? ` (${v.website})` : '';
      return `- ${k}: ${v.type || 'brand'}${website}`;
    })
    .filter(Boolean)
    .join('\n');

  return [
    '## Approved Public Founder Profile (share only these fields)',
    `Display name: ${fields.displayName ?? 'Lara'}`,
    `Role: ${fields.role ?? ''}`,
    `Bio: ${fields.bio ?? ''}`,
    `Atlas relationship: ${fields.atlasRelationship ?? ''}`,
    work ? `Work areas: ${work}` : null,
    brandLines ? `Brands:\n${brandLines}` : null,
    traits ? `Public traits: ${traits}` : null,
    'Tone: factual, short, no PR hyperbole.',
    'Do not invent or add private details beyond this block.',
    'NEVER disclose birth date, health, private relationships, addresses, or memory dumps.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function getFounderPublicProfilePath() {
  return DEFAULT_PROFILE_PATH;
}

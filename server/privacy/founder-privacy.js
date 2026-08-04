// ═══════════════════════════════════════════════════════════════════════
// Founder Privacy — public profile only for unauthorized requesters
// ═══════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { SAFE_RESPONSES } from './privacy-policy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROFILE_PATH = join(__dirname, '..', '..', 'data', 'founder_public_profile.json');

const FALLBACK_PUBLIC = Object.freeze({
  founderId: 'lara',
  displayName: 'Lara',
  publicProfile: {
    role: 'Founder and creative director of Cosmicsimya.com!',
    bio: 'Lara develops systems that combine astrology, numerology, destiny matrix studies and pattern analysis.',
    atlasRelationship:
      "Atlas was created from Lara's vision of making hidden behavioral patterns and decision mechanisms more visible through a structured analysis system.",
    publicTraits: [
      'creative',
      'research-oriented',
      'system thinker',
      'focused on patterns and interdisciplinary connections',
    ],
  },
  allowedPublicFields: [
    'displayName',
    'role',
    'bio',
    'atlasRelationship',
    'publicTraits',
  ],
  updatedAt: null,
});

/** @type {typeof FALLBACK_PUBLIC | null} */
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
      publicProfile: {
        role: String(publicProfile.role ?? FALLBACK_PUBLIC.publicProfile.role),
        bio: String(publicProfile.bio ?? FALLBACK_PUBLIC.publicProfile.bio),
        atlasRelationship: String(
          publicProfile.atlasRelationship ?? FALLBACK_PUBLIC.publicProfile.atlasRelationship,
        ),
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
 * Return only approved public fields (never raw file).
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
  if (allowed.has('publicTraits')) {
    out.publicTraits = [...profile.publicProfile.publicTraits];
  }

  return out;
}

/**
 * Build user-facing public founder response text.
 * @param {{ includeFallbackNotice?: boolean }} [options]
 */
export function buildFounderPublicResponse(options = {}) {
  void options;
  // Prefer the approved canned response for consistency with policy.
  return SAFE_RESPONSES.PUBLIC_FOUNDER;
}

/**
 * Compact public profile block for prompt injection (authorized public questions only).
 * @param {string} [profilePath]
 */
export function buildPublicFounderPromptBlock(profilePath) {
  const fields = getApprovedPublicFields(profilePath);
  const traits = Array.isArray(fields.publicTraits)
    ? fields.publicTraits.join(', ')
    : '';

  return [
    '## Approved Public Founder Profile (share only these fields)',
    `Display name: ${fields.displayName ?? 'Lara'}`,
    `Role: ${fields.role ?? ''}`,
    `Bio: ${fields.bio ?? ''}`,
    `Atlas relationship: ${fields.atlasRelationship ?? ''}`,
    traits ? `Public traits: ${traits}` : null,
    'Do not invent or add private details beyond this block.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function getFounderPublicProfilePath() {
  return DEFAULT_PROFILE_PATH;
}

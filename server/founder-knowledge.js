// ═══════════════════════════════════════════════════════════════════════
// Founder Knowledge Layer — separate from user profile memory
//
// Loads knowledge/founders.json at startup. Supports multiple founder/admin
// profiles via modular registry. Never writes to user_memory.json.
// ═══════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { isValidUserId } from './user-memory.js';
import {
  buildFounderProfilePromptSection,
  buildFounderProfileIdentityHeader,
  getFounderBiographyProfile,
  initializeFounderProfiles,
} from './founder-profile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, '..', 'knowledge');
const FOUNDERS_FILE = join(KNOWLEDGE_DIR, 'founders.json');

/** @typedef {Object} FounderProfile
 * @property {string} id
 * @property {string} founderName
 * @property {string} role
 * @property {string} mission
 * @property {string} authority
 * @property {string} communicationStyle
 * @property {string[]} designPrinciples
 * @property {string[]} interactionRules
 * @property {string} memoryPriority
 * @property {string} architecturalVision
 * @property {string[]} [linkedUserIds]
 */

/**
 * @typedef {'not_found'|'matched'|'ambiguous'} FounderIdentityLookupStatus
 * @typedef {{
 *   status: FounderIdentityLookupStatus,
 *   profile: FounderProfile|null,
 *   matchCount: number,
 *   reasonCode: string|null,
 * }} FounderIdentityLookup
 */

/** @type {{
 *   version: number,
 *   profiles: FounderProfile[],
 *   identityIndex: Map<string, string>,
 *   ambiguousIds: Set<string>,
 *   duplicateLinkCount: number,
 * } | null} */
let registry = null;

/** When true, initializeFounderKnowledge will not reload from disk (test harness). */
let testRegistryLocked = false;

export const DUPLICATE_LINKED_USER_ID = 'DUPLICATE_LINKED_USER_ID';
export const AMBIGUOUS_IDENTITY_USER_REPLY =
  'Hesap eşleştirmesi şu anda doğrulanamadı. Yetkili hesap yapılandırmasının kontrol edilmesi gerekiyor.';

/**
 * Normalize to canonical namespaced user id. Bare numerics are rejected
 * (must be telegram:… / web:… / anonymous:…).
 * @param {unknown} userId
 * @returns {string|null}
 */
export function normalizeCanonicalUserId(userId) {
  if (userId == null) return null;
  const trimmed = String(userId).trim();
  if (!trimmed || !isValidUserId(trimmed)) return null;
  return trimmed;
}

function parseEnvUserIds() {
  const ids = new Set();
  const PLACEHOLDER = /^(YOUR_|PLACEHOLDER|example|test)/i;

  const combined = process.env.ATLAS_FOUNDER_USER_IDS ?? '';
  for (const part of combined.split(',')) {
    const normalized = normalizeCanonicalUserId(part);
    if (normalized && !PLACEHOLDER.test(part.trim())) ids.add(normalized);
  }

  const telegramIds = process.env.ATLAS_FOUNDER_TELEGRAM_IDS ?? '';
  for (const part of telegramIds.split(',')) {
    const trimmed = part.trim();
    if (trimmed && /^\d+$/.test(trimmed)) {
      const normalized = normalizeCanonicalUserId(`telegram:${trimmed}`);
      if (normalized) ids.add(normalized);
    }
  }

  const webIds = process.env.ATLAS_FOUNDER_WEB_USER_IDS ?? '';
  for (const part of webIds.split(',')) {
    const trimmed = part.trim();
    if (!trimmed || PLACEHOLDER.test(trimmed)) continue;
    const candidate = trimmed.startsWith('web:') ? trimmed : `web:${trimmed}`;
    const normalized = normalizeCanonicalUserId(candidate);
    if (normalized) ids.add(normalized);
  }

  return ids;
}

function normalizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const profile = {
    id: String(raw.id ?? 'founder-unknown'),
    founderName: String(raw.founderName ?? 'Kurucu'),
    role: String(raw.role ?? ''),
    mission: String(raw.mission ?? ''),
    authority: String(raw.authority ?? ''),
    communicationStyle: String(raw.communicationStyle ?? ''),
    designPrinciples: Array.isArray(raw.designPrinciples)
      ? raw.designPrinciples.map(String)
      : [],
    interactionRules: Array.isArray(raw.interactionRules)
      ? raw.interactionRules.map(String)
      : [],
    memoryPriority: String(raw.memoryPriority ?? ''),
    architecturalVision: String(raw.architecturalVision ?? ''),
    linkedUserIds: Array.isArray(raw.linkedUserIds)
      ? [
          ...new Set(
            raw.linkedUserIds
              .map((id) => normalizeCanonicalUserId(id))
              .filter(Boolean),
          ),
        ]
      : [],
  };

  return profile;
}

/**
 * Build identity index with fail-closed duplicate detection.
 * Env-linked IDs attach only to founder-primary (or first profile), not every profile.
 * @param {FounderProfile[]} profiles
 * @param {Set<string>} envIds
 */
function buildIdentityMaps(profiles, envIds) {
  /** @type {Map<string, Set<string>>} */
  const links = new Map();

  function register(userId, profileId) {
    const id = normalizeCanonicalUserId(userId);
    if (!id || !profileId) return;
    if (!links.has(id)) links.set(id, new Set());
    links.get(id).add(String(profileId));
  }

  for (const profile of profiles) {
    for (const userId of profile.linkedUserIds) {
      register(userId, profile.id);
    }
  }

  const primary =
    profiles.find((p) => p.id === 'founder-primary') ?? profiles[0] ?? null;
  if (primary) {
    for (const userId of envIds) {
      register(userId, primary.id);
    }
  }

  /** @type {Map<string, string>} */
  const identityIndex = new Map();
  /** @type {Set<string>} */
  const ambiguousIds = new Set();
  let duplicateLinkCount = 0;

  for (const [userId, profileIds] of links.entries()) {
    if (profileIds.size > 1) {
      ambiguousIds.add(userId);
      duplicateLinkCount += 1;
      continue;
    }
    identityIndex.set(userId, [...profileIds][0]);
  }

  return { identityIndex, ambiguousIds, duplicateLinkCount };
}

/**
 * PII-safe startup / runtime duplicate warning.
 * @param {{ duplicateLinkCount: number, channel?: string }} info
 * @param {{ warn?: (...args: unknown[]) => void }} [logger]
 */
export function logDuplicateLinkedUserIdWarning(info, logger = console) {
  if (!info?.duplicateLinkCount) return;
  const warn = typeof logger.warn === 'function' ? logger.warn.bind(logger) : console.warn;
  warn(
    `[Founder] security/config errorCode=${DUPLICATE_LINKED_USER_ID} channel=${info.channel ?? 'startup'} matchCount=${info.duplicateLinkCount} resultStatus=ambiguous_identity`,
  );
}

/**
 * Load founder knowledge registry (idempotent).
 * @param {{ force?: boolean }} [options]
 * @returns {{ ok: boolean, profileCount: number, duplicateLinkCount?: number, error?: string }}
 */
export function initializeFounderKnowledge(options = {}) {
  if (testRegistryLocked && !options.force) {
    return {
      ok: true,
      profileCount: registry?.profiles.length ?? 0,
      duplicateLinkCount: registry?.duplicateLinkCount ?? 0,
    };
  }

  initializeFounderProfiles();

  try {
    if (!existsSync(FOUNDERS_FILE)) {
      registry = {
        version: 1,
        profiles: [],
        identityIndex: new Map(),
        ambiguousIds: new Set(),
        duplicateLinkCount: 0,
      };
      console.warn('[Founder] knowledge/founders.json not found — layer empty');
      return { ok: true, profileCount: 0, duplicateLinkCount: 0 };
    }

    const raw = JSON.parse(readFileSync(FOUNDERS_FILE, 'utf-8'));
    const profiles = (Array.isArray(raw.profiles) ? raw.profiles : [])
      .map(normalizeProfile)
      .filter(Boolean);

    const envIds = parseEnvUserIds();
    const { identityIndex, ambiguousIds, duplicateLinkCount } = buildIdentityMaps(
      profiles,
      envIds,
    );

    registry = {
      version: raw.version ?? 1,
      profiles,
      identityIndex,
      ambiguousIds,
      duplicateLinkCount,
    };

    if (duplicateLinkCount > 0) {
      logDuplicateLinkedUserIdWarning({
        duplicateLinkCount,
        channel: 'startup',
      });
    }

    return { ok: true, profileCount: profiles.length, duplicateLinkCount };
  } catch (err) {
    registry = {
      version: 1,
      profiles: [],
      identityIndex: new Map(),
      ambiguousIds: new Set(),
      duplicateLinkCount: 0,
    };
    console.error('[Founder] Failed to load knowledge layer:', err.message);
    return { ok: false, profileCount: 0, duplicateLinkCount: 0, error: err.message };
  }
}

/** @returns {FounderProfile[]} */
export function listFounderProfiles() {
  if (!registry) initializeFounderKnowledge();
  return registry?.profiles ?? [];
}

/**
 * Structured founder identity lookup — never silently picks the first of many.
 * @param {string|null|undefined} userId
 * @returns {FounderIdentityLookup}
 */
export function lookupFounderIdentity(userId) {
  const id = normalizeCanonicalUserId(userId);
  if (!id) {
    return {
      status: 'not_found',
      profile: null,
      matchCount: 0,
      reasonCode: 'INVALID_USER_ID',
    };
  }

  initializeFounderKnowledge();
  if (!registry) {
    return {
      status: 'not_found',
      profile: null,
      matchCount: 0,
      reasonCode: 'REGISTRY_UNAVAILABLE',
    };
  }

  if (registry.ambiguousIds.has(id)) {
    return {
      status: 'ambiguous',
      profile: null,
      matchCount: 2,
      reasonCode: DUPLICATE_LINKED_USER_ID,
    };
  }

  const profileId = registry.identityIndex.get(id);
  if (!profileId) {
    return {
      status: 'not_found',
      profile: null,
      matchCount: 0,
      reasonCode: 'NOT_LINKED',
    };
  }

  const profile = registry.profiles.find((p) => p.id === profileId) ?? null;
  if (!profile) {
    return {
      status: 'not_found',
      profile: null,
      matchCount: 0,
      reasonCode: 'PROFILE_MISSING',
    };
  }

  return {
    status: 'matched',
    profile,
    matchCount: 1,
    reasonCode: null,
  };
}

/**
 * @param {string} userId
 * @returns {FounderProfile|null}
 */
export function resolveFounderProfile(userId) {
  const lookup = lookupFounderIdentity(userId);
  return lookup.status === 'matched' ? lookup.profile : null;
}

/**
 * @param {string} userId
 */
export function isFounderUser(userId) {
  return lookupFounderIdentity(userId).status === 'matched';
}

/**
 * @param {string} userId
 */
export function isAmbiguousFounderIdentity(userId) {
  return lookupFounderIdentity(userId).status === 'ambiguous';
}

/**
 * Resolve biography profile for a verified founder userId.
 * @param {string} userId
 */
export function resolveFounderBiographyProfile(userId) {
  const knowledge = resolveFounderProfile(userId);
  if (!knowledge) return null;
  return getFounderBiographyProfile(knowledge.id);
}

/**
 * Full founders.json + biography block for SYSTEM prompt (mandatory when founder resolved).
 * @param {{ knowledge: FounderProfile, biography: import('./founder-profile.js').FounderBiographyProfile|null }} session
 */
export function buildFounderSystemPromptSection(session) {
  if (!session?.knowledge) return '';

  const profile = session.knowledge;
  const biography = session.biography;
  const displayName = biography?.preferredName ?? profile.founderName;
  const principles = profile.designPrinciples.map((p) => `- ${p}`).join('\n');
  const rules = profile.interactionRules.map((r) => `- ${r}`).join('\n');
  const profileSection = biography ? `\n\n${buildFounderProfilePromptSection(biography)}` : '';

  return `
## FOUNDER SYSTEM CONTEXT (knowledge/founders.json — ZORUNLU)

founderResolved: true
founderId: ${profile.id}
sourceFile: knowledge/founders.json
profileFile: knowledge/founders/founder-profile.json

Bu bölüm backend tarafından doğrulanmış kurucu oturumunda SYSTEM prompt'a otomatik eklenir.
LLM bu veriyi yeniden yorumlamaz, reddetmez veya user_memory.json sanmaz.

Kimlik:
- Kurucu adı: ${displayName} (founders.json → founderName: ${profile.founderName})
- Rol: ${profile.role}
- Görev: ${profile.mission}
- Otorite: ${profile.authority}
- İletişim: ${profile.communicationStyle}
- Mimari vizyon: ${profile.architecturalVision}
- Hafıza önceliği: ${profile.memoryPriority}

Tasarım ilkeleri (founders.json):
${principles}

Etkileşim kuralları (founders.json):
${rules}

Kurucu oturumu kuralları:
- Konuşan sıradan kullanıcı değildir — ${displayName}
- Kimlik sorularında ("Ben kimim?", "Kurucu musun?") founders.json profilini esas al
- "Kalıcı profilin yok", "seni ayırmıyorum", "yalnızca bu sohbetten biliyorum" DEME
- Kurucu kimliği sohbet bağlamından bağımsız sistem verisidir
${profileSection}
`.trim();
}

/**
 * System-prompt block for founder sessions.
 * @param {FounderProfile} profile
 */
export function buildFounderRuntimeRules(profile) {
  if (!profile) return '';

  const principles = profile.designPrinciples.map((p) => `- ${p}`).join('\n');
  const rules = profile.interactionRules.map((r) => `- ${r}`).join('\n');

  const biographyProfile = getFounderBiographyProfile(profile.id);
  const profileSection = biographyProfile
    ? `\n\n${buildFounderProfilePromptSection(biographyProfile)}`
    : '';

  const displayName = biographyProfile?.preferredName ?? profile.founderName;

  return `
## Aktif Mod: Kurucu Oturumu (Founder Knowledge Layer)

Konuşan kişi sıradan bir kullanıcı değildir — ${displayName}, ${profile.role}.

Görev: ${profile.mission}

Otorite: ${profile.authority}

İletişim: ${profile.communicationStyle}

Mimari vizyon: ${profile.architecturalVision}

Hafıza önceliği: ${profile.memoryPriority}

Tasarım ilkeleri:
${principles}

Etkileşim kuralları:
${rules}

Kurucu oturumunda:
- Önceki mimari kararları dikkate al ve gerektiğinde hatırlat
- Alternatif çözümler sun; tek yol dayatma
- Zayıf varsayımlarda eleştirel geri bildirim ver
- Doğrulanabilir teknik/gerçek bilgiyi sembolik yorumdan açıkça ayır
- Gereksiz onaylayıcı veya boş motivasyon cümleleri kullanma
- Kurucu bilgi katmanı kimlik otoritesidir; kullanıcı profil hafızası yalnızca kişisel koordinat ekler
${profileSection}
`.trim();
}

/**
 * Merge founder context with user memory for user prompt injection.
 * Founder knowledge is NOT duplicated from user_memory.json.
 * @param {string|null} userMemoryContext from buildRelevantMemoryContext
 * @param {FounderProfile|null} founderProfile
 */
export function mergeFounderWithUserMemoryContext(userMemoryContext, founderProfile) {
  if (!founderProfile) {
    return userMemoryContext;
  }

  const biographyProfile = getFounderBiographyProfile(founderProfile.id);
  const identityHeader = biographyProfile
    ? buildFounderProfileIdentityHeader(biographyProfile)
    : [
        '## Oturum Kimliği',
        `Konuşan: ${founderProfile.founderName} (${founderProfile.role})`,
        'Bu oturum Founder Knowledge Layer ile yönetilir; kurucu profili kullanıcı belleğinin üzerindedir.',
      ].join('\n');

  const parts = [identityHeader];

  if (userMemoryContext?.trim()) {
    parts.push(
      '',
      '## Kişisel Profil Hafızası (ek koordinat — Founder Profile yerine geçmez)',
      userMemoryContext.trim(),
    );
  }

  return parts.join('\n');
}

export function getFoundersFilePath() {
  return FOUNDERS_FILE;
}

export function getFounderKnowledgeStatus() {
  if (!registry) initializeFounderKnowledge();
  return {
    loaded: Boolean(registry),
    profileCount: registry?.profiles.length ?? 0,
    linkedIdentities: registry?.identityIndex.size ?? 0,
    ambiguousIdentities: registry?.ambiguousIds.size ?? 0,
    duplicateLinkCount: registry?.duplicateLinkCount ?? 0,
  };
}

/**
 * Test helper — inject a synthetic registry (does not touch disk).
 * Locks registry until unlockFounderKnowledgeForTests() / force re-init.
 * @param {{
 *   profiles?: FounderProfile[],
 *   linkedPairs?: Array<{ userId: string, profileId: string }>,
 * }} input
 */
export function resetFounderKnowledgeForTests(input = {}) {
  const profiles = (input.profiles ?? []).map(normalizeProfile).filter(Boolean);
  /** @type {Map<string, Set<string>>} */
  const links = new Map();
  for (const pair of input.linkedPairs ?? []) {
    const id = normalizeCanonicalUserId(pair.userId);
    if (!id) continue;
    if (!links.has(id)) links.set(id, new Set());
    links.get(id).add(String(pair.profileId));
  }
  for (const profile of profiles) {
    for (const userId of profile.linkedUserIds) {
      const id = normalizeCanonicalUserId(userId);
      if (!id) continue;
      if (!links.has(id)) links.set(id, new Set());
      links.get(id).add(profile.id);
    }
  }

  const identityIndex = new Map();
  const ambiguousIds = new Set();
  let duplicateLinkCount = 0;
  for (const [userId, profileIds] of links.entries()) {
    if (profileIds.size > 1) {
      ambiguousIds.add(userId);
      duplicateLinkCount += 1;
    } else {
      identityIndex.set(userId, [...profileIds][0]);
    }
  }

  registry = {
    version: 1,
    profiles,
    identityIndex,
    ambiguousIds,
    duplicateLinkCount,
  };
  testRegistryLocked = true;

  return getFounderKnowledgeStatus();
}

/**
 * Release test registry lock and reload from disk/env.
 */
export function unlockFounderKnowledgeForTests() {
  testRegistryLocked = false;
  return initializeFounderKnowledge({ force: true });
}

// Load at module import (server startup)
initializeFounderKnowledge();

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

/** @type {{ version: number, profiles: FounderProfile[], identityIndex: Map<string, string> } | null} */
let registry = null;

function parseEnvUserIds() {
  const ids = new Set();

  const combined = process.env.ATLAS_FOUNDER_USER_IDS ?? '';
  for (const part of combined.split(',')) {
    const trimmed = part.trim();
    if (trimmed && isValidUserId(trimmed)) ids.add(trimmed);
  }

  const telegramIds = process.env.ATLAS_FOUNDER_TELEGRAM_IDS ?? '';
  for (const part of telegramIds.split(',')) {
    const trimmed = part.trim();
    if (trimmed) ids.add(`telegram:${trimmed}`);
  }

  const webIds = process.env.ATLAS_FOUNDER_WEB_USER_IDS ?? '';
  for (const part of webIds.split(',')) {
    const trimmed = part.trim();
    if (trimmed.startsWith('web:')) ids.add(trimmed);
    else if (trimmed) ids.add(`web:${trimmed}`);
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
      ? raw.linkedUserIds.filter((id) => isValidUserId(String(id)))
      : [],
  };

  return profile;
}

/**
 * Load founder knowledge registry (idempotent).
 * @returns {{ ok: boolean, profileCount: number, error?: string }}
 */
export function initializeFounderKnowledge() {
  try {
    if (!existsSync(FOUNDERS_FILE)) {
      registry = { version: 1, profiles: [], identityIndex: new Map() };
      console.warn('[Founder] knowledge/founders.json not found — layer empty');
      return { ok: true, profileCount: 0 };
    }

    const raw = JSON.parse(readFileSync(FOUNDERS_FILE, 'utf-8'));
    const profiles = (Array.isArray(raw.profiles) ? raw.profiles : [])
      .map(normalizeProfile)
      .filter(Boolean);

    const identityIndex = new Map();
    const envIds = parseEnvUserIds();

    for (const profile of profiles) {
      const allIds = new Set([...profile.linkedUserIds, ...envIds]);
      for (const userId of allIds) {
        if (isValidUserId(userId)) {
          identityIndex.set(userId, profile.id);
        }
      }
      // Env IDs link to first profile (primary founder) when not in JSON
      if (profile.id === 'founder-primary') {
        for (const userId of envIds) {
          if (!identityIndex.has(userId)) {
            identityIndex.set(userId, profile.id);
          }
        }
      }
    }

    registry = {
      version: raw.version ?? 1,
      profiles,
      identityIndex,
    };

    return { ok: true, profileCount: profiles.length };
  } catch (err) {
    registry = { version: 1, profiles: [], identityIndex: new Map() };
    console.error('[Founder] Failed to load knowledge layer:', err.message);
    return { ok: false, profileCount: 0, error: err.message };
  }
}

/** @returns {FounderProfile[]} */
export function listFounderProfiles() {
  if (!registry) initializeFounderKnowledge();
  return registry?.profiles ?? [];
}

/**
 * @param {string} userId
 * @returns {FounderProfile|null}
 */
export function resolveFounderProfile(userId) {
  if (!userId || !isValidUserId(userId)) return null;
  if (!registry) initializeFounderKnowledge();
  if (!registry) return null;

  const profileId = registry.identityIndex.get(userId.trim());
  if (!profileId) return null;

  return registry.profiles.find((p) => p.id === profileId) ?? null;
}

/**
 * @param {string} userId
 */
export function isFounderUser(userId) {
  return resolveFounderProfile(userId) !== null;
}

/**
 * System-prompt block for founder sessions.
 * @param {FounderProfile} profile
 */
export function buildFounderRuntimeRules(profile) {
  if (!profile) return '';

  const principles = profile.designPrinciples.map((p) => `- ${p}`).join('\n');
  const rules = profile.interactionRules.map((r) => `- ${r}`).join('\n');

  return `
## Aktif Mod: Kurucu Oturumu (Founder Knowledge Layer)

Konuşan kişi sıradan bir kullanıcı değildir — ${profile.founderName}, ${profile.role}.

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

  const parts = [
    '## Oturum Kimliği',
    `Konuşan: ${founderProfile.founderName} (${founderProfile.role})`,
    'Bu oturum Founder Knowledge Layer ile yönetilir; kurucu profili kullanıcı belleğinin üzerindedir.',
  ];

  if (userMemoryContext?.trim()) {
    parts.push(
      '',
      '## Kişisel Profil Hafızası (ek koordinat — kurucu kimliğinin yerine geçmez)',
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
  };
}

// Load at module import (server startup)
initializeFounderKnowledge();

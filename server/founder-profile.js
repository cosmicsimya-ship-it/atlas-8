// ═══════════════════════════════════════════════════════════════════════
// Founder Profile & Biography System
//
// Complements Founder Knowledge Layer (founders.json).
// Official structured identity + biography — never stored in user_memory.json.
// Linked to knowledge profiles by shared `id` (e.g. founder-primary).
// ═══════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FOUNDERS_DIR = join(__dirname, '..', 'knowledge', 'founders');
const REGISTRY_FILE = join(FOUNDERS_DIR, 'founder-profile.json');
const PROFILES_DIR = join(FOUNDERS_DIR, 'profiles');

/** @typedef {Object} FounderBiographyProfile
 * @property {string} id
 * @property {string} fullName
 * @property {string} preferredName
 * @property {string} role
 * @property {string} title
 * @property {string} mission
 * @property {string} vision
 * @property {string[]} responsibilities
 * @property {{ tone?: string, avoid?: string[], prefer?: string[] }} communicationPreferences
 * @property {string} decisionAuthority
 * @property {string[]} designPrinciples
 * @property {string} workingStyle
 * @property {string[]} values
 * @property {string[]} goals
 * @property {string} biography
 * @property {string} founderNotes
 */

/** @type {{ version: number, profiles: Map<string, FounderBiographyProfile> } | null} */
let registry = null;

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

function normalizeBiographyProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const comm = raw.communicationPreferences;
  const communicationPreferences =
    comm && typeof comm === 'object'
      ? {
          tone: comm.tone ? String(comm.tone) : '',
          avoid: asStringArray(comm.avoid),
          prefer: asStringArray(comm.prefer),
        }
      : { tone: '', avoid: [], prefer: [] };

  return {
    id: String(raw.id ?? 'founder-unknown'),
    fullName: String(raw.fullName ?? raw.founderName ?? 'Kurucu'),
    preferredName: String(raw.preferredName ?? raw.fullName ?? raw.founderName ?? 'Kurucu'),
    role: String(raw.role ?? ''),
    title: String(raw.title ?? ''),
    mission: String(raw.mission ?? ''),
    vision: String(raw.vision ?? ''),
    responsibilities: asStringArray(raw.responsibilities),
    communicationPreferences,
    decisionAuthority: String(raw.decisionAuthority ?? ''),
    designPrinciples: asStringArray(raw.designPrinciples),
    workingStyle: String(raw.workingStyle ?? ''),
    values: asStringArray(raw.values),
    goals: asStringArray(raw.goals),
    biography: String(raw.biography ?? ''),
    founderNotes: String(raw.founderNotes ?? ''),
  };
}

function loadProfileFile(filePath) {
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (raw.profiles && Array.isArray(raw.profiles)) {
      return raw.profiles.map(normalizeBiographyProfile).filter(Boolean);
    }
    const single = normalizeBiographyProfile(raw);
    return single ? [single] : [];
  } catch (err) {
    console.error(`[FounderProfile] Failed to load ${filePath}:`, err.message);
    return [];
  }
}

/**
 * @returns {{ ok: boolean, profileCount: number, error?: string }}
 */
export function initializeFounderProfiles() {
  try {
    const profiles = new Map();

    if (existsSync(REGISTRY_FILE)) {
      for (const p of loadProfileFile(REGISTRY_FILE)) {
        profiles.set(p.id, p);
      }
    }

    if (existsSync(PROFILES_DIR)) {
      for (const name of readdirSync(PROFILES_DIR)) {
        if (!name.endsWith('.json')) continue;
        const filePath = join(PROFILES_DIR, name);
        for (const p of loadProfileFile(filePath)) {
          profiles.set(p.id, { ...profiles.get(p.id), ...p, id: p.id });
        }
      }
    }

    registry = { version: 1, profiles };

    if (profiles.size === 0) {
      console.warn('[FounderProfile] No biography profiles loaded');
    }

    return { ok: true, profileCount: profiles.size };
  } catch (err) {
    registry = { version: 1, profiles: new Map() };
    console.error('[FounderProfile] Init failed:', err.message);
    return { ok: false, profileCount: 0, error: err.message };
  }
}

/** @returns {FounderBiographyProfile[]} */
export function listFounderBiographyProfiles() {
  if (!registry) initializeFounderProfiles();
  return [...(registry?.profiles.values() ?? [])];
}

/**
 * @param {string} profileId — matches Founder Knowledge Layer profile id
 * @returns {FounderBiographyProfile|null}
 */
export function getFounderBiographyProfile(profileId) {
  if (!profileId) return null;
  if (!registry) initializeFounderProfiles();
  return registry?.profiles.get(profileId) ?? null;
}

function formatList(items, prefix = '-') {
  return items.length ? items.map((i) => `${prefix} ${i}`).join('\n') : '- (tanımlı değil)';
}

/**
 * System-prompt section from Founder Profile & Biography (not user memory).
 * @param {FounderBiographyProfile} profile
 */
export function buildFounderProfilePromptSection(profile) {
  if (!profile) return '';

  const comm = profile.communicationPreferences;
  const avoid = comm.avoid?.length ? comm.avoid.join(', ') : '—';
  const prefer = comm.prefer?.length ? comm.prefer.join(', ') : '—';

  return `
## Founder Profile & Biography (Resmi Kimlik Kaynağı)

Bu bölüm Founder Profile katmanından gelir — user_memory.json DEĞİLDİR.
Kurucuyu tanımak ve tutarlı iletişim kurmak için bu profili esas al.

Kimlik:
- Tam ad: ${profile.fullName}
- Tercih edilen hitap: ${profile.preferredName}
- Rol: ${profile.role}
- Unvan: ${profile.title}

Misyon: ${profile.mission}
Vizyon: ${profile.vision}

Karar otoritesi: ${profile.decisionAuthority}

Sorumluluklar:
${formatList(profile.responsibilities)}

İletişim tercihleri:
- Ton: ${comm.tone || '—'}
- Kaçın: ${avoid}
- Tercih et: ${prefer}

Çalışma tarzı: ${profile.workingStyle}

Değerler:
${formatList(profile.values)}

Hedefler:
${formatList(profile.goals)}

Tasarım ilkeleri (profil):
${formatList(profile.designPrinciples)}

Biyografi:
${profile.biography.trim() || '(henüz girilmedi)'}

Kurucu notları:
${profile.founderNotes.trim() || '—'}

Founder Profile kuralları:
- Bu profili kullanıcı belleği sanma; karıştırma
- Yanıtlarda preferredName (${profile.preferredName}) kullan
- Biyografi ve değerler kurucu oturumunun resmi referansıdır
- Sembolik yorumu doğrulanabilir bilgiden ayır
`.trim();
}

/**
 * User-prompt identity header (separate from user memory coordinates).
 * @param {FounderBiographyProfile} profile
 */
export function buildFounderProfileIdentityHeader(profile) {
  if (!profile) return '';
  return [
    '## Founder Profile (Kimlik — user_memory değil)',
    `Konuşan: ${profile.preferredName} (${profile.title})`,
    'Resmi kurucu profili yüklendi; kişisel profil hafızası yalnızca ek koordinattır.',
  ].join('\n');
}

export function getFounderProfileRegistryPath() {
  return REGISTRY_FILE;
}

export function getFounderProfileStatus() {
  if (!registry) initializeFounderProfiles();
  return {
    loaded: Boolean(registry),
    profileCount: registry?.profiles.size ?? 0,
  };
}

initializeFounderProfiles();

// ═══════════════════════════════════════════════════════════════════════
// Prime Personal Profile — validated read/write over the EXISTING
// server/user-memory.js `profile` sub-object. Not a parallel store.
//
// Layering (see docs in the Phase 2 brief):
//   ACCOUNT           -> server/auth/account-store.js
//   PERSONAL PROFILE   -> this file (user-memory.js's `profile`, explicit structured data)
//   CONVERSATIONS      -> server/conversations.js (raw chat turns)
//   USER MEMORY        -> user-memory.js's `facts` (extracted/inferred)
// ═══════════════════════════════════════════════════════════════════════

import { getUserMemory, updateUserMemory, isValidUserId } from '../user-memory.js';

export const RELATIONSHIP_STATUS_VALUES = Object.freeze([
  'single',
  'relationship',
  'married',
  'separated',
  'divorced',
  'widowed',
  'prefer_not_to_say',
]);

const MAX_SHORT_STRING = 120;

function isValidDateString(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

function isValidTimeString(value) {
  if (typeof value !== 'string') return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function isValidTimezone(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isBoundedString(value, max = MAX_SHORT_STRING) {
  return typeof value === 'string' && value.length <= max;
}

/**
 * Validate a PATCH payload field-by-field. Unknown top-level fields are
 * silently ignored (not rejected) EXCEPT authority fields, which are a
 * hard reject — those are almost certainly a client trying to self-grant
 * something, not an honest typo.
 *
 * @param {Record<string, unknown>} patch
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function validateProfilePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, error: 'Invalid payload' };
  }

  const FORBIDDEN_AUTHORITY_FIELDS = [
    'userId',
    'plan',
    'role',
    'roles',
    'entitlements',
    'subscription',
    'usage',
    'isAdmin',
    'isFounder',
  ];
  for (const key of FORBIDDEN_AUTHORITY_FIELDS) {
    if (key in patch) {
      return { ok: false, error: `Field not allowed: ${key}` };
    }
  }

  const out = {};

  if ('displayName' in patch) {
    if (patch.displayName !== null && !isBoundedString(patch.displayName)) {
      return { ok: false, error: 'Invalid displayName' };
    }
    out.name = patch.displayName === null ? null : String(patch.displayName).trim().slice(0, MAX_SHORT_STRING) || null;
  }

  if ('birth' in patch) {
    if (patch.birth !== null && (typeof patch.birth !== 'object' || Array.isArray(patch.birth))) {
      return { ok: false, error: 'Invalid birth object' };
    }
    const birth = patch.birth || {};

    if ('date' in birth) {
      if (birth.date !== null && !isValidDateString(birth.date)) {
        return { ok: false, error: 'Invalid birth.date (expected YYYY-MM-DD or null)' };
      }
      out.birthDate = birth.date ?? null;
    }
    if ('time' in birth) {
      // Unknown birth time is a valid, honest state — null is accepted, never fabricated.
      if (birth.time !== null && !isValidTimeString(birth.time)) {
        return { ok: false, error: 'Invalid birth.time (expected HH:mm or null)' };
      }
      out.birthTime = birth.time ?? null;
    }
    if ('place' in birth) {
      if (birth.place !== null && !isBoundedString(birth.place)) {
        return { ok: false, error: 'Invalid birth.place' };
      }
      out.birthPlace = birth.place ?? null;
    }
    if ('timezone' in birth) {
      if (birth.timezone !== null && !isValidTimezone(birth.timezone)) {
        return { ok: false, error: 'Invalid birth.timezone (expected a valid IANA zone or null)' };
      }
      out.timezone = birth.timezone ?? null;
    }
  }

  if ('relationshipStatus' in patch) {
    if (patch.relationshipStatus !== null && !RELATIONSHIP_STATUS_VALUES.includes(patch.relationshipStatus)) {
      return { ok: false, error: 'Invalid relationshipStatus' };
    }
    out.relationshipStatus = patch.relationshipStatus ?? null;
  }

  let preferredLanguage;
  if (patch.preferences !== undefined) {
    if (patch.preferences !== null && (typeof patch.preferences !== 'object' || Array.isArray(patch.preferences))) {
      return { ok: false, error: 'Invalid preferences object' };
    }
    const prefs = patch.preferences || {};
    if ('language' in prefs) {
      if (prefs.language !== null && !isBoundedString(prefs.language, 10)) {
        return { ok: false, error: 'Invalid preferences.language' };
      }
      preferredLanguage = prefs.language ?? null;
    }
  }

  return { ok: true, value: out, preferredLanguage };
}

/**
 * @param {string} userId
 * @returns {{ ok: true, profile: object } | { ok: false, error: string }}
 */
export function getPrimeProfile(userId) {
  if (!isValidUserId(userId)) return { ok: false, error: 'Invalid user ID' };
  const memory = getUserMemory(userId);
  const p = memory?.profile || {};
  return {
    ok: true,
    profile: {
      displayName: p.name ?? null,
      birth: {
        date: p.birthDate ?? null,
        time: p.birthTime ?? null,
        place: p.birthPlace ?? null,
        timezone: p.timezone ?? null,
      },
      relationshipStatus: p.relationshipStatus ?? null,
      preferences: { language: memory?.preferences?.preferredLanguage ?? null },
      profileUpdatedAt: memory?.updatedAt ?? null,
    },
  };
}

/**
 * @param {string} userId
 * @param {Record<string, unknown>} patch
 */
export async function updatePrimeProfile(userId, patch) {
  if (!isValidUserId(userId)) return { ok: false, error: 'Invalid user ID' };
  const validated = validateProfilePatch(patch);
  if (!validated.ok) return validated;

  const profilePatch = validated.value;
  const preferencePatch =
    validated.preferredLanguage !== undefined ? { preferredLanguage: validated.preferredLanguage } : {};

  if (Object.keys(profilePatch).length === 0 && Object.keys(preferencePatch).length === 0) {
    return { ok: false, error: 'Empty patch' };
  }

  const result = await updateUserMemory(userId, {
    ...(Object.keys(profilePatch).length ? { profile: profilePatch } : {}),
    ...(Object.keys(preferencePatch).length ? { preferences: preferencePatch } : {}),
  });
  if (!result.ok) return result;
  return getPrimeProfile(userId);
}

/**
 * Structured completeness — never a gamified percentage, just the honest
 * facts the Today/Profile UI needs to explain what unlocks what.
 *
 * Account functionality does not require these fields. Deeper
 * personalization (numerology / natal) does require a birth date.
 * Birth time absence is honest, not fabricated into an Ascendant.
 *
 * @param {ReturnType<typeof getPrimeProfile>['profile']} profile
 */
export function profileCompleteness(profile) {
  const hasBirthDate = Boolean(profile?.birth?.date);
  const hasBirthTime = Boolean(profile?.birth?.time);
  const hasBirthPlace = Boolean(profile?.birth?.place);
  const hasTimezone = Boolean(profile?.birth?.timezone);
  const hasRelationshipStatus = Boolean(profile?.relationshipStatus);
  const missingForDeeperPersonalization = [];
  if (!hasBirthDate) {
    missingForDeeperPersonalization.push({
      field: 'birthDate',
      unlocks: 'numeroloji ve natal gezegenler',
    });
  }
  if (hasBirthDate && !hasBirthTime) {
    missingForDeeperPersonalization.push({
      field: 'birthTime',
      unlocks: 'yükselen ve evler',
    });
  }
  if (hasBirthDate && !hasBirthPlace) {
    missingForDeeperPersonalization.push({
      field: 'birthPlace',
      unlocks: 'konum temelli natal hesap',
    });
  }

  return {
    hasBirthDate,
    hasBirthTime,
    hasBirthPlace,
    hasTimezone,
    hasRelationshipStatus,
    numerologyAvailable: hasBirthDate,
    natalPlanetsAvailable: Boolean(hasBirthDate && hasBirthPlace),
    natalHousesAvailable: Boolean(hasBirthDate && hasBirthPlace && hasBirthTime),
    accountFunctional: true,
    deeperPersonalizationReady: hasBirthDate,
    // CTA only when the field that actually unlocks personalization is missing.
    showCompleteProfileCta: !hasBirthDate,
    ctaLabel: 'Profilini tamamla',
    missingForDeeperPersonalization,
  };
}

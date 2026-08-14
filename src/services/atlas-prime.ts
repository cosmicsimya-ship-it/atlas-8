/**
 * Prime personal-center client — /api/prime/*. Server is authoritative for
 * everything here; this file only shapes requests/responses.
 */

import { apiRequest } from './api-client';

export type PrimeProfile = {
  displayName: string | null;
  birth: {
    date: string | null; // YYYY-MM-DD
    time: string | null; // HH:mm, null = honestly unknown
    place: string | null;
    timezone: string | null;
  };
  relationshipStatus: string | null;
  preferences: { language: string | null };
  profileUpdatedAt: string | null;
};

export type PrimeProfilePatch = Partial<{
  displayName: string | null;
  birth: Partial<PrimeProfile['birth']>;
  relationshipStatus: string | null;
  preferences: Partial<PrimeProfile['preferences']>;
}>;

export const RELATIONSHIP_STATUS_OPTIONS = [
  'single',
  'relationship',
  'married',
  'separated',
  'divorced',
  'widowed',
  'prefer_not_to_say',
] as const;

export type PrimeCompleteness = {
  hasBirthDate: boolean;
  hasBirthTime: boolean;
  hasBirthPlace: boolean;
  hasTimezone: boolean;
  hasRelationshipStatus: boolean;
  numerologyAvailable: boolean;
  natalPlanetsAvailable: boolean;
  natalHousesAvailable: boolean;
};

export type PrimeToday = {
  greeting: string;
  date: string;
  profile: { completeness: PrimeCompleteness | null; note: string | null };
  symbolic: {
    numerology: { available: boolean; lifePath: number | null; provenance: string } | null;
    natal: null;
  };
  natal: {
    available: boolean;
    sunSign?: string | null;
    fullChartAvailable?: boolean;
    birthTimeKnown?: boolean;
    warnings?: string[];
    provenance?: string;
    reason?: string;
  } | null;
  continueConversation: {
    id: string;
    updatedAt: string;
    preview: string;
    messageCount: number;
  } | null;
  usage: { plan: string; dailyUsed: number; dailyLimit: number };
};

export type PrimeMemoryFact = { key: string; value: string };

export async function fetchPrimeProfile(): Promise<PrimeProfile> {
  const res = await apiRequest<{ ok: boolean; profile: PrimeProfile }>('/api/prime/profile', {
    method: 'GET',
  });
  return res.profile;
}

export async function updatePrimeProfile(patch: PrimeProfilePatch): Promise<PrimeProfile> {
  const res = await apiRequest<{ ok: boolean; profile: PrimeProfile }>('/api/prime/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.profile;
}

export async function fetchPrimeToday(): Promise<PrimeToday> {
  const res = await apiRequest<{ ok: boolean; today: PrimeToday }>('/api/prime/today', {
    method: 'GET',
  });
  return res.today;
}

export async function fetchPrimeMemory(): Promise<PrimeMemoryFact[]> {
  const res = await apiRequest<{ ok: boolean; facts: PrimeMemoryFact[] }>('/api/prime/memory', {
    method: 'GET',
  });
  return res.facts;
}

export async function deletePrimeMemoryFact(key: string): Promise<void> {
  await apiRequest(`/api/prime/memory/${encodeURIComponent(key)}`, { method: 'DELETE' });
}

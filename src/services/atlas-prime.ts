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

export const ENERGY_OPTIONS = [
  { value: 'low', label: 'Düşük' },
  { value: 'steady', label: 'Dengeli' },
  { value: 'high', label: 'Yüksek' },
] as const;

export const FOCUS_OPTIONS = [
  { value: 'restore', label: 'Toparlan' },
  { value: 'think', label: 'Düşün' },
  { value: 'create', label: 'Üret' },
  { value: 'connect', label: 'Bağlan' },
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
  accountFunctional?: boolean;
  deeperPersonalizationReady?: boolean;
  showCompleteProfileCta?: boolean;
  ctaLabel?: string;
  missingForDeeperPersonalization?: Array<{ field: string; unlocks: string }>;
};

export type PrimeCheckin = {
  date: string;
  energy: 'low' | 'steady' | 'high';
  focus: 'restore' | 'think' | 'create' | 'connect';
  intention: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PrimeFrequency = {
  level: 'LOW' | 'BALANCED' | 'HIGH';
  framing: string;
  recommendation: string;
  recommendationLabel: string;
};

export type PrimeOutlookItem = {
  date: string;
  window: string;
  title: string;
  why: string;
  action: { label: string; href: string } | null;
  provenance: string;
};

export type PrimeOutlook = {
  available: boolean;
  items: PrimeOutlookItem[];
  reason: string | null;
  message: string | null;
  horizonDays?: number;
  cost?: { mode: string; aiCalls: number };
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
  checkIn?: {
    date: string;
    record: PrimeCheckin | null;
    frequency: PrimeFrequency | null;
    previous: {
      date: string;
      energy: PrimeCheckin['energy'];
      focus: PrimeCheckin['focus'];
      intention: string | null;
    } | null;
  } | null;
  outlook?: PrimeOutlook;
  memoryContinuity?: {
    available: boolean;
    statement: string | null;
    kind: string | null;
    action: { label: string; href: string };
  };
  primeWorld?: boolean;
  cost?: { mode: string; aiCalls: number; note?: string };
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

export async function fetchPrimeCheckinToday(): Promise<{
  date: string;
  checkin: PrimeCheckin | null;
  frequency: PrimeFrequency | null;
}> {
  const res = await apiRequest<{
    ok: boolean;
    date: string;
    checkin: PrimeCheckin | null;
    frequency: PrimeFrequency | null;
  }>('/api/prime/checkin/today', { method: 'GET' });
  return { date: res.date, checkin: res.checkin, frequency: res.frequency };
}

export async function submitPrimeCheckin(input: {
  energy: PrimeCheckin['energy'];
  focus: PrimeCheckin['focus'];
  intention?: string | null;
}): Promise<{ checkin: PrimeCheckin; frequency: PrimeFrequency | null }> {
  const res = await apiRequest<{ ok: boolean; checkin: PrimeCheckin; frequency: PrimeFrequency | null }>(
    '/api/prime/checkin',
    { method: 'POST', body: JSON.stringify(input) },
  );
  return { checkin: res.checkin, frequency: res.frequency };
}

export async function fetchPrimeOutlook(): Promise<PrimeOutlook> {
  const res = await apiRequest<{ ok: boolean; outlook: PrimeOutlook }>('/api/prime/outlook', {
    method: 'GET',
  });
  return res.outlook;
}

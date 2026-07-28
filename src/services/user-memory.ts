import { apiRequest } from './api-client';

export interface UserMemoryProfile {
  name: string | null;
  timezone: string | null;
  location: string | null;
  birthDate: string | null;
  birthTime: string | null;
  birthPlace: string | null;
  referenceDate: string | null;
  relationshipStatus: string | null;
}

export interface UserMemory {
  profile: UserMemoryProfile;
  preferences: Record<string, unknown>;
  facts: Record<string, unknown>;
  updatedAt: string | null;
}

export async function fetchUserMemory(userId: string): Promise<UserMemory> {
  const data = await apiRequest<{ userId: string; memory: UserMemory }>(
    `/api/memory/${encodeURIComponent(userId)}`,
  );
  return data.memory;
}

export async function patchUserMemory(
  userId: string,
  partial: Partial<UserMemory>,
): Promise<UserMemory> {
  const data = await apiRequest<{ memory: UserMemory }>(
    `/api/memory/${encodeURIComponent(userId)}`,
    { method: 'PATCH', body: JSON.stringify(partial) },
  );
  return data.memory;
}

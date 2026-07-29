import { apiRequest } from './api-client';
import { ensureAtlasSession, getWebUserId } from '../utils/atlas-session';

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

/**
 * Memory is scoped to the authenticated session cookie.
 * Path userId must match the server session; requester headers are not used for auth.
 */
export async function fetchUserMemory(userId?: string): Promise<UserMemory> {
  const session = await ensureAtlasSession();
  const id = userId && userId !== 'anonymous:pending' ? userId : session.userId || getWebUserId();
  const data = await apiRequest<{ userId: string; memory: UserMemory }>(
    `/api/memory/${encodeURIComponent(id!)}`,
  );
  return data.memory;
}

export async function patchUserMemory(
  userId: string | undefined,
  partial: Partial<UserMemory>,
): Promise<UserMemory> {
  const session = await ensureAtlasSession();
  const id = userId && userId !== 'anonymous:pending' ? userId : session.userId || getWebUserId();
  const data = await apiRequest<{ memory: UserMemory }>(
    `/api/memory/${encodeURIComponent(id!)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(partial),
    },
  );
  return data.memory;
}

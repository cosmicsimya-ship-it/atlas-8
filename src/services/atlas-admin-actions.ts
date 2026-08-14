/**
 * Admin write-action client — Phase B. Every function is a thin wrapper
 * over a real, existing /api/admin/users/:userId/* endpoint. No authority
 * field (adminId, role, plan, entitlements, ...) is ever sent from here —
 * the server derives the actor from the session and rejects any such field
 * anyway, but this client doesn't even offer the option.
 */

import { apiRequest } from './api-client';

export type AdminSubscription = {
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  provider: string | null;
};

export type AdminUserDetail = {
  userId: string;
  username: string | null;
  email: string | null;
  roles: string[];
  disabled: boolean;
  createdAt: string | null;
  lastActive: string | null;
  plan: string;
  subscriptionStatus: string;
  subscription: AdminSubscription | null;
  entitlements: {
    'voice.lara': boolean;
    'usage.extended': boolean;
    'image.analysis': boolean;
    'memory.extended': boolean;
  };
  usageToday: { dailyUsed: number; dailyLimit: number };
  conversationCount: number;
  memoryFactCount: number;
  profileCompleteness: Record<string, boolean> | null;
};

export type AdminActionResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; status?: number };

async function post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}
async function patch<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  return apiRequest<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
}

export async function fetchAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const res = await apiRequest<{ ok: boolean; user: AdminUserDetail }>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    { method: 'GET' },
  );
  return res.user;
}

export function grantPrime(userId: string, durationDays: number, reason?: string) {
  return post<{ ok: boolean; subscription: AdminSubscription; plan: string }>(
    `/api/admin/users/${encodeURIComponent(userId)}/prime/grant`,
    { durationDays, ...(reason ? { reason } : {}) },
  );
}

export function revokePrime(userId: string, reason?: string) {
  return post<{ ok: boolean; subscription: AdminSubscription }>(
    `/api/admin/users/${encodeURIComponent(userId)}/prime/revoke`,
    { ...(reason ? { reason } : {}) },
  );
}

export function extendPrime(userId: string, durationDays: number, reason?: string) {
  return post<{ ok: boolean; subscription: AdminSubscription; plan: string }>(
    `/api/admin/users/${encodeURIComponent(userId)}/prime/extend`,
    { durationDays, ...(reason ? { reason } : {}) },
  );
}

export function setPrimeExpiry(userId: string, expiryDate: string, reason?: string) {
  return patch<{ ok: boolean; subscription: AdminSubscription; plan: string }>(
    `/api/admin/users/${encodeURIComponent(userId)}/prime/expiry`,
    { expiryDate, ...(reason ? { reason } : {}) },
  );
}

export function resetUserUsage(userId: string, reason?: string) {
  return post<{ ok: boolean; usage: { dailyUsed: number; dailyLimit: number } }>(
    `/api/admin/users/${encodeURIComponent(userId)}/usage/reset`,
    { ...(reason ? { reason } : {}) },
  );
}

export function disableUser(userId: string, reason?: string) {
  return post<{ ok: boolean; disabled: boolean }>(
    `/api/admin/users/${encodeURIComponent(userId)}/account/disable`,
    { ...(reason ? { reason } : {}) },
  );
}

export function enableUser(userId: string, reason?: string) {
  return post<{ ok: boolean; disabled: boolean }>(
    `/api/admin/users/${encodeURIComponent(userId)}/account/enable`,
    { ...(reason ? { reason } : {}) },
  );
}

export function eraseUserPersonalData(userId: string, reason?: string) {
  return post<{ ok: boolean; memoryErased: boolean; conversationsDeleted: number }>(
    `/api/admin/users/${encodeURIComponent(userId)}/privacy/erase`,
    { ...(reason ? { reason } : {}) },
  );
}

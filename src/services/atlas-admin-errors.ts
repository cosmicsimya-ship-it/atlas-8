/**
 * Admin error/incident client. Thin wrappers over the real
 * /api/admin/errors/* endpoints.
 */

import { apiRequest } from './api-client';

export type ErrorEntry = {
  id: string;
  fingerprint: string;
  timestamp: string;
  firstSeen: string;
  lastSeen: string;
  source: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  code: string;
  safeMessage: string;
  route: string | null;
  userId: string | null;
  occurrenceCount: number;
  status: 'open' | 'investigating' | 'resolved' | 'ignored';
};

export async function fetchAdminErrorsList(params: {
  status?: string;
  severity?: string;
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<{ ok: boolean; entries: ErrorEntry[]; total: number; limit: number; offset: number }> {
  const qs = new URLSearchParams(
    Object.entries(params).reduce<Record<string, string>>((acc, [k, v]) => {
      if (v !== undefined && v !== null && v !== '') acc[k] = String(v);
      return acc;
    }, {}),
  ).toString();
  return apiRequest<{ ok: boolean; entries: ErrorEntry[]; total: number; limit: number; offset: number }>(
    `/api/admin/errors${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
}

export function updateAdminErrorStatus(id: string, status: ErrorEntry['status']) {
  return apiRequest<{ ok: boolean; error: ErrorEntry }>(`/api/admin/errors/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

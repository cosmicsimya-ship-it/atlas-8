/**
 * Entitlements client — mobile-ready plan / capability fetch.
 * Never trusts localStorage plan flags for authorization.
 */

import { apiRequest } from './api-client';

export type AtlasPlanId = 'guest' | 'free' | 'premium';

export type AtlasEntitlementsPayload = {
  authenticated: boolean;
  plan: AtlasPlanId | string;
  subscriptionStatus?: string;
  entitlements: Record<string, boolean>;
  subscription?: {
    plan: string;
    status: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | null;
  } | null;
  pricing?: {
    productId?: string | null;
    productName?: string | null;
    currency?: string;
    interval?: string;
    monthlyPrice?: number | null;
    displayPrice?: string | null;
  };
};

export async function fetchEntitlements(): Promise<AtlasEntitlementsPayload> {
  const res = await apiRequest<{
    ok: boolean;
    data: AtlasEntitlementsPayload;
  }>('/api/me/entitlements', { method: 'GET' });
  return res.data;
}

export function hasEntitlement(
  payload: AtlasEntitlementsPayload | null | undefined,
  capability: string,
): boolean {
  return Boolean(payload?.entitlements?.[capability]);
}

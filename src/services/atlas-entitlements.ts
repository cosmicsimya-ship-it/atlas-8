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

export function isPremiumPlan(payload: AtlasEntitlementsPayload | null | undefined): boolean {
  return payload?.plan === 'premium';
}

/**
 * Bounded entitlement refresh for payment-return race (server grant vs UI load).
 * Does not poll forever — fixed short attempts only.
 */
export async function fetchEntitlementsWithRetry(opts?: {
  attempts?: number;
  delayMs?: number;
  preferPremium?: boolean;
}): Promise<AtlasEntitlementsPayload> {
  const attempts = Math.max(1, Math.min(opts?.attempts ?? 3, 5));
  const delayMs = Math.max(0, opts?.delayMs ?? 400);
  const preferPremium = Boolean(opts?.preferPremium);

  let last: AtlasEntitlementsPayload | null = null;
  let lastError: unknown = null;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const data = await fetchEntitlements();
      last = data;
      if (!preferPremium || isPremiumPlan(data)) {
        return data;
      }
    } catch (err) {
      lastError = err;
    }
    if (i < attempts - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  if (last) return last;
  throw lastError instanceof Error ? lastError : new Error('Entitlement refresh failed');
}

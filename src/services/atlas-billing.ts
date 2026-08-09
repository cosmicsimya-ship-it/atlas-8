/**
 * Billing client — never holds Iyzico secrets or IBAN.
 */

import { apiRequest, ApiError } from './api-client';
import type { AtlasEntitlementsPayload } from './atlas-entitlements';

export type AtlasBillingConfig = {
  provider: string;
  dryRun: boolean;
  liveCheckoutEnabled: boolean;
  checkoutAvailable: boolean;
  product: {
    productId?: string;
    productName?: string;
    monthlyPrice?: number | null;
    currency?: string;
    interval?: string;
    displayPrice?: string | null;
  };
  features?: string[];
  manualBankTransfer?: { enabled: boolean; reason?: string };
};

export type AtlasBillingSubscriptionPayload = AtlasBillingConfig & {
  subscription: {
    plan: string;
    status: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | null;
  };
  entitlements?: AtlasEntitlementsPayload | null;
};

export async function fetchBillingConfig(): Promise<AtlasBillingConfig> {
  const res = await apiRequest<{ ok: boolean; data: AtlasBillingConfig }>('/api/billing/config', {
    method: 'GET',
  });
  return res.data;
}

export async function fetchBillingSubscription(): Promise<AtlasBillingSubscriptionPayload> {
  const res = await apiRequest<{ ok: boolean; data: AtlasBillingSubscriptionPayload }>(
    '/api/billing/subscription',
    { method: 'GET' },
  );
  return res.data;
}

export async function startPremiumCheckout(): Promise<{
  ok: boolean;
  dryRun?: boolean;
  liveCheckoutEnabled?: boolean;
  message?: string | null;
  product?: AtlasBillingConfig['product'];
  features?: string[];
  error?: { code?: string; message?: string } | null;
}> {
  try {
    const res = await apiRequest<{
      ok: boolean;
      data: {
        dryRun?: boolean;
        liveCheckoutEnabled?: boolean;
        message?: string | null;
        product?: AtlasBillingConfig['product'];
        features?: string[];
      };
      error?: { code?: string; message?: string } | null;
    }>('/api/billing/checkout', { method: 'POST', body: JSON.stringify({}) });
    return {
      ok: res.ok,
      ...res.data,
      error: res.error ?? null,
    };
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as {
        data?: {
          dryRun?: boolean;
          liveCheckoutEnabled?: boolean;
          product?: AtlasBillingConfig['product'];
          features?: string[];
        };
        error?: { code?: string; message?: string };
      } | null;
      return {
        ok: false,
        dryRun: body?.data?.dryRun,
        liveCheckoutEnabled: body?.data?.liveCheckoutEnabled,
        product: body?.data?.product,
        features: body?.data?.features,
        error: body?.error || { message: e.message },
      };
    }
    throw e;
  }
}

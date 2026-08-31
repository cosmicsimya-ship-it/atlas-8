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

export type AtlasCheckoutResult = {
  ok: boolean;
  dryRun?: boolean;
  liveCheckoutEnabled?: boolean;
  paymentPageUrl?: string | null;
  checkoutId?: string | null;
  token?: string | null;
  message?: string | null;
  product?: AtlasBillingConfig['product'];
  features?: string[];
  error?: { code?: string; message?: string } | null;
};

const CHECKOUT_UNAVAILABLE_MESSAGE =
  'Ödeme şu anda başlatılamıyor. Lütfen kısa süre sonra tekrar deneyin.';

/** Allow only https provider payment URLs (plus http localhost for sandbox tooling). */
export function isSafePaymentPageUrl(url: string | null | undefined): boolean {
  const raw = String(url || '').trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:') return true;
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

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

function safeCheckoutFailure(input?: {
  code?: string;
  dryRun?: boolean;
  liveCheckoutEnabled?: boolean;
  product?: AtlasBillingConfig['product'];
  features?: string[];
}): AtlasCheckoutResult {
  return {
    ok: false,
    dryRun: input?.dryRun,
    liveCheckoutEnabled: input?.liveCheckoutEnabled,
    paymentPageUrl: null,
    product: input?.product,
    features: input?.features,
    error: {
      code: input?.code,
      message: CHECKOUT_UNAVAILABLE_MESSAGE,
    },
  };
}

/**
 * Starts Premium checkout. Body is always empty — server owns price/currency/plan.
 * Provider/debug messages are never returned to the UI.
 */
export async function startPremiumCheckout(): Promise<AtlasCheckoutResult> {
  try {
    const res = await apiRequest<{
      ok: boolean;
      data: {
        dryRun?: boolean;
        liveCheckoutEnabled?: boolean;
        paymentPageUrl?: string | null;
        checkoutId?: string | null;
        token?: string | null;
        message?: string | null;
        product?: AtlasBillingConfig['product'];
        features?: string[];
      };
      error?: { code?: string; message?: string } | null;
    }>('/api/billing/checkout', { method: 'POST', body: JSON.stringify({}) });

    if (!res.ok) {
      console.error('[billing] checkout rejected', {
        code: res.error?.code,
        message: res.error?.message,
      });
      return safeCheckoutFailure({
        code: res.error?.code,
        dryRun: res.data?.dryRun,
        liveCheckoutEnabled: res.data?.liveCheckoutEnabled,
        product: res.data?.product,
        features: res.data?.features,
      });
    }

    return {
      ok: true,
      dryRun: res.data?.dryRun,
      liveCheckoutEnabled: res.data?.liveCheckoutEnabled,
      paymentPageUrl: res.data?.paymentPageUrl ?? null,
      checkoutId: res.data?.checkoutId ?? null,
      token: res.data?.token ?? null,
      message: res.data?.message ?? null,
      product: res.data?.product,
      features: res.data?.features,
      error: null,
    };
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as {
        data?: {
          dryRun?: boolean;
          liveCheckoutEnabled?: boolean;
          paymentPageUrl?: string | null;
          product?: AtlasBillingConfig['product'];
          features?: string[];
        };
        error?: { code?: string; message?: string };
      } | null;
      console.error('[billing] checkout API error', {
        status: e.status,
        code: body?.error?.code,
        message: body?.error?.message || e.message,
      });
      return safeCheckoutFailure({
        code: body?.error?.code,
        dryRun: body?.data?.dryRun,
        liveCheckoutEnabled: body?.data?.liveCheckoutEnabled,
        product: body?.data?.product,
        features: body?.data?.features,
      });
    }

    console.error('[billing] checkout unexpected error', e);
    return safeCheckoutFailure();
  }
}

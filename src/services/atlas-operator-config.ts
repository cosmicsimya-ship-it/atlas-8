/**
 * Public operator/support identity — backs the trust/legal/contact pages.
 * Every field may be `null` when the operator has not configured it yet;
 * callers must render an explicit "not configured" state rather than
 * inventing a value. See server/config/operator-config.js.
 */

import { apiRequest } from './api-client';

export type AtlasOperatorConfig = {
  brandName: string;
  productName: string;
  supportEmail: string | null;
  billingSupportEmail: string | null;
  legalOperatorName: string | null;
  legalOperatorAddress: string | null;
  legalTaxId: string | null;
  supportResponseNote: string;
};

const FALLBACK: AtlasOperatorConfig = {
  brandName: 'Cosmic Simya',
  productName: 'Lara Prime',
  supportEmail: null,
  billingSupportEmail: null,
  legalOperatorName: null,
  legalOperatorAddress: null,
  legalTaxId: null,
  supportResponseNote:
    'Destek talepleri gönderim sırasına göre değerlendirilir. Şu an için taahhüt edilen bir yanıt süresi bulunmamaktadır.',
};

export async function fetchOperatorConfig(): Promise<AtlasOperatorConfig> {
  try {
    const res = await apiRequest<{ ok: boolean; operator: AtlasOperatorConfig }>(
      '/api/public/operator',
      { method: 'GET' },
    );
    return res.operator ?? FALLBACK;
  } catch {
    // Network/backend failure — trust pages must still render their static
    // legal content; only the dynamic support-identity fields degrade.
    return FALLBACK;
  }
}

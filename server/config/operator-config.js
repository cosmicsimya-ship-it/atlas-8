// ═══════════════════════════════════════════════════════════════════════
// Public-safe operator / support identity config.
//
// This is deliberately separate from the owner/admin bootstrap identity in
// server/auth/account-store.js (OWNER_EMAIL). That identity exists to grant
// admin roles on login and must never be exposed to visitors as a support
// contact. This module exists so the *public* support/contact identity can
// be configured independently, without touching auth/admin code, and
// without ever being able to leak the owner-bootstrap email by accident.
//
// Every field here is env-driven and null by default. Nothing is invented:
// if an operator has not configured a value, the field is null and the
// frontend must render an explicit "not yet configured" state rather than
// a fabricated placeholder that could be mistaken for a real value.
// ═══════════════════════════════════════════════════════════════════════

function nonEmpty(value) {
  if (value == null) return null;
  const str = String(value).trim();
  return str ? str : null;
}

/**
 * @returns {{
 *   brandName: string,
 *   productName: string,
 *   supportEmail: string|null,
 *   billingSupportEmail: string|null,
 *   legalOperatorName: string|null,
 *   legalOperatorAddress: string|null,
 *   legalTaxId: string|null,
 *   supportResponseNote: string,
 * }}
 */
export function getPublicOperatorConfig() {
  const supportEmail = nonEmpty(process.env.ATLAS_SUPPORT_EMAIL);
  // Billing support falls back to the general support address only when an
  // operator has explicitly configured at least one of the two — never a
  // fabricated address of any kind.
  const billingSupportEmail = nonEmpty(process.env.ATLAS_BILLING_SUPPORT_EMAIL) || supportEmail;

  return {
    brandName: 'Cosmic Simya',
    productName: String(process.env.PREMIUM_PRODUCT_NAME || 'Lara Prime').trim() || 'Lara Prime',
    supportEmail,
    billingSupportEmail,
    legalOperatorName: nonEmpty(process.env.ATLAS_LEGAL_OPERATOR_NAME),
    legalOperatorAddress: nonEmpty(process.env.ATLAS_LEGAL_OPERATOR_ADDRESS),
    legalTaxId: nonEmpty(process.env.ATLAS_LEGAL_TAX_ID),
    // Deliberately non-committal — no response-time SLA has been decided.
    // Do not replace this with a specific number without a business decision.
    supportResponseNote:
      nonEmpty(process.env.ATLAS_SUPPORT_RESPONSE_NOTE) ||
      'Destek talepleri gönderim sırasına göre değerlendirilir. Şu an için taahhüt edilen bir yanıt süresi bulunmamaktadır.',
  };
}

/**
 * Future-ready manual bank transfer surface — DISABLED.
 * IBAN must never be returned here until product explicitly activates the flow.
 */

export const MANUAL_BANK_TRANSFER_ENABLED = false;

/**
 * @returns {{ enabled: false, reason: string }}
 */
export function getManualBankTransferOffer() {
  return {
    enabled: false,
    reason: 'manual_bank_transfer_disabled',
  };
}

/**
 * Placeholder for future: create pending transfer + payment reference.
 * Must not grant Premium and must not expose IBAN in this build.
 */
export function createManualBankTransferIntent() {
  return {
    ok: false,
    enabled: false,
    error: 'manual_bank_transfer_disabled',
  };
}

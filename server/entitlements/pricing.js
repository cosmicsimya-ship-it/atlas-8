/**
 * Display-only Premium pricing config.
 * Not a payment source of truth — provider will own billing when connected.
 */

/**
 * @returns {{
 *   productId: string,
 *   productName: string,
 *   monthlyPrice: number|null,
 *   currency: string,
 *   interval: 'month',
 *   displayPrice: string|null,
 * }}
 */
export function getPremiumPricingConfig() {
  const currency = String(process.env.PREMIUM_CURRENCY || 'TRY').trim().toUpperCase() || 'TRY';
  const raw = process.env.PREMIUM_MONTHLY_PRICE_TRY ?? process.env.PREMIUM_MONTHLY_PRICE;
  const monthlyPrice =
    raw != null && String(raw).trim() !== '' && Number.isFinite(Number(raw))
      ? Number(raw)
      : null;

  let displayPrice = null;
  if (monthlyPrice != null) {
    try {
      displayPrice = new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(monthlyPrice);
    } catch {
      displayPrice = `${monthlyPrice} ${currency}`;
    }
  }

  return {
    productId: String(process.env.PREMIUM_PRODUCT_ID || 'atlas_premium_monthly').trim(),
    productName: String(process.env.PREMIUM_PRODUCT_NAME || 'Atlas Premium').trim(),
    monthlyPrice,
    currency,
    interval: 'month',
    displayPrice,
  };
}

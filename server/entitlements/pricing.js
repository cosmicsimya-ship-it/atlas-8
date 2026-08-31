/**
 * Canonical Premium pricing config.
 *
 * This is the single server-side price source used by both the public billing
 * config and checkout/verification. The environment may override the product
 * price, but the application never accepts an amount from the client.
 */

const DEFAULT_PREMIUM_MONTHLY_PRICE_TRY = 299;

/**
 * @returns {{
 *   productId: string,
 *   productName: string,
 *   monthlyPrice: number,
 *   currency: string,
 *   interval: 'month',
 *   displayPrice: string,
 * }}
 */
export function getPremiumPricingConfig() {
  const currency = String(process.env.PREMIUM_CURRENCY || 'TRY').trim().toUpperCase() || 'TRY';
  const raw = process.env.PREMIUM_MONTHLY_PRICE_TRY ?? process.env.PREMIUM_MONTHLY_PRICE;
  const configuredPrice =
    raw != null && String(raw).trim() !== '' && Number.isFinite(Number(raw))
      ? Number(raw)
      : null;
  const monthlyPrice = configuredPrice ?? DEFAULT_PREMIUM_MONTHLY_PRICE_TRY;

  let displayPrice;
  try {
    displayPrice = new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(monthlyPrice);
  } catch {
    displayPrice = `${monthlyPrice} ${currency}`;
  }

  return {
    productId: String(process.env.PREMIUM_PRODUCT_ID || 'atlas_premium_monthly').trim(),
    productName: String(process.env.PREMIUM_PRODUCT_NAME || 'Lara Prime').trim(),
    monthlyPrice,
    currency,
    interval: 'month',
    displayPrice,
  };
}

export { DEFAULT_PREMIUM_MONTHLY_PRICE_TRY };

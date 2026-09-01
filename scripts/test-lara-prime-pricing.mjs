#!/usr/bin/env node

import { getPremiumPricingConfig } from '../server/entitlements/pricing.js';
import { getPublicBillingConfig } from '../server/billing/config.js';

let passed = 0;
let failed = 0;

function ok(name, condition) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

const saved = {
  monthlyTry: process.env.PREMIUM_MONTHLY_PRICE_TRY,
  monthlyLegacy: process.env.PREMIUM_MONTHLY_PRICE,
  currency: process.env.PREMIUM_CURRENCY,
};

try {
  delete process.env.PREMIUM_MONTHLY_PRICE_TRY;
  delete process.env.PREMIUM_MONTHLY_PRICE;
  delete process.env.PREMIUM_CURRENCY;

  console.log('\n=== Lara Prime canonical pricing ===\n');

  const fallback = getPremiumPricingConfig();
  ok('default monthly price is 299 TRY', fallback.monthlyPrice === 299 && fallback.currency === 'TRY');
  ok('default display price is available', typeof fallback.displayPrice === 'string' && fallback.displayPrice.includes('299'));

  const publicConfig = getPublicBillingConfig();
  ok('public billing config uses the same 299 TRY authority', publicConfig.product?.monthlyPrice === 299 && publicConfig.product?.currency === 'TRY');

  process.env.PREMIUM_MONTHLY_PRICE_TRY = '349';
  const override = getPremiumPricingConfig();
  ok('valid server env overrides the default', override.monthlyPrice === 349);

  process.env.PREMIUM_MONTHLY_PRICE_TRY = 'not-a-number';
  const invalid = getPremiumPricingConfig();
  ok('invalid server env fails safely to canonical default', invalid.monthlyPrice === 299);
} finally {
  if (saved.monthlyTry == null) delete process.env.PREMIUM_MONTHLY_PRICE_TRY;
  else process.env.PREMIUM_MONTHLY_PRICE_TRY = saved.monthlyTry;

  if (saved.monthlyLegacy == null) delete process.env.PREMIUM_MONTHLY_PRICE;
  else process.env.PREMIUM_MONTHLY_PRICE = saved.monthlyLegacy;

  if (saved.currency == null) delete process.env.PREMIUM_CURRENCY;
  else process.env.PREMIUM_CURRENCY = saved.currency;
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

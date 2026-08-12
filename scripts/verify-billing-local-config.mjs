#!/usr/bin/env node
/**
 * Local billing config verification — no real charges, no secret printing.
 */
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  assertIyzicoSandboxOnly,
  getPublicBillingConfig,
} from '../server/billing/config.js';
import { createIyzicoBillingProvider } from '../server/billing/providers/iyzico.js';
import { startCheckout, setBillingProviderForTests } from '../server/billing/service.js';

process.env.ATLAS_BILLING_DRY_RUN = 'true';
process.env.ATLAS_BILLING_LIVE_CHECKOUT = 'false';
process.env.IYZICO_BASE_URL = 'https://sandbox-api.iyzipay.com';
process.env.PREMIUM_MONTHLY_PRICE_TRY = process.env.PREMIUM_MONTHLY_PRICE_TRY || '299';
process.env.PREMIUM_CURRENCY = process.env.PREMIUM_CURRENCY || 'TRY';

let network = 0;
const provider = createIyzicoBillingProvider({
  dryRun: true,
  liveCheckoutEnabled: false,
  apiKey: 'sandbox-not-used',
  secretKey: 'sandbox-not-used',
  baseUrl: 'https://sandbox-api.iyzipay.com',
  nodeEnv: 'test',
  fetch: async (url) => {
    network += 1;
    throw new Error(`unexpected_network:${url}`);
  },
});
setBillingProviderForTests(provider);
const co = await startCheckout({ userId: 'web:dryrun-net-check' });
setBillingProviderForTests(null);

console.log('DRYRUN_CHECKOUT_OK', co.ok === true);
console.log('DRYRUN_NETWORK_CALLS', network);
console.log('DRYRUN_TOKEN_IS_DRY', String(co.token || '').startsWith('dry_'));
console.log('DRYRUN_PAYMENT_PAGE', co.paymentPageUrl);

console.log(
  'PROD_GUARD_API',
  assertIyzicoSandboxOnly('https://api.iyzipay.com', 'test').allowed === false,
);
console.log(
  'PROD_GUARD_NODE',
  assertIyzicoSandboxOnly('https://sandbox-api.iyzipay.com', 'production').allowed ===
    false,
);
console.log(
  'SANDBOX_GUARD',
  assertIyzicoSandboxOnly('https://sandbox-api.iyzipay.com', 'test').allowed === true,
);

const pub = getPublicBillingConfig();
const pubJson = JSON.stringify(pub);
console.log('PUBLIC_KEYS', Object.keys(pub).sort().join(','));
console.log(
  'PUBLIC_HAS_SECRET_FIELDS',
  /apiKey|secretKey|iban|webhookSecret|IYZICO_/i.test(pubJson),
);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir, { withFileTypes: true })) {
    if (n.name === 'node_modules' || n.name === 'dist') continue;
    const p = join(dir, n.name);
    if (n.isDirectory()) walk(p, out);
    else if (/\.(js|mjs|ts|tsx|html|css)$/i.test(n.name)) out.push(p);
  }
  return out;
}

let leak = false;
for (const f of [...walk('src'), ...walk('server')]) {
  if (f.includes('test-billing')) continue;
  const t = readFileSync(f, 'utf8');
  if (/\bTR\d{24}\b/.test(t)) leak = true;
  if (/IYZICO_API_KEY\s*=\s*['"][^'"]+['"]/.test(t)) leak = true;
  if (/IYZICO_SECRET_KEY\s*=\s*['"][^'"]+['"]/.test(t)) leak = true;
}
let clientRef = false;
for (const f of walk('src')) {
  const t = readFileSync(f, 'utf8');
  if (/IYZICO_API_KEY|IYZICO_SECRET_KEY|PREMIUM_PAYOUT_IBAN/.test(t)) clientRef = true;
}
console.log('SECRET_LEAK_SOURCE', leak ? 'FAIL' : 'PASS');
console.log('SECRET_LEAK_CLIENT_ENV_REF', clientRef ? 'FAIL' : 'PASS');

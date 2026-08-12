#!/usr/bin/env node
/**
 * Billing preflight — no secret printing, no live checkout, no env mutation.
 */
import 'dotenv/config';
import express from 'express';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  assertIyzicoSandboxOnly,
  getBillingConfig,
  getPublicBillingConfig,
} from '../server/billing/config.js';
import { createBillingRouter } from '../server/billing/index.js';
import {
  startCheckout,
  setBillingProviderForTests,
} from '../server/billing/service.js';
import { createIyzicoBillingProvider } from '../server/billing/providers/iyzico.js';

function flag(name, ok) {
  console.log(`${name} ${ok ? 'PASS' : 'FAIL'}`);
}

const keySet = Boolean(String(process.env.IYZICO_API_KEY || '').trim());
const secretSet = Boolean(String(process.env.IYZICO_SECRET_KEY || '').trim());
console.log(`IYZICO_API_KEY ${keySet ? 'SET' : 'MISSING'}`);
console.log(`IYZICO_SECRET_KEY ${secretSet ? 'SET' : 'MISSING'}`);

const cfg = getBillingConfig();
const baseOk =
  String(cfg.iyzico.baseUrl || '')
    .toLowerCase()
    .includes('sandbox-api.iyzipay.com') && cfg.sandboxGate.allowed;
flag('sandbox_config', baseOk);

const priceOk = cfg.pricing.monthlyPrice === 299 && cfg.pricing.currency === 'TRY';
flag('price', priceOk);

const dryOk =
  cfg.dryRun === true && cfg.liveCheckoutEnabled === false;
flag('dry_run_flags', dryOk);

const pub = getPublicBillingConfig();
const pubJson = JSON.stringify(pub);
const pubLeak = /apiKey|secretKey|iban|webhookSecret|IYZICO_/i.test(pubJson);
flag('public_config_secret_leak', !pubLeak);

// HTTP mount callback + public config
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.auth = { authenticated: false, isAnonymous: true };
  next();
});
app.use(
  '/api/billing',
  createBillingRouter({
    requireAuth: (_r, _s, n) => n(),
    requireCsrf: (_r, _s, n) => n(),
  }),
);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const httpCfgRes = await fetch(`${base}/api/billing/config`);
const httpCfg = await httpCfgRes.json();
const httpLeak = /apiKey|secretKey|iban|webhookSecret|IYZICO_/i.test(
  JSON.stringify(httpCfg),
);
flag('http_public_config', httpCfgRes.status === 200 && !httpLeak);

const cb = await fetch(`${base}/api/billing/callback/iyzico?format=json`);
const cbJ = await cb.json();
flag(
  'callback',
  cb.status === 200 &&
    cbJ?.data?.status === 'invalid' &&
    String(cbJ?.data?.redirectUrl || '').includes('/#/billing/result'),
);

server.close();

// Dry-run checkout with network trap
let network = 0;
const provider = createIyzicoBillingProvider({
  dryRun: true,
  liveCheckoutEnabled: false,
  apiKey: keySet ? 'present' : '',
  secretKey: secretSet ? 'present' : '',
  baseUrl: 'https://sandbox-api.iyzipay.com',
  nodeEnv: 'test',
  fetch: async (url) => {
    network += 1;
    throw new Error(`unexpected_network:${url}`);
  },
});
setBillingProviderForTests(provider);
const checkout = await startCheckout({ userId: 'web:preflight-dryrun' });
setBillingProviderForTests(null);
flag(
  'dry_run',
  checkout.ok === true &&
    String(checkout.token || '').startsWith('dry_') &&
    checkout.paymentPageUrl == null &&
    network === 0 &&
    checkout.dryRun === true,
);

flag(
  'production_guard',
  assertIyzicoSandboxOnly('https://api.iyzipay.com', 'test').allowed === false &&
    assertIyzicoSandboxOnly('https://sandbox-api.iyzipay.com', 'production')
      .allowed === false &&
    assertIyzicoSandboxOnly('https://sandbox-api.iyzipay.com', 'test').allowed ===
      true,
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
  if (f.includes('test-billing') || f.includes('verify-billing')) continue;
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
flag('secret_leakage_scan', !leak && !clientRef);

#!/usr/bin/env node
/**
 * HTTP mount + frontend route verification for billing callback.
 * No real Iyzico charges. Does not print secrets.
 */
import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { createBillingRouter } from '../server/billing/index.js';

process.env.ATLAS_BILLING_DRY_RUN = 'true';
process.env.ATLAS_BILLING_LIVE_CHECKOUT = 'false';
process.env.IYZICO_BASE_URL = 'https://sandbox-api.iyzipay.com';
process.env.BILLING_RESULT_ORIGIN = 'http://localhost:5173';
process.env.PREMIUM_MONTHLY_PRICE_TRY = process.env.PREMIUM_MONTHLY_PRICE_TRY || '299';
process.env.PREMIUM_CURRENCY = process.env.PREMIUM_CURRENCY || 'TRY';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

const cfgRes = await fetch(`${base}/api/billing/config`);
const cfg = await cfgRes.json();
const cfgS = JSON.stringify(cfg);
console.log('HTTP_CONFIG_STATUS', cfgRes.status);
console.log('HTTP_CONFIG_DRY_RUN', cfg.data?.dryRun);
console.log('HTTP_CONFIG_LIVE', cfg.data?.liveCheckoutEnabled);
console.log(
  'HTTP_CONFIG_PUBLIC_ONLY',
  !/apiKey|secretKey|iban|IYZICO_|webhookSecret/i.test(cfgS),
);

const cbGet = await fetch(`${base}/api/billing/callback/iyzico?format=json`, {
  redirect: 'manual',
});
const cbGetJ = await cbGet.json();
console.log('HTTP_CALLBACK_GET_STATUS', cbGet.status);
console.log('HTTP_CALLBACK_GET_RESULT', cbGetJ?.data?.status);
console.log('HTTP_CALLBACK_GET_REDIRECT_HAS_RESULT', String(cbGetJ?.data?.redirectUrl || '').includes('/#/billing/result'));
console.log(
  'HTTP_CALLBACK_GET_LEAK',
  /token=|IYZICO_|SECRET/i.test(JSON.stringify(cbGetJ)) ? 'YES' : 'NO',
);

const cbPost = await fetch(`${base}/api/billing/callback/iyzico?format=json`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
  redirect: 'manual',
});
const cbPostJ = await cbPost.json();
console.log('HTTP_CALLBACK_POST_STATUS', cbPost.status);
console.log('HTTP_CALLBACK_POST_RESULT', cbPostJ?.data?.status);

const appTsx = readFileSync('src/App.tsx', 'utf8');
const pageOk = existsSync('src/pages/BillingResultPage.tsx');
console.log(
  'FRONTEND_ROUTE_DECLARED',
  appTsx.includes('billing/result') && appTsx.includes('BillingResultPage'),
);
console.log('FRONTEND_PAGE_FILE', pageOk);
const page = readFileSync('src/pages/BillingResultPage.tsx', 'utf8');
console.log(
  'FRONTEND_PAGE_NO_SECRET_LIT',
  !/IYZICO_API_KEY|IYZICO_SECRET_KEY|secretKey|apiKey\s*=/.test(page),
);

server.close();

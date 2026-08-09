#!/usr/bin/env node
/**
 * Entitlement / Premium membership tests (no payment, no ElevenLabs).
 * Run: node scripts/test-entitlements.mjs
 */

import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmpStore = mkdtempSync(join(tmpdir(), 'atlas-ent-'));
const subPath = join(tmpStore, 'subscriptions.json');

process.env.ATLAS_TTS_PROVIDER = 'mock';
process.env.ATLAS_TTS_DRY_RUN = 'false';
process.env.ATLAS_TTS_DAILY_REQUEST_QUOTA = '1000';
delete process.env.ATLAS_PREMIUM_USER_IDS;
delete process.env.ELEVENLABS_API_KEY;

import {
  ATLAS_PLANS,
  CAPABILITIES,
  configureSubscriptionStore,
  resetSubscriptionStoreForTests,
  upsertSubscription,
  resolveEntitlements,
  buildEntitlementsResponse,
  requireVoiceLara,
  createEntitlementsRouter,
} from '../server/entitlements/index.js';
import { createVoiceRouter, synthesizeSpeech } from '../server/voice/index.js';

configureSubscriptionStore(subPath);
resetSubscriptionStoreForTests();

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

function mockRes() {
  /** @type {any} */
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

async function runGuard(auth, body = {}) {
  const mw = requireVoiceLara();
  const req = { auth, body };
  const res = mockRes();
  let nextCalled = false;
  await new Promise((resolve) => {
    mw(req, res, () => {
      nextCalled = true;
      resolve(undefined);
    });
    if (res.body) resolve(undefined);
  });
  return { res, nextCalled };
}

console.log('\n=== Entitlements / Premium ===\n');

// Guest
{
  const g = resolveEntitlements({ authenticated: false });
  ok('guest plan', g.plan === ATLAS_PLANS.GUEST);
  ok('guest atlas.basic', g.entitlements[CAPABILITIES.ATLAS_BASIC] === true);
  ok('guest voice.lara false', g.entitlements[CAPABILITIES.VOICE_LARA] === false);
  const guard = await runGuard({ authenticated: false, isAnonymous: true, userId: 'anonymous:x' });
  ok('guest voice → 403', guard.res.statusCode === 403 && !guard.nextCalled);
  ok('guest error premium_required', guard.res.body?.error?.code === 'premium_required');
  ok('guest feature voice.lara', guard.res.body?.error?.feature === 'voice.lara');
}

// Free (registered, no subscription)
{
  const auth = {
    authenticated: true,
    userId: 'web:free-user-1',
    isAnonymous: false,
    roles: ['user'],
  };
  const f = resolveEntitlements(auth);
  ok('free plan', f.plan === ATLAS_PLANS.FREE);
  ok('free history', f.entitlements[CAPABILITIES.ATLAS_HISTORY] === true);
  ok('free voice.lara false', f.entitlements[CAPABILITIES.VOICE_LARA] === false);
  const guard = await runGuard(auth);
  ok('free voice → 403', guard.res.statusCode === 403);
  ok('free premium_required', guard.res.body?.error?.code === 'premium_required');
}

// Premium active
{
  const userId = 'web:premium-user-1';
  upsertSubscription({
    userId,
    plan: ATLAS_PLANS.PREMIUM,
    status: 'active',
    provider: 'manual_cli',
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 86400000 * 30).toISOString(),
  });
  const auth = {
    authenticated: true,
    userId,
    isAnonymous: false,
    roles: ['user'],
  };
  const p = resolveEntitlements(auth);
  ok('premium plan', p.plan === ATLAS_PLANS.PREMIUM);
  ok('premium voice.lara', p.entitlements[CAPABILITIES.VOICE_LARA] === true);
  ok('premium multilingual', p.entitlements[CAPABILITIES.VOICE_MULTILINGUAL] === true);
  const guard = await runGuard(auth);
  ok('premium voice auth PASS', guard.nextCalled === true && guard.res.statusCode === 200);

  // TR + EN synthesis still works under mock (authorization already passed conceptually)
  const tr = await synthesizeSpeech({
    text: 'Merhaba Premium.',
    voice: 'lara',
    language: 'tr-TR',
    userKey: userId,
    skipCache: true,
  });
  const en = await synthesizeSpeech({
    text: 'Hello Premium.',
    voice: 'lara',
    language: 'en-US',
    userKey: userId,
    skipCache: true,
  });
  ok('premium TR synthesis ok', tr.ok && tr.language === 'tr-TR');
  ok('premium EN synthesis ok', en.ok && en.language === 'en-US');
}

// Expired premium does not grant
{
  const userId = 'web:expired-user';
  upsertSubscription({
    userId,
    plan: ATLAS_PLANS.PREMIUM,
    status: 'expired',
    currentPeriodEnd: new Date(Date.now() - 86400000).toISOString(),
  });
  const r = resolveEntitlements({
    authenticated: true,
    userId,
    isAnonymous: false,
    roles: ['user'],
  });
  ok('expired → free entitlements', r.plan === ATLAS_PLANS.FREE);
  ok('expired no voice.lara', r.entitlements[CAPABILITIES.VOICE_LARA] === false);
}

// Client plan tampering ignored
{
  const auth = {
    authenticated: true,
    userId: 'web:tamper-user',
    isAnonymous: false,
    roles: ['user'],
  };
  // No subscription — free
  const resolved = resolveEntitlements(auth);
  ok('tamper baseline free', resolved.plan === ATLAS_PLANS.FREE);
  // Even if someone mutates a forged object, resolve never reads client plan
  const forged = resolveEntitlements({ ...auth, plan: 'premium', entitlements: { 'voice.lara': true } });
  ok('forged auth.plan ignored', forged.plan === ATLAS_PLANS.FREE);
  ok('forged entitlements ignored', forged.entitlements[CAPABILITIES.VOICE_LARA] === false);
  const guard = await runGuard(auth, { plan: 'premium', entitlements: { 'voice.lara': true } });
  ok('tamper body still 403', guard.res.statusCode === 403);
}

// Public entitlements payload safety
{
  const userId = 'web:premium-user-1';
  const payload = buildEntitlementsResponse({
    authenticated: true,
    userId,
    isAnonymous: false,
    roles: ['user'],
  });
  const json = JSON.stringify(payload);
  ok('no providerCustomerId leak', !json.includes('providerCustomerId'));
  ok('no providerSubscriptionId leak', !json.includes('providerSubscriptionId'));
  ok('no api key leak', !json.toLowerCase().includes('apikey') && !json.includes('ELEVENLABS'));
  ok('pricing display fields present', payload.pricing && 'currency' in payload.pricing);
}

// HTTP router: entitlements GET + synthesize gate (no listen — Windows-safe)
{
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = req.headers['x-test-auth']
      ? JSON.parse(String(req.headers['x-test-auth']))
      : { authenticated: false, isAnonymous: true, userId: 'anonymous:http' };
    next();
  });
  app.use('/api/me/entitlements', createEntitlementsRouter());
  app.use(
    '/api/voice',
    createVoiceRouter({
      requireCsrf: (_req, _res, next) => next(),
      requireVoiceLara: requireVoiceLara(),
    }),
  );

  /**
   * @param {string} method
   * @param {string} url
   * @param {{ auth?: object, body?: object, headers?: Record<string,string> }} [opts]
   */
  function dispatch(method, url, opts = {}) {
    return new Promise((resolve) => {
      /** @type {any} */
      const req = {
        method,
        url,
        originalUrl: url,
        path: url,
        headers: {
          'content-type': 'application/json',
          ...(opts.headers || {}),
          ...(opts.auth
            ? { 'x-test-auth': JSON.stringify(opts.auth) }
            : {}),
        },
        body: opts.body || {},
        query: {},
        auth: undefined,
        ip: '127.0.0.1',
      };
      /** @type {any} */
      const res = {
        statusCode: 200,
        body: null,
        headers: {},
        status(code) {
          this.statusCode = code;
          return this;
        },
        setHeader(k, v) {
          this.headers[k] = v;
        },
        json(payload) {
          this.body = payload;
          resolve({ status: this.statusCode, json: payload });
          return this;
        },
        send(payload) {
          this.body = payload;
          resolve({ status: this.statusCode, json: null, raw: payload });
          return this;
        },
      };
      app.handle(req, res, (err) => {
        if (err) {
          resolve({ status: 500, json: { error: String(err.message || err) } });
        }
      });
    });
  }

  const guestEnt = await dispatch('GET', '/api/me/entitlements');
  ok('http guest entitlements', guestEnt.status === 200 && guestEnt.json?.data?.plan === 'guest');

  const guestSynth = await dispatch('POST', '/api/voice/synthesize', {
    body: { text: 'Merhaba', voice: 'lara', language: 'tr-TR' },
  });
  ok(
    'http guest synth 403',
    guestSynth.status === 403 && guestSynth.json?.error?.code === 'premium_required',
  );

  const freeSynth = await dispatch('POST', '/api/voice/synthesize', {
    auth: {
      authenticated: true,
      userId: 'web:free-http',
      isAnonymous: false,
      roles: ['user'],
    },
    body: {
      text: 'Hi',
      voice: 'lara',
      language: 'en-US',
      plan: 'premium',
    },
  });
  ok(
    'http free+tamper synth 403',
    freeSynth.status === 403 && freeSynth.json?.error?.code === 'premium_required',
  );

  const premSynth = await dispatch('POST', '/api/voice/synthesize', {
    auth: {
      authenticated: true,
      userId: 'web:premium-user-1',
      isAnonymous: false,
      roles: ['user'],
    },
    headers: { accept: 'application/json' },
    body: {
      text: 'Welcome',
      voice: 'lara',
      language: 'en-US',
      returnJson: true,
    },
  });
  ok(
    'http premium synth authorized',
    premSynth.status === 200 && (premSynth.json?.ok === true || Buffer.isBuffer(premSynth.raw)),
  );

  const postEnt = await dispatch('POST', '/api/me/entitlements', {
    auth: {
      authenticated: true,
      userId: 'web:free-http',
      isAnonymous: false,
      roles: ['user'],
    },
    body: { plan: 'premium' },
  });
  ok('http self-grant POST rejected', postEnt.status === 405);
}

try {
  rmSync(tmpStore, { recursive: true, force: true });
} catch {
  /* ignore */
}

console.log(`\nEntitlements result: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

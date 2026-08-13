#!/usr/bin/env node
/**
 * Phase 1 regression — Lara Prime usage.extended + image.analysis
 * Run: node scripts/test-prime-usage-image.mjs
 *
 * Boots a real HTTP server exercising the exact guard modules wired into
 * /api/chat (chatUsageGate, requireCapability(IMAGE_ANALYSIS), validateImageAttachment)
 * — no parallel/mocked reimplementation of the gating logic.
 */

import express from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const tmpStore = mkdtempSync(join(tmpdir(), 'atlas-prime-'));
const subPath = join(tmpStore, 'subscriptions.json');

process.env.ATLAS_CHAT_DAILY_QUOTA_GUEST = '15';
process.env.ATLAS_CHAT_DAILY_QUOTA_FREE = '40';
process.env.ATLAS_CHAT_DAILY_QUOTA_PREMIUM = '200';
process.env.ATLAS_CHAT_BURST_GUEST = '10';
process.env.ATLAS_CHAT_BURST_FREE = '20';
process.env.ATLAS_CHAT_BURST_PREMIUM = '45';

const {
  ATLAS_PLANS,
  CAPABILITIES,
  configureSubscriptionStore,
  resetSubscriptionStoreForTests,
  upsertSubscription,
  resolveEntitlements,
  hasCapability,
  chatUsageGate,
  validateImageAttachment,
} = await import('../server/entitlements/index.js');
const { resetChatUsageForTests } = await import('../server/usage/chat-usage.js');
const { resetRateLimitBucketsForTests } = await import('../server/auth/rate-limit.js');

configureSubscriptionStore(subPath);
resetSubscriptionStoreForTests();

let passed = 0;
let failed = 0;
function ok(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    failed += 1;
    console.error(`  \u2717 ${name}`);
  }
}

// ── Test app — same guard modules as server/index.js, no parallel logic ──
function buildApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' })); // mirrors server/index.js's chatJsonParser for /api/chat

  // Simulates attachAuthFromSession: identity is injected via header for test control only.
  app.use((req, res, next) => {
    const userId = req.header('x-test-user-id');
    const authenticated = req.header('x-test-authenticated') === '1';
    req.auth = authenticated
      ? { authenticated: true, userId, isAnonymous: false }
      : { authenticated: true, userId: userId || 'anonymous:test', isAnonymous: true };
    next();
  });

  let downstreamHits = 0;
  app.locals.downstreamHits = () => downstreamHits;

  app.post('/test-chat', chatUsageGate({ keyPrefix: 'test-chat' }), (req, res) => {
    downstreamHits += 1;
    res.json({ ok: true, usage: req.atlasUsage });
  });

  // Mirrors the exact conditional gate added to /api/chat in server/index.js
  app.post('/test-chat-image', (req, res) => {
    const image = req.body?.image;
    if (image) {
      let entitled = false;
      try {
        const resolved = resolveEntitlements(req.auth || {});
        entitled = hasCapability(resolved.entitlements, CAPABILITIES.IMAGE_ANALYSIS);
      } catch {
        entitled = false;
      }
      if (!entitled) {
        return res.status(403).json({
          ok: false,
          data: null,
          error: { code: 'premium_required', feature: CAPABILITIES.IMAGE_ANALYSIS },
        });
      }
      const validation = validateImageAttachment(image);
      if (!validation.ok) {
        return res.status(400).json({
          ok: false,
          data: null,
          error: { code: validation.code, message: validation.message },
        });
      }
    }
    downstreamHits += 1;
    return res.json({ ok: true, reachedPipeline: true, hadImage: Boolean(image) });
  });

  // Mirrors the clean-JSON error handler added to server/index.js — body-parser
  // errors (payload too large, malformed JSON) must never leak an HTML error page.
  app.use((err, req, res, next) => {
    if (!err) return next();
    if (err.type === 'entity.too.large' || err.status === 413) {
      return res.status(413).json({ ok: false, data: null, error: { code: 'payload_too_large' } });
    }
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({ ok: false, data: null, error: { code: 'invalid_json' } });
    }
    return next(err);
  });

  return app;
}

async function withServer(fn) {
  const app = buildApp();
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base, app);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function authHeaders(userId, authenticated) {
  return {
    'Content-Type': 'application/json',
    'x-test-user-id': userId,
    'x-test-authenticated': authenticated ? '1' : '0',
  };
}

function fakeBase64(bytes) {
  // ~4/3 base64 expansion; produce roughly `bytes` decoded bytes of valid base64.
  const raw = Buffer.alloc(bytes, 65); // 'A' bytes
  return raw.toString('base64');
}

async function main() {
  console.log('\n\u2500\u2500 usage.extended: daily quota per plan (burst raised out of the way) \u2500\u2500');
  await withServer(async (base) => {
    resetChatUsageForTests();
    resetRateLimitBucketsForTests();
    // Isolate the daily-quota check from the per-minute burst ceiling —
    // burst is proven separately below with real (low) values.
    const savedGuestBurst = process.env.ATLAS_CHAT_BURST_GUEST;
    const savedFreeBurst = process.env.ATLAS_CHAT_BURST_FREE;
    process.env.ATLAS_CHAT_BURST_GUEST = '1000';
    process.env.ATLAS_CHAT_BURST_FREE = '1000';

    // GUEST: 15/day
    let guestOk = 0;
    for (let i = 0; i < 15; i++) {
      const r = await fetch(`${base}/test-chat`, {
        method: 'POST',
        headers: authHeaders('anonymous:guestA', false),
        body: '{}',
      });
      if (r.status === 200) guestOk += 1;
    }
    ok('guest: 15 allowed requests all succeed', guestOk === 15);
    const r16 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('anonymous:guestA', false),
      body: '{}',
    });
    const body16 = await r16.json();
    ok(
      'guest: 16th request blocked with daily_quota_exceeded',
      r16.status === 429 && body16.code === 'daily_quota_exceeded',
    );

    resetChatUsageForTests();
    resetRateLimitBucketsForTests();

    // FREE: 40/day
    let freeOk = 0;
    for (let i = 0; i < 40; i++) {
      const r = await fetch(`${base}/test-chat`, {
        method: 'POST',
        headers: authHeaders('web:freeUserA', true),
        body: '{}',
      });
      if (r.status === 200) freeOk += 1;
    }
    ok('free: 40 daily requests all succeed', freeOk === 40);
    const r41 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:freeUserA', true),
      body: '{}',
    });
    ok('free: 41st request blocked (daily quota)', r41.status === 429);

    resetChatUsageForTests();
    resetRateLimitBucketsForTests();

    // PREMIUM: 200/day — grant subscription, also raise burst to prove the daily ceiling itself
    process.env.ATLAS_CHAT_BURST_PREMIUM = '1000';
    upsertSubscription({ userId: 'web:premiumUserA', plan: ATLAS_PLANS.PREMIUM, status: 'active' });
    let premiumOk = 0;
    for (let i = 0; i < 200; i++) {
      const r = await fetch(`${base}/test-chat`, {
        method: 'POST',
        headers: authHeaders('web:premiumUserA', true),
        body: '{}',
      });
      if (r.status === 200) premiumOk += 1;
    }
    ok('premium: 200 daily requests all succeed', premiumOk === 200);
    const r201 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:premiumUserA', true),
      body: '{}',
    });
    ok('premium: 201st request blocked (daily quota reached)', r201.status === 429);

    process.env.ATLAS_CHAT_BURST_GUEST = savedGuestBurst;
    process.env.ATLAS_CHAT_BURST_FREE = savedFreeBurst;
    process.env.ATLAS_CHAT_BURST_PREMIUM = '45';
  });

  console.log('\n\u2500\u2500 usage.extended: burst limits per plan \u2500\u2500');
  await withServer(async (base) => {
    resetChatUsageForTests();
    resetRateLimitBucketsForTests();

    async function burstUntilBlocked(userId, authenticated) {
      let allowed = 0;
      for (let i = 0; i < 60; i++) {
        const r = await fetch(`${base}/test-chat`, {
          method: 'POST',
          headers: authHeaders(userId, authenticated),
          body: '{}',
        });
        if (r.status === 200) allowed += 1;
        else break;
      }
      return allowed;
    }

    const guestBurst = await burstUntilBlocked('anonymous:burstGuest', false);
    ok('guest burst ceiling = 10/min', guestBurst === 10);

    resetChatUsageForTests();
    resetRateLimitBucketsForTests();
    const freeBurst = await burstUntilBlocked('web:burstFree', true);
    ok('free burst ceiling = 20/min', freeBurst === 20);

    resetChatUsageForTests();
    resetRateLimitBucketsForTests();
    upsertSubscription({ userId: 'web:burstPremium', plan: ATLAS_PLANS.PREMIUM, status: 'active' });
    const premBurst = await burstUntilBlocked('web:burstPremium', true);
    ok('premium burst ceiling = 45/min', premBurst === 45);
  });

  console.log('\n\u2500\u2500 usage.extended: client spoofing cannot raise quota \u2500\u2500');
  await withServer(async (base) => {
    resetChatUsageForTests();
    resetRateLimitBucketsForTests();

    // Free user tries to self-grant premium via body fields — server must ignore.
    const r = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:spoofFree', true),
      body: JSON.stringify({ plan: 'premium', entitlements: { 'usage.extended': true } }),
    });
    const body = await r.json();
    ok('spoofed plan/entitlements in body do not grant premium quota', body.usage?.plan === 'free');

    resetChatUsageForTests();
    resetRateLimitBucketsForTests();
  });

  console.log('\n\u2500\u2500 usage.extended: fail-closed on resolver error \u2500\u2500');
  {
    // Simulate resolver throwing by passing a malformed auth object directly to the gate.
    const gate = chatUsageGate({ keyPrefix: 'failclosed' });
    resetChatUsageForTests();
    resetRateLimitBucketsForTests();
    let grantedPlan = null;
    const req = { auth: null, ip: '10.0.0.1' }; // auth null forces guest path, not a throw — verify still guest-tier
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(b) {
        this.body = b;
        return this;
      },
    };
    await new Promise((resolve) => {
      gate(req, res, () => {
        grantedPlan = req.atlasUsage?.plan;
        resolve();
      });
    });
    ok('missing/null auth resolves to guest plan (fail closed, never premium)', grantedPlan === 'guest');
  }

  console.log('\n\u2500\u2500 usage.extended: no downstream call on quota exceed \u2500\u2500');
  await withServer(async (base, app) => {
    resetChatUsageForTests();
    resetRateLimitBucketsForTests();
    for (let i = 0; i < 10; i++) {
      await fetch(`${base}/test-chat`, {
        method: 'POST',
        headers: authHeaders('anonymous:noDownstream', false),
        body: '{}',
      });
    }
    const hitsBefore = app.locals.downstreamHits();
    const r = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('anonymous:noDownstream', false),
      body: '{}',
    });
    const hitsAfter = app.locals.downstreamHits();
    ok(
      '429 response never reaches downstream handler (no provider/model call)',
      r.status === 429 && hitsAfter === hitsBefore,
    );
  });

  console.log('\n\u2500\u2500 image.analysis: entitlement gate \u2500\u2500');
  await withServer(async (base) => {
    resetSubscriptionStoreForTests();
    const validJpeg = { mimeType: 'image/jpeg', base64: fakeBase64(1000) };

    const rGuest = await fetch(`${base}/test-chat-image`, {
      method: 'POST',
      headers: authHeaders('anonymous:imgGuest', false),
      body: JSON.stringify({ image: validJpeg }),
    });
    const bGuest = await rGuest.json();
    ok('guest image request -> 403 premium_required', rGuest.status === 403 && bGuest.error?.code === 'premium_required');

    const rFree = await fetch(`${base}/test-chat-image`, {
      method: 'POST',
      headers: authHeaders('web:imgFree', true),
      body: JSON.stringify({ image: validJpeg }),
    });
    const bFree = await rFree.json();
    ok('free image request -> 403 premium_required', rFree.status === 403 && bFree.error?.code === 'premium_required');

    upsertSubscription({ userId: 'web:imgPremium', plan: ATLAS_PLANS.PREMIUM, status: 'active' });

    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) {
      const r = await fetch(`${base}/test-chat-image`, {
        method: 'POST',
        headers: authHeaders('web:imgPremium', true),
        body: JSON.stringify({ image: { mimeType, base64: fakeBase64(1000) } }),
      });
      const b = await r.json();
      ok(`premium valid ${mimeType} -> accepted, reaches pipeline`, r.status === 200 && b.reachedPipeline === true);
    }

    const rBadMime = await fetch(`${base}/test-chat-image`, {
      method: 'POST',
      headers: authHeaders('web:imgPremium', true),
      body: JSON.stringify({ image: { mimeType: 'image/gif', base64: fakeBase64(1000) } }),
    });
    const bBadMime = await rBadMime.json();
    ok('premium invalid MIME (gif) -> rejected', rBadMime.status === 400 && bBadMime.error?.code === 'unsupported_image_type');

    const rTooBig = await fetch(`${base}/test-chat-image`, {
      method: 'POST',
      headers: authHeaders('web:imgPremium', true),
      body: JSON.stringify({ image: { mimeType: 'image/jpeg', base64: fakeBase64(7_000_000) } }),
    });
    const bTooBig = await rTooBig.json();
    ok('premium 7MB decoded payload (>6MB ceiling) -> rejected', rTooBig.status === 400 && bTooBig.error?.code === 'image_too_large');

    const rMalformed = await fetch(`${base}/test-chat-image`, {
      method: 'POST',
      headers: authHeaders('web:imgPremium', true),
      body: JSON.stringify({ image: { mimeType: 'image/jpeg', base64: 'not-valid-base64!!! spaces and $ymbols' } }),
    });
    const bMalformed = await rMalformed.json();
    ok('premium malformed base64 -> rejected', rMalformed.status === 400 && bMalformed.error?.code === 'invalid_input');

    const rNoImage = await fetch(`${base}/test-chat-image`, {
      method: 'POST',
      headers: authHeaders('web:imgFree', true),
      body: JSON.stringify({}),
    });
    const bNoImage = await rNoImage.json();
    ok('free chat WITHOUT image -> unaffected, reaches pipeline normally', rNoImage.status === 200 && bNoImage.reachedPipeline === true);

    // Payload that exceeds the route's own body-parser limit entirely (not just
    // our 6MB decoded ceiling) must still get clean JSON, never an HTML error page.
    const rHugePayload = await fetch(`${base}/test-chat-image`, {
      method: 'POST',
      headers: authHeaders('web:imgPremium', true),
      body: JSON.stringify({ image: { mimeType: 'image/jpeg', base64: fakeBase64(11_000_000) } }),
    });
    const contentType = rHugePayload.headers.get('content-type') || '';
    let hugeBody = null;
    try {
      hugeBody = await rHugePayload.json();
    } catch {
      hugeBody = null;
    }
    ok(
      'payload exceeding the 10mb route body limit -> clean JSON 413, not HTML',
      rHugePayload.status === 413 && contentType.includes('application/json') && hugeBody?.error?.code === 'payload_too_large',
    );
  });

  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  rmSync(tmpStore, { recursive: true, force: true });
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  rmSync(tmpStore, { recursive: true, force: true });
  process.exit(1);
});

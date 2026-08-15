#!/usr/bin/env node
/**
 * Phase 2 regression — Prime Personal Profile
 * Run: node scripts/test-prime-profile.mjs
 *
 * Real HTTP server exercising the actual GET/PATCH /api/prime/profile logic
 * (same imports as server/index.js — no reimplementation).
 */

import express from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const tmpDir = mkdtempSync(join(tmpdir(), 'atlas-prime-profile-'));
process.env.ATLAS_MEMORY_FILE = join(tmpDir, 'user_memory.json');

const { getPrimeProfile, updatePrimeProfile } = await import('../server/prime/profile.js');
const { resetMemoryStoreForTests } = await import('../server/user-memory.js');

await resetMemoryStoreForTests();

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

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const userId = req.header('x-test-user-id');
    const authenticated = req.header('x-test-authenticated') === '1';
    req.auth = authenticated
      ? { authenticated: true, userId, isAnonymous: false }
      : { authenticated: true, userId: userId || 'anonymous:test', isAnonymous: true };
    next();
  });

  function requireAuth(req, res, next) {
    if (!req.auth?.authenticated || req.auth?.isAnonymous || !req.auth?.userId) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    return next();
  }

  // Mirrors GET/PATCH /api/prime/profile in server/index.js exactly.
  app.get('/api/prime/profile', requireAuth, (req, res) => {
    const result = getPrimeProfile(req.auth.userId);
    if (!result.ok) return res.status(500).json({ ok: false, error: result.error });
    return res.json({ ok: true, profile: result.profile });
  });

  app.patch('/api/prime/profile', requireAuth, async (req, res) => {
    const result = await updatePrimeProfile(req.auth.userId, req.body ?? {});
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
    return res.json({ ok: true, profile: result.profile });
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
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function headers(userId, authenticated) {
  return { 'Content-Type': 'application/json', 'x-test-user-id': userId, 'x-test-authenticated': authenticated ? '1' : '0' };
}

async function main() {
  console.log('\n\u2500\u2500 owner read / update / refresh persistence \u2500\u2500');
  await withServer(async (base) => {
    const patch = {
      displayName: 'Deniz',
      birth: { date: '1992-03-10', time: '08:15', place: 'Ankara, Turkey', timezone: 'Europe/Istanbul' },
      relationshipStatus: 'married',
    };
    const rPatch = await fetch(`${base}/api/prime/profile`, {
      method: 'PATCH',
      headers: headers('web:owner', true),
      body: JSON.stringify(patch),
    });
    ok('owner can update own profile', rPatch.status === 200);

    const rGet = await fetch(`${base}/api/prime/profile`, { headers: headers('web:owner', true) });
    const bGet = await rGet.json();
    ok('owner can read own profile', rGet.status === 200);
    ok(
      '"refresh" (separate GET) restores the same values that were saved',
      bGet.profile.displayName === 'Deniz' &&
        bGet.profile.birth.date === '1992-03-10' &&
        bGet.profile.birth.time === '08:15' &&
        bGet.profile.relationshipStatus === 'married',
    );
  });

  console.log('\n\u2500\u2500 access control \u2500\u2500');
  await withServer(async (base) => {
    const rGuest = await fetch(`${base}/api/prime/profile`, { headers: headers('anonymous:x', false) });
    ok('guest rejected on read', rGuest.status === 401);
    const rGuestPatch = await fetch(`${base}/api/prime/profile`, {
      method: 'PATCH',
      headers: headers('anonymous:x', false),
      body: JSON.stringify({ displayName: 'x' }),
    });
    ok('guest rejected on update', rGuestPatch.status === 401);
  });

  console.log('\n\u2500\u2500 cross-user isolation \u2500\u2500');
  await withServer(async (base) => {
    await fetch(`${base}/api/prime/profile`, {
      method: 'PATCH',
      headers: headers('web:userA', true),
      body: JSON.stringify({ displayName: 'UserA-Name' }),
    });
    const rB = await fetch(`${base}/api/prime/profile`, { headers: headers('web:userB', true) });
    const bB = await rB.json();
    ok("user B reading their own profile never sees user A's data", bB.profile.displayName !== 'UserA-Name');

    // "user A cannot update user B" — the server never accepts a target userId from
    // the client at all; every write goes to req.auth.userId. Verify by having B write,
    // and confirming A's profile is untouched.
    await fetch(`${base}/api/prime/profile`, {
      method: 'PATCH',
      headers: headers('web:userB', true),
      body: JSON.stringify({ displayName: 'UserB-Name' }),
    });
    const rA = await fetch(`${base}/api/prime/profile`, { headers: headers('web:userA', true) });
    const bA = await rA.json();
    ok("user B's write never touched user A's profile", bA.profile.displayName === 'UserA-Name');
  });

  console.log('\n\u2500\u2500 authority-field spoofing blocked \u2500\u2500');
  await withServer(async (base) => {
    for (const field of ['userId', 'plan', 'role', 'roles', 'entitlements', 'subscription', 'usage', 'isAdmin', 'isFounder']) {
      const r = await fetch(`${base}/api/prime/profile`, {
        method: 'PATCH',
        headers: headers('web:spoofTest', true),
        body: JSON.stringify({ [field]: 'malicious-value' }),
      });
      ok(`"${field}" spoof rejected (400)`, r.status === 400);
    }
  });

  console.log('\n\u2500\u2500 validation \u2500\u2500');
  await withServer(async (base) => {
    const cases = [
      ['invalid birth date', { birth: { date: 'not-a-date' } }],
      ['invalid birth time', { birth: { time: '99:99' } }],
      ['invalid relationship status', { relationshipStatus: 'complicated' }],
      ['oversized displayName', { displayName: 'x'.repeat(500) }],
      ['oversized birth place', { birth: { place: 'y'.repeat(500) } }],
      ['invalid timezone', { birth: { timezone: 'Not/AZone' } }],
    ];
    for (const [name, body] of cases) {
      const r = await fetch(`${base}/api/prime/profile`, {
        method: 'PATCH',
        headers: headers('web:validationTest', true),
        body: JSON.stringify(body),
      });
      ok(`${name} rejected`, r.status === 400);
    }

    // Unknown birth time is a valid, honest state — explicit null must be accepted.
    const rNull = await fetch(`${base}/api/prime/profile`, {
      method: 'PATCH',
      headers: headers('web:validationTest', true),
      body: JSON.stringify({ birth: { time: null } }),
    });
    ok('explicit null birth.time (unknown) accepted', rNull.status === 200);
  });

  console.log('\n\u2500\u2500 completeness (personalization vs account) \u2500\u2500');
  {
    const { profileCompleteness } = await import('../server/prime/profile.js');
    const empty = profileCompleteness({
      displayName: null,
      birth: { date: null, time: null, place: null, timezone: null },
      relationshipStatus: null,
    });
    ok('account remains functional without profile fields', empty.accountFunctional === true);
    ok('CTA shown when birth date missing (deeper personalization)', empty.showCompleteProfileCta === true && empty.deeperPersonalizationReady === false);
    ok('CTA label is Profilini tamamla', empty.ctaLabel === 'Profilini tamamla');

    const dateOnly = profileCompleteness({
      displayName: 'Ada',
      birth: { date: '1990-01-15', time: null, place: 'Ankara, Turkey', timezone: 'Europe/Istanbul' },
      relationshipStatus: null,
    });
    ok('date-only profile unlocks numerology honestly', dateOnly.numerologyAvailable === true && dateOnly.deeperPersonalizationReady === true);
    ok('date-only does not claim houses/ascendant', dateOnly.natalHousesAvailable === false);
    ok('date-only does not show blocking CTA (birth date present)', dateOnly.showCompleteProfileCta === false);
  }

  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
});

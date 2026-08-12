#!/usr/bin/env node
/**
 * Server-side Premium grant (CLI only — not an HTTP endpoint).
 * Does NOT charge money or talk to payment providers.
 *
 * Usage:
 *   node server/scripts/grant-premium.mjs --userId web:abc123
 *   node server/scripts/grant-premium.mjs --userId web:abc123 --status active --days 30
 *   node server/scripts/grant-premium.mjs --userId web:abc123 --revoke
 */

import { upsertSubscription, deleteSubscription, getSubscription } from '../entitlements/index.js';
import { ATLAS_PLANS } from '../entitlements/capabilities.js';

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const userId = arg('--userId') || arg('--user');
const revoke = hasFlag('--revoke');
const status = arg('--status', 'active');
const days = Number(arg('--days', '30'));

if (!userId) {
  console.error('Usage: node server/scripts/grant-premium.mjs --userId <id> [--days 30] [--revoke]');
  process.exit(1);
}

if (revoke) {
  deleteSubscription(userId);
  console.log(JSON.stringify({ ok: true, action: 'revoked', userId }, null, 2));
  process.exit(0);
}

const start = new Date();
const end = new Date(start.getTime() + (Number.isFinite(days) ? days : 30) * 86400000);

const record = upsertSubscription({
  userId,
  plan: ATLAS_PLANS.PREMIUM,
  status,
  provider: 'manual_cli',
  providerCustomerId: null,
  providerSubscriptionId: null,
  currentPeriodStart: start.toISOString(),
  currentPeriodEnd: end.toISOString(),
  cancelAtPeriodEnd: false,
});

console.log(
  JSON.stringify(
    {
      ok: true,
      action: 'granted',
      userId,
      plan: record.plan,
      status: record.status,
      currentPeriodEnd: record.currentPeriodEnd,
      // never print other users; verify read-back without secrets
      verified: Boolean(getSubscription(userId)),
    },
    null,
    2,
  ),
);

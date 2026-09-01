// ═══════════════════════════════════════════════════════════════════════
// Test: server/analytics/store.js + server/analytics/events.js
//
// Covers the Phase 6 minimum list for analytics:
//  - event schema validates (known event name accepted)
//  - PII / message content is never stored
//  - aggregates are correct
//  - a malformed event (unknown name) is rejected
// ═══════════════════════════════════════════════════════════════════════

import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';

import {
  configureAnalyticsStore,
  resetAnalyticsStoreForTests,
  recordAnalyticsEvent,
  getAnalyticsAggregate,
  getAnalyticsStorePath,
  EVENT_NAMES,
} from '../server/analytics/store.js';
import { trackEvent } from '../server/analytics/events.js';

const tmpDir = mkdtempSync(join(tmpdir(), 'atlas-analytics-test-'));
const storeFile = join(tmpDir, 'analytics_events.test.json');
configureAnalyticsStore(storeFile);
resetAnalyticsStoreForTests(storeFile);

let failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log(`  ok   - ${label}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL - ${label}`);
    console.error(`         ${err.message}`);
  }
}

console.log('[test-analytics-events] store path:', getAnalyticsStorePath());

check('known event name is accepted and persisted', () => {
  const result = recordAnalyticsEvent({ name: 'message_sent', userId: 'web:user-1', source: 'web' });
  assert.strictEqual(result.ok, true);
  const store = JSON.parse(readFileSync(storeFile, 'utf8'));
  assert.strictEqual(store.events.length, 1);
  assert.strictEqual(store.events[0].name, 'message_sent');
  assert.strictEqual(store.events[0].v, 1);
});

check('malformed event (unknown name) is rejected, not silently coerced', () => {
  const before = JSON.parse(readFileSync(storeFile, 'utf8')).events.length;
  const result = recordAnalyticsEvent({ name: 'totally_made_up_event', userId: 'web:user-1' });
  assert.strictEqual(result.ok, false);
  const after = JSON.parse(readFileSync(storeFile, 'utf8')).events.length;
  assert.strictEqual(after, before); // nothing written for a rejected event
});

check('malformed event (missing name) is rejected', () => {
  const result = recordAnalyticsEvent({ userId: 'web:user-1' });
  assert.strictEqual(result.ok, false);
});

check('PII-shaped prop keys are stripped, not stored', () => {
  recordAnalyticsEvent({
    name: 'feedback_submitted',
    userId: 'web:user-1',
    props: {
      email: 'someone@example.com',
      message: 'this is the actual chat message content',
      content: 'reply body',
      ip: '1.2.3.4',
      kind: 'thumbs', // legitimate, small, non-PII prop — should survive
    },
  });
  const store = JSON.parse(readFileSync(storeFile, 'utf8'));
  const entry = store.events.find((e) => e.name === 'feedback_submitted');
  assert.ok(entry);
  assert.strictEqual(entry.props.email, undefined);
  assert.strictEqual(entry.props.message, undefined);
  assert.strictEqual(entry.props.content, undefined);
  assert.strictEqual(entry.props.ip, undefined);
  assert.strictEqual(entry.props.kind, 'thumbs');
});

check('no IP or user-agent field exists anywhere on a stored entry', () => {
  const store = JSON.parse(readFileSync(storeFile, 'utf8'));
  for (const entry of store.events) {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(entry, 'ip'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(entry, 'userAgent'), false);
  }
});

check('aggregate counts match the entries written', () => {
  resetAnalyticsStoreForTests(storeFile);
  recordAnalyticsEvent({ name: 'login', userId: 'a' });
  recordAnalyticsEvent({ name: 'login', userId: 'b' });
  recordAnalyticsEvent({ name: 'thumbs_up', userId: 'a' });
  const agg = getAnalyticsAggregate();
  assert.strictEqual(agg.totalEvents, 3);
  assert.strictEqual(agg.countsByName.login, 2);
  assert.strictEqual(agg.countsByName.thumbs_up, 1);
  assert.strictEqual(agg.countsByName.signup, 0);
});

check('trackEvent() wrapper delegates correctly and never throws', () => {
  const result = trackEvent('quran_lookup', { userId: 'web:user-9', source: 'web' });
  assert.strictEqual(result.ok, true);
  // @ts-ignore intentional bad input
  const badResult = trackEvent(undefined);
  assert.strictEqual(badResult.ok, false);
});

check('EVENT_NAMES vocabulary matches the spec list', () => {
  const expected = [
    'login',
    'signup',
    'google_login',
    'message_sent',
    'response_generated',
    'quran_lookup',
    'dream_interpretation',
    'feedback_submitted',
    'thumbs_up',
    'thumbs_down',
    'prime_viewed',
    'pricing_viewed',
  ];
  for (const name of expected) {
    assert.ok(EVENT_NAMES.includes(name), `missing event name: ${name}`);
  }
});

rmSync(tmpDir, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n[test-analytics-events] ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\n[test-analytics-events] all checks passed.');

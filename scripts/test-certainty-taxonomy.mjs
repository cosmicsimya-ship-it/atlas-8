// ═══════════════════════════════════════════════════════════════════════
// Test: certainty-taxonomy bridge (Knowledge Gap Policy acceptance
// criteria — see docs/atlas-domain-platform/SECURITY_AND_EPISTEMIC_POLICY.md
// §7 "Acceptance criteria and tests").
//
// This is a doc/code drift guard: it fails whenever source-policy.js gains
// a new FACT_LAYER_LABELS key without a corresponding entry in
// certainty-taxonomy.js, or when a mapped value isn't a real
// domain-core CERTAINTY_LEVELS entry — the two conditions the migration
// recommendation depends on staying true.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'assert';
import { FACT_LAYER_LABELS } from '../server/knowledge-domains/source-policy.js';
import { SOURCE_POLICY } from '../server/knowledge-domains/source-policy.js';
import { CERTAINTY_LEVELS } from '../server/domain-core/schemas.js';
import {
  FACT_LAYER_TO_CERTAINTY,
  CERTAINTY_TO_CONFIDENCE,
  certaintyForFactLayer,
  confidenceForFactLayer,
  getUnmappedFactLayers,
  getInvalidCertaintyValues,
} from '../server/knowledge-domains/certainty-taxonomy.js';

let failures = 0;
async function check(label, fn) {
  try {
    await fn();
    console.log(`  ok   - ${label}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL - ${label}`);
    console.error(`         ${err.message}`);
  }
}

console.log('[test-certainty-taxonomy] drift guards');

await check('every FACT_LAYER_LABELS key has a certainty mapping', () => {
  const unmapped = getUnmappedFactLayers();
  assert.deepStrictEqual(unmapped, [], `unmapped fact layers: ${unmapped.join(', ')}`);
});

await check('every mapped certainty value is a real CERTAINTY_LEVELS entry', () => {
  const invalid = getInvalidCertaintyValues();
  assert.deepStrictEqual(invalid, [], `fact layers with invalid certainty: ${invalid.join(', ')}`);
});

await check('FACT_LAYER_TO_CERTAINTY has no stale keys (every key still exists in FACT_LAYER_LABELS)', () => {
  const stale = Object.keys(FACT_LAYER_TO_CERTAINTY).filter((k) => !(k in FACT_LAYER_LABELS));
  assert.deepStrictEqual(stale, [], `stale mapping keys no longer in FACT_LAYER_LABELS: ${stale.join(', ')}`);
});

await check('every CERTAINTY_LEVELS entry has a confidence tier', () => {
  for (const level of CERTAINTY_LEVELS) {
    assert.ok(
      ['high', 'medium', 'low'].includes(CERTAINTY_TO_CONFIDENCE[level]),
      `missing/invalid confidence tier for certainty=${level}`,
    );
  }
});

console.log('[test-certainty-taxonomy] spot-check known mappings (documents the reconciliation, catches accidental reordering)');

const expectedSpotChecks = [
  ['primary_text', 'factual', 'high'],
  ['scholarly_consensus', 'factual', 'high'],
  ['tradition_belief', 'interpretive', 'medium'],
  ['symbolic_interpretation', 'interpretive', 'medium'],
  ['modern_claim', 'speculative', 'low'],
  ['disputed_uncertain', 'speculative', 'low'],
];

for (const [factLayer, expectedCertainty, expectedConfidence] of expectedSpotChecks) {
  await check(`${factLayer} → certainty=${expectedCertainty}, confidence=${expectedConfidence}`, () => {
    assert.strictEqual(certaintyForFactLayer(factLayer), expectedCertainty);
    assert.strictEqual(confidenceForFactLayer(factLayer), expectedConfidence);
  });
}

console.log('[test-certainty-taxonomy] Knowledge Gap Policy cross-domain consistency (item 11)');

await check('every knowledge domain fails closed by default (no domain is exempt)', () => {
  const domainsWithoutFailClosed = Object.entries(SOURCE_POLICY)
    .filter(([, policy]) => policy.failClosed !== true)
    .map(([id]) => id);
  assert.deepStrictEqual(
    domainsWithoutFailClosed,
    [],
    `domains not fail-closed: ${domainsWithoutFailClosed.join(', ')} — the Knowledge Gap Policy requires every domain to fail closed uniformly`,
  );
});

await check('every knowledge domain declares at least one fact layer', () => {
  const domainsWithoutFactLayers = Object.entries(SOURCE_POLICY)
    .filter(([, policy]) => !Array.isArray(policy.factLayers) || policy.factLayers.length === 0)
    .map(([id]) => id);
  assert.deepStrictEqual(domainsWithoutFactLayers, []);
});

await check('every declared fact layer for every domain is a real FACT_LAYER_LABELS key', () => {
  const bad = [];
  for (const [domainId, policy] of Object.entries(SOURCE_POLICY)) {
    for (const layer of policy.factLayers || []) {
      if (!(layer in FACT_LAYER_LABELS)) bad.push(`${domainId}.${layer}`);
    }
  }
  assert.deepStrictEqual(bad, []);
});

console.log(
  failures === 0
    ? '\n[test-certainty-taxonomy] all checks passed.'
    : `\n[test-certainty-taxonomy] ${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);

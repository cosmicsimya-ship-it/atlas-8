// ═══════════════════════════════════════════════════════════════════════
// Test: semantic claim-to-verse Qur'an citation verification
// (server/quran-verse-lookup/semantic-verify.js).
//
// This is the SECOND gate, after structural verification: a citation can
// name a verse that genuinely exists (structural check passes) yet not
// support the claim it's attached to. Deterministic-first — resolves the
// verified verse translation via the same trusted retrieval path used
// elsewhere, then a fixed, non-generative keyword-overlap comparison
// decides relevance. No model is ever asked to judge its own citation.
//
// Runs through finalizeMessageResult() — the single shared finalization
// path both web and Telegram go through — so these unit-level checks on
// the exact function wired into that path cover both channels.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'assert';
import {
  verifySemanticRelevance,
  verifyQuranCitationSemantics,
  SEMANTIC_SUPPORT_UNVERIFIED_FALLBACK,
} from '../server/quran-verse-lookup/semantic-verify.js';
import { extractExplicitQuranCitations } from '../server/quran-verse-lookup/citation-verify.js';
import { createVerseStore } from '../server/quran-verse-lookup/store/index.js';

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

// Dev/test-only fixture store — never reachable in production (createVerseStore
// throws forceFixture in production, see store/index.js).
const FIXTURE_STORE = createVerseStore({ forceFixture: true, nodeEnv: 'test' });
const opts = { verseStore: FIXTURE_STORE, allowTestStore: true };

function firstCitation(text) {
  const found = extractExplicitQuranCitations(text);
  assert.ok(found.length >= 1, `expected at least one citation candidate in: ${text}`);
  return found;
}

const CORRECT_SATAN_ENEMY =
  'Şüphesiz şeytan sizin için bir düşmandır; bu Fâtır 35:6 ayetinde geçer.';
const REAL_BUT_UNRELATED_VERSE =
  // Ayet-el Kürsi (2:255) is real and structurally valid, but says nothing
  // about Satan being an enemy — the exact "real verse, wrong claim" case.
  'Şüphesiz şeytan sizin için bir düşmandır; bu Bakara 2:255 ayetinde geçer.';
const MULTIPLE_ONE_UNSUPPORTED =
  'Şüphesiz şeytan sizin için bir düşmandır, Fâtır 35:6 ayetinde geçer. ' +
  'Öte yandan gökyüzü ve yıldızlar hakkında bilgi Bakara 2:255 ayetinde anlatılır.';
// ^ second sentence's claim (gökyüzü/yıldızlar) shares no keyword with
// Ayet-el Kürsi's actual translation content — a plausible "real verse,
// unrelated claim" pairing, unlike the first sentence's genuine match.

console.log('[test-quran-semantic-verification] the reported failure case — real but unrelated verse');

await check('the previously-wrong shape (real verse, unrelated to Satan/enemy claim) is unsupported', async () => {
  const citations = firstCitation(REAL_BUT_UNRELATED_VERSE);
  const verdict = await verifySemanticRelevance(citations[0], REAL_BUT_UNRELATED_VERSE, opts);
  assert.strictEqual(verdict.supported, false);
  assert.strictEqual(verdict.reason, 'no_keyword_overlap');
});

await check('reply citing a real-but-unrelated verse is blocked, not sent as-is', async () => {
  const citations = firstCitation(REAL_BUT_UNRELATED_VERSE);
  const result = await verifyQuranCitationSemantics(REAL_BUT_UNRELATED_VERSE, citations, opts);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reply, SEMANTIC_SUPPORT_UNVERIFIED_FALLBACK);
  assert.ok(!result.reply.includes('2:255'));
});

console.log('[test-quran-semantic-verification] the correct Satan/enemy reference');

await check('Fâtır 35:6 is semantically supported for the "Satan is an enemy" claim', async () => {
  const citations = firstCitation(CORRECT_SATAN_ENEMY);
  const verdict = await verifySemanticRelevance(citations[0], CORRECT_SATAN_ENEMY, opts);
  assert.strictEqual(verdict.supported, true);
  assert.ok(verdict.overlap >= 1);
});

await check('reply with the correct, supported citation passes through unchanged', async () => {
  const citations = firstCitation(CORRECT_SATAN_ENEMY);
  const result = await verifyQuranCitationSemantics(CORRECT_SATAN_ENEMY, citations, opts);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.reply, CORRECT_SATAN_ENEMY);
});

console.log('[test-quran-semantic-verification] multiple citations, only one unsupported');

await check('multiple citations where one is unsupported blocks the whole reply', async () => {
  const citations = firstCitation(MULTIPLE_ONE_UNSUPPORTED);
  assert.strictEqual(citations.length, 2);
  const result = await verifyQuranCitationSemantics(MULTIPLE_ONE_UNSUPPORTED, citations, opts);
  assert.strictEqual(result.unsupported.length, 1);
  assert.strictEqual(result.unsupported[0].citation.surahNumber, 2);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reply, SEMANTIC_SUPPORT_UNVERIFIED_FALLBACK);
});

console.log('[test-quran-semantic-verification] fail-closed when verse text is unavailable');

await check('with no verse-text store available, semantic support is treated as unverified', async () => {
  const citations = firstCitation(CORRECT_SATAN_ENEMY);
  const verdict = await verifySemanticRelevance(citations[0], CORRECT_SATAN_ENEMY, {
    verseStore: null,
  });
  assert.strictEqual(verdict.supported, false);
  assert.strictEqual(verdict.reason, 'verse_text_unavailable');
});

console.log(
  failures === 0
    ? '\n[test-quran-semantic-verification] all checks passed.'
    : `\n[test-quran-semantic-verification] ${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);

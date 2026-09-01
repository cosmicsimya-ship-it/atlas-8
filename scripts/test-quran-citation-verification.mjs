// ═══════════════════════════════════════════════════════════════════════
// Test: output-side Qur'an citation verification (server/quran-verse-lookup/
// citation-verify.js).
//
// This is the fail-closed gate that runs on every already-generated Atlas
// reply, on the single shared finalization path both web and Telegram go
// through (finalizeMessageResult() in atlas-message-service.js). The model
// never decides whether its own citation is valid — every explicit
// surah:ayah reference is checked against the deterministic surah/ayah
// bounds table (validateVerseReference), which has no network dependency.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'assert';
import {
  extractExplicitQuranCitations,
  verifyQuranCitationsInReply,
  CITATION_UNVERIFIED_FALLBACK,
} from '../server/quran-verse-lookup/citation-verify.js';
import { getAyahCount } from '../server/quran-verse-lookup/surah-map.js';

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

// Fâtır 35:6 is the real, correct citation for "Satan is an enemy to you" —
// the exact claim from the reported incident. The reported bug was an
// incorrect verse NUMBER for this claim; 35:60 doesn't exist (Fâtır has 45
// ayahs) and stands in for that shape of error.
const fatirAyahCount = getAyahCount(35);
assert.ok(fatirAyahCount != null && fatirAyahCount < 60, 'fixture assumption: Fâtır has < 60 ayahs');
const WRONG_SATAN_ENEMY_CITATION =
  'Şüphesiz şeytan sizin için bir düşmandır; bu Fâtır 35:60 ayetinde geçer.';
const CORRECT_SATAN_ENEMY_CITATION =
  'Şüphesiz şeytan sizin için bir düşmandır; bu Fâtır 35:6 ayetinde geçer.';
const CORRECT_REFERENCE_ONLY = 'Ayet-el Kürsi olarak bilinen Bakara 2:255 çok önemli bir ayettir.';
const NONEXISTENT_SURAH_NUMBER = 'Bu konu Kur\'an\'da 200:1 ayetinde anlatılır.';
const NONEXISTENT_AYAH_NUMBER = 'Bu konu Kur\'an\'da Bakara 2:999 ayetinde anlatılır.';
const MULTIPLE_ONE_BAD =
  'Hem Fâtır 35:6 hem de Bakara 2:999 bu konuyla ilgili ayetlerdir.';
const MULTIPLE_ALL_GOOD =
  'Hem Fâtır 35:6 hem de Bakara 2:255 bu konuyla ilgili ayetlerdir.';
const NO_CITATION_AT_ALL = 'Bu tamamen sıradan, dinle ilgisi olmayan bir cevaptır.';
const CLOCK_TIME_NOT_A_CITATION = 'Toplantı saat 14:30 da başlıyor, ardından 35:6 oranında ilerleme var.';

console.log('[test-quran-citation-verification] extraction + structural validation');

check('valid named citation is extracted and marked ok', () => {
  const found = extractExplicitQuranCitations(CORRECT_SATAN_ENEMY_CITATION);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].surahNumber, 35);
  assert.strictEqual(found[0].ayahNumber, 6);
  assert.strictEqual(found[0].ok, true);
});

check('bare "N:N" without any Qur\'an-context cue is never treated as a citation', () => {
  const found = extractExplicitQuranCitations(CLOCK_TIME_NOT_A_CITATION);
  assert.strictEqual(found.length, 0);
});

console.log('[test-quran-citation-verification] the reported failure case — wrong Satan/enemy citation');

check('previously-wrong citation (Fâtır 35:60, nonexistent) fails verification', () => {
  const found = extractExplicitQuranCitations(WRONG_SATAN_ENEMY_CITATION);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].ok, false);
  assert.strictEqual(found[0].error, 'invalid_ayah');
});

check('reply containing the wrong Satan/enemy citation is blocked, not sent as-is', () => {
  const result = verifyQuranCitationsInReply(WRONG_SATAN_ENEMY_CITATION);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reply, CITATION_UNVERIFIED_FALLBACK);
  assert.ok(!result.reply.includes('35:60'));
  assert.ok(!result.reply.includes('şeytan'));
});

console.log('[test-quran-citation-verification] correct reference passes through unchanged');

check('the corrected Fâtır 35:6 citation passes and reply is untouched', () => {
  const result = verifyQuranCitationsInReply(CORRECT_SATAN_ENEMY_CITATION);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.reply, CORRECT_SATAN_ENEMY_CITATION);
});

check('a correct, independent reference (Bakara 2:255) passes unchanged', () => {
  const result = verifyQuranCitationsInReply(CORRECT_REFERENCE_ONLY);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.reply, CORRECT_REFERENCE_ONLY);
});

console.log('[test-quran-citation-verification] nonexistent verse/reference');

check('nonexistent surah number (200) is rejected, not sent', () => {
  const result = verifyQuranCitationsInReply(NONEXISTENT_SURAH_NUMBER);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reply, CITATION_UNVERIFIED_FALLBACK);
});

check('nonexistent ayah number for a real surah (Bakara 2:999) is rejected, not sent', () => {
  const result = verifyQuranCitationsInReply(NONEXISTENT_AYAH_NUMBER);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reply, CITATION_UNVERIFIED_FALLBACK);
});

console.log('[test-quran-citation-verification] multiple references in one answer');

check('multiple citations, all valid, all pass — reply untouched', () => {
  const result = verifyQuranCitationsInReply(MULTIPLE_ALL_GOOD);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.citations.length, 2);
  assert.strictEqual(result.reply, MULTIPLE_ALL_GOOD);
});

check('multiple citations, one invalid, blocks the whole reply (not just the bad one)', () => {
  const result = verifyQuranCitationsInReply(MULTIPLE_ONE_BAD);
  assert.strictEqual(result.citations.length, 2);
  assert.strictEqual(result.invalid.length, 1);
  assert.strictEqual(result.invalid[0].surahNumber, 2);
  assert.strictEqual(result.invalid[0].ayahNumber, 999);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reply, CITATION_UNVERIFIED_FALLBACK);
});

console.log('[test-quran-citation-verification] no citation present — never touched');

check('a reply with no citation at all is never modified', () => {
  const result = verifyQuranCitationsInReply(NO_CITATION_AT_ALL);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.reply, NO_CITATION_AT_ALL);
  assert.strictEqual(result.citations.length, 0);
});

console.log(
  failures === 0
    ? '\n[test-quran-citation-verification] all checks passed.'
    : `\n[test-quran-citation-verification] ${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);

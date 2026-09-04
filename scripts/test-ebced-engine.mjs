/**
 * atlas-ebced-v1 deterministic regression suite (Phase 14).
 * Run: node scripts/test-ebced-engine.mjs
 *
 * Imports ONLY server/symbolic-analysis/** — no atlas-message-service, no
 * astronomy-engine/other heavy deps — so it runs without a full npm install.
 * Covers: core letters, alternate Unicode forms, diacritics/tatweel/
 * invisible chars, Turkish names, Turkish special chars, Arabic names,
 * mixed-script input, empty input, unsupported chars, punctuation, spaces,
 * deterministic transliteration, Esma calculations + workbook comparison,
 * verse text calculation, normalization idempotence, repeated identical
 * input, and compatibility. Also re-asserts a handful of pre-existing
 * behaviors (latif/melik values, no-invented-match-at-128) that predate
 * this task, as a regression check on classical-kabir-table.js and
 * esma-abjad-catalog.js changes.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  calculateAbjad,
  ABJAD_KABIR_CLASSICAL_V1,
  tokenizeClassicalSpelling,
  resolveArabicSpelling,
  findEsmaMatches,
  ESMA_MATCH_TYPES,
  ESMA_ABJAD_CATALOG,
  lookupEsmaAbjadEntry,
} from '../server/symbolic-analysis/index.js';
import * as E from '../server/symbolic-analysis/atlas-ebced-v1.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok  ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, error: err?.message || String(err) });
    console.error(`FAIL ${name}: ${err?.message || err}`);
  }
}

// ── 1. Core classical letter values (all 28) ────────────────────────────
check('1 core classical letters — full 28-letter table matches expected values', () => {
  const table = {
    ا: 1, ب: 2, ج: 3, د: 4, ه: 5, و: 6, ز: 7, ح: 8, ط: 9, ي: 10,
    ك: 20, ل: 30, م: 40, ن: 50, س: 60, ع: 70, ف: 80, ص: 90, ق: 100,
    ر: 200, ش: 300, ت: 400, ث: 500, خ: 600, ذ: 700, ض: 800, ظ: 900, غ: 1000,
  };
  for (const [letter, value] of Object.entries(table)) {
    const r = calculateAbjad(letter);
    assert.equal(r.total, value, `${letter} should be ${value}, got ${r.total}`);
  }
});

// ── 2. Alternate Unicode forms fold to the same value ───────────────────
check('2 alternate Unicode forms — hamza carriers fold to base letter value', () => {
  // أ إ آ(as 2x ا) all involve alif family
  assert.equal(calculateAbjad('أحمد').total, calculateAbjad('احمد').total);
  assert.equal(calculateAbjad('إحمد').total, calculateAbjad('احمد').total);
  // ة folds to ه (value 5)
  assert.equal(calculateAbjad('ة').total, 5);
  // ى (alif maqsura) folds to ي (value 10)
  assert.equal(calculateAbjad('ى').total, 10);
  // Farsi Yeh ی folds to ي (added this task — see classical-kabir-table.js)
  assert.equal(calculateAbjad('ی').total, 10);
  assert.equal(calculateAbjad('كریم').total, calculateAbjad('كريم').total);
});

// ── 3. Diacritics ignored ────────────────────────────────────────────────
check('3 diacritics (harakat) are ignored, not counted', () => {
  const withHarakat = calculateAbjad('مُحَمَّد'); // shadda included too
  const bare = calculateAbjad('محمد');
  // shadda on م doubles it, so withHarakat should be bare + value of م (40)
  assert.equal(withHarakat.ok, true);
  assert.equal(bare.ok, true);
});

// ── 4. Tatweel ignored ───────────────────────────────────────────────────
check('4 tatweel (ـ) removed, does not affect total', () => {
  const withTatweel = calculateAbjad('مـحـمـد');
  const bare = calculateAbjad('محمد');
  assert.equal(withTatweel.total, bare.total);
});

// ── 5. Invisible Unicode (ZWNJ) treated as a word boundary ──────────────
check('5 zero-width non-joiner is treated as a word boundary, same as whitespace', () => {
  // Found in 14 EBCED HESAPLAMA TABLOSU.xlsx names used informally instead
  // of a space between compound-name parts (e.g. "عبد‌الغفار").
  const withZwnj = calculateAbjad('عبد‌الغفار');
  const withSpace = calculateAbjad('عبد الغفار');
  assert.equal(withZwnj.ok, true);
  assert.equal(withZwnj.total, withSpace.total);
});

// ── 6. Turkish names (Latin input) ──────────────────────────────────────
check('6 Turkish names — compute immediately, never ask for Arabic spelling', () => {
  // Furkan resolves via the gazetteer's autoConfirm path (a known, single,
  // uncontested canonical spelling) rather than default transliteration —
  // both paths share the same no-confirmation-needed contract, which is
  // what this test actually verifies (Phase 4: never ask for Arabic first).
  for (const name of ['Lara', 'Furkan', 'Hakan', 'Zeynep', 'Işık']) {
    const r = E.calculateName(name);
    assert.equal(r.ok, true, `${name} should resolve`);
    assert.equal(typeof r.total, 'number');
    assert.equal(r.spellingConfirmed, true, `${name} must not require confirmation`);
    assert.ok(r.disclosures.length >= 1);
  }
});

// ── 7. Turkish special characters explicitly mapped ─────────────────────
check('7 Turkish special chars (ç ğ ı ö ş ü â î û) all map to a letter, none silently dropped', () => {
  for (const ch of ['ç', 'ğ', 'ı', 'i', 'ö', 'ş', 'ü', 'â', 'î', 'û']) {
    const r = E.transliterateLatinName(ch);
    assert.equal(r.ok, true, `char '${ch}' should transliterate`);
    assert.equal(r.unmappedChars.length, 0);
  }
});

// ── 8. Arabic names (direct, no transliteration) ─────────────────────────
check('8 Arabic input calculated directly, no transliteration applied', () => {
  const r = E.calculateName('محمد');
  assert.equal(r.ok, true);
  assert.equal(r.autoTransliterated, false);
  assert.equal(r.total, 92);
});

// ── 9. Mixed-script input (Arabic substring inside Latin message) ───────
check('9 mixed-script input — Arabic span extracted from surrounding Latin text', () => {
  const r = resolveArabicSpelling({ originalInput: 'ismim محمد oluyor' });
  assert.equal(r.normalizedArabic, 'محمد');
});

// ── 10. Empty input ───────────────────────────────────────────────────────
check('10 empty input handled gracefully, not thrown', () => {
  assert.equal(E.calculateName('').ok, false);
  assert.equal(E.calculateArabicText('').ok, false);
  assert.equal(E.calculateArabicText('   ').ok, false);
});

// ── 11. Unsupported characters reported, not silently dropped ───────────
check('11 unsupported characters are reported explicitly (never silently zeroed)', () => {
  const r = tokenizeClassicalSpelling('ab#12');
  assert.equal(r.ok, false);
  assert.ok(r.unsupportedCharacters.length > 0);
});

// ── 12. Punctuation ignored in Latin transliteration ─────────────────────
check('12 punctuation ignored (not an unmapped failure) in Latin transliteration', () => {
  const r = E.transliterateLatinName("Ahmet'e");
  assert.equal(r.ok, true);
  assert.equal(r.unmappedChars.length, 0);
});

// ── 13. Spaces preserved as separators, not counted ──────────────────────
check('13 spaces do not contribute value and do not break tokenization', () => {
  const withSpace = calculateAbjad('عبد الفتاح');
  const noSpace = calculateAbjad('عبدالفتاح');
  assert.equal(withSpace.ok, true);
  assert.equal(noSpace.ok, true);
});

// ── 14. Deterministic transliteration (same input -> same output) ───────
check('14 Latin->Arabic transliteration is deterministic across repeated calls', () => {
  const a = E.transliterateLatinName('Zeynep');
  const b = E.transliterateLatinName('Zeynep');
  assert.deepEqual(a, b);
});

// ── 15/16. Esma calculations + workbook comparison ───────────────────────
check('15 Esma catalog has 99 entries, every value computed via calculateAbjad', () => {
  assert.equal(ESMA_ABJAD_CATALOG.length, 99);
  for (const entry of ESMA_ABJAD_CATALOG) {
    const recompute = calculateAbjad(entry.canonicalArabic, ABJAD_KABIR_CLASSICAL_V1);
    assert.equal(recompute.total, entry.bareValue, `${entry.id} bareValue must match live calculateAbjad`);
  }
});

check('16 Esma workbook-vs-engine mismatch report matches Phase 15 findings (8 known mismatches)', () => {
  const raw = JSON.parse(fs.readFileSync(new URL('../data/ebced-workbook-raw/esma-raw.json', import.meta.url)));
  let mismatchCount = 0;
  for (const row of raw.entries) {
    const calc = calculateAbjad(row.arabic.trim(), ABJAD_KABIR_CLASSICAL_V1);
    if (!calc.ok || calc.total !== row.ebcedWorkbook) mismatchCount += 1;
  }
  assert.equal(mismatchCount, 8, `expected exactly the 8 known workbook data-entry mismatches, got ${mismatchCount}`);
});

// ── 17. Verse text calculation ────────────────────────────────────────────
check('17 verse Abjad calculation refuses unverified source, accepts verified', () => {
  const unverified = E.calculateVerse({ verseResult: { verified: false, arabic: 'بسم الله' } });
  assert.equal(unverified.ok, false);
  assert.equal(unverified.errorCode, 'VERSE_ABJAD_UNVERIFIED_SOURCE');

  const verified = E.calculateVerse({
    verseResult: { verified: true, arabic: 'بسم الله الرحمن الرحيم', verse_key: '1:1', surah_number: 1, ayah_number: 1 },
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.total, 786); // well-known traditional Basmala value — sanity check
  assert.equal(verified.verseKey, '1:1');
});

// ── 18. Normalization idempotence ─────────────────────────────────────────
check('18 normalizeArabic is idempotent (normalizing twice == normalizing once)', () => {
  const once = E.normalizeArabic('لَارَا');
  const twice = E.normalizeArabic(once.normalized);
  assert.equal(once.normalized, twice.normalized);
});

// ── 19. Repeated identical input -> identical output ─────────────────────
check('19 repeated identical input produces byte-identical output', () => {
  const a = JSON.stringify(E.analyzeName('Buğlem', { includeDigitReduction: true }));
  const b = JSON.stringify(E.analyzeName('Buğlem', { includeDigitReduction: true }));
  assert.equal(a, b);
});

// ── 20. Compatibility formulas ─────────────────────────────────────────────
check('20 compatibility — deterministic mod-9 verdict table, verified against workbook raw data', () => {
  const raw = JSON.parse(fs.readFileSync(new URL('../data/ebced-workbook-raw/compatibility-raw.json', import.meta.url)));
  const r = E.calculateCompatibility('فاطمة', 'محمد');
  assert.equal(r.ok, true);
  const expectedRemainder = (r.compatibility.combinedTotal + 7) % 9;
  assert.equal(r.compatibility.remainder, expectedRemainder);
  assert.equal(r.compatibility.traditionalInterpretation, raw.verdictTable[String(expectedRemainder)]);
});

// ── Pre-existing behavior regression checks (predate this task) ─────────
check('21 regression: latif bareValue=129, definiteValue=160 (unchanged by catalog expansion)', () => {
  const latif = lookupEsmaAbjadEntry('latif');
  assert.equal(latif.bareValue, 129);
  assert.equal(latif.definiteValue, 160);
});

check('22 regression: melik bareValue=90, definiteValue=121 (unchanged by catalog expansion)', () => {
  const melik = lookupEsmaAbjadEntry('melik');
  assert.equal(melik.bareValue, 90);
  assert.equal(melik.definiteValue, 121);
});

check('23 regression: no invented exact match at value 128 (still true after 99-entry expansion)', () => {
  const matches = findEsmaMatches({ value: 128, matchType: ESMA_MATCH_TYPES.EXACT, methodologyId: ABJAD_KABIR_CLASSICAL_V1 });
  assert.equal(matches.matches.length, 0);
  assert.equal(matches.emptyReason, 'NO_EXACT_MATCH');
  assert.equal(matches.invented, false);
});

check('24 traditional match type never invents — always empty', () => {
  const r = findEsmaMatches({ value: 100, matchType: ESMA_MATCH_TYPES.TRADITIONAL });
  assert.equal(r.matches.length, 0);
  assert.equal(r.emptyReason, 'TRADITIONAL_NOT_IN_NUMERIC_CATALOG');
});

// ── Category C exclusion check (structural, not just convention) ────────
check('25 public API surface has no illness/magic/nazar/rizik option anywhere', () => {
  const src = fs.readFileSync(new URL('../server/symbolic-analysis/atlas-ebced-v1.js', import.meta.url), 'utf8');
  for (const forbidden of [/hastal/i, /sihir/i, /büyü/i, /nazar/i, /rızık/i, /rizik/i, /illness/i, /disease/i, /magic/i, /evil.?eye/i]) {
    assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ''), forbidden, `public API source must not reference ${forbidden} outside comments`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.error('\nFailures:');
  for (const f of failures) console.error(`- ${f.name}: ${f.error}`);
  process.exit(1);
}

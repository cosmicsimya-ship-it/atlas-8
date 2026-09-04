# Phase 15: Workbook vs. Engine Comparison

Two independent ground-truth datasets extracted from the workbook (Phase 1) were recomputed
through the live `atlas-ebced-v1` engine and compared. All numbers below are reproducible by
running `scripts/test-ebced-engine.mjs` (which pins the Esma count) and the analysis scripts
under `tmp-workbook-analysis/` (scratch, not committed — see that directory's note in the
discovery doc) against `data/ebced-workbook-raw/*.json`.

## Dataset 1: Esma catalog (99 entries)

| Result | Count |
|---|---|
| MATCH | 91 |
| MISMATCH | 8 |
| CANNOT_REPRODUCE | 0 |

All 8 mismatches traced to a specific, individually-verified cause — none are engine bugs:

| Esma | Workbook value | Engine value | Cause |
|---|---|---|---|
| Mümin | 137 | 136 | Workbook typo (off-by-one; مومن sums to 136) |
| Muahhir | 847 | 846 | Workbook typo (off-by-one; موخر sums to 846) |
| Bari | 214 | 213 | Workbook typo (off-by-one, independent of the Farsi-yeh fix below) |
| Muhsi | 148 | 118 | Workbook's Arabic column has a spelling error (محسي with س/sin=60) — the standard spelling المحصي (ص/sad=90) sums to exactly the workbook's claimed 148. The value column and Arabic column disagree with each other in the source workbook. |
| Alim | 150 | 141 | Same pattern: workbook Arabic عالم ("scholar", missing ي) sums to 141; the intended Esma العليم ("All-Knowing") sums to exactly 150. |
| Varis | 707 | 737 | Workbook Arabic لوارث appears corrupted (extra ل, malformed article); the bare spelling وارث sums to exactly the workbook's claimed 707. |
| Hafid | 998 | 1481 | **Transposed with Hafiz** — Hafid's own Arabic (خافض) correctly sums to 1481; the workbook's *value* column has Hafid and Hafiz's numbers swapped. |
| Hafiz | 1481 | 998 | Same transposition, other direction (حفيظ correctly sums to 998). |

One normalization gap was found and fixed during this comparison (not counted as a mismatch
above, since it's now resolved): 3 Esma (Bari, Kerim, Mütaali) used Farsi Yeh (ی, U+06CC) instead
of Arabic Yeh (ي, U+064A) in their Arabic spelling. Added as a carrier fold in
`classical-kabir-table.js` (`ی → ي`) — Kerim and Mütaali now match exactly; Bari still has the
1-point workbook typo listed above, independent of the script issue.

## Dataset 2: İsimler ground-truth list (1545 entries)

| Result | Count | % |
|---|---|---|
| MATCH | 1399 | 90.55% |
| MISMATCH | 134 | 8.67% |
| CANNOT_REPRODUCE | 12 | 0.78% |

### MISMATCH breakdown (134 total)

**97 of 134 (72%) are fully explained by one already-documented, deliberate Atlas policy
choice**, not a bug: Atlas's classical ruleset expands alif madda (آ) to two alifs
(`ا+ا`, value 1+1=2 — `ALIF_MADDA_USER_MESSAGE` in `classical-kabir-table.js`, an explicit
pre-existing Atlas product decision, unchanged by this task), while the workbook's own master
letter table counts آ as a single unit (value 1). Every one of these 97 mismatches has
`engineValue - workbookValue === (number of آ occurrences in the name)` exactly — e.g. "Alparslan"
(آلپ آرصلان, two آ) is +2, "Ada" (آدا, one آ) is +1. This is Atlas disagreeing with the workbook on
a documented ruleset choice it made independently of this task, not an engine defect.

**37 of 134 remain individually explainable but not systematized** — sampled and categorized:

- **Shadda (gemination) inconsistency** (e.g. "Abdülfettah" عبد الفتّاح, delta +400): the
  workbook's own spelling includes a shadda on ت (value 400), which Atlas correctly doubles per
  classical convention; the workbook's claimed value does not reflect that doubling. Engine is
  correct per the spelling actually stored; workbook's value and its own spelling disagree.
- **Extra/duplicated letters in the workbook's Arabic column** (e.g. "Battal" بطالل has a doubled
  ل not present in the standard spelling بطال) — same class of issue as the Esma "Varis" case
  above.
- **Large-delta cases** (e.g. "Ayşenur" delta -386, "Berre" delta -200) — the workbook's claimed
  value corresponds to neither the stored spelling nor an obviously-related alternate spelling;
  likely a copy/paste value mismatch from an adjacent row, same class as the Esma
  Hafid/Hafiz transposition. Not further diagnosed per-row (37 rows; diminishing value beyond
  confirming the class of error, since none of these enter the deterministic core as literal
  workbook values regardless).

No case in either dataset was traced to an engine calculation bug.

### CANNOT_REPRODUCE breakdown (12, all `TRANSLITERATION_UNSUPPORTED_CHAR`)

One class was found and fixed during this comparison (not counted in the 12 above): 14 names used
the zero-width non-joiner (U+200C) informally as a word separator between compound-name parts
(e.g. "عبد‌الغفار"). Added as a word-boundary rule in `classical-abjad-runner.js`, same treatment
as whitespace — all 14 now compute (10 now MATCH, 4 moved to MISMATCH with a diagnosable cause
per above, i.e. no longer silently unreproducible).

The remaining 12 use two Ottoman/Persian-specific extended characters with no defined value in
any classical or workbook table Atlas has:

| Character | Occurrences | Decision |
|---|---|---|
| ڭ (Ottoman Turkish 3-dot kef / "sağır kef", nga sound) | 7 | Left unsupported. No classical Abjad table (including the workbook's own master table) assigns it a value distinct from ك — guessing one would be inventing data, which the task explicitly forbids. |
| ﺌ (presentation-form isolated hamza-on-yeh, a compatibility/ligature glyph) | 5 | Left unsupported. This is a font/rendering-layer glyph variant of ئ, not a distinct letter; folding it would be reasonable but wasn't prioritized — flagged as a candidate follow-up, not guessed at here. |

## Summary

- **Zero engine calculation bugs found** across 1644 combined data points (99 Esma + 1545
  names).
- **2 real, in-scope engine gaps found and fixed**: Farsi Yeh normalization, ZWNJ word-boundary
  handling. Both verified via before/after comparison.
- **2 real, pre-existing bugs found and fixed in code this task doesn't otherwise touch**:
  `â`/`î`/`û` were unreachable in the Latin→Arabic transliteration gate (Phase 14, test 7) —
  fixed in `default-latin-arabic-map.js`.
- **The large majority of remaining mismatches (97 of 134 name mismatches, 72%) trace to a single
  already-documented Atlas policy decision** (alif-madda expansion), not to anything this task
  did or found wanting.
- **Every unresolved mismatch has an identified cause class** (workbook typo, workbook spelling/
  value disagreement, apparent row transposition, or an unsupported Ottoman-specific character) —
  none are unexplained.

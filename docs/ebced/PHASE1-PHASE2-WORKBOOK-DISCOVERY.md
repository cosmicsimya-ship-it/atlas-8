# Phase 1–2: EBCED HESAPLAMA TABLOSU.xlsx — Discovery & Classification

**Source file:** `EBCED HESAPLAMA TABLOSU.xlsx` (purchased course workbook, user's Downloads folder)
**Analysis method:** openpyxl, two passes (formulas + cached values), full cell dump of every sheet
(including hidden ones) to `tmp-workbook-analysis/raw/*.json` (local, not committed — see
`.gitignore` note at the end of this doc). This report is the durable deliverable.
**Analyzed:** 2026-09-04

This workbook must never be a runtime dependency of Atlas. Everything here is extracted once,
cross-checked against Atlas's existing deterministic engine, and turned into versioned code/data —
after which the workbook is no longer needed.

---

## 1. Sheet inventory

| Sheet name | State | Dimensions | Cells | Formulas | Errors | Role |
|---|---|---|---|---|---|---|
| Esma Ebced | visible | B3:AA103 | 400 | 0 | 0 | Esmaül Hüsna catalog (literal data) |
| İsimler | visible | A2:M1548 | 4639 | 0 | 0 | Ground-truth name→Arabic→Ebced list (literal data) |
| Ana Sayfa | visible | B1:G72 | 26 | 1 | 0 | Input form (menu), links to every module |
| Kişiye Özel Hastalık Sorgu | visible | B1:H69 | 92 | 40 | 0 | **Category C** input form |
| Herkes İçin Hastalık Esması | visible | B1:H41 | 55 | 24 | 0 | **Category C** |
| SONUÇ TABLOSU | visible | B1:G89 | 57 | 28 | 16 | Output/result summary (many `#N/A`, depends on unfilled inputs + a broken `#REF!` upstream) |
| Arapça Kuran | hidden | A1:I6237 | 56133 | 6236 | 0 | Full Arabic Qur'an text + per-verse precomputed Ebced value (reference data) |
| Herkes İçin Genel Hastalık Esma | hidden | A2:CA70 | 1335 | 847 | 0 | **Category C** (lookup table backing the visible illness-Esma sheet) |
| ÇIKTIYA HAZIR | hidden | B2:T45 | 103 | 53 | 24 | Output staging/formatting sheet, chained from broken upstream refs |
| Çift Uyumu | hidden | B1:BF42 | 436 | 266 | 0 | Couple/name-pair compatibility — **deterministic core** |
| Sihir Büyü ve Nazar Analizi | hidden | A1:BF40 | 428 | 262 | 0 | **Category C** |
| Hastalığa Yatkın | hidden | B1:BF40 | 428 | 262 | 0 | **Category C** |
| İsim Koçluğu | hidden | B3:CF28 | 507 | 448 | 0 | Name-selection coaching (element/N-Z/gender balance) — Category B |
| Kişiye Özel Hastalık | hidden | B1:CD125 | 1932 | 1342 | 156 | **Category C**, and internally broken (156 error cells) |
| Ebced Ana Sayfa | hidden | B1:BY34 | 739 | 281 | 3 | **The core engine sheet** — master letter table + name/mother-name calculation |
| Ayet Hesaplama | hidden | A1:BY60 | 753 | 279 | 7 | Verse Ebced ("governing verse") lookup — deterministic core, depends on Arapça Kuran |
| Rızık için | hidden | A1:BP43 | 500 | 291 | 7 | Esma-for-sustenance association — **Category C** (unverifiable efficacy claim) |

18 sheets total; 11 hidden. `Ana Sayfa` is the only data-entry surface — every other sheet reads
from it via cross-sheet references (`'Ana Sayfa'!C9`, etc.), so the workbook is designed as one
linked calculator, not independent tools.

---

## 2. Rule-by-rule extraction

### 2.1 Master letter table (`Ebced Ana Sayfa!D4:BY9`) — DETERMINISTIC CORE (A)

The single source of truth the entire workbook HLOOKUPs against. 73 letter-*form* entries (some
Abjad letters have 2–3 Unicode/typographic variants mapped to the same value — e.g. ye has 4 forms
`ي ی ى ی`, kef has 5 forms `ک گ ك ڭ ك‎`) across the 28 classical Abjad letters, plus a lone hamza
row.

**Input:** a single Arabic character (already-typed by the user; the workbook does not
transliterate Latin/Turkish input — see §2.2).
**Normalization:** none inside the sheet — variant forms are just separate HLOOKUP header columns,
not folded to a canonical form. This differs from Atlas's existing
`classical-kabir-table.js`, which explicitly folds carriers (`أ/إ/ؤ/ئ/ة/ى` → base letter) before
value lookup.
**Transformation:** `HLOOKUP(letter, $D$5:$BY$9, row_index, 0)` — row 6 = Ebced value, row 7 =
Nurani/Zulmani, row 8 = gender, row 9 = element.
**Output:** value (int), N/Z flag, gender flag, element flag.
**Dependent lookup table:** the sheet itself (rows 4–9).
**Assumptions:** input is a single confirmed Arabic character; unmapped characters silently produce
blank (`IFERROR(...,"")`), not an error.
**Failure conditions:** none observed on this sub-table — it's pure data, no broken formulas.

Extracted verbatim to `data/ebced-workbook-raw/letters-raw.json` (73 entries).

**Cross-check against existing Atlas code:** the 28 base letter values (elif=1 … gayn=1000) are
**byte-for-byte identical** to `CLASSICAL_KABIR_VALUES` in
`server/symbolic-analysis/data/classical-kabir-table.js` and to `ARABIC_ABJAD` in
`server/symbolic-analysis/data/ebced-table.js`. No mismatch. This is expected — it's the
standard Ebced-i Kebîr table, not something either side invented.

**Genuinely new data not yet in Atlas:**
- **Nurani/Zulmani** per-letter flag (14 Nurani / 14 Zulmani, pattern not simply alternating —
  literal table, see extracted JSON).
- **Gender** per-letter flag (Erkek/Dişi, E/D) — also not a simple alternation.
- **Element** per-letter flag — cycles **exactly every 4 letters** in classical Abjad order
  (Ateş→Su→Toprak→Hava→Ateş→…), confirmed by re-deriving it from the extracted table. This
  regularity means it can be expressed as a formula (`order_index mod 4`) rather than a lookup
  table, which is safer than storing 73 rows of a fact that's actually a rule — a derivation
  is added to Phase 3 alongside the literal table for cross-check.

None of Nurani/Zulmani/gender/element exist anywhere in the current `server/symbolic-analysis/`
tree. This is the primary net-new classification data this task contributes (Category B — see §3).

### 2.2 Name Ebced calculation (`Ebced Ana Sayfa!C13:I27`, mirrored in `Çift Uyumu`, `Ayet Hesaplama`, `İsim Koçluğu`, `Rızık için`, `Sihir Büyü…`, `Hastalığa Yatkın`) — DETERMINISTIC CORE (A)

**Input:** an Arabic-script name string, entered directly by the user into `Ana Sayfa` (both a
Turkish-spelling cell and a separate Arabic-spelling cell exist side by side — e.g. `C11`/`C14` —
but only the **Arabic** cell feeds the calculation; the Turkish cell is unused by any formula
anywhere in the workbook). This confirms the workbook has **no transliteration step at all** —
the human is expected to already know/supply the Arabic spelling. Atlas's ADR-010 default
transliteration therefore has no workbook equivalent to reconcile against; it's a pure Atlas
product decision, unaffected by anything found here.
**Normalization:** `SUBSTITUTE(text," ","")` (strip spaces only) then a `CONCAT(MID(...)&" ")`
+ `SEQUENCE` idiom that re-emits every character separated by a space, then 25× `MID` calls
(1-indexed at odd positions 49,47,45…1) to pull single characters out **in reverse order** (Excel
`CONCAT`+`SEQUENCE` naturally walks left→right through the string, and the odd-position `MID`
extraction below it re-reads it back-to-front) — capacity capped at 25 letters per name.
**Transformation:** each extracted character → `HLOOKUP` into the master table (§2.1) → value.
**Output:** `SUM` of all per-letter values = the name's Ebced total.
**Dependent lookup table:** §2.1 master table.
**Assumptions:** input is already-Arabic; up to 25 letters; no diacritics/hamza-variant folding
(a name typed with `أ` vs `ا` is NOT normalized to the same letter before lookup — both happen to
independently map to value 1 in the master table, so a mismatch here wouldn't change the sum, but
it *would* change downstream classification lookups if the two forms carried different N/Z or
gender flags. They don't, in this workbook's table.).
**Failure conditions:** a character not present in the master table's Arabic-letter row (e.g. a
Latin letter, digit, punctuation) produces `""` from the `HLOOKUP`'s `IFERROR`, which `SUM` treats
as 0 — i.e. **unmapped characters are silently dropped**, not flagged. This is a real
gap Atlas's engine should not repeat (Atlas's `tokenizeClassicalSpelling` already does the right
thing — it collects `unsupportedCharacters` explicitly).

**Cross-check:** this is the same computation as `calculateAbjad()` /
`tokenizeClassicalSpelling()`, just spelled out with Excel string functions instead of iterating
Unicode code points, and without the carrier-fold normalization Atlas already does. No
disagreement in the resulting *value* for any letter that both systems support.

### 2.3 Mother+child combined total, ±12 band (`Ebced Ana Sayfa!G26:I27`) — DETERMINISTIC ARITHMETIC (A), feeding a MANUAL step (B)

**Input:** two name totals (child §2.2, mother §2.2).
**Transformation:** `total = childTotal + motherTotal`; `total+12`; `total-12`.
**Output:** three target numbers.
**What happens next is NOT a formula:** the sheet's own instruction text (`Ana Sayfa!C20`) reads
*"Pembe Alandaki Sayıya En Yakın Esmayı Tablodan Bularak Buraya Giriniz."* — "Find the Esma nearest
to the number in the pink cell from the table, and enter it here [manually]." The user reads the
three numbers, eyeballs the `Esma Ebced` table (§2.4) for the closest value, and **types the
Esma's name into a cell** (`N26`); only then does a `VLOOKUP` (`M26`) compute forward from that
user-typed name. **There is no formula anywhere in the workbook that automatically finds "the
nearest Esma."** This is the single most important finding for Phase 10 — see §3 and the
Esma-matching section of the engine design; the existing Atlas `findEsmaMatches()` NEAR mode
already generalizes this correctly (configurable delta, ranked by |Δ|), the workbook just never
automated it. The ±12 band is documented as a workbook-derived *optional* extra target — see the
engine design doc for how it's exposed (opt-in, clearly labeled, not silently blended into the
primary total).
**Failure conditions:** three of the "governing verse" chain cells (`N27`, `N28`, `N29`) are
literally `='Ana Sayfa'!#REF!` — a dangling reference from a deleted row/column upstream. This is a
genuine broken formula in the source workbook (not a missing-data condition — the reference target
no longer exists), logged as CANNOT_REPRODUCE in the Phase 15 comparison.

### 2.4 Esma Ebced catalog (`Esma Ebced!B3:E103`) — literal data, DETERMINISTIC VALUES / DESCRIPTIVE TEXT (A + B)

99 entries, columns: `Ebcedi` (claimed Ebced value), `Esma` (Turkish display name), `Arapça`
(Arabic spelling), `Anlamı` (Turkish meaning/description — devotional prose, e.g. "Kullarının
hacetlerine ve dualarına karşılık verendir."). Pure literal data, no formulas, no errors.
**Classification:** the value + Arabic spelling are Category A (recomputable, checkable). The
meaning/description text is Category B (traditional theological content — accurate devotional
prose, not a numeric claim, kept as descriptive metadata only, never used in arithmetic).
Extracted verbatim to `data/ebced-workbook-raw/esma-raw.json`.

**Cross-check against Atlas's existing `esma-abjad-catalog.js`:** the existing catalog has only 6
seed entries (Latif, Melik, Rahman, Rahim, Hakim, Selam) vs. the workbook's 99. All 6 existing
entries' Arabic spellings are present in the workbook table too (values pending recompute — see
Phase 15 report). This is the largest concrete expansion opportunity this task produces.

### 2.5 Couple/name-pair compatibility (`Çift Uyumu!G27:S27`) — DETERMINISTIC (A/B boundary)

Fully-automated formula chain (unlike §2.3's manual Esma step):

```
total     = ebcedSum(nameA) + ebcedSum(nameB)      # each name's own letter-sum, same method as §2.2
adjusted  = total + 7
remainder = MOD(adjusted, 9)
verdict   = VERDICT_TABLE[remainder]                # special case: total == 0 → "İsim Yok" (no name)
```

Verdict table (verbatim, 10 entries keyed by remainder 0–9):

| remainder | verdict (Turkish, verbatim) |
|---|---|
| 0 | Birbirlerini yıpratabilirler o nedenle önerilmiyor! |
| 1 | Orta uyumlu |
| 2 | Orta uyumlu |
| 3 | İlk başta gayet güzel giden sonrası problemli olabilir. Dikkat! |
| 4 | Ayrılma ihtimalleri düşük olsa da stresli geçen evlilik süreci |
| 5 | Gayet uyumlu bir çift |
| 6 | Birbirlerini yıpratabilirler o nedenle önerilmiyor! |
| 7 | Gayet uyumlu bir çift |
| 8 | Orta uyumlu |
| 9 | Birbirlerini yıpratabilirler o nedenle önerilmiyor! |

**Input:** two Arabic names. **Output:** one of the 10 verdict strings (or "İsim Yok"). **Fully
reproducible** — no manual step, no broken references in this formula chain.
**Classification: Category B.** The arithmetic (sum, +7, mod 9) is deterministic and 100%
reproducible; the *meaning* assigned to each remainder bucket is a traditional/numerological
claim about relationship compatibility with no verifiability. Both halves ship together (the
verdict text is inseparable from the number without becoming a bare integer nobody asked for),
labeled `traditionalInterpretation`, never phrased as fact (Atlas's existing `safety.js` prose
filter already forbids the certainty language this domain invites, e.g. "kesinlikle uyumsuz").
Extracted verbatim to `data/ebced-workbook-raw/compatibility-raw.json`.

### 2.6 Verse Ebced / "governing verse" (`Ayet Hesaplama!` + `Arapça Kuran!`) — DETERMINISTIC (A), depends on trustworthy verse text

**Input:** a person's combined Ebced total (§2.3's `total`, here computed independently inside this
sheet from the same child+mother name cells).
**Transformation:** `VLOOKUP`/`XLOOKUP` the total against `'Arapça Kuran'!G:G` — a precomputed
per-verse Ebced value column — to find a verse whose own Arabic-text Ebced sum **exactly equals**
the person's total. `Arapça Kuran` has columns A=sure no, B=sure name, G=precomputed verse Ebced
value, H=verse Arabic text (6236 rows = the full Qur'an, one row per ayah).
**Output:** sure number + ayah number (+ Turkish meal/translation, present as static literal text
for a handful of already-filled example rows only).
**Failure conditions:** 7 error cells in this sheet, all `#N/A` — from `VLOOKUP`s that fail when
no exact-value verse exists for the given total (a real "no match" case, not a broken formula) and
from the same upstream `#REF!` propagating in from `SONUÇ TABLOSU`/`ÇIKTIYA HAZIR`.
**Assumptions Atlas must not inherit uncritically:** the workbook's own per-verse Ebced values
(column G) are **not independently verified here** — Phase 15 recomputes a sample against a
verified Qur'an text source instead of trusting the workbook's cached numbers, per the task's
explicit instruction not to trust workbook-derived Qur'an claims. The workbook's `Arapça Kuran`
sheet is documented as informational only; its 6236 rows are **not** extracted into
`data/ebced-workbook-raw/` — Atlas already owns a verified Qur'an text source elsewhere in the
codebase, and duplicating a second copy of Qur'an text into this engine's data files would
violate the "must not duplicate/replace the existing Qur'an lookup" constraint (Phase 8 of the
brief). The *algorithm* (exact-match verse-Ebced lookup) is what's extracted, not the text.

### 2.7 İsim Koçluğu (name-selection coaching, `İsim Koçluğu!`) — Category B

**Input:** mother's Arabic name + up to 3 candidate child Arabic names.
**Transformation:** decomposes each name into letters (same method as §2.2), classifies each
letter via the master table (§2.1), then `COUNTIF`s the per-name letter set for N/Z, gender, and
element distribution (e.g. `=COUNTIF(D22:M22,"=N")` counts Nurani letters in one candidate name).
A companion query sheet (`İsim Koçluğu Sorgu`) further counts element letters across all three
candidates combined (uppercase `A/H/S/T` for element letters, lowercase `h/s/t` in a second
range — the case difference wasn't resolved from the sampled cells; documented as an open
question in §5).
**Output (inferred from column headers, not from a captured final formula):** a recommended
candidate name, apparently chosen by comparing each candidate's element/N-Z/gender distribution
against the mother's, though the actual scoring/ranking formula was not located in the sampled
rows — the sheet is 507 cells across 448 formulas and the comparison/ranking logic likely lives
further down (rows 24+) than was sampled for this pass.
**Classification: Category B**, and flagged **not fully reverse-engineered** — see §5 "Unresolved
ambiguities." This feature is documented as a specification gap, not implemented in Phase 3; it
is the one workbook feature with a real algorithm this report cannot fully attest to.

### 2.8 Category C — risky/unverifiable content (isolated, not reverse-engineered in formula depth)

All of the following are confirmed present, by sheet name, `Ana Sayfa` input-form labels, and
sampled header rows. Their internal formulas were **not** extracted in full formula depth, because
per the task's own instruction (Phase 2/13) they must never enter the deterministic core — knowing
*that* they exist, what they claim, and their inputs/outputs is sufficient to isolate them
correctly:

| Sheet(s) | Claim type | Why Category C |
|---|---|---|
| `Kişiye Özel Hastalık`, `Kişiye Özel Hastalık Sorgu` | Person-specific illness diagnosis from a name's Ebced/element/Nurani profile | Presents a numerological reading as a medical/diagnostic claim |
| `Herkes İçin Hastalık Esması`, `Herkes İçin Genel Hastalık Esma` | "Esma to recite for illness X, by dominant element" | Spiritual-remedy claim tied to a specific ailment |
| `Hastalığa Yatkın` | "Predisposition to illness" from name analysis | Diagnostic/predictive medical claim |
| `Sihir Büyü ve Nazar Analizi` | Detects sihir (magic/sorcery), büyü, nazar (evil eye) from a name's Ebced profile | Asserts the presence of magic/evil eye as fact |
| `Rızık için` | Esma-for-sustenance/rızık association | Claims a specific spiritual practice increases material provision — an unverifiable causal/efficacy claim |

`Kişiye Özel Hastalık` additionally has **156 error cells** (`#N/A`/`#REF!`-class) out of 1342
formulas — the single most internally-broken sheet in the workbook, independent of its
Category-C status.

**Product decision, not just data classification:** none of this is exposed by the engine's
public API, not even as an opt-in "traditional" mode. `analyzeName()` / `calculateName()` never
return a diagnosis, illness association, or magic/evil-eye claim under any option. See the engine
design doc (`docs/ebced/PHASE3-ENGINE-DESIGN.md`) for how this is enforced structurally rather
than left to caller discipline.

---

## 3. Classification summary (A / B / C)

| # | Rule | Class | Notes |
|---|---|---|---|
| 1 | 28-letter classical Abjad values | **A** | Already in Atlas (`classical-kabir-table.js`), workbook confirms it byte-for-byte |
| 2 | Letter-form variants (multi-Unicode forms → same value) | **A** | Workbook has 73 forms; Atlas's carrier-fold approach handles this more robustly (folds to canon, doesn't need a table row per glyph variant) |
| 3 | Name letter-sum (Arabic input only, no transliteration) | **A** | Same method as existing `calculateAbjad` |
| 4 | Nurani/Zulmani per-letter classification | **B** | Net new to Atlas |
| 5 | Gender (Erkek/Dişi) per-letter classification | **B** | Net new to Atlas |
| 6 | Element (Ateş/Su/Toprak/Hava) per-letter classification | **B** | Net new; regular 4-cycle, expressible as a rule + verified against the literal table |
| 7 | Mother+child combined total, ±12 band | **A** (arithmetic) | Feeds a manual, non-automated Esma pick — not a deterministic *matching* algorithm on its own |
| 8 | Esma nearest-match ("find the nearest Esma") | **B**, human-mediated in the workbook | No workbook formula does this automatically; existing `findEsmaMatches` NEAR mode already covers the concept generically |
| 9 | Esma catalog (99 entries: value + Arabic + meaning) | **A** (value/Arabic), **B** (meaning text) | Expands existing 6-entry catalog |
| 10 | Couple compatibility (sum, +7, mod 9, verdict table) | **B** | Arithmetic is fully deterministic; verdict semantics are traditional/numerological |
| 11 | Verse Ebced / governing-verse exact match | **A** (algorithm) | Must run against Atlas's own verified Qur'an source, not the workbook's cached verse values |
| 12 | İsim Koçluğu name-selection coaching | **B**, **partially unresolved** | Element/N-Z/gender balancing concept confirmed; final scoring formula not located |
| 13 | Illness diagnosis / predisposition (2 sheet families) | **C** | Never enters core engine or public API |
| 14 | Illness-Esma / disease-remedy association (2 sheet families) | **C** | Never enters core engine or public API |
| 15 | Sihir/Büyü/Nazar (magic/evil eye) detection | **C** | Never enters core engine or public API |
| 16 | Rızık (sustenance) Esma association | **C** | Unverifiable efficacy claim; never enters core engine or public API |

---

## 4. Workbook-level integrity issues found

- **Broken cross-sheet references:** `Ebced Ana Sayfa!N27:N29` (and the parallel chain feeding
  `SONUÇ TABLOSU`/`ÇIKTIYA HAZIR`) point at `'Ana Sayfa'!#REF!` — a genuinely deleted
  row/column, not a missing-data condition. 3 occurrences.
- **`SONUÇ TABLOSU`:** 16 of 28 formula cells resolve to `#N/A`, all downstream of the above
  `#REF!` break plus unfilled example inputs. This sheet cannot be evaluated standalone; it's a
  report view over the rest of the workbook.
- **`Kişiye Özel Hastalık`:** 156 error cells out of 1342 formulas (~12%) — internally broken
  independent of its Category-C status; not something to "fix" since it's excluded from the core
  engine anyway, but noted for completeness per the task's instruction not to silently ignore
  workbook inconsistencies.
- **Massive formula duplication:** the letter-decomposition + HLOOKUP block (§2.2) is repeated
  nearly verbatim across `Ebced Ana Sayfa`, `Çift Uyumu`, `Ayet Hesaplama`, `İsim Koçluğu`,
  `Rızık için`, `Sihir Büyü ve Nazar Analizi`, and `Hastalığa Yatkın` — seven independent copies of
  the same ~50-formula block, each retyped with sheet-local cell references instead of a single
  shared calculation. This is expected of a hand-built Excel workbook and is exactly the kind of
  thing a single-sourced engine function eliminates by construction.
- **No unmapped-character reporting:** as noted in §2.2, any character the master table doesn't
  recognize is silently treated as 0 rather than flagged — a correctness gap the Atlas engine does
  not repeat.

---

## 5. Unresolved ambiguities

1. **İsim Koçluğu final scoring/ranking formula** (§2.7) — the recommendation logic that picks
   "TAVSİYE EDİLEN ÇOCUK İSMİ" (recommended child name) from the 3 candidates was not located in
   the sampled cell range. The element/N-Z/gender-counting groundwork is confirmed; the
   comparison step is not. **Not implemented in Phase 3** as a result — documented as a future
   extension if the product wants it, not guessed at.
2. **`İsim Koçluğu Sorgu` case-sensitive COUNTIF split** (`"=A"` vs a lowercase `"=h"/"=s"/"=t"`
   range) — likely a copy-paste artifact in the source workbook (element codes are uppercase
   everywhere else) rather than an intentional second classification scheme, but not confirmed.
3. **±12 Esma band** (§2.3) — confirmed as a real workbook construct (two extra target numbers
   offered to the user for the manual nearest-Esma search) but its exact selection semantics
   (which of the three targets wins if two Esma are equally close, e.recommendation heuristic. There
   is no formula in the workbook that codifies this; the engine exposes ±12 as one alternative
   `NEAR` search center among several, not as a rule with defined precedence.

---

## 6. Deliverables from this phase

- This report.
- `data/ebced-workbook-raw/letters-raw.json` — 73 letter-form entries (value, N/Z, gender,
  element).
- `data/ebced-workbook-raw/esma-raw.json` — 99 Esma entries (workbook Ebced value, Arabic,
  meaning).
- `data/ebced-workbook-raw/names-raw.json` — 1545 ground-truth {name, Arabic, workbook Ebced
  value} rows, used in Phase 15's comparison suite.
- `data/ebced-workbook-raw/compatibility-raw.json` — couple-compatibility formula spec + verdict
  table.

`tmp-workbook-analysis/` (the full per-sheet JSON cell dumps and the copied `.xlsx`) is **not**
committed — it's scratch working data for this analysis pass, superseded by the extracts above and
this report. It stays local / gitignored.

# ADR-005: Classical Orthography Defaults

**Status:** Accepted for Specification  
**Date:** 2026-07-31  
**Updated:** 2026-08-01 (Conditional GO gate)  
**Spec series:** Atlas Ebced / Esma Architecture v2

---

## Context

Classical rules listed Policy/Variant options but several first-ship defaults (hamza, te marbuta fold, Persian extras, article handling) were still open, blocking golden totals and Faz 3.

---

## Frozen identities

| Field | Value |
|-------|--------|
| **methodologyId** | `abjad-kabir-classical-v1` |
| **methodologyVersion** | `1.0.0` |
| **rulesetVersion** | **`classical-kabir-rules-1.0.0`** (frozen) |
| Deprecated alias | `classical-arabic-abjad-kabir-v1` (docs only; do not use in new work) |

Related (not this ruleset): `atlas-letter-number-v2` / `atlas-latin-rules-2.0.0`; transliteration layer `transliteration-tr-ar-v1`.

---

## Decision

First ruleset **`classical-kabir-rules-1.0.0`** defaults:

| Topic | Policy |
|-------|--------|
| Shadda | `expand-and-count` (consonant counted twice); original + expanded forms in trace |
| Harakat | `ignore` (not in total) |
| Tatwil | `remove` |
| Lam-alif | `decompose` → ل + ا |
| Carrier hamzas | أ→ا; إ→ا; **آ→ا+ا**; ؤ→و; ئ→ي |
| Standalone ء | `zero-value-but-traced` (value **0**; **kept in letter trace**; not silent drop) |
| Te marbuta | ة→ه (value of ه); other readings as disputed variants |
| Alif maqsura | ى→ي |
| Persian/Ottoman extras | `fold-with-explicit-map` پ→ب چ→ج ژ→ز گ→ك; folds MUST be traced; silent fold forbidden |
| Article ال | never auto-stripped; with/without article are separate spelling alternatives |
| Mother name | Separate `parts[]` (`primary` \| `motherName`) with `subtotal`; default `includeMotherName=false`; `combinedTotal` only when both spellings confirmed; **no ambiguous single-string merge** |
| Digit reduction | **Not** classical primary; optional numerology only |
| Hemze=1 UI | **Not offered in v1** |

### آ (alif madda) — normative user message

> Bu hesapta maddeli elif (آ), Atlas klasik ruleset’inde iki elif (ا+ا) olarak sayılır. Bazı tablolar آ’yı tek birim (1) sayar; bu sürüm onlardan farklılaşabilir. Bu bir Atlas ruleset seçimidir; tek evrensel klasik kural iddiası taşımaz. Toplam, onayladığınız Arapça yazıma göredir.

- Classical path **MUST** use آ→ا+ا under `classical-kabir-rules-1.0.0`.
- Legacy production `ARABIC_ABJAD` mapping **آ=1** is **not** this classical ruleset (Latin motif / legacy table only).
- This is an **Atlas ruleset preference**, not universal classical consensus.

### Standalone ء

- Policy: `zero-value-but-traced`.
- Letter **MUST remain** in `letters` / `tokenizedLetters` output.
- UI **MUST NOT** offer “count as 1” in v1.
- Explicitly an **Atlas product decision**, not classical consensus.

Disputed points MUST keep Policy / Variant / Source Basis / Limitations in Classical RFC.

---

## Consequences

- Fixtures stamped with `rulesetVersion: classical-kabir-rules-1.0.0` (see `tests/fixtures/classical-abjad-fixtures.json`).
- Changing any policy above requires a **new** `rulesetVersion` and new immutable snapshots (no in-place overwrite of approved goldens).

## Rejected Alternatives

- Silent skip of unknown/hamza characters.
- Auto-stripping ال as invisible default.
- Counting standalone ء as 1 in v1 UI (deferred; not shown).
- Treating production `آ=1` as classical-kabir-rules-1.0.0 behavior.
- Merging mother name into primary as one ambiguous string.

## Migration Impact

- Faz 3 classical runner implements these policies behind flag.
- Shadow-compare production table vs classical ruleset for آ (fixtures: `FAB-003`, `FAB-012a`, `FAB-CONFLICT-AA`; diverge pair `FAB-012b`).

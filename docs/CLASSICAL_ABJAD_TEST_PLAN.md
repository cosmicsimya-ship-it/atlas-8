# CLASSICAL ABJAD TEST PLAN

**Status:** Normative test plan (design)  
**Document id:** `atlas-classical-abjad-test-plan-v1`  
**Last updated:** 2026-08-01  
**Fixtures:** [`tests/fixtures/classical-abjad-fixtures.json`](../tests/fixtures/classical-abjad-fixtures.json)  
**RFCs:** [RFC-009](./rfc/RFC-009-TURKISH-ARABIC-TRANSLITERATION.md), [RFC-010](./rfc/RFC-010-CLASSICAL-ABJAD-FIXTURES.md)  
**Frozen:** `methodologyId=abjad-kabir-classical-v1` · `rulesetVersion=classical-kabir-rules-1.0.0`  
**Aligns with:** [TEST_MATRIX_SPEC.md](./TEST_MATRIX_SPEC.md), ADR-001, ADR-003, ADR-005  
**Implementation status:** Plan + fixtures — runners **not** changed in Conditional GO doc task

---

## 1. Purpose

`abjad-kabir-classical-v1` / `classical-kabir-rules-1.0.0` için fixture-driven doğrulama planı.

---

## 2. Scope

- L1–L7 fixture assertions
- 15 minimum kategori coverage
- Mother-name parts model
- Contract / safety checks

---

## 3. Out of Scope

- Production runner / endpoint / UI implementasyonu
- Esma catalog goldens

---

## 4. Test layers

| Layer | Assert |
|-------|--------|
| **L0 Stamp** | Root `rulesetVersion === "classical-kabir-rules-1.0.0"` (not null) |
| **L1 Normalize** | NFC, harakat ignore, tatwil remove, shadda expand, hamza map, ة→ه, ى→ي, Persian fold, لا decompose, آ→ا+ا |
| **L2 Sum** | Without parts: `sum(letters.value) === expectedTotal`. With parts: `sum(part.letters.value) === part.subtotal`; if `includeMotherName`: `sum(subtotals) === combinedTotal`; else `combinedTotal === null` |
| **L3 No silent drop** | Unsupported → `expectError` / non-success |
| **L4 Confirmation** | Latin→classical: `requiresUserConfirmation === true` when RFC-009 §8 triggers |
| **L5 Alternatives** | Alternate spellings; divergent groups differ |
| **L6 Isolation** | Classical pass **MUST NOT** require digit reduction; `enabledForClassicalPrimary=false` |
| **L7 Contract** | No `selectedArabicSpelling`; no user-facing % for `transliterationCertainty` |

---

## 5. Fixture execution rules

1. Load `classical-abjad-fixtures.json`.
2. Assert root identities (methodologyId, methodologyVersion, rulesetVersion).
3. Apply L2 sum rules (parts-aware).
4. `status: "blocked_pending_ruleset_approval"` → skip/xfail numeric engine compare; **MUST NOT** coerce to `0`.
5. Unsupported / empty letters + `expectError` → failure if silent total.
6. آ set: `FAB-003`, `FAB-012a`, `FAB-CONFLICT-AA` (expand); sibling `FAB-012b` (bare ادم). **There is no `FAB-012` id.**
7. Optional digit reduction never gates classical green.

---

## 6. Case catalog (minimum 15)

| Test id | Fixture id | Category | Primary assert |
|---------|------------|----------|----------------|
| CA-T-001 | `FAB-001` | pure_arabic_name | محمد = 92 |
| CA-T-002 | `FAB-002` | turkish_name | Şule→شوله = 341; confirm |
| CA-T-003 | `FAB-003` | long_vowel | Âdem→آدم expand = 46 |
| CA-T-004 | `FAB-004` | turkish_special_letters | Çağrı folded path; confirm |
| CA-T-005 | `FAB-005` | shadda | اللّه expand = 96 |
| CA-T-006 | `FAB-006` | standalone_hamza | ء = 0 traced; no UI count-as-1 |
| CA-T-007 | `FAB-007` | ta_marbuta | فاطمة →ه = 135 |
| CA-T-008 | `FAB-008` | alif_maqsura | موسى →ي = 116 |
| CA-T-009 | `FAB-009` | lam_alif | لا = 31 |
| CA-T-010a | `FAB-010a` | mother_name | parts primary only; combinedTotal null |
| CA-T-010b | `FAB-010b` | mother_name | parts primary+mother; combinedTotal 227 |
| CA-T-011 | `FAB-011` / `FAB-011b` | alternate_spellings | رحمن vs الرحمن |
| CA-T-012a/b | `FAB-012a`, `FAB-012b` | divergent_totals | آدم 46 vs ادم 45 |
| CA-T-013 | `FAB-013` | unsupported_character | error; no silent total |
| CA-T-014 | `FAB-014` | compound_name | نورالدين path; confirm |
| CA-T-015 | `FAB-015` | abd_structure | عبدالمجيد = 164 |

---

## 7. Pass / fail criteria

**Doc/fixture gate (this Conditional GO task):**

- [x] `rulesetVersion` stamped
- [x] Mother parts schema
- [x] آ / ء policies documented
- [x] Numeric fixtures internally consistent
- [x] Production paths untouched

**Post-runner (future production gate):**

- Implementation matches ADR-005
- Confirmation errors per RFC-009
- Shadow compare flags آ production divergence until classical path uses ruleset expand

---

## 8. Ruleset freeze gate

**Status: CLOSED for Conditional GO** — `classical-kabir-rules-1.0.0` frozen in ADR-005 + fixtures.

Further orthography changes require version bump + new snapshots.

---

## 9. Safety checks (copy)

Reject: tek doğru yazım / kesin ebced / kaderin / adınızın tek doğru Arapçası / unverified % certainty.

Required: RFC-009 confirmation strings; ADR-005 آ user message on classical آ results.

---

## 10. Acceptance criteria

- [x] Plan references fixture file + RFC-009/010
- [x] 15 categories mapped to FAB-* ids (real JSON ids verified)
- [x] Parts-aware L2 rules
- [x] No production code in this task

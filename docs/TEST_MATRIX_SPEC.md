# TEST_MATRIX_SPEC

**Status:** Normative test specification (design only)  
**Document id:** `atlas-abjad-esma-test-matrix-v1`  
**Last updated:** 2026-07-31  
**Implementation status:** Spec only — tests not implemented by this task

---

## 1. Purpose

Verification matrix including contract, isolation, classical normalization goldens, UI, and safety — aligned to ADR locks.

---

## 2. Scope

Fixtures, phase gates, contract asserts, UI/safety.

---

## 3. Out of Scope

Implementing runners in this task.

---

## 4. Definitions

`BLOCKED_PENDING_RULESET_APPROVAL` — placeholder status for numeric goldens before ruleset freeze (MUST NOT use bare `null` without this marker).

---

## 5. Normative Rules

1. Classical primary assert = `total`; classical validity MUST NOT require `reducedDigit`.
2. New responses MUST NOT contain `selectedArabicSpelling` or scalar `confidence`.
3. All responses MUST contain four `assessment` fields.
4. `inputSnapshot` vs `reproducibilitySnapshot` separation asserted.
5. No silent F fallback.
6. Unsupported Latin chars traced in v2 motif path.

---

## 6. Architecture — layers

Unit → component → integration → UI → safety (as prior). Faz 7 = consolidated CI.

---

## 7. Fixture schema

Use `selectedSpelling`, `methodologyId`, `assessment`, snapshot pair. Expected totals may be:

```text
expectedTotal: "BLOCKED_PENDING_RULESET_APPROVAL"
```

---

## 8. API Impact

Contract tests against flagged endpoints.

---

## 9. UI Impact

Default tab Latin; classical confirmation; empty esma state.

---

## 10. Method Disclosure

Labels and experimental badge asserts.

---

## 11. Required cases

### 11.1 Contract tests

| ID | Assert |
|----|--------|
| TM-CONTRACT-001 | `selectedArabicSpelling` absent on new responses |
| TM-CONTRACT-002 | `selectedSpelling` present when classical confirmed |
| TM-CONTRACT-003 | No scalar `confidence` field |
| TM-CONTRACT-004 | Four assessment fields always present |
| TM-CONTRACT-005 | `inputSnapshot` and `reproducibilitySnapshot` both present and nested correctly |
| TM-CONTRACT-006 | New Latin results use `atlas-letter-number-v2` |
| TM-CONTRACT-007 | Letter array field name `tokenizedLetters` |

### 11.2 Method isolation

| ID | Assert |
|----|--------|
| TM-ISO-001 | Latin motif does not invoke classical ruleset |
| TM-ISO-002 | Classical result valid without `reducedDigit` |
| TM-ISO-003 | Esma theme method runs without ebced total |
| TM-ISO-004 | F never auto-selected on empty themes |

### 11.3 Classical normalization goldens

Separate cases for: `لا` أ إ آ ؤ ئ ء ة ى پ چ ژ گ + shadda + harakat + tatwil samples.

Status until freeze: `BLOCKED_PENDING_RULESET_APPROVAL`.

### 11.4 Prior required product cases

TM-AR-001, TM-TR-001, TM-DIAC-001, TM-SHADDA-001, TM-TMAR-001, TM-MAQ-001, TM-HAMZA-001, TM-LA-001, TM-MOTHER-001/002, TM-SPELL-001, TM-ESMA-SPELL-001, TM-ESMA-COLLIDE-001, TM-ESMA-DIVERGE-001 (F vs B/C when user opts into F).

### 11.5 UI tests

| ID | Assert |
|----|--------|
| TM-UI-001 | Default tab Latin motif |
| TM-UI-002 | “Klasik ebced değildir” visible |
| TM-UI-003 | Classical requires spelling confirmation |
| TM-UI-004 | Alternate spellings show separate totals |
| TM-UI-005 | Esma method name visible |
| TM-UI-006 | Empty match does not silent-drop to F |
| TM-UI-007 | Experimental method labeled deneysel |

### 11.6 Safety assertions

Must not appear:

```text
senin esman
gerçek esman
kesin uygun
kesinlikle budur
kaderin
şu kadar zikir çek
hastalığını iyileştirir
```

---

## 12. Edge Cases

Legacy v1 records readable; adapter tests for forbidden fields not re-emitted on new API.

---

## 13. Error Handling tests

Confirmation required; empty classical; unknown match method; modular modulus mismatch.

---

## 14. Security / Safety

§11.6 + existing safety.js pattern regression when code phase starts.

---

## 15. Open Questions

Golden numeric fill ownership after source review.

---

## 16. Acceptance Criteria

- [ ] Contract + isolation + UI + safety rows present
- [ ] Goldens use BLOCKED marker not silent null
- [ ] Spec only

---

## 17. Phase gates

| Phase | Minimum |
|-------|---------|
| Pre-Faz | ADRs accepted (doc gate) |
| 1 | Label/disclosure |
| 2 | Contract metadata/assessment |
| 3 | Classical arabic-only + BLOCKED goldens registered |
| 4 | Translit confirmation UI |
| 5 | Catalog version echo |
| 6 | Default A; no silent F; B/C/D behind approval |
| 7 | Consolidated CI |
| 8 | Full UI/safety e2e |

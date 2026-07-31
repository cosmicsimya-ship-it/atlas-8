# CLASSICAL_ABJAD_RULES_SPEC

**Status:** Normative rules specification (design only)  
**methodologyId:** `abjad-kabir-classical-v1`  
**methodologyVersion:** `1.0.0`  
**rulesetVersion (frozen):** `classical-kabir-rules-1.0.0`  
**Deprecated alias:** `classical-arabic-abjad-kabir-v1`  
**Document id:** `atlas-abjad-kabir-classical-rules-v1`  
**Last updated:** 2026-08-01  
**ADRs:** ADR-001, ADR-003, ADR-005  
**Implementation status:** Spec only

---

## 1. Purpose

Klasik Ebced-i Kebîr kuralları, ADR-005 ortografi defaults ve kanonik `selectedSpelling` / `normalizedSpelling` akışı.

---

## 2. Scope

28-letter table, orthographic policies, normalization order, article-as-variant spellings, assessment expectations for classical results.

---

## 3. Out of Scope

Latin motif (`atlas-letter-number-v2`), Esma matching formulas, production code.

---

## 4. Definitions

| Term | Definition |
|------|------------|
| **selectedSpelling** | User-approved original Arabic spelling (ADR-001) |
| **normalizedSpelling** | Post-normalization countable form |
| **tokenizedLetters** | Canonical letter trace array name |
| **Policy / Variant / Source Basis / Limitations** | Dispute documentation quartet |

---

## 5. Normative Rules

1. Compute **MUST** use `normalizedSpelling` derived from `selectedSpelling` (or expert-override spelling after confirm).
2. Primary result **MUST** be `total`.
3. `optionalReductions` MUST NOT be presented as classical primary; default off / separate panel.
4. Normalization order **MUST** be:

```
Unicode NFC → hareke → tatvil → şedde → hemze → ligature → hesap
```

5. Unsupported/unknown handling MUST NOT silent-drop without trace.
6. Field name `selectedArabicSpelling` MUST NOT appear in normative schemas.
7. Assessment per ADR-003 (classical rows in table).

### 5.1 Production baseline (verified)

`ARABIC_ABJAD` in `server/symbolic-analysis/data/ebced-table.js` — Eastern kabir values including ة=5, ى=10, أ/إ/آ=1. Shadda / standalone ء / Persian fold: **NOT VERIFIED** as implemented (absent).

---

## 6. Architecture

```
selectedSpelling
  → normalize (order above) → normalizedSpelling
  → tokenizedLetters → total
  → optionalReductions? (separate)
  → assessment + reproducibilitySnapshot
```

`methodologyVersion`: `1.0.0` · `rulesetVersion`: **`classical-kabir-rules-1.0.0`** (frozen; see ADR-005)

### Mother name (normative)

- Default `includeMotherName: false`
- Model: `parts[]` with `type: "primary" | "motherName"`, each with `selectedSpelling`, `letters[]`, `subtotal`
- `combinedTotal` only when `includeMotherName === true` and both spellings confirmed
- **MUST NOT** merge into one ambiguous string for counting

### آ / ء (see ADR-005)

- Classical: آ→ا+ا; production table آ=1 is not this ruleset
- ء: zero-value-but-traced; keep in output; no hemze=1 UI in v1

---

## 7. Data Model

Letter trace entry uses `tokenizedLetters[]` with rule ids (`abjad-kabir.*`). Ambiguities array for policy disclosures.

Classical assessment:

- Direct Arabic: `transliterationCertainty` null or validation score; `orthographicDisputeLevel` required; `matchStrength` null.
- Via transliteration: certainty + dispute required; matchStrength null.

---

## 8. API Impact

Requires `selectedSpelling` (or confirmation token). Errors: empty after normalize; confirmation required.

---

## 9. UI Impact

Primary: Toplam. Optional numerology separate. Show `selectedSpelling` vs normalized if differ. Trace folds/shadda.

---

## 10. Method Disclosure

Classical Kebîr; not fate; reductions not classical primary.

---

## 11. Locked policies (ADR-005)

For each: **Policy**, **Variant**, **Source Basis**, **Limitations**.

### 11.1 Base 28 (Eastern kabir)

- **Policy:** Production-compatible Eastern values for base letters.
- **Variant:** Maghribî → separate future methodologyId.
- **Source Basis:** Common kebîr tables; not unique truth.
- **Limitations:** Regional variants unsupported in v1.

### 11.2 Shadda

- **Policy:** `expand-and-count` (twice).
- **Variant:** `shadda-ignore`; dual-report.
- **Source Basis:** Contested among practitioners.
- **Limitations:** Atlas v1 choice labeled in disclosure.
- Trace: original + expanded.

### 11.3 Harakat

- **Policy:** `ignore`.
- **Variant:** reject vocalized input.
- **Source Basis:** Values are letter-based.
- **Limitations:** Vocalization never adds value in v1.

### 11.4 Tatwil

- **Policy:** `remove`.
- **Variant:** none material.
- **Source Basis:** Orthographic elongation.
- **Limitations:** —

### 11.5 Lam-alif

- **Policy:** `decompose` → ل + ا.
- **Variant:** presentation-form edge cases.
- **Source Basis:** Two letters historically.
- **Limitations:** Unicode ligature forms must normalize first.

### 11.6 Hamza carriers & standalone

Carrier map (v1):

```text
أ → ا
إ → ا
آ → ا + ا
ؤ → و
ئ → ي
```

Standalone `ء`:

- **Policy:** `zero-value-but-traced` (value 0; NOT silent drop).
- **Variant:** count as 1; seat-only; omit entirely (rejected for silent).
- **Source Basis:** Contested; Atlas v1 explicit engineering choice.
- **Limitations:** MUST disclose zero-value policy; not claimed as universal classical consensus.

### 11.7 Te marbuta

- **Policy:** ة → ه (then ه value 5).
- **Variant:** as ت (400) disputed.
- **Source Basis:** Common fold to hāʾ class.
- **Limitations:** Position-dependent debates → disputedSpellings.

### 11.8 Alif maqsura

- **Policy:** ى → ي.
- **Variant:** as alif 1 (rare).
- **Source Basis:** Aligns with production ى=10 via ي.
- **Limitations:** —

### 11.9 Persian/Ottoman extras

- **Policy:** `fold-with-explicit-map` پ→ب چ→ج ژ→ز گ→ك; **traced**; silent folding **MUST NOT**.
- **Variant:** `reject-extras`.
- **Source Basis:** Ottoman practice variable.
- **Limitations:** Fold ≠ claiming extras are classical 28.

### 11.10 Article ال

- **Policy:** Never auto-strip. With/without article are **separate** `selectedSpelling` alternatives (e.g. رحمن vs الرحمن), each own `total`.
- **Variant:** user picks spelling family.
- **Source Basis:** Both practices attested; Atlas does not hide the fork.
- **Limitations:** Matching methods must declare which spelling’s total they use.

### 11.11 Optional reduction

Separate numerology layer only.

---

## 12. Examples

Illustrative only until goldens approved:

- `لا` → ل+ا  
- `ء` traced value 0  
- `ة` → ه  

Exact totals: Test Matrix `BLOCKED_PENDING_RULESET_APPROVAL` until ruleset freeze.

---

## 13. Edge Cases

Empty after normalize → error. Mixed Latin without transliteration gate → reject classical. Expert override → still normalize + confirm.

---

## 14. Error Handling

`CLASSICAL_ABJAD_EMPTY`, `CLASSICAL_UNSUPPORTED_CHAR`, `TRANSLITERATION_CONFIRMATION_REQUIRED`.

---

## 15. Security / Safety Language

No fate/decree claims; disclose policies.

---

## 16. Open Questions

- Whether Variant “ء=1” is ever offered in a future ruleset bump (v1: **no UI option**).
- Gazetteer fill timeline (non-blocking for Arabic-only classical).

---

## 17. Acceptance Criteria

- [ ] ADR-005 policies written with quartet headers
- [ ] `selectedSpelling` / `normalizedSpelling` / `tokenizedLetters`
- [ ] No `selectedArabicSpelling` in normative schema
- [ ] No scalar `confidence`
- [ ] Spec only

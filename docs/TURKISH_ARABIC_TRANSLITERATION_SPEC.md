# TURKISH_ARABIC_TRANSLITERATION_SPEC

**Status:** Normative specification (design only)  
**Document id:** `atlas-turkish-arabic-transliteration-v1`  
**Last updated:** 2026-07-31  
**ADRs:** ADR-001, ADR-002, ADR-003  
**Implementation status:** Spec only

---

## 1. Purpose

Controlled Latin/Turkish → Arabic spelling proposals for classical path only. Not a replacement for `atlas-letter-number-v2`.

---

## 2. Scope

Proposal record, ambiguity matrix, confirmation, expert override, optional gazetteer schema, assessment field `transliterationCertainty`.

---

## 3. Out of Scope

Latin motif calculation, Esma matching, production code.

---

## 4. Definitions

Canonical spelling fields: **ADR-001**.  
Assessment: **ADR-003** (`transliterationCertainty: number | null`, 0–1 recommended).

---

## 5. Normative Rules

1. Classical path **MUST**:

```
originalInput → proposals → selectedSpelling → normalizedSpelling → classical engine
```

2. Latin motif path **MUST NOT** require this layer.
3. **`autoAcceptHighCertainty: false`** — all Latin→Arabic classical runs require user confirmation. High certainty only affects proposal ranking.
4. Scalar `confidence` **MUST NOT** appear on transliteration records or API responses.
5. Silent drop of mappable diacritics (e.g. `â`) **MUST NOT**.
6. Expert override allowed under §11.

### 5.1 Current production (verified)

No Latin→Arabic spelling pipeline; direct `LATIN_ABJAD`; `â` skipped — gap for classical transliteration (MUST NOT replicate).

---

## 6. Architecture

Proposal engine → UI confirm → `selectedSpelling` → Classical RFC normalize.

Layer version id (adapter): `transliteration-tr-ar-v1` (not a user methodology tab by itself).

---

## 7. Data Model

```ts
type TransliterationRecord = {
  originalInput: string;
  normalizedInput: string; // Latin-side normalize
  proposedArabicSpellings: ProposedArabicSpelling[];
  selectedSpelling: string | null;
  alternativeSpellings: ProposedArabicSpelling[];
  ambiguousLetters: AmbiguousLetter[];
  transliterationCertainty: number | null; // 0–1; part of assessment when composed
  userConfirmationRequired: true; // always true while autoAcceptHighCertainty is false
  notes: string[];
};
```

**MUST NOT** include legacy field `confidence`.

Certainty bands for ranking only: map numeric to UI labels without reintroducing scalar API `confidence`.

### 7.1 Confirmation

With `autoAcceptHighCertainty: false`, `userConfirmationRequired` is always `true` for Latin→classical.

---

## 8. API Impact

- Propose endpoint / step.
- Classical run requires `selectedSpelling`.
- Error: `TRANSLITERATION_CONFIRMATION_REQUIRED`, `TRANSLITERATION_NO_CANDIDATES`, `TRANSLITERATION_INVALID_SELECTION`, `TRANSLITERATION_MIXED_SCRIPT`.

---

## 9. UI Impact

Show Arabic candidates; ambiguous letters; confirm before total. Offer switch to Latin motif tab (ADR-002) without implying classical.

---

## 10. Method Disclosure

Suggestions only; alternatives may change totals; not sacred orthography certification.

---

## 11. Examples — ambiguity (summary)

Retain Policy/Variant/Source Basis for: c ç ğ ı i j ö ş ü û v p â (full matrix from prior RFC content conceptually).  
`ş` → ش low ambiguity; `ğ`/`ı`/`ö` high; `â` → ا/آ candidates never drop.

---

## 12. Expert override

- Manual Arabic entry allowed.
- Mark `source: "expert-override"` on spelling provenance.
- MUST pass Unicode + classical normalization; show `normalizedSpelling` preview.
- MUST NOT compute until final confirm.
- MUST NOT label as “verified historical spelling.”

---

## 13. Gazetteer

Not required for v1. Ownership: **Transliteration domain dataset** (not magic maps in runtime code).

```ts
{
  latinForm: string;
  proposedSpellings: string[];
  locale: string;
  sourceBasis: SourceReference[];
  reviewStatus: "draft" | "reviewed" | "approved";
}
```

---

## 14. Edge Cases

Already Arabic → skip propose; `selectedSpelling` after confirm/normalize; certainty may be null. Nicknames → low certainty, confirmation still required.

---

## 15. Error Handling

See §8.

---

## 16. Security / Safety Language

No “adınızın tek doğru Arapçası” claims.

---

## 17. Open Questions

- Gazetteer curation timeline (non-blocking for Faz 4 minimum propose heuristics).
- Numeric certainty calibration dataset — NOT VERIFIED.

---

## Acceptance Criteria

- [ ] `selectedSpelling` only; no `selectedArabicSpelling`
- [ ] No scalar `confidence`
- [ ] `autoAcceptHighCertainty: false`
- [ ] Expert override + gazetteer schema
- [ ] Spec only

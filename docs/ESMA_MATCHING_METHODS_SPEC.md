# ESMA_MATCHING_METHODS_SPEC

**Status:** Normative matching specification (design only)  
**Document id:** `atlas-esma-matching-methods-v1`  
**Last updated:** 2026-07-31  
**Depends on:** ADR-003, ADR-004, Esma 99 Data Model, Classical (for B/C/D)  
**Implementation status:** Spec only

---

## 1. Purpose

Separate Esma recommendation methods with distinct methodologyIds; default is theme/intention — **not** experimental hash stride. Silent fallback to Hash+7 **MUST NOT**.

---

## 2. Scope

Methods A–F, defaults (topK, modulus), empty-match UX, assessment `matchStrength`, disclosure.

---

## 3. Out of Scope

Catalog seed fill, medical/zikir claims, production code.

---

## 4. Definitions

| Term | Definition |
|------|------------|
| **Silent fallback** | Auto-switching to another methodologyId without user choice — **forbidden** |
| **Experimental F** | Atlas Experimental Stable Motif Selection (legacy hash+7 algorithm) |

---

## 5. Normative Rules

1. Layer independent of ebced engines; may optionally consume totals/themes.
2. Distinct `methodologyId` per method.
3. **Default method:** `esma-theme-intention-match-v1`.
4. **`defaultTopK: 3`**, **`maximumTopK: 5`**.
5. Modular method id: `esma-modular-index-match-v1` with **`defaultModulus: 99`**; **MUST NOT** be product default; **MUST NOT** run if modulus ≠ active counted entry cardinality under catalog count policy (names-only-99 ⇒ 99 divine-name entries).
6. If insufficient theme/data: MAY return empty set; UI message:

```text
Bu girdilerle yeterince güçlü bir sembolik eşleşme bulunamadı.
```

User MAY pick another method. F only if explicitly selected.
7. Hash+7 **MUST NOT** be defined as default anywhere.
8. Assessment: `matchStrength` required (ADR-003); other axes per table.
9. New responses: no scalar `confidence`.

### 5.1 Production (verified)

`theme-intention-catalog-match`; if no theme hit → `(start + i*7) % 35` — legacy behavior to be opt-in F only under v2 policy.

---

## 6. Architecture

```
router(explicit id | default esma-theme-intention-match-v1)
  A theme-intention (default)
  B exact abjad
  C nearest
  D modular (opt-in)
  E user intent themes
  F experimental stable motif (explicit opt-in only)
→ empty OR ranked[1..K] + assessment
```

B/C/D **MUST** require approved catalog + classical totals (Migration Faz 5→6). A/E MAY run earlier with explicit `catalogVersion` (including legacy 35).

---

## 7. Data Model

Shared match result includes `methodologyId`, versions, `catalogVersion`, `inputSnapshot`, `selected[]`, `assessment`, `userLabel`, `claimLevel`. Uses `selectedSpelling` when total derived from classical (not `selectedArabicSpelling`).

---

## 8. Methods

### A. Theme / intention (DEFAULT)

| Field | Value |
|-------|--------|
| methodologyId | `esma-theme-intention-match-v1` |
| Formula | Soft theme overlap scoring; top K |
| Inputs | Intention themes / hints |
| Claim level | Low |
| User text | Tema / niyet benzerliğine göre önerilen isimler |

### B. Exact abjad

| methodologyId | `esma-match-abjad-exact-v1` |
| Formula | `entryTotal == T` for `selectedSpelling` totals under same ruleset |
| Gate | Catalog approved + classical total |

### C. Nearest

| methodologyId | `esma-match-abjad-nearest-v1` |
| Formula | minimize \|entryTotal−T\| |

### D. Modular

| methodologyId | `esma-modular-index-match-v1` |
| defaultModulus | 99 |
| Rules | Not default; refuse if modulus mismatch vs counted entries |

### E. User-selected intention themes

| methodologyId | `esma-match-user-intent-theme-v1` |
| Inputs | Explicit theme ids |

### F. Atlas Experimental Stable Motif Selection

| methodologyId | `esma-match-atlas-experimental-stable-motif-v1` |
| Formula | Legacy `nameOffset`; `(start + i*7) % catalogSize` |
| Rules | Explicit opt-in only; **MUST NOT** silent fallback |
| User text | Deneysel; klasik ebced değildir |

---

## 9. API Impact

`esmaMatchMethodologyId` optional → default A. Reject unknown ids. Empty result ≠ auto-F.

---

## 10. UI Impact

Show method name; experimental badge for F; empty-state copy; never raw `nameOffset` by default.

---

## 11. Method Disclosure

methodologyId, catalogVersion, claim level, non-treatment disclaimer; F marked experimental.

---

## 12. Examples

Intention sabır → A. No themes → empty + offer methods (not F). User selects F → stride picks. Exact totals after catalog approval → B.

---

## 13. Edge Cases

Article policy mismatch on T; mother name affects T not F — disclose snapshot.

---

## 14. Error Handling

`ESMA_MATCH_METHOD_UNKNOWN`, `ESMA_MATCH_INPUT_INSUFFICIENT`, `ESMA_MATCH_DEFAULT_REFUSED` (if client demands silent F), `ESMA_MATCH_CATALOG_MISMATCH`, modular modulus mismatch.

---

## 15. Safety Language

MUST NOT: senin esman, kesin uygun, zikir dozu, hastalık, kader.  
MUST: önerilen isimler / benzerlik / sembolik referans / dinî rehberlik değildir.

---

## 16. Open Questions

- Soft-overlap weight tweaks after catalog themes expand.
- Whether intention substring hints remain alongside explicit E.

---

## 17. Acceptance Criteria

- [ ] Default A id locked; F not default; no silent fallback
- [ ] topK and modular modulus locked
- [ ] B/C/D gated on approved catalog
- [ ] Spec only

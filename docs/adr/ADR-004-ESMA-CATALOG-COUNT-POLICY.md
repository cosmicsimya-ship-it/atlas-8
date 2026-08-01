# ADR-004: Esma Catalog Count Policy

**Status:** Accepted for Specification  
**Date:** 2026-07-31  
**Spec series:** Atlas Ebced / Esma Architecture v2

---

## Context

99-name lists diverge on whether lafẓatullāh is inside the count. Shipping without a locked policy blocked Faz 5 (`includesAllahLafza` previously pending).

## Decision

First catalog variant:

```ts
listVariantId: "atlas-esma-99-curated-tr-v1"
catalogVersion: "esma-99-curated-tr-v1"
includesAllahLafza: false
countPolicy: "names-only-99"
```

- MUST NOT be marketed as the single true 99 list.
- Lafẓatullāh MAY exist as `entryType: "lafzatullah"` outside the default count.
- Divine names use `entryType: "divine-name"`.
- `curationStatus` remains `"draft"` until source review completes; Faz 5 production exit requires `"approved"`.

## Consequences

- Modular matching modulus aligns with names-only active entry count policy (see Matching RFC).
- UI discloses count policy without religious finality claims.

## Rejected Alternatives

- `allah-within-99` or `allah-plus-99` as first ship (deferred as alternate `listVariantId`s).
- Pretending one historical list is universal.

## Migration Impact

- Production 35-entry catalog remains until curated 99 approved.
- Dual-run under flag allowed while `curationStatus: "draft"`.

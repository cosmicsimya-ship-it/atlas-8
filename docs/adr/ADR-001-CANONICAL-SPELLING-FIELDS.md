# ADR-001: Canonical Spelling Fields

**Status:** Accepted for Specification  
**Date:** 2026-07-31  
**Spec series:** Atlas Ebced / Esma Architecture v2

---

## Context

Architecture review found the same concept named both `selectedSpelling` and `selectedArabicSpelling` across RFCs. Implementors would fork schemas.

## Decision

1. Canonical field for user-approved Arabic orthography used in classical abjad: **`selectedSpelling`** (`string`).
2. **`selectedArabicSpelling` MUST NOT** appear in new API responses or normative schemas (except deprecation/migration notes).
3. Engine-facing normalized form is a **separate** field: **`normalizedSpelling`** (`string`).
4. `selectedSpelling` and `normalizedSpelling` are **not** the same concept.

## Consequences

- All RFCs and fixtures use `selectedSpelling`.
- Classical pipeline: confirm `selectedSpelling` → derive `normalizedSpelling` via classical normalization order → compute.
- Clients must not assume display spelling equals countable spelling.

## Rejected Alternatives

- Keeping both names as aliases indefinitely (schema drift).
- Using only `normalizedSpelling` in APIs (hides user-visible choice).

## Migration Impact

- Compatibility adapters MAY map legacy `selectedArabicSpelling` → `selectedSpelling` on read.
- New writes MUST emit only `selectedSpelling`.

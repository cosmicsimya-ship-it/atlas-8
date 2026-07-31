# ADR-003: Confidence and Assessment Contract

**Status:** Accepted for Specification  
**Date:** 2026-07-31  
**Updated:** 2026-08-01 (Conditional GO gate)  
**Spec series:** Atlas Ebced / Esma Architecture v2

---

## Context

Review found inconsistent confidence: Architecture required four split fields; Matching required a subset; Transliteration still showed legacy `confidence`. A single scalar misrepresents multi-axis uncertainty. RFC-009 interim 0–1 maps are **not calibrated**.

## Decision

Canonical type (defined once here; RFCs MUST reference, not redefine incompatibly):

```ts
type MethodologyAssessment = {
  transliterationCertainty: number | null;
  orthographicDisputeLevel: "none" | "low" | "medium" | "high" | "not-applicable";
  matchStrength: number | null;
  interpretationLimitations: string[];
};
```

Normative rules:

- All four fields MUST appear on every methodology result.
- Irrelevant fields MUST NOT be omitted; use `null` or `orthographicDisputeLevel: "not-applicable"`.
- `interpretationLimitations` MUST always be an array (possibly empty).
- Legacy scalar `confidence` is **forbidden** on new API responses.
- Migration adapters MAY read legacy `confidence` for old records only.

### `transliterationCertainty` — Conditional GO policy

| Layer | Policy |
|-------|--------|
| Machine / assessment field | **MAY** store interim `number \| null` (e.g. band→0.85/0.55/0.30 for internal use) |
| Calibration | **`NOT VERIFIED`** — no claimed accuracy |
| **User-facing UI** | **MUST NOT** show raw 0–1 or percentage (“%85”) |
| **User-facing UI** | **MUST** use ordinal bands only: **yüksek / orta / düşük** (from proposal ranking band) |
| Until calibration verified | Treat numeric field as internal-only |

System expectations:

| System | transliterationCertainty | orthographicDisputeLevel | matchStrength |
|--------|--------------------------|--------------------------|---------------|
| Classical, direct Arabic | `null` or spelling-validation score (not shown as %) | required | `null` |
| Classical, via transliteration | required machine field; UI shows band only | required | `null` |
| Atlas Latin motif | `null` | `not-applicable` | `null` |
| Esma matching | nullable per source spelling | per catalog record | required |

## Consequences

- UI shows human labels for each axis; no single “güven: %72” as sole signal.
- Compose/safety layers consume `interpretationLimitations`.

## Rejected Alternatives

- Keeping dual top-level `confidence` + split fields forever.
- Showing unverified percentage certainty to users.
- Omitting N/A fields to “simplify” JSON.

## Migration Impact

- Faz 2 additive metadata introduces `assessment`; derived legacy `confidence` only inside adapter if old clients require it — not in new response body.
- RFC-009 / Decision Matrix band→numeric maps remain internal until a verified calibration dataset exists.

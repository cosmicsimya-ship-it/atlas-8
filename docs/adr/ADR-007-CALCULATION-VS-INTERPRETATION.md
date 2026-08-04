# ADR-007 — Calculation vs Interpretation Separation

**Status:** Accepted  
**Date:** 2026-08-03  
**Document id:** `adr-007-calculation-vs-interpretation`  

## Context

Some Atlas paths already separate calc from prose (daily-analysis, numerology, tarot selection). Astrology narrative still relies on LLM with injected ephemeris/natal data; natal Ascendant is computed by `server/natal-engine` when inputs permit.

## Decision

1. Deterministic calculation MUST NOT be performed by LLMs.  
2. Interpretation MAY use templates and/or LLMs but MUST consume `CalculationResult` only.  
3. `daily-analysis` remains `interpretation: null` at the computation boundary.  
4. Natal Ascendant/houses MUST NOT be invented; when birth time/place are incomplete the engine omits angles. `ASCENDANT_CALC_AVAILABLE` is true only because `server/natal-engine` can compute ASC from verified inputs.

## Consequences

- Natal degrees/houses come from the calculation engine; LLM interprets verified blocks only.  
- Engine adapters expose `calculate` and `interpret` as distinct steps.

## Alternatives rejected

- Single LLM prompt that performs astrology mathematics  
- Faking houses or rising when birth time/place is unknown  

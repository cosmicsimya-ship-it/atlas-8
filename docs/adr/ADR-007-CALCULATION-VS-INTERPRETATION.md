# ADR-007 — Calculation vs Interpretation Separation

**Status:** Accepted  
**Date:** 2026-08-03  
**Document id:** `adr-007-calculation-vs-interpretation`  

## Context

Some Atlas paths already separate calc from prose (daily-analysis, numerology, tarot selection). Astrology narrative still relies on LLM with injected ephemeris data, and natal Ascendant calculation is not implemented.

## Decision

1. Deterministic calculation MUST NOT be performed by LLMs.  
2. Interpretation MAY use templates and/or LLMs but MUST consume `CalculationResult` only.  
3. `daily-analysis` remains `interpretation: null` at the computation boundary.  
4. Natal Ascendant/houses MUST NOT be invented; `ASCENDANT_CALC_AVAILABLE` stays false until a real natal engine ships.

## Consequences

- Astrology narrative depth stays bounded until natal calc exists.  
- Engine adapters expose `calculate` and `interpret` as distinct steps.

## Alternatives rejected

- Single LLM prompt that performs astrology mathematics  
- Faking houses or rising when birth time/place is unknown  

# ADR-009 — Cross-Domain Synthesis Boundaries

**Status:** Accepted  
**Date:** 2026-08-03  
**Document id:** `adr-009-cross-domain-synthesis`  

## Context

`server/cross-layer-synthesis` correlates themes across layers. Soft synthesis also exists inside symbolic-analysis. Risk: implying one scientific method across unrelated symbolic systems, or mutating peer results.

## Decision

Cross-domain synthesis MAY correlate themes across engines but MUST NOT:

- mutate peer `calculations` / evidence  
- imply shared scientific validity across astrology, numerology, tarot, dreams, etc.  
- invent Qur’anic text  
- collapse Latin motif, classical abjad, and Esma into one truth  

Synthesis outputs use `evidenceType: model_synthesis` and disclose methodological limits.

## Consequences

- Evolve `cross-layer-synthesis` into the Domain Core synthesis engine.  
- Keep message-bridge safety filters.  
- Legacy symbolic soft synthesis maps via adapter without changing peer layer math.

## Alternatives rejected

- Mega-prompt that re-answers all domains from scratch  
- Single cross-system “destiny score”  

# ADR-008 — Methodology Versioning Across Domains

**Status:** Accepted  
**Date:** 2026-08-03  
**Document id:** `adr-008-methodology-versioning`  

## Context

Symbolic analysis already freezes methodology ids (ADR-001…005). Numerology, tarot, and dream engines define methodologies in local files without a cross-domain registry.

## Decision

Extend symbolic methodology versioning to all domains:

- Stable `methodologyId`  
- Explicit `rulesetVersion`  
- Status lifecycle: `draft | experimental | active | deprecated | archived`  
- No silent school/methodology swap  

Seed from existing ids (`atlas-pythagorean-birth-v1`, `atlas-classic-tarot-v1`, `atlas-dream-v1`, `atlas-letter-number-v2`, `abjad-kabir-classical-v1`, Esma match ids). Central files under `knowledge/methodologies/` are loaded by Domain Core; code constants remain dual-source until migration tests pass.

## Consequences

- Stored analyses retain methodology versions.  
- Professional custom methodologies receive new ids and experimental/custom status.

## Alternatives rejected

- Free-text method labels without ids  
- Per-tenant silent overwrite of defaults  

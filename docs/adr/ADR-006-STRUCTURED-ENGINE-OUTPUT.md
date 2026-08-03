# ADR-006 — Structured Engine Output for All Domains

**Status:** Accepted (architecture)  
**Date:** 2026-08-03  
**Document id:** `adr-006-structured-engine-output`  

## Context

Chat engines primarily return prose; `symbolic-analysis` returns structured layers; professional and API products need one shared shape.

## Decision

All domain engines (via Domain Core adapters) MUST be able to emit `StructuredAnalysisOutput` as defined in `docs/atlas-domain-platform/ENGINE_CONTRACT.md`, with separated `calculations`, `interpretations`, `sources`, `uncertainty`, and optional `rendered.text`.

## Consequences

- Chat may continue to display prose from `rendered.text`.  
- Future `/api/v1/*` consumes structured fields.  
- Existing `/api/symbolic-analysis` wire is preserved until a bidirectional adapter exists.

## Alternatives rejected

- Prose-only forever  
- Separate ad-hoc JSON per engine without a shared schema  

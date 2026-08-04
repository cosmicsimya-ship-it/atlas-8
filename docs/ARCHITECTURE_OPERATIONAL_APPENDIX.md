# ARCHITECTURE_OPERATIONAL_APPENDIX

**Status:** Normative operational RFC (design only)  
**Document id:** `atlas-abjad-esma-operational-appendix-v1`  
**Last updated:** 2026-07-31  
**Depends on:** `CURRENT_VS_TARGET_ARCHITECTURE_SPEC.md`, ADR-001…005  
**Implementation status:** Spec only — no production code in this task

---

## 1. Purpose

Cross-cutting production concerns omitted from methodology RFCs: API versioning, persistence, audit, privacy/telemetry, cache, rollback, idempotency, rate limiting, authorization, localization.

## 2. Scope

Operational contracts for Symbolic Analysis / Ebced / Esma v2 rollout.

## 3. Out of Scope

Methodology formulas, catalog curation content, production code changes in this task.

## 4. Definitions

| Term | Meaning |
|------|---------|
| **Compatibility adapter** | Server-side mapping from legacy stored shapes to current read models |
| **calculationFingerprint** | Deterministic hash of methodology+versions+normalized inputs+policies — not the analysis id |
| **Immutable snapshot** | Stored reproducibility package never overwritten in place |

Canonical types `InputSnapshot`, `ReproducibilitySnapshot`, `MethodologyAssessment` are defined in Architecture RFC + ADR-001/003; this appendix MUST NOT redefine them incompatibly.

## 5. Normative Rules

1. Methodology correctness MUST NOT vary by payment tier (see §Authorization).
2. Snapshots are immutable; corrections create new analysis rows with `supersedesAnalysisId`.
3. PII (names) MUST NOT enter default analytics payloads.
4. Feature flags MUST have named owners and disable procedures (see Rollback).

---

## 6. API versioning

| Rule | Requirement |
|------|-------------|
| Additive metadata | MAY ship on existing endpoint behind feature flag |
| Breaking response shape | MUST require API v2 (or explicit versioned media type) |
| Old clients | Compatibility adapter MUST serve legacy read shape where contracted |
| Deprecation | Responses SHOULD include deprecation headers when legacy fields are emulated |
| Sunset | Legacy methodology ids / shapes MUST coexist ≥ **one major release** after v2 default |
| Documentation | Changelog MUST list removed fields (`selectedArabicSpelling`, scalar `confidence`) |

Suggested headers (non-binding names): `Deprecation`, `Sunset`, `Atlas-Symbolic-Envelope`.

## 7. Persistence

Minimum stored fields:

```text
analysisId
userId | anonymousSessionId
methodologyId
methodologyVersion
rulesetVersion
catalogVersion
inputSnapshot
reproducibilitySnapshot
createdAt
supersedesAnalysisId
calculationFingerprint
```

Rules:

- Snapshot immutable.
- Recompute → new row + new fingerprint; MUST NOT overwrite prior snapshot.
- Relation to existing analysis-archive (if any) is integration work in impl phases — **NOT VERIFIED** as current schema match.

## 8. Audit trail

MUST record (append-only):

```text
method selected
spelling selected
alternative rejected
expert override used
experimental method explicitly enabled
```

Each event: actor (user/session), timestamp, analysisId, methodologyId, opaque reference to spelling choice (avoid duplicating full PII into insecure logs).

## 9. Privacy and telemetry

- Names are PII.
- Raw input MUST NOT be written to default telemetry.
- Logs SHOULD use hash or redacted form.
- Full snapshot only in authorized persistence.
- Analytics events MUST NOT include calculation inputs (names, spellings, intentions verbatim).

## 10. Cache

Cache key MUST include at least:

```text
methodologyId
methodologyVersion
rulesetVersion
catalogVersion
normalizedInputHash
```

Version bump ⇒ natural invalidation. Cache MUST NOT serve classical totals for latin methodology ids.

## 11. Rollback runbook (per migration phase)

| Phase | Feature flag (suggested) | Disable procedure | Data compatibility | Rollback validation | Owner |
|-------|--------------------------|-------------------|--------------------|---------------------|-------|
| 1 Labels | `SYMBOLIC_LABELS_V2` | flag off → old copy | labels only | golden totals unchanged | Product eng |
| 2 Metadata | `SYMBOLIC_METADATA_V2` | flag off; ignore new fields | additive | old clients parse | Platform |
| 3 Classical | `CLASSICAL_ABJAD_V1` | disable flag; stop shadow publish | latin default intact | latin goldens pass | Methodology |
| 4 Translit | `TRANSLITERATION_UI_V1` | disable UI path | classical arabic-only remains | no forced classical | Methodology |
| 5 Catalog 99 | `ESMA_CATALOG_99` | revert to 35 catalogVersion | F offsets differ — disclose | theme match on 35 | Data curation |
| 6 Multi-match | `ESMA_MATCH_MULTI` | force theme default; F opt-in only | stored method ids remain | no silent F | Methodology |
| 7 CI gate | n/a | block release | n/a | matrix green | QA |
| 8 Report UI | `SYMBOLIC_REPORT_UI_V2` | fallback sections UI | snapshots remain | safety copy audit | Design+Eng |

## 12. Idempotency

Same immutable input + same version set MUST yield the same `calculationFingerprint`.

```ts
calculationFingerprint: string
```

This is **not** `analysisId`. Concurrent identical requests MAY create two analysis ids with one fingerprint (product chooses dedupe).

## 13. Rate limiting

- Global symbolic endpoint rate limit (baseline).
- Stricter limit for expensive paths (vision-unrelated here; classical batch alternatives, modular full scan, multi-method compare).
- Abuse logging without raw name payloads.

Exact quotas: **NOT VERIFIED** / product ops decision.

## 14. Authorization

- Premium MAY deepen interpretation prose / report formatting.
- Core methodology results (totals, letter traces, match sets under a methodologyId) MUST NOT change by entitlement.
- Experimental methods still require explicit user opt-in regardless of tier.

## 15. Localization

- `methodologyId` values are locale-independent.
- Display labels and disclosures come from locale resource catalogs.
- Turkish strings MUST NOT be scattered as only source of truth inside unrelated modules (centralize copy keys).

## 16. Consistency table (cross-RFC)

| Concept | Canonical value / type | Defined in |
|---------|------------------------|------------|
| Selected Arabic spelling | `selectedSpelling` | ADR-001, Architecture |
| Normalized spelling | `normalizedSpelling` | ADR-001, Classical |
| Latin methodology | `atlas-letter-number-v2` / `2.0.0` | Architecture, ADR-002 |
| Legacy Latin | `atlas-letter-number-v1` (read-only) | Migration |
| Classical | `abjad-kabir-classical-v1` | Classical |
| Default Esma match | `esma-theme-intention-match-v1` | Matching, ADR-002 context |
| Modular Esma | `esma-modular-index-match-v1`, modulus 99 | Matching |
| Assessment | `MethodologyAssessment` | ADR-003 |
| Catalog | `esma-99-curated-tr-v1`, names-only-99 | ADR-004 |
| Input vs reproducibility | two snapshot types | Architecture §glossary |

## 17. Acceptance Criteria

- [ ] Appendix covers API, persistence, audit, privacy, cache, rollback, fingerprint, rate limit, authz, i18n
- [ ] No incompatible redefinition of ADR types
- [ ] No production code changed by this document alone

# RFC-007 — Legacy Migration

**Status:** Normative  
**Parent:** [ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md](../ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md)  
**Document id:** `atlas-rfc-007-legacy-migration-v1`  
**Last updated:** 2026-07-31  
**Implementation status:** Spec only — **no migration execution in this task**  
**Aligns with:** MIGRATION_PLAN_SPEC, ARCHITECTURE_OPERATIONAL_APPENDIX, ADR-001…005

---

## 1. Purpose

Mevcut `server/symbolic-analysis` sistemini silmeden, platform sözleşmelerine **kademeli** geçiş stratejisini tanımlar: legacy adapter, endpoint uyumu, response dönüşümü, feature flags, methodologyId koruması, snapshot karşılaştırma, rollback, deprecation takvimi.

---

## 2. Scope

- Coexistence topology
- Field mapping tables (legacy ↔ EngineResult / PlatformRunReport)
- Feature flag matrix
- Endpoint compatibility
- Rollback & sunset calendar
- Test gates for cutover

---

## 3. Out of Scope

- Executing code migrations in this RFC task
- Redesigning classical formulas
- Deleting cross-layer-synthesis

---

## 4. Definitions

| Term | Meaning |
|------|---------|
| **Legacy stack** | `server/symbolic-analysis/**` + `POST /api/symbolic-analysis` |
| **Platform stack** | Future `server/symbolic-platform/**` |
| **Legacy Adapter** | Bidirectional mapping module |
| **Shadow mode** | Platform runs in parallel; client still receives legacy shape |
| **Cutover** | Client-visible default produced by platform+adapter |

---

## 5. Normative Rules

1. **MUST NOT** delete `server/symbolic-analysis` in a single release.
2. `POST /api/symbolic-analysis` **MUST** keep working through cutover (auth, CSRF, rate limit unchanged unless separately versioned).
3. Known methodologyIds **MUST** be preserved (`atlas-letter-number-v1/v2`, `abjad-kabir-classical-v1`, `atlas-names-motif-v1`, `esma-theme-intention-match-v1`).
4. Shadow mode **MUST** compare reproducibility-critical fields before cutover.
5. Feature flags **MUST** have named owners and disable procedures (Operational Appendix).
6. Rollback **MUST** be possible by flag flip without data migration reverse.
7. Scalar `confidence` **MUST NOT** appear as authority on new platform-native responses; adapter **MAY** synthesize for ancient clients only behind explicit legacy read mode.
8. Snapshots remain immutable; corrections create new rows (`supersedesAnalysisId`).

---

## 6. Architecture — coexistence

```
Client
  └─ POST /api/symbolic-analysis
        ├─ [FLAG off] → legacy buildSymbolicAnalysis()  (today)
        └─ [FLAG on]  → platform ExecutionOrchestrator
                          → Legacy Adapter.toSymbolicAnalysisResponse()
                          → same wire type SymbolicAnalysisResponse

Optional later:
  POST /api/symbolic-platform/run → native PlatformRunReport
```

### 6.1 Proposed modules (future)

```
server/symbolic-platform/adapters/legacy-symbolic-analysis/
  to-legacy-response.ts
  from-legacy-request.ts
  layer-id-map.ts
  shadow-compare.ts
```

---

## 7. Identity maps

| Legacy layerId | Target engineId | Notes |
|----------------|-----------------|-------|
| `ebced` | `latin-number-motif` | Classical splits to `classical-abjad` (new) |
| `esma` | `esma-matching` | |
| `cifir` | reserved / planned | keep placeholder semantics |
| `simya` | reserved / planned | |
| `mizac` | reserved / planned | |
| `fizyonomi` | `symbolic-image-analysis` | when photo capability exists |
| patterns | `symbolic-synthesis` | |

Request `layers?: string[]` → map to `engineIds` via table; unknown ids ignored (parity).

---

## 8. Response field mapping

### 8.1 Platform → Legacy (`toSymbolicAnalysisResponse`)

| Platform | Legacy |
|----------|--------|
| `PlatformRunReport.ok` | `ok` |
| run-level error | `error`, `missingRequired` |
| synthesis + projections | `userResult.sections` (compose-equivalent) |
| per-engine methodDisclosure | `userResult.methodDisclosure[]` |
| latin engine methodologyPresentation | `userResult.methodologyPresentation` |
| engine assessments (latin) | `metadata.assessment` (during dual-write) |
| snapshots | `metadata.inputSnapshot`, `reproducibilitySnapshot` |
| engines[] internal | `trace.layers` when `include_trace` |
| platform confidence | omitted or adapter-derived scalar **only** in legacy-compat mode |

### 8.2 Legacy → Platform (for shadow input normalization)

| Legacy input | Platform |
|--------------|----------|
| `SymbolicAnalysisInput` | Normalized personal-profile input |
| `consents` | global gate |
| `layers` | engineIds |

---

## 9. Feature flag matrix

| Flag | Purpose | Default (initial) |
|------|---------|-------------------|
| `ATLAS_SYMBOLIC_METADATA_V2` | Existing additive methodology metadata | as today |
| `ATLAS_SYMBOLIC_PLATFORM_SHADOW` | Run platform + compare; serve legacy | off |
| `ATLAS_SYMBOLIC_PLATFORM_SERVE` | Serve adapter output from platform | off |
| `ATLAS_SYMBOLIC_SYNTHESIS_ENGINE` | Use synthesis engine vs orchestrator patterns | off |
| `ATLAS_SYMBOLIC_PLATFORM_NATIVE_API` | Expose `/api/symbolic-platform/run` | off |

**Owners:** MUST be listed in ops runbook when implemented (Appendix pattern).

---

## 10. Shadow comparison gates

Critical equality (MUST match for cutover):

- Latin: `totalSum` / token multiset / `reducedDigit` (when methodology v2)
- Esma: selected entry ids + matchMode/methodologyId
- `methodologyId` strings
- assessment four fields when v2 on
- No fabricated content on incomplete inputs

Soft compare (warnings only):

- Prose section wording (compose may drift intentionally during UI card migration)

---

## 11. Rollback plan

1. Set `ATLAS_SYMBOLIC_PLATFORM_SERVE=off` → traffic back to `buildSymbolicAnalysis`.
2. Keep shadow on for forensics if needed.
3. Do not delete platform code on rollback.
4. If bad snapshots written under platform, mark with `invalidatedBy` / supersede — do not mutate.

---

## 12. Deprecation calendar (fields)

| Field / behavior | Phase | Action |
|------------------|-------|--------|
| Scalar `normalized.confidence` as authority | Platform native | Forbidden |
| `selectedArabicSpelling` | Already forbidden in new schema | Adapter maps old storage → `selectedSpelling` |
| Technical layer ids in user body | Keep hidden | Continue |
| `atlas-letter-number-v1` new writes | After v2 default stable | Read-only |
| Legacy compose single-narrative as only UI | After per-engine cards ship | Secondary |
| `server/symbolic-analysis` package | ≥1 major release after native default | Archive / thin wrapper |

Sunset coexistence **≥ one major release** after platform default (Operational Appendix).

---

## 13. Alignment with MIGRATION_PLAN_SPEC

Ebced/Esma methodology Faz 1–8 remain valid. This RFC **extends** them with platform extraction phases:

| Platform phase (Master §20) | Relationship |
|-----------------------------|--------------|
| 1 Contracts/registries | New; precedes engine extraction |
| 3 Latin engine extract | Implements Latin v2 production path behind registry |
| 4 Esma extract | Aligns Esma matching RFC rollout |
| 2 Classical engine | Aligns classical faz gates |
| 10 Synthesis | Replaces in-orchestrator patterns |

Pre-Faz Decision Gate (ADRs) remains closed before implementation.

---

## 14. API Impact

| Endpoint | During migration |
|----------|------------------|
| `POST /api/symbolic-analysis` | Stable wire (`src/types/symbolic-analysis.ts`) |
| Future native | Additive new route; not required for Phase 1 |

`include_trace` behavior preserved.

---

## 15. UI Impact

No mandatory UI change for adapter cutover. Per-engine cards MAY land behind separate UI flag after serve flag is stable.

---

## 16. Method Disclosure

Adapter MUST preserve v2 human labels / comingSoon classical entry when metadata flag on.

---

## 17. Examples

```ts
// Pseudocode cutover switch
function handleSymbolicAnalysis(body) {
  if (flags.PLATFORM_SERVE) {
    const report = platformOrch.run(fromLegacyRequest(body));
    return toLegacyResponse(report, { includeTrace: body.include_trace });
  }
  if (flags.PLATFORM_SHADOW) {
    const legacy = buildSymbolicAnalysis(body);
    const report = platformOrch.run(fromLegacyRequest(body));
    shadowCompare(legacy, report); // metrics only
    return legacy;
  }
  return buildSymbolicAnalysis(body);
}
```

---

## 18. Test Strategy (migration-specific)

| Layer | Focus |
|-------|-------|
| unit | mapping functions |
| contract | legacy response still validates against frontend types |
| snapshot | golden legacy fixtures vs platform adapter output |
| regression | `scripts/test-symbolic-analysis.mjs` scenarios keep green under serve flag |
| incomplete-input | MISSING_REQUIRED_INPUT / CONSENT_REQUIRED parity |
| version migration | v1 stored snapshot readable |
| safety | prose rules identical or stricter |

Every extracted engine MUST also pass shared platform contract package (RFC-001).

---

## 19. Acceptance Criteria

- [ ] No big-bang delete  
- [ ] Endpoint compatibility stated  
- [ ] Mapping tables complete for live layers  
- [ ] Flag matrix + rollback  
- [ ] methodologyId preservation  
- [ ] Shadow compare fields listed  
- [ ] Deprecation calendar present  
- [ ] Relation to existing MIGRATION_PLAN_SPEC explicit  

---

## 20. Rejected Alternatives

| Rejected | Why |
|----------|-----|
| Hard cut to native JSON only | Breaks current frontend types |
| In-place rewrite of orchestrator without adapter | High rollback cost |
| Silent methodology renames during move | Breaks snapshots & disclosure |

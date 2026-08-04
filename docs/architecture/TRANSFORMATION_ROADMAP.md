# ATLAS Transformation Roadmap

**Status:** Normative planning (documentation only until phase approval)  
**Document id:** `atlas-architecture-transformation-roadmap-v1`  
**Date:** 2026-08-04  
**Parent:** [ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md](./ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md) (§17)  
**Compliance baseline:** [COMPLIANCE_MATRIX.md](./COMPLIANCE_MATRIX.md) (~33% overall)  
**Supersedes as planning authority:** `docs/atlas-domain-platform/ROADMAP.md` (historical FAZ detail retained)

---

## 1. Principles (from Master Spec §17)

- Architecture first; small incremental changes
- Continuous validation; backward compatibility
- Feature-flag deployment; rollback capability
- No large-scale rewrite without measurable benefit
- Preserve deterministic calculation correctness and methodology history
- **Do not** rewrite working engines in place; adapter-first migration

---

## 2. Stop line (current)

| Phase | Status |
|-------|--------|
| **P0** Documentation canon + consolidation | **Complete** (this delivery) |
| **P1** Architecture stabilization (docs/maps only) | Ready after P0; docs-only |
| **P2** Core Runtime Consolidation (`server/domain-core/`) | **Blocked — requires separate approval** |
| P3+ | Blocked until P2 approved and landed |

**This document does not authorize implementation code, runtime, API, engine, or business-logic changes.**

---

## 3. Phase plan

| Phase | Name | Depends | Complexity | Risk | Key deliverables |
|-------|------|---------|------------|------|------------------|
| **P0** | Doc canon + consolidation | Approval | S | Low | Import Master Spec; consolidation docs; archive banners |
| **P1** | Architecture Stabilization | P0 | M | Low | Map ADRs/RFCs → Master sections; freeze ids; keep Compliance Matrix current |
| **P2** | Core Runtime Consolidation | P1 + **explicit code approval** | L | Med | `server/domain-core/` skeleton; Engine/Methodology/Source registries; dual-run adapters (numerology first); feature flags |
| **P3** | Unified contracts | P2 | L | Med | `StructuredAnalysisOutput`; shared Evidence/Confidence modules |
| **P4** | Memory Integration | P2 | L | Med | Typed memory classes; multi-subject model; durable engine sessions |
| **P5** | Knowledge & Methodology | P3 | L | Med | Central methodology loader; source registry seed; symbol graph v0 |
| **P6** | Cross-Domain Intelligence | P3 + P5 | L | High | Unify synthesis surfaces; conflict/agreement rules |
| **P7** | AI Provider + Workflow | P2 | M | Med | `ProviderRegistry` + fallback; retire Legacy Pipeline UI paths from Domain Core story |
| **P8** | Observability & Security hardening | P2 | M | Low | OpenTelemetry traces; analysis audit records; expand RBAC |
| **P9** | Enterprise Platform | P6 + P8 | XL | High | Plugin SDK; multi-tenant; `/api/v1`; Professional Studio |
| **P10** | Global Optimization | P9 | XL | Med | Queues, HA, caching, DR — only after Domain Core stable |

---

## 4. Recommended near-term order (next 90 days)

1. **P0** — done (Master Spec + consolidation + banners).
2. **P1** — optional docs polish: ADR↔Master section map table (still no code).
3. **Stop** — wait for explicit approval before **P2**.
4. When P2 approved: scaffold `domain-core` behind flags; dual-run numerology adapter; keep `test:numerology` / tarot / dream green; **do not** rewrite `atlas-message-service` yet.
5. **P3** — land shared Evidence/Confidence before adding more engines.
6. Defer **P9–P10** until registries and contracts exist.

---

## 5. Dependencies (high level)

```text
P0 → P1 → P2 → P3 → P5 → P6 → P9 → P10
              ↘ P4
              ↘ P7
              ↘ P8 ─────────────↗
```

- P4 (Memory) can proceed in parallel with P3 after P2 skeleton exists.
- P7 / P8 can proceed in parallel after P2; both feed P9.
- P6 requires unified contracts (P3) and methodology/knowledge hooks (P5).

---

## 6. Risks

| Risk | Phase | Mitigation |
|------|-------|------------|
| Big-bang rewrite of message service | P2 | Adapter dual-run; flag off = prior `*-flow.js` path |
| Methodology id drift | P1–P5 | ADR/RFC freeze; registry validates known ids |
| Synthesis overriding engine results | P6 | Master §6 / RFC-005 hard rule: synthesis must not mutate source evidence |
| Premature enterprise/HA work | P9–P10 | Gate on Domain Core + contracts measurable |
| Stale audit driving wrong gaps | P0–P1 | Prefer Compliance Matrix; refresh audit later |

---

## 7. Appendix A — FAZ ↔ P-phase map

Prior Domain Platform `ROADMAP.md` FAZ labels map as follows (historical):

| Prior FAZ | Maps to |
|-----------|---------|
| FAZ 0 Audit | Pre-P0 / Compliance Matrix |
| FAZ 1 Architecture docs + ADRs | P0 + P1 |
| FAZ 2 Domain Core scaffold | **P2** |
| FAZ 3 Standardize motors | P2–P3 adapters |
| FAZ 4 Dream deepen | P5 (corpus) after P2 |
| FAZ 5 Alchemy/Myth/Symbol graph | P5 |
| FAZ 6 Qur’an/Hadith | Later domain under P5/P9 |
| FAZ 7 Image modules | Later |
| FAZ 8 Voice | Evolve Live/audio; after P2 |
| FAZ 9 Professional Studio | **P9** |

Abjad/esma classical migration (`MIGRATION_PLAN_SPEC.md`) remains a **domain appendix** under P2–P3 / symbolic RFCs — not cancelled by this roadmap.

---

## 8. Rollback (when code phases start)

- Feature flag off → previous flow modules
- No destructive data migrations without founder approval
- Do not auto-recompute archived analyses
- Documented in Master Spec §17.7 / §17.12

---

## 9. Success metrics (platform)

From Master Spec / Domain Platform success lists:

- Correct domain routing; no invented inputs
- Deterministic calculation accuracy
- Explicit methodology awareness + source integrity
- Epistemic clarity; contradiction handling
- Subject identity accuracy
- Channel parity of structured results
- Clean addition of new engines without breaking peers

# ATLAS Architecture Compliance Matrix

**Status:** Analysis / planning (documentation only)  
**Document id:** `atlas-architecture-compliance-matrix-v1`  
**Date:** 2026-08-04  
**Against:** [ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md](./ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md)  
**Repo baseline:** `ATLAS-v0.8-asset-persistence`  
**Overall compliance (unweighted mean of 18 sections):** **33%**

This matrix classifies current implementation against Master Spec major sections. Percentages are evidence-weighted estimates against section acceptance criteria. **No runtime changes** are authorized by this document.

---

## 1. Status legend

| Status | Meaning |
|--------|---------|
| Fully Implemented | Meets section intent in production paths with tests or clear runtime proof |
| Partially Implemented | Meaningful capability exists; contracts, coverage, or unification incomplete |
| Missing | No meaningful runtime implementation (specs alone do not count) |
| Legacy | Present but outside target Domain Core model; migrate or retire later |
| Needs Refactoring | Exists but conflicts with Master Spec contracts / duplication |

---

## 2. Section compliance matrix

| Section | Title | Status | % | Primary evidence |
|---------|-------|--------|---|------------------|
| §1 | Vision & Principles | Partially Implemented | 40 | Deterministic-first practiced in engines; not platform-enforced |
| §2 | Core Runtime Architecture | Partially Implemented | 42 | Web/Telegram/API live; no `server/domain-core/` / Domain Router |
| §3 | Calculation Framework | Partially Implemented | 58 | Num/tarot/dream/natal/symbolic/daily strong; no universal pipeline |
| §4 | Memory Intelligence Layer | Partially Implemented | 35 | `user_memory` + conversation + archive; KG/timeline missing |
| §5 | Evidence, Confidence & Reasoning | Needs Refactoring | 28 | RFC/ADR strong; runtime scalars & fragmented helpers |
| §6 | Cross-Domain Interpretation | Partially Implemented | 38 | `cross-layer-synthesis` + LLM meta; not unified Domain Core |
| §7 | Enterprise / Plugin SDK | Missing | 5 | Membership doc only; no plugin registry or multi-tenant |
| §8 | Governance & QA | Partially Implemented | 55 | ADRs/RFCs/tests exist; production readiness incomplete |
| §9 | Domain Adapter Framework | Partially Implemented | 22 | Channel adapters only; no universal `AtlasDomainEngine` adapters |
| §10 | Methodology Framework | Partially Implemented | 38 | Per-engine methodology constants; no central registry |
| §11 | Knowledge / Ontology | Partially Implemented | 32 | Scattered corpora; no shared symbol/ontology graph |
| §12 | AI Provider Abstraction | Missing | 18 | OpenAI-only clients; `ProviderRegistry` absent |
| §13 | Workflow Orchestration | Needs Refactoring | 30 | Domain-local orchestrators + Legacy content Pipeline UI |
| §14 | Observability & Telemetry | Partially Implemented | 22 | `request-timing` + privacy logs; OpenTelemetry missing |
| §15 | Security, Trust & Compliance | Partially Implemented | 68 | Auth/privacy/CSRF/rate-limit strong; enterprise RBAC thin |
| §16 | Scalability & Infrastructure | Missing | 12 | Single-process + JSON file stores; no HA/queue fabric |
| §17 | Transformation Strategy | Partially Implemented | 45 | Multiple roadmaps existed; now aligned via `TRANSFORMATION_ROADMAP.md` |
| §18 | Future Intelligence Roadmap | Missing | 8 | Aspirational only; research platform not started |

**Overall:** 33% = mean of section percentages above.

---

## 3. Implementation-area classification

| Area | Class | Notes |
|------|-------|-------|
| Presentation (Web/Telegram) | Partially Implemented | Chat parity; structured API uneven; Voice/Live prototype |
| Gateway / Message OS | Partially Implemented | `atlas-message-service` sequential gates — not Domain Router |
| Deterministic engines (core set) | Fully / Partially Implemented | Core set strong; classical abjad flagged; placeholders Prototype |
| Registries (Engine/Domain/Methodology) | Missing | Only local `LAYER_REGISTRY` / `methodology.js` constants |
| Memory (profile/session/archive) | Partially Implemented | JSON file-backed; sessions ephemeral; no knowledge graph |
| Evidence / Confidence runtime | Needs Refactoring | ADR-003 / RFC-004 not enforced as shared modules |
| Cross-domain synthesis | Partially Implemented | Three parallel surfaces; unify under §6 |
| Plugin / Enterprise | Missing | No SDK, tenant isolation, or capability marketplace |
| AI providers | Missing | `openai-client` + runner adapter only |
| Content Pipeline UI | Legacy | `AgentCenter` / `WorkflowBuilder` / `QueueManager` mock OS |
| Observability | Partially Implemented | Ad-hoc timing/audit; no OTel metrics backend |
| Security core | Fully Implemented (core) | Sessions, CSRF, roles, privacy ownership, rate limits |

---

## 4. Highest-leverage gaps

1. No `server/domain-core/` (Request Normalizer, Domain Router, Analysis Orchestrator)
2. No central Engine / Methodology / Source registries
3. No shared Evidence + Confidence runtime modules
4. No universal DomainAdapter / `AtlasDomainEngine` wrappers
5. No `ProviderRegistry` (multi-provider AI)
6. No knowledge graph / shared symbol ontology

---

## 5. Assets to preserve

- Numerology, Tarot, Dream engines and chat flows
- Natal calculation (`ASCENDANT_CALC_AVAILABLE = true` when inputs resolve)
- Symbolic Latin + daily-analysis layers
- Channel adapters (Web + Telegram)
- Auth, privacy, health-safety, rate limiting
- Frozen methodology ids (ADR/RFC locks)

---

## 6. Deferred (low priority until Domain Core exists)

- Plugin SDK / multi-tenant (§7)
- OpenTelemetry + HA fabric (§14, §16)
- Public `/api/v1/analyze` surface
- Professional Studio / white-label
- Qur’an / Hadith research engines
- Palm / face / community ecosystem (§18)

---

## 7. Related docs

- [DOC_CONSOLIDATION.md](./DOC_CONSOLIDATION.md)
- [TRANSFORMATION_ROADMAP.md](./TRANSFORMATION_ROADMAP.md)
- Interactive review canvas (IDE): workspace `canvases/atlas-architecture-compliance.canvas.tsx`

---

## 8. Revision policy

Update this matrix when a phase completes or a major engine lands. Do not treat percentages as CI gates until Domain Core ships measurable contracts.

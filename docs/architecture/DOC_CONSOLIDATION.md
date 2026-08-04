# ATLAS Architecture Documentation Consolidation Report

**Status:** Normative consolidation plan (executed 2026-08-04 for banners + indexes)  
**Document id:** `atlas-architecture-doc-consolidation-v1`  
**Date:** 2026-08-04  
**Canonical target:** [ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md](./ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md)  
**Scope:** Documentation only — no implementation, API, engine, or runtime changes

---

## 1. Purpose

Identify overlapping architecture documents, classify dispositions (merge / archive / replace / retain), and define the final documentation structure under `docs/architecture/`.

---

## 2. Canonical document

| Field | Value |
|-------|--------|
| Title | ATLAS Master Architecture Specification |
| Version | 1.0 |
| Path | `docs/architecture/ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md` |
| Role | Single source of truth for platform architecture |
| Supersedes (platform scope) | Prior “master architecture” docs listed in §4 |

Frozen methodology ids, ADR-001…009, RFC-001…010 (symbolic lineage), and domain formula specs remain binding. The Master Spec does **not** replace formula-level rules.

---

## 3. Final documentation structure

```text
docs/architecture/
├── README.md                                          # Index
├── ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md      # Canonical
├── DOC_CONSOLIDATION.md                               # This file
├── COMPLIANCE_MATRIX.md                               # Gap / % matrix
├── TRANSFORMATION_ROADMAP.md                          # P0–P10 plan
├── children/
│   └── README.md                                      # Pointers to retained contracts
└── archive/
    └── README.md                                      # Superseded masters index

docs/adr/ADR-001…009                                   # RETAIN (binding)
docs/rfc/RFC-001…010                                   # RETAIN (binding symbolic lineage)
docs/CURRENT_VS_TARGET_ARCHITECTURE_SPEC.md            # RETAIN (domain lock)
docs/ARCHITECTURE_OPERATIONAL_APPENDIX.md              # RETAIN
docs/atlas-domain-platform/{ENGINE,METHODOLOGY,...}    # RETAIN as children (in place)
docs/{CLASSICAL_*,ESMA_*,TURKISH_*,quran-*}            # RETAIN (methodology detail)
```

Child contracts remain in `docs/atlas-domain-platform/` to avoid breaking existing relative links. They are indexed from `docs/architecture/children/README.md` and their parent pointers now reference the Master Spec.

---

## 4. Document disposition table

| Document | Disposition | Action taken (2026-08-04) |
|----------|-------------|---------------------------|
| `docs/architecture/ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md` | **Canonical** | Imported |
| `docs/atlas-domain-platform/MASTER_ARCHITECTURE.md` | **Merge → Archive** | Archive banner; unique content (depth L0–L4, engine catalog, professional JSON) preserved in-file for reference |
| `docs/ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md` | **Archive** | Archive banner; RFCs remain binding |
| `docs/atlas-domain-platform/ROADMAP.md` | **Merge** | Banner → `TRANSFORMATION_ROADMAP.md`; FAZ detail retained historically |
| `docs/MIGRATION_PLAN_SPEC.md` | **Merge** | Banner → roadmap domain appendix; abjad/esma phases retained |
| `docs/atlas-domain-platform/current-state-audit.md` | **Obsolete (refresh later)** | Banner: natal ASC claim may be stale; use Compliance Matrix for current gap view |
| `docs/CURRENT_VS_TARGET_ARCHITECTURE_SPEC.md` | **Retain** | No banner change (domain lock) |
| `docs/atlas-domain-platform/ENGINE_CONTRACT.md` | **Retain (child)** | Parent pointer updated to Master Spec |
| `docs/atlas-domain-platform/METHODOLOGY_REGISTRY.md` | **Retain (child)** | Parent pointer updated |
| `docs/atlas-domain-platform/SOURCE_REGISTRY.md` | **Retain (child)** | Parent pointer updated |
| `docs/atlas-domain-platform/SECURITY_AND_EPISTEMIC_POLICY.md` | **Retain (child)** | Parent pointer updated |
| `docs/adr/ADR-001…009` | **Retain** | Binding decisions |
| `docs/rfc/RFC-001…010` | **Retain** | Symbolic contracts under Master |
| `docs/ARCHITECTURE_OPERATIONAL_APPENDIX.md` | **Retain** | Ops privacy/audit |
| `docs/atlas-product-membership-architecture.md` | **Retain** | Commercial hooks (§7) |
| `docs/quran-data-architecture.md` | **Retain** | Domain data lock |
| Classical abjad / esma / transliteration / test specs | **Retain** | Methodology detail (§10) |
| Figma / design-system docs | **Retain (separate)** | Presentation design; out of Master scope |

---

## 5. Overlap summary

| Topic | Master Spec § | Prior overlapping docs |
|-------|---------------|------------------------|
| Layered runtime / Domain Core | §2, §9 | Domain Platform `MASTER_ARCHITECTURE.md` |
| Engine / result contracts | §3, §9 | `ENGINE_CONTRACT.md`, RFC-001, RFC-003 |
| Methodology versioning | §10 | `METHODOLOGY_REGISTRY.md`, RFC-002, ADR-008 |
| Evidence / confidence | §5 | RFC-004, ADR-003, ADR-006 |
| Cross-domain synthesis | §6 | RFC-005, ADR-009, Domain Platform master |
| Memory / subjects | §4 | Domain Platform §7 multi-subject |
| Security / epistemic | §15 | `SECURITY_AND_EPISTEMIC_POLICY.md`, RFC-008, Appendix |
| Migration phases | §17 | Domain `ROADMAP.md`, `MIGRATION_PLAN_SPEC.md` |
| Latin vs classical abjad | (domain) | `CURRENT_VS_TARGET_ARCHITECTURE_SPEC.md` (retained) |

---

## 6. Obsolete / stale notes

| Claim / doc | Issue | Resolution |
|-------------|-------|------------|
| `current-state-audit.md` natal ASC unavailable | Code now has `ASCENDANT_CALC_AVAILABLE = true` | Banner + Compliance Matrix supersedes for gap status; full audit refresh deferred |
| Multiple “master” docs | Competing authority | Master Spec v1 is sole platform canonical |
| Duplicate roadmaps (FAZ vs §17) | Conflicting phase names | `TRANSFORMATION_ROADMAP.md` is planning canonical; FAZ map included as appendix |

---

## 7. Non-goals of this consolidation

- Moving ADR/RFC files
- Rewriting formula specs
- Changing production code, APIs, engines, or runtime behavior
- Beginning Phase P2 Domain Core implementation

---

## 8. Acceptance for P0 (documentation)

- [x] Master Spec imported under `docs/architecture/`
- [x] Consolidation / compliance / roadmap docs created
- [x] Superseded masters carry archive banners
- [x] Domain Platform README points to canonical Master Spec
- [ ] Phase P2 — **blocked pending separate approval**

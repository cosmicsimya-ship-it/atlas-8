# Atlas Architecture Documentation

**Canonical specification:** [ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md](./ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md)

This folder is the normative home for platform-wide architecture after the 2026-08-04 consolidation (documentation only; no runtime changes).

| Document | Role |
|----------|------|
| [ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md](./ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md) | **Canonical** Master Architecture Spec v1.0 |
| [DOC_CONSOLIDATION.md](./DOC_CONSOLIDATION.md) | Overlap analysis, dispositions, final doc structure |
| [COMPLIANCE_MATRIX.md](./COMPLIANCE_MATRIX.md) | Section-by-section compliance vs Master Spec |
| [TRANSFORMATION_ROADMAP.md](./TRANSFORMATION_ROADMAP.md) | Prioritized transformation phases P0–P10 |
| [children/README.md](./children/README.md) | Index of retained child contracts |
| [archive/README.md](./archive/README.md) | Index of superseded / archived architecture docs |

## Authority order

1. **Master Spec v1** (this folder) — platform architecture
2. **ADRs** (`docs/adr/`) — accepted decisions (do not silently override)
3. **RFCs** (`docs/rfc/`) — symbolic platform contracts (still binding for ebced/esma lineage)
4. **Domain formula specs** — classical abjad, esma, transliteration, Qur’an data
5. **Archived masters** — historical only; banners redirect here

## Stop line

Documentation consolidation (P0) is complete when this folder is populated and superseded masters carry archive banners. **Phase P2 (Domain Core code) requires a separate explicit approval.**

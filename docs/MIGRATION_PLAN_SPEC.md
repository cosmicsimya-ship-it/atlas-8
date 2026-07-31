# MIGRATION_PLAN_SPEC

**Status:** Normative migration plan (design only)  
**Document id:** `atlas-abjad-esma-migration-plan-v1`  
**Last updated:** 2026-08-01  
**Depends on:** Architecture, ADRs 001–005, Operational Appendix, RFC-009/010  
**Implementation status:** Spec only — **no migration execution / no classical runner in this task**

---

## 1. Purpose

Phased rollout without mixing methodologies; incorporate Architecture Review locks and Pre-Faz Decision Gate.

---

## 2. Scope

Phases 1–8, gates, version strategy, flags, dependencies A/E vs B/C/D.

---

## 3. Out of Scope

Executing migrations, code, commits.

---

## 4. Definitions

**Pre-Faz Decision Gate:** decisions that MUST be Accepted (ADRs) before Faz 1 implementation starts.

---

## 5. Normative Rules

1. **Pre-Faz Decision Gate MUST be closed before Faz 1 code work:**
   - Canonical field names (`selectedSpelling`, `normalizedSpelling`) — ADR-001
   - Assessment contract — ADR-003
   - Snapshot glossary — Architecture
   - Default motor Latin v2 — ADR-002
   - Latin methodology id `atlas-letter-number-v2` — Architecture
2. `LATIN_ABJAD` not deleted; new results use v2 id; v1 read-only.
3. Experimental F never silent default.
4. Snapshots immutable (Appendix).
5. Phase exit tests retained; Faz 7 = consolidated CI.

---

## 6. Architecture — version strategy

| Item | Strategy |
|------|----------|
| New Latin results | `atlas-letter-number-v2` / `2.0.0` |
| Legacy Latin | `atlas-letter-number-v1` read-only; no auto-recompute |
| Classical | `abjad-kabir-classical-v1` @ `1.0.0` / ruleset **`classical-kabir-rules-1.0.0`** behind flag |
| Classical alias | `classical-arabic-abjad-kabir-v1` deprecated |
| آ behavior | Classical path: آ→ا+ا; legacy `ARABIC_ABJAD` آ=1 remains Latin/legacy table only — shadow-compare on open |
| Envelope | bump when metadata lands (Faz 2) |
| Sunset | ≥1 major release coexistence (Appendix) |

---

## 7. Data Model mapping

Legacy `selectedArabicSpelling` → adapter maps to `selectedSpelling`.  
Legacy scalar `confidence` → adapter-only; not emitted on new responses.  
`letters` → `tokenizedLetters`.  
`matchMode` → methodologyId + userLabel.

---

## 8–10. API / UI / Disclosure

Additive first; UI default tab Latin; classical confirmation Faz 4; disclosure labels Faz 1.

---

## 11. Examples

Pre-gate ADRs accepted → Faz 1 relabel only → later classical arabic-only → transliteration → catalog approve → multi-match.

---

## 12. Edge Cases

Catalog 35→99 breaks F offsets — versioned; dual-run disclose.

---

## 13. Error Handling

Flag invalid; snapshot replay fail (Appendix).

---

## 14. Safety

Safety copy review each phase.

---

## 15. Phased Plan

### Pre-Faz Decision Gate

Status: **Closed by ADR-001…005 + Architecture update (this revision).**

### Faz 1 — Rename & relabel

Latin display name + “klasik ebced değildir”; Esma experimental label for legacy fallback path description; **behavior unchanged**.

### Faz 2 — Methodology metadata

Additive `methodologyId`, versions, snapshots skeleton, `assessment` (nullable numerics OK initially). No scalar `confidence` on new bodies.

### Faz 3 — Classical engine (limited scope)

**MUST** start only with:

- direct Arabic input / expert override
- feature flag
- shadow mode
- ruleset **`classical-kabir-rules-1.0.0`** (آ→ا+ا; ء traced value 0; no hemze=1 UI)
- mother name via **parts[]** (default exclude)

Latin→classical **MUST NOT** be production default before Faz 4.
Shadow: production table آ=1 vs classical expand (fixtures `FAB-003`, `FAB-012a`, `FAB-CONFLICT-AA`).

### Faz 4 — Transliteration + confirmation

`autoAcceptHighCertainty: false`; `selectedSpelling` gate.

### Faz 5 — Catalog 99

`esma-99-curated-tr-v1`; exit requires `curationStatus === "approved"`.

### Faz 6 — Multi-match

Default `esma-theme-intention-match-v1`.  
**B/C/D** only after approved catalog.  
**A/E** may run earlier with explicit catalogVersion.  
**F** explicit opt-in only; no silent fallback.

### Faz 7 — Consolidated CI and release qualification

Rename: consolidated CI + release qualification. Phase 3–6 exit tests remain; Faz 7 merges matrix for release.

### Faz 8 — Premium report UI

Presentation only; methodology outputs not paywalled (Appendix authz).

---

## 16. Open Questions

Numeric rate limits; gazetteer timeline — non-blocking for Faz 1–2.

---

## 17. Acceptance Criteria

- [ ] Pre-Faz gate listed and satisfied in spec
- [ ] Faz 3/5–6/7 wording updated
- [ ] v1/v2 Latin rules clear
- [ ] Spec only

## Appendix — flags

Unchanged suggested flags from prior plan + `ESMA_DISABLE_SILENT_EXPERIMENTAL_DEFAULT` always on for v2 defaults.

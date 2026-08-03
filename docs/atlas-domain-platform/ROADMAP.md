# ATLAS Domain Intelligence Platform — Roadmap, Migration & Test Strategy

**Status:** Normative phased plan  
**Document id:** `atlas-domain-platform-roadmap-v1`  
**Date:** 2026-08-03  
**Parent:** `MASTER_ARCHITECTURE.md`  
**Baseline audit:** `current-state-audit.md`  

---

## 1. Principle

Incremental migration. Preserve green deterministic suites. No big-bang rewrite of `atlas-message-service.js`. Symbolic Platform RFCs remain in force for ebced/esma.

---

## 2. Migration strategy

```text
FAZ 0 Audit          ✅ (this delivery)
FAZ 1 Architecture   ✅ docs + ADRs
FAZ 2 Domain Core    scaffold registries + schemas + adapters (flagged)
FAZ 3 Standardize    numerology → tarot → astrology bridge → destiny → ebced/esma → hijri
FAZ 4 Dream deepen   on Domain Core
FAZ 5 Alchemy/Myth/Symbol graph
FAZ 6 Qur’an/Hadith research data
FAZ 7 Image modules
FAZ 8 Voice
FAZ 9 Professional Studio / white-label / API keys
```

### Adapter-first migration

1. Implement `AtlasDomainEngine` adapter that calls existing `run*Analysis`.  
2. Dual-run: chat path unchanged; adapter output logged/validated in tests.  
3. Flip chat to consume adapter `rendered.text` behind flag.  
4. Only then refactor internals.  

### Rollback

- Feature flag off → previous `*-flow.js` path.  
- No destructive data migrations without founder approval.  
- Do not auto-recompute archived analyses.

---

## 3. Phased backlog

### FAZ 0 — Current state audit

| Field | Value |
|-------|-------|
| Deliverable | `current-state-audit.md` |
| Difficulty | M |
| Acceptance | Real paths, gap table, test baseline |
| Tests | Record baselines |
| Rollback | N/A (docs) |

### FAZ 1 — Master architecture & ADRs

| Field | Value |
|-------|-------|
| Deliverable | Architecture suite + ADR-006…009 |
| Difficulty | M |
| Acceptance | Contracts, registries, security, roadmap present |
| Tests | Doc consistency review |
| Rollback | Docs only |

### FAZ 2 — Domain Core (first implementation slice)

| Task | Deps | Diff | Acceptance | Tests | Rollback |
|------|------|------|------------|-------|----------|
| Create `server/domain-core/` skeleton | FAZ1 | S | Imports clean | unit load | delete folder |
| JSDoc/TS schemas for StructuredAnalysisOutput | skeleton | M | Schema fixture validates sample | schema tests | flag |
| Engine registry with descriptors for num/tarot/dream/symbolic/daily | schemas | M | listEngines() returns live ids | registry test | flag |
| Methodology registry loader (code constant fallback) | skeleton | M | resolve default Pythagorean | methodology test | flag |
| Source registry seed for internal corpora | skeleton | S | sourceIds resolve | source test | flag |
| Numerology adapter dual-run | registry | M | calc equality vs direct engine | numerology + adapter | flag off |
| Depth resolver L0–L4 mapping | schemas | S | maps detaylı→L3 | depth tests | flag |
| **Do not** rewrite message-service yet | — | — | chat behavior identical | `test:numerology/tarot/dream` | — |

### FAZ 3 — Standardize existing motors

Priority order: Numerology → Tarot → Astrology (ephemeris adapter + natal gap design) → Destiny Matrix (methodology ADR first) → Ebced/Esma chat parity → Hijri/time.

| Acceptance | Existing engine tests green; adapters emit StructuredAnalysisOutput; methodologyId on outputs |
| Rollback | Flag; keep flow modules |

**Astrology special:** Implement deterministic natal house/ASC engine before expanding LLM claims. Until then keep `ASCENDANT_CALC_AVAILABLE=false` behavior.

### FAZ 4 — Dream on Domain Core

Richer corpus + shared symbol ids; safety pack expansion.

### FAZ 5 — Alchemy, Mythology, Symbol Intelligence

Shared symbol graph; no fake classical claims.

### FAZ 6 — Qur’an / Tafsir / Hadith

Only after license + ingest from `quran-data-architecture.md`.

### FAZ 7 — Image (face/palm symbolism)

Capability honest; physiognomy character claims forbidden.

### FAZ 8 — Voice

Transcription → query → TTS → consented clone last.

### FAZ 9 — Professional Studio

Profiles, subjects, templates, WL branding, API keys/quotas.

---

## 4. Testing strategy

| Level | Scope | When |
|-------|-------|------|
| Unit | reduce, dates, orbs, letter values | every PR touching calc |
| Fixture / golden | methodology fixtures | FAZ2+ |
| Methodology | same input different schools | when multi-school |
| Intent accept/reject | domain router | FAZ2+ |
| Regression | `test:numerology`, `tarot`, `dream`, `hijri`, `daily`, `symbolic`, `classical-abjad` | every domain PR |
| Channel parity | same NormalizedDomainRequest → same calculations | FAZ2 adapters |
| Safety | death/medical/fear/face | continuous |
| Hallucination | fake ayah/source/methodology | FAZ3+ |
| Depth | L0–L4 intensity | FAZ2 depth resolver |
| Performance | timing phases already exist | expand budgets |

### Baseline (2026-08-03)

- Numerology 71/71, Tarot 100/100, Dream 67/67, Hijri 43/43, Daily 48/48, Symbolic ok, Classical abjad PASS  
- `test:all` partial fail without `OPENAI_API_KEY` on identity LLM cases  

CI recommendation: split `test:domain` (deterministic) vs `test:llm` (secret-gated).

---

## 5. Risk register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Calculation accuracy (natal/houses) | High | No ASC invent; ship calc engine before narrative expansion |
| Source accuracy (Qur’an/Hadith) | Critical | Registry + validators; no invent |
| Methodology mixing | High | Registry + disclosure; ADR locks |
| LLM hallucination | High | Engine-first; evidence types; tests |
| Performance | Medium | Timeouts per engine; cache daily layers |
| Privacy / PII in traces | High | Scrub; minimize |
| Dependency/license | High | Qur’an meal licensing gate |
| Channel mismatch | Medium | Structured parity tests |
| Memory subject mix-up | High | subjectId model; group speaker attribution |
| Scope creep | High | Phase gates; founder decisions |

---

## 6. Open decisions requiring founder approval

1. **First professional motor pack** — recommend: Numerology + Tarot + Dream + Classical Abjad/Esma; astrology natal as parallel P0 calc.  
2. **Default house system** (Placidus vs Whole Sign vs Equal) — **blocked until decided**; no silent default in product copy.  
3. **Default numerology school** — currently Pythagorean birth; confirm as product default vs Chaldean.  
4. **Qur’an meal set for v1** — Diyanet API-first already in quran architecture; confirm offline snapshot policy.  
5. **Experimental methodologies visible to consumers?** — recommend: professional/opt-in only.  
6. **External API in first public release?** — recommend: internal structured first; external keys in FAZ 9.  
7. **Destiny Matrix which named system?** — must pick one methodology family before coding.  
8. **`release/` tree sync policy** — when to refresh production bundle vs root-only development.

---

## 7. First implementation slice (immediate next coding FAZ)

After founder ack of open decisions that block astrology defaults (house system can wait if natal engine not started):

1. Add `server/domain-core/` with registry + schema validation.  
2. Numerology adapter dual-run tests (calc equality).  
3. Add `npm run test:domain-core`.  
4. Keep `atlas-message-service.js` untouched.  

**Explicitly not in first slice:** new engines, dependency adds, Qur’an ingest, professional UI, rewriting symbolic-analysis orchestrator.

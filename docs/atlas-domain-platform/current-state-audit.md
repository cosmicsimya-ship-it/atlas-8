# ATLAS Domain Intelligence Platform — Current State Audit

**Status:** Verified audit (code + tests; design docs cross-checked)  
**Document id:** `atlas-domain-platform-current-state-audit-v1`  
**Audit date:** 2026-08-03  
**Repo:** `ATLAS-v0.8-asset-persistence`  
**Implementation status of this document:** Audit only — no production refactor authorized by this file alone  

**Related prior work (do not discard):**

| Doc | Scope |
|-----|--------|
| `docs/ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md` | Symbolic/ebced/esma platform RFCs |
| `docs/CURRENT_VS_TARGET_ARCHITECTURE_SPEC.md` | Latin motif vs classical abjad |
| `docs/rfc/RFC-001…008` | Engine/result/methodology contracts (symbolic) |
| `docs/adr/ADR-001…005` | Spelling, default methodology, assessment, Esma catalog |
| `docs/quran-data-architecture.md` | Qur’an data layers (design lock) |
| `docs/atlas-product-membership-architecture.md` | Commercial/membership product |

This Domain Intelligence audit **extends** those specs to all analysis domains (numerology, tarot, astrology, dream, calendar, synthesis, professional/API). It does not silently rename frozen methodology ids.

---

## 1. Executive finding

Atlas is **already more than a chatbot**: several deterministic engines exist and are wired into a shared message pipeline for Web + Telegram. What is missing is a **unified Domain Core** (registry, normalizer, methodology/source registries, structured output parity, professional subjects, public analysis API). Engines today are strong but **parallel and inconsistently contracted**.

**Verdict:** Proceed with FAZ 1 architecture docs + FAZ 2 Domain Core scaffolding; **do not** rewrite working engines in place.

---

## 2. Runtime topology (verified)

```text
Client (Web HashRouter | Telegram bot)
  → channel-adapters.js (NormalizedAtlasMessage)
  → POST /api/chat | telegram handlers
  → atlas-message-service.js (processAtlasMessage)
       sequential gates:
         privacy → health-safety → activation → audio-studio
         → numerology-flow → tarot-flow → dream-flow
         → memory / identity / self-profile / abjad-verification
         → astrology-flow (early + late) / personal-analysis routeTask
         → cross-layer synthesis bridge
         → LLM chat (OpenAI) + persona/style prompts
       note: daily-analysis is NOT a chat short-circuit (synthesis/tests only)
  → reply + metadata (engine, intent, timing)

Parallel structured API (not chat):
  POST /api/symbolic-analysis  → symbolic-analysis/orchestrator.js
  POST /api/personal-analysis  → runner / personal analysis envelope
  daily-analysis/*             → computation-only layered daily engine
```

**Primary entry files:**

| Role | Path |
|------|------|
| HTTP server | `server/index.js` |
| Chat pipeline | `server/atlas-message-service.js` |
| Channel normalize | `server/channel-adapters.js` |
| Telegram | `server/telegram.js`, `server/telegram/handlers.js` |
| Frontend chat | `src/services/atlas-chat.ts` → `/api/chat` |
| Frontend symbolic | `src/services/symbolic-analysis.ts` |

---

## 3. Existing engines and capabilities

### 3.1 Live / production-capable

| Domain | Paths | Deterministic calc | Interpretation | Channel |
|--------|-------|--------------------|----------------|---------|
| **Numerology (personal)** | `server/numerology-engine/*`, `server/numerology-flow.js` | Yes (birth + name charts, traces) | Rule + template reply (`reply-builder`, depth-guard) | Chat W/T |
| **Numerology (daily digit)** | `server/atlas-numerology.js`, daily-analysis gregorian/hijri layers | Yes | Separated (`interpretation: null` in daily) | Injected into astrology/daily |
| **Tarot** | `server/tarot-engine/*`, `server/tarot-flow.js` | Selection seeded; deck 78 | Position/combination/contradiction + reply | Chat W/T |
| **Dream** | `server/dream-engine/*`, `server/dream-flow.js` | Symbol extract corpus | Multi-layer meanings + depth-guard | Chat W/T |
| **Symbolic / Ebced+Esma** | `server/symbolic-analysis/*` | Latin motif calc; classical abjad runner (flag/shadow) | Compose + certainty filter | **API** `/api/symbolic-analysis` (+ UI page) |
| **Ephemeris / sky** | `server/atlas-ephemeris.js` (`astronomy-engine`) | Planet longitudes, moon, sun times | Not natal houses | Data blocks for astrology/daily |
| **Hijri / sacred calendar** | `server/atlas-symbolic-calendar.js`, conversation-style Hijri intent | Umm al-Qura via Intl | Short reply / prompt block | Chat |
| **Daily analysis** | `server/daily-analysis/*` | Multi-layer registry; no LLM | Explicitly null | Programmatic |
| **Astrology flow** | `server/atlas-astrology-flow.js` | Uses ephemeris + calendar + daily numerology **data** | **LLM** guided by injected verified blocks | Chat |
| **Cross-layer synthesis** | `server/cross-layer-synthesis/*` | Theme/relationship classify | Composer + certainty/faith safety; optional LLM bridge | Chat |
| **Self-profile** | `server/self-profile-resolver.js` | Memory lookups; life path when date known | Deterministic short answers | Chat |
| **Audio studio** | `server/audio-studio/*` | Capability registry; ffmpeg local stub path | Capability-honest replies | Chat |
| **Atlas Live** | `server/atlas-live/*` | Session/scheduler schema | Presenter / voice stubs | HTTP live routes |
| **Persona / author** | `server/persona-engine.js`, `knowledge/persona-engine/*` | N/A | Style/voice selection | LLM path |

### 3.2 Planned / placeholder (no fake output)

From `server/symbolic-analysis/capability.js` `LAYER_READINESS`:

| layerId | Readiness | Notes |
|---------|-----------|--------|
| `cifir` | planned | Placeholder runner |
| `simya` | planned | Placeholder |
| `mizac` | planned | Placeholder |
| `fizyonomi` | unavailable | Photo capability off |

### 3.3 Missing vs Domain Intelligence catalog (§8)

| Target engine | Status |
|---------------|--------|
| Full natal astrology (houses, ASC, aspects engine) | **Absent** — `ASCENDANT_CALC_AVAILABLE = false`; no Placidus/Whole Sign |
| Destiny Matrix | **Absent** (mentioned in style copy only) |
| Mythology engine | **Absent** |
| Alchemy engine (beyond Cosmic Simya brand voice) | **Placeholder only** |
| Psychology/archetype standalone | Partial inside dream Jung layer |
| Qur’an semantic/tafsir runtime | Design in `docs/quran-data-architecture.md`; safety validators in `quran-safety.js`; **no full corpus ingest** |
| Hadith research | **Absent** |
| Face symbolism | **Unavailable** by policy |
| Palmistry | **Absent** |
| Central Symbol Intelligence graph | Partial per-engine corpora (dream symbols, tarot meanings) — **no shared graph** |
| Voice clone / full TTS | Stubs / Live partial |
| Professional subjects / white-label | **Absent** |
| Public Domain Analysis API v1 | Only symbolic-analysis + personal-analysis + chat |

---

## 4. Shared pipeline audit

### 4.1 Strengths

- Single chat entry (`processAtlasMessage`) used by Web and Telegram.
- Channel adapters keep channel quirks out of engines.
- Engine-first routing for numerology / tarot / dream (LLM bypass when handled).
- Health safety blocks spiritual routing on visual-symptom queries.
- Request timing phases record engine order.
- Speaker attribution for Telegram groups.

### 4.2 Weaknesses

- **No central Domain Router** — sequential `if tryXFlow` chain; order sensitivity and duplication risk.
- **No Request Normalizer** to structured `NormalizedDomainRequest` shared by all engines.
- Intent detection is **per-engine regex**, not a shared classifier with accept/reject fixtures registry.
- Structured API exists for symbolic-analysis but **not** for numerology/tarot/dream/astrology as first-class JSON products.
- Depth systems exist (L1–L3-ish) per engine but **not unified L0–L4**.

### 4.3 Approximate chat order (relevant slices)

1. Privacy / identity gates  
2. Health safety  
3. Conversation activation  
4. Audio studio  
5. Numerology flow  
6. Tarot flow  
7. Dream flow  
8. Memory / self-profile / astrology clarify  
9. Cross-layer synthesis  
10. LLM fallback  

---

## 5. Calculation vs interpretation audit

| Area | Calculation owner | Interpretation owner | Risk |
|------|-------------------|----------------------|------|
| Numerology personal | `birth-calculations.js`, `name-calculations.js`, `reduce.js` | `meanings.js` + `reply-builder.js` | Low — calc deterministic; meanings are Atlas tables |
| Tarot selection | `select-cards.js` | `meanings` / `combinations` / reply | Low — selection isolated |
| Dream symbols | corpus match extract | meanings + archetypes | Medium — corpus size limited (33 symbols in tests) |
| Ephemeris | `astronomy-engine` | LLM in astrology flow | Medium — calc good; natal houses missing so LLM may overreach if prompts weaken |
| Hijri | Intl umalqura | short formatter | Low |
| Daily analysis | layer registry | null | Good separation |
| Symbolic Latin motif | `ebced-runner` / tables | compose sections | Medium — must not be labeled classical |
| Classical abjad | `classical-abjad-runner` + fixtures | disclosure | Flag/shadow modes — product gate still relevant |
| Esma | catalog match / abjad match helpers | theme intention | Experimental vs classical labeling required |
| Astrology narrative | data blocks only | **LLM** | High if natal invents ASC/houses |
| Cross-layer | relationship classify | composer + optional LLM | Epistemic merge risk |

**Explicit good practice already present:** self-profile refuses to invent rising; daily-analysis forbids LLM; classical spelling confirmation gate; tarot/dream uncertainty boundaries.

---

## 6. Methodology and source audit

### 6.1 Methodology today

| Id | Where defined | Registry? |
|----|---------------|-----------|
| `atlas-pythagorean-birth-v1` | `numerology-engine/methodology.js` | Per-engine constant |
| `atlas-classic-tarot-v1` | `tarot-engine/methodology.js` | Per-engine |
| `atlas-dream-v1` | `dream-engine/methodology.js` | Per-engine |
| `atlas-letter-number-v1/v2` | `symbolic-analysis/methodology-ids.js` | Partial central for symbolic |
| `abjad-kabir-classical-v1` | same | Flagged |
| Esma match methodologies | `esma-abjad-match.js` / docs | Spec-heavy |

**Gap:** No `knowledge/methodologies/` or `server/methodology-registry/` loading all domains. No status lifecycle (`draft|experimental|active|deprecated`) as runtime data.

### 6.2 Sources today

- Persona / founder / author knowledge under `knowledge/` (style, not classical sources).
- Engine-local data: dream symbols, tarot deck meanings, esma catalogs, arabic name spellings, classical kabir table.
- Qur’an: architecture doc only; `SURAH_AYAH_COUNTS` validation in `quran-safety.js`.
- **No** `knowledge/sources/registry.json`.

---

## 7. Memory and identity audit

| Concern | Current | Gap vs target |
|---------|---------|---------------|
| User memory | `server/user-memory.js` → `data/user_memory.json` | Single profile blob; no `subjectId` client records |
| Identity | `identity-claims.js`, founder knowledge | Strong founder hardening |
| Privacy | `privacy/*` | Strong deny defaults |
| Context | `conversation-context-engine.js` | Not a typed Context Resolver with evidence classes |
| Professional clients | — | Missing |
| Memory classes | facts/profile/preferences | Not `verified_user_profile` vs `derived_fact` taxonomy |

---

## 8. Channel parity audit

| Capability | Web | Telegram | API JSON |
|------------|-----|----------|----------|
| Chat engines (num/tarot/dream) | Yes via `/api/chat` | Yes via bot → same service | Text replies only in chat metadata |
| Symbolic analysis structured | UI + `/api/symbolic-analysis` | Not primary | Yes |
| Daily analysis | Preview mostly demo | Via astrology injection | Engine API internal |
| Channel adapters | Yes | Yes | N/A |

**Parity rule today:** Same `processAtlasMessage` ⇒ same engine selection for chat. **Not** the same as structured Domain API parity.

---

## 9. Duplications and fragile points

1. **Two numerology worlds:** personal engine vs daily digit-sum vs symbolic letter motif — ids mostly separated, but product language still confusable.  
2. **Astrology without natal engine** while prompts discuss houses/ASC.  
3. **Symbolic platform RFCs** vs **chat engines** — two contract families.  
4. **`release/atlas-v0.8-production/`** mirrors large tree — risk of drift from root `server/`.  
5. **Intent order** in message service is long and brittle.  
6. **LLM-dependent tests** fail without `OPENAI_API_KEY` (identity V2–V5 in `test:all`).  
7. Depth guards per engine — good, but no shared schema versioning for analysis archive.  
8. **Daily-analysis is compute-complete but not a chat short-circuit** — wired mainly via cross-layer synthesis adapter / tests; UX often goes astrology LLM path instead.  
9. **Three synthesis surfaces:** `symbolic-synthesis.js` (LLM meta modes) vs `cross-layer-synthesis/` (deterministic) vs `runner/personal-analysis-pipeline-runner.js` (LLM core-engine).  
10. **Abjad chat verification** (`server/abjad-verification.js`) is a separate deterministic path from `/api/symbolic-analysis`.  
11. **Numerology/tarot/dream sessions are in-memory** — lost on restart; unsafe for multi-instance.  
12. **`test:all` omits** `test:symbolic`, `test:classical-abjad`, `test:abjad-esma` (and several live/verify scripts) — domain CI pack should be explicit.

---

## 10. Test baseline (2026-08-03)

### Domain engines (no API key required) — all green

| Suite | Command | Result |
|-------|---------|--------|
| Numerology | `npm run test:numerology` | **71 passed, 0 failed** |
| Tarot | `npm run test:tarot` | **100 passed, 0 failed** |
| Dream | `npm run test:dream` | **67 passed, 0 failed** |
| Hijri | `npm run test:hijri` | **43/43 passed** |
| Daily analysis | `npm run test:daily-analysis` | **48/48 passed** |
| Symbolic | `npm run test:symbolic` | **all ok** |
| Classical abjad | `npm run test:classical-abjad` | **PASS** (+ fixtures) |

### `npm run test:all`

Stopped / failed on identity cases that require OpenAI when key absent:

- Privacy: **43/43 passed**
- Identity processAtlasMessage: **23/28** (failures: V2–V5 LLM paths, one memory confirmation case)
- Root cause noted in logs: `MODEL_UNAVAILABLE: OPENAI_API_KEY not set in .env`

**Baseline recommendation:** Treat domain deterministic suites above as migration gate; run LLM suites only in CI with secrets.

---

## 11. Security / epistemic hotspots

- Astrology LLM path must keep “no invent ASC” (self-profile already does; astrology prompts partially do).  
- Classical abjad vs Latin motif mixing forbidden (ADR-002).  
- Dream/tarot safety: death prophecy, medical diagnosis — tests cover many cases; keep expanding.  
- Qur’an: never invent verses (`quran-safety`); full corpus still not loaded.  
- Photo/face: correctly disabled.  
- PII in logs: classical shadow scrub tested; extend to Domain Core traces.

---

## 12. Gap summary table (target vs current)

| Alan | Mevcut durum | Hedef | Boşluk | Öncelik | Risk |
|------|--------------|-------|--------|---------|------|
| Domain Core | Yok; ad-hoc flows | Shared normalizer/router/resolvers | Büyük | P0 | Mimari dağınıklık |
| Engine contract | RFC-001 symbolic; chat engines de facto | Universal `AtlasDomainEngine` | Orta | P0 | API uyumsuzluğu |
| Methodology registry | Per-file constants | Central versioned registry | Orta | P0 | Metodoloji karışması |
| Source registry | Yok | `knowledge/sources` | Büyük | P1 | Halüsinasyon |
| Numerology | Güçlü personal engine | Multi-school + L0–L4 | Küçük–orta | P1 | Ekol karışması |
| Tarot | Güçlü classic | Deck variants, professional reports | Küçük | P2 | — |
| Dream | Multi-layer | Richer corpus + shared symbols | Orta | P1 | Yüzeysellik |
| Astrology | Ephemeris + LLM flow | Full natal calc engine | Büyük | P0 | Yanlış ASC/ev |
| Destiny matrix | Yok | Methodology-split engine | Büyük | P2 | Sahte sistem birleştirme |
| Ebced/Esma | Symbolic API + specs | Classical productize + chat parity | Orta | P1 | Klasik/latin karışımı |
| Synthesis | cross-layer + soft symbolic | Formal Cross-Domain Synthesis | Orta | P1 | Tekrar / sahte birlik |
| Memory subjects | Tek profil | Owner vs client subjects | Büyük | P1 | Kişi karışması |
| Professional / WL | Yok | Profiles, templates | Büyük | P2 | Erken scope creep |
| Analysis API | Partial | `/api/v1/analyze…` | Büyük | P1 | Ticari blokaj |
| Tests | Strong per engine | Shared fixtures + parity pack | Orta | P0 | Regresyon |
| Voice / image | Stubs / disabled | Phased capability | Büyük | P3 | Güvenlik |

---

## 13. Proposed folder structure (aligned to repo reality)

Prefer **additive** modules; keep existing engine folders until adapters exist.

```text
server/domain-core/                 # NEW — FAZ 2
  index.js
  contracts/                        # schemas (JSDoc/TS later)
  registries/
    engine-registry.js
    methodology-registry.js
    source-registry.js
  normalize/
    request-normalizer.js
  resolve/
    data-requirements.js
    methodology-resolver.js
    depth-resolver.js
    context-resolver.js
  evidence/
    evidence-types.js
    uncertainty.js
  compose/
    response-composer.js
  orchestration/
    domain-router.js
    analysis-orchestrator.js
  adapters/                         # wrap existing engines
    numerology-adapter.js
    tarot-adapter.js
    dream-adapter.js
    symbolic-adapter.js
    daily-analysis-adapter.js
    astrology-adapter.js            # ephemeris + flow bridge

knowledge/methodologies/            # NEW — data, not only code constants
knowledge/sources/                  # NEW — registry + domains

docs/atlas-domain-platform/         # THIS suite
docs/adr/ADR-006+                   # Domain platform ADRs

# KEEP UNTIL MIGRATED
server/numerology-engine/
server/tarot-engine/
server/dream-engine/
server/symbolic-analysis/
server/daily-analysis/
server/cross-layer-synthesis/
server/atlas-message-service.js     # gradually call Domain Core
```

**Do not** create a second copy under `release/` until prepare-production sync is intentional.

---

## 14. Open decisions (founder)

See `ROADMAP.md` § Open Decisions — product choices required before FAZ 3+ heavy investment (default house system, numerology school, Qur’an meal set, experimental methodology exposure, API externalization).

---

## 15. Audit completeness checklist

- [x] Repository engines mapped with real paths  
- [x] Shared pipeline mapped  
- [x] Calculation vs interpretation classified  
- [x] Methodology/source gaps stated  
- [x] Memory/identity gaps stated  
- [x] Channel parity stated  
- [x] Test baseline recorded  
- [x] Prior symbolic RFCs acknowledged  
- [ ] Domain Core code — **not started** (correct for FAZ 0)  

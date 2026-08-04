# ATLAS Domain Intelligence Platform — Current State Audit

> **OBSOLETE FOR GAP STATUS (2026-08-04) — refresh deferred**  
> For current architecture compliance and gaps, use:  
> [`docs/architecture/COMPLIANCE_MATRIX.md`](../architecture/COMPLIANCE_MATRIX.md)  
> Canonical architecture: [`ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md`](../architecture/ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md)  
> Known stale claim: natal ASC “unavailable” — runtime now exposes `ASCENDANT_CALC_AVAILABLE = true` when inputs resolve.  
> This historical audit is retained for call-chain proofs; disposition **Obsolete (refresh later)**.  
> Audit only — no production refactor authorized.

**Status:** Historical audit (gap status superseded by Compliance Matrix)  
**Document id:** `atlas-domain-platform-current-state-audit-v1`  
**Audit date:** 2026-08-03 (Phase 2 deep-verify same day)  
**Repo:** `ATLAS-v0.8-asset-persistence`  
**Implementation status of this document:** Audit only — no production refactor / feature / commit authorized by this file  

**Phase 2 adds:** call-chain proofs for explore claims, full shared-pipeline map with file references, engine registry table, shared-component inventory, duplicate-logic list, engine-contract readiness, risk matrix, and refined phase order.  

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

## 15. Audit completeness checklist (Phase 1)

- [x] Repository engines mapped with real paths  
- [x] Shared pipeline mapped  
- [x] Calculation vs interpretation classified  
- [x] Methodology/source gaps stated  
- [x] Memory/identity gaps stated  
- [x] Channel parity stated  
- [x] Test baseline recorded  
- [x] Prior symbolic RFCs acknowledged  
- [ ] Domain Core code — **not started** (correct for FAZ 0)  

---

# PHASE 2 — Deep Architecture Verification

**Method:** Code-path verification only (no new features, no refactor, no commit).  
**Primary source of truth:** `server/atlas-message-service.js` → `processAtlasMessage`.

---

## P2.1 Explore claims — verified with call chains

### Claim A — `daily-analysis` is not a chat short-circuit

| | |
|--|--|
| **Verdict** | **CONFIRMED** |
| **Evidence** | `server/daily-analysis-flow.js` L1–4: *"Not wired into atlas-message-service yet. Returns JSON data only; no narrative reply."* |
| **Grep proof** | `atlas-message-service.js` has **zero** imports of `daily-analysis` / `tryDailyAnalysis` / `buildDailyAnalysis`. |
| **Actual call chain** | `processAtlasMessage` → (LLM path) `runMessageCrossLayerSynthesis` (`atlas-message-service.js` ~2178) → `collectSynthesisLayers` (`cross-layer-synthesis/message-integration.js`) → optional `tryDailyAnalysis` (~354) **only when** `wantDaily && intentInfo.wantsSynthesis`. Also used by `scripts/test-daily-analysis.mjs`. |
| **Functions** | `detectDailyAnalysisIntent`, `tryDailyAnalysis` (`daily-analysis-flow.js`); `buildDailyAnalysis` (`daily-analysis/orchestrator.js`). |
| **Risk** | **High (product/UX):** layered daily compute exists but users asking “günlük analiz” may hit astrology LLM path (`atlas-astrology-flow`) instead of structured daily report. |

### Claim B — Three distinct synthesis surfaces

| # | Surface | Files | Nature | Entry |
|---|---------|-------|--------|-------|
| 1 | **Meta / mode synthesis (LLM framing)** | `server/symbolic-synthesis.js`, `server/atlas_meta_synthesis.md` | Mode detection (`detectAnalysisMode`), tarot protocol helpers, `formatMetaSynthesisProse` | Chat mode + personal-analysis prose formatting (`atlas-message-service.js` ~2071) |
| 2 | **Cross-layer synthesis (deterministic)** | `server/cross-layer-synthesis/*` esp. `composer.js`, `message-integration.js` | Theme/relationship classify + compose; optional daily/ephemeris/hijri layers | `detectCrossLayerSynthesisIntent` → `runMessageCrossLayerSynthesis` → prompt block + `guardSynthesisReply` (~2168–2256) |
| 3 | **Personal-analysis core-engine (LLM agent)** | `runner/task-router.js`, `runner/personal-analysis-pipeline-runner.js`, `agents/core-engine.md` | Single-stage LLM envelope | `detectPersonalAnalysisIntent` / `shouldRouteToPersonalAnalysis` → `routeTask({ task_type: 'personal-analysis' })` (~1990–2094) |

| | |
|--|--|
| **Risk** | **High (methodology/duplication):** overlapping product language (“sentez”) with three different truth models; user/debug confusion; regression when changing one without the others. |

### Claim C — `abjad-verification` insertion points in chat pipeline

**Two insertion points (not one):**

| Point | When | Function | Behavior |
|-------|------|----------|----------|
| **C1 Short-circuit** | After numerology/tarot/dream/context/privacy gates; inside block `if (!hasImage && !tarotIntent.active && !wantsPersonalAnalysis)` and `if (!synthesisIntentEarly.wantsSynthesis)` | `tryDeterministicAbjadReply` (`abjad-verification.js`) | Returns full reply; `engine: 'abjad-verification'` (~1864–1900) |
| **C2 LLM injection** | Always when building prompts via `buildAtlasPromptBundle` | `runAbjadEsmaVerification` (~705–711) → `abjadVerificationContext` into `buildChatUserPrompt` | Does not short-circuit; injects VERIFIED blocks for LLM |

| | |
|--|--|
| **Calc deps** | Uses `symbolic-analysis/calculate-abjad.js`, `resolve-arabic-spelling.js`, `esma-abjad-match.js` — **not** the full `/api/symbolic-analysis` orchestrator. |
| **Risk** | **Medium:** dual path (chat verify vs symbolic API) can diverge in disclosure/methodology labeling if one updates without the other. |

### Claim D — Session memory is process memory

| Store | File | Structure | Persistence |
|-------|------|-----------|-------------|
| Numerology reading session | `numerology-engine/session.js` | `const sessions = new Map()` | **Process RAM only**; idle TTL default 20m (`ATLAS_NUMEROLOGY_SESSION_IDLE_MS`) |
| Tarot session | `tarot-engine/session.js` | `new Map()` | RAM; 20m TTL |
| Dream session | `dream-engine/session.js` | `new Map()` | RAM; 20m TTL |
| Conversation activation | `conversation-activation.js` | `const sessions = new Map()` | RAM |
| Conversation context state | `conversation-context-engine.js` | `stateByConversation = new Map()` | RAM |
| Cross-layer user examples | `cross-layer-synthesis/user-example.js` | `SESSION_STORE = new Map()` | RAM |
| Daily-analysis layer cache | `daily-analysis/cache.js` | `STORE = new Map()` TTL 1h | RAM |

| | |
|--|--|
| **Verdict** | Engine follow-up sessions are **fully process-local**. Restart / multi-instance ⇒ session loss / split-brain. |
| **Risk** | **Critical (scalability / regression):** Telegram + multi-worker deploy breaks “same spread / same chart” follow-ups. |

### Claim E — What *is* persisted (disk JSON)

| Store | Path (default) | Module |
|-------|----------------|--------|
| User memory (profile/facts/preferences) | `data/user_memory.json` | `user-memory.js` |
| Analysis archive | `data/analysis_archive.json` | `analysis-archive.js` |
| Auth accounts | `data/auth_accounts.json` | `auth/account-store.js` |
| Auth sessions | `data/auth_sessions.json` | `auth/session-store.js` |
| Privacy events | `data/privacy_events.json` | `privacy/privacy-logger.js` |
| Admin audit | `data/admin_audit.json` | `auth/admin-audit.js` |
| Founder public profile | `data/founder_public_profile.json` | `privacy/founder-privacy.js` |
| Persona feedback records | under `knowledge/persona-engine/feedback/` | `persona-feedback/store.js` |
| Audio studio jobs/context | `data/audio-jobs/` (+ related JSON) | `audio-studio/*` |
| Telegram poll lock / heartbeat | `data/telegram.heartbeat.json` etc. | `telegram.js` |

Engine chart/spread/dream session snapshots are **not** in this list.

### Claim F — `test:all` contents vs omitted symbolic packs

**`package.json` `"test:all"` runs (in order):**

1. `verify-privacy.mjs`  
2. `verify-identity-claims.mjs`  
3. `verify-auth.mjs`  
4. `verify-admin.mjs`  
5. `verify-atlas-pipeline.mjs`  
6. `verify-memory-runtime.mjs`  
7. `verify-founder-identity.mjs`  
8. `test-conversation-style.mjs`  
9. `test-author-profile.mjs`  
10. `test-persona-engine.mjs`  
11. `test-persona-feedback.mjs`  
12. `test-persona-feedback-flow.mjs`  
13. `test-conversation-context.mjs`  
14. `test-conversation-activation.mjs`  
15. `test-hijri-calendar.mjs`  
16. `test-daily-analysis.mjs`  
17. `test-numerology-engine.mjs`  
18. `test-tarot-engine.mjs`  
19. `test-dream-engine.mjs`  
20. `test-audio-studio.mjs`  
21. `test-request-timing.mjs`  
22. `test-atlas-live.mjs`  

**Defined as npm scripts but NOT in `test:all`:**

| Script | Command |
|--------|---------|
| `test:classical-abjad` | `validate-classical-fixtures.mjs` + `test-classical-abjad.mjs` |
| `test:abjad-esma` | `test-abjad-esma-verification.mjs` |
| `test:symbolic` | `test-symbolic-analysis.mjs` |
| `test:telegram-multimodal` | (optional channel) |
| `test:telegram-health` | (optional channel) |
| Also unscripted in all | `test-cross-layer-synthesis.mjs`, `test-cross-layer-message-integration.mjs`, `test-astrology-flow.mjs` (exist under `scripts/` but no durable place in `test:all`) |

| | |
|--|--|
| **Risk** | **High (test/regression):** classical abjad + symbolic envelope can regress while `test:all` stays green. |

---

## P2.2 Shared pipeline map (verified order)

```text
[Channel]
  Web:  POST /api/chat          → channel-adapters.normalizeAtlasMessageRequest
  TG:   telegram handlers       → POST /api/atlas/message → same normalize + processAtlasMessage

[processAtlasMessage]  server/atlas-message-service.js
  1. Request timing start          request-timing.js
  2. Auth / requester context      auth + buildRequesterContext
  3. Conversation activation       conversation-activation.js :: evaluateActivation
  4. Privacy evaluate              privacy/* :: evaluatePrivacyRequest
  5. Founder / identity fail-closed identity-claims.js, founder-identity.js
  6. Memory intent detect          memory-intents.js :: detectMemoryIntent
  7. Tarot protocol detect         symbolic-synthesis.js :: detectTarotSpreadIntent  (label only this early)
  8. Health safety short-circuit   health-safety.js
  9. Memory command short-circuit  processMemoryIntent / user-memory.js
 10. Audio studio short-circuit    audio-studio-flow.js
 11. Numerology engine             numerology-flow.js → numerology-engine/*
 12. Tarot engine                  tarot-flow.js → tarot-engine/*
 13. Dream engine                  dream-flow.js → dream-engine/*
 14. Conversation context          conversation-context-engine.js (+ self-profile-resolver.js)
 15. Privacy reply short-circuit   (founder/private dumps)
 16. Early synthesis intent        cross-layer-synthesis/message-integration.js
 17. Astrology fate refusal        atlas-astrology-flow.js
 18. Abjad deterministic reply     abjad-verification.js :: tryDeterministicAbjadReply
 19. Casual conversation style     atlas-conversation-style.js
 20. Astrology clarify replies     atlas-astrology-flow.js
 21. Personal-analysis routeTask   runner/task-router.js → personal-analysis-pipeline-runner
 22. Prompt build                  atlas-prompt-loader / buildAtlasPromptBundle
       + abjad runAbjadEsmaVerification inject
       + astrology buildAstrologyAnalysisContext inject (ephemeris/calendar/numerology day)
       + cross-layer runMessageCrossLayerSynthesis prompt block
 23. LLM call                      openai-client.js
 24. Synthesis reply guard         guardSynthesisReply
 25. Privacy / speaker response guard
 26. noteAssistantTurn             conversation-context-engine.js
 27. Channel format outbound       channel-adapters.js
```

### Stage → real files

| Stage | Files |
|-------|-------|
| Request normalization | `channel-adapters.js` |
| Intent resolution | Distributed: `*-engine/intent.js`, `*-flow.js`, `symbolic-synthesis.js`, `memory-intents.js`, `atlas-astrology-flow.js`, `atlas-conversation-style.js`, `health-safety.js`, `cross-layer-synthesis/message-integration.js` — **no central Domain Router** |
| Memory resolution | `user-memory.js`, `memory-intents.js`, `self-profile-resolver.js`, `conversation-context-engine.js` |
| Methodology selection | Per-engine constants (`methodology.js` / `methodology-ids.js`); **no runtime Methodology Resolver** |
| Engine selection | Ordered if-chain in `processAtlasMessage` |
| Calculation | Engine modules / `atlas-ephemeris.js` / `atlas-symbolic-calendar.js` / `daily-analysis/*` / `symbolic-analysis/*` |
| Interpretation | Engine `reply-builder.js` / `meanings.js` OR LLM |
| Synthesis | Three surfaces (P2.1.B) |
| Safety | `health-safety.js`, `privacy/*`, engine depth-guards, `symbolic-analysis/safety.js`, `cross-layer-synthesis/{certainty-filter,safety,quran-safety}.js` |
| Response formatting | Engine reply-builders + `atlas-response.js` + channel-adapters |
| Channel adapters | `channel-adapters.js`, `telegram.js`, `telegram/handlers.js` |

**Missing vs target Domain Core:** Request Normalizer (domain), Methodology Resolver, Data Requirement Resolver, Engine Registry, shared StructuredAnalysisOutput, Context Resolver taxonomy.

---

## P2.3 Engine registry inventory

| Motor | Durum | Ortak interface? | Deterministik oranı | Teknik borç |
|-------|-------|------------------|---------------------|-------------|
| Numerology personal (`numerology-engine`) | Live chat | Hayır (de facto orchestrator) | ~95% calc+template | Depth L0–L4 yok; session RAM |
| Numerology daily (`atlas-numerology.js`) | Live as data | Hayır | 100% | Naming collision with personal |
| Tarot (`tarot-engine`) | Live chat | Hayır | ~95% | Dual intent w/ `detectTarotSpreadIntent` |
| Dream (`dream-engine`) | Live chat | Hayır | ~90% | Small corpus; session RAM |
| Symbolic Analysis API | Live HTTP | Envelope-only (layer ids) | ~100% calc | if/else `layers/run.js`; placeholders |
| Classical Abjad runner | Flag/shadow | Partial via symbolic | 100% calc | Not default product path |
| Abjad chat verification | Live chat | Hayır | 100% when short-circuit | Parallel to symbolic API |
| Esma (symbolic + verify) | Live | Hayır | High | Catalog/version policy ADR-004 |
| Ephemeris | Live data | Hayır | 100% | No houses/ASC |
| Astrology flow | Live hybrid | Hayır | Intent/clarify det.; **interpret LLM** | Natal engine missing — **Critical** |
| Hijri calendar | Live | Hayır | 100% | Intent also in conversation-style |
| Daily Analysis | Live compute | Layer registry internal | 100%; interpretation null | **Not chat short-circuit** |
| Cross-layer synthesis | Live bridge | Hayır | High (compose det.) | Overlaps meta-synthesis language |
| Meta synthesis / modes | Live LLM assist | Hayır | Low (LLM) | Prompt vocabulary invents missing domains |
| Personal-analysis runner | Live LLM | Envelope via runner | Low (LLM) | Comments: fate-matrix agents undeployed |
| Conversation style | Live det. | Hayır | 100% for casual intents | Hijri intent collocated |
| Memory / self-profile | Live | Hayır | 100% lookups | No subjectId clients |
| Audio studio | Live limited | Capability registry | Capability-honest | Stubs |
| Atlas Live | Mounted HTTP | Internal schema | Mixed | Separate from chat Domains |
| Persona / author | Live LLM style | Hayır | N/A | Not analysis engine |
| Destiny matrix | **Absent** | — | — | Prompt mentions only |
| Alchemy / cifir / mizaç | Placeholder | — | — | `LAYER_READINESS` planned |
| Fizyonomi | Unavailable | — | — | Photo off |
| Mythology / Hadith / Palm / Face claims | Absent | — | — | — |

---

## P2.4 Shared components

| Concern | Shared module? | Implementations |
|---------|----------------|-----------------|
| Memory store | Yes | `user-memory.js` |
| Channel normalize | Yes | `channel-adapters.js` |
| Chat pipeline | Yes (monolith) | `atlas-message-service.js` |
| Request timing | Yes | `request-timing.js` |
| Privacy guard | Yes | `privacy/*` |
| Health safety | Yes | `health-safety.js` |
| Depth guard | **Per engine** | numerology/tarot/dream `depth-guard.js` (parallel pattern, not shared lib) |
| Reply builder | **Per engine** | parallel `reply-builder.js` |
| Session manager | **Per engine** | parallel `session.js` Map pattern |
| Methodology ids | Partial | `methodology-ids.js` + per-engine `methodology.js` |
| Symbolic compose | Symbolic only | `symbolic-analysis/compose.js` |
| Certainty / safety prose | Split | symbolic `safety.js` vs cross-layer `certainty-filter.js` / `safety.js` |
| Quran verse validate | Cross-layer | `quran-safety.js` |
| Router | **No** | Ordered if-chain |

---

## P2.5 Duplicate logic

| Area | Duplicates | Notes |
|------|------------|-------|
| **Tarot intent** | `symbolic-synthesis.detectTarotSpreadIntent` + `tarot-engine/intent.detectTarotEngineIntent` (wraps protocol) | Engine-first mitigates; still dual |
| **Numerology concepts** | Personal engine vs `atlas-numerology` day vs daily-analysis numerology layers | Three calc families |
| **Synthesis** | meta / cross-layer / personal-analysis | Three surfaces |
| **Abjad** | `/api/symbolic-analysis` orchestrator vs `abjad-verification` chat | Shared calc helpers, different envelopes |
| **Profile resolution** | `self-profile-resolver` + `conversation-context-engine` + numerology-flow memory seed | Overlapping birth/name reads |
| **Hijri current date** | `atlas-conversation-style` intents + `atlas-symbolic-calendar` + daily hijri layer | Multiple entry points |
| **Depth resolution** | Three nearly identical SHORT/STANDARD/DEEP helpers | No shared L0–L4 |
| **Session Map+TTL** | Three engines + activation + context + synthesis examples | Copy-paste pattern |
| **Astrology vs daily** | Both answer “günün etkisi” language spaces | daily not short-circuited |
| **release/ tree** | Full mirror of server | Drift risk |

---

## P2.6 Engine contract readiness

### Can a common interface be extracted?

**Yes**, as **adapters** over existing orchestrators — do not require immediate internal rewrite.

| Engine | Ease of adapter | Needs prior refactor? |
|--------|-----------------|----------------------|
| Numerology | **Easy** — `runNumerologyAnalysis` already returns chart + reply | No |
| Tarot | **Easy** — selection/interpret already split | No |
| Dream | **Easy** — `runDreamAnalysis` | Mild corpus typing |
| Daily-analysis | **Easy** — already calc-only structured layers | Wire to chat later |
| Ephemeris / Hijri | **Easy** — pure functions | Wrap as calc engines |
| Symbolic-analysis | **Medium** — map layers → EngineResult; keep wire compat | Align confidence/assessment (ADR-003) |
| Abjad-verification | **Medium** — merge conceptually with symbolic adapters | Disclosure parity |
| Cross-layer synthesis | **Medium** — fits synthesis engine contract (ADR-009) | Clear non-mutation tests |
| Astrology flow | **Hard** — hybrid LLM; calc incomplete | **Requires natal calc engine before honest contract** |
| Personal-analysis runner | **Hard** — LLM envelope, not domain calc | Keep outside Domain Core v1 or wrap as consumer report only |
| Conversation style / memory | Support services, not domain engines | N/A |

**Recommended first migrations:** Numerology → Tarot → Dream → Daily-analysis → Symbolic/Abjad → Ephemeris/Hijri → Synthesis. Astrology last among “live” until natal exists.

---

## P2.7 Risk matrix

| ID | Area | Risk | Severity | Evidence |
|----|------|------|----------|----------|
| R1 | Scalability | Engine sessions RAM-only | **Critical** | `*/session.js` Map |
| R2 | Methodology | Astrology LLM invents houses/ASC | **Critical** | `ASCENDANT_CALC_AVAILABLE=false`; prompts discuss houses |
| R3 | Test | Symbolic/classical outside `test:all` | **High** | `package.json` |
| R4 | Architecture | No Domain Router; order-sensitive monolith | **High** | `processAtlasMessage` |
| R5 | Duplication | Three synthesis surfaces | **High** | P2.1.B |
| R6 | UX/Architecture | Daily-analysis unused as chat engine | **High** | `daily-analysis-flow.js` header |
| R7 | Regression | Dual abjad paths diverge | **Medium** | verify vs symbolic API |
| R8 | Memory | No professional subjectIds | **High** (product) | `user-memory.js` schema |
| R9 | Safety | Meta prompts list undeployed domains | **Medium** | LLM may improvise destiny/alchemy |
| R10 | Performance | Long sequential engine probes every turn | **Medium** | timing phases always run |
| R11 | Duplication | `release/` mirror drift | **Medium** | tree size |
| R12 | Methodology | Per-file methodology constants | **Medium** | no central registry runtime |
| R13 | Safety | Generally strong health/privacy/depth-guards | **Low** residual | suites green |

---

## P2.8 Refined implementation phase order (post Phase-2 audit)

1. **Shared Engine Contract + schema fixtures** (`ENGINE_CONTRACT.md` → `server/domain-core/contracts`)  
2. **Engine Registry** (descriptors for live engines; no behavior change)  
3. **Methodology Registry** (load existing ids; dual-source with code constants)  
4. **Source Registry seed** (internal corpora ids)  
5. **Structured Output adapters** — Numerology, Tarot, Dream (dual-run equality)  
6. **Shared Calculation exposure** — Ephemeris, Hijri, Daily-analysis adapters  
7. **Shared Interpretation policy** — depth L0–L4 + shared uncertainty helpers (thin lib; engines keep reply-builders initially)  
8. **Chat bridge behind flag** — Domain Core orchestrator optional path  
9. **Symbolic/Abjad adapter unification** + add omitted packs to CI `test:domain`  
10. **Persist or externalize engine sessions** (before multi-instance)  
11. **Natal astrology calculation engine** (blocks honest astrology contract)  
12. **Cross-domain synthesis adapter** (non-mutating)  
13. Later: Dream deepen, Alchemy/Myth/Symbol graph, Qur’an data, image, voice, Professional Studio  

This replaces vague “big bang refactor” with adapter-first order grounded in verified readiness.

---

## P2.9 Phase 2 acceptance checklist

- [x] Explore claims verified with file/function/call-chain/risk  
- [x] Shared pipeline ordered map with real files  
- [x] Engine inventory table complete (live + absent)  
- [x] Shared components + duplicates listed  
- [x] Engine contract readiness ranked  
- [x] Risk matrix severity-classified  
- [x] First refactor/migration phase order refined  
- [x] No speculative modules asserted as existing  
- [ ] Production code changes — **explicitly out of scope for this task**  

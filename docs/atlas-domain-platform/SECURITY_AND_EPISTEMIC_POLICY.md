# ATLAS Domain Intelligence Platform — Security and Epistemic Policy

**Status:** Normative  
**Document id:** `atlas-domain-platform-security-epistemic-v1`  
**Date:** 2026-08-03  
**Updated:** 2026-09-01 — added §7 Knowledge Gap Policy (knowledge-domains/religion-history architecture work; see git history for `server/knowledge-domains/reasoning-guards.js` and `server/knowledge-domains/certainty-taxonomy.js`).  
**Parent:** [`docs/architecture/ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md`](../architecture/ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md) (canonical). Prior parent `MASTER_ARCHITECTURE.md` is archived.  
**Aligns with:** `docs/rfc/RFC-008-SAFETY-AUDIT-TRACE.md`, health-safety, privacy modules  

---

## 1. Epistemic claim classes

Atlas MUST distinguish in generation and, where UI allows, in presentation:

| Class | Example language |
|-------|------------------|
| Deterministic calculation | “Hesaplamaya göre yaşam yolu sayısı 7’dir.” |
| Astronomical / calendar data | “Bu konum astronomy-engine ile doğrulanmıştır.” |
| Historical / textual fact | “Klasik kaynakta şu bağlamda geçer.” |
| Traditional interpretation | “Geleneksel yorumlarda bu sembol çoğu zaman …” |
| Psychological possibility | “Bastırılmış bir gerilime işaret ediyor **olabilir**.” |
| Symbolic / model synthesis | “Göstergeler birlikte okunduğunda ana tema …” |
| Uncertainty | “Tek olasılık değildir; bağlam değiştirebilir.” |

**Forbidden conflations:** calculation ↔ belief; meal ↔ tafsir; Latin motif ↔ classical abjad; Jung possibility ↔ clinical diagnosis; synthesis ↔ scientific proof of identity across systems.

This table covers the personal/symbolic engines (§3). §7 extends it with the finer-grained taxonomy used by the citation/retrieval domains (religion, mythology, history, esotericism, general web) and reconciles it against `domain-core`'s `certainty` levels.

---

## 2. Universal safety prohibitions

Across all symbolic/spiritual engines Atlas MUST NOT:

- Predict exact death date/time from any modality  
- Diagnose disease or claim cure via Esma/ritual/cards/dreams  
- Predict pregnancy or serious medical outcomes as fact  
- Present legal/financial outcomes as prophecy  
- Assert a person is unfaithful, criminal, or dangerous from symbols alone  
- Use fear-pressure (“yapmazsan felaket”) to create dependency  
- Seize user decision agency  

Atlas MAY give strong interpretive readings if certainty language and alternatives are preserved.

---

## 3. Domain-specific guards

### Astrology

- No invented Ascendant/houses when birth time/place missing  
- Natal vs transit must not be conflated  
- Fate absolutism → refusal path (`FATE_REFUSAL_REPLY` pattern)

### Numerology

- No scientific past-life proof claims  
- Karmic debt framed as tradition, not fact  
- School differences disclosed

### Tarot / Dream

- No absolute future claims  
- Follow-ups reuse session; no silent redraw  
- Dictionary dumps blocked by depth-guard  

### Abjad / Esma / Qur’an

- No fabricated ayah/hadith  
- Classical spelling confirmation for classical path  
- Religious ruling (fatwa) out of scope  
- Esma zikir counts not health/fate guarantees  

### Face / Palm (future)

- Product naming: symbolism/expression — not character/crime/IQ/ethnicity inference  
- Insufficient image quality → no result  

### Voice clone (future)

- Explicit verified consent, scope logging, access control  
- No third-party voice cloning without owner consent  

---

## 4. Privacy and data

- Minimize PII in traces/logs (existing classical shadow scrub pattern)  
- Consent for symbolic processing where required (symbolic-analysis consents)  
- Owner vs professional client separation (future subjects)  
- Delete/export rights designed with storage migration  
- Memory write gates remain confirmation-first for durable facts  

---

## 5. Safety tests (minimum set)

| Query class | Expectation |
|-------------|-------------|
| Dream death timing | Refuse certainty; offer symbolic framing |
| Palm lifespan | Refuse |
| Tarot “cheating for sure” | Refuse absolute; interpretive caution |
| Face “bad person” | Refuse character verdict |
| Esma cures illness | Refuse medical claim |
| Invented ayah | Reject / validate fail |
| Unknown memory person | No fabrication |

Existing suites (`test:dream`, `test:tarot`, `test:numerology`, privacy, health-safety) are the seed pack; Domain Core adds a shared `safety/` fixture folder in FAZ 2+.

---

## 6. Enforcement points

1. Engine depth-guards / certainty filters  
2. Cross-layer faith safety + certainty sanitize  
3. Health-safety pre-router  
4. Privacy classifier  
5. Response Composer final scan (planned shared)  
6. Qur’an verse validators  

Safety layers **MUST NOT** alter numeric calculation fields; they may soften or block prose.

---

## 7. Knowledge Gap Policy

**Why this exists:** every time a real conversation exposed a gap, the historical response was a topic-specific fix — a new file, a verse-specific rule, a hardcoded name — rather than a general improvement to routing, retrieval, or reasoning. An architecture audit (2026-09-01) found this had **not** actually produced file-level patch sprawl (no evidence of "one conversation → 5–10 files"), but it did find: a real user's name hardcoded into a general reply template, two hardcoded proper names in a routing guard, and — most importantly — a live bug where an ordinary short question was silently rewritten because a follow-up resolver had no anchoring. This section is the reusable decision framework that replaces "add a patch" with "answer these questions first."

### 7.1 Decision framework

| Situation | Rule | Enforced by |
|---|---|---|
| A deterministic/verified local source exists for the claim (Qur'an verse text, a calculation-engine result) | Use it. Never re-derive it via retrieval or the LLM's own memory. | `quran-verse-lookup/retrieve.js` (`verified:false` fail-closed), `SOURCE_POLICY.quran` (`sourceType: 'deterministic_verified'`) |
| No local verified source, question is factual/historical/comparative | Attempt attributed external retrieval before answering; never answer from the model's unattributed memory. | `knowledge-domains/web-search-provider.js` `retrieveFromWeb()` — fails closed on missing key, network error, timeout, malformed response, **or no attributable URL citation** |
| A claim could be supported by more than one source and the sources might disagree (comparative religion, disputed history, competing traditions) | Do not silently pick one source's framing. Surface disagreement explicitly rather than presenting a single confident synthesis. | `knowledge-domains/reasoning-guards.js` `detectSourceDisagreementSignal()` + `web-domain-handler.js`'s disputed-note append (labels the reply `disputed_uncertain`) |
| Sources genuinely contradict each other | Label the claim `disputed_uncertain`, lower confidence, do not resolve the contradiction by fiat. | Same as above. Known gap: this reads disagreement off the *single* web-search-model's own synthesized answer, not independently-fetched sources compared against each other — see §7.7 acceptance criteria for what a stronger version would need. |
| A claim needs a stated type (verified text / historical consensus / tradition belief / later interpretation / modern claim / speculation) | Label it using `FACT_LAYER_LABELS` (`knowledge-domains/source-policy.js`) whenever precision matters, not just when convenient. | `SOURCE_POLICY[domain].factLayers`, surfaced in every web-backed reply via `formatWebBackedReply()` |
| No verified source is available and none can be retrieved | Abstain. Decline explicitly ("doğrulayamadım") rather than guessing a date, name, or citation. | `SOURCE_POLICY.*.failClosed = true` for **every** domain (no domain is exempt — see §7.7) |
| Theology vs. history vs. interpretation are at risk of being blurred | Keep them separated in the answer; one is never presented as proof of another. | `reasoning-guards.js` `buildTheologyFactSeparationDirective()`, codifying `atlas_decision.md` §11 and `atlas_forbidden_patterns.md`'s "Din / Tarih / Kutsal Metin İddiaları" section |
| The user asserts a thesis with pressure language ("değil mi", "sen de katılıyorsun değil mi") | Do not validate merely because it was asserted firmly; challenge a questionable premise politely. | `reasoning-guards.js` `detectAgreementBiasPressure()` + `buildAgreementBiasResistanceDirective()` — fires independent of domain |
| A broad ethnic/religious/historical generalization is at risk ("hep", "tüm ... her zaman") | Do not generalize without evidence; preserve diversity/exceptions. | `reasoning-guards.js` `detectBroadGeneralizationClaim()` + `buildGeneralizationGuardDirective()` — fires independent of domain |
| A factual/historical/comparative-religion question arrives while a symbolic engine (dream/tarot/numerology) session is active | Domain classification runs and wins **before** the message can reach the symbolic engines. | `atlas-message-service.js` "General knowledge-domain retrieval" block, which explicitly runs after Qur'an checks and before symbolic-context/numerology/tarot/dream, "so a factual/history/religion question is never swept into symbolic interpretation just because it shares vocabulary with those domains" |

### 7.2 Reusable category gap vs. domain-level architectural gap vs. one-conversation exception

Before adding *anything* new, classify the situation:

1. **Reusable category-level knowledge gap** — an entire class of *future* questions would fail the same way, and the missing thing is genuinely a corpus/source, not a bug. Example: no domain classifier exists yet for a whole knowledge area (e.g. "Buddhist canon citation lookup" as its own deterministic store, the way Qur'an has one).
   → **Justifies** a new knowledge corpus, scoped as narrowly as the actual gap (a store, not a file per question).
2. **Domain-level architectural gap** — the general machinery (routing, retrieval, guard, taxonomy) doesn't cover a case it structurally should. Example: the ordinal-follow-up bug found in this audit — any short message starting with "ilk" ("first") could be hijacked by a stale engine session, regardless of topic.
   → **Justifies** fixing the general mechanism (the regex, the routing precedence, the guard), verified by a regression test — never a per-topic workaround.
3. **One-conversation exception** — one specific phrasing, in one specific conversation, failed once. No evidence a second, differently-worded question would fail the same way.
   → **Does not justify** a new file, a hardcoded name/term, or a narrow special-case branch. It justifies, in order of preference: (a) generalizing an existing regex/detector so the *class* of phrasing is covered, (b) adding one entry to an existing curated index only if the index's own governance already allows it (see 7.3), (c) capturing the conversation as a **regression fixture** (`scripts/lib/conversation-fixture-runner.mjs`) so the specific failure can never silently reappear — without creating any new production code path.

**Decision test:** "If I generalized the fix instead of patching this exact case, would it help *any other* plausible question?" If the answer is no beyond this one phrasing, the correct artifact is a regression test, not a code patch.

### 7.3 Rules preventing patch-per-failure proliferation

- **No new file for a single failed conversation.** A new file under `server/knowledge-domains/`, `server/quran-verse-lookup/`, or equivalent requires a 7.2-category-1 justification, stated in the commit/PR description.
- **No hardcoded proper noun (person name, place, exact phrase) in a general-purpose routing, reply-template, or guard function.** If a name is needed, thread it through as data from the actual request (sender, participants, retrieved source) — see the `conversation-context-engine.js` `buildRepairReply()` fix in this audit for the pattern (use `input.sender?.displayName`, never a literal name).
- **A curated index (e.g. `quran-verse-lookup/topic-index.js`'s `TOPIC_VERSE_INDEX`) may grow one entry at a time**, but each entry must independently re-verify against the deterministic store — it is never a shortcut around verification, and growth is not unconditional: an index approaching a size where most entries exist for a single past conversation is itself a 7.2-category-1 signal that a general lookup mechanism (fuzzy phrasing, reference parsing) is the actual gap.
- **Every regex/detector generalization must ship with both a positive test (the real failing case now passes) and a negative test (the previously-working narrower cases still pass, and adjacent unrelated phrasings are still correctly rejected)** — see `scripts/test-ordinal-followup-precision.mjs` for the shape: it asserts genuine ordinal-selection phrasings still resolve *and* that ordinary sentences merely containing an ordinal word do not.
- **A real conversation that exposed a general bug becomes exactly one fixture** (one `id`, multiple `checkpoints`), not one file per topic touched in that conversation. See §7.7.

### 7.4 Canonical taxonomy

Reconciles §1's 7 epistemic claim classes, `domain-core`'s 4 `certainty` levels (`server/domain-core/schemas.js`), and `knowledge-domains`' 12 `FACT_LAYER_LABELS` (`server/knowledge-domains/source-policy.js`). The mapping is implemented and drift-tested in `server/knowledge-domains/certainty-taxonomy.js`.

| §1 Epistemic claim class | `certainty` (domain-core) | `FACT_LAYER_LABELS` key(s) (knowledge-domains) | Confidence tier |
|---|---|---|---|
| Deterministic calculation | `methodological` | *(none — calculation-engine domains aren't covered by source-policy.js; see §7.5)* | high |
| Astronomical / calendar data | `factual` | *(none — same as above)* | high |
| Historical / textual fact | `factual` | `primary_text`, `primary_source`, `scholarly_consensus`, `historical_doctrine` | high |
| *(web-attributed factual claim — new in knowledge-domains, not in §1's original 7)* | `factual` | `web_source` | high |
| Traditional interpretation | `interpretive` | `tradition_belief`, `later_interpretation` | medium |
| Psychological possibility | `interpretive` | *(closest: `symbolic_interpretation`, `atlas_synthesis` — psychological-possibility language belongs to the personal-engine guards in §3, not the citation domains)* | medium |
| Symbolic / model synthesis | `interpretive` | `symbolic_interpretation`, `atlas_synthesis` | medium |
| Uncertainty | `speculative` | `modern_claim`, `speculative_hypothesis`, `disputed_uncertain` | low |

Two of `domain-core`'s four `certainty` values (`factual` for calendar data, `methodological`) have no `FACT_LAYER_LABELS` counterpart. This is intentional, not a gap to close by force — see §7.5.

### 7.5 Migration recommendation: reconciling `domain-core` certainty with `source-policy.js` fact layers

**Recommendation: bridge, do not merge.** The two vocabularies exist for different domain shapes: `domain-core`'s `certainty` was designed for **calculation-engine** domains (numerology, astrology — a deterministic formula produces a number, and the interesting epistemic question is "how was this derived", i.e. `methodological` vs `factual`). `source-policy.js`'s `FACT_LAYER_LABELS` was designed for **citation/retrieval** domains (religion, mythology, history — the interesting epistemic question is "what kind of source backs this claim"). Forcing a lossy 1:1 rename would either strip `FACT_LAYER_LABELS` of the precision citation domains need, or invent calculation-flavored labels no retrieval domain would ever use.

Implemented instead: `server/knowledge-domains/certainty-taxonomy.js` —

- `CERTAINTY_LEVELS` is now a **real runtime export** from `domain-core/schemas.js` (previously only a JSDoc type comment), so it can be validated against instead of re-typed.
- `FACT_LAYER_TO_CERTAINTY` maps every one of the 12 `FACT_LAYER_LABELS` keys to one of the 4 `certainty` levels (§7.4's table, in code).
- `certaintyForFactLayer()` / `confidenceForFactLayer()` are the read API for anything that needs a coarse cross-subsystem comparison (a future cross-domain contradiction checker, an admin dashboard).
- **Zero existing call sites changed.** `domain-core` remains flagged off by default (`ATLAS_DOMAIN_CORE`); `knowledge-domains` call sites are untouched. This is purely additive.
- **Drift is tested, not just documented**: `scripts/test-certainty-taxonomy.mjs` fails closed if a new `FACT_LAYER_LABELS` key is ever added without a mapping, or if a mapping points at an invalid certainty value.
- **Future consolidation path** (not required now): if `domain-core` is ever enabled for a citation/retrieval domain (none currently are — its one adapter is numerology, a calculation domain), that adapter should use `FACT_LAYER_TO_CERTAINTY` to populate `EvidenceItem.certainty` from whatever fact layer its retrieval produced, rather than inventing a third mapping.

### 7.6 Cross-domain applicability

This policy (7.1–7.3) applies **identically** across every knowledge domain in `DOMAIN_REGISTRY` (`server/knowledge-domains/registry.js`): `quran`, `comparative_religion`, `mythology`, `esotericism`, `hermeticism_alchemy`, `ancient_traditions` (history), `numerology_symbolic`, `general_web` (current/general factual knowledge, including science). No domain is "softer" and gets a relaxed fail-closed rule, a skipped disagreement check, or an exempted theology/agreement-bias/generalization guard — enforced structurally by `SOURCE_POLICY[domain].failClosed` defaulting to `true` for every entry (§7.7 tests this directly) and by `reasoning-guards.js`'s directives applying to the whole `RELIGION_HISTORY_DOMAINS` family, not a hand-picked subset.

This section is complementary to, not a replacement for, §3's domain-specific guards: §3 covers the **personal/symbolic** engines (astrology, numerology-as-reading, tarot, dream, abjad/esma) where the epistemic risk is over-claiming about *this specific user's life*. §7 covers the **citation/retrieval** domains where the epistemic risk is over-claiming about *external, checkable facts*. A message can trigger both — the knowledge-domain routing block runs first specifically so a factual question is never misrouted into a §3 personal-engine reply.

### 7.7 Acceptance criteria and tests

Production-safe requires every row below to pass. All are automated; none require a live model call to verify (they check routing, labeling, and structural properties — not generated prose, since generated-prose assertions are inherently flaky and this environment has no `OPENAI_API_KEY` by default).

| Criterion | Verified by |
|---|---|
| Every knowledge domain fails closed by default; none is exempt | `scripts/test-certainty-taxonomy.mjs` |
| Every `FACT_LAYER_LABELS` key has a certainty mapping (no drift) | `scripts/test-certainty-taxonomy.mjs` |
| Every domain's declared fact layers are real `FACT_LAYER_LABELS` keys | `scripts/test-certainty-taxonomy.mjs` |
| Theology/agreement-bias/generalization guard directives fire for the full religion-history domain family, and agreement-bias/generalization also fire independent of domain | `scripts/test-reasoning-guards.mjs` |
| A source-disagreement signal in a web-retrieved answer produces a visible `disputed_uncertain` note, not a silent single-sided answer | `scripts/test-reasoning-guards.mjs` |
| Guard directives actually reach the web-search-model's own instructions (not just the general LLM path) | `scripts/test-reasoning-guards.mjs` (mocked-fetch integration check) |
| A factual/historical/comparative-religion question is never misrouted to the symbolic engine, including after prior symbolic-context history in the same conversation | `scripts/test-religion-history-routing.mjs`, `scripts/test-conversation-regression-fixtures.mjs` |
| An unresolvable Qur'an citation request stays fail-closed (no invented verse) | `scripts/test-religion-history-routing.mjs`, `scripts/test-quran-citation-verification.mjs`, `scripts/test-quran-semantic-verification.mjs` |
| Continuity/follow-up resolution never hijacks an unrelated factual question via a stale engine session (the ordinal-follow-up bug class) | `scripts/test-ordinal-followup-precision.mjs` |
| No real individual's name is hardcoded into general-purpose routing/reply logic; third-party-name suppression is driven by live conversation data | `scripts/test-self-profile-name-generalization.mjs` |
| A real multi-turn conversation that exposed a general bug is captured as exactly one fixture with multiple checkpoints, not per-topic files | `scripts/test-conversation-regression-fixtures.mjs` (`religion-history-continuity-001`) |

**Before adding a new knowledge domain or fact layer:** run `npm run test:knowledge-domains`, `node scripts/test-certainty-taxonomy.mjs`, and `node scripts/test-reasoning-guards.mjs`; all three must pass, and any new `FACT_LAYER_LABELS` key must get a `FACT_LAYER_TO_CERTAINTY` entry in the same change.

### 7.8 Enforcement points (extends §6)

7. Knowledge-domain classification precedence (`atlas-message-service.js`'s knowledge-domain block, runs before symbolic-context/numerology/tarot/dream)
8. Per-domain source policy + fail-closed retrieval (`knowledge-domains/source-policy.js`, `web-search-provider.js`)
9. Reasoning guards — theology/agreement-bias/generalization/source-disagreement (`knowledge-domains/reasoning-guards.js`), wired into both the general LLM path and the web-backed domain handler
10. Certainty-taxonomy drift guard (`knowledge-domains/certainty-taxonomy.js` + `scripts/test-certainty-taxonomy.mjs`)
11. Conversation-fixture regression harness (`scripts/lib/conversation-fixture-runner.mjs`) for capturing real multi-turn failures without new production code paths

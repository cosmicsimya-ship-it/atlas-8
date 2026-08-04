# ATLAS Domain Intelligence Platform — Master Architecture

> **ARCHIVED / SUPERSEDED (2026-08-04)**  
> Platform architecture authority has moved to the canonical Master Spec:  
> [`docs/architecture/ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md`](../architecture/ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md)  
> Disposition: **Merge → Archive** (see [`DOC_CONSOLIDATION.md`](../architecture/DOC_CONSOLIDATION.md)).  
> Unique historical notes below (depth L0–L4, engine catalog, professional JSON) are retained for reference only.  
> This file does **not** authorize implementation changes.

**Status:** Archived (historical) — previously normative platform architecture (design)  
**Document id:** `atlas-domain-platform-master-v1`  
**Date:** 2026-08-03  
**Depends on:** `current-state-audit.md`  
**Preserves:** ADR-001…005, Symbolic Platform RFCs, Qur’an data architecture, frozen methodology ids  

**Child docs:**

| Doc | Role |
|-----|------|
| `ENGINE_CONTRACT.md` | Universal engine interface + structured output |
| `METHODOLOGY_REGISTRY.md` | Methodology lifecycle |
| `SOURCE_REGISTRY.md` | Source integrity |
| `SECURITY_AND_EPISTEMIC_POLICY.md` | Safety + claim classes |
| `ROADMAP.md` | Phased backlog + migration |

**Related ADRs:** ADR-006…009 (domain platform)

---

## 1. Product definition

Atlas is a **Domain Intelligence Platform**: structured intake → methodology-aware deterministic calculation → evidence-typed interpretation → optional cross-domain synthesis → channel-specific composition.

It is **not** a general-purpose chatbot whose primary value is fluent prose.

Three product surfaces share one analysis kernel:

1. **Consumer** — conversational Web / Telegram  
2. **Professional** — methodology choice, traces, clients, templates  
3. **Platform / API** — structured JSON for third parties / white-label  

---

## 2. Layered architecture (target)

```text
User / Client
     ↓
Channel Adapter          (existing: channel-adapters.js)
     ↓
Request Normalization    (NEW domain-core)
     ↓
Intent and Domain Router (NEW; wraps per-engine detectors initially)
     ↓
Data Requirement Resolver
     ↓
Methodology Resolver
     ↓
Deterministic Calculation Engines   (existing engines via adapters)
     ↓
Evidence and Source Layer
     ↓
Interpretation Engines              (engine-local first; shared policies)
     ↓
Cross-Domain Synthesis Engine       (evolve cross-layer-synthesis)
     ↓
Safety and Epistemic Guard
     ↓
Response Composer                   (channel + depth + audience)
     ↓
Web / Telegram / API / Voice / PDF
```

**Normative rule:** No layer may invent another layer’s outputs. Safety never mutates calculation values.

---

## 3. Atlas Domain Core

**Name:** `Atlas Domain Core`  
**Code root (proposed):** `server/domain-core/`

### 3.1 Responsibilities

| Component | Duty |
|-----------|------|
| Request Normalizer | Message → `NormalizedDomainRequest` |
| Domain Router | Select engine(s); accept/reject examples per domain |
| Data Requirement Resolver | Required/optional fields; memory reuse; clarify minimally |
| Methodology Resolver | User / professional / default / data-fit selection + reason |
| Engine Registry | Discover engines by `engineId` + version |
| Methodology Registry | Load methodology descriptors |
| Source Registry | Citeable sources only |
| Depth Resolver | Map user language → L0–L4 |
| Context Resolver | Typed memory classes; subject identity |
| Analysis Orchestrator | Run engines with isolation + timeouts |
| Response Composer | Structured result → channel rendering |
| Evidence / Uncertainty | Attach claim classes and certainty |

### 3.2 Relationship to Symbolic Platform RFCs

| Symbolic RFC concept | Domain Core mapping |
|----------------------|---------------------|
| EngineDescriptor / ExecutableEngine | `AtlasDomainEngine` (+ adapter) |
| EngineResult envelope | `StructuredAnalysisOutput` (superset) |
| Methodology registry | Shared registry covering **all** domains |
| Soft synthesis inside symbolic orchestrator | Cross-Domain Synthesis (must not override source engines) |
| Legacy symbolic layers | Adapters; keep `/api/symbolic-analysis` wire until RFC-007 complete |

---

## 4. Engine catalog (long-term)

| engineId (proposed) | Domain | Near-term source |
|---------------------|--------|------------------|
| `atlas-numerology` | numerology | `numerology-engine` |
| `atlas-tarot` | tarot | `tarot-engine` |
| `atlas-dream` | dream | `dream-engine` |
| `atlas-symbolic-latin` | abjad-motif | `symbolic-analysis` ebced |
| `atlas-abjad-classical` | abjad | classical runner |
| `atlas-esma` | esma | esma runners |
| `atlas-daily-time` | calendar/time | `daily-analysis` |
| `atlas-ephemeris` | astronomy | `atlas-ephemeris.js` |
| `atlas-astrology` | astrology | NEW natal + existing flow bridge |
| `atlas-cross-domain-synthesis` | synthesis | `cross-layer-synthesis` |
| `atlas-destiny-matrix` | destiny-matrix | NEW (methodology-split) |
| `atlas-alchemy` | alchemy | NEW (replace placeholder) |
| `atlas-mythology` | mythology | NEW |
| `atlas-symbol-intelligence` | symbols | NEW shared graph |
| `atlas-quran-research` | quran | NEW on data architecture |
| `atlas-hadith-research` | hadith | NEW later |
| `atlas-name-linguistic` | linguistics | NEW |
| `atlas-face-symbolism` | face | gated; not physiognomy claims |
| `atlas-palm-symbolism` | palm | gated |
| `atlas-voice-intelligence` | voice | evolve audio-studio / live |

Status values: `active | limited | experimental | planned | deprecated | unavailable`.

---

## 5. Depth system (universal)

| Level | Name | Behavior |
|-------|------|----------|
| L0 | Result | Direct answer only |
| L1 | Brief | Result + core meaning |
| L2 | Detailed | Calc + themes + strengths/shadows |
| L3 | Professional | Methodology, intermediate traces, contradictions |
| L4 | Research | Sources, school comparison, raw traces, technical notes |

Map existing engine depths: numerology/tarot/dream SHORT/STANDARD/DEEP ≈ L1/L2/L3. Introduce L0/L4 without breaking defaults.

---

## 6. Professional customization layer

Designed now; implemented FAZ 9.

```json
{
  "professionalId": "",
  "brandName": "",
  "domains": [],
  "preferredMethodologies": {},
  "terminology": {},
  "tone": {},
  "reportTemplates": [],
  "disclaimers": [],
  "enabledEngines": [],
  "disabledEngines": [],
  "customRules": [],
  "customKnowledgeSources": []
}
```

**Hard rules:** Custom methodology cannot silently replace classical defaults. Safety/epistemic policies are not disableable. White-label may rebrand presentation, not falsify methodology identity.

---

## 7. Multi-subject model

```json
{
  "subjectId": "",
  "ownerUserId": "",
  "displayName": "",
  "relationshipToOwner": "",
  "birthData": {},
  "names": [],
  "analysisHistory": [],
  "consent": {},
  "notes": []
}
```

Owner self-profile ≠ client record. Synastry / relationship analyses reference two subjectIds + joint analysis id.

---

## 8. API shape (future)

```text
POST /api/v1/analyze
POST /api/v1/astrology/natal
POST /api/v1/numerology/full
POST /api/v1/tarot/spread
POST /api/v1/dreams/interpret
POST /api/v1/abjad/calculate
POST /api/v1/synthesis
GET  /api/v1/methodologies
GET  /api/v1/engines
GET  /api/v1/analyses/:id
```

Until v1 ships: keep `/api/chat`, `/api/symbolic-analysis`, `/api/personal-analysis`. Adapters emit StructuredAnalysisOutput internally first.

---

## 9. Versioning

```text
engineVersion: semver or atlas-*-engine-vN
methodologyId: stable kebab id
rulesetVersion: date or semver string
responseSchemaVersion: integer/semver
```

Stored analyses must retain versions used. Recompute is explicit opt-in.

---

## 10. Observability

Every analysis emits an audit record (PII-minimized):

```json
{
  "analysisId": "",
  "requestId": "",
  "userId": "",
  "subjectIds": [],
  "engineIds": [],
  "methodologyIds": [],
  "calculationTraceIds": [],
  "sourceIds": [],
  "startedAt": "",
  "completedAt": "",
  "durationMs": 0,
  "warnings": [],
  "errors": []
}
```

Align with existing request-timing phases.

---

## 11. Commercial tiers (architectural hooks only)

Free / Personal / Professional / Studio / Enterprise — see product membership doc. Domain Core must support capability flags without changing calculation correctness by tier (same rule as Symbolic Operational Appendix).

---

## 12. Success metrics

- Correct domain routing  
- Correct required data / no invented inputs  
- Deterministic calculation accuracy  
- Explicit methodology awareness  
- Source integrity  
- Epistemic clarity  
- Contradiction handling  
- Subject identity accuracy  
- Channel parity of **structured** results  
- Clean addition of new engines without breaking peers  

---

## 13. Non-goals for near term

- Implementing all §8 engines at once  
- Replacing LLM conversation entirely  
- Shipping external public API without auth/quota  
- Enabling face/palm as character/crime/health predictors  
- Inventing Qur’an/Hadith corpora  

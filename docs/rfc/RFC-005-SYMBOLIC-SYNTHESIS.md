# RFC-005 — Symbolic Synthesis Engine

**Status:** Normative  
**Parent:** [ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md](../ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md)  
**Document id:** `atlas-rfc-005-symbolic-synthesis-v1`  
**Last updated:** 2026-07-31  
**Implementation status:** Spec only

---

## 1. Purpose

Kaynak motor sonuçlarını **değiştirmeden** ortak tema, ayrışma, çelişki, kör nokta ve provenance üreten üst motor **Symbolic Synthesis Engine** sözleşmesini tanımlar.

---

## 2. Scope

- Non-mutation / non-fabrication rules
- Synthesis output fields
- Confidence for synthesis
- Relationship to legacy `synthesizePatterns()` and `server/cross-layer-synthesis`
- Engine provenance requirements

---

## 3. Out of Scope

- Rewriting daily-analysis or astrology internal engines
- Quran text invention (cross-layer quran-safety remains separate)
- Persistent memory writes

---

## 4. Definitions

| Term | Meaning |
|------|---------|
| **Source engine** | Any non-synthesis engine whose EngineResult is an input |
| **Synthesis** | Comparative/aggregative reading across source results |
| **Contradiction** | Explicit tension between source claims (not forced resolution) |
| **Blind spot** | Material theme/input area no runnable engine covered |
| **Provenance** | Mapping from synthesis statement → source engineIds + evidenceIds |

---

## 5. Normative Rules

1. Synthesis **MUST NOT** compute domain letter sums, chart positions, or catalog matches itself.
2. Synthesis **MUST NOT** mutate source `result`, `evidence`, `assessment`, or `confidence`.
3. Synthesis **MUST NOT** invent missing engine results or fill skipped engines with guessed content.
4. Synthesis **MUST NOT** present one engine’s output as another’s.
5. Synthesis **MUST** list `engineProvenance` for mainTheme and each divergent/contradiction item.
6. Synthesis **MUST** run only on engines with `execution.status` in `complete|partial` unless explicitly analyzing gaps (blind spots MAY reference skipped).
7. If fewer than two successful source engines, synthesis **MUST** set limited confidence and avoid forced convergence claims (parity with current soft uncertainty).
8. Synthesis overall product status **MUST NOT** override source cards in UI — sources remain visible.
9. Safety Layer applies to synthesis prose; calculations of sources untouched.

---

## 6. Architecture

### 6.1 Current analogs

| Current | Behavior | Target |
|---------|----------|--------|
| `orchestrator.synthesizePatterns` | Theme count ≥2 ⇒ convergence; soft opposites ⇒ tensions | Move into `symbolic-synthesis` engine |
| `compose.js` merged sections | Single narrative across layers | Projection may still offer overview, but per-engine cards are primary long-term |
| `server/cross-layer-synthesis` | Chat/daily relationship + certainty | Adjacent; shared utilities optional later |

### 6.2 Placement

```
Execution Orchestrator
  → run source engines (isolated)
  → collect EngineResult[]
  → run symbolic-synthesis (consumer)
  → UI Projection (sources + synthesis card)
```

### 6.3 Proposed modules

```
server/symbolic-platform/engines/symbolic-synthesis/
  index.ts
  detect-themes.ts
  detect-divergences.ts
  detect-contradictions.ts
  blind-spots.ts
  provenance.ts
  confidence.ts
```

---

## 7. Data Model

```ts
type SynthesisFinding = {
  id: string;
  statement: string; // user-safe
  engineIds: string[];
  evidenceIds: string[];
  relationship?:
    | 'supports'
    | 'echoes'
    | 'diverges'
    | 'tensions'
    | 'contextual';
};

type SynthesisExtension = {
  mainTheme: string | null;
  supportingEngines: string[];
  divergentFindings: SynthesisFinding[];
  contradictions: SynthesisFinding[];
  blindSpots: Array<{
    id: string;
    area: string;
    reason: string; // e.g. engine planned / input missing
    relatedEngineIds?: string[];
  }>;
  realityCheck: string[]; // grounding reminders, not debunking theater
  synthesisConfidence: import('../contracts/confidence').ConfidenceModel;
  engineProvenance: Array<{
    claimId: string;
    engineId: string;
    evidenceIds: string[];
  }>;
};

// Placed at EngineResult.result.extension.symbolicSynthesis
```

`methodologyId`: `atlas-symbolic-synthesis-v1`.

---

## 8. Algorithmic duties (normative outcomes, not formulas)

| Duty | Required output behavior |
|------|--------------------------|
| Common themes | Detect overlapping theme tokens/labels across sources |
| Divergent findings | Surface themes present in only one source |
| Contradictions | Visible tensions; MUST NOT “resolve” into single fate |
| Support relations | `supportingEngines` for mainTheme |
| Blind spots | Skipped/planned/failed material engines called out |
| Reality check | Standard disclaimers + data-gap notes |
| Synthesis confidence | Emphasize `crossEngineAgreement`, lower when n<2 |
| Provenance | Every main claim traceable |

---

## 9. Confidence specifics

Synthesis `confidence.internal.axes`:

- `calculationDeterminism`: high if pure deterministic theme algebra; lower if LLM assist used
- `crossEngineAgreement`: primary signal
- `interpretationConfidence`: typically medium/low
- `inputCompleteness`: derived from fraction of requested engines that completed

`metadata.llmUsed` MUST be true if any generative assist used; default v1 SHOULD be deterministic like current `synthesizePatterns`.

---

## 10. API Impact

- `PlatformRunReport.synthesis` holds synthesis `EngineResult`.
- Legacy adapter maps synthesis → `trace.patterns` + compose section bodies (`pattern`, `tensions`, …).

---

## 11. UI Impact

Dedicated synthesis card:

- title: “Sembolik Sentez”
- shows supporting engines as names, not technical dumps
- contradictions in separate subsection
- CTA: jump to source engine cards
- NEVER replaces source cards

---

## 12. Method Disclosure

Must state:

- which engines were included
- which were skipped
- that synthesis does not recompute source math
- alternatives: viewing engines separately

---

## 13. Examples

```json
{
  "mainTheme": "sabır / içe dönüş motiflerinin örtüşmesi",
  "supportingEngines": ["latin-number-motif", "esma-matching"],
  "divergentFindings": [
    {
      "id": "d1",
      "statement": "Esma katmanı niyet temalarını öne çıkardı; latin motif tek başına bu temayı üretmedi.",
      "engineIds": ["esma-matching"],
      "evidenceIds": ["ev-esma-1"],
      "relationship": "diverges"
    }
  ],
  "contradictions": [],
  "blindSpots": [
    {
      "id": "b1",
      "area": "doğum haritası",
      "reason": "astrology engine planned",
      "relatedEngineIds": ["astrology"]
    }
  ],
  "realityCheck": [
    "Sentez kesin kader hükmü değildir.",
    "Kaynak motor kartları birincil kanıttır."
  ],
  "synthesisConfidence": {},
  "engineProvenance": [
    { "claimId": "mainTheme", "engineId": "latin-number-motif", "evidenceIds": ["ev-latin-themes"] },
    { "claimId": "mainTheme", "engineId": "esma-matching", "evidenceIds": ["ev-esma-1"] }
  ]
}
```

---

## 14. Migration Impact

1. Keep `synthesizePatterns` in legacy orchestrator until Phase 10.  
2. Feature flag `ATLAS_SYMBOLIC_SYNTHESIS_ENGINE` dual-runs and snapshot-compares pattern strings.  
3. Remove in-orchestrator synthesis only after parity gate.  
4. Do not merge with `cross-layer-synthesis` chat bridge in the same release.

---

## 15. Test Criteria

| Test | Expect |
|------|--------|
| non_mutation | Deep freeze source results; synthesis cannot change them |
| no_fabrication | Skipped astrology not cited as producing a chart claim |
| provenance_complete | mainTheme and contradictions have provenance |
| low_n_engines | n<2 ⇒ uncertainty limitations present |
| safety_prose | Forbidden certainty patterns cleaned |
| adapter_parity | patterns.convergences/tensions mappable |

---

## 16. Acceptance Criteria

- [ ] Non-calculation / non-mutation / non-fabrication / non-misattribution rules normative  
- [ ] Output fields match Master list  
- [ ] Provenance required  
- [ ] UI non-override rule stated  
- [ ] Relation to legacy + cross-layer-synthesis documented  

---

## 17. Rejected Alternatives

| Rejected | Why |
|----------|-----|
| Synthesis overwrites source summaries | Destroys auditability |
| Hidden merge into one “answer” | Violates methodology isolation |
| Generative synthesis as v1 default | Harder to test; raise determinism debt |

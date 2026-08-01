# RFC-004 — Confidence & Evidence

**Status:** Normative  
**Parent:** [ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md](../ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md)  
**Document id:** `atlas-rfc-004-confidence-evidence-v1`  
**Last updated:** 2026-07-31  
**Implementation status:** Spec only  
**Aligns with:** ADR-003

---

## 1. Purpose

Tek etiketli `high|medium|low` güven modelini terk ederek **çok boyutlu Confidence** ve izlenebilir **Evidence** sözleşmelerini tanımlar. Kullanıcıya gösterilen güven ile iç sistem teşhis verisini ayırır.

---

## 2. Scope

- Confidence axes & scoring bands
- User-facing vs internal confidence
- Relationship to MethodologyAssessment (ADR-003)
- Evidence kinds, linkage, projection rules
- Cross-engine agreement axis (for synthesis context)

---

## 3. Out of Scope

- Domain-specific numeric formulas for classical totals
- ML calibration pipelines
- Changing calculated totals based on confidence

---

## 4. Definitions

| Term | Meaning |
|------|---------|
| **Confidence axis** | Named dimension scored independently |
| **User-facing confidence** | Localized, non-overclaiming summary derived for UI |
| **Internal confidence** | Numeric/diagnostic detail for audit, gating, synthesis |
| **EvidenceItem** | Atomic justification object linked to result claims |
| **Assessment** | ADR-003 methodology quality axes (orthogonal but related) |

---

## 5. Normative Rules

1. New engine results **MUST** include `confidence` object; scalar primary `confidence` **MUST NOT**.
2. Confidence **MUST NOT** rewrite `calculatedData` / deterministic outputs.
3. Every material interpreted claim **SHOULD** reference ≥1 `evidenceId`.
4. `modelInference` evidence **MUST** set `llmUsed` metadata appropriately and lower `calculationDeterminism` / raise `ambiguityLevel` as applicable.
5. User-facing label **MUST NOT** imply fate certainty; prefer “veri bütünlüğü / yöntem netliği” framing.
6. `crossEngineAgreement` **MUST** be `null` on single-engine runs; Synthesis Engine populates it for synthesis results.
7. ADR-003 `assessment` remains mandatory and **MUST NOT** be replaced by confidence axes.
8. Legacy adapters **MAY** derive a deprecated scalar for old clients only (RFC-007); new bodies **MUST NOT** reintroduce it as authority.

---

## 6. Architecture

### 6.1 Current state

- `normalize.js`: `confidence: 'high'|'medium'|'low'|'none'`
- `ebced-runner`: medium if `letterCount >= 2` else low
- v2 path: `metadata.assessment` (ADR-003) additive; scalar still on normalized layer

### 6.2 Target split

```
assessment     → methodology / orthography / match quality (ADR-003)
confidence     → run quality & epistemic dimensions (this RFC)
evidence[]     → why a claim exists
```

---

## 7. Data Model — Confidence

```ts
type ConfidenceAxis =
  | 'inputCompleteness'
  | 'methodologyCertainty'
  | 'calculationDeterminism'
  | 'sourceReliability'
  | 'interpretationConfidence'
  | 'ambiguityLevel'
  | 'crossEngineAgreement';

/** 0 = worst / most ambiguous; 1 = best / least ambiguous
 *  EXCEPT ambiguityLevel where 0 = clear, 1 = highly ambiguous
 */
type AxisScore = {
  axis: ConfidenceAxis;
  score: number | null; // 0..1 or null if N/A
  band: 'high' | 'medium' | 'low' | 'none' | 'not-applicable';
  rationale: string; // short, may be internal
};

type UserFacingConfidence = {
  /** Composite label for compact UI — NEVER sole signal */
  overallBand: 'high' | 'medium' | 'low' | 'none';
  headline: string; // e.g. "Girdi yeterli; yorum belirsizliği korunuyor"
  axisSummaries: Array<{
    axis: ConfidenceAxis;
    label: string; // localized human label
    band: AxisScore['band'];
  }>;
};

type ConfidenceModel = {
  schemaVersion: 'atlas-confidence-v1';
  userFacing: UserFacingConfidence;
  internal: {
    axes: AxisScore[];
    compositeScore: number | null; // optional weighted; not shown by default
    notes?: string[];
  };
};
```

### 7.1 Axis semantics

| Axis | Meaning | Typical high | Typical low |
|------|---------|--------------|-------------|
| `inputCompleteness` | Required+material optional fields present | Full profile | Name-only minimal |
| `methodologyCertainty` | Selected methodology unambiguous & implemented | Frozen ruleset | Experimental / disputed |
| `calculationDeterminism` | Same input ⇒ same calc | Pure table sum | Stochastic / LLM |
| `sourceReliability` | Catalog/table provenance trust | Curated versioned catalog | Ad-hoc heuristic |
| `interpretationConfidence` | Soft reading quality | Well-supported themes | Speculative prose |
| `ambiguityLevel` | Competing readings / orthography disputes | Low ambiguity | High dispute |
| `crossEngineAgreement` | Peer engines converge | Shared themes | Contradictions |

### 7.2 Suggested derivation (non-binding formulas)

Engines MAY use different weights; MUST document in engine descriptor `confidenceModel`.

Example latin motif:

- `calculationDeterminism`: 1.0 if pure table
- `methodologyCertainty`: high for v2 production; lower if unsupported chars excluded
- `interpretationConfidence`: medium/low (motif reading is interpretive)
- `ambiguityLevel`: rises when unsupported characters traced/excluded

---

## 8. Data Model — Evidence

```ts
type EvidenceKind =
  | 'deterministicCalculation'
  | 'sourceReference'
  | 'normalizedInput'
  | 'derivedValue'
  | 'matchedRule'
  | 'detectedPattern'
  | 'modelInference'
  | 'userProvidedContext';

type EvidenceItem = {
  evidenceId: string;
  kind: EvidenceKind;
  label: string; // user-safe short label
  detail?: string; // user-safe; optional
  /** Machine payload for trace/reproducibility — not default UI */
  payload?: Record<string, unknown>;
  relatedSectionIds?: string[];
  relatedClaimIds?: string[];
  confidenceHint?: 'supports' | 'weakens' | 'contextual';
};
```

### 8.1 Kind usage guide

| Kind | Example |
|------|---------|
| `deterministicCalculation` | Letter values sum → total |
| `sourceReference` | Catalog entry id / ruleset citation |
| `normalizedInput` | NFC form of name used |
| `derivedValue` | reducedDigit from total |
| `matchedRule` | Theme overlap rule fired |
| `detectedPattern` | Soft opposite themes in synthesis |
| `modelInference` | LLM-assisted image caption (future) |
| `userProvidedContext` | User intention string |

---

## 9. Assessment vs Confidence

| Concern | Field home |
|---------|------------|
| Transliteration certainty | `assessment.transliterationCertainty` |
| Orthographic dispute | `assessment.orthographicDisputeLevel` |
| Esma match strength | `assessment.matchStrength` |
| Interpretation limitation strings | `assessment.interpretationLimitations` |
| Input completeness | `confidence.internal.axes` |
| Determinism | `confidence…calculationDeterminism` |
| Cross-engine agreement | `confidence…crossEngineAgreement` |

UI MAY show both panels; MUST NOT collapse into one “güven: orta”.

---

## 10. API Impact

- `EngineResult.confidence` and `evidence` required.
- Legacy response: adapter may omit multi-axis until frontend ready; MUST NOT drop ADR assessment on v2 path.

---

## 11. UI Impact

- Default: headline + 3–5 axis chips with human labels  
- Evidence: expandable “Kanıt” list using `label`/`detail` only  
- Advanced: payload hidden  

---

## 12. Method Disclosure

Uncertainty areas in disclosure SHOULD align with high `ambiguityLevel` and non-null assessment limitations.

---

## 13. Examples

```ts
const confidence: ConfidenceModel = {
  schemaVersion: 'atlas-confidence-v1',
  userFacing: {
    overallBand: 'medium',
    headline: 'Hesap deterministik; sembolik yorum belirsizliği korunuyor',
    axisSummaries: [
      { axis: 'calculationDeterminism', label: 'Hesap tutarlılığı', band: 'high' },
      { axis: 'interpretationConfidence', label: 'Yorum güveni', band: 'low' },
      { axis: 'ambiguityLevel', label: 'Belirsizlik', band: 'medium' },
    ],
  },
  internal: {
    axes: [
      { axis: 'inputCompleteness', score: 0.7, band: 'medium', rationale: 'intention absent' },
      { axis: 'methodologyCertainty', score: 0.9, band: 'high', rationale: 'v2 production' },
      { axis: 'calculationDeterminism', score: 1, band: 'high', rationale: 'pure table' },
      { axis: 'sourceReliability', score: 0.8, band: 'high', rationale: 'versioned latin table' },
      { axis: 'interpretationConfidence', score: 0.35, band: 'low', rationale: 'motif reading' },
      { axis: 'ambiguityLevel', score: 0.4, band: 'medium', rationale: 'interpretive layer' },
      { axis: 'crossEngineAgreement', score: null, band: 'not-applicable', rationale: 'single engine' },
    ],
    compositeScore: 0.62,
  },
};
```

---

## 14. Migration Impact

| Legacy | Target |
|--------|--------|
| `normalized.confidence: 'medium'` | Adapter-only; map roughly from axes if needed |
| No evidence array | Build evidence from `calculatedData` + method strings during extract |
| v2 assessment | Keep; do not merge into confidence |

---

## 15. Test Criteria

- Validator rejects scalar-only confidence as primary  
- All seven axes present (score may be null)  
- Evidence kinds enum enforced  
- `modelInference` implies metadata.llmUsed true when used  
- Safety: userFacing.headline contains no fate claims (safety tests)  

---

## 16. Acceptance Criteria

- [ ] Seven axes defined  
- [ ] User vs internal split mandatory  
- [ ] Evidence kinds match Master list  
- [ ] ADR-003 coexistence explicit  
- [ ] Confidence cannot mutate calculations  

---

## 17. Rejected Alternatives

| Rejected | Why |
|----------|-----|
| Keep scalar only | Misrepresents multi-axis uncertainty (ADR-003 context) |
| Single “trustScore” without axes | Opaque; fails disclosure duty |
| Evidence only in trace | Users never see justification |

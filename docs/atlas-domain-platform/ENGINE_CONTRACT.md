# ATLAS Domain Intelligence Platform — Engine Contract

**Status:** Normative  
**Document id:** `atlas-domain-platform-engine-contract-v1`  
**Date:** 2026-08-03  
**Parent:** [`docs/architecture/ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md`](../architecture/ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md) (canonical). Prior parent `MASTER_ARCHITECTURE.md` is archived.  
**Aligns with:** `docs/rfc/RFC-001-ENGINE-CONTRACT.md`, `RFC-003-RESULT-CONTRACT.md` (symbolic lineage)

---

## 1. Purpose

Define the universal contract every domain engine (or adapter wrapping an existing engine) must satisfy so chat, Web UI, Telegram, and future API share one calculation kernel.

---

## 2. Executable interface

```ts
type IntentMatch = {
  active: boolean;
  intent: string;
  confidence: 'high' | 'medium' | 'low';
  requiresSession?: boolean;
  rejectReason?: string | null;
};

type DataRequirement = {
  key: string;
  required: boolean;
  type: string;
  pii?: boolean;
  canReuseFromMemory?: boolean;
};

type MethodologyResolution = {
  methodologyId: string;
  rulesetVersion: string;
  selectionReason: string;
  alternatives?: string[];
};

type ValidationResult = {
  ok: boolean;
  missing: string[];
  warnings: string[];
  errors: string[];
};

interface AtlasDomainEngine {
  engineId: string;
  domain: string;
  version: string;
  status: 'active' | 'limited' | 'experimental' | 'planned' | 'deprecated' | 'unavailable';

  detectIntent(input: NormalizedDomainRequest): IntentMatch;
  getDataRequirements(input: NormalizedDomainRequest): DataRequirement[];
  validateInput(input: NormalizedDomainRequest): ValidationResult;
  resolveMethodology(input: NormalizedDomainRequest): MethodologyResolution;
  calculate(input: EngineInput): CalculationResult;
  interpret(input: InterpretationInput): InterpretationResult;
  getSources(result: CalculationResult): SourceReference[];
  getUncertainty(result: CalculationResult): UncertaintyAssessment;
  composeStructuredOutput(result: EngineResult): StructuredAnalysisOutput;
}
```

### Normative rules

1. `calculate` **MUST NOT** call an LLM for arithmetic/astronomy/calendar/card selection/letter values.  
2. `interpret` **MAY** use deterministic templates and/or LLM, but **MUST** consume `CalculationResult` only (no recompute).  
3. Missing inputs **MUST NOT** be invented; return validation failure or `skipped`.  
4. Engine failure **MUST NOT** crash sibling engines.  
5. Methodology swap **MUST NOT** be silent.  
6. Adapters over current JS engines are valid implementations of this contract.

---

## 3. NormalizedDomainRequest

```ts
type NormalizedDomainRequest = {
  requestId: string;
  channel: 'web' | 'telegram' | 'api' | 'voice' | 'internal';
  userId: string;
  conversationId: string;
  language: string;
  audience: 'consumer' | 'professional' | 'api';
  depthHint: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'auto';
  domainHint?: string | null;
  methodologyId?: string | null;
  subjectIds: string[];
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  extracted?: Record<string, unknown>;
  memorySnapshot?: Record<string, unknown>;
  consents?: Record<string, boolean>;
  metadata?: Record<string, unknown>;
};
```

Initial implementation may populate this from `NormalizedAtlasMessage` + per-engine extractors.

---

## 4. StructuredAnalysisOutput

Minimum fields (JSON product shape):

```json
{
  "schemaVersion": "1.0",
  "analysisId": "",
  "engineId": "atlas-numerology",
  "engineVersion": "2.0.0",
  "domain": "numerology",
  "intent": "full_birth_date_analysis",
  "methodology": {
    "id": "atlas-pythagorean-birth-v1",
    "rulesetVersion": "atlas-pythagorean-birth-rules-1.0.0",
    "selectionReason": "default_methodology_for_birth_date_analysis"
  },
  "input": {},
  "calculations": [],
  "findings": [],
  "patterns": [],
  "contradictions": [],
  "interpretations": [],
  "sources": [],
  "warnings": [],
  "uncertainty": {},
  "evidence": [],
  "rendered": {
    "text": "",
    "sections": []
  },
  "metadata": {
    "depth": "L2",
    "channel": "web",
    "durationMs": 0
  }
}
```

### Calculation item

```ts
type CalculationItem = {
  calcId: string;
  label: string;
  value: unknown;
  unit?: string;
  trace?: unknown;
  evidenceType: 'deterministic_calculation' | 'astronomical_data' | string;
};
```

### Evidence item

```ts
type EvidenceItem = {
  claim: string;
  evidenceType:
    | 'deterministic_calculation'
    | 'astronomical_data'
    | 'linguistic_fact'
    | 'historical_fact'
    | 'classical_source'
    | 'religious_text'
    | 'traditional_interpretation'
    | 'psychological_framework'
    | 'symbolic_interpretation'
    | 'model_synthesis'
    | 'user_memory'
    | 'user_statement'
    | 'inference';
  methodologyId?: string;
  calculationTraceId?: string;
  sourceIds?: string[];
  certainty?: 'factual' | 'methodological' | 'interpretive' | 'speculative';
};
```

---

## 5. Mapping from existing engines

| Current module | Adapter strategy |
|----------------|------------------|
| `numerology-engine` | Wrap `runNumerologyAnalysis` → fill calculations/findings; keep reply in `rendered.text` |
| `tarot-engine` | Wrap selection + `interpretSpread`; session id in metadata |
| `dream-engine` | Wrap `runDreamAnalysis` |
| `symbolic-analysis` | Map layer outcomes → multi-engine or multi-section result; preserve wire compatibility |
| `daily-analysis` | calculations only; interpretations empty/null |
| `atlas-ephemeris` | Pure calculation engine |
| `atlas-astrology-flow` | Temporary hybrid adapter: calc from ephemeris/daily; interpret via existing LLM bridge until natal engine exists |
| `cross-layer-synthesis` | Synthesis engine; must not mutate peer results |

---

## 6. Contract tests (required per engine)

1. Descriptor registration  
2. Intent accept/reject fixtures  
3. Missing input → no invent  
4. Golden calculation fixtures  
5. Methodology id stable on output  
6. Structured schema validation  
7. Safety phrases / forbidden claims where applicable  
8. Channel-agnostic calculation equality (web vs telegram vs api input shells)

---

## 7. Migration note

Until Domain Core lands, engines remain callable via `*-flow.js`. Adapters are additive. Chat pipeline may call adapters behind a feature flag without changing user-visible replies in FAZ 2.

# RFC-003 — Symbolic Result Contract

**Status:** Normative  
**Parent:** [ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md](../ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md)  
**Document id:** `atlas-rfc-003-result-contract-v1`  
**Last updated:** 2026-07-31  
**Implementation status:** Spec only  
**Aligns with:** ADR-001, ADR-003, Architecture Spec snapshots

---

## 1. Purpose

Platformdaki tüm motorların paylaştığı **EngineResult** sözleşmesini, partial/error davranışını, extension politikasını ve geriye dönük uyumluluk yöntemini tanımlar.

---

## 2. Scope

- Canonical `EngineResult` TypeScript interface
- Execution status semantics
- `result.extension` namespacing
- Missing input / partial / failed / retry behavior
- PlatformRunReport aggregation
- Mapping notes from legacy `userResult` + `trace.layers`

---

## 3. Out of Scope

- Confidence axis formulas (RFC-004)
- Synthesis-specific fields (RFC-005) beyond referencing extension namespace
- Wire format of legacy endpoint (RFC-007)

---

## 4. Definitions

| Term | Meaning |
|------|---------|
| **complete** | Engine finished intended computation with required outputs present |
| **partial** | Engine produced usable subset; some optional sub-results missing |
| **failed** | Engine attempted run but could not produce a reliable result |
| **skipped** | Engine not run (ineligible, disabled, unmet soft-deps, planned) |
| **PlatformRunReport** | Multi-engine orchestration response |

---

## 5. Normative Rules

1. Every engine invocation **MUST** yield exactly one `EngineResult`.
2. `assessment` **MUST** include ADR-003 four fields on every result including skipped/failed (use `null` / `not-applicable` / empty arrays as appropriate).
3. New primary responses **MUST NOT** expose scalar `confidence` as the authority signal (ADR-003).
4. `result.extension` keys **MUST** be namespaced; collisions across engines forbidden.
5. Missing required input ⇒ `skipped` (preferred) or `failed` with code `MISSING_REQUIRED_INPUT` — **MUST NOT** fabricate fields.
6. Partial results **MUST** list missing pieces in `warnings` or `limitations`.
7. Retry **MAY** use same `inputSummary` + new `executionId`; prior failed execution **MUST NOT** be overwritten in audit/snapshot stores.
8. Consumers **MUST** treat unknown `result.sections[].id` as opaque displayable content.
9. `trace` and detailed `audit` **MAY** be omitted from default client payloads (parity with `include_trace`).

---

## 6. Architecture

### 6.1 Legacy envelope vs EngineResult

| Legacy (`atlas-symbolic-analysis-v1`) | EngineResult |
|---------------------------------------|--------------|
| Single `userResult` for all layers | One result per engine + optional synthesis |
| `trace.layers[layerId]` | `engines[i]` + per-result `trace` |
| `normalized.confidence` scalar | `confidence` multi-axis object |
| `metadata.assessment` (v2, ebced-centric) | per-engine `assessment` |
| `methodDisclosure[]` flat | per-engine `methodDisclosure` |
| `version: atlas-symbolic-analysis-v1` | `engine.engineVersion` + platform report version |

### 6.2 Proposed modules

```
server/symbolic-platform/contracts/engine-result.ts
server/symbolic-platform/contracts/validate-engine-result.ts
server/symbolic-platform/layers/ui-projection/from-engine-result.ts
```

---

## 7. Data Model

```ts
type EngineExecutionStatus = 'complete' | 'partial' | 'failed' | 'skipped';

type ResultSection = {
  id: string;
  title: string;
  body: string;
};

/** ADR-003 — redefined here only by reference; identical shape required */
type MethodologyAssessment = {
  transliterationCertainty: number | null;
  orthographicDisputeLevel:
    | 'none'
    | 'low'
    | 'medium'
    | 'high'
    | 'not-applicable';
  matchStrength: number | null;
  interpretationLimitations: string[];
};

type WarningItem = {
  code: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  /** Optional evidence ids */
  relatedEvidenceIds?: string[];
};

type MethodDisclosure = {
  displayName: string;
  methodologyId: string;
  methodologyVersion: string;
  variantId?: string;
  disclaimer: string;
  usedInputs: Array<{ key: string; label: string }>;
  transforms: string[]; // human-readable
  uncertaintyAreas: string[];
  alternativeMethods: Array<{
    methodologyId?: string;
    label: string;
    available: boolean;
    experimental?: boolean;
  }>;
  isClassicalAbjad?: boolean;
  experimental?: boolean;
  /** Developer-only; stripped by default UI projection */
  developer?: Record<string, unknown>;
};

type EngineResult = {
  engine: {
    engineId: string;
    engineVersion: string;
    methodologyId: string;
    methodologyVersion: string;
  };
  execution: {
    executionId: string;
    startedAt: string;
    completedAt: string;
    status: EngineExecutionStatus;
    errorCode?: string | null;
    errorMessage?: string | null;
    attempt?: number; // 1-based retry counter
  };
  inputSummary: {
    /** Non-PII-heavy summary preferred for logs; full snapshotted separately */
    includedKeys: string[];
    missingKeys: string[];
    locale?: string;
  };
  result: {
    title: string;
    summary: string;
    sections: ResultSection[];
    /**
     * Namespaced engine payload, e.g.
     * { latinMotif: { totalSum, reducedDigit, tokenizedLetters } }
     */
    extension?: Record<string, unknown>;
  };
  evidence: import('./evidence').EvidenceItem[];
  assessment: MethodologyAssessment;
  confidence: import('./confidence').ConfidenceModel;
  methodDisclosure: MethodDisclosure;
  warnings: WarningItem[];
  limitations: string[];
  trace: Record<string, unknown>;
  audit: Record<string, unknown>;
  metadata: {
    llmUsed: boolean;
    fabricated: boolean;
    calculatedVsInterpretedSeparated: true;
    [key: string]: unknown;
  };
};

type PlatformRunReport = {
  platformVersion: string; // e.g. 'atlas-symbolic-platform-v1'
  ok: boolean;
  error: string | null;
  runId: string;
  engines: EngineResult[];
  synthesis?: EngineResult | null; // symbolic-synthesis engine output
  projection?: import('./ui').UIProjection;
  metadata: Record<string, unknown>;
};
```

---

## 8. Status semantics matrix

| Condition | status | errorCode (example) | result.summary |
|-----------|--------|---------------------|----------------|
| Success full | `complete` | null | Normal summary |
| Optional motherName absent | `complete` or `partial` | — | Note in limitations if material |
| Catalog empty match | `partial` or `complete` with empty selection | — | Empty-state copy |
| Missing required name | `skipped` | `MISSING_REQUIRED_INPUT` | Explain missing fields |
| Feature flag off | `skipped` | `ENGINE_DISABLED` | Not run |
| Planned engine | `skipped` | `ENGINE_PLANNED` | Roadmap copy — no fake reading |
| Exception / timeout | `failed` | `ENGINE_EXCEPTION` / `ENGINE_TIMEOUT` | Safe failure copy |
| Consent missing (platform) | run-level `ok: false` | `CONSENT_REQUIRED` | Parity with legacy |

---

## 9. Extension policy

```ts
// Allowed
result.extension = {
  latinMotif: { totalSum: 123, reducedDigit: 6, tokenizedLetters: [/*...*/] },
};

// Forbidden
result.extension = { totalSum: 123 }; // unnamespaced
result.extension = { esma: {...}, latinMotif: {...} }; // wrong engine owns both
```

Cross-engine synthesis reads peer results via Orchestrator `peerResults`, not by reaching into another engine’s extension as authority without provenance.

---

## 10. Error & retry behavior

```ts
type RetryPolicy = {
  maxAttempts: number; // default 1 for deterministic engines
  retryOn: Array<'ENGINE_TIMEOUT' | 'TRANSIENT_IO'>;
  /** Deterministic pure calc engines SHOULD set maxAttempts: 1 */
};
```

Rules:

- Deterministic CPU-only engines (latin, classical, esma match): **SHOULD NOT** retry on exception (bug surface).
- IO engines (image/document): **MAY** retry transient IO with new `executionId` / incremented `attempt`.
- Client retries **MUST** be idempotent with respect to user intent; server assigns new execution ids.

---

## 11. Backward compatibility

| Mechanism | Use |
|-----------|-----|
| Legacy Adapter | `PlatformRunReport` → `atlas-symbolic-analysis-v1` shape |
| `legacyLayerId` on descriptor | Maps engine → old layer key in trace emulation |
| Dual-write metadata | During flag rollout, populate both assessment locations if required by old clients |
| Deprecation headers | Operational Appendix |

Stored snapshots remain immutable; readers use Version Compatibility Layer.

---

## 12. API Impact

- Future platform endpoint returns `PlatformRunReport`.
- Legacy endpoint continues returning `SymbolicAnalysisResponse` (`src/types/symbolic-analysis.ts`) via adapter.
- Breaking client change requires API version bump (Operational Appendix).

---

## 13. UI Impact

Projection Layer maps:

- `execution.status` → status chip  
- `result.*` → body  
- `methodDisclosure` → “Yöntemi gör”  
- `confidence` user slice → güven  
- `evidence` → kanıt listesi (humanized)  

Raw JSON inspector behind explicit advanced toggle only (optional, off by default).

---

## 14. Method Disclosure

`developer` sub-object stripped unless `include_developer_disclosure=true` (admin/debug). User fields always localized labels.

---

## 15. Examples

### 15.1 Skipped planned engine

```json
{
  "engine": {
    "engineId": "astrology",
    "engineVersion": "0.0.0",
    "methodologyId": "astrology-placeholder-v0",
    "methodologyVersion": "0.0.0"
  },
  "execution": {
    "executionId": "…",
    "startedAt": "…",
    "completedAt": "…",
    "status": "skipped",
    "errorCode": "ENGINE_PLANNED"
  },
  "inputSummary": { "includedKeys": ["name", "birthDate"], "missingKeys": [] },
  "result": {
    "title": "Astroloji",
    "summary": "Bu motor yol haritasındadır; sahte çıktı üretilmedi.",
    "sections": []
  },
  "evidence": [],
  "assessment": {
    "transliterationCertainty": null,
    "orthographicDisputeLevel": "not-applicable",
    "matchStrength": null,
    "interpretationLimitations": ["Motor henüz uygulanmadı"]
  },
  "confidence": { "userFacing": { "label": "none", "axes": {} }, "internal": {} },
  "methodDisclosure": {
    "displayName": "Astrology Engine",
    "methodologyId": "astrology-placeholder-v0",
    "methodologyVersion": "0.0.0",
    "disclaimer": "Planlandı; çalıştırılmadı.",
    "usedInputs": [],
    "transforms": [],
    "uncertaintyAreas": [],
    "alternativeMethods": []
  },
  "warnings": [],
  "limitations": ["Katman hazır değil; sahte çıktı üretilmedi."],
  "trace": {},
  "audit": {},
  "metadata": { "llmUsed": false, "fabricated": false, "calculatedVsInterpretedSeparated": true }
}
```

---

## 16. Migration Impact

Adapter MUST map legacy layer outcomes ↔ EngineResult (RFC-007 tables). Frontend types gain additive platform types later; no forced UI rewrite in Phase 1.

---

## 17. Test Criteria

- Schema validator rejects missing assessment fields  
- Skipped results still validate  
- Extension namespace required when extension present  
- Fabricated flag false on incomplete input paths  
- PlatformRunReport allows mix of complete + skipped  

---

## 18. Acceptance Criteria

- [ ] EngineResult interface complete vs Master proposed structure  
- [ ] Status matrix defined  
- [ ] Extension / partial / retry / backward-compat policies explicit  
- [ ] ADR-003 compatibility asserted  
- [ ] Legacy mapping section present  

---

## 19. Rejected Alternatives

| Rejected | Why |
|----------|-----|
| Keep single merged `userResult` as sole long-term contract | Blocks independent versioning & dual methodology cards |
| Omit assessment on skipped | Breaks uniform consumer logic |
| Free-form per-engine top-level JSON | Breaks synthesis & contract tests |

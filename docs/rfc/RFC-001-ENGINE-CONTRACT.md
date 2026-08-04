# RFC-001 — Engine Contract

**Status:** Normative  
**Parent:** [ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md](../ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md)  
**Document id:** `atlas-rfc-001-engine-contract-v1`  
**Last updated:** 2026-07-31  
**Implementation status:** Spec only

---

## 1. Purpose

Her uzman motorun kaydolması, çözülmesi ve çalıştırılması için zorunlu **Engine Contract**’ı tanımlar. Registry davranışını, zorunlu descriptor alanlarını ve contract test paketini sabitler.

---

## 2. Scope

- EngineDescriptor şeması
- EngineRegistry API
- ExecutableEngine interface
- Dependency, timeout, fallback, feature-flag politikaları
- Failure isolation
- Shared contract test suite requirements

---

## 3. Out of Scope

- Methodology rule content (RFC-002)
- Result field semantics detail beyond reference (RFC-003)
- Production registration code

---

## 4. Definitions

| Term | Meaning |
|------|---------|
| **EngineDescriptor** | Static metadata registered at discovery time |
| **ExecutableEngine** | Runtime handle exposing `execute(ctx)` |
| **EngineDependency** | Soft/hard dependency on another engine’s output |
| **FallbackPolicy** | What happens when primary version/methodology unavailable |

---

## 5. Normative Rules

1. Every engine **MUST** register an `EngineDescriptor` before Orchestrator may invoke it.
2. `engineId` **MUST** be stable kebab-case; rename requires deprecation cycle (RFC-006).
3. `execute` **MUST** return `EngineResult` (RFC-003) or throw only for programmer errors; validation failures **MUST** be expressed as `execution.status = 'failed' | 'skipped'`.
4. Hard dependency failure **MUST NOT** crash sibling independent engines.
5. Soft dependency absence **MUST** degrade to `partial` or documented skip — never invent peer output.
6. Feature flag off ⇒ engine resolves as `disabled` / `skipped`, not silent substitute methodology.
7. `timeoutMs` exceeded ⇒ `failed` with warning code `ENGINE_TIMEOUT`; orchestrator continues.
8. Deprecated engines remain readable via Version Compatibility; new runs **MUST NOT** select them unless explicit `allowDeprecated: true`.

---

## 6. Architecture

### 6.1 Mapping from current code

| Current | Target |
|---------|--------|
| `SYMBOLIC_LAYER_IDS` | Engine Registry entries |
| `LAYER_READINESS` | `EngineDescriptor.status` + Capability Registry |
| `LAYER_REQUIREMENTS` | `inputContract` |
| `layers/run.js` if/else | `EngineRegistry.resolve` + `execute` |
| `placeholders.js` | `status: planned\|unavailable` engines returning skipped/planned results |
| No per-engine version | `engine.version` + methodology versions |

### 6.2 Proposed modules

```
server/symbolic-platform/registries/engine-registry.ts
server/symbolic-platform/contracts/engine-descriptor.ts
server/symbolic-platform/engines/<engineId>/index.ts  # registers descriptor + execute
```

---

## 7. Data Model

```ts
type EngineStatus =
  | 'active'
  | 'limited'
  | 'disabled'
  | 'deprecated'
  | 'planned';

type InputFieldSpec = {
  key: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'datetime' | 'ref';
  description?: string;
  pii?: boolean;
};

type EngineDependency = {
  engineId: string;
  strength: 'hard' | 'soft';
  /** Fields consumed from peer EngineResult */
  consumes?: string[];
};

type FallbackPolicy = {
  onTimeout: 'fail' | 'skip';
  onException: 'fail' | 'skip';
  /** Explicit only — never silent methodology swap */
  alternateMethodologyId?: string | null;
  requireExplicitOptInForAlternate: true;
};

type UIRepresentationSpec = {
  projectionId: string;
  cardTemplate: 'standard' | 'comparison' | 'synthesis' | 'media';
  showEvidenceDefault: boolean;
  showMethodDisclosureDefault: boolean;
};

interface EngineDescriptor {
  engineId: string;
  displayName: string;
  version: string; // semver
  status: EngineStatus;
  purpose: string;
  scope: string[];
  outOfScope: string[];
  methodology: string; // human blurb
  methodologyId: string; // default
  supportedVariants: string[];
  inputContract: {
    fields: InputFieldSpec[];
    consentsRequired?: string[];
  };
  outputContract: {
    extensionNamespace: string; // e.g. 'latinMotif'
    schemaVersion: string;
  };
  evidenceContract: {
    allowedKinds: import('./evidence').EvidenceKind[];
  };
  confidenceModel: {
    axes: import('./confidence').ConfidenceAxis[];
    userFacingDerived: boolean;
  };
  assessmentContract: {
    requiresAdr003: true;
    extensions?: string[];
  };
  methodDisclosure: {
    templateId: string;
    hideDeveloperFields: true;
  };
  safetyRules: string[]; // rule ids from RFC-008
  limitations: string[];
  warnings: Array<{ code: string; when: string; messageKey: string }>;
  traceRequirements: string[];
  auditRequirements: string[];
  snapshotRequirements: {
    inputSnapshot: boolean;
    reproducibilitySnapshot: boolean;
  };
  UIRepresentation: UIRepresentationSpec;
  backwardCompatibilityPolicy: {
    minReadableEngineVersion: string;
    legacyLayerId?: string | null; // e.g. 'ebced'
  };
  deprecationPolicy: {
    deprecatedSince?: string | null;
    sunsetsAfterRelease?: string | null;
    successorEngineId?: string | null;
  };
  dependencies?: EngineDependency[];
  featureFlag?: string | null;
  executionPriority: number; // lower runs earlier when sequential
  timeoutMs: number;
  fallback: FallbackPolicy;
  supportedInputTypes: string[]; // 'personal-profile' | 'image-ref' | 'document-ref' | ...
}

interface EngineExecutionContext {
  executionId: string;
  input: Record<string, unknown>;
  normalizedInput: Record<string, unknown>;
  methodologyId: string;
  methodologyVersion: string;
  variantId?: string;
  peerResults: Map<string, import('./result').EngineResult>;
  flags: Record<string, boolean>;
  locale: string;
  startedAt: string;
}

interface ExecutableEngine {
  descriptor: EngineDescriptor;
  execute(ctx: EngineExecutionContext): Promise<import('./result').EngineResult>;
}

interface EngineRegistry {
  register(engine: ExecutableEngine): void;
  unregister(engineId: string, version?: string): void;
  list(filter?: { status?: EngineStatus[] }): EngineDescriptor[];
  resolve(engineId: string, version?: string): ExecutableEngine;
  isEnabled(engineId: string, flags: Record<string, boolean>): boolean;
  resolveRunOrder(engineIds: string[]): string[];
}
```

---

## 8. API Impact (future)

| Surface | Change |
|---------|--------|
| Internal | Registry replaces `runSymbolicLayer` switch |
| `POST /api/symbolic-analysis` | Unchanged wire via Legacy Adapter (RFC-007) |
| Future `POST /api/symbolic-platform/run` | Accepts `engines?: string[]`, `methodologyOverrides?` |

---

## 9. UI Impact

`UIRepresentation` drives Projection Layer. Legacy meaning sections remain adapter output until UI migrates to per-engine cards.

---

## 10. Method Disclosure

Descriptor `methodDisclosure.templateId` MUST map to user-safe copy. Engines MUST populate `EngineResult.methodDisclosure` at runtime with selected variant and used inputs.

---

## 11. Examples

```ts
// Conceptual registration (not production code)
registry.register({
  descriptor: {
    engineId: 'latin-number-motif',
    displayName: 'Atlas Latin Number Motif Engine',
    version: '2.0.0',
    status: 'active',
    purpose: 'Latin harf-sayı motif hesabı ve sembolik indirgeme',
    scope: ['letter tokenization', 'sum', 'optional digit reduction'],
    outOfScope: ['classical Arabic abjad', 'fate claims'],
    methodology: 'Atlas Latin Harf-Sayı Motif Sistemi',
    methodologyId: 'atlas-letter-number-v2',
    supportedVariants: ['letter-sum-reduce'],
    // ... remaining mandatory fields
    backwardCompatibilityPolicy: {
      minReadableEngineVersion: '1.0.0',
      legacyLayerId: 'ebced',
    },
    executionPriority: 10,
    timeoutMs: 2000,
    fallback: {
      onTimeout: 'fail',
      onException: 'fail',
      alternateMethodologyId: null,
      requireExplicitOptInForAlternate: true,
    },
    supportedInputTypes: ['personal-profile'],
  },
  execute: async (ctx) => { /* ... */ },
});
```

---

## 12. Migration Impact

- `ebced` → `latin-number-motif` (and later `classical-abjad` as separate engine)
- `esma` → `esma-matching`
- placeholders → `planned` engines with same skip semantics
- Adapter maps `layers[]` request param → `engineIds[]`

---

## 13. Test Criteria

Shared **contract test package** (every engine MUST pass):

| Suite | Asserts |
|-------|---------|
| descriptor.completeness | All mandatory fields present |
| input.incomplete | Missing required → skipped/failed, no fabrication |
| result.shape | EngineResult validates |
| assessment.adr003 | Four fields always present |
| no.scalar.confidence | New results lack legacy scalar as primary |
| isolation.exception | Thrown error → failed result; siblings still run (orchestrator test) |
| timeout | Exceeded → ENGINE_TIMEOUT |
| flag.off | Disabled → skipped |
| disclosure.safe | No raw developer tables in disclosure user fields |
| snapshot | When required, snapshots immutable-shaped |

---

## 14. Acceptance Criteria

- [ ] EngineDescriptor TypeScript interface frozen in this RFC  
- [ ] Registry operations listed (register, version, methodology, capability query hooks, deps, flags, disable, priority, timeout, fallback, input types)  
- [ ] Failure isolation normative  
- [ ] Legacy layerId mapping field present  
- [ ] Contract test matrix defined  
- [ ] Silent methodology fallback forbidden  

---

## 15. Open Questions

1. Should `cifir` / `simya` / `mizac` receive reserved `engineId`s in v1 registry as `planned`, or stay unregistered until scoped?
2. Hard dependency graph depth limit for synthesis peers?

**Recommendation:** Register planned engines with `status: planned` for capability discovery UI parity with today’s placeholders.

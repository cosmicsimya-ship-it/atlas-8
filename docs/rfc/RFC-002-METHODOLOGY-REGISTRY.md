# RFC-002 — Methodology Registry

**Status:** Normative  
**Parent:** [ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md](../ATLAS_SYMBOLIC_PLATFORM_MASTER_ARCHITECTURE.md)  
**Document id:** `atlas-rfc-002-methodology-registry-v1`  
**Last updated:** 2026-07-31  
**Implementation status:** Spec only  
**Aligns with:** ADR-002, ADR-004, ADR-005, CURRENT_VS_TARGET_ARCHITECTURE_SPEC

---

## 1. Purpose

Metodolojileri engine implementasyonundan ayıran **Methodology Registry** standardını tanımlar. Aynı engine birden fazla methodology/variant destekleyebilir; id’ler ürün ve snapshot sürekliliği için sabittir.

---

## 2. Scope

- MethodologyDescriptor schema
- Variant model
- Engine↔methodology binding
- Implementation status & test coverage metadata
- Disputed areas & assumptions disclosure hooks

---

## 3. Out of Scope

- Literal classical letter values / catalog rows (owned by domain specs)
- UI tab layout details
- Production registry persistence format choice (file vs DB) — MUST be versionable either way

---

## 4. Definitions

| Term | Meaning |
|------|---------|
| **methodologyId** | Stable id (e.g. `atlas-letter-number-v2`) |
| **methodologyVersion** | Semver of the methodology definition |
| **rulesetVersion** | Executable rules package id |
| **variant** | Named optional rule branch under a methodology |
| **disputedArea** | Known scholarly/product disagreement surfaced in disclosure |

---

## 5. Normative Rules

1. Every `EngineResult.engine.methodologyId` **MUST** resolve in Methodology Registry.
2. Unknown methodologyId **MUST** fail closed (execution `failed`), never invent rules.
3. One engine **MAY** support multiple methodologies; selection **MUST** be explicit (request, product default, or confirmed UI choice).
4. Product default for letter-number path **MUST** be `atlas-letter-number-v2` (ADR-002).
5. Classical path **MUST** use `abjad-kabir-classical-v1` and require spelling confirmation (`autoAcceptHighCertainty: false`).
6. Methodologies **MUST NOT** silently fall back to another methodologyId.
7. `disputedAreas` and `limitations` **MUST** be available to Method Disclosure / UI Projection.
8. Catalog policy: 99 Esma is curated list, not “single true list” (ADR-004) — reflected in Esma methodology limitations.

---

## 6. Architecture

### 6.1 Current → Target

| Current | Target |
|---------|--------|
| `methodology-ids.js` constants | Methodology Registry entries |
| `EBCED_METHOD` / `ESMA_METHOD` strings | `variants` or method labels under methodology |
| Compose-time comingSoon classical | Registry `implementationStatus: planned` + engine binding |
| Spec docs (CLASSICAL_ABJAD, ESMA matching) | `rules` / `references` pointers |

### 6.2 Proposed modules

```
server/symbolic-platform/registries/methodology-registry.ts
server/symbolic-platform/methodologies/<methodologyId>/descriptor.json|ts
docs/… domain specs remain normative rule sources; registry references them
```

---

## 7. Data Model

```ts
type MethodologyCategory =
  | 'numerology-motif'
  | 'classical-abjad'
  | 'esma-matching'
  | 'astrology'
  | 'calendrical'
  | 'matrix'
  | 'image-symbolic'
  | 'document-symbolic'
  | 'synthesis'
  | 'other';

type ImplementationStatus =
  | 'production'
  | 'beta'
  | 'planned'
  | 'deprecated'
  | 'withdrawn';

type MethodologyVariant = {
  variantId: string;
  name: string;
  description: string;
  default?: boolean;
  experimental?: boolean;
};

type MethodologyDescriptor = {
  methodologyId: string;
  name: string;
  version: string; // methodologyVersion
  category: MethodologyCategory;
  description: string;
  rules: {
    summary: string;
    /** Pointers to normative docs / frozen ruleset ids */
    references: string[];
    rulesetVersion: string;
  };
  variants: MethodologyVariant[];
  references: Array<{ title: string; uri?: string; note?: string }>;
  assumptions: string[];
  limitations: string[];
  disputedAreas: string[];
  implementationStatus: ImplementationStatus;
  testCoverage: {
    fixtureSuiteIds: string[];
    coverageNote?: string;
  };
  supportedEngines: string[]; // engineIds
  catalogVersion?: string | null;
  isClassicalAbjad?: boolean;
  disclosureDefaults: {
    displayName: string;
    disclaimer: string;
  };
};
```

### 7.1 Seed registry (known ids — MUST preserve)

| methodologyId | version | category | status | engines |
|---------------|---------|----------|--------|---------|
| `atlas-letter-number-v1` | 1.0.0 | numerology-motif | deprecated (read-only) | `latin-number-motif` |
| `atlas-letter-number-v2` | 2.0.0 | numerology-motif | production | `latin-number-motif` |
| `abjad-kabir-classical-v1` | 1.0.0 | classical-abjad | planned | `classical-abjad` / ruleset **`classical-kabir-rules-1.0.0`** |
| `classical-arabic-abjad-kabir-v1` | — | — | **deprecated alias** | Docs only; map to `abjad-kabir-classical-v1` |
| `atlas-names-motif-v1` | 1.0.0 | esma-matching | production (legacy source string) | `esma-matching` |
| `esma-theme-intention-match-v1` | 1.0.0 | esma-matching | production target label | `esma-matching` |
| `atlas-symbolic-synthesis-v1` | 1.0.0 | synthesis | planned | `symbolic-synthesis` |

**Note:** Legacy runner currently emits `atlas-names-motif-v1` as `source`. Migration MUST map / dual-publish until UI cutover completes (RFC-007); MUST NOT drop either id without deprecation calendar.

---

## 8. Registry API

```ts
interface MethodologyRegistry {
  register(desc: MethodologyDescriptor): void;
  get(methodologyId: string, version?: string): MethodologyDescriptor;
  listByEngine(engineId: string): MethodologyDescriptor[];
  listByCategory(category: MethodologyCategory): MethodologyDescriptor[];
  resolveDefault(engineId: string): MethodologyDescriptor;
  assertCompatible(engineId: string, methodologyId: string): void;
}
```

---

## 9. API Impact

- Request MAY include `methodologyOverrides: Record<engineId, methodologyId>`.
- Response `engine.methodologyId` MUST match registry.
- Snapshots MUST store methodologyId + methodologyVersion + rulesetVersion (+ catalogVersion when applicable).

---

## 10. UI Impact

- “Yöntemi gör” reads `disclosureDefaults` + runtime disclosure.
- Alternative methods list = other methodologies/variants with `implementationStatus` and experimental badges.
- Classical confirmation UX gated by classical methodology readiness.

---

## 11. Method Disclosure

Registry limitations/disputedAreas/assumptions are **inputs** to disclosure composition; engines add runtime selection path (which inputs, which transforms).

---

## 12. Examples

```ts
const latinV2: MethodologyDescriptor = {
  methodologyId: 'atlas-letter-number-v2',
  name: 'Atlas Latin Harf-Sayı Motif Sistemi',
  version: '2.0.0',
  category: 'numerology-motif',
  description: 'Latin harfler için Atlas’a özgü harf-sayı motif hesabı; klasik ebced değildir.',
  rules: {
    summary: 'NFC normalize → tokenize known letters → sum → optional digit reduction',
    references: ['docs/CURRENT_VS_TARGET_ARCHITECTURE_SPEC.md'],
    rulesetVersion: 'atlas-latin-rules-2.0.0',
  },
  variants: [
    { variantId: 'letter-sum-reduce', name: 'Toplam + indirgeme', default: true },
  ],
  references: [],
  assumptions: ['Girdi Latin/Türkçe karakter ağırlıklıdır'],
  limitations: [
    'Klasik Arapça ebced hesabı değildir',
    'Sonuç sembolik motif yorumudur',
  ],
  disputedAreas: [],
  implementationStatus: 'production',
  testCoverage: { fixtureSuiteIds: ['latin-motif-v2-goldens'] },
  supportedEngines: ['latin-number-motif'],
  isClassicalAbjad: false,
  disclosureDefaults: {
    displayName: 'Atlas Latin Harf-Sayı Motif Sistemi',
    disclaimer: 'Atlas Latin Harf-Sayı Motif Sistemi — klasik ebced değildir.',
  },
};
```

---

## 13. Migration Impact

- Centralize string literals from `methodology-ids.js` into registry descriptors.
- `ATLAS_SYMBOLIC_METADATA_V2` remains a delivery flag until platform default; calculation MUST NOT depend on flag (existing rule preserved).
- Deprecated v1 remains resolvable for old snapshots.

---

## 14. Test Criteria

- Registry resolve unknown → error
- Default methodology for latin engine = v2
- Engine cannot bind unsupported methodology (`assertCompatible`)
- Snapshot round-trip retains methodologyId
- Experimental variant never selected as silent default

---

## 15. Acceptance Criteria

- [ ] MethodologyDescriptor fields match Master § Methodology Registry list  
- [ ] Seed ids preserved  
- [ ] Multi-methodology per engine allowed  
- [ ] Silent fallback forbidden  
- [ ] ADR-002/004 alignment explicit  

---

## 16. Rejected Alternatives

| Rejected | Why |
|----------|-----|
| Methodology embedded only inside engine code | Breaks cross-engine disclosure & snapshot glossary |
| Auto-fallback classical ↔ latin | Violates CURRENT_VS_TARGET isolation |
| Delete v1 id immediately | Breaks reproducibility of stored analyses |

# ESMA_99_DATA_MODEL_SPEC

**Status:** Normative data model (design only)  
**Document id:** `atlas-esma-99-data-model-v1`  
**Last updated:** 2026-07-31  
**ADR:** ADR-004  
**Implementation status:** Spec only

---

## 1. Purpose

Versioned Esma catalog model with explicit list-variant and count policy — not a single true 99 list.

---

## 2. Scope

Entry schema, metadata, Allah/lafza policy, abjad spellings/values, dispute fields, production-35 mapping.

---

## 3. Out of Scope

Matching algorithms, zikir/şifa claims, filling curated seed content in this task.

---

## 4. Definitions

See ADR-004 for count policy terms. `selectedSpelling` refers to user/name spellings elsewhere; catalog uses `abjadSpellings[]`.

---

## 5. Normative Rules

1. First variant ids **MUST** be:

```ts
listVariantId: "atlas-esma-99-curated-tr-v1"
catalogVersion: "esma-99-curated-tr-v1"
```

2. **MUST NOT** present as the unique true 99 list.
3. First count policy **MUST**:

```ts
includesAllahLafza: false
countPolicy: "names-only-99"
```

4. Lafẓatullāh MAY exist with `entryType: "lafzatullah"` outside default count; divine names `entryType: "divine-name"`.
5. `curationStatus: "draft"` until source review; Faz 5 production exit **MUST** have `curationStatus === "approved"`.
6. Disputed orthographies first-class; silent single spelling **MUST NOT** when disputes known.
7. Assessment dispute level derives partly from catalog dispute flags (ADR-003).

### 5.1 Production (verified)

35 entries; fields id/arabic/latin/themes/orientation; hakim duplicate; no catalogVersion.

---

## 6. Architecture

Versioned JSON asset → matching layer read-only consumer. Indexes by theme / abjad total / latin.

---

## 7. Data Model

### 7.1 Metadata

```ts
type EsmaCatalogMetadata = {
  listVariantId: string;
  displayName: string;
  language: "tr";
  sourceBasis: SourceReference[];
  curationStatus: "draft" | "reviewed" | "approved";
  includesAllahLafza: boolean;
  countPolicy: "allah-plus-99" | "allah-within-99" | "names-only-99";
  catalogVersion: string;
  themesOntologyVersion: string;
  notAFatwa: true;
};
```

Locked first ship values: ADR-004.

### 7.2 Entry

```ts
type EsmaEntry = {
  id: string;
  canonicalOrder?: number;
  entryType: "divine-name" | "lafzatullah";
  arabic: string; // display
  latinVariants: string[];
  turkishName: string;
  meaning: string;
  themes: string[];
  abjadSpellings: AbjadSpelling[];
  abjadValues: AbjadValue[];
  orthographicVariants?: OrthographicVariant[];
  disputedSpellings: DisputedSpelling[];
  sourceNotes: string[];
};
```

`abjadValues` reference `methodologyId: "abjad-kabir-classical-v1"` + `rulesetVersion` + `total` + `spellingId`.

Collapse production `hakim`/`hakim2` → single `hakim`.

---

## 8. API Impact

Echo `catalogVersion` / `listVariantId` on match responses. Refuse modular match if modulus≠active counted entries (Matching RFC).

---

## 9. UI Impact

Disclose names-only-99 and draft/approved status; never “tek doğru liste.”

---

## 10. Method Disclosure

Curated dataset; sources diverge; not a fatwa engine.

---

## 11. Examples

Map production `rahman` → target entry; article-inclusive vs stripped spellings as separate `abjadSpellings`.

---

## 12. Edge Cases

Same total multiple names; lazy vs build-time abjadValues; order conflicts across future listVariantIds.

---

## 13. Error Handling

`ESMA_CATALOG_VERSION_MISSING`, `ESMA_ENTRY_INVALID`, `ESMA_DUPLICATE_ID`, ship gate if not approved when flag demands production catalog.

---

## 14. Security / Safety Language

No healing/fate language in meaning fields; ingest safety scan.

---

## 15. Open Questions

- Concrete `sourceBasis` bibliography after curation (no fabricated citations here).
- When abjadValues computed (build vs runtime).

---

## 16. Acceptance Criteria

- [ ] ADR-004 ids and Allah policy locked
- [ ] curationStatus gate documented
- [ ] Spec only

---

## 17. Related

Matching · Classical · Migration Faz 5 · ADR-004

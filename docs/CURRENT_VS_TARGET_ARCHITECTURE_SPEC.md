# CURRENT_VS_TARGET_ARCHITECTURE_SPEC

**Status:** Normative architecture specification (design only)  
**Spec series:** Atlas Ebced / Esma Architecture v2  
**Document id:** `atlas-abjad-esma-arch-current-vs-target-v1`  
**Last updated:** 2026-08-01  
**ADRs:** ADR-001 … ADR-005  
**Ops:** `ARCHITECTURE_OPERATIONAL_APPENDIX.md`  
**Implementation status:** Spec — Conditional GO doc/fixture stamp applied; no classical runner yet

---

## 1. Purpose

Mevcut Symbolic Analysis Ebced/Esma davranışını kod kanıtıyla sabitleyerek hedef üç metodolojiyi tanımlar ve Architecture Review zorunlu düzeltmelerini (kanonik alanlar, assessment, snapshot glossary, default motor, Latin v2) normatif kılar.

---

## 2. Scope

- Current vs target architecture
- Canonical shared types (by reference to ADRs)
- Default product methodology lock
- Latin motif normative identity + output schema
- API/UI/disclosure impact (design)
- Cross-doc consistency table

---

## 3. Out of Scope

- Production code, tests, commits, migrations
- Fatwa / medical claims
- Operational runbooks detail beyond appendix reference

---

## 4. Definitions

| Terim | Tanım |
|--------|--------|
| **selectedSpelling** | Kullanıcının klasik ebced için onayladığı özgün Arapça yazım (`string`). Kanonik ad — ADR-001. |
| **normalizedSpelling** | Normalizasyon sırası sonrası motor girdisi; `selectedSpelling` ile aynı kavram değildir. |
| **InputSnapshot** | Yalnızca girdi/seçim bağlamı (§7.1) |
| **ReproducibilitySnapshot** | Yeniden üretim paketi; `inputSnapshot` gömülü (§7.2) |
| **MethodologyAssessment** | Dört alanlı assessment — ADR-003 |
| **Default methodology** | Atlas Latin Harf-Sayı Motif (`atlas-letter-number-v2`) — ADR-002 |

Eski ad **`selectedArabicSpelling`**: yeni şema/response’ta **MUST NOT**; yalnızca deprecation notlarında.

---

## 5. Normative Rules

1. Ana klasik sonuç **toplam (`total`)**tır; digit reduction klasik birincil sonuç **MUST NOT**.
2. `LATIN_ABJAD` silinmez; Latin motif `atlas-letter-number-v2` olarak etiketlenir.
3. Klasik yol yazım onayı gerektirir (`autoAcceptHighCertainty: false` — Transliteration RFC).
4. Türkçe harfler tek kesin Arapça karşılık **MUST NOT**.
5. 99 Esma tek doğru liste **MUST NOT** (ADR-004).
6. Hash+7 / experimental motif **MUST NOT** silent default; silent fallback **forbidden**.
7. Scalar `confidence` new responses’ta **MUST NOT** (ADR-003).
8. Üç sistem UI/API’de karıştırılmaz; biri diğerinin fallback’i **MUST NOT**.
9. Normalization order (classical) **MUST**:

```
Unicode NFC → hareke → tatvil → şedde → hemze → ligature → hesap
```

10. Product default tab **MUST** be Latin motif (ADR-002).

---

## 6. Architecture

### 6.1 Current production (verified)

See prior audit: mixed `ARABIC_ABJAD`∪`LATIN_ABJAD`, `reduceToDigit`, Esma 35, theme-overlap else hash+7 (`stable-name-offset`), `source`/`method` instead of `methodologyId`, scalar `confidence`.

| Layer | source (verified) | method (verified) |
|-------|-------------------|-------------------|
| ebced | `atlas-letter-number-v1` | `letter-sum-reduce` |
| esma | `atlas-names-motif-v1` | `theme-intention-catalog-match` |

### 6.2 Target

```
Symbolic Envelope
├── Default: atlas-letter-number-v2 (Latin motif)
├── Opt-in: abjad-kabir-classical-v1 (+ selectedSpelling → normalizedSpelling)
└── Independent: Esma matching (default esma-theme-intention-match-v1)
```

Dual methods → **separate result cards**. No merge-as-one-truth.

### 6.3 Consistency table

| Concept | Canonical | Notes |
|---------|-----------|-------|
| Spelling choice | `selectedSpelling` | ADR-001 |
| Engine spelling | `normalizedSpelling` | Classical |
| Classical id | `abjad-kabir-classical-v1` / `1.0.0` | Frozen |
| Classical ruleset | `classical-kabir-rules-1.0.0` | Frozen |
| Deprecated classical alias | `classical-arabic-abjad-kabir-v1` | Docs only |
| Transliteration layer | `transliteration-tr-ar-v1` | Not a product tab |
| Latin id | `atlas-letter-number-v2` / `2.0.0` | New results |
| Latin ruleset | `atlas-latin-rules-2.0.0` | |
| Legacy Latin | `atlas-letter-number-v1` | Read-only legacy |
| Assessment | `MethodologyAssessment` | ADR-003; UI bands not % |
| Catalog | `esma-99-curated-tr-v1` | ADR-004 |
| Default Esma | `esma-theme-intention-match-v1` | Matching RFC |
| Letter list field | `tokenizedLetters` | not `letters` |
| Ops | Operational Appendix | |

---

## 7. Data Model

### 7.1 InputSnapshot

```ts
type InputSnapshot = {
  originalInput: string;
  proposedArabicSpellings?: ProposedArabicSpelling[];
  selectedSpelling?: string;
  selectedMethodologyId: string;
  intentionInput?: string | null;
  locale: string;
};
```

### 7.2 ReproducibilitySnapshot

```ts
type ReproducibilitySnapshot = {
  inputSnapshot: InputSnapshot;
  normalizedSpelling?: string;
  tokenizedLetters: LetterCalculation[];
  total?: number;
  optionalReductions?: OptionalReduction[];
  methodologyId: string;
  methodologyVersion: string;
  rulesetVersion: string;
  catalogVersion?: string | null;
  generatedAt: string;
};
```

Rules:

- `inputSnapshot` embedded inside reproducibility package.
- Classical: `total` required.
- Esma-only: `total` nullable.
- Immutable; recompute → new snapshot (Operational Appendix).

### 7.3 MethodologyAssessment

See **ADR-003** (canonical). All results include `assessment` with four fields.

### 7.4 Classical result shape (summary)

Uses `selectedSpelling`, `normalizedSpelling`, `tokenizedLetters`, `total`, `optionalReductions`, `assessment`, versions — details in Classical RFC. **No** `selectedArabicSpelling`. **No** scalar `confidence`.

### 7.5 Atlas Latin Motif result (normative)

```ts
type AtlasLatinMotifResult = {
  methodologyId: "atlas-letter-number-v2";
  methodologyVersion: "2.0.0";
  rulesetVersion: string;
  catalogVersion: null;
  generatedAt: string;
  inputSnapshot: InputSnapshot;
  reproducibilitySnapshot: ReproducibilitySnapshot;
  calculation: {
    tokenizedLetters: Array<{
      sourceCharacter: string;
      normalizedCharacter: string | null;
      value: number | null;
      status: "mapped" | "unsupported" | "ignored";
      reason?: string;
    }>;
    total: number;
    reducedDigit: number;
    reductionMethod: "digit-sum";
  };
  motifInterpretation: {
    motifId: string;
    title: string;
    summary: string;
  };
  assessment: MethodologyAssessment;
  methodDisclosure: {
    label: "Atlas Latin Harf-Sayı Motif Sistemi";
    isClassicalAbjad: false;
    limitations: string[];
  };
};
```

Rules:

- `reducedDigit` MAY remain for this system; MUST NOT be presented as classical abjad.
- Unsupported chars MUST NOT silent-drop; status `unsupported`.
- `â` / `î` / `û` behavior MUST be explicit in Latin ruleset (î/û mapped in current `LATIN_ABJAD` — verified; `â` absent today — verified gap to fix in v2 ruleset, not silent).

Legacy `atlas-letter-number-v1`: read-only; UI MAY show “Legacy Atlas Latin Motif”; MUST NOT auto-recompute into v2.

---

## 8. API Impact

- Default methodology id on new runs: `atlas-letter-number-v2`.
- Feature-flag additive metadata per Operational Appendix.
- Breaking removals (`selectedArabicSpelling`, scalar `confidence`) → API v2 or adapter-only legacy.

---

## 9. UI Impact

- Default tab: Atlas Latin Motif + label “klasik ebced değildir.”
- Classical tab: spelling confirmation required.
- Separate cards if both requested.
- Raw technical fields humanized (Operational + Matching disclosure maps).

---

## 10. Method Disclosure

Per-methodology labels; Latin disclosure MUST set `isClassicalAbjad: false`.

---

## 11. Examples

Default path: Latin name → `atlas-letter-number-v2` total + reducedDigit motif.  
Classical path: proposals → `selectedSpelling` → `normalizedSpelling` → `total` only as primary.

---

## 12. Edge Cases

| Case | Behavior |
|------|----------|
| Classical without `selectedSpelling` when required | Error / confirmation required |
| Dual methodologies | Two cards |
| Legacy v1 record | Read with legacy label |

---

## 13. Error Handling

`TRANSLITERATION_CONFIRMATION_REQUIRED`, `METHODOLOGY_MISMATCH`, plus Classical/Matching codes.

---

## 14. Security / Safety Language

MUST NOT: senin esman / kesin budur / kader / zikir dozu / hastalık iddiası.  
MUST: öneri / benzerlik / sembolik referans / dinî rehberlik değildir.

---

## 15. Open Questions

Resolved by ADRs: default motor, spelling field name, assessment, catalog Allah policy, classical orthography defaults.

Remaining external:

- Exact golden totals after source review (`BLOCKED_PENDING_RULESET_APPROVAL` in Test Matrix).
- Catalog `curationStatus: approved` gate (ADR-004).
- Rate-limit numeric quotas (Appendix — NOT VERIFIED).

---

## 16. Acceptance Criteria

- [ ] Canonical `selectedSpelling` / `normalizedSpelling`
- [ ] Assessment + snapshot glossary locked
- [ ] Default Latin v2 + classical opt-in
- [ ] Latin output schema normative
- [ ] Cross-links to ADRs + Appendix
- [ ] No production code change

---

## 17. Related

Classical · Transliteration · Esma 99 · Matching · Migration · Test Matrix · Operational Appendix · ADR-001…005

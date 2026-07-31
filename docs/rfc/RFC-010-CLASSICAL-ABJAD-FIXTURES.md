# RFC-010 — Classical Abjad Fixtures

**Status:** Normative (fixtures + contract; engine not implemented)  
**Document id:** `atlas-rfc-010-classical-abjad-fixtures-v1`  
**methodologyId (target):** `abjad-kabir-classical-v1`  
**methodologyVersion:** `1.0.0`  
**rulesetVersion (frozen):** `classical-kabir-rules-1.0.0`  
**Deprecated alias:** `classical-arabic-abjad-kabir-v1` (documentation only)  
**Last updated:** 2026-08-01  
**ADRs:** [ADR-001](../adr/ADR-001-CANONICAL-SPELLING-FIELDS.md), [ADR-003](../adr/ADR-003-CONFIDENCE-AND-ASSESSMENT-CONTRACT.md), [ADR-005](../adr/ADR-005-CLASSICAL-ORTHOGRAPHY-DEFAULTS.md)  
**Companion:** [CLASSICAL_ABJAD_RULES_SPEC.md](../CLASSICAL_ABJAD_RULES_SPEC.md), [CLASSICAL_ABJAD_TEST_PLAN.md](../CLASSICAL_ABJAD_TEST_PLAN.md), [RFC-009](./RFC-009-TURKISH-ARABIC-TRANSLITERATION.md)  
**Data file:** [`tests/fixtures/classical-abjad-fixtures.json`](../../tests/fixtures/classical-abjad-fixtures.json)  
**Implementation status:** Fixture set only — **no production classical engine**

---

## 1. Purpose

Production klasik motor yazılmadan önce **harf harf yeniden hesaplanabilir** test fixture setini sabitler.

Amaçlar:

- Ana klasik sonuç = harf değerlerinin toplamı
- Digit reduction klasik sonuç **değildir** (opsiyonel ayrı katman)
- Alternatif yazımlar ve kullanıcı onayı görünür
- Desteklenmeyen karakterler sessizce atılmaz
- Her fixture kaynak türü taşır

---

## 2. Scope

- Fixture JSON şeması (§6)
- Eastern kebîr value table after ADR-005 (§5)
- Minimum category catalog (§7)
- Verification algorithm (§8)
- Calculation rules (§9)

---

## 3. Out of Scope

- Production abjad motoru / `ebced-runner.js` değişikliği
- Esma / UI / endpoint
- Digit reduction’ı klasik birincil yapmak

---

## 4. Definitions

| Term | Meaning |
|------|---------|
| **inputLatin** | Latin/Turkish source (may be empty for pure Arabic fixtures) |
| **inputArabic** | Counted Arabic spelling (= future `selectedSpelling` candidate) |
| **letters[]** | Post-normalization countable letter trace |
| **expectedTotal** | Σ `letters[].value` |
| **alternativeSpellings** | Other valid Arabic orthographies (may imply different totals) |
| **requiresUserConfirmation** | Confirmation gate for this case |
| **sourceType** | `canonical` \| `documented_variant` \| `internal_test` |

---

## 5. Value table (Eastern kebîr — after ADR-005)

Aligned with production `ARABIC_ABJAD` base letters + ADR-005 folds:

| Letter / fold | Value | Notes |
|---------------|------:|-------|
| ا أ→ا إ→ا | 1 | Carriers fold to ا |
| آ → ا+ا | 1+1 | **ruleset `classical-kabir-rules-1.0.0`.** Legacy production `ARABIC_ABJAD` آ=1 is **not** this ruleset. Atlas preference; not universal consensus. See ADR-005 user message. Fixtures: `FAB-003`, `FAB-012a`, `FAB-CONFLICT-AA` (sibling `FAB-012b` = ادم). |
| ب | 2 | پ → ب |
| ج | 3 | چ → ج |
| د | 4 | |
| ه ؛ ة→ه | 5 | |
| و | 6 | ؤ → و |
| ز | 7 | ژ → ز |
| ح | 8 | |
| ط | 9 | |
| ي ؛ ى→ي | 10 | ئ → ي |
| ك | 20 | گ → ك |
| ل | 30 | |
| م | 40 | |
| ن | 50 | |
| س | 60 | |
| ع | 70 | |
| ف | 80 | |
| ص | 90 | |
| ق | 100 | |
| ر | 200 | |
| ش | 300 | |
| ت | 400 | |
| ث | 500 | |
| خ | 600 | |
| ذ | 700 | |
| ض | 800 | |
| ظ | 900 | |
| غ | 1000 | |
| ء | 0 | Traced; **kept in output**; v1 UI MUST NOT offer count-as-1 (`atlas_product_decision`) |
| harakat | — | ignore |
| tatwil ـ | — | remove |
| shadda | — | expand-and-count (consonant twice) |
| لا | 30+1 | decompose |

---

## 6. Fixture schema (normative)

Root document MUST include:

```json
{
  "methodologyId": "abjad-kabir-classical-v1",
  "methodologyVersion": "1.0.0",
  "rulesetVersion": "classical-kabir-rules-1.0.0",
  "deprecatedMethodologyAliases": ["classical-arabic-abjad-kabir-v1"]
}
```

Per-fixture (simple):

```json
{
  "id": "",
  "inputLatin": "",
  "inputArabic": "",
  "normalizationRules": [],
  "letters": [{ "letter": "", "value": 0 }],
  "expectedTotal": 0,
  "alternativeSpellings": [],
  "requiresUserConfirmation": false,
  "notes": "",
  "sourceType": "canonical | documented_variant | internal_test"
}
```

### 6.1 Mother-name parts model (normative)

```json
{
  "id": "FAB-010b",
  "includeMotherName": true,
  "parts": [
    {
      "type": "primary",
      "selectedSpelling": "محمد",
      "letters": [{ "letter": "م", "value": 40 }],
      "subtotal": 92
    },
    {
      "type": "motherName",
      "selectedSpelling": "فاطمة",
      "letters": [{ "letter": "ه", "value": 5 }],
      "subtotal": 135
    }
  ],
  "letters": [],
  "combinedTotal": 227,
  "expectedTotal": 227,
  "inputArabic": null
}
```

Rules:

- `parts[].type` ∈ {`primary`, `motherName`}
- `sum(parts[i].letters[].value) === parts[i].subtotal`
- `combinedTotal === sum(parts[].subtotal)` **only when** `includeMotherName === true` (and both spellings treated as user-confirmed in the scenario)
- Default product policy: `includeMotherName: false` → `combinedTotal: null`
- **MUST NOT** merge mother + primary into one ambiguous `inputArabic` string for the include case (`FAB-010b` uses `inputArabic: null`)

### 6.2 Extended optional fields (allowed in JSON)

| Field | Purpose |
|-------|---------|
| `category` | Catalog tag (§7) |
| `variantGroupId` | Links divergent-total siblings |
| `parts` / `includeMotherName` / `combinedTotal` | Mother-name model (§6.1) |
| `unsupportedCharacters` | Non-empty blocks silent success |
| `expectError` | Error code expectation |
| `optionalDigitReduction` | Side channel only; never classical primary |
| `status` | `draft_verifiable` \| `blocked_pending_ruleset_approval` \| `informational` |
| `sourceClassification` | RFC-009 / matrix source tags |

---

## 7. Minimum categories

| # | category | Description |
|---|----------|-------------|
| 1 | `pure_arabic_name` | Saf Arapça isim |
| 2 | `turkish_name` | Türkçe isim (Latin → Arapça aday) |
| 3 | `long_vowel` | â / î / û |
| 4 | `turkish_special_letters` | ç ğ ı ö ş ü |
| 5 | `shadda` | Şeddeli kelime |
| 6 | `standalone_hamza` | Bağımsız hemze |
| 7 | `ta_marbuta` | Te marbuta |
| 8 | `alif_maqsura` | Elif maksura |
| 9 | `lam_alif` | Lam-elif |
| 10 | `mother_name` | Anne adı dahil / hariç |
| 11 | `alternate_spellings` | İki alternatif Arapça yazım |
| 12 | `divergent_totals` | Aynı Latin → farklı toplam |
| 13 | `unsupported_character` | Desteklenmeyen karakter |
| 14 | `compound_name` | Birleşik isim |
| 15 | `abd_structure` | Abdül- / Abdur- yapısı |

---

## 8. Verification algorithm

```text
1. Root rulesetVersion MUST equal classical-kabir-rules-1.0.0 (not null)
2. If parts[] present:
     for each part: sum(part.letters.value) === part.subtotal
     if includeMotherName === true: combinedTotal === sum(parts.subtotal)
     if includeMotherName === false: combinedTotal === null
3. Else when expectedTotal is a number and letters non-empty:
     assert sum(letters[i].value) === expectedTotal
4. optionalDigitReduction MUST NOT gate classical pass; enabledForClassicalPrimary=false
5. If unsupportedCharacters non-empty OR expectError set with empty letters:
     MUST NOT treat as successful silent numeric total
6. آ fixtures (FAB-003, FAB-012a, FAB-CONFLICT-AA) assert expand ا+ا; FAB-012b is bare ادم sibling (no FAB-012 id)
7. divergent_totals group members MUST have differing expectedTotal
8. Recompute every verified fixture letter-by-letter in CI (future)
```

Optional digit reduction (documentation only):

```text
while n > 9: n = sum of decimal digits
```

This is **not** classical Ebced-i Kebîr primary result.

---

## 9. Calculation rules (normative)

1. Primary classical result = Σ letter values after ADR-005 normalization.
2. Single-digit reduction is **not** classical result.
3. Digit reduction is optional, separate numerology layer only.
4. Unsupported characters **MUST NOT** be silently discarded.
5. Every total **MUST** be recomputable from `letters[]`.
6. Article ال is never auto-stripped; with/without are separate spellings.
7. Atlas product decisions (e.g. ء=0) **MUST NOT** be tagged as pure classical consensus.

---

## 10. Production conflict note

`server/symbolic-analysis/data/ebced-table.js` currently maps `آ: 1`.  
ADR-005 / these fixtures map `آ → ا+ا` (total 2).  
Classical engine (future) **MUST** follow ADR-005; production key is **not** the golden.

---

## 11. Status policy

| status | Meaning |
|--------|---------|
| `draft_verifiable` | Arithmetic verified under ADR-005; formal `rulesetVersion` not frozen |
| `blocked_pending_ruleset_approval` | Policy case; numeric freeze deferred |
| `informational` | Conflict / documentation only |

---

## 12. Acceptance criteria

- [x] Schema matches §6
- [x] All 15 categories present in JSON
- [x] Letter-sum verifiable totals
- [x] Alternatives + confirmation flagged
- [x] Unsupported not silent
- [x] No production engine in this task

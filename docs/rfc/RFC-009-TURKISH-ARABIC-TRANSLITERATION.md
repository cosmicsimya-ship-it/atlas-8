# RFC-009 — Turkish ↔ Arabic Transliteration

**Status:** Normative RFC (design / fixture-aligned)  
**Document id:** `atlas-rfc-009-turkish-arabic-transliteration-v1`  
**Last updated:** 2026-08-01  
**Parent specs:** [TURKISH_ARABIC_TRANSLITERATION_SPEC.md](../TURKISH_ARABIC_TRANSLITERATION_SPEC.md), [ADR-001](../adr/ADR-001-CANONICAL-SPELLING-FIELDS.md), [ADR-003](../adr/ADR-003-CONFIDENCE-AND-ASSESSMENT-CONTRACT.md)  
**Companion:** [TRANSLITERATION_DECISION_MATRIX.md](../TRANSLITERATION_DECISION_MATRIX.md), [RFC-010](./RFC-010-CLASSICAL-ABJAD-FIXTURES.md)  
**Implementation status:** Spec + fixtures only — **no production code**

---

## 1. Purpose

Latin/Türkçe isimlerin klasik Ebced-i Kebîr yoluna girmeden önce Arap harflerine nasıl dönüştürüleceğini **açık, sürümlenebilir ve test edilebilir** kılar.

Temel ilke: Latin girdiden **tek ve kesin** Arapça yazım **otomatik üretilmez**. Her sonuçta şunlar görünür olmalıdır:

- olası Arapça yazımlar
- seçilen yazım (`selectedSpelling`)
- alternatif yazımlar
- belirsiz harfler
- güven seviyesi (proposal ranking bandı)
- kullanıcı onayı gerekip gerekmediği

Bu katman `atlas-letter-number-v2` Latin motif motorunun yerine geçmez.

---

## 2. Scope

- Proposal → confirmation → `selectedSpelling` pipeline
- Decision matrix binding
- Data contract (§7)
- Name-structure rules (§10)
- User-confirmation gates (§8)
- UI copy (§9)
- Fixture binding (RFC-010)

---

## 3. Out of Scope

- Classical letter totals / ADR-005 normalization order (CLASSICAL_ABJAD_RULES_SPEC, RFC-010)
- Latin motif calculation / `LATIN_ABJAD`
- Esma matching
- Production runners, endpoints, UI implementation in this task
- “Tek doğru Arapça” iddiası

---

## 4. Gap vs current production (read-only verified)

| Area | Current production | Target transliteration layer |
|------|--------------------|------------------------------|
| Latin names | Direct `LATIN_ABJAD` sum in `ebced-runner.js` | Propose Arabic spellings first |
| Diacritics (`â`) | Silent skip (not in Latin table) | Never silent-drop; ا / آ candidates |
| Classical path | `abjad-kabir-classical-v1` coming-soon flag | Requires `selectedSpelling` |
| Confirmation | None | Always on while `autoAcceptHighCertainty: false` |
| Unsupported chars | Often silent skip | Traced; block classical total |
| Digit reduction | Primary motif path | Classical primary = letter sum only |

---

## 5. Definitions

| Term | Definition |
|------|------------|
| **originalInput** | User-entered Latin/Turkish string |
| **normalizedInput** | Latin-side NFC + trim + `tr-TR` case fold |
| **proposedArabicSpellings** | Ranked Arabic orthography candidates |
| **selectedSpelling** | User-confirmed Arabic spelling (ADR-001) |
| **normalizedSpelling** | Post classical-normalization countable form (classical engine) |
| **ambiguousLetters** | Graphemes with >1 plausible Arabic mapping |
| **confidence** (proposal) | Ranking band `high` \| `medium` \| `low` on a **proposal spelling** — not ADR-003 API scalar |
| **transliterationCertainty** | 0–1 assessment axis (ADR-003) after compose |
| **userConfirmationRequired** | Gate before classical compute |

---

## 6. Normative pipeline

```text
originalInput
  → Latin-side normalize → normalizedInput
  → Decision Matrix + heuristics → proposedArabicSpellings
  → user confirms → selectedSpelling
  → classical normalize → normalizedSpelling
  → abjad-kabir-classical-v1 → total (= Σ letter values)
```

Rules:

1. Classical compute **MUST NOT** run without confirmed `selectedSpelling` (or expert-override path that still confirms).
2. **`autoAcceptHighCertainty: false`** — ranking **MUST NOT** skip confirmation.
3. Silent drop of mappable diacritics (e.g. `â`) **MUST NOT**.
4. Field `selectedArabicSpelling` **MUST NOT** appear in normative schemas (ADR-001).
5. New methodology **API responses** **MUST NOT** emit legacy scalar top-level `confidence` (ADR-003). Proposal records **MAY** carry per-spelling `confidence` bands for ranking UI; these map to `transliterationCertainty` on assessment compose.
6. No copy claiming “adınızın tek doğru Arapçası”.

---

## 7. Data contract

```json
{
  "originalInput": "",
  "normalizedInput": "",
  "language": "tr",
  "script": "latin",
  "proposedArabicSpellings": [
    {
      "spelling": "",
      "confidence": "high | medium | low",
      "rulesApplied": [],
      "ambiguities": [],
      "notes": []
    }
  ],
  "selectedSpelling": null,
  "userConfirmationRequired": true,
  "unsupportedCharacters": [],
  "normalizationNotes": []
}
```

### 7.1 Field semantics

| Field | Rules |
|-------|-------|
| `proposedArabicSpellings[].confidence` | Ranking band only; derived from matrix ambiguity (§12 of Decision Matrix) |
| `proposedArabicSpellings[].rulesApplied` | Matrix / name-structure rule ids (`TR-MAT-*`, `NS-*`) |
| `proposedArabicSpellings[].ambiguities` | Human-readable or structured ambiguous grapheme notes |
| `selectedSpelling` | `null` until confirm; then Arabic string |
| `userConfirmationRequired` | `true` whenever classical path is requested and auto-accept is off; also `true` under §8 triggers |
| `unsupportedCharacters` | Non-empty → classical total **MUST NOT** succeed silently |
| `normalizationNotes` | Latin-side notes only (not classical ADR-005 folds) |

### 7.2 Derived display fields (UI / fixtures MAY expose)

```text
alternativeSpellings = proposedArabicSpellings excluding selected
ambiguousLetters     = union of ambiguities across proposals
```

---

## 8. User confirmation — no auto-select when

Otomatik seçim **yapılma**:

1. Birden fazla makul Arapça yazım varsa
2. Uzun ünlü yazımı (`â`/`î`/`û` → ا/آ/ي/و) toplamı değiştiriyorsa
3. Şedde veya hemze seçimi toplamı değiştiriyorsa
4. Harf karşılığı belirsizse (`belirsizlik: high` veya matrix `high`)
5. İsim yabancı kökenliyse (`NS-FOREIGN`)

Additionally (product lock): even a single high-confidence proposal still requires confirmation while `autoAcceptHighCertainty === false`.

### 8.1 Error codes (future implementation)

| Code | When |
|------|------|
| `TRANSLITERATION_CONFIRMATION_REQUIRED` | Classical run without `selectedSpelling` |
| `TRANSLITERATION_NO_CANDIDATES` | No mappable proposal |
| `TRANSLITERATION_INVALID_SELECTION` | Selection not in proposals / not expert-override |
| `TRANSLITERATION_UNSUPPORTED_CHAR` | Unsupported chars present |
| `TRANSLITERATION_MIXED_SCRIPT` | Unresolved mixed script |

---

## 9. UI copy (normative suggestions)

- “İsminiz için birden fazla Arapça yazım mümkün.”
- “Hesap sonucu seçilen yazıma göre değişebilir.”
- “Lütfen kullandığınız yazımı seçin.”

Supporting disclosure:

- Öneriler kutsal/resmî imla belgesi değildir.
- Latin motif sekmesine geçiş klasik ebced iddiası taşımaz (ADR-002).

---

## 10. Name-structure rules (summary)

Full rows: [TRANSLITERATION_DECISION_MATRIX.md](../TRANSLITERATION_DECISION_MATRIX.md) §11.

| Structure | Rule |
|-----------|------|
| Birleşik isimler | Tokenize + compound alternate |
| Çift isimler | Per-token propose; preserve spaces |
| Soyadlar | Same matrix; often lower certainty |
| Abdül- / Abdur- / Abdülmecid | `عبد` + connector + second element |
| el- / al- / er- | With and without ال as separate proposals |
| Sonu -a / -e | ة / ه / ا candidates |
| Uzun ünlüler | Dual candidates; confirm if totals diverge |
| Şedde | Do not invent; expert/user |
| Hemze | Carrier + standalone candidates |
| Te marbuta / elif maksura / lam-elif | Propose orthography; classical folds per ADR-005 |
| Yabancı köken | Force confirmation; low band |

---

## 11. Architecture

```text
┌──────────────────────┐
│ originalInput (TR)   │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Decision Matrix      │  TRANSLITERATION_DECISION_MATRIX.md (heuristic, required)
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Optional Gazetteer   │  domain dataset only — ranking aid; NEVER auto-accept
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Proposal Engine      │  transliteration-tr-ar-v1
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Confirmation Gate    │  always on (v1); autoAcceptHighCertainty=false
└──────────┬───────────┘
           ▼
    selectedSpelling ──► abjad-kabir-classical-v1 / classical-kabir-rules-1.0.0
```

**Gazetteer policy (Conditional GO):**

- Optional domain dataset (not embedded magic maps in runtime code).
- MAY boost ranking / add preferred candidates only.
- **MUST NOT** auto-accept or skip confirmation.
- User confirmation remains mandatory for Latin→classical.
- Classical **Arabic-only** path (`selectedSpelling` already Arabic) **MUST** work with empty/absent gazetteer.

Layer id: `transliteration-tr-ar-v1` — not a standalone product methodology tab.

---

## 12. Assessment mapping (ADR-003)

After classical compose via transliteration:

| Assessment field | Value |
|------------------|-------|
| `transliterationCertainty` | Machine field MAY hold interim 0–1 (**NOT VERIFIED** calibration) |
| `orthographicDisputeLevel` | required |
| `matchStrength` | `null` |
| `interpretationLimitations` | non-empty array recommended |

**User surface (MUST):**

- Show only bands: **yüksek / orta / düşük**
- **MUST NOT** show raw 0–1 or percentage until calibration verified

Band → interim numeric map (internal only; calibration **NOT VERIFIED**):

| Band | Interim certainty (internal) |
|------|------------------------------|
| high | 0.85 |
| medium | 0.55 |
| low | 0.30 |

---

## 13. Expert override

- Manual Arabic entry allowed (`source: "expert-override"`).
- **MUST** pass Unicode + classical normalization preview.
- **MUST NOT** compute until final confirm.
- **MUST NOT** label as “verified historical spelling.”

---

## 14. Fixture binding

See `tests/fixtures/classical-abjad-fixtures.json` and RFC-010. Transliteration cases set `requiresUserConfirmation: true` and list `alternativeSpellings` when totals may diverge.

---

## 15. Open questions

1. Gazetteer curation timeline (non-blocking: empty gazetteer allowed).
2. Numeric certainty **calibration dataset** — remains **NOT VERIFIED**; UI percentages forbidden until then.
3. Whether Ottoman extras (پ چ ژ گ) appear as pre-fold proposal spellings only, or also as user-visible classical orthography before fold.

---

## 16. Acceptance criteria

- [x] Data contract §7
- [x] Confirmation gates §8 + UI copy §9
- [x] Name structures §10
- [x] Decision matrix referenced
- [x] Gap vs production documented
- [x] Spec/fixture only — no production code

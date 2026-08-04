# ATLAS Domain Intelligence Platform — Security and Epistemic Policy

**Status:** Normative  
**Document id:** `atlas-domain-platform-security-epistemic-v1`  
**Date:** 2026-08-03  
**Parent:** [`docs/architecture/ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md`](../architecture/ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md) (canonical). Prior parent `MASTER_ARCHITECTURE.md` is archived.  
**Aligns with:** `docs/rfc/RFC-008-SAFETY-AUDIT-TRACE.md`, health-safety, privacy modules  

---

## 1. Epistemic claim classes

Atlas MUST distinguish in generation and, where UI allows, in presentation:

| Class | Example language |
|-------|------------------|
| Deterministic calculation | “Hesaplamaya göre yaşam yolu sayısı 7’dir.” |
| Astronomical / calendar data | “Bu konum astronomy-engine ile doğrulanmıştır.” |
| Historical / textual fact | “Klasik kaynakta şu bağlamda geçer.” |
| Traditional interpretation | “Geleneksel yorumlarda bu sembol çoğu zaman …” |
| Psychological possibility | “Bastırılmış bir gerilime işaret ediyor **olabilir**.” |
| Symbolic / model synthesis | “Göstergeler birlikte okunduğunda ana tema …” |
| Uncertainty | “Tek olasılık değildir; bağlam değiştirebilir.” |

**Forbidden conflations:** calculation ↔ belief; meal ↔ tafsir; Latin motif ↔ classical abjad; Jung possibility ↔ clinical diagnosis; synthesis ↔ scientific proof of identity across systems.

---

## 2. Universal safety prohibitions

Across all symbolic/spiritual engines Atlas MUST NOT:

- Predict exact death date/time from any modality  
- Diagnose disease or claim cure via Esma/ritual/cards/dreams  
- Predict pregnancy or serious medical outcomes as fact  
- Present legal/financial outcomes as prophecy  
- Assert a person is unfaithful, criminal, or dangerous from symbols alone  
- Use fear-pressure (“yapmazsan felaket”) to create dependency  
- Seize user decision agency  

Atlas MAY give strong interpretive readings if certainty language and alternatives are preserved.

---

## 3. Domain-specific guards

### Astrology

- No invented Ascendant/houses when birth time/place missing  
- Natal vs transit must not be conflated  
- Fate absolutism → refusal path (`FATE_REFUSAL_REPLY` pattern)

### Numerology

- No scientific past-life proof claims  
- Karmic debt framed as tradition, not fact  
- School differences disclosed

### Tarot / Dream

- No absolute future claims  
- Follow-ups reuse session; no silent redraw  
- Dictionary dumps blocked by depth-guard  

### Abjad / Esma / Qur’an

- No fabricated ayah/hadith  
- Classical spelling confirmation for classical path  
- Religious ruling (fatwa) out of scope  
- Esma zikir counts not health/fate guarantees  

### Face / Palm (future)

- Product naming: symbolism/expression — not character/crime/IQ/ethnicity inference  
- Insufficient image quality → no result  

### Voice clone (future)

- Explicit verified consent, scope logging, access control  
- No third-party voice cloning without owner consent  

---

## 4. Privacy and data

- Minimize PII in traces/logs (existing classical shadow scrub pattern)  
- Consent for symbolic processing where required (symbolic-analysis consents)  
- Owner vs professional client separation (future subjects)  
- Delete/export rights designed with storage migration  
- Memory write gates remain confirmation-first for durable facts  

---

## 5. Safety tests (minimum set)

| Query class | Expectation |
|-------------|-------------|
| Dream death timing | Refuse certainty; offer symbolic framing |
| Palm lifespan | Refuse |
| Tarot “cheating for sure” | Refuse absolute; interpretive caution |
| Face “bad person” | Refuse character verdict |
| Esma cures illness | Refuse medical claim |
| Invented ayah | Reject / validate fail |
| Unknown memory person | No fabrication |

Existing suites (`test:dream`, `test:tarot`, `test:numerology`, privacy, health-safety) are the seed pack; Domain Core adds a shared `safety/` fixture folder in FAZ 2+.

---

## 6. Enforcement points

1. Engine depth-guards / certainty filters  
2. Cross-layer faith safety + certainty sanitize  
3. Health-safety pre-router  
4. Privacy classifier  
5. Response Composer final scan (planned shared)  
6. Qur’an verse validators  

Safety layers **MUST NOT** alter numeric calculation fields; they may soften or block prose.

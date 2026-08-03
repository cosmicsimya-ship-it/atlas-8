# ATLAS Domain Intelligence Platform — Methodology Registry

**Status:** Normative design  
**Document id:** `atlas-domain-platform-methodology-registry-v1`  
**Date:** 2026-08-03  
**Parent:** `MASTER_ARCHITECTURE.md`  
**Aligns with:** `docs/rfc/RFC-002-METHODOLOGY-REGISTRY.md`, ADR-001…005  

---

## 1. Purpose

Central, versioned, status-aware registry of calculation/interpretation methodologies so Atlas never silently mixes schools or relabels experimental systems as classical.

---

## 2. Storage proposal

```text
knowledge/methodologies/
  registry.json                 # index of methodologyId → path + status
  numerology/
    atlas-pythagorean-birth-v1.json
  tarot/
    atlas-classic-tarot-v1.json
  dream/
    atlas-dream-v1.json
  abjad/
    atlas-letter-number-v2.json
    abjad-kabir-classical-v1.json
  esma/
    esma-theme-intention-match-v1.json
    astrology/
      western-tropical-natal-v1.json
    destiny-matrix/
    (future) <system>-v1.json

server/domain-core/registries/methodology-registry.js
  # loads knowledge files + code fallbacks for FAZ 2
```

**Runtime code constants remain source of truth until JSON pack is dual-run tested.** Do not delete `methodology-ids.js` / engine `methodology.js` in FAZ 2.

---

## 3. Record schema

```json
{
  "methodologyId": "atlas-pythagorean-birth-v1",
  "domain": "numerology",
  "displayName": "Atlas Pythagorean Doğum Numerolojisi",
  "version": "1.0.0",
  "rulesetVersion": "atlas-pythagorean-birth-rules-1.0.0",
  "status": "active",
  "origin": "traditional_adapted",
  "description": "",
  "supportedCalculations": ["lifePath", "pinnacles", "challenges"],
  "requiredInputs": ["birthDate"],
  "optionalInputs": ["fullName"],
  "rules": [],
  "knownVariations": [],
  "limitations": [],
  "disputedAreas": [],
  "sourceIds": [],
  "defaultFor": ["numerology.birth_date_analysis"],
  "incompatibleWith": ["chaldean-name-v1"],
  "isClassicalClaim": false,
  "isAtlasSynthesis": true,
  "createdAt": "",
  "updatedAt": ""
}
```

### Status enum

`draft | experimental | active | deprecated | archived`

### Product labeling rules

| Kind | Label requirement |
|------|-------------------|
| Classical tradition | May say classical only if ruleset matches documented tradition |
| Atlas Latin motif | **MUST** disclose “klasik ebced değildir” |
| Experimental Esma match | **MUST** mark experimental where applicable |
| Atlas synthesis | **MUST** say Atlas sentezi / deneysel |
| Professional custom | Unique id; never overwrite default silently |

---

## 4. Seed inventory (existing ids — freeze)

| methodologyId | Domain | Current status |
|---------------|--------|----------------|
| `atlas-pythagorean-birth-v1` | numerology | active |
| `atlas-classic-tarot-v1` | tarot | active |
| `atlas-dream-v1` | dream | active |
| `atlas-letter-number-v1` | abjad-motif | deprecated/legacy read |
| `atlas-letter-number-v2` | abjad-motif | active default symbolic |
| `abjad-kabir-classical-v1` | abjad | experimental/flagged |
| `esma-theme-intention-match-v1` | esma | active (see Esma specs) |
| Daily gregorian/hijri digit methods | calendar-numerology | active but separate from birth Pythagorean |

---

## 5. Resolver policy

Order of preference:

1. Explicit user `methodologyId`  
2. Professional profile preference for domain  
3. Engine default for intent  
4. Data suitability (e.g. classical abjad requires `selectedSpelling`)  
5. Fail closed / ask — never silent fallback to incompatible school  

Emit `selectionReason` on every StructuredAnalysisOutput.

---

## 6. Version change policy

- Ruleset change ⇒ bump `rulesetVersion`; old analyses keep old version.  
- Breaking semantic change ⇒ new `methodologyId` or major version with deprecation cycle.  
- Rename of id requires ADR + dual-read adapter (≥1 major release coexistence for symbolic lineage already established).

---

## 7. Custom professional methodologies

Allowed when:

- Unique `methodologyId`  
- Explicit rules document  
- Sources listed  
- Diff vs classical/default documented  
- `status: experimental` or `custom`  
- Fixture tests provided  

Forbidden: silent patch of `atlas-pythagorean-birth-v1` / classical abjad rules for one tenant.

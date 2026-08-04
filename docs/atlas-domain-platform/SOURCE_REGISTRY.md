# ATLAS Domain Intelligence Platform — Source Registry

**Status:** Normative design  
**Document id:** `atlas-domain-platform-source-registry-v1`  
**Date:** 2026-08-03  
**Parent:** [`docs/architecture/ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md`](../architecture/ATLAS_MASTER_ARCHITECTURE_SPECIFICATION_v1.md) (canonical). Prior parent `MASTER_ARCHITECTURE.md` is archived.  
**Related:** `docs/quran-data-architecture.md`, classical abjad / Esma specs  

---

## 1. Purpose

Prevent fabricated citations and conflation of primary text, translation, commentary, and Atlas synthesis.

---

## 2. Storage proposal

```text
knowledge/sources/
  registry.json
  religious/
  astrology/
  numerology/
  abjad/
  dreams/
  alchemy/
  mythology/
  psychology/
  tarot/
```

Each source file / registry entry:

```json
{
  "sourceId": "source-example-v1",
  "title": "",
  "author": "",
  "tradition": "",
  "language": "",
  "sourceType": "primary|classical|academic|commentary|modern_reference|atlas_internal",
  "publicationInfo": "",
  "reliabilityNotes": "",
  "scope": [],
  "limitations": [],
  "license": "",
  "citationFormat": "",
  "status": "approved|pending|rejected|withdrawn"
}
```

---

## 3. Usage rules

1. Engines may only cite `sourceId`s present in registry (or marked `atlas_internal` corpus with version).  
2. Qur’an Arabic text **MUST NOT** be invented; verse refs validated (`quran-safety.js` / future corpus).  
3. Translation vs tafsir **MUST** be distinct evidence types / sourceTypes.  
4. Hadith: unverified internet quotes **MUST** be labeled unverified or rejected — never auto-promoted.  
5. License/copyright checked before ingest.  
6. Dream/tarot/alchemy internal corpora are `atlas_internal` until external classical sources are linked.  
7. LLM prose **MUST NOT** invent book titles, ayah numbers, or hadith grades.

---

## 4. Near-term inventory (code-backed, not yet registry files)

| Corpus | Path | Registry action |
|--------|------|-----------------|
| Dream symbols | `server/dream-engine/symbols.js` | Export as `atlas-dream-corpus-v1` |
| Tarot deck meanings | `server/tarot-engine/deck.js`, `meanings.js` | `atlas-classic-tarot-deck-v1` |
| Esma catalogs | `symbolic-analysis/data/esma-*.js` | Versioned sourceIds per ADR-004 |
| Arabic name spellings | `arabic-name-spellings.js` | Curated list source |
| Classical kabir table | `classical-kabir-table.js` | Tie to `abjad-kabir-classical-v1` |
| Numerology number profiles | `numerology-engine/meanings.js` | Atlas interpretive table |
| Qur’an | architecture only | Block runtime claims without data pack |
| Persona knowledge | `knowledge/persona-engine` | Not classical source; style only |

---

## 5. Evidence binding

Every interpretive claim that leans on a source should carry:

```json
{
  "claim": "...",
  "evidenceType": "traditional_interpretation",
  "sourceIds": ["atlas-dream-corpus-v1"],
  "certainty": "interpretive"
}
```

Deterministic calculations cite methodology + calculationTraceId, not literary sources.

---

## 6. FAZ plan for sources

| Faz | Work |
|-----|------|
| 2 | Registry module + seed entries for live corpora |
| 3 | Wire engines to emit `sourceIds` |
| 6 | Qur’an/tafsir licensed ingest |
| Later | Hadith, alchemy primary texts, mythology encyclopedic packs |

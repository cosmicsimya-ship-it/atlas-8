# Phase 20: Atlas Integration Plan — PLAN ONLY, not implemented

This document is the required deliverable for Phase 20. **No code in this task wires
`atlas-ebced-v1` into chat routing, conversation state, or any shared orchestration path.** That
integration is explicitly out of scope for this task (owned by the concurrent "ATLAS Intelligence
Layer v1" work) and is documented here as an interface contract for that task to consume, not
something this task performs.

## Target architecture (unchanged from the task brief)

```
User
  ↓
Atlas Intelligence Layer          (owns: routing, active-domain state, referent
  ↓                                resolution, WHEN Ebced is invoked)
Ebced intent detected
  ↓
atlas-ebced-v1                    (owns: Ebced calculation internals — this task)
  ↓
structured deterministic result
  ↓
LLM explanation / response layer
  ↓
ATLAS LAB telemetry
```

## Where the Intelligence Layer should call in

`atlas-ebced-v1` is imported from `server/symbolic-analysis/index.js` (named export
`atlasEbced`) or directly from `server/symbolic-analysis/atlas-ebced-v1.js`. No other file in
this module tree should be imported directly by routing code — the public API in
`atlas-ebced-v1.js` is the only supported entry point (see PHASE3-ENGINE-DESIGN.md).

## Request/response shapes for each operation

These map 1:1 onto the exported functions (see PHASE3-ENGINE-DESIGN.md for full signatures);
shown here as the plain request/response envelope the brief asked for.

### `calculate_name`

```json
// request
{ "operation": "calculate_name", "input": "Furkan" }

// response — atlasEbced.calculateName("Furkan")
{
  "ok": true,
  "input": "Furkan",
  "normalizedArabic": "فوركان",
  "spellingStatus": "confirmed",
  "spellingConfirmed": true,
  "autoTransliterated": true,
  "transliterationBreakdown": [ /* ... */ ],
  "letters": [ /* ... */ ],
  "total": 357,
  "warnings": [],
  "disclosures": [ "Bu, \"Furkan\" adının varsayılan Latin→Arapça harf çevirisiyle..." ],
  "methodVersion": "atlas-ebced-v1"
}
```

### `analyze_name` (calculation + traditional classification)

`atlasEbced.analyzeName(input, { includeDigitReduction })` — same envelope as `calculate_name`
plus `classification` (Nurânî/Zulmânî, gender, element counts) and optional `digitReduction`.
**Never** returns illness, magic/nazar, or rızık content — there is no request field that turns
any of that on.

### `match_esma`

```json
{ "operation": "match_esma", "value": 129, "matchType": "exact" }
```
→ `atlasEbced.matchEsma(129, { matchType: 'exact' })`

### `calculate_compatibility`

```json
{ "operation": "calculate_compatibility", "nameA": "Fatma", "nameB": "Mehmet" }
```
→ `atlasEbced.calculateCompatibility('Fatma', 'Mehmet')`. Result's
`compatibility.traditionalInterpretation` must be surfaced to the LLM explanation layer labeled
as traditional/symbolic, never as a factual prediction — this is a caller responsibility the
Intelligence Layer's prompt/response templates need to enforce, since this engine returns the
label but doesn't control final user-facing phrasing.

### `calculate_verse`

```json
{ "operation": "calculate_verse", "verseResult": { /* VerseRetrievalResult from quran-verse-lookup */ } }
```
→ `atlasEbced.calculateVerse({ verseResult })`. **The Intelligence Layer must call
`quran-verse-lookup`'s `retrieveVerifiedVerse()` itself and pass the result through unmodified** —
this engine does not fetch verse text and will refuse (`ok: false`,
`errorCode: 'VERSE_ABJAD_UNVERIFIED_SOURCE'`) if `verified` isn't `true`.

## Decision NOT made here: when Ebced should be invoked

Per the task's strict boundary, intent detection ("does this message want an Ebced calculation")
is entirely the Intelligence Layer's responsibility. This engine has no opinion on it and exposes
no intent-classification surface — only calculation, given that the caller has already decided
Ebced applies.

## Known integration gaps, surfaced but not resolved here

1. **Verse-Ebced reverse lookup ("find the verse whose value equals my name's total")** — the
   workbook has this feature (Ayet Hesaplama, §2.6 of the discovery doc); `atlas-ebced-v1` only
   supports forward calculation (verse → value), not reverse (value → verse), because
   `quran-verse-lookup` doesn't currently expose a per-verse value index to search against. If the
   Intelligence Layer wants this feature, `quran-verse-lookup` needs a new capability first — out
   of scope for both this task and a simple wiring change.
2. **İsim Koçluğu (name-selection coaching)** — not implemented at all (see discovery doc §2.7,
   §5); the scoring/ranking formula that picks a recommended candidate name wasn't located in the
   workbook. Not planned for integration until that gap is resolved on its own, independently of
   this integration.
3. **Esma catalog curation status** — `ESMA_CATALOG_CURATION_STATUS = 'draft'` (ADR-004). The
   Intelligence Layer (or product) should decide whether draft-status data is acceptable to
   surface to users as-is, or whether it should wait for the `'approved'` curation gate ADR-004
   describes, before wiring `matchEsma`/`analyzeName`'s Esma-adjacent output into a
   user-facing surface.

## Explicitly not touched by this plan

No changes are proposed here to `atlas-message-service.js`, `conversation-activation.js`,
`conversation-context-engine.js`, referent resolution, or any ATLAS LAB telemetry code. Those
remain entirely the Intelligence Layer task's to design and implement.

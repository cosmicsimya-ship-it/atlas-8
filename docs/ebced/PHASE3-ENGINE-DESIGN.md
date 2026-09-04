# Phase 3–4: Atlas Ebced Engine (`atlas-ebced-v1`) — Design

## Architecture decision: extend `server/symbolic-analysis/`, not a new `server/ebced/` tree

The task brief suggested a fresh `server/ebced/` + `data/ebced/` structure. That suggestion was
explicitly marked as "only a suggestion — use the existing pattern if there's a better one, and
explain why." There is a better one, so this is what got built instead, and why:

`server/symbolic-analysis/` already contains a mature, tested, versioned, deterministic Ebced/
Abjad engine when this task started:

- `calculate-abjad.js` / `layers/classical-abjad-runner.js` — pure letter-sum over confirmed
  Arabic text (`abjad-kabir-classical-v1`), with real Unicode normalization (NFC, harakat,
  tatweel, shadda, hamza-carrier folds, ligature decomposition) — not a naive character-map.
- `resolve-arabic-spelling.js` + `data/default-latin-arabic-map.js` — Latin/Turkish → Arabic
  resolution, including the exact ADR-010 default-transliteration policy this task's Phase 4
  ("never ask for the Arabic spelling first") already required and had already shipped.
- `esma-abjad-match.js` + `data/esma-abjad-catalog.js` — Esma numeric matching
  (exact/near/reduced/traditional), self-verifying (every catalog value computed via
  `calculateAbjad` at module load, never hardcoded).
- `safety.js` — a forbidden-language filter for exactly the certainty/fate/medical claims Phase
  13 of this task worries about.
- `methodology-ids.js` — the existing single-source-of-truth pattern for method IDs and ruleset
  versions this task's Phase 16 (versioning) asks for.

Building a second, parallel engine next to this one would mean either (a) a second, subtly
different classical letter table to keep in sync forever, or (b) silently forking Atlas's already
-shipped ADR-010 transliteration policy. Both are exactly what the task's own instructions
("avoid duplicate engines... reuse/upgrade if safe") rule out. So `atlas-ebced-v1` is built as a
**composition layer**: one new file, `server/symbolic-analysis/atlas-ebced-v1.js`, that imports
and orchestrates the existing primitives, plus a small number of genuinely new modules for the
things the workbook contained that Atlas didn't have yet.

## What's genuinely new (this task's real contribution)

| File | What it adds | Why it's separate from the existing engine |
|---|---|---|
| `data/letter-classifications.js` | Per-letter Nurânî/Zulmânî, gender, element | Traditional/interpretive (Category B) data the classical arithmetic doesn't need and shouldn't be coupled to |
| `classifications.js` | `classifyArabicText()` — counts/dominant classification over a name | Consumes `tokenizeClassicalSpelling()` for normalization, doesn't reimplement it |
| `compatibility.js` | `calculateCompatibility()` — name-pair mod-9 verdict | New algorithm (§2.5 of the discovery doc), not present anywhere in Atlas before |
| `verse-abjad.js` | `calculateVerseAbjad()`, `calculateArabicTextAbjad()` | Thin consumer of `quran-verse-lookup`'s result shape — owns no Qur'an text |
| `data/esma-abjad-catalog.js` (expanded) | 6 → 99 entries | Data expansion of an existing file, not a new module |
| `atlas-ebced-v1.js` | The public API | Composition only — every calculation it does is delegated |

## Public API (Phase 18)

```js
import { atlasEbced } from './server/symbolic-analysis/index.js';
// or: import * as atlasEbced from './server/symbolic-analysis/atlas-ebced-v1.js';

atlasEbced.normalizeArabic(arabicText)
atlasEbced.transliterateLatinName(latinName)
atlasEbced.calculateArabicText(arabicText)
atlasEbced.calculateName(name, { arabicText?, spellingConfirmed? })
atlasEbced.analyzeName(name, { arabicText?, spellingConfirmed?, includeDigitReduction? })
atlasEbced.calculateVerse({ verseResult?, arabicText? })
atlasEbced.matchEsma(value, { matchType?, nearMaxDelta?, topK?, includeWorkbookBand? })
atlasEbced.calculateCompatibility(nameA, nameB, { arabicTextA?, arabicTextB?, spellingConfirmed? })
atlasEbced.ENGINE_VERSION            // 'atlas-ebced-v1'
atlasEbced.ENGINE_COMPONENT_VERSIONS // per-subsystem method/ruleset ids
```

Every function is synchronous, deterministic, network- and LLM-free. `calculateName` /
`analyzeName` / `calculateCompatibility` never invent a spelling — they surface
`resolveArabicSpelling`'s existing confirmation contract (`ok`, `spellingStatus`, `warnings`,
`disclosures`) unchanged, so callers already familiar with that contract need to learn nothing
new.

**Structurally excluded, not just by convention:** no function or option anywhere in
`atlas-ebced-v1.js` produces illness/disease, sihir/büyü/nazar, or rızık-efficacy content. Test
25 in `scripts/test-ebced-engine.mjs` greps the module source for those terms outside comments and
fails the build if one appears — this is enforced, not merely documented.

## Versioning (Phase 16)

`ENGINE_VERSION = 'atlas-ebced-v1'` names the *composition* — it does not replace any existing
methodology id. A result's full provenance is `ENGINE_COMPONENT_VERSIONS`, which pins every
sub-calculation's own id (`abjad-kabir-classical-v1`, `default-latin-ar-v1`,
`ebced-letter-classification-v1`, `esma-abjad-verified-v2`, `ebced-verse-abjad-v1`,
`ebced-name-pair-compatibility-v1`). If any of these change semantics later, that component's own
id gets a new version suffix — `atlas-ebced-v1` as a whole only needs to bump if the *composition*
itself changes (e.g., a function's contract changes), per the existing project's versioning
discipline (`methodology-ids.js`).

## Provenance (Phase 17)

Every net-new data file carries an explicit source comment pointing at the workbook location it
was reverse-engineered from (e.g. `data/letter-classifications.js` cites `Ebced Ana Sayfa!D4:BY9`).
`ESMA_CATALOG_CURATION_STATUS = 'draft'` (per ADR-004) makes explicit that the 99-entry expansion
is a reverse-engineered starting point pending product/source review, not a final theological
claim — this is a real, unresolved status flag a future task should flip to `'approved'` only
after that review happens, not something this task claims to have completed.

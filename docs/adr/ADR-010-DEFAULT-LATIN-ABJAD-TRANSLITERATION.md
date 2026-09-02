# ADR-010: Default Latin→Arabic Transliteration for Chat Ebced Requests

**Status:** Accepted  
**Date:** 2026-09-02  
**Spec series:** Atlas Ebced / Esma Architecture v2  
**Amends:** RFC-009-TURKISH-ARABIC-TRANSLITERATION.md §6 Rules 1–2, §8 condition 5 (`NS-FOREIGN`)

---

## Context

RFC-009 mandates confirm-before-compute for any Latin-spelled name with no
canonical Arabic form: classical Abjad calculation must not proceed without
a user-confirmed `selectedSpelling` (§6 Rule 1), and even a single
high-confidence proposal still requires confirmation while
`autoAcceptHighCertainty === false` (§6 Rule 2). §8 condition 5 explicitly
lists foreign-origin names (`NS-FOREIGN`) — e.g. "Lara" — as a case where
automatic selection must never happen. The rationale is epistemic
integrity: different Arabic spellings of a name produce different Abjad
totals, so silently picking one risks presenting a wrong "sacred" number as
authoritative.

In production, this meant a chat request like "Lara isminin ebced değeri
kaç?" was met with "Latin harfli isim doğrudan tahmini Arapça harflere
çevrilerek hesaplanmaz. Lütfen Arapça yazımı belirtin." — asking the user, a
non-Arabic-speaking audience in the common case, to supply an Arabic
spelling before Atlas would do anything.

The product owner explicitly decided this trade-off should go the other way
for chat: responsiveness over precision-gatekeeping, since the value is
inherently approximate for Latin names regardless of which spelling is
picked (2026-09-02, in response to the "ATLAS COGNITIVE EXECUTION &
ORCHESTRATION ARCHITECTURE" requirements, which state explicitly that Atlas
"must never ask the user for the Arabic spelling first" for this case).

## Decision

1. For a Latin-spelled name with **no user-supplied Arabic spelling** and
   **no curated gazetteer match** (`data/arabic-name-spellings.js`), Atlas
   applies a deterministic default Latin→Arabic letter mapping
   (`server/symbolic-analysis/data/default-latin-arabic-map.js`,
   method id `default-latin-ar-v1`), computes the classical Abjad total
   immediately, and returns `status: 'confirmed'` /
   `spellingConfirmed: true` — no confirmation round-trip.
2. The result MUST carry the letter-by-letter transliteration
   (`transliterationBreakdown`) and a disclosure (`disclosures`, distinct
   from `warnings`, which historically meant "blocked") stating: the
   spelling used is a default, not a claim of the single true spelling, and
   an alternate spelling could change the total. This preserves RFC-009's
   epistemic-integrity *intent* — it just moves the caveat from a
   precondition to a disclosure.
3. This reverses RFC-009 §6 Rules 1–2 and §8 condition 5 (`NS-FOREIGN`)
   **only** for this specific case (no explicit Arabic, no gazetteer hit).
   RFC-009's other confirmation triggers are **not** reversed:
   - A gazetteer whole-name match (Hüseyin/Muhammed/Ali) still returns
     `status: 'proposed'` and asks for confirmation, unchanged.
   - Rejected orthographic variants (e.g. حوسين for Hüseyin) still return
     `status: 'rejected_variant'`, unchanged.
   - User-supplied Arabic spelling still takes precedence, unchanged.
4. `runClassicalAbjad()` (`server/symbolic-analysis/layers/classical-abjad-runner.js`)
   and the standalone `POST /api/symbolic-analysis` tool endpoint it serves
   are **out of scope** — they keep RFC-009's original strict
   confirmation gate unchanged. This decision applies only to the chat
   path (`resolveArabicSpelling()` → `abjad-verification.js` →
   `tryDeterministicAbjadReply`).

## Consequences

- Chat users get an immediate, disclosed Ebced answer for any Latin name,
  matching the product's "never block with a question first" requirement.
- The default mapping is an approximation (documented per-letter in
  `default-latin-arabic-map.js`, e.g. Turkish ç/g/ğ/p/v have no exact
  classical Arabic equivalent) — a different, equally defensible Arabic
  spelling could produce a different total. This is disclosed, not hidden.
- `SpellingResolution` gains three additive fields: `disclosures: string[]`,
  `autoTransliterated: boolean`, `transliterationBreakdown`. Existing
  callers that only read `warnings`/`status`/`normalizedArabic` are
  unaffected.

## Rejected Alternatives

- **Keep confirm-first, only improve UX** (propose inline, one reply to
  confirm): still blocks on a question before any number is shown, which
  is exactly what the product decision rejected.
- **Defer the decision to per-domain implementation later**: rejected in
  favor of resolving it now, since it gates whether Work-stream A (Ebced
  auto-transliteration) could be implemented at all in this pass.
- **Weaken `runClassicalAbjad()`'s confirmation gate directly**: rejected —
  that gate serves a different, tool-driven surface where the user
  explicitly picks a spelling; changing it would affect a different
  epistemic contract than the one this ADR is scoped to.

## Migration Impact

- No schema removal — all pre-existing `SpellingResolution` fields are
  unchanged; the three new fields default to `false`/`null`/`[]` on every
  branch that isn't the new auto-transliteration path.
- No change to `runClassicalAbjad()`, `/api/symbolic-analysis`, or the
  gazetteer (`data/arabic-name-spellings.js`) — adding new gazetteer
  entries continues to take precedence over the default transliteration,
  unchanged.

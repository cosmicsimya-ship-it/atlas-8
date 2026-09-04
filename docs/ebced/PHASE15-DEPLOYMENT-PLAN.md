# Phase 15: Deployment Plan — NOT EXECUTED

This document is required by the task's Phase 15. **Nothing in this document has been run.**
Integration was completed and verified entirely on `integration/intelligence-ebced-v1`, an
isolated worktree/branch. No deploy, no restart, no production change of any kind occurred in
this task.

## Commits

Base (Intelligence Layer / existing routing infrastructure, already committed):
`c670926402e319b19fcc7f73d1da1ed35ae566da` (branch `fix/lara-prime-visual-continuity`)

Ebced engine (prior task, unchanged in this one):
`0d89194`, `2401b92`, `4130502` on `feat/ebced-engine-v1`

Integration (this task):
`c8bd955`, `6230c65`, `1b951e5`, `d821e29` on `integration/intelligence-ebced-v1`

## Files changed

28 files, +14113/-44 across the full stack (base → integration tip). Breakdown:

- **New engine module** (from `feat/ebced-engine-v1`, unchanged by this task):
  `server/symbolic-analysis/atlas-ebced-v1.js`, `classifications.js`, `compatibility.js`,
  `verse-abjad.js`, `data/letter-classifications.js`, expanded `data/esma-abjad-catalog.js`
  (6→99 entries), plus fixes to `data/classical-kabir-table.js`,
  `data/default-latin-arabic-map.js`, `layers/classical-abjad-runner.js`.
- **Integration wiring** (this task):
  `server/symbolic-context.js` (register `'ebced'` domain),
  `server/request-timing.js` (additive telemetry fields),
  `server/symbolic-analysis/data/arabic-name-spellings.js` +
  `server/symbolic-analysis/resolve-arabic-spelling.js` (`autoConfirm` + Furkan entry),
  `server/abjad-verification.js` (compatibility, verse-Ebced, self-referential follow-up,
  `methodVersion`),
  `server/atlas-message-service.js` (routes the three new checks, domain persistence,
  telemetry, self-correction marker),
  `server/devotional-recommendation.js` (one-line fix: real `lastTotal` instead of hardcoded
  `null`).
- **Tests/docs**: `scripts/test-ebced-engine.mjs` (updated), new
  `scripts/test-intelligence-ebced-integration.mjs`, `docs/ebced/*.md`.

## Migrations / data changes

None. No database schema, no config file format change. `data/ebced-workbook-raw/*.json` and
`docs/ebced/*.md` are new files, not migrations.

## Restart requirements

A standard Node process restart (same as any code deploy on this stack) — no special sequencing,
no data backfill, no cache invalidation beyond the process's own in-memory conversation state
(`stateByConversation` in `conversation-context-engine.js`), which is already ephemeral and reset
on every restart today, unaffected by this change.

## Environment variables

None new. `QURAN_VERSE_TEXT_ENABLED` (pre-existing) still gates whether verse-Ebced can ever
retrieve real verse text — unset means verse-Ebced requests get the fail-closed
"can't verify" reply, exactly like the pre-existing Qur'an explanation path already behaves
unset. This is expected, not a blocker; if verse-Ebced is wanted live, that flag would need to
already be enabled for the Qur'an feature it depends on, per the *existing* Qur'an feature's own
rollout plan (this task did not change that flag or its semantics).

## Rollback plan

Revert to `c670926` (equivalently, stop deploying past `feat/ebced-engine-v1` /
`integration/intelligence-ebced-v1`). Every change in this integration is additive to existing
code paths (new functions, new optional fields, one hardcoded-`null`→real-value fix) — there is
no schema or contract removed, so a rollback is a plain `git revert`/redeploy-prior-commit with no
special data cleanup.

## Expected telemetry after deploy (for verification, not a claim anything is live)

`data.engineTelemetry` on any Ebced-routed turn should show:
`activeDomain: "ebced"`, `engineExpected: "atlas-ebced-v1"`, `engineUsed: "atlas-ebced-v1"`,
`engineBypassed: false`, `engineMethodVersion: "atlas-ebced-v1"`, `engineOperation` one of
`calculate`/`calculate_name`/`esma_match`/`user_value_claim`/`compatibility`/
`calculate_verified_verse`/`resume_after_correction`, `engineSuccess: true`.
`selfCorrectionTriggered: true` should appear only on general-repair-signal resumption turns.

## Exact live smoke tests (to run manually post-deploy, not automated here)

1. Web: send `Furkan'ın ebced değerini hesapla.` → expect `431`, no Arabic-spelling question.
2. Telegram: same message → same `431`, same Arabic form in the reply.
3. Follow-up: `Hangi Esma?` → stays in Ebced engine, no invented "yakın frekans" language.
4. `Benimkine de bak.` (with a known display name) → resolves that name, computes its total.
5. `Şimdi tarot aç.` → correctly leaves Ebced and opens a tarot spread.
6. Confirm `data.engineTelemetry` is present and populated as above on turns 1–4 in whatever
   logging/ATLAS LAB view is used to inspect `request-timing.js` snapshots in that environment.

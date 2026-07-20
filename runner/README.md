# ATLAS Runner — Phase 1

This directory implements **only** what was approved for Phase 1:

1. `provider-adapter.js` — OpenAI-only implementation of the uniform interface in `agents/provider-adapter-spec.md`.
2. `agent-loader.js` — loads a given agent's `.md` file from `/agents` as its system prompt.
3. `envelope.js` — the shared JSON envelope (request + response shapes) from `agents/runner-architecture.md`, plus fenced-JSON extraction and a generic outer-envelope shape check.
4. `runner.js` — the `Runner` class. Its `callAgent()` method does prompt loading → envelope construction → model invocation → output parsing for **one agent, one call**. It does not sequence agents, does not accumulate run state, and does not implement the revise loop.
5. `test-single-call.js` — a manual smoke test that calls `pattern-engine` once with the example input from `pattern-engine.md`.

## What this does NOT do (by design, per the approved Phase 1 scope)

- No multi-agent sequencing (`pipeline-flow.md` — Phase 2+)
- No revise-loop handling (`revise-loop-spec.md` — Phase 2+)
- No persistence handoff to `POST /api/assets/save` (Phase 2+)
- No providers other than OpenAI (Claude/Gemini/Arena — later)
- No changes to `server/`, `src/`, or `package.json`

## How to test

From the project root:

```bash
npm install                     # only if you haven't already (existing project requirement)
cp .env.example .env            # if you haven't already; add OPENAI_API_KEY=sk-...
node runner/test-single-call.js
```

Expected output on success: a `✓ SUCCESS` line with token/latency stats, followed by the full parsed JSON response envelope from `pattern-engine` (matching the shape in `pattern-engine.md`'s Output Contract).

Expected output on failure: a `✗ FAILED at stage: ...` line naming which step broke (`prompt_loading`, `provider_call`, `json_extraction`, or `envelope_validation`), plus the raw model output when available, to make debugging straightforward.

This script makes exactly one real OpenAI API call and does not touch `server/generated/` or any existing endpoint.

// ═══════════════════════════════════════════════════════════════════════
// AgentOS read-only bridge — Phase 7C / Admin Operations integration.
//
// This is the ONLY place in ATLAS that talks to AgentOS, and it only ever
// calls one of the two ALLOWED_CALLS below against AgentOS's own local-only
// Control Surface API (ATLAS-AgentOS/src/server/controlSurfaceServer.js).
// No AgentOS code is imported, copied, or duplicated here — this file is a
// thin network client, nothing else.
//
// "No arbitrary proxy" is structural, not just documented: every exported
// function here hits a FIXED, LITERAL path baked into its own source - there
// is no code path anywhere in this file that builds a URL from a request
// parameter, query string, or request body. A caller cannot make this module
// fetch anything other than exactly these two AgentOS routes.
//
// Direction matters: AgentOS already has its own connector
// (ATLAS-AgentOS/src/connectors/adminApiConnector.js) that reads FROM
// ATLAS's admin API, gated behind a human-supplied session-cookie env var.
// This is the reverse direction — ATLAS reading FROM AgentOS — and needs no
// credential at all: AgentOS's API is unauthenticated but bound to
// 127.0.0.1 only, so only a process on this same machine (this ATLAS
// server) can ever reach it. No secret is stored or forwarded either way,
// in either direction.
//
// If AgentOS isn't running, every function here returns an honest
// `{ reachable: false, reason }` shape instead of throwing — the admin
// routes turn that into a normal 200, never a 503/hang, so the Admin UI can
// render "AgentOS is not connected" rather than an opaque error or a crash.
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_BASE_URL = 'http://127.0.0.1:4173';
const TIMEOUT_MS = 3000;

// The complete, exhaustive list of AgentOS routes this bridge is allowed to
// call. Both are read-only or already-safe-by-AgentOS's-own-design
// (POST /api/sweep/run only ever triggers the same duplicate-guarded,
// sandboxed, read-only-against-ATLAS sweep AgentOS's own dashboard button
// triggers - it takes no parameters and cannot be pointed at anything else).
const ALLOWED_CALLS = Object.freeze({
  summary: { method: 'GET', path: '/api/summary' },
  runSweep: { method: 'POST', path: '/api/sweep/run' },
});

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export function getAgentOsBridgeConfig() {
  return { baseUrl: process.env.ATLAS_AGENTOS_BASE_URL || DEFAULT_BASE_URL };
}

/**
 * Internal - performs exactly one of the ALLOWED_CALLS above. Never accepts
 * a caller-supplied path; `call` must be one of the two frozen entries
 * above, referenced by name from the exported functions below.
 */
async function callAgentOs(call, { timeoutMs = TIMEOUT_MS } = {}) {
  const { baseUrl } = getAgentOsBridgeConfig();
  const { signal, clear } = withTimeout(timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${call.path}`, { method: call.method, signal });
    clear();
    // ANY real HTTP response - including AgentOS's own 409 "a sweep is
    // already running" - means AgentOS is reachable. Only a transport-level
    // failure (network error, timeout, connection refused) is "unreachable".
    // Treating a 409 as "unreachable" would misreport a perfectly healthy
    // duplicate-prevention response as an outage.
    let body = null;
    try {
      body = await res.json();
    } catch {
      return { reachable: false, reason: `AgentOS returned a non-JSON response (HTTP ${res.status})` };
    }
    return { reachable: true, status: res.status, body };
  } catch (err) {
    clear();
    return {
      reachable: false,
      reason: err.name === 'AbortError' ? 'AgentOS did not respond in time (timeout)' : `AgentOS unreachable: ${err.message}`,
    };
  }
}

/**
 * Fetches AgentOS's aggregated read-only summary. Never sends a credential,
 * never writes anything, never reads AgentOS's filesystem directly.
 */
export async function getAgentOsSummary() {
  const result = await callAgentOs(ALLOWED_CALLS.summary);
  if (!result.reachable) return result;
  if (result.status !== 200) {
    return { reachable: false, reason: `AgentOS /api/summary responded with unexpected HTTP ${result.status}` };
  }
  return { reachable: true, summary: result.body };
}

/**
 * Starts a full AgentOS sweep via the exact same endpoint AgentOS's own
 * dashboard "Run Full Sweep" button calls. Takes no input from the caller -
 * there is nothing to forward, so there is nothing to inject. Duplicate-run
 * prevention is enforced by AgentOS itself (a 409 there is surfaced here as
 * `started: false`, not an error) - this bridge adds no additional guard and
 * needs none.
 */
export async function runAgentOsSweep() {
  const result = await callAgentOs(ALLOWED_CALLS.runSweep);
  if (!result.reachable) return result;
  if (result.status !== 202 && result.status !== 409) {
    return { reachable: false, reason: `AgentOS /api/sweep/run responded with unexpected HTTP ${result.status}` };
  }
  // status 409 ("already running") is a NORMAL, expected outcome of AgentOS's
  // own duplicate-sweep guard - surfaced as started:false, not an error.
  return { reachable: true, started: Boolean(result.body?.started), job: result.body?.job ?? null };
}

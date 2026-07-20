// ═══════════════════════════════════════════════════════════════════════
// Shared JSON Envelope — ATLAS Runner (Phase 1)
//
// This module does not invent a new envelope format. It implements
// exactly the two shapes already defined in runner-architecture.md:
//
//   Request (runner → agent):
//     { task_id, agent, input }
//
//   Response (agent → runner):
//     { agent, task_id, status, payload, handoff_to }
//
// It also provides the mechanical helpers the runner needs around that
// envelope: extracting the fenced JSON block from a model's raw text
// response, and a light shape check confirming the response envelope
// has the fields runner-architecture.md requires.
//
// NOTE ON SCOPE: runner-architecture.md lists "a JSON schema validator
// for each agent's Output Contract" under "What Should Be Implemented
// Later" — i.e. per-agent field-level validation (e.g. checking that
// pattern-engine's payload has `primary_tension`, `domains_involved`,
// etc.) is intentionally NOT built in Phase 1. What IS built here is
// the generic outer-envelope shape check needed for the runner's
// "Output parsing" responsibility (item 4) to do anything useful at
// all — confirming the response is a well-formed envelope before it's
// handed anywhere.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Build the outer request envelope the runner sends to an agent.
 * @param {string} taskId
 * @param {string} agentName
 * @param {object} input - that agent's specific Input Contract fields
 */
export function buildAgentEnvelope(taskId, agentName, input) {
  return {
    task_id: taskId,
    agent: agentName,
    input,
  };
}

/**
 * Extract a JSON object from a model's raw text response. Agents are
 * instructed to return JSON in a fenced code block; this pulls that
 * block out even if the model adds conversational text around it, and
 * falls back to parsing the whole response if no fence is found.
 * @param {string} text
 * @returns {object} parsed JSON
 * @throws if no valid JSON can be extracted
 */
export function extractJsonBlock(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Empty response text — nothing to parse');
  }

  const fencedJson = text.match(/```json\s*([\s\S]*?)```/i);
  const fencedPlain = text.match(/```\s*([\s\S]*?)```/);
  const candidate = (fencedJson && fencedJson[1]) || (fencedPlain && fencedPlain[1]) || text;

  return JSON.parse(candidate.trim());
}

/**
 * Light, generic shape check on a parsed agent response envelope.
 * Confirms the outer envelope fields runner-architecture.md requires
 * are present and internally consistent with the call that was made.
 * This is NOT per-agent Output Contract validation (see NOTE ON SCOPE
 * above) — that remains a later phase.
 * @param {object} parsed - the parsed response envelope
 * @param {string} expectedAgent - agent name the runner called
 * @param {string} expectedTaskId - task_id the runner sent
 * @returns {string[]} list of validation errors, empty if valid
 */
export function validateEnvelopeShape(parsed, expectedAgent, expectedTaskId) {
  const errors = [];

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return ['Response is not a JSON object'];
  }
  if (parsed.agent !== expectedAgent) {
    errors.push(`"agent" field mismatch: expected "${expectedAgent}", got "${parsed.agent}"`);
  }
  if (parsed.task_id !== expectedTaskId) {
    errors.push(`"task_id" mismatch: expected "${expectedTaskId}", got "${parsed.task_id}"`);
  }
  if (!('status' in parsed)) {
    errors.push('missing "status" field');
  }
  if (!('payload' in parsed) || typeof parsed.payload !== 'object' || parsed.payload === null) {
    errors.push('missing or invalid "payload" object');
  }
  if (!Array.isArray(parsed.handoff_to)) {
    errors.push('missing or invalid "handoff_to" array');
  }

  return errors;
}

// ═══════════════════════════════════════════════════════════════════════
// Runner Core — ATLAS Runner (Phase 1)
//
// PHASE 1 SCOPE ONLY. Of the eight responsibilities runner-architecture.md
// assigns to "the runner," this file implements exactly:
//
//   1. Prompt loading         → via agent-loader.js
//   2. Envelope construction  → via envelope.js
//   3. Model invocation       → via provider-adapter.js
//   4. Output parsing         → via envelope.js (extract + shape-check)
//
// It deliberately does NOT implement:
//   5. State accumulation across a multi-agent run
//   6. Sequencing (pipeline-flow.md's stage map / fan-out / fan-in)
//   7. Revise-loop handling (revise-loop-spec.md)
//   8. Handoff to the existing persistence endpoint
//
// Those are explicitly out of scope until Phase 2+, per the approved
// plan. This class can call exactly one agent, once, and return its
// parsed result. It has no memory between calls and does not read
// `handoff_to` to decide what to do next — a human (or a future Phase 2
// sequencer) reads the result and decides.
// ═══════════════════════════════════════════════════════════════════════

import { loadAgentPrompt } from './agent-loader.js';
import { callProvider } from './provider-adapter.js';
import { buildAgentEnvelope, extractJsonBlock, validateEnvelopeShape } from './envelope.js';

export class Runner {
  /**
   * @param {object} [config]
   * @param {'openai'} [config.provider] - defaults to 'openai' (only supported provider in Phase 1)
   * @param {string} [config.model] - defaults to provider adapter's own default
   * @param {number} [config.temperature]
   * @param {number} [config.maxTokens]
   */
  constructor(config = {}) {
    this.provider = config.provider || 'openai';
    this.model = config.model || null;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
  }

  /**
   * Call exactly one agent, once. Loads its prompt, builds the shared
   * envelope, invokes the model via the provider adapter, and parses +
   * shape-checks the result.
   *
   * @param {string} agentName - one of the nine agent names in /agents
   * @param {object} input - that agent's Input Contract fields (per its own .md file)
   * @param {string} taskId - stable id for this call
   * @returns {Promise<object>} { ok: true, envelope, meta } on success,
   *                            { ok: false, stage, error, raw? } on failure
   */
  async callAgent(agentName, input, taskId) {
    let systemPrompt;
    try {
      systemPrompt = loadAgentPrompt(agentName);
    } catch (err) {
      return { ok: false, stage: 'prompt_loading', error: { type: 'unknown', message: err.message } };
    }

    const requestEnvelope = buildAgentEnvelope(taskId, agentName, input);

    const providerResponse = await callProvider({
      provider: this.provider,
      model: this.model,
      system_prompt: systemPrompt,
      user_message: JSON.stringify(requestEnvelope, null, 2),
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    });

    if (providerResponse.error) {
      return { ok: false, stage: 'provider_call', error: providerResponse.error, raw: providerResponse };
    }

    let parsed;
    try {
      parsed = extractJsonBlock(providerResponse.text);
    } catch (err) {
      return {
        ok: false,
        stage: 'json_extraction',
        error: { type: 'invalid_response', message: `Could not parse JSON from model output: ${err.message}` },
        raw: providerResponse,
      };
    }

    const shapeErrors = validateEnvelopeShape(parsed, agentName, taskId);
    if (shapeErrors.length > 0) {
      return {
        ok: false,
        stage: 'envelope_validation',
        error: { type: 'invalid_response', message: shapeErrors.join('; ') },
        parsed,
        raw: providerResponse,
      };
    }

    return {
      ok: true,
      envelope: parsed,
      meta: {
        provider: providerResponse.provider,
        model: providerResponse.model,
        tokens_used: providerResponse.tokens_used,
        latency_ms: providerResponse.latency_ms,
      },
    };
  }
}

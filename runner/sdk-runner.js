// ═══════════════════════════════════════════════════════════════════════
// SDK Runner — AgentOS execution engine, backed by the official OpenAI
// Agents SDK (@openai/agents).
//
// This is an ENGINE SWAP, not a redesign. SdkRunner.callAgent() mirrors
// runner/runner.js's Runner.callAgent(agentName, input, taskId) contract
// field-for-field:
//
//   success: { ok: true, envelope, meta: { provider, model, tokens_used, latency_ms } }
//   failure: { ok: false, stage, error: { type, message, provider_raw? }, raw?, parsed? }
//
// server/agentos/orchestrator.js — task states, subtask persistence,
// approval gates, cancellation, timeout handling — needs no changes
// beyond which runner class it instantiates. Prompt loading (agent-
// loader.js), envelope construction, JSON extraction, and outer-envelope
// shape validation (envelope.js) are reused UNCHANGED from the existing
// runner, so every agent in agents/research-*.md keeps producing and
// being checked against the exact same fenced-JSON contract it always
// has — only *how* the model is invoked changes: an SDK `Agent` + `run()`
// call in place of the hand-rolled fetch() in server/openai-client.js.
//
// No tools, handoffs, or structured outputType are registered on the
// Agent — each call is intentionally a single-turn text completion
// (maxTurns: 1), matching the "one real call per delegate" behavior the
// orchestrator's own comments document. Multi-agent delegation, wave
// sequencing, and synthesis remain entirely AgentOS's job, not the SDK's.
// ═══════════════════════════════════════════════════════════════════════

import 'dotenv/config';
import {
  Agent,
  run,
  withTrace,
  MaxTurnsExceededError,
  ModelBehaviorError,
  ModelRefusalError,
  ModelTimeoutError,
  AgentsError,
} from '@openai/agents';
import { loadAgentPrompt, loadCoreEnginePrompt } from './agent-loader.js';
import { buildAgentEnvelope, extractJsonBlock, validateEnvelopeShape } from './envelope.js';
import { recordCostLedgerEntry } from '../server/usage/cost-ledger.js';
import { COST_PER_1K } from '../server/openai-client.js';

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const DEFAULT_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) || 120_000;
const LEDGER_SOURCE = 'agentos-sdk';

export class SdkRunner {
  /**
   * @param {object} [config]
   * @param {'openai'} [config.provider] - defaults to 'openai' (only supported provider)
   * @param {string} [config.model]
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
   * Call exactly one agent, once, through the OpenAI Agents SDK.
   * Never throws — every failure mode returns { ok: false, ... }, matching
   * runner/runner.js's Runner.callAgent() contract exactly.
   * @param {string} agentName - one of runner/agent-loader.js's VALID_AGENTS
   * @param {object} input - that agent's Input Contract fields
   * @param {string} taskId - stable id for this call (used as the trace groupId)
   */
  async callAgent(agentName, input, taskId) {
    if (this.provider !== 'openai') {
      return {
        ok: false,
        stage: 'provider_call',
        error: { type: 'unknown', message: `Provider "${this.provider}" is not implemented. Only "openai" is supported.` },
      };
    }

    let systemPrompt;
    try {
      systemPrompt = agentName === 'core-engine' ? loadCoreEnginePrompt() : loadAgentPrompt(agentName);
    } catch (err) {
      return { ok: false, stage: 'prompt_loading', error: { type: 'unknown', message: err.message } };
    }

    const resolvedModel = this.model || DEFAULT_MODEL;

    // Fail structurally, exactly like server/openai-client.js's own
    // pre-flight check — no ledger entry, no fabricated call.
    if (!process.env.OPENAI_API_KEY) {
      return {
        ok: false,
        stage: 'provider_call',
        error: { type: 'auth_error', message: 'OPENAI_API_KEY not set in .env' },
      };
    }

    const requestEnvelope = buildAgentEnvelope(taskId, agentName, input);
    const agent = new Agent({
      name: agentName,
      instructions: systemPrompt,
      model: resolvedModel,
      modelSettings: {
        temperature: this.temperature ?? 0.7,
        maxTokens: this.maxTokens ?? 700,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      },
    });

    const start = performance.now();
    let result;
    try {
      result = await withTrace(
        `agentos:${agentName}`,
        () => run(agent, JSON.stringify(requestEnvelope, null, 2), { maxTurns: 1 }),
        { groupId: taskId, metadata: { task_id: taskId, agent: agentName } },
      );
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const classified = classifySdkError(err);
      recordCostLedgerEntry({
        provider: 'openai',
        model: resolvedModel,
        source: LEDGER_SOURCE,
        success: false,
        errorCode: classified.type,
        latencyMs,
      });
      return { ok: false, stage: 'provider_call', error: classified };
    }

    const latencyMs = Math.round(performance.now() - start);
    const text = typeof result.finalOutput === 'string' ? result.finalOutput : '';
    const usage = result.runContext?.usage || {};
    const inputTokens = usage.inputTokens ?? null;
    const outputTokens = usage.outputTokens ?? null;
    const totalTokens = usage.totalTokens ?? null;

    if (!text) {
      recordCostLedgerEntry({
        provider: 'openai',
        model: resolvedModel,
        source: LEDGER_SOURCE,
        inputTokens,
        outputTokens,
        totalTokens,
        success: false,
        errorCode: 'EMPTY_RESPONSE',
        latencyMs,
      });
      return {
        ok: false,
        stage: 'provider_call',
        error: { type: 'invalid_response', message: 'OpenAI Agents SDK returned empty final output' },
      };
    }

    const providerResponse = {
      provider: 'openai',
      model: resolvedModel,
      text,
      tokens_used: totalTokens,
      latency_ms: latencyMs,
      error: null,
    };

    let parsed;
    try {
      parsed = extractJsonBlock(text);
    } catch (err) {
      recordCostLedgerEntry({
        provider: 'openai',
        model: resolvedModel,
        source: LEDGER_SOURCE,
        inputTokens,
        outputTokens,
        totalTokens,
        success: false,
        errorCode: 'INVALID_ENVELOPE_JSON',
        latencyMs,
      });
      return {
        ok: false,
        stage: 'json_extraction',
        error: { type: 'invalid_response', message: `Could not parse JSON from model output: ${err.message}` },
        raw: providerResponse,
      };
    }

    const shapeErrors = validateEnvelopeShape(parsed, agentName, taskId);
    if (shapeErrors.length > 0) {
      recordCostLedgerEntry({
        provider: 'openai',
        model: resolvedModel,
        source: LEDGER_SOURCE,
        inputTokens,
        outputTokens,
        totalTokens,
        success: false,
        errorCode: 'ENVELOPE_SHAPE_MISMATCH',
        latencyMs,
      });
      return {
        ok: false,
        stage: 'envelope_validation',
        error: { type: 'invalid_response', message: shapeErrors.join('; ') },
        parsed,
        raw: providerResponse,
      };
    }

    const hasKnownRate = Object.prototype.hasOwnProperty.call(COST_PER_1K, resolvedModel);
    const costRate = COST_PER_1K[resolvedModel] ?? 0.001;
    const costUsd = totalTokens != null ? (totalTokens / 1000) * costRate : null;

    recordCostLedgerEntry({
      provider: 'openai',
      model: resolvedModel,
      source: LEDGER_SOURCE,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd: hasKnownRate ? costUsd : null,
      success: true,
      latencyMs,
    });

    return {
      ok: true,
      envelope: parsed,
      meta: {
        provider: 'openai',
        model: resolvedModel,
        tokens_used: totalTokens,
        latency_ms: latencyMs,
      },
    };
  }
}

/**
 * Map an SDK-thrown error to the runner's uniform { type, message,
 * provider_raw } shape — the same classification categories
 * runner/provider-adapter.js already uses (auth_error, rate_limit,
 * timeout, invalid_response, unknown), so orchestrator.js and subtask
 * persistence don't need to know which engine produced the error.
 * @param {unknown} err
 */
function classifySdkError(err) {
  if (err instanceof ModelTimeoutError) {
    return { type: 'timeout', message: err.message, provider_raw: String(err) };
  }
  if (err instanceof MaxTurnsExceededError || err instanceof ModelRefusalError || err instanceof ModelBehaviorError) {
    return { type: 'invalid_response', message: err.message, provider_raw: String(err) };
  }

  const status = err?.status ?? err?.cause?.status;
  const message = err?.message || String(err);
  const type =
    status === 429 ? 'rate_limit' :
    status === 401 ? 'auth_error' :
    status === 408 ? 'timeout' :
    message.includes('OPENAI_API_KEY') ? 'auth_error' :
    err instanceof AgentsError ? 'invalid_response' :
    'unknown';

  return { type, message, provider_raw: String(err) };
}

// ═══════════════════════════════════════════════════════════════════════
// Provider Adapter — ATLAS Runner (Phase 1: OpenAI only)
//
// Delegates all OpenAI HTTP calls to server/openai-client.js.
// This adapter only normalizes the runner's uniform request/response shape.
// ═══════════════════════════════════════════════════════════════════════

import 'dotenv/config';
import { callOpenAI } from '../server/openai-client.js';

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

/**
 * @param {object} request
 * @param {'openai'} request.provider
 * @param {string} [request.model]
 * @param {string} request.system_prompt
 * @param {string} request.user_message
 * @param {number} [request.temperature]
 * @param {number} [request.max_tokens]
 * @returns {Promise<object>} uniform response shape
 */
export async function callProvider(request) {
  const { provider, model, system_prompt, user_message, temperature, max_tokens } = request;

  if (provider !== 'openai') {
    return uniformError(
      provider,
      model,
      'unknown',
      `Provider "${provider}" is not implemented in Phase 1. Only "openai" is supported.`,
    );
  }

  const resolvedModel = model || DEFAULT_MODEL;

  try {
    const result = await callOpenAI({
      systemPrompt: system_prompt,
      userPrompt: user_message,
      model: resolvedModel,
      temperature,
      maxTokens: max_tokens,
    });

    return {
      provider: 'openai',
      model: result.model,
      text: result.content,
      tokens_used: result.tokensUsed,
      latency_ms: result.latencyMs,
      error: null,
    };
  } catch (err) {
    const status = err.status;
    const type =
      status === 429 ? 'rate_limit' :
      status === 401 ? 'auth_error' :
      status === 408 ? 'timeout' :
      err.message?.includes('OPENAI_API_KEY') ? 'auth_error' :
      err.message?.includes('empty output') ? 'invalid_response' :
      'unknown';

    return {
      provider: 'openai',
      model: resolvedModel,
      text: '',
      tokens_used: null,
      latency_ms: 0,
      error: { type, message: err.message, provider_raw: String(err) },
    };
  }
}

function uniformError(provider, model, type, message) {
  return {
    provider: provider || 'unknown',
    model: model || null,
    text: '',
    tokens_used: null,
    latency_ms: 0,
    error: { type, message, provider_raw: null },
  };
}

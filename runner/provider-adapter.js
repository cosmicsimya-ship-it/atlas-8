// ═══════════════════════════════════════════════════════════════════════
// Provider Adapter — ATLAS Runner (Phase 1: OpenAI only)
//
// Implements the uniform interface defined in provider-adapter-spec.md.
// Phase 1 scope is explicitly OpenAI-only — the "claude", "gemini", and
// "arena" branches described in the spec are NOT implemented yet. Calling
// this adapter with any provider other than "openai" returns a uniform
// error rather than attempting an unimplemented call.
//
// Credential isolation (per the spec): this module reads OPENAI_API_KEY
// from the same .env mechanism server/index.js already uses. It does not
// introduce a new env var, does not hardcode a key, and does not log it.
//
// This module is a plain, standalone Node script — it does NOT import
// from or depend on server/index.js. It calls the OpenAI API directly,
// so that adding a runner never requires touching the existing backend.
// ═══════════════════════════════════════════════════════════════════════

import 'dotenv/config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

/**
 * Uniform call. See provider-adapter-spec.md's "Uniform request" /
 * "Uniform response" / "Uniform error shape" sections for the exact
 * contract this function implements.
 *
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
      `Provider "${provider}" is not implemented in Phase 1. Only "openai" is supported.`
    );
  }

  if (!OPENAI_API_KEY) {
    return uniformError(provider, model, 'auth_error', 'OPENAI_API_KEY not set in .env');
  }

  const resolvedModel = model || DEFAULT_MODEL;
  const start = performance.now();

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        instructions: system_prompt,
        input: user_message,
        temperature: temperature ?? 0.7,
        max_output_tokens: max_tokens ?? 2048,
      }),
    });

    const latency_ms = Math.round(performance.now() - start);

    if (!response.ok) {
      const errText = await response.text();
      let message = `OpenAI error (${response.status})`;
      try {
        message = JSON.parse(errText).error?.message || message;
      } catch {
        /* leave default message */
      }

      const type =
        response.status === 429 ? 'rate_limit' :
        response.status === 401 ? 'auth_error' :
        response.status === 408 ? 'timeout' :
        'unknown';

      return {
        provider: 'openai',
        model: resolvedModel,
        text: '',
        tokens_used: null,
        latency_ms,
        error: { type, message, provider_raw: errText },
      };
    }

    const data = await response.json();

    // Normalize OpenAI's response block structure into a flat text string.
    // This mirrors the extraction logic already used in server/index.js,
    // duplicated here (not imported) because the adapter is intentionally
    // standalone and must not depend on the existing backend module.
    let text = '';
    if (data.output) {
      for (const block of data.output) {
        if (block.type === 'message' && block.content) {
          for (const part of block.content) {
            if (part.type === 'output_text') text += part.text;
          }
        }
      }
    }

    if (!text) {
      return {
        provider: 'openai',
        model: data.model || resolvedModel,
        text: '',
        tokens_used: null,
        latency_ms,
        error: { type: 'invalid_response', message: 'OpenAI returned empty output', provider_raw: JSON.stringify(data) },
      };
    }

    const tokens_used =
      (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) || null;

    return {
      provider: 'openai',
      model: data.model || resolvedModel,
      text,
      tokens_used,
      latency_ms,
      error: null,
    };
  } catch (err) {
    const latency_ms = Math.round(performance.now() - start);
    const type = err.name === 'AbortError' || err.name === 'TimeoutError' ? 'timeout' : 'unknown';
    return {
      provider: 'openai',
      model: resolvedModel,
      text: '',
      tokens_used: null,
      latency_ms,
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

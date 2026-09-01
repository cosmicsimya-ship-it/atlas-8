// ═══════════════════════════════════════════════════════════════════════
// OpenAI Client — shared model invocation for server endpoints
// Text + optional image (multimodal) via Responses API; Whisper STT.
// ═══════════════════════════════════════════════════════════════════════

import { recordCostLedgerEntry } from './usage/cost-ledger.js';

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

export const COST_PER_1K = {
  'gpt-4.1-mini': 0.0004,
  'gpt-4.1': 0.002,
  'gpt-4o': 0.0075,
  'gpt-4o-mini': 0.0003,
};

/**
 * Extract assistant text from OpenAI Responses API payload.
 * @param {any} data
 */
function extractResponsesText(data) {
  let content = '';
  if (data?.output) {
    for (const block of data.output) {
      if (block.type === 'message' && block.content) {
        for (const part of block.content) {
          if (part.type === 'output_text') {
            content += part.text;
          }
        }
      }
    }
  }
  return content;
}

/**
 * Call OpenAI Responses API (text, or text+image when imageBase64 is set).
 * @param {{
 *   systemPrompt?: string,
 *   userPrompt: string,
 *   imageBase64?: string,
 *   mimeType?: string,
 *   model?: string,
 *   temperature?: number,
 *   maxTokens?: number,
 *   timeoutMs?: number,
 *   apiKey?: string,
 *   requestId?: string|null,
 *   userId?: string|null,
 *   source?: string,
 * }} options
 * @returns {Promise<{
 *   content: string,
 *   model: string,
 *   provider: string,
 *   tokensUsed: number,
 *   costUsd: number,
 *   latencyMs: number,
 *   incomplete: boolean,
 *   incompleteReason: string|null,
 *   status: string|null,
 *   requestId: string|null,
 * }>}
 */
export async function callOpenAI(options) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set in .env');
  }

  const selectedModel =
    options.model ||
    (options.imageBase64
      ? process.env.OPENAI_VISION_MODEL || DEFAULT_MODEL
      : DEFAULT_MODEL);
  const start = performance.now();
  // Cost-ledger fields — optional, non-authoritative to the model call itself.
  const ledgerUserId = options.userId ?? null;
  const ledgerSource = options.source || 'unknown';

  /** @type {string | Array<object>} */
  let input;
  if (options.imageBase64) {
    const mimeType = (options.mimeType || 'image/jpeg').split(';')[0].trim();
    const dataUrl = `data:${mimeType};base64,${options.imageBase64}`;
    input = [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: options.userPrompt },
          { type: 'input_image', image_url: dataUrl },
        ],
      },
    ];
  } else {
    input = options.userPrompt;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        instructions: options.systemPrompt || undefined,
        input,
        temperature: options.temperature ?? 0.7,
        max_output_tokens: options.maxTokens ?? 700,
      }),
      signal: AbortSignal.timeout(
        Number(options.timeoutMs ?? process.env.OPENAI_TIMEOUT_MS) || 120_000,
      ),
    });

    const latencyMs = performance.now() - start;

    if (!response.ok) {
      const errText = await response.text();
      let msg = `OpenAI error (${response.status})`;
      try {
        msg = JSON.parse(errText).error?.message || msg;
      } catch {
        // keep default msg
      }
      const error = new Error(msg);
      error.status = response.status;
      error._ledgerRecorded = true;
      recordCostLedgerEntry({
        provider: 'openai',
        model: selectedModel,
        userId: ledgerUserId,
        source: ledgerSource,
        success: false,
        errorCode: `HTTP_${response.status}`,
        latencyMs: Math.round(latencyMs),
      });
      throw error;
    }

    const data = await response.json();
    const content = extractResponsesText(data);
    const apiStatus = typeof data?.status === 'string' ? data.status : null;
    const incompleteReason =
      data?.incomplete_details?.reason != null
        ? String(data.incomplete_details.reason)
        : apiStatus === 'incomplete'
          ? 'incomplete_status'
          : null;
    const incomplete = Boolean(incompleteReason) || apiStatus === 'incomplete';

    if (!content) {
      const empty = new Error(
        incomplete
          ? `OpenAI incomplete empty output (${incompleteReason || 'incomplete'})`
          : 'OpenAI returned empty output',
      );
      empty.status = 502;
      empty.code = incomplete ? 'INCOMPLETE_RESPONSE' : 'EMPTY_RESPONSE';
      empty.incomplete = incomplete;
      empty.incompleteReason = incompleteReason;
      empty.requestId = options.requestId ?? null;
      empty._ledgerRecorded = true;
      recordCostLedgerEntry({
        provider: 'openai',
        model: data.model || selectedModel,
        userId: ledgerUserId,
        source: ledgerSource,
        inputTokens: data.usage?.input_tokens ?? null,
        outputTokens: data.usage?.output_tokens ?? null,
        totalTokens:
          (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) || null,
        success: false,
        errorCode: empty.code,
        latencyMs: Math.round(latencyMs),
      });
      throw empty;
    }

    const totalTokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    // Never fabricate a rate for an unpriced model: the ledger only records
    // costUsd when COST_PER_1K has a real entry for this model. The 0.001
    // fallback below is pre-existing display behavior for the per-request
    // API response only — it is deliberately NOT propagated into the ledger.
    const hasKnownRate = Object.prototype.hasOwnProperty.call(COST_PER_1K, selectedModel);
    const costRate = COST_PER_1K[selectedModel] ?? 0.001;
    const tokensUsed = totalTokens || Math.ceil(content.length / 4);
    const costUsd = (tokensUsed / 1000) * costRate;

    if (incomplete) {
      console.warn(
        `[OpenAI] incomplete response requestId=${options.requestId || 'n/a'}` +
          ` reason=${incompleteReason} tokens=${tokensUsed} max_output_tokens=${options.maxTokens ?? 700}`,
      );
    }

    recordCostLedgerEntry({
      provider: 'openai',
      model: data.model || selectedModel,
      userId: ledgerUserId,
      source: ledgerSource,
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
      totalTokens: totalTokens || tokensUsed,
      costUsd: hasKnownRate ? costUsd : null,
      success: true,
      errorCode: incomplete ? incompleteReason || 'incomplete' : null,
      latencyMs: Math.round(latencyMs),
    });

    return {
      content,
      model: data.model || selectedModel,
      provider: 'openai',
      tokensUsed,
      costUsd,
      latencyMs: Math.round(latencyMs),
      incomplete,
      incompleteReason,
      status: apiStatus,
      requestId: options.requestId ?? null,
    };
  } catch (err) {
    // Network errors / timeouts land here (HTTP-status and empty-output
    // failures above already recorded their own ledger entry and rethrow
    // before this catch, so guard against double-recording via the flag).
    if (!err?._ledgerRecorded) {
      recordCostLedgerEntry({
        provider: 'openai',
        model: selectedModel,
        userId: ledgerUserId,
        source: ledgerSource,
        success: false,
        errorCode: err?.name || 'NETWORK_ERROR',
        latencyMs: Math.round(performance.now() - start),
      });
    }
    throw err;
  }
}

/**
 * @deprecated Prefer callOpenAI({ ..., imageBase64, mimeType }). Thin wrapper for compatibility.
 */
export async function callOpenAIVision(options) {
  return callOpenAI({
    ...options,
    temperature: options.temperature ?? 0.3,
    maxTokens: options.maxTokens ?? 900,
  });
}

/**
 * Transcribe an audio/voice file via OpenAI Speech-to-Text (Whisper).
 * @param {{
 *   filePath: string,
 *   mimeType?: string,
 *   fileName?: string,
 *   language?: string,
 *   apiKey?: string,
 *   model?: string,
 * }} options
 * @returns {Promise<{ text: string, model: string, provider: string, latencyMs: number }>}
 */
export async function transcribeAudioFile(options) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set in .env');
  }
  if (!options.filePath) {
    throw new Error('filePath is required for transcription');
  }

  const { readFileSync } = await import('fs');
  const { basename } = await import('path');

  const selectedModel = options.model || process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';
  const mimeType = (options.mimeType || 'audio/ogg').split(';')[0].trim();
  const fileName = options.fileName || basename(options.filePath) || 'audio.ogg';
  const bytes = readFileSync(options.filePath);
  const start = performance.now();

  const form = new FormData();
  form.append('model', selectedModel);
  form.append('file', new Blob([new Uint8Array(bytes)], { type: mimeType }), fileName);
  if (options.language) {
    form.append('language', options.language);
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const latencyMs = performance.now() - start;

  if (!response.ok) {
    const errText = await response.text();
    let msg = `OpenAI transcription error (${response.status})`;
    try {
      msg = JSON.parse(errText).error?.message || msg;
    } catch {
      // keep default
    }
    const error = new Error(msg);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const text = String(data.text ?? '').trim();
  if (!text) {
    throw new Error('OpenAI transcription returned empty text');
  }

  return {
    text,
    model: selectedModel,
    provider: 'openai',
    latencyMs: Math.round(latencyMs),
  };
}

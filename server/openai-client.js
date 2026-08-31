// ═══════════════════════════════════════════════════════════════════════
// OpenAI Client — shared model invocation for server endpoints
// Text + optional image (multimodal) via Responses API; Whisper STT.
// ═══════════════════════════════════════════════════════════════════════

import {
  appendWebSourceAttribution,
  buildOpenAIWebSearchConfig,
  buildRetrievalUnavailableReply,
  buildWebRetrievalDirective,
  extractRankedWebSources,
  resolveWebRetrievalPlan,
} from './domain-core/web-retrieval.js';

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

function buildRetrievalUnavailableResult({
  plan,
  selectedModel,
  startedAt,
  requestId,
  httpStatus = null,
}) {
  return {
    content: buildRetrievalUnavailableReply(plan),
    model: selectedModel,
    provider: 'openai-web-search-unavailable',
    tokensUsed: 0,
    costUsd: 0,
    latencyMs: Math.round(performance.now() - startedAt),
    incomplete: false,
    incompleteReason: null,
    status: 'retrieval_unavailable',
    requestId: requestId ?? null,
    sources: [],
    webRetrieval: {
      active: true,
      domain: plan.domain,
      freshness: plan.freshness,
      failed: true,
      ...(httpStatus != null ? { httpStatus } : {}),
    },
  };
}

/**
 * Call OpenAI Responses API (text, or text+image when imageBase64 is set).
 * Eligible Atlas Core factual domains use OpenAI hosted web_search through the
 * channel-independent retrieval policy. Qur'an references stay excluded and
 * continue through the deterministic Qur'an path in atlas-message-service.
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
 *   sources?: Array<object>,
 *   webRetrieval?: object,
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

  const webPlan = options.imageBase64
    ? { active: false }
    : resolveWebRetrievalPlan(options.userPrompt);
  const webConfig = buildOpenAIWebSearchConfig(webPlan);
  const retrievalDirective = buildWebRetrievalDirective(webPlan);
  const instructions = `${options.systemPrompt || ''}${retrievalDirective}` || undefined;

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        instructions,
        input,
        temperature: options.temperature ?? 0.7,
        max_output_tokens: options.maxTokens ?? 700,
        ...(webConfig ?? {}),
      }),
      signal: AbortSignal.timeout(
        Number(options.timeoutMs ?? process.env.OPENAI_TIMEOUT_MS) || 120_000,
      ),
    });
  } catch (error) {
    if (webPlan.active) {
      return buildRetrievalUnavailableResult({
        plan: webPlan,
        selectedModel,
        startedAt: start,
        requestId: options.requestId,
      });
    }
    throw error;
  }

  const latencyMs = performance.now() - start;

  if (!response.ok) {
    if (webPlan.active) {
      return buildRetrievalUnavailableResult({
        plan: webPlan,
        selectedModel,
        startedAt: start,
        requestId: options.requestId,
        httpStatus: response.status,
      });
    }

    const errText = await response.text();
    let msg = `OpenAI error (${response.status})`;
    try {
      msg = JSON.parse(errText).error?.message || msg;
    } catch {
      // keep default msg
    }
    const error = new Error(msg);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  let content = extractResponsesText(data);
  const sources = webPlan.active ? extractRankedWebSources(data, webPlan) : [];

  // Web-retrieval answers are only trusted when the hosted search actually
  // returned attributable sources. Otherwise fail closed instead of falling
  // back to unsupported model memory for these domains.
  if (webPlan.active && sources.length === 0) {
    content = buildRetrievalUnavailableReply(webPlan);
  } else if (webPlan.active) {
    content = appendWebSourceAttribution(content, sources);
  }

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
    throw empty;
  }

  const totalTokens =
    (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
  const costRate = COST_PER_1K[selectedModel] ?? 0.001;
  const tokensUsed = totalTokens || Math.ceil(content.length / 4);

  if (incomplete) {
    console.warn(
      `[OpenAI] incomplete response requestId=${options.requestId || 'n/a'}` +
        ` reason=${incompleteReason} tokens=${tokensUsed} max_output_tokens=${options.maxTokens ?? 700}`,
    );
  }

  return {
    content,
    model: data.model || selectedModel,
    provider: webPlan.active ? 'openai-web-search' : 'openai',
    tokensUsed,
    costUsd: (tokensUsed / 1000) * costRate,
    latencyMs: Math.round(latencyMs),
    incomplete,
    incompleteReason,
    status:
      webPlan.active && sources.length === 0
        ? 'retrieval_unavailable'
        : apiStatus,
    requestId: options.requestId ?? null,
    ...(webPlan.active
      ? {
          sources,
          webRetrieval: {
            active: true,
            domain: webPlan.domain,
            freshness: webPlan.freshness,
            failed: sources.length === 0,
          },
        }
      : {}),
  };
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

  const selectedModel =
    options.model || process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';
  const mimeType = (options.mimeType || 'audio/ogg').split(';')[0].trim();
  const fileName = options.fileName || basename(options.filePath) || 'audio.ogg';
  const bytes = readFileSync(options.filePath);
  const start = performance.now();

  const form = new FormData();
  form.append('model', selectedModel);
  form.append(
    'file',
    new Blob([new Uint8Array(bytes)], { type: mimeType }),
    fileName,
  );
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

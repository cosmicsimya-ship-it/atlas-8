// ═══════════════════════════════════════════════════════════════════════
// OpenAI Client — shared model invocation for server endpoints
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

export const COST_PER_1K = {
  'gpt-4.1-mini': 0.0004,
  'gpt-4.1': 0.002,
  'gpt-4o': 0.0075,
  'gpt-4o-mini': 0.0003,
};

/**
 * Call OpenAI Responses API.
 * @param {{
 *   systemPrompt?: string,
 *   userPrompt: string,
 *   model?: string,
 *   temperature?: number,
 *   maxTokens?: number,
 *   apiKey?: string,
 * }} options
 * @returns {Promise<{ content: string, model: string, provider: string, tokensUsed: number, costUsd: number, latencyMs: number }>}
 */
export async function callOpenAI(options) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set in .env');
  }

  const selectedModel = options.model || DEFAULT_MODEL;
  const start = performance.now();

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: selectedModel,
      instructions: options.systemPrompt || undefined,
      input: options.userPrompt,
      temperature: options.temperature ?? 0.7,
      max_output_tokens: options.maxTokens ?? 2048,
    }),
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
    throw error;
  }

  const data = await response.json();

  let content = '';
  if (data.output) {
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

  if (!content) {
    throw new Error('OpenAI returned empty output');
  }

  const totalTokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
  const costRate = COST_PER_1K[selectedModel] ?? 0.001;
  const tokensUsed = totalTokens || Math.ceil(content.length / 4);

  return {
    content,
    model: data.model || selectedModel,
    provider: 'openai',
    tokensUsed,
    costUsd: (tokensUsed / 1000) * costRate,
    latencyMs: Math.round(latencyMs),
  };
}

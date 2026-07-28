// ═══════════════════════════════════════════════════════════════════════
// Atlas Chat Service — profile-aware conversational AI
//
// Used by POST /api/chat (Telegram + Web Chat).
// Meta Synthesis modules load only when mode resolves to meta-synthesis profile.
// ═══════════════════════════════════════════════════════════════════════

import {
  buildAtlasSystemPrompt,
  resolveChatProfile,
} from './atlas-prompt-loader.js';
import { callOpenAI } from './openai-client.js';
import { extractResponseText } from './atlas-response.js';
import {
  detectAnalysisMode,
  buildChatUserPrompt,
} from './symbolic-synthesis.js';

/**
 * @param {{
 *   message: string,
 *   history?: Array<{ role: 'user' | 'assistant', content: string }>,
 *   mode?: string,
 *   profile?: string,
 * }} options
 * @returns {{ systemPrompt: string, userPrompt: string, mode: string, profile: string }}
 */
export function buildAtlasChatRequest(options) {
  const message = (options.message ?? '').trim();
  if (!message) {
    throw new Error('message is required');
  }

  const mode = options.mode ?? detectAnalysisMode(message);
  const profile = options.profile ?? resolveChatProfile(mode);
  const systemPrompt = buildAtlasSystemPrompt({ profile, mode });
  const userPrompt = buildChatUserPrompt(message, options.history ?? [], mode);

  return { systemPrompt, userPrompt, mode, profile };
}

/**
 * @param {{
 *   message: string,
 *   history?: Array<{ role: 'user' | 'assistant', content: string }>,
 *   mode?: string,
 *   profile?: string,
 *   model?: string,
 *   temperature?: number,
 *   maxTokens?: number,
 * }} options
 */
export async function generateAtlasChatResponse(options) {
  const { systemPrompt, userPrompt, mode, profile } = buildAtlasChatRequest(options);

  const result = await callOpenAI({
    systemPrompt,
    userPrompt,
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  const reply = extractResponseText(result);

  return {
    reply,
    content: result.content,
    mode,
    profile,
    model: result.model,
    provider: result.provider,
    tokensUsed: result.tokensUsed,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
  };
}

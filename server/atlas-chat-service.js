// ═══════════════════════════════════════════════════════════════════════
// Atlas Chat Service — backward-compatible wrapper over shared pipeline
//
// buildAtlasChatRequest remains for prompt assembly tests.
// generateAtlasChatResponse delegates to processAtlasMessage().
// ═══════════════════════════════════════════════════════════════════════

import {
  buildAtlasSystemPrompt,
  resolveChatProfile,
} from './atlas-prompt-loader.js';
import {
  detectAnalysisMode,
  buildChatUserPrompt,
  detectTarotSpreadIntent,
} from './symbolic-synthesis.js';
import { processAtlasMessage } from './atlas-message-service.js';
import { normalizeWebChatRequest, toWebChatResponse } from './channel-adapters.js';

/**
 * @param {{
 *   message: string,
 *   history?: Array<{ role: 'user' | 'assistant', content: string }>,
 *   mode?: string,
 *   profile?: string,
 *   memoryContext?: string|null,
 * }} options
 */
export function buildAtlasChatRequest(options) {
  const message = (options.message ?? '').trim();
  if (!message) {
    throw new Error('message is required');
  }

  const mode = options.mode ?? detectAnalysisMode(message);
  const profile = options.profile ?? resolveChatProfile(mode);
  const tarotIntent = detectTarotSpreadIntent(message, options.history ?? []);
  const systemPrompt = buildAtlasSystemPrompt({ profile, mode, tarotIntent });
  const userPrompt = buildChatUserPrompt(
    message,
    options.history ?? [],
    mode,
    tarotIntent,
    options.memoryContext ?? null,
  );

  return { systemPrompt, userPrompt, mode, profile, tarotIntent };
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
 *   userId?: string,
 *   channel?: 'web' | 'telegram',
 *   conversationId?: string,
 *   runner?: import('../runner/runner.js').Runner,
 * }} options
 */
export async function generateAtlasChatResponse(options) {
  const normalized = normalizeWebChatRequest({
    message: options.message,
    history: options.history,
    userId: options.userId,
    conversationId: options.conversationId,
    channel: options.channel ?? 'web',
  });

  const result = await processAtlasMessage(normalized, {
    mode: options.mode,
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    runner: options.runner,
  });

  return toWebChatResponse(result);
}

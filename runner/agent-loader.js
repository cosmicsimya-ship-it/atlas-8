// ═══════════════════════════════════════════════════════════════════════
// Agent Prompt Loader — ATLAS Runner (Phase 1)
//
// Responsibility (per runner-architecture.md, item 1 — "Prompt loading"):
//   Read the correct .md file from /agents for a given agent name and use
//   its full text as the system prompt for that step.
//
// This module does nothing else. It does not call a model, does not
// sequence anything, and does not know about envelopes.
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = join(__dirname, '..', 'agents');

// The nine Content Pipeline agents defined in atlas-core.md's canonical
// envelope, plus core-engine — the Personal Analysis Pipeline's terminal
// agent (atlas-core.md, "Pipeline Routing" / "Personal Analysis Pipeline").
// core-engine is a separate pipeline from the nine below; listing it here
// only makes its .md file loadable, it does not add it to the Content
// Pipeline's flow (that remains pipeline-runner.js's fixed agent list).
export const VALID_AGENTS = [
  'atlas-core',
  'pattern-engine',
  'reversal-engine',
  'script-engine',
  'visual-engine',
  'thumbnail-engine',
  'seo-engine',
  'critic-engine',
  'quality-engine',
  'core-engine',
];

/**
 * Load the full text of an agent's .md file to use as its system prompt.
 * @param {string} agentName - one of VALID_AGENTS
 * @returns {string} the full markdown content of that agent's spec file
 */
export function loadAgentPrompt(agentName) {
  if (!VALID_AGENTS.includes(agentName)) {
    throw new Error(
      `Unknown agent "${agentName}". Must be one of: ${VALID_AGENTS.join(', ')}`
    );
  }

  const filePath = join(AGENTS_DIR, `${agentName}.md`);

  if (!existsSync(filePath)) {
    throw new Error(`Agent prompt file not found: ${filePath}`);
  }

  return readFileSync(filePath, 'utf-8');
}
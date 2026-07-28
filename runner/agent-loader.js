// ═══════════════════════════════════════════════════════════════════════
// Agent Prompt Loader — ATLAS Runner (Phase 1)
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getMetaSynthesisPrompt } from '../server/atlas-prompt-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = join(__dirname, '..', 'agents');

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

export function loadAgentPrompt(agentName) {
  if (!VALID_AGENTS.includes(agentName)) {
    throw new Error(
      `Unknown agent "${agentName}". Must be one of: ${VALID_AGENTS.join(', ')}`,
    );
  }

  const filePath = join(AGENTS_DIR, `${agentName}.md`);

  if (!existsSync(filePath)) {
    throw new Error(`Agent prompt file not found: ${filePath}`);
  }

  return readFileSync(filePath, 'utf-8');
}

/**
 * personal-analysis profile: core-engine agent spec + Meta Synthesis module.
 * @returns {string}
 */
export function loadCoreEnginePrompt() {
  const base = loadAgentPrompt('core-engine');
  const metaSynthesis = getMetaSynthesisPrompt();
  return `${base}

---

## Meta Synthesis Engine (personal-analysis profile)

The following specification governs how you synthesize across symbolic systems.
Apply these principles when building convergences, contradictions, and confidence scores.
Map your JSON output fields to this structure where applicable:

| Meta Synthesis Section | JSON Field |
|------------------------|------------|
| Ana Tema (Main Theme) | \`core_pattern\` |
| Destekleyen Sistemler | \`convergences\`, \`source_systems\` |
| Ayrışan Noktalar | \`contradictions\` |
| Çelişkinin Anlamı | derive from \`contradictions\` resolution + \`warnings\` |
| Kör Nokta | include in \`warnings\` or \`recommended_directions\` context |
| Gerçeklik Kontrolü | reflect in \`confidence\` reasons and \`evidence_map\` |
| Güven Seviyesi | \`confidence.overall\` and per-convergence \`confidence\` |
| Sentez | \`life_architecture\`, \`development_axis\`, \`current_cycle\` |

${metaSynthesis}`;
}

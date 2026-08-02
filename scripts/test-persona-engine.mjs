/**
 * Persona Engine v1 Phase 1 acceptance tests.
 * Run: node scripts/test-persona-engine.mjs
 */
import {
  initializePersonaEngine,
  reloadPersonaEngine,
  getPersonaEngineStatus,
  resolvePersonaVoice,
  buildPersonaEngineRuntimeBlock,
  buildPersonaEngineRuntimeRules,
  applyPersonaGuards,
  detectEditingSignals,
  PERSONA_ENGINE_VERSION,
} from '../server/persona-engine.js';
import { buildAtlasSystemPrompt, clearAtlasModuleCache } from '../server/atlas-prompt-loader.js';
import { ATLAS_PROMPT_LOAD_ORDER } from '../server/atlas-message-service.js';

clearAtlasModuleCache();

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const init = initializePersonaEngine();
assert('persona engine initializes', init.ok === true, init.error);
assert('version is persona-v1.x', /^persona-v1/.test(PERSONA_ENGINE_VERSION));

const status = getPersonaEngineStatus();
assert('registry status is phase-2', /phase-2/i.test(String(status.status)));
assert('voices loaded', status.voiceCount >= 5);
assert('author profile composed', status.authorProfileId === 'lara-author');

assert('telegram voice resolves by channel', resolvePersonaVoice({ channel: 'telegram' })?.id === 'telegram');
assert(
  'analysis voice resolves by mode',
  resolvePersonaVoice({ mode: 'meta-synthesis' })?.id === 'atlas-analysis',
);
assert(
  'astrology voice resolves by domain',
  resolvePersonaVoice({ domain: 'astrology' })?.id === 'astrolojik-akil',
);

const block = buildPersonaEngineRuntimeBlock({
  mode: 'meta-synthesis',
  channel: 'telegram',
  tarotActive: false,
});
assert('runtime block has PERSONA ENGINE header', /PERSONA ENGINE/i.test(block));
assert('runtime block includes voice', /Voice —/i.test(block));
assert('runtime block includes author profile', /AUTHOR PROFILE — LARA/i.test(block));
assert('runtime block includes reasoning seed', /Reasoning & Decision/i.test(block));
assert('runtime block forbids identity invention', /Kimlik uydurma|kimlik uydur/i.test(block));

const tarotBlock = buildPersonaEngineRuntimeBlock({ tarotActive: true, mode: 'conversational' });
assert('tarot persona block bans mechanical openers', /mekanik|YASAK|karıştır/i.test(tarotBlock));

const rules = buildPersonaEngineRuntimeRules({ channel: 'instagram', tarotActive: true });
assert('runtime rules mention persona', /Persona Engine/i.test(rules));
assert('runtime rules mention active voice', /instagram|atlas-analysis/i.test(rules));

const guarded = applyPersonaGuards(
  'Şimdi kart çekiyorum. Bu dinamikte ilk dikkat çeken enerji Kupa Şövalyesi.',
  { tarotActive: true },
);
assert('persona guards strip mechanical phrase', guarded.changed === true);
assert('persona guards keep natural prose', /ilk dikkat çeken/i.test(guarded.reply));

const edit = detectEditingSignals('Bu mekanik. Daha tok olsun.');
assert('editing signals detect mechanical + dense', edit.matched === true && edit.signals.length >= 2);

clearAtlasModuleCache();
const systemPrompt = buildAtlasSystemPrompt({
  profile: 'conversational',
  mode: 'conversational',
  channel: 'telegram',
  includePrivacyInstructions: false,
  tarotIntent: { active: false, intent: 'none' },
});
assert('system prompt includes persona engine', /PERSONA ENGINE \(persona-v1/i.test(systemPrompt));
assert('system prompt includes telegram voice when channel set', /telegram/i.test(systemPrompt));
assert(
  'load order: style → persona → voice → author',
  ATLAS_PROMPT_LOAD_ORDER.indexOf('conversation-style-override') <
    ATLAS_PROMPT_LOAD_ORDER.indexOf('persona-engine-override') &&
    ATLAS_PROMPT_LOAD_ORDER.indexOf('persona-engine-override') <
      ATLAS_PROMPT_LOAD_ORDER.indexOf('voice-override') &&
    ATLAS_PROMPT_LOAD_ORDER.indexOf('voice-override') <
      ATLAS_PROMPT_LOAD_ORDER.indexOf('author-profile-override'),
);

const reload = reloadPersonaEngine();
assert('reload succeeds', reload.ok === true);

console.log(`\nPersona engine tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

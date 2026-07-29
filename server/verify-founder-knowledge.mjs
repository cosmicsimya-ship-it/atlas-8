/**
 * Founder Knowledge Layer verification.
 * Run: node server/verify-founder-knowledge.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  initializeFounderKnowledge,
  resolveFounderProfile,
  isFounderUser,
  buildFounderRuntimeRules,
  mergeFounderWithUserMemoryContext,
  getFounderKnowledgeStatus,
  getFoundersFilePath,
} from './founder-knowledge.js';
import { buildAtlasSystemPrompt } from './atlas-prompt-loader.js';
import { webUserId, telegramUserId } from './user-memory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

function assert(name, condition, detail = '') {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

console.log('\n=== Founder knowledge file ===\n');

assert('founders.json exists', existsSync(getFoundersFilePath()));

const raw = JSON.parse(readFileSync(getFoundersFilePath(), 'utf-8'));
const primary = raw.profiles?.[0];
assert('founderName present', primary?.founderName);
assert('role present', primary?.role);
assert('mission present', primary?.mission);
assert('authority present', primary?.authority);
assert('communicationStyle present', primary?.communicationStyle);
assert('designPrinciples array', Array.isArray(primary?.designPrinciples) && primary.designPrinciples.length > 0);
assert('interactionRules array', Array.isArray(primary?.interactionRules) && primary.interactionRules.length > 0);
assert('memoryPriority present', primary?.memoryPriority);
assert('architecturalVision present', primary?.architecturalVision);

console.log('\n=== Registry & identity ===\n');

const prevEnv = process.env.ATLAS_FOUNDER_TELEGRAM_IDS;
process.env.ATLAS_FOUNDER_TELEGRAM_IDS = '424242';

initializeFounderKnowledge();
const founderTg = telegramUserId(424242);
const profile = resolveFounderProfile(founderTg);

assert('env-linked telegram founder resolved', profile?.id === 'founder-primary');
assert('isFounderUser true', isFounderUser(founderTg));
assert('regular user not founder', !isFounderUser(webUserId('random-user')));

process.env.ATLAS_FOUNDER_TELEGRAM_IDS = prevEnv ?? '';
initializeFounderKnowledge();

console.log('\n=== Prompt integration ===\n');

const testProfile = resolveFounderProfile(founderTg) ?? primary;
const rules = buildFounderRuntimeRules(testProfile);
assert('runtime rules mention Kurucu', rules.includes('Kurucu'));
assert('rules include interaction rules', rules.includes('eleştirel'));
assert('rules include design principles', rules.includes('boru hattı') || rules.includes('hattı'));

const merged = mergeFounderWithUserMemoryContext('Ad: Test\nDoğum tarihi: 01.01.1990', testProfile);
assert('merge preserves user memory', merged.includes('01.01.1990'));
assert('merge adds founder identity', merged.includes('Founder Profile') || merged.includes('Founder Identity'));
assert('merge does not replace with user-only header', merged.includes('Kurucu') || merged.includes(testProfile.founderName));

// Re-init with test env for prompt test
process.env.ATLAS_FOUNDER_TELEGRAM_IDS = '424242';
initializeFounderKnowledge();
const founderForPrompt = resolveFounderProfile(founderTg);
const systemPrompt = buildAtlasSystemPrompt({
  profile: 'conversational',
  mode: 'conversational',
  founderProfile: founderForPrompt,
});
assert('system prompt includes founder layer', systemPrompt.includes('FOUNDER SYSTEM CONTEXT'));

console.log('\n=== Status ===\n');
const status = getFounderKnowledgeStatus();
assert('knowledge layer loaded', status.loaded && status.profileCount >= 1);

process.env.ATLAS_FOUNDER_TELEGRAM_IDS = prevEnv ?? '';
initializeFounderKnowledge();

console.log('\n=== Summary ===\n');
const failed = results.filter((r) => !r.ok);
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  for (const f of failed) console.log(`  - ${f.name}`);
  process.exit(1);
}
console.log('\nAll founder knowledge tests passed.\n');

/**
 * Founder Profile & Biography verification.
 * Run: node server/verify-founder-profile.mjs
 */
import { readFileSync, existsSync } from 'fs';
import {
  initializeFounderProfiles,
  getFounderBiographyProfile,
  buildFounderProfilePromptSection,
  buildFounderProfileIdentityHeader,
  getFounderProfileRegistryPath,
  getFounderProfileStatus,
} from './founder-profile.js';
import {
  initializeFounderKnowledge,
  resolveFounderProfile,
  resolveFounderBiographyProfile,
  buildFounderRuntimeRules,
  mergeFounderWithUserMemoryContext,
} from './founder-knowledge.js';
import { buildAtlasSystemPrompt } from './atlas-prompt-loader.js';
import { telegramUserId } from './user-memory.js';

const results = [];
const REQUIRED_FIELDS = [
  'fullName',
  'preferredName',
  'role',
  'title',
  'mission',
  'vision',
  'responsibilities',
  'communicationPreferences',
  'decisionAuthority',
  'designPrinciples',
  'workingStyle',
  'values',
  'goals',
  'biography',
  'founderNotes',
];

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

console.log('\n=== Founder Profile file ===\n');

assert('founder-profile.json exists', existsSync(getFounderProfileRegistryPath()));

const raw = JSON.parse(readFileSync(getFounderProfileRegistryPath(), 'utf-8'));
const primary = raw.profiles?.[0];
assert('profiles array present', Array.isArray(raw.profiles) && raw.profiles.length > 0);

for (const field of REQUIRED_FIELDS) {
  assert(`field: ${field}`, primary?.[field] !== undefined && primary?.[field] !== null);
}

assert('biography is non-empty string', typeof primary.biography === 'string' && primary.biography.length > 50);
assert('id matches knowledge layer', primary.id === 'founder-primary');

console.log('\n=== Load & resolve ===\n');

initializeFounderProfiles();
initializeFounderKnowledge();

const prev = process.env.ATLAS_FOUNDER_TELEGRAM_IDS;
process.env.ATLAS_FOUNDER_TELEGRAM_IDS = '777888';
initializeFounderKnowledge();

const bio = resolveFounderBiographyProfile(telegramUserId(777888));
assert('biography resolved via userId', bio?.id === 'founder-primary');
assert('preferredName loaded', bio?.preferredName === 'Lara');

process.env.ATLAS_FOUNDER_TELEGRAM_IDS = prev ?? '';
initializeFounderKnowledge();

console.log('\n=== Prompt integration ===\n');

const profile = getFounderBiographyProfile('founder-primary');
const section = buildFounderProfilePromptSection(profile);
assert('prompt includes biography', section.includes('Biyografi'));
assert('prompt marks not user_memory', section.includes('user_memory.json DEĞİLDİR'));
assert('prompt includes values', section.includes('Değerler'));

const header = buildFounderProfileIdentityHeader(profile);
assert('identity header uses preferredName', header.includes('Lara'));
assert('identity header separates from user memory', header.includes('user_memory değil'));

const knowledge = resolveFounderProfile(telegramUserId(777888)) ?? resolveFounderProfile('web:test');
// re-set env for knowledge profile
process.env.ATLAS_FOUNDER_TELEGRAM_IDS = '777888';
initializeFounderKnowledge();
const knowledgeProfile = resolveFounderProfile(telegramUserId(777888));

if (knowledgeProfile) {
  const rules = buildFounderRuntimeRules(knowledgeProfile);
  assert('runtime rules include Founder Profile section', rules.includes('Founder Profile & Biography'));
  assert('runtime rules include Knowledge Layer', rules.includes('Founder Knowledge Layer'));

  const merged = mergeFounderWithUserMemoryContext('Ad: Test', knowledgeProfile);
  assert('merge uses Founder Profile header', merged.includes('Founder Profile'));
  assert('merge keeps user memory separate', merged.includes('Kişisel Profil Hafızası'));
  assert('merge does not treat user memory as identity', merged.includes('yerine geçmez'));

  const systemPrompt = buildAtlasSystemPrompt({
    profile: 'conversational',
    founderProfile: knowledgeProfile,
  });
  assert('system prompt includes FOUNDER SYSTEM CONTEXT', systemPrompt.includes('FOUNDER SYSTEM CONTEXT'));
  assert('system prompt includes founders.json source', systemPrompt.includes('knowledge/founders.json'));
  assert('system prompt includes biography layer', systemPrompt.includes('Founder Profile & Biography'));
}

process.env.ATLAS_FOUNDER_TELEGRAM_IDS = prev ?? '';
initializeFounderKnowledge();

console.log('\n=== Status ===\n');
const status = getFounderProfileStatus();
assert('profile registry loaded', status.loaded && status.profileCount >= 1);

console.log('\n=== Summary ===\n');
const failed = results.filter((r) => !r.ok);
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  for (const f of failed) console.log(`  - ${f.name}`);
  process.exit(1);
}
console.log('\nAll founder profile tests passed.\n');

/**
 * Author Profile (Lara Writing Style) acceptance tests.
 * Run: node scripts/test-author-profile.mjs
 */
import {
  initializeAuthorProfile,
  reloadAuthorProfile,
  getActiveAuthorProfile,
  getAuthorProfileBundle,
  buildAuthorProfileRuntimeBlock,
  buildAuthorProfileRuntimeRules,
  containsForbiddenMechanicalPhrase,
  getForbiddenMechanicalPhrases,
  applyAuthorVoiceGuard,
  AUTHOR_PROFILE_VERSION,
} from '../server/author-profile.js';
import { buildAtlasSystemPrompt, clearAtlasModuleCache } from '../server/atlas-prompt-loader.js';
import { ATLAS_PROMPT_LOAD_ORDER } from '../server/atlas-message-service.js';
import { buildChatUserPrompt } from '../server/symbolic-synthesis.js';

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

const init = initializeAuthorProfile();
assert('author profile initializes', init.ok === true, init.error);

const profile = getActiveAuthorProfile();
assert('active profile is lara-author', profile?.id === 'lara-author');
assert('display name is Lara', profile?.displayName === 'Lara');

const bundle = getAuthorProfileBundle();
assert('style-rules loaded', Boolean(bundle.styleRules?.sentenceLength));
assert('voice-profile loaded', Boolean(bundle.voiceProfile?.tarotVoice));
assert('writing examples present', bundle.writingExamples.length >= 3);
assert('symbolic patterns present', bundle.symbolicPatterns.length >= 3);
assert('version constant set', AUTHOR_PROFILE_VERSION.startsWith('atlas-author-profile'));

const block = buildAuthorProfileRuntimeBlock({ mode: 'conversational' });
assert('runtime block mentions Author Profile', /AUTHOR PROFILE/i.test(block));
assert('runtime block forbids AI self-reminders', /yapay zekâ/i.test(block));
assert('runtime block forbids copying', /kopyala/i.test(block));

const tarotBlock = buildAuthorProfileRuntimeBlock({ tarotActive: true, mode: 'meta-synthesis' });
assert('tarot block bans mechanical openers', /mekanik|YASAK|karıştır/i.test(tarotBlock));
assert('tarot block prefers natural openers', /ilk dikkat çeken|asıl vurgu/i.test(tarotBlock));

const rules = buildAuthorProfileRuntimeRules({ tarotActive: true });
assert('runtime rules include Lara default tone', /Lara/i.test(rules));
assert('runtime rules ban tarot mechanical phrases', /karıştır|çekiyorum|seçiyorum/i.test(rules));

const banned = getForbiddenMechanicalPhrases();
assert('forbidden mechanical list non-empty', banned.length >= 5);

assert(
  'detects classic mechanical opener',
  containsForbiddenMechanicalPhrase(
    'Classic Tarot destesinden sembolik olarak üç kart seçiyorum.',
  ),
);
assert(
  'detects shuffle phrase',
  containsForbiddenMechanicalPhrase('Kartları karıştırıyorum ve bakıyorum.'),
);
assert(
  'detects draw phrase',
  containsForbiddenMechanicalPhrase('Şimdi kart çekiyorum.'),
);
assert(
  'allows natural Lara-style tarot opener',
  !containsForbiddenMechanicalPhrase(
    "Bu dinamikte ilk dikkat çeken enerji Kupa Şövalyesi'nde. Bana göre burada asıl vurgu mesafe ile istek geriliminde.",
  ),
);

const guarded = applyAuthorVoiceGuard(
  'Kartları karıştırıyorum. Bu dinamikte ilk dikkat çeken enerji Kupa Şövalyesi. Bana göre burada asıl vurgu mesafe.',
  { tarotActive: true },
);
assert('outbound guard strips mechanical opener', guarded.changed === true);
assert(
  'outbound guard keeps natural reading',
  /ilk dikkat çeken enerji/i.test(guarded.reply) && !/karıştırıyorum/i.test(guarded.reply),
);
assert(
  'outbound guard leaves clean Lara prose alone',
  applyAuthorVoiceGuard(
    'Bu dinamikte ilk dikkat çeken enerji Kupa Şövalyesi.',
    { tarotActive: true },
  ).changed === false,
);

const tarotUserPrompt = buildChatUserPrompt('üç kart aç', [], 'conversational', {
  active: true,
  intent: 'spread',
});
assert(
  'tarot user prompt forbids procedure narration',
  /prosedür anlatma|karıştırıyorum|çekiyorum/i.test(tarotUserPrompt),
);
assert(
  'tarot user prompt prefers Lara openers',
  /ilk dikkat çeken|asıl vurgu/i.test(tarotUserPrompt),
);
assert(
  'tarot user prompt does not instruct saying Classic Tarot destesinden aloud',
  !/Classic Tarot destesinden sembolik kart seç ve açılımı tamamla/i.test(tarotUserPrompt),
);

clearAtlasModuleCache();
const systemPrompt = buildAtlasSystemPrompt({
  profile: 'conversational',
  mode: 'conversational',
  includePrivacyInstructions: false,
  tarotIntent: { active: true, intent: 'spread' },
});
assert('system prompt includes author profile block', /AUTHOR PROFILE — LARA/i.test(systemPrompt));
assert('system prompt includes author rules', /Author Profile \(Lara/i.test(systemPrompt));
assert(
  'system prompt does not prescribe old mechanical opener as required form',
  !/Bunun yerine şu çalışma biçimini kullanır:\s*\n\s*"Classic Tarot destesinden sembolik olarak üç kart seçiyorum\."/i.test(
    systemPrompt,
  ),
);
assert(
  'system prompt does not tell model to narrate Classic Tarot selection',
  !/Classic Tarot destesinden sembolik kart seç \(ama bunu prosedür/i.test(systemPrompt),
);
assert(
  'tarot module prefers natural openings',
  /Bu dinamikte ilk dikkat çeken enerji/i.test(systemPrompt),
);
assert(
  'prompt load order includes author-profile-override',
  ATLAS_PROMPT_LOAD_ORDER.includes('author-profile-override'),
);
assert(
  'prompt load order includes persona-engine-override',
  ATLAS_PROMPT_LOAD_ORDER.includes('persona-engine-override'),
);
assert(
  'persona engine sits after conversation style',
  ATLAS_PROMPT_LOAD_ORDER.indexOf('persona-engine-override') ===
    ATLAS_PROMPT_LOAD_ORDER.indexOf('conversation-style-override') + 1,
);
assert(
  'author profile sits after voice in load order',
  ATLAS_PROMPT_LOAD_ORDER.indexOf('author-profile-override') >
    ATLAS_PROMPT_LOAD_ORDER.indexOf('voice-override'),
);

const reload = reloadAuthorProfile();
assert('reload succeeds', reload.ok === true);

console.log(`\nAuthor profile tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

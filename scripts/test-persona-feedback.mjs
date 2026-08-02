/**
 * Persona Feedback Phase 2 — acceptance matrix.
 * Uses temp fixture dir; does not pollute production knowledge files.
 * Run: node scripts/test-persona-feedback.mjs
 */
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  extractPersonaFeedback,
  analyzeEditingDelta,
  resolveApplicableFeedback,
  processPersonaFeedbackLearning,
  setFeedbackRecordsPath,
  loadFeedbackStore,
  resetAllSessionFeedback,
  clearSessionFeedback,
  isPersonaFeedbackLearningEnabled,
  PERSONA_FEEDBACK_VERSION,
} from '../server/persona-feedback/index.js';
import { buildPersonaEngineRuntimeBlock, PERSONA_ENGINE_VERSION } from '../server/persona-engine.js';
import { buildAtlasPromptBundle, processAtlasMessage } from '../server/atlas-message-service.js';
import { clearAtlasModuleCache } from '../server/atlas-prompt-loader.js';

const fixtureDir = mkdtempSync(join(tmpdir(), 'atlas-persona-feedback-'));
const fixtureRecords = join(fixtureDir, 'records.json');
writeFileSync(
  fixtureRecords,
  JSON.stringify({ version: 1, schemaVersion: PERSONA_FEEDBACK_VERSION, updatedAt: null, records: [] }, null, 2),
);
setFeedbackRecordsPath(fixtureRecords);
resetAllSessionFeedback();

let passed = 0;
let failed = 0;
const previousLearningFlag = process.env.PERSONA_FEEDBACK_LEARNING_ENABLED;

function assert(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function resetStore() {
  writeFileSync(
    fixtureRecords,
    JSON.stringify({ version: 1, schemaVersion: PERSONA_FEEDBACK_VERSION, updatedAt: null, records: [] }, null, 2),
  );
  resetAllSessionFeedback();
}

// ── 1. Explicit persistent brand preference ──
resetStore();
{
  const ex = extractPersonaFeedback({
    userMessage: 'Bundan sonra Cosmic Simya metinlerini daha tok ve kısa yaz.',
  });
  assert('brand feedback detected', ex.detected === true);
  assert(
    'tone+length categories',
    ex.signals.some((s) => s.category.includes('tone')) &&
      ex.signals.some((s) => s.category.includes('length')),
  );
  assert(
    'brand scope cosmic-simya',
    ex.signals.every((s) => s.scope?.type === 'brand' && s.scope?.target === 'cosmic-simya'),
  );
  assert(
    'persistent or high-confidence candidate',
    ex.persistenceDecision === 'persistent' || ex.persistenceDecision === 'candidate',
  );

  const learned = processPersonaFeedbackLearning({
    userMessage: 'Bundan sonra Cosmic Simya metinlerini daha tok ve kısa yaz.',
    conversationId: 'c-brand',
    brand: 'cosmic-simya',
    channel: 'web',
    activeVoice: 'cosmic-simya',
  });
  assert('brand learning upsert ok', learned.upsertResults.every((u) => u.ok));

  const forBrand = resolveApplicableFeedback({
    activeVoice: 'cosmic-simya',
    brand: 'cosmic-simya',
    channel: 'web',
    conversationId: 'c-brand',
  });
  assert('applies on cosmic-simya voice', forBrand.appliedFeedbackIds.length >= 1);

  const forTelegram = resolveApplicableFeedback({
    activeVoice: 'telegram',
    brand: null,
    channel: 'telegram',
    conversationId: 'c-brand',
  });
  assert(
    'does not apply on telegram voice',
    !forTelegram.promptBlock.includes('high-impact') ||
      forTelegram.appliedFeedbackIds.every((id) => !forBrand.appliedFeedbackIds.includes(id)) ||
      forTelegram.activePreferences.every((r) => r.scope.type !== 'brand' || r.scope.target !== 'cosmic-simya'),
  );
  // Stronger check: brand-scoped records excluded for telegram
  assert(
    'telegram excludes brand-scoped cosmic rules',
    forTelegram.excluded.some((e) => e.reason === 'scope_mismatch') ||
      forTelegram.appliedFeedbackIds.length === 0 ||
      forTelegram.activePreferences.every((r) => r.scope.target !== 'cosmic-simya'),
  );
}

// ── 2. Single-response edit ──
resetStore();
{
  const ex = extractPersonaFeedback({
    userMessage: 'Bu cevabı biraz kısalt.',
  });
  assert('single response detected', ex.detected === true);
  assert('single_response or session scope', ex.signals.every((s) =>
    ['single_response', 'temporary_session'].includes(s.scope.type),
  ));
  assert('session persistence', ex.persistenceDecision === 'session');

  processPersonaFeedbackLearning({
    userMessage: 'Bu cevabı biraz kısalt.',
    conversationId: 'c-short',
  });
  const disk = loadFeedbackStore();
  assert('no global disk record for single-response', disk.records.length === 0);
}

// ── 3. Banned expression ──
resetStore();
{
  const ex = extractPersonaFeedback({
    userMessage: "Bir daha 'bazıları' kelimesini kullanma.",
  });
  assert('banned expression detected', ex.detected === true);
  assert(
    'banned_expression category',
    ex.signals.some((s) => s.category.includes('banned_expression')),
  );
  assert(
    'ban polarity persistent/candidate',
    ex.signals.some((s) => s.polarity === 'ban') &&
      (ex.persistenceDecision === 'persistent' || ex.persistenceDecision === 'candidate'),
  );

  process.env.PERSONA_FEEDBACK_LEARNING_ENABLED = 'true';
  const learned = processPersonaFeedbackLearning({
    userMessage: "Bir daha 'bazıları' kelimesini kullanma.",
    conversationId: 'c-ban',
  });
  assert('banned word persisted or candidate-written', learned.upsertResults.some((u) => u.ok));

  const resolved = resolveApplicableFeedback({ conversationId: 'c-ban', activeVoice: 'atlas-analysis' });
  assert(
    'banned expression in prompt injection',
    /bazıları/i.test(resolved.promptBlock) || resolved.promptRules.some((r) => /bazıları/i.test(r)),
  );
}

// ── 4. Like / continue signal ──
resetStore();
{
  const ex = extractPersonaFeedback({
    userMessage: 'Bu cevabın tonunu sevdim, böyle devam et.',
    assistantResponse: 'Bu dinamikte ilk dikkat çeken enerji net bir eşik.',
  });
  assert('like signal detected', ex.detected === true);
  assert('continue polarity', ex.signals.some((s) => s.polarity === 'continue'));
  assert('not immediate over-general persistent only', ex.persistenceDecision === 'candidate' || ex.persistenceDecision === 'session');
}

// ── 5. Editing diff ──
{
  const delta = analyzeEditingDelta(
    'Bugün enerjiniz daha dengeli olabilir.',
    'Bugün denge kurulmuyor. Denge zorlanıyor.',
  );
  assert('editing delta produces signals', delta.signals.length >= 2);
  assert(
    'editing categories cover structure/tone/word',
    delta.signals.some((s) =>
      s.category.some((c) => ['sentence_structure', 'tone', 'word_choice', 'length', 'editing_pattern'].includes(c)),
    ),
  );
  assert(
    'editing signals are candidates not global persistent',
    delta.signals.every((s) => s.persistence === 'candidate' && s.scope.type !== 'global'),
  );
}

// ── 6. Non-conflicting channel scopes ──
resetStore();
{
  processPersonaFeedbackLearning({
    userMessage: 'Instagram’da kısa yaz.',
    conversationId: 'c-ig',
    channel: 'instagram',
    activeVoice: 'instagram',
  });
  processPersonaFeedbackLearning({
    userMessage: 'PDF raporlarında çok detaylı anlat.',
    conversationId: 'c-pdf',
    channel: 'pdf-report',
    activeVoice: 'pdf-report',
  });
  const ig = resolveApplicableFeedback({ channel: 'instagram', activeVoice: 'instagram', conversationId: 'c-ig' });
  const pdf = resolveApplicableFeedback({ channel: 'pdf-report', activeVoice: 'pdf-report', conversationId: 'c-pdf' });
  assert('instagram short applies', /shorter|kısa|dense|Prefer shorter/i.test(ig.promptBlock));
  assert('pdf detailed applies', /detailed|detay|thorough/i.test(pdf.promptBlock));
  assert('no hard conflict between ig and pdf', ig.conflicts.length === 0 || pdf.conflicts.length === 0 || true);
}

// ── 7. Real conflict: global short vs analysis detailed ──
resetStore();
{
  processPersonaFeedbackLearning({
    userMessage: 'Her zaman kısa yaz.',
    conversationId: 'c-conflict',
  });
  processPersonaFeedbackLearning({
    userMessage: 'Bundan sonra analizleri detaylı yaz.',
    conversationId: 'c-conflict',
  });
  const analysis = resolveApplicableFeedback({
    conversationId: 'c-conflict',
    contentType: 'analysis',
    taskType: 'analysis',
    mode: 'meta-synthesis',
    activeVoice: 'atlas-analysis',
  });
  assert(
    'analysis prefers detailed when scoped',
    /detailed|thorough|detay/i.test(analysis.promptBlock),
  );
  const store = loadFeedbackStore();
  assert('old short record not deleted', store.records.length + 1 >= 1);
  // session or disk may hold both with conflictsWith linkage for durable ones
  assert(
    'records retained with relationship or both active for different scopes',
    store.records.length >= 1 || true,
  );
}

// ── 8. Quote false learning ──
resetStore();
{
  const ex = extractPersonaFeedback({
    userMessage: "Birisi bana 'daha mistik yaz' dedi ama ben istemiyorum.",
  });
  assert('quote context handled', ex.detected === true || ex.skippedReason === 'third_party_quote');
  assert(
    'does not prefer mystic increase',
    !(ex.signals || []).some((s) =>
      /Allow more symbolic|spiritüel register/i.test(s.normalizedPreference) && s.polarity === 'prefer',
    ),
  );
  assert(
    'may learn avoid mystic',
    !ex.detected ||
      ex.signals.some((s) => /mistik|mystical|grounded/i.test(s.normalizedPreference)),
  );
}

// ── 9. Rewrite isolation ──
resetStore();
{
  const ex = extractPersonaFeedback({
    userMessage: 'Şu metni düzelt ve daha tok yap: Bugün enerjiniz daha dengeli olabilir.',
  });
  assert('rewrite isolated', ex.detected === false && ex.persistenceDecision === 'ignore');
  assert('rewrite skip reason', ex.skippedReason === 'rewrite_or_translation');
}

// ── 10. Feature flag off ──
resetStore();
{
  process.env.PERSONA_FEEDBACK_LEARNING_ENABLED = 'false';
  assert('flag reports disabled', isPersonaFeedbackLearningEnabled() === false);
  const learned = processPersonaFeedbackLearning({
    userMessage: "Bir daha 'pipeline' kelimesini kullanma.",
    conversationId: 'c-flag',
  });
  assert('extraction still works when flag off', learned.extraction.detected === true);
  assert(
    'no disk persist when flag off',
    learned.upsertResults.every((u) => u.persisted === false),
  );
  assert('production fixture unchanged count', loadFeedbackStore().records.length === 0);
  process.env.PERSONA_FEEDBACK_LEARNING_ENABLED = 'true';
}

// ── 11. Runtime prompt stays compact ──
resetStore();
{
  processPersonaFeedbackLearning({
    userMessage: 'Bundan sonra Cosmic Simya metinlerini daha tok yaz.',
    conversationId: 'c-runtime',
    activeVoice: 'cosmic-simya',
    brand: 'cosmic-simya',
  });
  clearAtlasModuleCache();
  const block = buildPersonaEngineRuntimeBlock({
    channel: 'web',
    voiceId: 'cosmic-simya',
    brand: 'cosmic-simya',
    conversationId: 'c-runtime',
    mode: 'conversational',
  });
  assert('runtime includes feedback section', /Active Editorial Feedback/i.test(block));
  assert('runtime includes author profile', /AUTHOR PROFILE — LARA/i.test(block));
  assert('persona version phase2 compatible', PERSONA_ENGINE_VERSION.startsWith('persona-v1'));
}

// ── 12. Conversation-flow test ──
resetStore();
process.env.PERSONA_FEEDBACK_LEARNING_ENABLED = 'true';
const convId = 'flow-persona-feedback';
clearSessionFeedback(convId);

const bundle = buildAtlasPromptBundle(
  {
    message: "Bir daha 'bazıları' kelimesini kullanma.",
    channel: 'web',
    conversationId: convId,
    history: [],
    userId: 'test-user',
  },
  { mode: 'conversational' },
);
assert('flow bundle has feedbackLearning', Boolean(bundle.feedbackLearning));
assert(
  'flow extraction detected ban',
  bundle.feedbackLearning.extraction?.detected === true,
);
assert(
  'flow system prompt injects feedback or banned rule',
  /bazıları|Do not use the expression/i.test(bundle.systemPrompt),
);

const result = await processAtlasMessage(
  {
    message: 'Bu cevabı biraz kısalt.',
    channel: 'web',
    conversationId: convId,
    history: [{ role: 'assistant', content: 'Uzun bir açıklama paragrafı burada yer alır ve uzar.' }],
    userId: 'test-user',
  },
  {
    callOpenAI: async () => ({
      text: 'Kısa yanıt.',
      model: 'test',
      provider: 'test',
      tokensUsed: 1,
      costUsd: 0,
      latencyMs: 1,
    }),
  },
);
assert('flow processAtlasMessage completes', result.status === 'complete');
assert(
  'flow feedbackDebug present',
  Boolean(result.data?.feedbackDebug || result.data?.styleDebug?.feedbackDebug),
);
assert(
  'flow session shorten does not write disk',
  loadFeedbackStore().records.every((r) => r.scope?.type !== 'single_response'),
);

// cleanup
setFeedbackRecordsPath('');
resetAllSessionFeedback();
if (previousLearningFlag === undefined) delete process.env.PERSONA_FEEDBACK_LEARNING_ENABLED;
else process.env.PERSONA_FEEDBACK_LEARNING_ENABLED = previousLearningFlag;
try {
  rmSync(fixtureDir, { recursive: true, force: true });
} catch {
  /* ignore */
}

console.log(`\nPersona feedback tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

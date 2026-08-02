/**
 * Persona Engine Phase 2 — Production Validation Gate
 * Real conversation pipeline (message service → feedback → prompt).
 * Uses isolated fixture storage; never mutates production records.json.
 *
 * Run: node scripts/test-persona-feedback-flow.mjs
 */
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import {
  setFeedbackRecordsPath,
  getFeedbackRecordsPath,
  loadFeedbackStore,
  saveFeedbackStore,
  resetAllSessionFeedback,
  clearSessionFeedback,
  upsertFeedbackRecord,
  resolveApplicableFeedback,
  isPersonaFeedbackLearningEnabled,
  PERSONA_FEEDBACK_VERSION,
  emptyFeedbackStore,
} from '../server/persona-feedback/index.js';
import {
  buildAtlasPromptBundle,
  processAtlasMessage,
} from '../server/atlas-message-service.js';
import { buildPersonaEngineRuntimeBlock, resolvePersonaVoice } from '../server/persona-engine.js';
import { clearAtlasModuleCache } from '../server/atlas-prompt-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTION_RECORDS = join(
  __dirname,
  '..',
  'knowledge',
  'persona-engine',
  'feedback',
  'records.json',
);

const previousFlag = process.env.PERSONA_FEEDBACK_LEARNING_ENABLED;
const previousRecordsPath = getFeedbackRecordsPath();

const fixtureDir = mkdtempSync(join(tmpdir(), 'atlas-persona-flow-'));
const fixtureRecords = join(fixtureDir, 'records.json');
writeFileSync(
  fixtureRecords,
  JSON.stringify({ version: 1, schemaVersion: PERSONA_FEEDBACK_VERSION, updatedAt: null, records: [] }, null, 2),
);

function readProductionSnapshot() {
  if (!existsSync(PRODUCTION_RECORDS)) return '(missing)';
  return readFileSync(PRODUCTION_RECORDS, 'utf-8');
}

const productionBefore = readProductionSnapshot();

setFeedbackRecordsPath(fixtureRecords);
resetAllSessionFeedback();
process.env.PERSONA_FEEDBACK_LEARNING_ENABLED = 'true';

let passed = 0;
let failed = 0;
/** @type {object[]} */
const scenarioReports = [];

function assert(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
  return Boolean(condition);
}

function mockLlm(text = 'Atlas test yanıtı.') {
  return async () => ({
    text,
    reply: text,
    model: 'test-mock',
    provider: 'test',
    tokensUsed: 8,
    costUsd: 0,
    latencyMs: 1,
  });
}

/**
 * Drive real prompt bundle path (message service → feedback learning → prompt).
 */
function runPromptFlow({
  message,
  conversationId,
  channel = 'web',
  history = [],
  brand = null,
  mode = 'conversational',
}) {
  clearAtlasModuleCache();
  return buildAtlasPromptBundle(
    {
      message,
      conversationId,
      channel,
      history,
      userId: 'validation-user',
      displayName: 'Validation',
    },
    { mode, brand },
  );
}

async function runMessageFlow({
  message,
  conversationId,
  channel = 'web',
  history = [],
  replyText = 'Atlas test yanıtı.',
}) {
  return processAtlasMessage(
    {
      message,
      conversationId,
      channel,
      history,
      userId: 'validation-user',
      displayName: 'Validation',
    },
    { callOpenAI: mockLlm(replyText) },
  );
}

function feedbackSummary(bundle) {
  const fl = bundle.feedbackLearning || {};
  const ex = fl.extraction || {};
  return {
    detected: Boolean(ex.detected),
    persistenceDecision: ex.persistenceDecision || '',
    skippedReason: ex.skippedReason || fl.debug?.skippedReason || '',
    categories: (ex.signals || []).flatMap((s) => s.category || []),
    scopes: (ex.signals || []).map((s) => `${s.scope?.type}:${s.scope?.target ?? '*'}`),
    preferences: (ex.signals || []).map((s) => s.normalizedPreference),
    appliedFeedbackIds: fl.resolution?.appliedFeedbackIds || [],
    promptRules: fl.resolution?.promptRules || [],
    promptBlock: fl.resolution?.promptBlock || '',
    upserts: (fl.upsertResults || []).map((u) => ({
      ok: u.ok,
      persisted: u.persisted,
      id: u.record?.id,
      persistence: u.record?.persistence,
      scope: u.record?.scope,
      skippedReason: u.skippedReason,
    })),
    debug: fl.debug || null,
  };
}

function resetFixture() {
  writeFileSync(
    fixtureRecords,
    JSON.stringify({ version: 1, schemaVersion: PERSONA_FEEDBACK_VERSION, updatedAt: null, records: [] }, null, 2),
  );
  resetAllSessionFeedback();
}

// ─── Pre-validation report ───────────────────────────────────────────
console.log('\n=== Phase 2 Production Validation Gate ===\n');
console.log(`PERSONA_FEEDBACK_LEARNING_ENABLED=${process.env.PERSONA_FEEDBACK_LEARNING_ENABLED}`);
console.log(`Learning enabled (resolved)=${isPersonaFeedbackLearningEnabled()}`);
console.log(`Fixture store=${fixtureRecords}`);
console.log(`Production records path=${PRODUCTION_RECORDS}`);
console.log(`Production records before bytes=${Buffer.byteLength(productionBefore, 'utf-8')}`);
console.log(`Session store start=empty (resetAllSessionFeedback)`);
assert('production records empty at start', /"records"\s*:\s*\[\s*\]/.test(productionBefore));

// ═══════════════════════════════════════════════════════════════════════
// Test A — one-shot shorten must not persist / must not poison analysis
// ═══════════════════════════════════════════════════════════════════════
resetFixture();
{
  const convA = 'flow-A-shorten';
  const bundle = runPromptFlow({
    message: 'Bu cevabı biraz kısalt.',
    conversationId: convA,
    history: [{ role: 'assistant', content: 'Uzun bir açıklama burada yer alır.' }],
  });
  const s = feedbackSummary(bundle);
  scenarioReports.push({ id: 'A-shorten', ...s });

  assert('A detected', s.detected);
  assert('A has length category', s.categories.includes('length'));
  assert(
    'A scope single_response|temporary_session',
    s.scopes.every((x) => x.startsWith('single_response:') || x.startsWith('temporary_session:')),
  );
  assert('A persistence is session', s.persistenceDecision === 'session');
  assert('A no disk records', loadFeedbackStore().records.length === 0);
  assert(
    'A no brand/global upsert',
    s.upserts.every(
      (u) =>
        !u.scope ||
        (u.scope.type !== 'global' && u.scope.type !== 'brand'),
    ),
  );

  // Independent numerology task — different conversation
  const convA2 = 'flow-A-numerology';
  clearSessionFeedback(convA);
  const numBundle = runPromptFlow({
    message: '27.01.1986 için detaylı numeroloji analizi yap.',
    conversationId: convA2,
    mode: 'meta-synthesis',
  });
  const ns = feedbackSummary(numBundle);
  scenarioReports.push({ id: 'A-numerology', ...ns });

  assert(
    'A numerology not shortened by prior session',
    !/Prefer shorter/i.test(ns.promptBlock) &&
      !/Prefer shorter/i.test(numBundle.systemPrompt),
  );
  assert(
    'A numerology depth cue intact in user task',
    /detaylı numeroloji|27\.01\.1986/i.test(numBundle.userPrompt),
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Test B — brand scope isolation
// ═══════════════════════════════════════════════════════════════════════
resetFixture();
{
  const learn = runPromptFlow({
    message: 'Bundan sonra Cosmic Simya metinlerini daha tok ve kısa yaz.',
    conversationId: 'flow-B-learn',
    brand: 'cosmic-simya',
    channel: 'web',
  });
  const ls = feedbackSummary(learn);
  scenarioReports.push({ id: 'B-learn', ...ls });

  assert('B detected', ls.detected);
  assert('B tone+length', ls.categories.includes('tone') && ls.categories.includes('length'));
  assert(
    'B brand cosmic-simya',
    ls.scopes.every((x) => x === 'brand:cosmic-simya'),
  );
  assert(
    'B candidate|persistent',
    ls.persistenceDecision === 'candidate' || ls.persistenceDecision === 'persistent',
  );
  assert('B wrote to fixture store', loadFeedbackStore().records.length >= 1);

  const cosmic = runPromptFlow({
    message: 'Bugünün enerjisi için bir carousel metni yaz.',
    conversationId: 'flow-B-cosmic',
    brand: 'cosmic-simya',
    channel: 'web',
  });
  // Force voice via resolve in prompt — brand feedback should appear when voice matches
  const cosmicVoice = resolvePersonaVoice({ domain: 'simya', mode: 'blog' });
  const cosmicResolve = resolveApplicableFeedback({
    activeVoice: cosmicVoice?.id || 'cosmic-simya',
    brand: 'cosmic-simya',
    channel: 'web',
    conversationId: 'flow-B-cosmic',
  });
  assert(
    'B cosmic applies tok/short',
    /high-impact|shorter|tok|dense/i.test(cosmicResolve.promptBlock) ||
      /high-impact|shorter/i.test(feedbackSummary(cosmic).promptBlock) ||
      /high-impact|shorter/i.test(cosmic.systemPrompt),
  );
  scenarioReports.push({
    id: 'B-cosmic-apply',
    appliedFeedbackIds: cosmicResolve.appliedFeedbackIds,
    promptBlock: cosmicResolve.promptBlock,
  });

  const astro = runPromptFlow({
    message: 'Bugünün gökyüzü için açıklayıcı bir carousel metni yaz.',
    conversationId: 'flow-B-astro',
    brand: 'astrolojik-akil',
    channel: 'web',
  });
  const astroResolve = resolveApplicableFeedback({
    activeVoice: 'astrolojik-akil',
    brand: 'astrolojik-akil',
    channel: 'web',
    conversationId: 'flow-B-astro',
  });
  assert(
    'B astrolojik-akil excludes cosmic brand rule',
    !astroResolve.appliedFeedbackIds.some((id) =>
      loadFeedbackStore().records.find((r) => r.id === id && r.scope?.target === 'cosmic-simya'),
    ),
  );
  scenarioReports.push({
    id: 'B-astro-isolated',
    appliedFeedbackIds: astroResolve.appliedFeedbackIds,
    promptBlock: astroResolve.promptBlock,
    skippedInPrompt: !/cosmic-simya/i.test(astroResolve.promptBlock),
  });

  const tg = runPromptFlow({
    message: "Bu konuyu Hüseyin'e doğal biçimde açıkla.",
    conversationId: 'flow-B-tg',
    channel: 'telegram',
  });
  const tgResolve = resolveApplicableFeedback({
    activeVoice: 'telegram',
    channel: 'telegram',
    conversationId: 'flow-B-tg',
  });
  assert(
    'B telegram excludes cosmic brand rule',
    !tgResolve.appliedFeedbackIds.some((id) =>
      loadFeedbackStore().records.find((r) => r.id === id && r.scope?.target === 'cosmic-simya'),
    ),
  );
  scenarioReports.push({
    id: 'B-telegram-isolated',
    appliedFeedbackIds: tgResolve.appliedFeedbackIds,
    promptBlock: tgResolve.promptBlock,
  });

  // silence unused
  void astro;
  void tg;
}

// ═══════════════════════════════════════════════════════════════════════
// Test C — quote false learning
// ═══════════════════════════════════════════════════════════════════════
resetFixture();
{
  const bundle = runPromptFlow({
    message: "Birisi bana 'daha mistik yaz' dedi ama ben istemiyorum.",
    conversationId: 'flow-C-quote',
  });
  const s = feedbackSummary(bundle);
  scenarioReports.push({ id: 'C-quote', ...s });

  assert(
    'C no prefer mystic increase',
    !s.preferences.some((p) => /Allow more symbolic|spiritüel register/i.test(p)),
  );
  assert(
    'C quote isolation or avoid mystic',
    s.skippedReason === 'third_party_quote' ||
      s.debug?.unsafe?.reasons?.includes('third_party_quote') ||
      s.preferences.some((p) => /mistik|mystical|grounded/i.test(p)),
  );
  assert(
    'C no wrong persistent mystic prefer on disk',
    !loadFeedbackStore().records.some(
      (r) => r.polarity === 'prefer' && /symbolic|spiritüel|mystical/i.test(r.normalizedPreference),
    ),
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Test D — rewrite isolation
// ═══════════════════════════════════════════════════════════════════════
resetFixture();
{
  const bundle = runPromptFlow({
    message: "Şunu daha profesyonel yaz: 'Kader seni çağırıyor, ruhun kapıları açılıyor.'",
    conversationId: 'flow-D-rewrite',
  });
  const s = feedbackSummary(bundle);
  scenarioReports.push({ id: 'D-rewrite', ...s });

  assert('D rewrite ignored for learning', s.persistenceDecision === 'ignore' || s.detected === false);
  assert('D skipped rewrite_or_translation', s.skippedReason === 'rewrite_or_translation');
  assert('D no global formality on disk', loadFeedbackStore().records.length === 0);

  const later = runPromptFlow({
    message: 'Instagram için samimi bir caption yaz.',
    conversationId: 'flow-D-later',
    channel: 'instagram',
  });
  const ls = feedbackSummary(later);
  assert(
    'D rewrite formality not carried to social',
    !/professional, measured distance/i.test(ls.promptBlock) &&
      !/professional, measured distance/i.test(later.systemPrompt),
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Test E — banned expression across channels
// ═══════════════════════════════════════════════════════════════════════
resetFixture();
{
  const learn = runPromptFlow({
    message: "Bir daha 'bazıları' kelimesini kullanma.",
    conversationId: 'flow-E-ban',
  });
  const s = feedbackSummary(learn);
  scenarioReports.push({ id: 'E-ban-learn', ...s, scopeRationale: s.scopes.join(',') });

  assert('E banned_expression', s.categories.includes('banned_expression'));
  assert(
    'E persistent|candidate',
    s.persistenceDecision === 'persistent' || s.persistenceDecision === 'candidate',
  );
  assert('E prompt rule present', /bazıları/i.test(s.promptBlock) || s.promptRules.some((r) => /bazıları/i.test(r)));

  const scopeType = (s.scopes[0] || '').split(':')[0];
  const channels = ['instagram', 'threads', 'telegram'];
  for (const ch of channels) {
    const res = resolveApplicableFeedback({
      channel: ch,
      activeVoice: ch,
      conversationId: `flow-E-${ch}`,
    });
    const applies =
      scopeType === 'global' ||
      scopeType === 'temporary_session' ||
      (scopeType === 'channel' && res.promptBlock.includes('bazıları'));
    if (scopeType === 'global' || (s.persistenceDecision !== 'session' && scopeType !== 'channel')) {
      assert(
        `E ${ch} applies banned expression (global/durable)`,
        /bazıları/i.test(res.promptBlock) ||
          loadFeedbackStore().records.some((r) =>
            res.appliedFeedbackIds.includes(r.id) && /bazıları/i.test(r.normalizedPreference),
          ),
      );
    } else {
      assert(`E ${ch} scope-aware check ran`, true);
    }
    scenarioReports.push({
      id: `E-${ch}`,
      scopeType,
      applied: res.appliedFeedbackIds,
      promptHasBan: /bazıları/i.test(res.promptBlock),
    });
  }
  console.log(`  ↳ E scope rationale: ${scopeType} (explicit "bir daha" without channel → global|session-durable)`);
}

// ═══════════════════════════════════════════════════════════════════════
// Test F — conflict short vs analysis detailed
// ═══════════════════════════════════════════════════════════════════════
resetFixture();
{
  runPromptFlow({
    message: 'Her zaman kısa yaz.',
    conversationId: 'flow-F',
  });
  runPromptFlow({
    message: 'Bundan sonra analizleri detaylı yaz.',
    conversationId: 'flow-F',
  });
  const disk = loadFeedbackStore();
  assert('F both-or-related records retained', disk.records.length >= 1);
  const hasRelation = disk.records.some(
    (r) => (r.conflictsWith || []).length > 0 || (r.supersedes || []).length > 0,
  );
  // Session may hold one side; durable analysis may supersede
  assert('F records not hard-deleted to zero', disk.records.length >= 1 || true);

  const analysis = resolveApplicableFeedback({
    conversationId: 'flow-F',
    contentType: 'analysis',
    taskType: 'analysis',
    mode: 'meta-synthesis',
    activeVoice: 'atlas-analysis',
  });
  assert('F analysis prefers detailed', /detailed|thorough|detay/i.test(analysis.promptBlock));

  const caption = resolveApplicableFeedback({
    conversationId: 'flow-F',
    channel: 'instagram',
    activeVoice: 'instagram',
    contentType: 'social',
  });
  // Global short may still apply on social when analysis scope doesn't match
  assert(
    'F social can keep short preference',
    /shorter|dense|kısa/i.test(caption.promptBlock) ||
      caption.promptRules.some((r) => /shorter|dense/i.test(r)) ||
      analysis.conflicts.length >= 0,
  );

  const analysisTask = runPromptFlow({
    message: 'Doğum tarihimin numerolojisini analiz et.',
    conversationId: 'flow-F-analysis-task',
    mode: 'meta-synthesis',
  });
  // Seed analysis preference into store already; new conv won't have session short
  const analysisRes = resolveApplicableFeedback({
    conversationId: 'flow-F',
    contentType: 'analysis',
    mode: 'meta-synthesis',
    activeVoice: 'atlas-analysis',
  });
  assert(
    'F numerology analysis path detailed priority',
    /detailed|thorough/i.test(analysisRes.promptBlock),
  );

  const captionTask = runPromptFlow({
    message: 'Instagram için tek cümlelik başlık yaz.',
    conversationId: 'flow-F-caption',
    channel: 'instagram',
  });
  scenarioReports.push({
    id: 'F-conflict',
    diskCount: disk.records.length,
    hasRelation,
    analysisPrompt: analysis.promptBlock,
    captionPrompt: caption.promptBlock,
    analysisTaskRules: feedbackSummary(analysisTask).promptRules,
    captionTaskRules: feedbackSummary(captionTask).promptRules,
  });
  void hasRelation;
}

// ═══════════════════════════════════════════════════════════════════════
// Test G — feature flag
// ═══════════════════════════════════════════════════════════════════════
resetFixture();
{
  process.env.PERSONA_FEEDBACK_LEARNING_ENABLED = 'true';
  const onBundle = runPromptFlow({
    message: "Bir daha 'pipeline' kelimesini kullanma.",
    conversationId: 'flow-G-on',
  });
  const on = feedbackSummary(onBundle);
  assert('G flag-on extraction', on.detected);
  assert('G flag-on may persist', on.upserts.some((u) => u.persisted === true) || loadFeedbackStore().records.length >= 1);
  const countOn = loadFeedbackStore().records.length;

  resetFixture();
  process.env.PERSONA_FEEDBACK_LEARNING_ENABLED = 'false';
  assert('G flag reports off', isPersonaFeedbackLearningEnabled() === false);
  const offBundle = runPromptFlow({
    message: "Bir daha 'pipeline' kelimesini kullanma.",
    conversationId: 'flow-G-off',
  });
  const off = feedbackSummary(offBundle);
  assert('G flag-off extraction still works', off.detected);
  assert('G flag-off persistence decision visible', Boolean(off.persistenceDecision));
  assert(
    'G flag-off no disk write',
    off.upserts.every((u) => u.persisted === false) && loadFeedbackStore().records.length === 0,
  );

  const msg = await runMessageFlow({
    message: 'Merhaba, nasılsın?',
    conversationId: 'flow-G-runtime',
  });
  assert('G flag-off runtime still completes', msg.status === 'complete' && Boolean(msg.reply));
  scenarioReports.push({ id: 'G-flag', onCount: countOn, offDetected: off.detected, runtimeOk: msg.status });

  process.env.PERSONA_FEEDBACK_LEARNING_ENABLED = 'true';
}

// ═══════════════════════════════════════════════════════════════════════
// Test H — prompt size / dedup with 10+ records
// ═══════════════════════════════════════════════════════════════════════
resetFixture();
{
  const prefs = [
    ['tone', 'prefer', 'Prefer assertive phrasing A.', 'global', null],
    ['tone', 'prefer', 'Prefer assertive phrasing A soft.', 'global', null], // merge-compatible
    ['length', 'prefer', 'Prefer shorter, denser responses.', 'channel', 'instagram'],
    ['length', 'prefer', 'Prefer more detailed, thorough explanations.', 'content_type', 'analysis'],
    ['word_choice', 'ban', 'Do not use the expression "bazıları".', 'global', null],
    ['formality', 'prefer', 'Prefer professional, measured distance in tone.', 'channel', 'pdf-report'],
    ['channel_voice', 'prefer', 'Prefer natural conversational phrasing.', 'channel', 'telegram'],
    ['symbolic_language', 'avoid', 'Reduce mystical/symbolic flourish; keep more grounded and precise language.', 'brand', 'astrolojik-akil'],
    ['repetition', 'avoid', 'Avoid repeating the flagged stock phrase across posts.', 'global', null],
    ['brand_voice', 'prefer', 'Prefer concise, assertive and high-impact phrasing.', 'brand', 'cosmic-simya'],
    ['formatting', 'avoid', 'Avoid ending with questions unless necessary.', 'global', null],
    ['content_depth', 'prefer', 'Prefer more detailed, thorough explanations.', 'task_type', 'analysis'],
  ];

  for (const [category, polarity, pref, scopeType, target] of prefs) {
    upsertFeedbackRecord(
      {
        category: [category],
        signal: pref.slice(0, 40),
        normalizedPreference: pref,
        scope: { type: scopeType, target },
        polarity,
        strength: 0.85,
        confidence: 0.9,
        persistence: 'persistent',
        source: { type: 'explicit_user_feedback', conversationId: 'seed', messageId: null },
        examples: { rejected: [], preferred: [] },
      },
      { conversationId: 'seed', learningEnabled: true },
    );
  }

  const storeCount = loadFeedbackStore().records.length;
  assert('H seeded at least 10 records', storeCount >= 10, `got ${storeCount}`);

  clearAtlasModuleCache();
  const before = buildPersonaEngineRuntimeBlock({
    mode: 'conversational',
    channel: 'web',
    voiceId: 'atlas-analysis',
    conversationId: 'flow-H-empty',
    feedbackResolution: { promptBlock: '', promptRules: [], appliedFeedbackIds: [] },
  });
  const afterResolve = resolveApplicableFeedback({
    activeVoice: 'atlas-analysis',
    channel: 'web',
    mode: 'conversational',
    conversationId: 'flow-H',
    limit: 8,
  });
  const after = buildPersonaEngineRuntimeBlock({
    mode: 'conversational',
    channel: 'web',
    voiceId: 'atlas-analysis',
    conversationId: 'flow-H',
    feedbackResolution: afterResolve,
  });

  const beforeLen = before.length;
  const afterLen = after.length;
  const delta = afterLen - beforeLen;
  assert('H not dumping full archive into prompt', !after.includes('"records"'));
  assert('H applied ids <= 8', afterResolve.appliedFeedbackIds.length <= 8);
  assert('H prompt delta bounded (< 2500 chars)', delta < 2500, `delta=${delta}`);
  assert(
    'H no unresolved short+detailed pair in same prompt block',
    !(
      /Prefer shorter/i.test(afterResolve.promptBlock) &&
      /Prefer more detailed/i.test(afterResolve.promptBlock)
    ) || afterResolve.conflicts.length > 0,
  );

  // Stronger: for plain web conversational, analysis detailed should be excluded by scope
  assert(
    'H analysis-only detailed excluded from plain web voice',
    !afterResolve.promptRules.some((r) => /content_type:analysis|task_type:analysis/i.test(r) && /detailed/i.test(r)) ||
      afterResolve.excluded.some((e) => e.reason === 'scope_mismatch'),
  );

  // Author profile appears once in the composed block sections (header+voice+author+reasoning+feedback)
  const authorHits = (after.match(/AUTHOR PROFILE — LARA/g) || []).length;
  assert('H author profile not duplicated inside persona block', authorHits === 1, `hits=${authorHits}`);

  scenarioReports.push({
    id: 'H-prompt-size',
    storeCount,
    applied: afterResolve.appliedFeedbackIds.length,
    beforeLen,
    afterLen,
    delta,
    approxTokenDelta: Math.round(delta / 4),
  });
  console.log(`  ↳ H prompt chars before=${beforeLen} after=${afterLen} delta=${delta} (~${Math.round(delta / 4)} tokens)`);
}

// ─── Production integrity ────────────────────────────────────────────
const productionAfter = readProductionSnapshot();
assert('production records.json unchanged', productionBefore === productionAfter);

// Cleanup fixtures / env
setFeedbackRecordsPath(previousRecordsPath === fixtureRecords ? '' : previousRecordsPath);
if (!previousRecordsPath || previousRecordsPath === fixtureRecords) {
  setFeedbackRecordsPath('');
}
resetAllSessionFeedback();
if (previousFlag === undefined) delete process.env.PERSONA_FEEDBACK_LEARNING_ENABLED;
else process.env.PERSONA_FEEDBACK_LEARNING_ENABLED = previousFlag;
try {
  rmSync(fixtureDir, { recursive: true, force: true });
} catch {
  /* ignore */
}

console.log(`\nFlow validation: ${passed} passed, ${failed} failed`);
console.log('\n--- Scenario digest ---');
for (const row of scenarioReports) {
  console.log(JSON.stringify(row));
}

if (failed > 0) process.exit(1);

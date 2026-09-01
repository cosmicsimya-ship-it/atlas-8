// ═══════════════════════════════════════════════════════════════════════
// Test: multi-turn conversation regression fixtures.
//
// This is the "real conversations become regression fixtures, not excuses
// for one-off knowledge patches" piece of the architecture work. Each
// fixture runs a FIXED sequence of turns through ONE conversationId
// (unlike every other scripts/test-*.mjs, which checks isolated single
// turns) using scripts/lib/conversation-fixture-runner.mjs.
//
// `religion-history-continuity-001` generalizes the real incident already
// on record in this repo (domain-detector.js's COMPARATIVE_RELIGION_RE
// comment, atlas_decision.md §2b, and test-religion-history-routing.mjs
// all cite the same two failing prompts) into checkpoints that test GENERAL
// capabilities — routing, guard coverage, continuity — with synthetic
// content, not a transcript of any real person's conversation. Per the
// architecture's knowledge-gap policy: this fixture is how a real failure
// becomes a permanent regression test WITHOUT becoming a permanent
// knowledge-patch file.
//
// Assertions stay on deterministic/structural properties (engine, intent,
// pipelineDebug fields) rather than live LLM prose content — this repo has
// no OPENAI_API_KEY in CI/dev by default (openai-client.js fails closed to
// a MODEL_UNAVAILABLE error in that case), and asserting on generated text
// would be flaky even with a key. See the architecture report's "remaining
// risks" for what this does and doesn't cover.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'assert';
import { runConversationFixtures } from './lib/conversation-fixture-runner.mjs';

const NON_SYMBOLIC_ENGINES = ['openai', 'knowledge-domain-web', 'quran-verse-lookup'];

const religionHistoryContinuity = {
  id: 'religion-history-continuity-001',
  checkpoints: [
    {
      label: 'checkpoint 0: prior symbolic-engine turn (contamination setup)',
      message: 'Rüyamda sürekli aynı ejderha figürünü görüyorum, tekrar ediyor.',
      assert: (result) => {
        assert.ok(result, 'expected a result object');
        assert.ok(typeof result.reply === 'string' && result.reply.length > 0);
      },
    },
    {
      label: 'checkpoint 1: theology/history question stays off the symbolic engine despite prior symbolic turn',
      message: 'İlk şeytan hangi dinde belirdi?',
      assert: (result) => {
        assert.ok(
          NON_SYMBOLIC_ENGINES.includes(result.engine),
          `expected a non-symbolic engine, got ${result.engine}`,
        );
        assert.notStrictEqual(result.intent, 'symbolic_pattern');
      },
    },
    {
      label: 'checkpoint 2: comparative-religion question also stays off the symbolic engine',
      message: 'Mara kavramı Hinduizm mi Budizm mi ile ilgili?',
      assert: (result) => {
        assert.ok(
          NON_SYMBOLIC_ENGINES.includes(result.engine),
          `expected a non-symbolic engine, got ${result.engine}`,
        );
        assert.notStrictEqual(result.intent, 'symbolic_pattern');
      },
    },
    {
      label: 'checkpoint 3: agreement-bias pressure (no religion/history keywords) still gets the agreement-bias guard',
      message: 'Bu tamamen doğru, değil mi? Sen de kesinlikle katılıyorsun değil mi?',
      assert: (result) => {
        const guards = result?.data?.pipelineDebug?.reasoningGuards;
        assert.ok(guards, 'expected pipelineDebug.reasoningGuards to be recorded on the general LLM path');
        assert.ok(
          guards.directiveCount >= 1,
          `expected at least one reasoning-guard directive, got ${guards.directiveCount}`,
        );
      },
    },
    {
      label: 'checkpoint 4: broad generalization claim (no domain keywords) fires the generalization guard independent of domain',
      message: 'Tüm insanlar hep aynı hataları yapar, değil mi?',
      assert: (result) => {
        const guards = result?.data?.pipelineDebug?.reasoningGuards;
        assert.ok(guards, 'expected pipelineDebug.reasoningGuards to be recorded on the general LLM path');
        assert.strictEqual(guards.domain, null, 'expected no knowledge-domain match for this generic sentence');
        assert.ok(
          guards.directiveCount >= 1,
          `expected the generalization/agreement guard to fire without a domain match, got ${guards.directiveCount}`,
        );
      },
    },
    {
      label: 'checkpoint 5: conversation survives an ambiguous follow-up after mixed-domain turns without crashing',
      message: 'Peki bu konuda farklı görüşler var mı?',
      assert: (result) => {
        assert.ok(result, 'expected a result object');
        assert.ok(typeof result.reply === 'string' && result.reply.length > 0);
      },
    },
  ],
};

await runConversationFixtures([religionHistoryContinuity]);

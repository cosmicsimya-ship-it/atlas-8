// ═══════════════════════════════════════════════════════════════════════
// Conversation-fixture runner — the one new piece of harness code the
// architecture audit found missing: every existing scripts/test-*.mjs file
// checks a single turn (optionally with injected prior history), not a
// running multi-turn conversation. This runs a fixed list of checkpoints
// through ONE conversationId/history sequentially, so a real multi-turn
// conversation can be captured as a single regression fixture instead of
// being split into one-off topic-specific patch files.
//
// Convention matches every other scripts/test-*.mjs: plain assert, a
// check()-style pass/fail counter, console.log/console.error, non-zero
// exit on failure. Fixtures call processAtlasMessage() directly — the same
// entry point web and Telegram both funnel through.
// ═══════════════════════════════════════════════════════════════════════

import { processAtlasMessage } from '../../server/atlas-message-service.js';
import { webUserId } from '../../server/user-memory.js';

/**
 * @typedef {{
 *   label: string,
 *   message: string,
 *   sender?: { userId?: string, displayName?: string },
 *   assert: (result: object, ctx: { history: Array<{role: string, content: string}>, checkpointIndex: number }) => void | Promise<void>,
 * }} ConversationCheckpoint
 */

/**
 * @param {{
 *   id: string,
 *   checkpoints: ConversationCheckpoint[],
 * }} fixture
 * @returns {Promise<{ id: string, passed: number, failed: number }>}
 */
export async function runConversationFixture(fixture) {
  const conversationId = `fixture-${fixture.id}`;
  const userId = webUserId(conversationId);
  /** @type {Array<{role: string, content: string}>} */
  const history = [];
  let passed = 0;
  let failed = 0;

  console.log(`[conversation-fixture:${fixture.id}] running ${fixture.checkpoints.length} checkpoint(s)`);

  for (let i = 0; i < fixture.checkpoints.length; i += 1) {
    const checkpoint = fixture.checkpoints[i];
    const sender = checkpoint.sender || {};
    let result;
    try {
      result = await processAtlasMessage(
        {
          channel: 'web',
          userId,
          conversationId,
          message: checkpoint.message,
          history: [...history],
          sender,
        },
        { trustedUserId: userId, mode: 'conversational' },
      );
    } catch (err) {
      failed += 1;
      console.error(`  FAIL - [${i}] ${checkpoint.label} (threw)`);
      console.error(`         ${err?.stack || err?.message || err}`);
      continue;
    }

    try {
      await checkpoint.assert(result, { history, checkpointIndex: i });
      passed += 1;
      console.log(`  ok   - [${i}] ${checkpoint.label}`);
    } catch (err) {
      failed += 1;
      console.error(`  FAIL - [${i}] ${checkpoint.label}`);
      console.error(`         ${err?.message || err}`);
    }

    history.push({ role: 'user', content: checkpoint.message });
    history.push({ role: 'assistant', content: String(result?.reply ?? '') });
  }

  return { id: fixture.id, passed, failed };
}

/**
 * Runs several fixtures and prints one combined summary, exiting the
 * process non-zero if any checkpoint in any fixture failed.
 * @param {Array<{ id: string, checkpoints: ConversationCheckpoint[] }>} fixtures
 */
export async function runConversationFixtures(fixtures) {
  let totalPassed = 0;
  let totalFailed = 0;
  for (const fixture of fixtures) {
    const { passed, failed } = await runConversationFixture(fixture);
    totalPassed += passed;
    totalFailed += failed;
  }
  console.log(
    totalFailed === 0
      ? `\n[conversation-fixtures] all ${totalPassed} checkpoint(s) passed.`
      : `\n[conversation-fixtures] ${totalFailed} checkpoint(s) failed, ${totalPassed} passed.`,
  );
  process.exit(totalFailed === 0 ? 0 : 1);
}

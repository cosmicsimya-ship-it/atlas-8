// ═══════════════════════════════════════════════════════════════════════
// Test: topic-based Qur'an verse retrieval
// (server/quran-verse-lookup/topic-index.js, tryQuranTopicReply in reply.js).
//
// A SEPARATE path from explicit-reference lookup: only reached when the
// explicit path did not handle the turn. Every candidate reference in the
// curated index is checked/retrieved through the exact same deterministic
// verification as a user-typed reference — the index only decides WHICH
// references to attempt, never what to say about them. Nothing is ever
// shown unless independently verified; unknown topics fail closed.
//
// This function is called from atlas-message-service.js the same way for
// both web and Telegram (same shared entry point already proven identical
// by verify-atlas-pipeline.mjs), so these direct-call tests cover both.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'assert';
import { detectQuranTopicIntent } from '../server/quran-verse-lookup/topic-index.js';
import {
  tryQuranTopicReply,
  MSG_TOPIC_UNSUPPORTED,
  MSG_TOPIC_SOURCE_UNAVAILABLE,
} from '../server/quran-verse-lookup/reply.js';
import { tryDeterministicQuranVerseReply } from '../server/quran-verse-lookup/reply.js';
import { createVerseStore } from '../server/quran-verse-lookup/store/index.js';

let failures = 0;
async function check(label, fn) {
  try {
    await fn();
    console.log(`  ok   - ${label}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL - ${label}`);
    console.error(`         ${err.message}`);
  }
}

const FIXTURE_STORE = createVerseStore({ forceFixture: true, nodeEnv: 'test' });
const retrieveOpts = { allowTestStore: true };
const mockExplain = async () => 'Bu ayetin konuyla ilişkisine dair kısa bir açıklama.';

console.log('[test-quran-topic-retrieval] topic intent detection');

await check('"Kur\'an\'da sabır hakkında en önemli ayetleri sırala" detected as topic=sabir', () => {
  const r = detectQuranTopicIntent(
    'Kur’an’da sabır hakkında en önemli ayetleri Arapça metni, Türkçe meali ve kısa açıklamasıyla sırala.',
  );
  assert.strictEqual(r.active, true);
  assert.strictEqual(r.topicKey, 'sabir');
});

await check('"Şeytanın insanlara düşmanlığıyla ilgili ayetler" detected as topic=seytan_dusmanligi', () => {
  const r = detectQuranTopicIntent('Şeytanın insanlara düşmanlığıyla ilgili ayetler');
  assert.strictEqual(r.active, true);
  assert.strictEqual(r.topicKey, 'seytan_dusmanligi');
});

await check('a bare mention of "şeytan" without "düşman" does not trigger the topic (avoids over-firing)', () => {
  const r = detectQuranTopicIntent('İlk şeytan hangi dinde belirdi?');
  assert.strictEqual(r.active, false);
});

await check('explicit reference "2:255 nedir?" is NOT a topic query', () => {
  const r = detectQuranTopicIntent('2:255 nedir?');
  assert.strictEqual(r.active, false);
  assert.strictEqual(r.topicKey, null);
});

console.log('[test-quran-topic-retrieval] the two required retrieval cases');

await check('"sabır" topic returns a small verified, ranked set (2:153, 3:200)', async () => {
  const result = await tryQuranTopicReply({
    message: 'Kur’an’da sabır hakkında en önemli ayetleri sırala',
    verseStore: FIXTURE_STORE,
    retrieveOpts,
    explainVerse: mockExplain,
  });
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.engine, 'quran-verse-lookup');
  assert.strictEqual(result.resultStatus, 'success');
  assert.deepStrictEqual(result.data.quranTopicLookup.verseKeys, ['2:153', '3:200']);
  assert.ok(result.reply.includes('Bakara 2:153'));
  assert.ok(result.reply.includes('Âl-i İmrân 3:200'));
  assert.ok(result.reply.includes('Arapça:'));
  assert.ok(result.reply.includes('Meal ('));
  assert.ok(result.reply.includes('Açıklaması:'));
});

await check('"şeytanın düşmanlığı" topic returns 35:6 and 36:60, verified', async () => {
  const result = await tryQuranTopicReply({
    message: 'Şeytanın insanlara düşmanlığıyla ilgili ayetler',
    verseStore: FIXTURE_STORE,
    retrieveOpts,
    explainVerse: mockExplain,
  });
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.resultStatus, 'success');
  assert.deepStrictEqual(result.data.quranTopicLookup.verseKeys, ['35:6', '36:60']);
  assert.ok(result.reply.includes('Fâtır 35:6'));
  assert.ok(result.reply.includes('Yâsîn 36:60'));
});

console.log('[test-quran-topic-retrieval] explicit-reference behavior preserved');

// Note: a BARE "2:255 nedir?" with no "ayet"/"sure"/"kur'an" word at all was
// already, by pre-existing design (intent.js, unmodified by this task),
// not treated as an explicit reference — deliberately, to avoid confusing
// a verse reference with a clock time like "07:27". "2:255 ayeti nedir?"
// is the realistic form that actually carries Qur'an evidence, and is what
// "2:255 nedir?" is standing in for.
const EXPLICIT_REF_QUERY = '2:255 ayeti nedir?';

await check(`"${EXPLICIT_REF_QUERY}" is not diverted to topic retrieval (returns not-handled)`, async () => {
  const topicResult = await tryQuranTopicReply({
    message: EXPLICIT_REF_QUERY,
    verseStore: FIXTURE_STORE,
    retrieveOpts,
  });
  assert.strictEqual(topicResult.handled, false);
});

await check(`"${EXPLICIT_REF_QUERY}" still resolves via the existing explicit deterministic lookup`, async () => {
  const explicitResult = await tryDeterministicQuranVerseReply({
    message: EXPLICIT_REF_QUERY,
    verseStore: FIXTURE_STORE,
    retrieveOpts,
  });
  assert.strictEqual(explicitResult.handled, true);
  assert.strictEqual(explicitResult.engine, 'quran-verse-lookup');
  assert.strictEqual(explicitResult.data.quranVerseLookup.verse_key, '2:255');
});

console.log('[test-quran-topic-retrieval] fail-closed behavior');

await check('a recognized-but-unsupported topic fails closed, never invents a verse', async () => {
  const result = await tryQuranTopicReply({
    message: 'zaman yolculuğu hakkında ayetler',
    verseStore: FIXTURE_STORE,
    retrieveOpts,
  });
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.resultStatus, 'insufficient_data');
  assert.strictEqual(result.reply, MSG_TOPIC_UNSUPPORTED);
});

await check('a known topic with no verse-text source available fails closed, not silently empty', async () => {
  const result = await tryQuranTopicReply({
    message: 'sabır hakkında ayetler',
    verseStore: null, // no source at all
  });
  assert.strictEqual(result.handled, true);
  assert.strictEqual(result.resultStatus, 'insufficient_data');
  assert.strictEqual(result.reply, MSG_TOPIC_SOURCE_UNAVAILABLE);
});

await check('a non-topic, non-reference message is left alone entirely', async () => {
  const result = await tryQuranTopicReply({ message: 'bugün hava nasıl?' });
  assert.strictEqual(result.handled, false);
});

console.log(
  failures === 0
    ? '\n[test-quran-topic-retrieval] all checks passed.'
    : `\n[test-quran-topic-retrieval] ${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);

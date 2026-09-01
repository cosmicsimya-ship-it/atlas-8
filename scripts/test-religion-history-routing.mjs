// ═══════════════════════════════════════════════════════════════════════
// Test: Atlas Core answer-quality / routing audit regressions.
//
// Covers the exact failure prompts from the religion-routing audit:
//  - a factual/historical/comparative-religion question must not be
//    misrouted into the symbolic-interpretation engine/intent
//  - a Qur'an verse-citation request without a resolvable reference must
//    stay fail-closed (no invented surah:ayah number)
//  - every LLM path — not just symbolic/numerology/dream/explicit-Qur'an
//    paths — must receive a scripture-citation directive, so a plain
//    conversational answer about religion/history can never fabricate a
//    verse citation with zero guardrail present
//
// Runs against the same processAtlasMessage() entry point both web and
// Telegram funnel through (Telegram calls this via /api/atlas/message on
// the shared backend), so a pass here covers both channels.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'assert';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { webUserId } from '../server/user-memory.js';
import {
  detectQuranVerseLookupIntent,
  isQuranContextActive,
  selectScriptureCitationDirective,
  buildNoSpontaneousQuranDirective,
  buildQuranFailClosedDirective,
  buildGeneralScriptureCitationGuard,
} from '../server/quran-verse-lookup/index.js';

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

const HISTORICAL_RELIGION_Q = 'İlk şeytan hangi dinde belirdi?';
const COMPARATIVE_RELIGION_Q = 'Mara kavramı Hinduizm mi Budizm mi ile ilgili?';
const UNRESOLVABLE_QURAN_CITATION_Q =
  'Şeytanın insanlara düşman olduğunu söyleyen ayet hangisi?';

// Prior symbolic-engine history — the routing must not change even when the
// conversation was just discussing tarot/dream/symbol content.
const priorSymbolicHistory = [
  { role: 'user', content: 'rüyamda sürekli yılan görüyorum, ne anlama geliyor?' },
  { role: 'assistant', content: 'Yılan sembolü dönüşüm ve gizli korkularla ilişkilendirilir...' },
  { role: 'user', content: 'peki bu sembol tekrar ederse?' },
  { role: 'assistant', content: 'Tekrar eden semboller genelde bir temayı gösterir...' },
];

let userCounter = 0;
function freshCall(message, history = []) {
  userCounter += 1;
  const uid = webUserId(`religion-routing-test-${userCounter}`);
  return processAtlasMessage(
    { channel: 'web', userId: uid, conversationId: `religion-routing-test-${userCounter}`, message, history },
    { trustedUserId: uid, mode: 'conversational' },
  );
}

console.log('[test-religion-history-routing] intent-detection unit checks');

await check('historical religion question has no Qur\'an-domain evidence', () => {
  const intent = detectQuranVerseLookupIntent(HISTORICAL_RELIGION_Q);
  assert.strictEqual(intent.active, false);
});

await check('explicit "ayet" citation request activates Qur\'an lookup', () => {
  const intent = detectQuranVerseLookupIntent(UNRESOLVABLE_QURAN_CITATION_Q);
  assert.strictEqual(intent.active, true);
});

await check('isQuranContextActive is false for the historical question with no semantic layers', () => {
  assert.strictEqual(
    isQuranContextActive(HISTORICAL_RELIGION_Q, { layers: [] }),
    false,
  );
});

console.log('[test-religion-history-routing] scripture-citation directive selection');

await check('no verified payload + no narrower guard → general citation guard (topic still allowed)', () => {
  const directive = selectScriptureCitationDirective({
    needsQuranContentGuard: false,
    quranContextActive: false,
  });
  assert.strictEqual(directive, buildGeneralScriptureCitationGuard());
  assert.ok(directive.includes('SCRIPTURE CITATION GUARD'));
  // Must forbid fabricated numbers/quotes, but must NOT forbid the topic itself
  // the way buildNoSpontaneousQuranDirective() does — a comparative-religion
  // or history answer is allowed to say "the Qur'an" / "Islam" as a topic.
  assert.ok(!directive.includes('Kur’an, sûre, âyet, meal veya tefsirden bahsetmek'));
});

await check('numerology/dream/synthesis paths still get the spontaneous-mention guard', () => {
  const directive = selectScriptureCitationDirective({
    needsQuranContentGuard: true,
    quranContextActive: false,
  });
  assert.strictEqual(directive, buildNoSpontaneousQuranDirective());
});

await check('explicit Qur\'an context still gets the fail-closed-with-payload guard', () => {
  const directive = selectScriptureCitationDirective({
    needsQuranContentGuard: false,
    quranContextActive: true,
  });
  assert.strictEqual(directive, buildQuranFailClosedDirective());
});

console.log('[test-religion-history-routing] full-pipeline routing checks');

// Since the knowledge-domain web-retrieval wiring, this exact question
// ("İlk şeytan hangi dinde belirdi?") matches the comparative_religion
// domain grammar ("hangi dinde") and correctly routes to sourced web
// retrieval (engine 'knowledge-domain-web') instead of the ungrounded
// general LLM path — a strictly better outcome for a comparative-religion
// question, not a regression. The property that actually matters, and
// that must never change, is asserted below: never the symbolic engine.
const NON_SYMBOLIC_ENGINES = ['openai', 'knowledge-domain-web'];

await check('historical religion question never lands on the symbolic engine (fresh conversation)', async () => {
  const result = await freshCall(HISTORICAL_RELIGION_Q);
  assert.ok(
    NON_SYMBOLIC_ENGINES.includes(result.engine),
    `expected a non-symbolic engine, got ${result.engine}`,
  );
  assert.notStrictEqual(result.intent, 'symbolic_pattern');
});

await check('historical religion question stays off symbolic engine even after prior symbolic-topic history', async () => {
  const result = await freshCall(HISTORICAL_RELIGION_Q, priorSymbolicHistory);
  assert.ok(
    NON_SYMBOLIC_ENGINES.includes(result.engine),
    `expected a non-symbolic engine, got ${result.engine}`,
  );
  assert.notStrictEqual(result.intent, 'symbolic_pattern');
});

await check('comparative-religion question routes to general LLM path, not symbolic engine', async () => {
  const result = await freshCall(COMPARATIVE_RELIGION_Q);
  assert.strictEqual(result.engine, 'openai');
  assert.notStrictEqual(result.intent, 'symbolic_pattern');
});

await check('unresolvable Qur\'an citation request stays fail-closed (no invented verse)', async () => {
  const result = await freshCall(UNRESOLVABLE_QURAN_CITATION_Q);
  assert.strictEqual(result.engine, 'quran-verse-lookup');
  const reply = String(result.reply || '');
  // Must not contain a confident surah:ayah-style citation pattern.
  assert.ok(!/\b\d{1,3}\s*:\s*\d{1,3}\b/.test(reply) || /örnek/i.test(reply));
  assert.ok(/çıkaramad|tahmin ederek|doğrulaya/i.test(reply));
});

console.log(
  failures === 0
    ? '\n[test-religion-history-routing] all checks passed.'
    : `\n[test-religion-history-routing] ${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);

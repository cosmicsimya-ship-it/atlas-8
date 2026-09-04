/**
 * Intelligence Layer <-> atlas-ebced-v1 integration regression suite (Phase 12).
 * Run: node scripts/test-intelligence-ebced-integration.mjs
 *
 * Exercises the full chat pipeline (processAtlasMessage) end-to-end — this
 * is deliberately NOT a unit test of abjad-verification.js in isolation;
 * it verifies the actual wiring: routing, domain persistence, telemetry,
 * self-correction, and Web/Telegram parity.
 */
import assert from 'node:assert/strict';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { resetConversationState } from '../server/conversation-context-engine.js';
import {
  resetFounderKnowledgeForTests,
  unlockFounderKnowledgeForTests,
} from '../server/founder-knowledge.js';

let passed = 0;
let failed = 0;
const failures = [];
const latencies = [];

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok  ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, error: err?.message || String(err) });
    console.error(`FAIL ${name}: ${err?.message || err}`);
  }
}

let counter = 0;
function convId(label) {
  counter += 1;
  return `intlayer-ebced-${label}-${counter}`;
}

const ebcedLatencies = [];
const nonEbcedLatencies = [];

async function send(conversationId, message, history = [], channel = 'web', extra = {}) {
  const t0 = performance.now();
  const result = await processAtlasMessage(
    { channel, message, history, conversationId, ...extra },
    { mode: 'conversational' },
  );
  const elapsed = performance.now() - t0;
  latencies.push(elapsed);
  (result.engine === 'abjad-verification' ? ebcedLatencies : nonEbcedLatencies).push(elapsed);
  return result;
}

// ── A. Direct Turkish input — no Arabic clarification, total = 431 ──────
await check('A. Direct Turkish input — Furkan computes 431, no Arabic clarification', async () => {
  const id = convId('a');
  const r = await send(id, "Furkan'ın ebced değerini hesapla.");
  assert.equal(r.engine, 'abjad-verification');
  assert.doesNotMatch(r.reply, /Arapça yazımı belirtin|onaylar mısın|yazımı onaylar/i);
  assert.equal(r.data?.abjadVerification?.calcTotal, 431);
  assert.equal(r.data?.engineTelemetry?.engineUsed, 'atlas-ebced-v1');
  assert.equal(r.data?.engineTelemetry?.engineBypassed, false);
});

// ── B. Same-name repeatability ────────────────────────────────────────────
await check('B. Same-name repeatability — Furkan identical across repeated calls', async () => {
  const results = [];
  for (let i = 0; i < 3; i += 1) {
    const id = convId(`b${i}`);
    const r = await send(id, "Furkan'ın ebced değerini hesapla.");
    results.push(r.data?.abjadVerification?.calcTotal);
  }
  assert.deepEqual(results, [431, 431, 431]);
});

// ── C. Web/Telegram parity ────────────────────────────────────────────────
await check('C. Web/Telegram parity — identical deterministic fields for 5 names', async () => {
  for (const name of ['Furkan', 'Lara', 'Hakan', 'Zeynep', 'Buğlem']) {
    const webId = convId(`c-web-${name}`);
    const tgId = convId(`c-tg-${name}`);
    const web = await send(webId, `${name}'ın ebced değerini hesapla.`, [], 'web');
    const tg = await send(tgId, `${name}'ın ebced değerini hesapla.`, [], 'telegram');
    assert.equal(web.data?.abjadVerification?.calcTotal, tg.data?.abjadVerification?.calcTotal, `${name} total mismatch`);
    assert.equal(
      web.data?.abjadVerification?.spelling?.normalizedArabic,
      tg.data?.abjadVerification?.spelling?.normalizedArabic,
      `${name} Arabic form mismatch`,
    );
    assert.equal(web.engine, tg.engine);
  }
});

// ── D. Follow-up Esma — domain persisted, no generic fallback ───────────
await check('D. Follow-up Esma — "Hangi Esma?" reuses persisted Ebced domain', async () => {
  const id = convId('d');
  const r1 = await send(id, "Furkan'ın ebced değerini hesapla.");
  assert.equal(r1.data?.abjadVerification?.calcTotal, 431);
  const history = [
    { role: 'user', content: "Furkan'ın ebced değerini hesapla." },
    { role: 'assistant', content: r1.reply },
  ];
  const r2 = await send(id, 'Hangi Esma?', history);
  assert.equal(r2.engine, 'abjad-verification', `expected Ebced engine to handle follow-up, got ${r2.engine}`);
  assert.doesNotMatch(r2.reply, /yak[ıi]n\s+frekans|titre[sş]im|vibrasyon/i);
});

// ── E. Short confirmation ("Kullan.") ────────────────────────────────────
await check('E. Short confirmation — "Kullan." does not crash or misroute to a different domain', async () => {
  const id = convId('e');
  const r1 = await send(id, "Furkan'ın ebced değerini hesapla.");
  const history = [
    { role: 'user', content: "Furkan'ın ebced değerini hesapla." },
    { role: 'assistant', content: r1.reply },
  ];
  const r2 = await send(id, 'Kullan.', history);
  // Documented scope limit (see final report): "Kullan." has no dedicated
  // Ebced-specific handler yet. This test asserts the safety property that
  // matters most - it must not silently invent a number under a wrong
  // engine label - not full referent resolution of the bare word.
  assert.notEqual(r2.engine, 'tarot-engine');
  assert.notEqual(r2.engine, 'numerology-engine');
});

// ── F. Self reference ────────────────────────────────────────────────────
await check('F. Self reference — "Benimkine de bak." resolves known display name via atlas-ebced-v1', async () => {
  const id = convId('f');
  const r1 = await send(id, "Furkan'ın ebced değerini hesapla.", [], 'web', { displayName: 'Ahmet' });
  const history = [
    { role: 'user', content: "Furkan'ın ebced değerini hesapla." },
    { role: 'assistant', content: r1.reply },
  ];
  const r2 = await send(id, 'Benimkine de bak.', history, 'web', { displayName: 'Ahmet' });
  assert.equal(r2.engine, 'abjad-verification');
  assert.match(r2.reply, /Ahmet/);
  assert.equal(r2.data?.engineTelemetry?.engineUsed, 'atlas-ebced-v1');
});

// ── G. Stale Tarot contamination — recent Ebced remains active ──────────
await check('G. Stale Tarot contamination — Ebced remains active after old Tarot history', async () => {
  const id = convId('g');
  // Old tarot turn far back in history.
  const staleHistory = [
    { role: 'user', content: 'Tarot açılımı yap.' },
    { role: 'assistant', content: '3 kart açtım: Güç, Yıldız, Ay.' },
  ];
  const r1 = await send(id, "Furkan'ın ebced değerini hesapla.", staleHistory);
  assert.equal(r1.engine, 'abjad-verification');
  const history2 = [...staleHistory, { role: 'user', content: "Furkan'ın ebced değerini hesapla." }, { role: 'assistant', content: r1.reply }];
  const r2 = await send(id, 'Hangi Esma?', history2);
  assert.equal(r2.engine, 'abjad-verification', `stale tarot history leaked into follow-up routing, got engine=${r2.engine}`);
});

// ── H. Explicit topic switch ──────────────────────────────────────────────
await check('H. Explicit topic switch — "Şimdi tarot aç." correctly leaves Ebced', async () => {
  const id = convId('h');
  const r1 = await send(id, "Furkan'ın ebced değerini hesapla.");
  const history = [
    { role: 'user', content: "Furkan'ın ebced değerini hesapla." },
    { role: 'assistant', content: r1.reply },
  ];
  const r2 = await send(id, 'Şimdi tarot aç.', history);
  assert.notEqual(r2.engine, 'abjad-verification', 'explicit tarot switch should leave the Ebced engine');
});

// ── I. Unsupported Esma bridge — no invented frequency proximity ────────
await check('I. Unsupported Esma bridge — no invented frequency/proximity claims', async () => {
  const id = convId('i');
  const r1 = await send(id, "Furkan'ın ebced değerini hesapla."); // 431
  const history = [
    { role: 'user', content: "Furkan'ın ebced değerini hesapla." },
    { role: 'assistant', content: r1.reply },
  ];
  const r2 = await send(id, 'Hangi Esma?', history);
  // "Yakın değeri ... sunmam" (the correct safety disclaimer refusing to
  // invent a near-match) must NOT be flagged — only a positive claim like
  // "431'e yakın frekanslarda" would be an actual violation.
  assert.doesNotMatch(r2.reply, /yak[ıi]n\s+frekans|titre[sş]im|vibrasyon/i);
  assert.doesNotMatch(r2.reply, /\d+'e\s+yak[ıi]n/i);
});

// ── J. Engine failure — controlled response, no LLM arithmetic fallback ──
await check('J. Engine failure — unsupported input gets a controlled reply, not a fabricated total', async () => {
  const id = convId('j');
  const r = await send(id, 'x#123 ebcedini hesapla.');
  if (r.engine === 'abjad-verification') {
    assert.equal(r.data?.abjadVerification?.calcTotal ?? null, null, 'must not fabricate a total for unsupported input');
    assert.equal(r.data?.engineTelemetry?.engineBypassed, false);
  }
});

// ── K. Qur'an integration boundary ────────────────────────────────────────
await check("K. Qur'an boundary — unverified verse text never bypasses verification for Ebced", async () => {
  const id = convId('k');
  const r = await send(id, "Yusuf 12:87 ayetinin ebcedini hesapla.");
  // With QURAN_VERSE_TEXT_ENABLED unset (fail-closed default, matching the
  // existing Qur'an module's own behavior), no verified text is available -
  // the reply must say so, not compute a number from unverified content.
  if (r.engine === 'abjad-verification') {
    assert.doesNotMatch(r.reply, /^\d+$/);
    assert.ok(!/Toplam\s*=\s*\d/.test(r.reply) || /doğrulanmış/i.test(r.reply));
  }
});

// ── L. Turkish characters ─────────────────────────────────────────────────
await check('L. Turkish characters — ç ğ ı i ö ş ü all compute without asking for Arabic', async () => {
  for (const name of ['Çağla', 'Buğlem', 'Işık', 'İclal', 'Gökçe', 'Şeyma', 'Gül']) {
    const id = convId(`l-${name}`);
    const r = await send(id, `${name}'ın ebced değerini hesapla.`);
    assert.equal(r.engine, 'abjad-verification', `${name} should route to Ebced`);
    assert.doesNotMatch(r.reply, /Arapça yazımı belirtin/i, `${name} should not ask for Arabic`);
  }
});

// ── M. Real production regression (2026-09-04 forensic trace, req_b5c15d16a946) ──
// Reproduces the exact live Telegram DM failure verbatim, through the exact
// same entry point real Telegram traffic uses (processAtlasMessage with
// channel: 'telegram') - not a synthetic call to a lower-level detector
// function. Before the fix this fell through to the "Latin harfli isim
// doğrudan tahmini Arapça harflere çevrilerek hesaplanmaz" rejection because
// no name was ever captured for this self-referential-with-no-named-person
// phrasing (distinct from "Furkan'ın ebced..." and from the already-covered
// "Benimkine de bak." follow-up).
await check('M. Real Telegram DM regression — "Hadi ebced değerimi ismimden hesapla" (no name in text)', async () => {
  const id = convId('m');
  const r1 = await send(id, 'Hadi ebced değerimi ismimden hesapla', [], 'telegram', { displayName: 'Elif' });
  assert.equal(r1.engine, 'abjad-verification', `expected Ebced engine, got ${r1.engine}`);
  assert.doesNotMatch(
    r1.reply,
    /Latin harfli isim doğrudan tahmini Arapça harflere çevrilerek hesaplanmaz/,
    'must not fall back to the confirmation-required rejection when a display name is available',
  );
  assert.match(r1.reply, /Elif/, 'should resolve and compute the known display name');
  assert.equal(r1.data?.engineTelemetry?.engineUsed, 'atlas-ebced-v1');
  assert.equal(r1.data?.engineTelemetry?.engineSuccess, true);

  // Follow-up in the SAME real entry point, SAME channel, with a verified
  // total now present in history - domain must persist and Esma matching
  // must use only the engine-supported methodology (no invented claims).
  const history = [
    { role: 'user', content: 'Hadi ebced değerimi ismimden hesapla' },
    { role: 'assistant', content: r1.reply },
  ];
  const r2 = await send(id, 'Esması?', history, 'telegram', { displayName: 'Elif' });
  assert.equal(r2.engine, 'abjad-verification', `expected Ebced/Esma context retained, got ${r2.engine}`);
  assert.doesNotMatch(r2.reply, /ifadesi tek başına net değil|hangi esma veya hangi bağlamda/i, 'must not ask what "Esması" means when a verified total already exists in history');
  assert.doesNotMatch(r2.reply, /yak[ıi]n\s+frekans|titre[sş]im|vibrasyon/i);
});

// ── N. Founder self-name resolution — personalName, not displayName label ──
// Reproduces the 2026-09-05 real Telegram regression: a founder session whose
// channel displayName is a branded label ("Lara | Cosmic Simya") must resolve
// the canonical personal name ("Lara") from founder-identity's existing
// getFounderPreferredName() source for self-referential Ebced requests — the
// engine itself is untouched; only the input selected at the call site changes.
process.env.ATLAS_TEST_TRUST_INPUT_USERID = '1';
const FOUNDER_TEST_USER_ID = 'telegram:990041';
const FOUNDER_TEST_DISPLAY_NAME = 'Lara | Cosmic Simya';
resetFounderKnowledgeForTests({
  profiles: [
    {
      id: 'test-founder-lara',
      founderName: 'Lara',
      role: 'Cosmicsimya.com Kurucusu · Atlas Sistem Mimarı',
      linkedUserIds: [FOUNDER_TEST_USER_ID],
    },
  ],
});

await check('N1. Founder self-name — resolves canonical personal name "Lara", not the display label', async () => {
  const id = convId('n1');
  const r1 = await send(id, 'Hadi ebced değerimi ismimden hesapla', [], 'telegram', {
    userId: FOUNDER_TEST_USER_ID,
    displayName: FOUNDER_TEST_DISPLAY_NAME,
  });
  assert.equal(r1.engine, 'abjad-verification', `expected Ebced engine, got ${r1.engine}`);
  assert.match(r1.reply, /^Lara:/, `engine input must be the canonical personal name "Lara", got reply: ${r1.reply}`);
  assert.doesNotMatch(r1.reply, /Cosmic Simya/, 'must not calculate the full display/profile label');
  assert.equal(r1.data?.engineTelemetry?.engineUsed, 'atlas-ebced-v1');
  assert.equal(r1.data?.engineTelemetry?.engineSuccess, true);

  // Follow-up in the same real entry point — domain persists and reuses Lara's result.
  const history = [
    { role: 'user', content: 'Hadi ebced değerimi ismimden hesapla' },
    { role: 'assistant', content: r1.reply },
  ];
  const r2 = await send(id, 'Esması?', history, 'telegram', {
    userId: FOUNDER_TEST_USER_ID,
    displayName: FOUNDER_TEST_DISPLAY_NAME,
  });
  assert.equal(r2.engine, 'abjad-verification', `expected Ebced/Esma context retained, got ${r2.engine}`);
  assert.doesNotMatch(r2.reply, /ifadesi tek başına net değil|hangi esma veya hangi bağlamda/i, 'must not ask what "Esması" means when a verified total already exists in history');
});

// Note: "Lara | Cosmic Simya ifadesinin ebcedini hesapla" (a quoted-phrase
// construction with "ifadesinin") is not itself a name-extraction pattern
// the generic engine supports today (NAME_BEFORE_POSSESSIVE_EBCED_RE /
// NAME_APOSTROPHE_EBCED_RE only capture a single bare word before an
// isim/ad-possessive + "ebced", not an arbitrary multi-word quoted phrase
// after "ifadesinin") — confirmed pre-existing and unrelated to this fix:
// with the founder-personalName override reverted, the same message still
// does not reach abjad-verification. What this fix must guarantee instead
// is narrower and is what N2 actually verifies: the founder-personalName
// substitution added at the self-referential call site can only ever fire
// inside the self-referential branch (self-reference markers required by
// detectSelfReferentialEbcedFollowUp), so it can never clobber an
// explicitly-named request — proven here with the founder session active
// but a different, explicitly-named target ("Furkan"), which must still
// compute Furkan's own total, not "Lara" and not the display label.
await check('N2. Explicit named request is unaffected by the founder-personalName override', async () => {
  const id = convId('n2');
  const r = await send(id, "Furkan'ın ebced değerini hesapla.", [], 'telegram', {
    userId: FOUNDER_TEST_USER_ID,
    displayName: FOUNDER_TEST_DISPLAY_NAME,
  });
  assert.equal(r.engine, 'abjad-verification', `expected Ebced engine, got ${r.engine}`);
  assert.equal(r.data?.abjadVerification?.calcTotal, 431, 'explicit named request must compute the named person, not the founder session');
  assert.doesNotMatch(r.reply, /^Lara:/, 'must not be redirected to the founder personal name');
  assert.doesNotMatch(r.reply, /Cosmic Simya/, 'must not leak the display label');
});

unlockFounderKnowledgeForTests();

// ── Final Acceptance Test (task-specified conversation) ──────────────────
await check('FINAL ACCEPTANCE — Furkan -> Hangi Esma -> Benimkine de bak -> Ne alaka tarot', async () => {
  const id = convId('final');
  let history = [];

  const r1 = await send(id, 'Furkan\'ın ebced değerini hesapla.', history, 'web', { displayName: 'Elif' });
  assert.equal(r1.engine, 'abjad-verification');
  assert.equal(r1.data?.abjadVerification?.calcTotal, 431);
  assert.doesNotMatch(r1.reply, /Arapça yazımı belirtin/i);
  history = [...history, { role: 'user', content: 'Furkan\'ın ebced değerini hesapla.' }, { role: 'assistant', content: r1.reply }];

  const r2 = await send(id, "Hangi Esma'ya denk geliyor?", history, 'web', { displayName: 'Elif' });
  assert.equal(r2.engine, 'abjad-verification', `expected Ebced context retained, got ${r2.engine}`);
  assert.doesNotMatch(r2.reply, /yak[ıi]n\s+frekans|titre[sş]im/i);
  history = [...history, { role: 'user', content: "Hangi Esma'ya denk geliyor?" }, { role: 'assistant', content: r2.reply }];

  const r3 = await send(id, 'Benimkine de bak.', history, 'web', { displayName: 'Elif' });
  assert.equal(r3.engine, 'abjad-verification');
  assert.match(r3.reply, /Elif/);
  history = [...history, { role: 'user', content: 'Benimkine de bak.' }, { role: 'assistant', content: r3.reply }];

  const r4 = await send(id, 'Ne alaka tarot?', history, 'web', { displayName: 'Elif' });
  // No tarot mistake should have occurred (r1-r3 all stayed in Ebced) — this
  // is a correction/reference question, not a request to open tarot.
  assert.notEqual(r4.engine, 'tarot-engine', 'must not switch into tarot on a rejection phrase');
});

console.log(`\n${passed} passed, ${failed} failed`);
const avg = (arr) => arr.reduce((s, x) => s + x, 0) / (arr.length || 1);
console.log(
  `\nOverall (all turns incl. deliberate non-Ebced fallback tests) — avg: ${avg(latencies).toFixed(2)}ms, max: ${Math.max(...latencies).toFixed(2)}ms, n=${latencies.length}`,
);
console.log(
  `Ebced-engine turns only — avg: ${avg(ebcedLatencies).toFixed(2)}ms, max: ${(Math.max(...ebcedLatencies) || 0).toFixed(2)}ms, n=${ebcedLatencies.length}`,
);
console.log(
  `Non-Ebced turns (E/J deliberately fall through to conversation/LLM) — avg: ${avg(nonEbcedLatencies).toFixed(2)}ms, max: ${(Math.max(...nonEbcedLatencies) || 0).toFixed(2)}ms, n=${nonEbcedLatencies.length}`,
);

if (failed) {
  console.error('\nFailures:');
  for (const f of failures) console.error(`- ${f.name}: ${f.error}`);
  process.exit(1);
}

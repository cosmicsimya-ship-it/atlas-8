/**
 * Abjad + Esma verification regression matrix (delivery criteria).
 * Run: node scripts/test-abjad-esma-verification.mjs
 */
import assert from 'node:assert/strict';
import {
  calculateAbjad,
  findEsmaMatches,
  resolveArabicSpelling,
  verifyEsmaValueClaim,
  ESMA_MATCH_TYPES,
  ESMA_ABJAD_CATALOG,
  lookupEsmaAbjadEntry,
  lookupNameSpelling,
  classifyArabicNameVariant,
  ABJAD_KABIR_CLASSICAL_V1,
} from '../server/symbolic-analysis/index.js';
import {
  runAbjadEsmaVerification,
  tryDeterministicAbjadReply,
  detectAbjadEsmaIntent,
  extractEsmaValueClaim,
} from '../server/abjad-verification.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { buildAtlasSystemPrompt } from '../server/atlas-prompt-loader.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok  ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, error: err?.message || String(err) });
    console.error(`FAIL ${name}: ${err?.message || err}`);
  }
}

async function checkAsync(name, fn) {
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

// ── 1. Hüseyin → حسين → 128 ──────────────────────────────────────────
check('1 Hüseyin gazetteer → حسين = 128', () => {
  const entry = lookupNameSpelling('Hüseyin');
  assert.equal(entry.standardArabic, 'حسين');
  const spelling = resolveArabicSpelling({
    originalInput: 'Hüseyin',
    arabicText: 'حسين',
    spellingConfirmed: true,
  });
  assert.equal(spelling.normalizedArabic, 'حسين');
  assert.equal(spelling.spellingConfirmed, true);
  const calc = calculateAbjad('حسين', ABJAD_KABIR_CLASSICAL_V1);
  assert.equal(calc.ok, true);
  assert.deepEqual(calc.letters, [
    { letter: 'ح', value: 8 },
    { letter: 'س', value: 60 },
    { letter: 'ي', value: 10 },
    { letter: 'ن', value: 50 },
  ]);
  assert.equal(calc.total, 128);
  assert.equal(calc.methodologyId, 'abjad-kabir-classical-v1');
});

// ── 2. حوسين rejected as standard ────────────────────────────────────
check('2 حوسين not accepted as standard Hüseyin', () => {
  const classified = classifyArabicNameVariant('حوسين');
  assert.equal(classified?.kind, 'rejected');
  assert.equal(classified.entry.standardArabic, 'حسين');
  const spelling = resolveArabicSpelling({ arabicText: 'حوسين', originalInput: 'حوسين' });
  assert.equal(spelling.status, 'rejected_variant');
  assert.equal(spelling.spellingConfirmed, false);
  const result = runAbjadEsmaVerification({ message: 'حوسين' });
  assert.match(result.reply, /standart yazım|standart yazımı değildir/i);
  assert.equal(result.usedAsStandard, false);
  assert.match(result.reply, /حسين/);
});

// ── 3–6. Esma bare/definite values ───────────────────────────────────
check('3 لطيف = 129', () => {
  const calc = calculateAbjad('لطيف');
  assert.equal(calc.total, 129);
  assert.deepEqual(calc.letters, [
    { letter: 'ل', value: 30 },
    { letter: 'ط', value: 9 },
    { letter: 'ي', value: 10 },
    { letter: 'ف', value: 80 },
  ]);
  assert.equal(lookupEsmaAbjadEntry('latif').bareValue, 129);
});

check('4 اللطيف = 160', () => {
  assert.equal(calculateAbjad('اللطيف').total, 160);
  assert.equal(lookupEsmaAbjadEntry('latif').definiteValue, 160);
});

check('5 ملك = 90', () => {
  assert.equal(calculateAbjad('ملك').total, 90);
  assert.equal(lookupEsmaAbjadEntry('melik').bareValue, 90);
});

check('6 الملك = 121', () => {
  assert.equal(calculateAbjad('الملك').total, 121);
  assert.equal(lookupEsmaAbjadEntry('melik').definiteValue, 121);
});

// ── 7. User claim Latif 128 → recalc 129 ─────────────────────────────
check('7 user claim Latif 128 → system says 129', () => {
  const claim = extractEsmaValueClaim("Latif 128'dir");
  assert.equal(claim.nameQuery, 'latif');
  assert.equal(claim.claimedValue, 128);
  const verified = verifyEsmaValueClaim({ nameQuery: 'latif', claimedValue: 128 });
  assert.equal(verified.claimAccepted, false);
  assert.equal(verified.entry.bareValue, 129);

  const result = runAbjadEsmaVerification({ message: "Latif 128'dir" });
  assert.equal(result.claimAccepted, false);
  assert.match(result.reply, /129/);
  assert.match(result.reply, /30/);
  assert.doesNotMatch(result.reply, /Evet.*128/i);
  assert.equal(result.calc.bare.total, 129);
});

// ── 8. El-Melik 110 → recalc with article distinction ────────────────
check('8 El-Melik 110 → recalculate bare/definite', () => {
  const result = runAbjadEsmaVerification({ message: "El-Melik 110'dur" });
  assert.equal(result.claimAccepted, false);
  assert.match(result.reply, /90|121/);
  assert.match(result.reply, /ملك|الملك/);
  assert.equal(result.calc.bare.total, 90);
  assert.equal(result.calc.definite.total, 121);
});

// ── 9. Target 128 — no exact Esma invent ──────────────────────────────
check('9 target 128 no exact match — do not invent', () => {
  const matches = findEsmaMatches({
    value: 128,
    matchType: ESMA_MATCH_TYPES.EXACT,
    methodologyId: ABJAD_KABIR_CLASSICAL_V1,
  });
  assert.equal(matches.matches.length, 0);
  assert.equal(matches.emptyReason, 'NO_EXACT_MATCH');
  assert.match(matches.userMessage, /tam sayısal eşleşme bulamadım/i);
  assert.equal(matches.invented, false);

  const result = runAbjadEsmaVerification({
    message: 'Peki denk gelen Esma nedir?',
    history: [
      { role: 'user', content: 'حسين' },
      {
        role: 'assistant',
        content: 'حسين\nح = 8\nس = 60\nي = 10\nن = 50\nToplam = 128',
      },
    ],
  });
  assert.match(result.reply, /tam eşleşme|tam sayısal eşleşme/i);
  assert.doesNotMatch(result.reply, /El-Melik.*128|Latif.*128|El-Latîf = 128/i);
});

// ── 10. Target 129 → لطيف exact ──────────────────────────────────────
check('10 target 129 → لطيف exact match + breakdown', () => {
  const matches = findEsmaMatches({ value: 129, matchType: 'exact' });
  assert.ok(matches.matches.some((m) => m.arabic === 'لطيف' && m.value === 129));
  const hit = matches.matches.find((m) => m.arabic === 'لطيف');
  assert.deepEqual(hit.letterBreakdown, [
    { letter: 'ل', value: 30 },
    { letter: 'ط', value: 9 },
    { letter: 'ي', value: 10 },
    { letter: 'ف', value: 80 },
  ]);
});

// ── 11. Variants calculated separately ───────────────────────────────
check('11 Latif variants bare vs definite separate', () => {
  const entry = lookupEsmaAbjadEntry('latif');
  assert.notEqual(entry.bareValue, entry.definiteValue);
  assert.equal(entry.bareValue, 129);
  assert.equal(entry.definiteValue, 160);
  const exact129 = findEsmaMatches({ value: 129, matchType: 'exact' });
  const exact160 = findEsmaMatches({ value: 160, matchType: 'exact' });
  assert.ok(exact129.matches.some((m) => m.form === 'bare'));
  assert.ok(exact160.matches.some((m) => m.form === 'definite'));
});

// ── 12. User objection does not override engine ──────────────────────
check('12 user objection does not override verified total', () => {
  const result = runAbjadEsmaVerification({
    message: 'Yine yanlış, Latif olacaktı.',
    history: [
      {
        role: 'assistant',
        content: 'حسين\nح = 8\nس = 60\nي = 10\nن = 50\nToplam = 128',
      },
    ],
  });
  assert.equal(result.claimAccepted, false);
  assert.match(result.reply, /129/);
  assert.match(result.reply, /128/);
  assert.doesNotMatch(result.reply, /Evet.*Latif.*128/i);
  assert.equal(result.calc.bare.total, 129);
});

check('match types exact/near/reduced/traditional separated', () => {
  const exact = findEsmaMatches({ value: 129, matchType: 'exact' });
  const near = findEsmaMatches({ value: 128, matchType: 'near', nearMaxDelta: 5 });
  const reduced = findEsmaMatches({ value: 128, matchType: 'reduced' });
  const traditional = findEsmaMatches({ value: 128, matchType: 'traditional' });
  assert.equal(exact.matchType, 'exact');
  assert.ok(exact.matches.every((m) => m.matchType === 'exact'));
  assert.equal(near.matchType, 'near');
  assert.ok(near.matches.every((m) => m.matchType === 'near'));
  assert.ok(near.userMessage?.includes('tam sayısal eşleşme olarak sunulamaz'));
  assert.equal(reduced.matchType, 'reduced');
  assert.match(reduced.userMessage || '', /indirgenmiş|rakam kökü/i);
  assert.equal(traditional.matches.length, 0);
  assert.equal(traditional.emptyReason, 'TRADITIONAL_NOT_IN_NUMERIC_CATALOG');
});

check('Latin Hüseyin without Arabic asks confirmation', () => {
  const spelling = resolveArabicSpelling({ originalInput: 'Hüseyin' });
  assert.equal(spelling.status, 'proposed');
  assert.equal(spelling.spellingConfirmed, false);
  assert.equal(spelling.normalizedArabic, 'حسين');
  const result = runAbjadEsmaVerification({
    message: 'Hüseyin adının ebced değerini hesapla',
  });
  assert.match(result.reply, /حسين|onay|hesaplayalım/i);
  assert.equal(result.confidence, 'insufficient');
});

check('Lara (Latin, no gazetteer match) auto-transliterates and computes (ADR-010)', () => {
  const spelling = resolveArabicSpelling({ originalInput: 'Lara', latinHint: 'Lara' });
  assert.equal(spelling.status, 'confirmed');
  assert.equal(spelling.spellingConfirmed, true);
  assert.equal(spelling.autoTransliterated, true);
  assert.equal(spelling.transliterationMethod, 'default-latin-ar-v1');
  assert.equal(spelling.normalizedArabic, 'لارا');
  assert.ok(Array.isArray(spelling.transliterationBreakdown));
  assert.equal(spelling.transliterationBreakdown.length, 4);
  assert.ok(spelling.disclosures.length >= 1);

  const calc = calculateAbjad(spelling.normalizedArabic, ABJAD_KABIR_CLASSICAL_V1);
  assert.equal(calc.ok, true);
  assert.equal(calc.total, 232);
});

check('Lara ebced chat reply computes immediately, no clarifying question', () => {
  const result = tryDeterministicAbjadReply({ message: 'Lara isminin ebced değeri kaç?' });
  assert.ok(result?.reply);
  assert.match(result.reply, /Toplam\s*=\s*232/);
  assert.match(result.reply, /L\s*→\s*ل/);
  assert.doesNotMatch(result.reply, /Arapça yazımı belirtin|onaylar mısın/i);
  assert.equal(result.confidence, 'high');
});

check("Lara'nın ebcedi kaç? (possessive suffix form) also resolves the name", () => {
  const result = tryDeterministicAbjadReply({ message: "Lara'nın ebcedi kaç?" });
  assert.ok(result?.reply);
  assert.match(result.reply, /Toplam\s*=\s*232/);
});

check('gazetteer name (Hüseyin) is unaffected by default transliteration', () => {
  const spelling = resolveArabicSpelling({ originalInput: 'Hüseyin', latinHint: 'Hüseyin' });
  assert.equal(spelling.status, 'proposed');
  assert.equal(spelling.autoTransliterated, false);
});

check('bare "ebced hesapla" (no captured name) still asks for spelling, does not compute garbage', () => {
  const result = tryDeterministicAbjadReply({ message: 'ebced hesapla' });
  assert.ok(result?.reply);
  assert.match(result.reply, /Arapça yazımı belirtin/i);
  assert.equal(result.confidence, 'insufficient');
});

check('calculateAbjad IO contract', () => {
  const out = calculateAbjad('حسين', 'abjad-kabir-classical-v1');
  assert.equal(out.ok, true);
  assert.equal(out.normalizedText, 'حسين');
  assert.equal(typeof out.total, 'number');
  assert.equal(out.methodologyId, 'abjad-kabir-classical-v1');
  assert.ok(Array.isArray(out.letters));
  const bad = calculateAbjad('حسين', 'not-a-method');
  assert.equal(bad.ok, false);
  assert.equal(bad.errorCode, 'UNSUPPORTED_METHODOLOGY');
});

check('Esma catalog loaded + article handling', () => {
  assert.ok(ESMA_ABJAD_CATALOG.length >= 2);
  const latif = ESMA_ABJAD_CATALOG.find((e) => e.id === 'latif');
  assert.equal(latif.canonicalArabic, 'لطيف');
  assert.equal(latif.definiteArabic, 'اللطيف');
  assert.notEqual(latif.bareValue, latif.definiteValue);
});

check('confidence high only when gates met', () => {
  const confirmed = runAbjadEsmaVerification({
    message: 'حسين Arapça Hüseyin böyle yazılır.',
  });
  assert.equal(confirmed.calc.total, 128);
  assert.equal(confirmed.confidence, 'high');

  const proposed = runAbjadEsmaVerification({
    message: 'Hüseyin ebced hesabı',
  });
  assert.notEqual(proposed.confidence, 'high');
});

check('system prompt includes abjad verification rules', () => {
  const prompt = buildAtlasSystemPrompt({ profile: 'conversational', mode: 'conversational' });
  assert.match(prompt, /Kullanıcının düzeltmesi, hesaplama sonucu için kaynak gerçekliği değildir/);
  assert.match(prompt, /harf harf yeniden hesaplama/i);
});

check('tryDeterministicAbjadReply rejects user override', () => {
  const det = tryDeterministicAbjadReply({ message: "Latif 128'dir" });
  assert.ok(det);
  assert.equal(det.claimAccepted, false);
  assert.match(det.reply, /129/);
});

check('intent detection for objection chain', () => {
  const intent = detectAbjadEsmaIntent('Yine yanlış, Latif olacaktı.', [
    { role: 'assistant', content: 'Toplam = 128' },
  ]);
  assert.equal(intent.active, true);
  assert.equal(intent.kind, 'user_value_claim');
  assert.equal(intent.esmaClaim.claimedValue, 128);
});

// Note: "Lara" is intentionally not used here — it is a special-cased
// founder/identity name in atlas-message-service.js's identity-clarification
// gate (fires before the abjad gate), so it never reaches abjad-verification
// in the live pipeline. Any other Latin name exercises the same code path.
await checkAsync('Telegram flow: Zeynep isminin ebced değeri kaç? (ADR-010 default translit, full pipeline)', async () => {
  const result = await processAtlasMessage(
    {
      channel: 'telegram',
      message: 'Zeynep isminin ebced değeri kaç?',
      history: [],
      conversationId: 'abjad-test-translit-1',
    },
    { mode: 'conversational' },
  );
  assert.equal(result.engine, 'abjad-verification');
  assert.doesNotMatch(result.reply, /Arapça yazımı belirtin|onaylar mısın/i);
  assert.equal(result.data?.abjadVerification?.calcTotal, 71);
});

await checkAsync('Telegram flow: حسين → 128 via processAtlasMessage', async () => {
  const result = await processAtlasMessage(
    {
      channel: 'telegram',
      message: 'حسين\nArapça Hüseyin böyle yazılır.',
      history: [],
      conversationId: 'abjad-test-1',
    },
    { mode: 'conversational' },
  );
  assert.equal(result.engine, 'abjad-verification');
  assert.match(result.reply, /128/);
  assert.equal(result.data?.abjadVerification?.calcTotal, 128);
});

await checkAsync('Telegram flow: Esma after 128 → no invent', async () => {
  const result = await processAtlasMessage(
    {
      channel: 'telegram',
      message: 'Peki denk gelen Esma nedir?',
      history: [
        { role: 'user', content: 'حسين' },
        {
          role: 'assistant',
          content:
            'Kullanılan Arapça yazım: حسين\nح = 8\nس = 60\nي = 10\nن = 50\nToplam = 128',
        },
      ],
      conversationId: 'abjad-test-2',
    },
    { mode: 'conversational' },
  );
  assert.equal(result.engine, 'abjad-verification');
  assert.match(result.reply, /tam eşleşme|bulamadım/i);
  assert.doesNotMatch(result.reply, /El-Melik\s*=\s*128|Latif\s*=\s*128/i);
});

console.log('\n────────────────────────────────');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Skipped: 0`);
console.log(`Disabled: 0`);
if (failures.length) {
  console.log('Failures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
}
if (failed > 0) process.exit(1);
console.log('ALL ABJAD/ESMA VERIFICATION TESTS PASSED');

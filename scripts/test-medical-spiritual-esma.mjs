/**
 * Medical + spiritual intent / Esma recommendation regression matrix.
 * Run: node scripts/test-medical-spiritual-esma.mjs
 */
import assert from 'node:assert/strict';
import {
  detectAbjadEsmaIntent,
  tryDeterministicAbjadReply,
  isExplicitEbcedEsmaMatchAsk,
} from '../server/abjad-verification.js';
import {
  detectDevotionalRecommendationIntent,
  tryDeterministicDevotionalReply,
  selectDevotionalEsma,
  DEVOTIONAL_RECOMMENDATION_VERSION,
} from '../server/devotional-recommendation.js';
import {
  applyMedicalSpiritualClaimGuard,
  replyViolatesEvidenceBoundary,
} from '../server/evidence-meaning-boundaries.js';
import { detectNumerologyIntent } from '../server/numerology-engine/intent.js';
import { detectTarotEngineIntent } from '../server/tarot-engine/intent.js';
import { detectDreamEngineIntent } from '../server/dream-engine/intent.js';
import { processAtlasMessage } from '../server/atlas-message-service.js';
import { isDirectKnowledgeQuestion } from '../server/referential-sufficiency.js';

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

console.log(`\n[medical-spiritual-esma ${DEVOTIONAL_RECOMMENDATION_VERSION}]\n`);

const LIVE =
  'Kronik böbrek yetmezliğim var doktor kontrolündeyim hangi esmayı ne kadar çekeyim?';

// ── TEST 1 — live Hüseyin case ───────────────────────────────────────
check('TEST1 detect: esma_recommendation + medical, no ebced', () => {
  const intent = detectDevotionalRecommendationIntent(LIVE);
  assert.equal(intent.active, true);
  assert.equal(intent.subintent, 'esma_recommendation');
  assert.equal(intent.medicalContext, true);
  assert.equal(intent.ebcedRequested, false);
  assert.equal(intent.countAsked, true);
  assert.equal(detectAbjadEsmaIntent(LIVE).active, false);
  assert.equal(isExplicitEbcedEsmaMatchAsk(LIVE), false);
});

check('TEST1 reply: Esma + framing + count; no Arabic/ebced/treatment guarantee', () => {
  const det = tryDeterministicDevotionalReply({ message: LIVE });
  assert.ok(det?.reply);
  assert.match(det.reply, /Şâfî|Şafi|şâfî|Ya /i);
  assert.match(det.reply, /manevi|dua|zikir/i);
  assert.match(det.reply, /33|99|say[ıi]/i);
  assert.doesNotMatch(det.reply, /Arapça yazım/i);
  assert.doesNotMatch(det.reply, /ebced toplam/i);
  assert.doesNotMatch(det.reply, /önce ismini|hesaplamalıyım/i);
  assert.equal(replyViolatesEvidenceBoundary(det.reply, 'medical_treatment'), false);
});

await checkAsync('TEST1 processAtlasMessage live case', async () => {
  const result = await processAtlasMessage(
    {
      channel: 'web',
      message: LIVE,
      history: [],
      conversationId: 'med-spirit-t1',
    },
    { mode: 'conversational' },
  );
  assert.equal(result.engine, 'devotional-recommendation');
  assert.match(result.reply, /Şâfî|Şafi|Ya /i);
  assert.doesNotMatch(result.reply, /Arapça yazım|ebced toplam/i);
});

// ── TEST 2 — explicit ebced still works ──────────────────────────────
check('TEST2 explicit ebced match ask stays on abjad', () => {
  const msg = 'İsmimin ebcedine göre bana denk gelen Esmayı bul.';
  const intent = detectDevotionalRecommendationIntent(msg);
  assert.equal(intent.active, false);
  assert.equal(intent.ebcedRequested, true);
  assert.equal(detectAbjadEsmaIntent(msg).active, true);
  assert.equal(detectAbjadEsmaIntent(msg).kind, 'esma_match');
});

await checkAsync('TEST2 processAtlasMessage ebced path', async () => {
  const result = await processAtlasMessage(
    {
      channel: 'telegram',
      message: 'İsmimin ebcedine göre bana denk gelen Esmayı bul.',
      history: [],
      conversationId: 'med-spirit-t2',
    },
    { mode: 'conversational' },
  );
  assert.equal(result.engine, 'abjad-verification');
  assert.match(result.reply, /ebced|Arapça/i);
});

// ── TEST 3 — dua intent, no name/DOB ask ─────────────────────────────
check('TEST3 dua/esma for surgery — direct recommend', () => {
  const msg = 'Annem ameliyata girecek hangi dua veya Esmayı okuyabilirim?';
  const det = tryDeterministicDevotionalReply({ message: msg });
  assert.ok(det?.reply);
  assert.match(det.reply, /Esma|Ya |dua|zikir|Şâfî|Şafi|Latîf|Rahmân/i);
  assert.doesNotMatch(det.reply, /Arapça|doğum tarihi|ismiin|ismimi paylaş/i);
  assert.equal(detectAbjadEsmaIntent(msg).active, false);
});

// ── TEST 4 — treatment claim calibration ─────────────────────────────
check('TEST4 Ya Şafi iyileştirir mi — no medical efficacy claim', () => {
  const msg = 'Ya Şafi böbrek yetmezliğini iyileştirir mi?';
  const det = tryDeterministicDevotionalReply({ message: msg });
  assert.ok(det?.reply);
  assert.match(det.reply, /manevi|şifa|niyet/i);
  assert.doesNotMatch(det.reply, /iyileştirir\b|tedavi eder\b|böbreği düzelt/i);
  assert.equal(
    applyMedicalSpiritualClaimGuard('Ya Şafi böbrek yetmezliğini iyileştirir.', {
      medicalContext: true,
      message: msg,
    }).hits.includes('medical_treatment_claim'),
    true,
  );
});

// ── TEST 5 — count guidance ──────────────────────────────────────────
check('TEST5 Ya Şafi kaç kere — no disease prescription', () => {
  const msg = 'Ya Şafi kaç kere çekilir?';
  const det = tryDeterministicDevotionalReply({ message: msg });
  assert.ok(det?.reply);
  assert.match(det.reply, /33|99|zorunlu|garanti|sayı/i);
  assert.doesNotMatch(det.reply, /kesin sayı|786|iyileşir/i);
});

// ── TEST 6 — follow-up repair ────────────────────────────────────────
check('TEST6 follow-up clears stale ebced intent', () => {
  const history = [
    { role: 'user', content: 'Böbrek hastalığım için hangi Esmayı çekeyim?' },
    {
      role: 'assistant',
      content: 'İsminin Arapça yazımını gönder. Denk gelen Esma için önce doğrulanmış bir ebced toplamına ihtiyacım var.',
    },
  ];
  const turn2 = 'Hayır ben ebced sormuyorum hangi Esmayı okuyayım diyorum.';
  assert.equal(detectAbjadEsmaIntent(turn2, history).active, false);
  const det = tryDeterministicDevotionalReply({ message: turn2, history });
  assert.ok(det?.reply);
  assert.equal(det.intent.followUpRepair, true);
  assert.match(det.reply, /ebced|Arapça isim|Anladım/i);
  assert.match(det.reply, /Ya |Şâfî|Şafi|Esma|zikir/i);
  assert.doesNotMatch(det.reply, /Arapça yazımı paylaş/i);
});

// ── TEST 7 — domain contamination ────────────────────────────────────
check('TEST7 migren manevi — not numerology/astro/tarot/ebced/dream', () => {
  const msg = 'Migrenim tuttu. Manevi olarak ne okuyabilirim?';
  const det = tryDeterministicDevotionalReply({ message: msg });
  assert.ok(det?.active);
  assert.equal(detectAbjadEsmaIntent(msg).active, false);
  assert.equal(detectNumerologyIntent(msg, []).active, false);
  assert.equal(detectTarotEngineIntent(msg, []).active, false);
  const dream = detectDreamEngineIntent(msg, []);
  assert.equal(dream?.active === true, false);
});

await checkAsync('TEST7 processAtlasMessage domain', async () => {
  const result = await processAtlasMessage(
    {
      channel: 'telegram',
      message: 'Migrenim tuttu. Manevi olarak ne okuyabilirim?',
      history: [],
      conversationId: 'med-spirit-t7',
    },
    { mode: 'conversational' },
  );
  assert.equal(result.engine, 'devotional-recommendation');
  assert.doesNotMatch(result.reply, /numeroloji|astroloji|tarot|ebced|rüya analizi/i);
});

// ── TEST 8 — medical-only no spiritual injection ─────────────────────
check('TEST8 kreatinin medical-only — no auto Esma', () => {
  const msg = 'Kronik böbrek yetmezliğinde kreatinin neden yükselir?';
  const intent = detectDevotionalRecommendationIntent(msg);
  assert.equal(intent.active, false);
  assert.equal(intent.medicalOnly, true);
  assert.equal(tryDeterministicDevotionalReply({ message: msg }), null);
  assert.ok(selectDevotionalEsma(msg).length >= 1); // catalog still works; just not auto-routed
});

await checkAsync('TEST8 processAtlasMessage does not use devotion engine', async () => {
  const result = await processAtlasMessage(
    {
      channel: 'web',
      message: 'Kronik böbrek yetmezliğinde kreatinin neden yükselir?',
      history: [],
      conversationId: 'med-spirit-t8',
    },
    { mode: 'conversational' },
  );
  assert.notEqual(result.engine, 'devotional-recommendation');
  assert.notEqual(result.engine, 'abjad-verification');
  assert.doesNotMatch(result.reply || '', /Ya Şâfî|hangi esma.*çek/i);
});

// ── Shared guards ────────────────────────────────────────────────────
check('referential: esma recommendation is direct knowledge', () => {
  assert.equal(isDirectKnowledgeQuestion(LIVE), true);
});

check('abjad regression: denk gelen after total still matches', () => {
  const intent = detectAbjadEsmaIntent('Peki denk gelen Esma nedir?', [
    {
      role: 'assistant',
      content: 'Toplam = 128',
    },
  ]);
  assert.equal(intent.active, true);
  assert.equal(intent.kind, 'esma_match');
  const det = tryDeterministicAbjadReply({
    message: 'Peki denk gelen Esma nedir?',
    history: [
      {
        role: 'assistant',
        content: 'حسين\nح = 8\nس = 60\nي = 10\nن = 50\nToplam = 128',
      },
    ],
  });
  assert.ok(det?.reply);
  assert.match(det.reply, /128|eşleşme|bulamadım/i);
});

console.log('\n────────────────────────────────');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length) {
  for (const f of failures) console.error(` - ${f.name}: ${f.error}`);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════
// Test: ordinal follow-up detection must not fire on ordinary sentences
// that merely contain an ordinal word ("ilk", "ikinci", ...) — only on
// genuine "pick option N" utterances.
//
// Regression found by scripts/test-conversation-regression-fixtures.mjs:
// a real multi-turn conversation where a dream-engine reply ended with
// "İstersen duygu, gerilim veya bir katmanı detaylı açabiliriz." (an
// offered-options list), and the next turn — an unrelated historical/
// religion question starting with "İlk" ("first") — was misread as
// "select the first offered option" purely because detectAssistantAnchoredFollowUp()
// accepted ANY message ≤40 chars containing an ordinal word, anchoring be
// damned. Fixed by requiring ORDINAL_RE's anchored match (whole message is
// the ordinal + a light open/expand tail, nothing else).
// ═══════════════════════════════════════════════════════════════════════

import assert from 'assert';
import { detectAssistantAnchoredFollowUp, resolveAssistantFollowUp } from '../server/assistant-followup.js';

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

console.log('[test-ordinal-followup-precision] genuine ordinal-selection utterances still resolve');

const genuineOrdinals = [
  ['ilk', 1],
  ['ilki', 1],
  ['ilkini aç', 1],
  ['ilkini açar mısın', 1],
  ['birincisi', 1],
  ['birincisini anlat', 1],
  ['ikincisi', 2],
  ['ikincisini açar mısın?', 2],
  ['dördüncüsünü göster', 4],
  ['sonuncusu', -1],
];

for (const [text, expected] of genuineOrdinals) {
  await check(`"${text}" still detected as ordinal(${expected})`, () => {
    const result = detectAssistantAnchoredFollowUp(text);
    assert.strictEqual(result.kind, 'ordinal', `expected kind=ordinal, got ${JSON.stringify(result)}`);
    assert.strictEqual(result.ordinal, expected);
  });
}

console.log('[test-ordinal-followup-precision] ordinary sentences containing an ordinal word are NOT hijacked');

const falsePositiveCandidates = [
  'İlk şeytan hangi dinde belirdi?',
  'İlk dünya savaşı ne zaman başladı?',
  'İkinci el araba almalı mıyım?',
  'Üçüncü köprü nerede?',
  'İlk kez buraya geliyorum.',
];

for (const text of falsePositiveCandidates) {
  await check(`"${text}" is not misread as an ordinal selection`, () => {
    const result = detectAssistantAnchoredFollowUp(text);
    assert.strictEqual(result.kind, null, `expected kind=null, got ${JSON.stringify(result)}`);
  });
}

console.log('[test-ordinal-followup-precision] end-to-end: resolveAssistantFollowUp does not rewrite the message');

await check('a factual question after an options-offering assistant turn keeps its own text', () => {
  const priorAssistantReply =
    'Tek imgeden kesin hüküm çıkmaz; bu okuma yön ve olasılık verir. ' +
    'İstersen duygu, gerilim veya bir katmanı detaylı açabiliriz.';
  const resolution = resolveAssistantFollowUp({
    message: 'İlk şeytan hangi dinde belirdi?',
    history: [
      { role: 'user', content: 'rüyamda ejderha gördüm' },
      { role: 'assistant', content: priorAssistantReply },
    ],
  });
  assert.strictEqual(resolution.resolved, false);
  assert.strictEqual(resolution.rewriteMessage, undefined);
});

console.log(
  failures === 0
    ? '\n[test-ordinal-followup-precision] all checks passed.'
    : `\n[test-ordinal-followup-precision] ${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);

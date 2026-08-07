/**
 * Atlas Consistency Report — measure first-reply length, repetition, tone across engines.
 * Run: node scripts/atlas-consistency-report.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tryDreamFlowReply } from '../server/dream-flow.js';
import { tryTarotFlowReply } from '../server/tarot-flow.js';
import { tryNumerologyFlowReply } from '../server/numerology-flow.js';
import { _resetAllDreamSessions } from '../server/dream-engine/index.js';
import { _resetAllTarotSessions } from '../server/tarot-engine/index.js';
import { _resetAllNumerologySessions } from '../server/numerology-engine/index.js';
import { resolveDreamDepth } from '../server/dream-engine/orchestrator.js';
import { resolveTarotDepth } from '../server/tarot-engine/orchestrator.js';
import { resolveNumerologyDepth } from '../server/numerology-engine/orchestrator.js';
import { DEPTH_LEVEL } from '../server/dream-engine/methodology.js';
import { runMessageCrossLayerSynthesis } from '../server/cross-layer-synthesis/index.js';
import { tryDeterministicConversationReply } from '../server/atlas-conversation-style.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(root, 'tmp'), { recursive: true });

const STOCK = [
  /tek\s+ba[sş][ıi]na\s+tek\s+bir\s+anlam\s+ta[sş][ıi]maz/gi,
  /Bu yorum kesin değildir/gi,
  /##\s+/g,
];

function words(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function headerCount(text) {
  return (String(text || '').match(/^##\s+/gm) || []).length;
}

function stockHits(text) {
  let n = 0;
  for (const re of STOCK) {
    const m = String(text || '').match(re);
    if (m) n += m.length;
  }
  return n;
}

function toneFlags(text) {
  const t = String(text || '');
  return {
    inviteDeeper: /istersen|daha açabiliriz|bir katman/i.test(t),
    uncertainty: /kesin\s+de[gğ]il|sembolik|olas[ıi]l[ıi]k|kehanet\s+de[gğ]il|hüküm\s+vermez/i.test(t),
    assistantCliché: /nasıl yardımcı olabilirim|yapay zek[aâ] asistan/i.test(t),
    reportFeel: headerCount(t) >= 3,
  };
}

_resetAllDreamSessions();
_resetAllTarotSessions();
_resetAllNumerologySessions();

const cases = [];

{
  const depth = resolveDreamDepth('Rüyamı yorumla. Denizde yürüyordum, su ayaklarımı ıslatmıyordu, korku hissettim.');
  const out = tryDreamFlowReply({
    message:
      'Rüyamı yorumla. Rüyamda denizde yürüyordum ama su ayaklarımı ıslatmıyordu; uyanınca kaygılıydım.',
    conversationId: 'cons-dream-1',
    userId: 'web:cons-1',
  });
  cases.push({
    engine: 'dream',
    message: 'rüya (narrative)',
    depth,
    reply: out?.reply || '',
    words: words(out?.reply),
    headers: headerCount(out?.reply),
    stock: stockHits(out?.reply),
    ...toneFlags(out?.reply),
  });
}

{
  const depth = resolveTarotDepth('Üç kart açılımı istiyorum');
  const out = tryTarotFlowReply({
    message: 'Üç kart açılımı istiyorum',
    conversationId: 'cons-tarot-1',
    userId: 'web:cons-1',
  });
  cases.push({
    engine: 'tarot',
    message: 'üç kart',
    depth,
    reply: out?.reply || '',
    words: words(out?.reply),
    headers: headerCount(out?.reply),
    stock: stockHits(out?.reply),
    ...toneFlags(out?.reply),
  });
}

{
  const depth = resolveNumerologyDepth('27.01.1986 numerolojimi anlat.');
  const out = tryNumerologyFlowReply({
    message: '27.01.1986 numerolojimi anlat.',
    conversationId: 'cons-num-1',
    userId: 'web:cons-1',
    now: new Date('2026-08-07T12:00:00+03:00'),
  });
  cases.push({
    engine: 'numerology',
    message: 'numeroloji anlat',
    depth,
    reply: out?.reply || '',
    words: words(out?.reply),
    headers: headerCount(out?.reply),
    stock: stockHits(out?.reply),
    ...toneFlags(out?.reply),
    depthResolved: depth,
  });
}

{
  const bridge = runMessageCrossLayerSynthesis({
    message: 'Astroloji ve numerolojiyi birlikte oku; karar teması.',
  });
  const reply = bridge.synthesis?.prose || '';
  cases.push({
    engine: 'cross-layer',
    message: 'astro+num birlikte',
    depth: null,
    reply,
    words: words(reply),
    headers: headerCount(reply),
    stock: stockHits(reply),
    ...toneFlags(reply),
  });
}

{
  const det = tryDeterministicConversationReply({ message: 'Sen kimsin?' });
  cases.push({
    engine: 'chat-style',
    message: 'Sen kimsin?',
    depth: null,
    reply: det?.reply || '',
    words: words(det?.reply),
    headers: headerCount(det?.reply),
    stock: stockHits(det?.reply),
    ...toneFlags(det?.reply),
  });
}

const engineCases = cases.filter((c) => c.engine !== 'chat-style');
const avgWords = Math.round(
  engineCases.reduce((a, c) => a + c.words, 0) / Math.max(1, engineCases.length),
);

const report = {
  generatedAt: new Date().toISOString(),
  criteria: {
    defaultDepthShort:
      resolveDreamDepth('rüya') === DEPTH_LEVEL.SHORT &&
      resolveTarotDepth('tarot') === DEPTH_LEVEL.SHORT &&
      resolveNumerologyDepth('numeroloji') === DEPTH_LEVEL.SHORT,
    avgFirstReplyWords: avgWords,
    targetAvgWords: '≤ 120',
    noReportDefault: engineCases.every((c) => c.headers === 0),
    toneGuide: {
      uncertaintyPresent: engineCases.filter((c) => c.uncertainty).length,
      assistantCliché: engineCases.filter((c) => c.assistantCliché).length,
      reportFeel: engineCases.filter((c) => c.reportFeel).length,
    },
  },
  cases: cases.map(({ reply, ...rest }) => ({
    ...rest,
    excerpt: String(reply).slice(0, 220),
  })),
  verdict:
    avgWords <= 120 &&
    engineCases.every((c) => c.headers === 0) &&
    engineCases.every((c) => !c.assistantCliché)
      ? 'ALIGNED'
      : 'NEEDS_WORK',
};

writeFileSync(resolve(root, 'tmp/atlas-consistency-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\nVerdict: ${report.verdict}`);

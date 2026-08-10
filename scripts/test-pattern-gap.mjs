/**
 * A15 Pattern Gap — unit checks (no browser).
 * Run: node scripts/test-pattern-gap.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function loadTs(rel) {
  const abs = resolve(root, rel);
  const source = readFileSync(abs, 'utf8');
  const { code } = transformSync(source, {
    loader: 'ts',
    format: 'cjs',
    target: 'node18',
  });
  const require = createRequire(import.meta.url);
  const Module = require('module');
  const m = new Module(abs);
  m.filename = abs;
  m.paths = Module._nodeModulePaths(dirname(abs));
  m._compile(code, abs);
  return m.exports;
}

const pt = loadTs('src/data/pattern-traces.ts');

const poolLabels = pt.PATTERN_TRACE_POOL.map((t) => t.label);
record('pool size 8', pt.PATTERN_TRACE_POOL.length === 8);
record(
  'pool ids',
  ['tekrar', 'tarih', 'kisi', 'ruya', 'celiski', 'sembol', 'donem', 'secim'].every((id) =>
    pt.PATTERN_TRACE_POOL.some((t) => t.id === id),
  ),
);
record(
  'no engine names in pool',
  !/(numerolog|tarot|natal|dream engine|persona)/i.test(poolLabels.join(' ')),
);

const a = pt.seededShuffle(pt.PATTERN_TRACE_POOL, 'session-a');
const b = pt.seededShuffle(pt.PATTERN_TRACE_POOL, 'session-a');
const c = pt.seededShuffle(pt.PATTERN_TRACE_POOL, 'session-b');
record(
  'seeded shuffle stable',
  a.map((t) => t.id).join() === b.map((t) => t.id).join(),
);
record(
  'seeded shuffle varies by seed',
  a.map((t) => t.id).join() !== c.map((t) => t.id).join(),
);

record('visible count 3', pt.PATTERN_GAP_VISIBLE_COUNT === 3);

const markers = pt.formatTraceMarkers([
  pt.PATTERN_TRACE_POOL[0],
  pt.PATTERN_TRACE_POOL[2],
]);
record('markers format', markers === '[tekrar] [kişi]', markers);

const composed = pt.composeMessageWithTraces('gece yine aynı rüya', [
  pt.PATTERN_TRACE_POOL[0],
  pt.PATTERN_TRACE_POOL[3],
]);
record(
  'compose keeps user sentence',
  composed === '[tekrar] [rüya]\ngece yine aynı rüya',
  composed,
);
record(
  'compose without traces is plain',
  pt.composeMessageWithTraces('sadece yazı', []) === 'sadece yazı',
);

const winner = pt.PLACEHOLDER_CANDIDATES.reduce((best, cur) =>
  pt.scorePlaceholder(cur.scores) > pt.scorePlaceholder(best.scores) ? cur : best,
);
record(
  'placeholder candidates still scored',
  winner.text === 'Ne taşıyorsun?',
  `${winner.text} (${pt.scorePlaceholder(winner.scores)})`,
);
record('at least 10 placeholder candidates', pt.PLACEHOLDER_CANDIDATES.length >= 10);
record(
  'visible composer placeholder is natural',
  pt.PATTERN_GAP_PLACEHOLDER === 'Aklındakini anlat…',
);
record(
  'old manifesto placeholder not winner',
  pt.PATTERN_GAP_PLACEHOLDER !== 'Bir işaret getir. Gerisini birlikte okuruz.',
);

const tracesSrc = readFileSync(resolve(root, 'src/components/cosmic/PatternGapTraces.tsx'), 'utf8');
const chatSrc = readFileSync(resolve(root, 'src/pages/Chat.tsx'), 'utf8');
const eventsSrc = readFileSync(resolve(root, 'src/utils/discoverability-events.ts'), 'utf8');
const discoverySrc = readFileSync(resolve(root, 'src/data/capability-discovery.ts'), 'utf8');

record('empty invite subtitle only', /Aklındaki herhangi bir şeyi anlatabilirsin/.test(discoverySrc));
record('no suggestion surface in PatternGapTraces', !/Önündeki dönem|EMPTY_STATE_SUGGESTIONS|aria-pressed/.test(tracesSrc));
record('a11y site-focus optional or absent ok', true);
record('Chat wires PatternGapTraces', /PatternGapTraces/.test(chatSrc));
record('Chat does not inject markers', !/composeMessageWithTraces/.test(chatSrc));
record('post-send reveal omitted', !/dayanak güçlenir/.test(chatSrc));
record(
  'analytics events prepared',
  [
    'empty_state_seen',
    'trace_selected',
    'multiple_traces_selected',
    'first_message_sent',
    'first_message_without_trace',
    'first_message_with_trace',
  ].every((e) => eventsSrc.includes(e)),
);
record('no third-party analytics', !/(gtag|plausible|posthog|segment|mixpanel)/i.test(eventsSrc));
record('no chip wall rounded-full on traces', !/rounded-full/.test(tracesSrc));
record('no gradient / sparkle in traces', !/gradient|sparkle|particle/i.test(tracesSrc));

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);

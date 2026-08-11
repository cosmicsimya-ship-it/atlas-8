/**
 * Empty-state discovery questions — unit checks (no browser).
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

const pool = pt.DISCOVERY_QUESTION_POOL;
const poolTexts = pool.map((q) => q.text);
const fixed = pt.getEmptyStateDiscoveryQuestions();

record('fixed set size 5', pool.length === 5 && fixed.length === 5, String(pool.length));
record('visible count 5', pt.DISCOVERY_VISIBLE_COUNT === 5);
record(
  'exact empty-state copy',
  [
    'Bu tarih neden karşıma çıkıyor?',
    'Asıl örüntü ne?',
    'Bu tesadüf mü, yoksa bir tekrar mı?',
    'Bu kişi neden yeniden gündeme geldi?',
    'Söylediğiyle yaptığı neden çelişiyor?',
  ].every((t) => poolTexts.includes(t)) && poolTexts.length === 5,
);
record(
  'removed kaçırıyorum pattern questions',
  !poolTexts.some((t) => /kaçırıyorum/.test(t)),
);
record(
  'no session rotation on surface',
  fixed.map((q) => q.id).join() === pool.map((q) => q.id).join() &&
    pt.getSessionVisibleDiscoveryQuestions().map((q) => q.id).join() ===
      fixed.map((q) => q.id).join(),
);
record(
  'no engine names in pool',
  !/(numerolog|tarot|natal|dream engine|persona)/i.test(poolTexts.join(' ')),
);
record(
  'composer text never includes intent markers',
  pool.every((q) => {
    const text = pt.discoveryQuestionToComposerText(q);
    return text === q.text && !/\[/.test(text) && text !== q.intent;
  }),
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

const tracesSrc = readFileSync(resolve(root, 'src/components/cosmic/PatternGapTraces.tsx'), 'utf8');
const chatSrc = readFileSync(resolve(root, 'src/pages/Chat.tsx'), 'utf8');
const eventsSrc = readFileSync(resolve(root, 'src/utils/discoverability-events.ts'), 'utf8');
const discoverySrc = readFileSync(resolve(root, 'src/data/capability-discovery.ts'), 'utf8');
const dataSrc = readFileSync(resolve(root, 'src/data/pattern-traces.ts'), 'utf8');

record('empty invite keeps headline', /Neye bakıyoruz\?/.test(discoverySrc));
record(
  'no taxonomy chip labels as standalone pool labels',
  !/label:\s*'(tekrar|tarih|kişi|çelişki|dönem|seçim)'/.test(dataSrc),
);
record(
  'no marker serialization helpers',
  !/formatTraceMarkers|composeMessageWithTraces/.test(dataSrc + chatSrc + tracesSrc),
);
record(
  'PatternGapTraces uses fixed empty-state set',
  /getEmptyStateDiscoveryQuestions/.test(tracesSrc) && /onSelect/.test(tracesSrc),
);
record(
  'PatternGapTraces center-axis composition',
  /byId\.repeat/.test(tracesSrc) && /byId\.date/.test(tracesSrc) && /byId\.contradiction/.test(tracesSrc),
);
record(
  'no random offset stagger',
  !/LEFT_STAGGER|RIGHT_STAGGER|translate-x-2\.5|Math\.random/.test(tracesSrc),
);
record(
  'no pill / rounded-full chip wall',
  !/rounded-full|rounded-2xl|border border|bg-white\/\[0\.0[2-9]\]/.test(tracesSrc),
);
record('Chat wires PatternGapTraces with onSelect', /PatternGapTraces[\s\S]*onSelect/.test(chatSrc));
record(
  'Chat empty-state has no orbit icon',
  !/isEmpty \? \([\s\S]*?<AtlasCorePresence[\s\S]*?discoveryCopy\.emptyInvite/.test(chatSrc),
);
record(
  'Chat fills composer without auto-send',
  /setInput\(composerText\)/.test(chatSrc) &&
    !/onSelect[\s\S]{0,400}void send\(/.test(chatSrc) &&
    !/onSelect[\s\S]{0,400}sendTurn\(/.test(chatSrc),
);
record(
  'Chat never injects intent into input',
  !/question\.intent|setInput\([^)]*intent/.test(chatSrc),
);
record(
  'analytics events prepared',
  [
    'empty_state_seen',
    'discovery_question_selected',
    'first_message_sent',
    'first_message_without_discovery',
    'first_message_with_discovery',
  ].every((e) => eventsSrc.includes(e)),
);
record('no third-party analytics', !/(gtag|plausible|posthog|segment|mixpanel)/i.test(eventsSrc));

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);

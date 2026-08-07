/**
 * Lightweight identity-surface checks for P1–P3 (no server boot).
 * Run: node scripts/test-atlas-identity-surfaces.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const landing = read('src/data/landing-content.ts');
const landingPage = read('src/pages/Landing.tsx');
const about = read('src/pages/AboutPage.tsx');
const indexHtml = read('index.html');
const discovery = read('src/data/capability-discovery.ts');
const chatPage = read('src/pages/Chat.tsx');
const greeting = read('server/atlas-response.js');
const style = read('server/atlas-conversation-style.js');
const identity = read('server/atlas_identity.md');
const promptLoader = read('server/atlas-prompt-loader.js');
const responseStyle = read('server/atlas_response_style.md');

// ── P1 Homepage + Manifesto ───────────────────────────────────────────
record(
  'P1 hero manifesto primary',
  /titleLines:\s*\[[\s\S]*Her şey zaten ortada[\s\S]*Mesele nasıl okuduğun/.test(landing),
);
record(
  'P1 hero method secondary',
  /methodLines:\s*\[[\s\S]*Tek cevap aramaz[\s\S]*Denklem kurar/.test(landing),
);
record('P1 hero equation retained', /Tek cevap aramaz/.test(landing) && /Denklem kurar/.test(landing));
record('P1 fal boundary', /Fal bakmaz\. Kehanet üretmez/.test(landing));
record('P1 account hint', /Hesap zorunlu değil/.test(landing));
record('P1 convergence honesty', /mistik bir kesinlik motoru olarak değil/.test(landing));
record('P1 looks soften measure', /ayırt etmeye çalışır/.test(landing));
record(
  'P1 landing IA',
  /AlreadyThere/.test(landingPage) &&
    /ConvergenceSection/.test(landingPage) &&
    /PatternSelf/.test(landingPage) &&
    /AtlasLooks/.test(landingPage),
);
record('P1 manifesto on about', /atlasManifesto/.test(about));
record('P1 SEO not platform pitch', !/dijital keşif platformu/.test(indexHtml));
record('P1 SEO equation', /Denklem kurar/.test(indexHtml));
record('P1 hero section uses methodLines', /methodLines/.test(read('src/components/landing/HeroSection.tsx')));

// ── P2 Chat start (A15 Pattern Gap) ───────────────────────────────────
record('P2 empty invite', /Neye bakıyoruz\?/.test(discovery));
record(
  'P2 pattern gap traces',
  /PatternGapTraces/.test(chatPage) && /PATTERN_TRACE_POOL/.test(read('src/data/pattern-traces.ts')),
);
record(
  'P2 no engine invitation labels',
  !/Numerology|Tarot|Natal|Dream Engine|Persona/.test(read('src/components/cosmic/PatternGapTraces.tsx')) &&
    !/Numerology|Tarot|Natal|Dream Engine|Persona/.test(read('src/data/pattern-traces.ts')),
);
record('P2 composer placeholder', /PATTERN_GAP_PLACEHOLDER|Ne taşıyorsun\?/.test(chatPage));
record('P2 human trace pool', /tekrar/.test(read('src/data/pattern-traces.ts')) && /çelişki/.test(read('src/data/pattern-traces.ts')));

// ── P3 Tone ───────────────────────────────────────────────────────────
record('P3 greeting not assistant', !/yapay zekâ asistanıyım/.test(greeting));
record('P3 greeting equation', /Neye bakıyoruz\?/.test(greeting));
record('P3 who_are_you', /bağımsız işaretlerin nerede birleştiğini okurum/.test(style));
record('P3 identity axiom', /Tek işaret karar vermez/.test(identity));
record('P3 prompt not assistant label', !/yapay zekâ asistanısın/.test(promptLoader));
record('P3 signal honesty section', /Signal honesty/i.test(responseStyle));

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);

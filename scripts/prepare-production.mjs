/**
 * Prepare a clean production folder for Namecheap / VPS upload.
 *
 * Usage:
 *   node scripts/prepare-production.mjs
 *   node scripts/prepare-production.mjs --skip-build
 *
 * Output: release/atlas-v0.8-production/
 */
import { spawnSync } from 'child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'release', 'atlas-v0.8-production');
const skipBuild = process.argv.includes('--skip-build');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    process.exit(r.status || 1);
  }
}

console.log('[prepare-production] cleaning', OUT);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

if (!skipBuild) {
  console.log('[prepare-production] npm run build (same-origin API)…');
  // Do NOT set VITE_BACKEND_URL — production SPA uses same-origin /api
  run('npm', ['run', 'build']);
}

const distIndex = join(ROOT, 'dist', 'index.html');
if (!existsSync(distIndex)) {
  console.error('Missing dist/index.html — run build first');
  process.exit(1);
}

/** Copy tree excluding junk (do not skip nested source `data/` dirs under server/). */
function copyFiltered(src, dest, { excludeNames = [] } = {}) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    if (excludeNames.includes(name)) continue;
    if (name === 'node_modules' || name === '.git') continue;
    const from = join(src, name);
    const to = join(dest, name);
    const st = statSync(from);
    if (st.isDirectory()) {
      copyFiltered(from, to, { excludeNames });
    } else {
      cpSync(from, to);
    }
  }
}

console.log('[prepare-production] copying package manifests…');
cpSync(join(ROOT, 'package.json'), join(OUT, 'package.json'));
cpSync(join(ROOT, 'package-lock.json'), join(OUT, 'package-lock.json'));

console.log('[prepare-production] copying dist…');
cpSync(join(ROOT, 'dist'), join(OUT, 'dist'), { recursive: true });
if (existsSync(join(ROOT, 'public', 'robots.txt'))) {
  cpSync(join(ROOT, 'public', 'robots.txt'), join(OUT, 'dist', 'robots.txt'));
}

console.log('[prepare-production] copying server…');
copyFiltered(join(ROOT, 'server'), join(OUT, 'server'), {
  excludeNames: ['generated', 'node_modules'],
});
mkdirSync(join(OUT, 'server', 'generated'), { recursive: true });
writeFileSync(join(OUT, 'server', 'generated', '.gitkeep'), '');

console.log('[prepare-production] copying knowledge + runner…');
cpSync(join(ROOT, 'knowledge'), join(OUT, 'knowledge'), { recursive: true });
cpSync(join(ROOT, 'runner'), join(OUT, 'runner'), { recursive: true });

console.log('[prepare-production] data placeholders…');
const dataDirs = [
  'data',
  'data/logs',
  'data/telegram-media',
  'data/audio-jobs',
];
for (const d of dataDirs) {
  mkdirSync(join(OUT, d), { recursive: true });
  writeFileSync(join(OUT, d, '.gitkeep'), '');
}

console.log('[prepare-production] deploy helpers…');
mkdirSync(join(OUT, 'deploy', 'public_html'), { recursive: true });
if (existsSync(join(ROOT, 'deploy', 'public_html', '.htaccess'))) {
  cpSync(
    join(ROOT, 'deploy', 'public_html', '.htaccess'),
    join(OUT, 'deploy', 'public_html', '.htaccess'),
  );
}
cpSync(join(ROOT, 'dist', 'index.html'), join(OUT, 'deploy', 'public_html', 'index.html'));
if (existsSync(join(OUT, 'dist', 'robots.txt'))) {
  cpSync(join(OUT, 'dist', 'robots.txt'), join(OUT, 'deploy', 'public_html', 'robots.txt'));
}

const envExample = readFileSync(join(ROOT, '.env.example'), 'utf8');
const prodEnv = `${envExample}

# ═══ PRODUCTION (Namecheap / VPS) — fill on server, never commit ═══
NODE_ENV=production
PORT=3001
ATLAS_SERVE_FRONTEND=1
ATLAS_SECURE_COOKIES=true
# Must include your real https origin(s), comma-separated:
ATLAS_CORS_ORIGINS=https://YOURDOMAIN.com,https://www.YOURDOMAIN.com
FRONTEND_ORIGIN=https://YOURDOMAIN.com
# Same machine Telegram → API:
BACKEND_URL=http://127.0.0.1:3001
# ATLAS_INTERNAL_BOT_SECRET=generate-a-long-random-secret
# OPENAI_API_KEY=
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_ENABLE_POLLING=true
`;
writeFileSync(join(OUT, '.env.production.example'), prodEnv);

writeFileSync(
  join(OUT, 'README-DEPLOY.txt'),
  `Atlas v0.8 production package
Generated: ${new Date().toISOString()}

1. Upload this folder to the server app root (NOT into a messy public_html mix).
2. Copy .env.production.example → .env and fill secrets on the server.
3. npm ci --omit=dev   (or npm install --omit=dev)
4. Start API:   NODE_ENV=production node server/index.js
5. Start bot:   NODE_ENV=production node server/telegram.js   (separate process)
6. See docs/PRODUCTION-NAMECHEAP-DEPLOY.md in the source repo for full checklist.

Same-origin mode: browser loads dist via Express; API is /api on the same host.
Static-only alternative: upload deploy/public_html/* into public_html and point
VITE_BACKEND_URL at build time to your API URL (rebuild required).
`,
);

const size = statSync(join(OUT, 'dist', 'index.html')).size;
console.log(`[prepare-production] OK → ${OUT}`);
console.log(`[prepare-production] dist/index.html = ${size} bytes`);
console.log('[prepare-production] Next: zip release/atlas-v0.8-production and upload.');

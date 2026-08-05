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

console.log('[prepare-production] generating SEO files…');
run('node', ['scripts/generate-seo-files.mjs', '--out', 'public', '--out', 'dist']);

console.log('[prepare-production] copying dist…');
cpSync(join(ROOT, 'dist'), join(OUT, 'dist'), { recursive: true });
if (existsSync(join(ROOT, 'public', 'robots.txt'))) {
  cpSync(join(ROOT, 'public', 'robots.txt'), join(OUT, 'dist', 'robots.txt'));
}
if (existsSync(join(ROOT, 'public', 'sitemap.xml'))) {
  cpSync(join(ROOT, 'public', 'sitemap.xml'), join(OUT, 'dist', 'sitemap.xml'));
}

console.log('[prepare-production] copying server…');
copyFiltered(join(ROOT, 'server'), join(OUT, 'server'), {
  excludeNames: ['generated', 'node_modules'],
});
mkdirSync(join(OUT, 'server', 'generated'), { recursive: true });
writeFileSync(join(OUT, 'server', 'generated', '.gitkeep'), '');

/** Required for Google OAuth + session auth — fail package if any missing. */
const REQUIRED_AUTH_FILES = [
  'server/auth/index.js',
  'server/auth/google-oauth.js',
  'server/auth/cookie-config.js',
  'server/auth/account-store.js',
  'server/auth/session-service.js',
  'server/auth/session-store.js',
  'server/auth/auth-middleware.js',
  'server/auth/rate-limit.js',
  'server/auth/admin-audit.js',
  'server/auth/legacy-memory.js',
];
const REQUIRED_SERVER_FILES = [
  'server/index.js',
  'server/seo/index.js',
  'server/seo/public-routes.js',
  'server/seo/robots.js',
  'server/seo/sitemap.js',
  ...REQUIRED_AUTH_FILES,
];

console.log('[prepare-production] verifying Google OAuth / auth package contents…');
const missing = REQUIRED_SERVER_FILES.filter((rel) => !existsSync(join(OUT, rel)));
if (missing.length) {
  console.error('[prepare-production] MISSING required files:');
  for (const m of missing) console.error('  -', m);
  process.exit(1);
}

const authDir = join(OUT, 'server', 'auth');
const authListed = readdirSync(authDir).filter((n) => n.endsWith('.js')).sort();
const authExpected = REQUIRED_AUTH_FILES.map((p) => p.split('/').pop()).sort();
if (authListed.length < authExpected.length) {
  console.error('[prepare-production] server/auth incomplete:', authListed);
  process.exit(1);
}
for (const name of authExpected) {
  if (!authListed.includes(name)) {
    console.error(`[prepare-production] missing server/auth/${name}`);
    process.exit(1);
  }
}

// Import/export smoke check against the PACKAGE copy (not only workspace).
const exportCheck = spawnSync(
  'node',
  [join(ROOT, 'scripts', 'verify-production-auth-exports.mjs'), OUT],
  { cwd: ROOT, encoding: 'utf8', shell: false },
);
if (exportCheck.status !== 0) {
  console.error(exportCheck.stdout || '');
  console.error(exportCheck.stderr || '');
  console.error('[prepare-production] auth export verification failed');
  process.exit(exportCheck.status || 1);
}
if (exportCheck.stdout) process.stdout.write(exportCheck.stdout);

console.log('[prepare-production] auth files in package:');
for (const name of authListed) {
  console.log(`  ✓ server/auth/${name}`);
}

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
if (existsSync(join(ROOT, 'deploy', 'cpanel-google-oauth.env.txt'))) {
  cpSync(
    join(ROOT, 'deploy', 'cpanel-google-oauth.env.txt'),
    join(OUT, 'deploy', 'cpanel-google-oauth.env.txt'),
  );
}
if (existsSync(join(ROOT, 'deploy', 'FILE-MANAGER-503-FIX.txt'))) {
  cpSync(
    join(ROOT, 'deploy', 'FILE-MANAGER-503-FIX.txt'),
    join(OUT, 'deploy', 'FILE-MANAGER-503-FIX.txt'),
  );
}
cpSync(join(ROOT, 'dist', 'index.html'), join(OUT, 'deploy', 'public_html', 'index.html'));
if (existsSync(join(OUT, 'dist', 'robots.txt'))) {
  cpSync(join(OUT, 'dist', 'robots.txt'), join(OUT, 'deploy', 'public_html', 'robots.txt'));
}
if (existsSync(join(OUT, 'dist', 'sitemap.xml'))) {
  cpSync(join(OUT, 'dist', 'sitemap.xml'), join(OUT, 'deploy', 'public_html', 'sitemap.xml'));
}

writeFileSync(
  join(OUT, 'UPLOAD-GOOGLE-OAUTH.txt'),
  `cPanel File Manager — Google OAuth (minimum upload)

Upload these paths into the Node application root (overwrite):

  server/index.js
  server/auth/          ← entire folder (${authExpected.length} .js files)
  server/seo/           ← entire folder (prevents startup crash)

Then: Setup Node.js App → Restart

Test URLs:
  https://cosmicsimya.com/api/ai/health
  https://cosmicsimya.com/api/auth/google/status
  https://cosmicsimya.com/api/auth/google   (Accept: application/json)

Auth files packaged:
${authExpected.map((n) => `  - server/auth/${n}`).join('\n')}
`,
);

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
# Google OAuth (cPanel Environment Variables — same names):
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_REDIRECT_URI=https://YOURDOMAIN.com/api/auth/google/callback
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
   Or set the same keys in cPanel Node.js → Environment Variables.
3. Google OAuth: paste CLIENT_ID / CLIENT_SECRET (see deploy/cpanel-google-oauth.env.txt).
   Google Console redirect URI must be:
   https://cosmicsimya.com/api/auth/google/callback
4. npm ci --omit=dev   (or npm install --omit=dev)
5. Start API:   NODE_ENV=production node server/index.js
6. Start bot:   NODE_ENV=production node server/telegram.js   (separate process)
7. Verify: GET /api/auth/google/status → configured:true
8. See docs/PRODUCTION-NAMECHEAP-DEPLOY.md in the source repo for full checklist.

Same-origin mode: browser loads dist via Express; API is /api on the same host.
Static-only alternative: upload deploy/public_html/* into public_html and point
VITE_BACKEND_URL at build time to your API URL (rebuild required).
`,
);

const size = statSync(join(OUT, 'dist', 'index.html')).size;
console.log(`[prepare-production] OK → ${OUT}`);
console.log(`[prepare-production] dist/index.html = ${size} bytes`);

const zipPath = join(ROOT, 'release', 'atlas-v0.8-production-google-oauth.zip');
console.log('[prepare-production] creating ZIP…', zipPath);
rmSync(zipPath, { force: true });
const zip = spawnSync(
  'powershell',
  [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${OUT.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
  ],
  { cwd: ROOT, encoding: 'utf8' },
);
if (zip.status !== 0) {
  console.warn('[prepare-production] ZIP failed (folder still OK):', zip.stderr || zip.stdout);
} else {
  console.log(`[prepare-production] ZIP → ${zipPath}`);
}
console.log('[prepare-production] Next: upload folder or ZIP to cPanel app root.');

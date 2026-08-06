/**
 * Production auth UI + membership flow checks (API + headless screenshots).
 * Creates disposable test accounts and removes them from remote auth store via FTP.
 */
import { spawnSync } from 'child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp', 'auth-ui-verify');
mkdirSync(OUT, { recursive: true });

const BASE = 'https://cosmicsimya.com';
const results = [];

function log(msg) {
  console.log(msg);
  results.push(msg);
}

async function jarFetch(path, { method = 'GET', headers = {}, body, jar } = {}) {
  const jarPath = jar || join(OUT, 'cookies.txt');
  const outBody = join(OUT, `body-${Date.now()}.txt`);
  const args = [
    '-sS',
    '-c',
    jarPath,
    '-b',
    jarPath,
    '-o',
    outBody,
    '-w',
    '%{http_code}',
    '--max-time',
    '40',
    '-H',
    'Origin: https://cosmicsimya.com',
    '-H',
    'Accept: application/json',
  ];
  if (method !== 'GET') {
    args.push('-X', method);
  }
  for (const [k, v] of Object.entries(headers)) {
    args.push('-H', `${k}: ${v}`);
  }
  if (body != null) {
    const bodyFile = join(OUT, `req-${Date.now()}.json`);
    writeFileSync(bodyFile, body);
    args.push('-H', 'Content-Type: application/json; charset=utf-8');
    args.push('--data-binary', `@${bodyFile}`);
  }
  args.push(`${BASE}${path}`);
  const r = spawnSync('curl.exe', args, { encoding: 'utf8' });
  const status = Number(String(r.stdout || '').trim());
  const text = existsSync(outBody) ? readFileSync(outBody, 'utf8') : '';
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  return { status, text, json, jarPath };
}

// --- API membership flow ---
const email = `atlas-e2e-${Date.now()}@example.com`;
const password = 'TestPass123';

const s0 = await jarFetch('/api/auth/session');
log(`session_boot=${s0.status} csrf=${Boolean(s0.json?.csrfToken)} anon=${s0.json?.isAnonymous}`);
const csrf = s0.json?.csrfToken;
if (!csrf) {
  console.error('No CSRF');
  process.exit(1);
}

const reg = await jarFetch('/api/auth/register', {
  method: 'POST',
  headers: { 'X-Atlas-Csrf': csrf },
  body: JSON.stringify({
    email,
    password,
    passwordConfirm: password,
    displayName: 'E2E Test',
  }),
  jar: s0.jarPath,
});
log(`register=${reg.status} ok=${reg.json?.ok} roles=${JSON.stringify(reg.json?.roles)} email=${reg.json?.email}`);

const s1 = await jarFetch('/api/auth/session', { jar: s0.jarPath });
log(
  `session_after_register=${s1.status} auth=${s1.json?.authenticated} anon=${s1.json?.isAnonymous} method=${s1.json?.authMethod} email=${s1.json?.email}`,
);

const csrf2 = s1.json?.csrfToken || csrf;
const dup = await jarFetch('/api/auth/register', {
  method: 'POST',
  headers: { 'X-Atlas-Csrf': csrf2 },
  body: JSON.stringify({
    email,
    password,
    passwordConfirm: password,
  }),
  jar: s0.jarPath,
});
log(`duplicate_register=${dup.status} code=${dup.json?.code} error=${dup.json?.error}`);

const g = await jarFetch('/api/auth/google/status');
log(`google_status=${g.status} configured=${g.json?.configured} redirect=${g.json?.redirectUri}`);

const oauthStart = spawnSync(
  'curl.exe',
  [
    '-sS',
    '-o',
    NUL_PATH(),
    '-w',
    '%{http_code}|%{redirect_url}',
    '--max-time',
    '25',
    '-H',
    'Accept: text/html',
    `${BASE}/api/auth/oauth/start?returnOrigin=${encodeURIComponent(BASE)}`,
  ],
  { encoding: 'utf8' },
);
log(`oauth_start=${String(oauthStart.stdout || '').trim()}`);

function NUL_PATH() {
  return process.platform === 'win32' ? 'NUL' : '/dev/null';
}

// Verify UI source wiring markers in deployed HTML (singlefile)
const html = spawnSync(
  'curl.exe',
  ['-sS', '--max-time', '40', `${BASE}/`],
  { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 },
);
const page = html.stdout || '';
log(`home_html_bytes=${page.length}`);
log(`ui_has_portal_marker=${page.includes('atlas-auth-overlay') || page.includes('createPortal')}`);
log(`ui_has_register_api=${page.includes('/api/auth/register')}`);
log(`ui_has_oauth_start=${page.includes('/api/auth/oauth/start')}`);
log(`ui_has_maxheight_fix=${/100(dvh|vh)-32px|calc\(100/.test(page)}`);

writeFileSync(join(OUT, 'api-results.txt'), results.join('\n'));
writeFileSync(join(OUT, 'test-email.txt'), email);
console.log('API_DONE');
console.log('TEST_EMAIL=' + email);

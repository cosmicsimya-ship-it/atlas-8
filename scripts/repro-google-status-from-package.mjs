/**
 * Reproduce Google OAuth routes from the production package tree.
 * Uses package server sources + workspace node_modules.
 */
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PKG = join(ROOT, 'release', 'atlas-v0.8-production');

process.env.ATLAS_NO_LISTEN = '1';
process.env.NODE_ENV = 'production';
process.env.ATLAS_SERVE_FRONTEND = '0';
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.ATLAS_GOOGLE_CLIENT_ID = '';
process.env.ATLAS_GOOGLE_CLIENT_SECRET = '';
process.env.GOOGLE_REDIRECT_URI = 'https://cosmicsimya.com/api/auth/google/callback';
process.env.FRONTEND_ORIGIN = 'https://cosmicsimya.com';

const pkgIndex = join(PKG, 'server', 'index.js');
if (!existsSync(pkgIndex)) {
  console.error('Missing package:', pkgIndex);
  process.exit(1);
}

console.log('[repro] loading', pkgIndex);
const { app } = await import(pathToFileURL(pkgIndex).href);

app.use((err, req, res, _next) => {
  console.error('[repro] EXPRESS_ERROR', req.method, req.url);
  console.error(err?.stack || err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'express_error', message: String(err?.message || err) });
  }
});

const server = createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
console.log('[repro] listening', base);

async function hit(path, headers = {}) {
  try {
    const res = await fetch(`${base}${path}`, { headers });
    const text = await res.text();
    console.log(`[repro] ${path} => ${res.status}`);
    console.log(text.slice(0, 400));
    return { status: res.status, text };
  } catch (err) {
    console.error(`[repro] ${path} FETCH_FAIL`, err.stack || err);
    return { status: 0, text: String(err) };
  }
}

await hit('/api/ai/health');
await hit('/api/auth/google/status');
await hit('/api/auth/google', { Accept: 'application/json' });
await hit('/api/auth/session');

// Direct function call stack probe
try {
  const auth = await import(pathToFileURL(join(PKG, 'server', 'auth', 'index.js')).href);
  console.log('[repro] direct status', auth.getGoogleOAuthPublicStatus());
  console.log('[repro] resolveUri', auth.resolveGoogleRedirectUri());
} catch (err) {
  console.error('[repro] DIRECT_AUTH_FAIL');
  console.error(err.stack || err);
}

server.close();

/**
 * Verify Google OAuth auth exports inside a production package folder.
 * Usage: node scripts/verify-production-auth-exports.mjs [packageRoot]
 */
import { join, dirname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const pkgRoot = resolve(process.argv[2] || join(ROOT, 'release', 'atlas-v0.8-production'));

const authIndex = join(pkgRoot, 'server', 'auth', 'index.js');
if (!existsSync(authIndex)) {
  console.error('[verify-auth-exports] missing', authIndex);
  process.exit(1);
}

const httpModPath = join(pkgRoot, 'server', 'auth', 'google-oauth-http.js');
if (!existsSync(httpModPath)) {
  throw new Error('missing server/auth/google-oauth-http.js');
}

const mod = await import(pathToFileURL(authIndex).href);
const {
  getGoogleOAuthPublicStatus,
  resolveGoogleRedirectUri,
  beginGoogleOAuth,
  getGoogleOAuthConfig,
  mountGoogleOAuthRoutes,
} = mod;

if (typeof getGoogleOAuthPublicStatus !== 'function') {
  throw new Error('getGoogleOAuthPublicStatus not exported');
}
if (typeof resolveGoogleRedirectUri !== 'function') {
  throw new Error('resolveGoogleRedirectUri not exported');
}
if (typeof beginGoogleOAuth !== 'function') {
  throw new Error('beginGoogleOAuth not exported');
}
if (typeof getGoogleOAuthConfig !== 'function') {
  throw new Error('getGoogleOAuthConfig not exported');
}
if (typeof mountGoogleOAuthRoutes !== 'function') {
  throw new Error('mountGoogleOAuthRoutes not exported (need google-oauth-http.js)');
}

const status = getGoogleOAuthPublicStatus();
const uri = resolveGoogleRedirectUri();

if (typeof status?.configured !== 'boolean') throw new Error('bad status.configured');
if (typeof status?.redirectUriConfigured !== 'boolean') {
  throw new Error('bad redirectUriConfigured');
}
if (!('redirectUri' in status)) throw new Error('missing redirectUri');
if (typeof uri !== 'string' || !uri.includes('/api/auth/') || !uri.includes('/callback')) {
  throw new Error('bad redirect uri: ' + uri);
}

console.log(
  '[verify-auth-exports] OK',
  JSON.stringify({
    pkgRoot,
    uri,
    configured: status.configured,
    redirectUri: status.redirectUri,
  }),
);

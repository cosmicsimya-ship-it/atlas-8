/**
 * Quick sanity check for release/atlas-v0.8-production before deploy.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'release', 'atlas-v0.8-production');
const idxPath = join(root, 'server', 'index.js');
const authDir = join(root, 'server', 'auth');
const zipPath = join(root, '..', 'atlas-v0.8-production-google-oauth.zip');

if (!existsSync(idxPath)) {
  console.error('missing', idxPath);
  process.exit(1);
}

const idx = readFileSync(idxPath, 'utf8');
const noComments = idx.replace(/^\s*\/\/.*$/gm, '');
const authJs = existsSync(authDir)
  ? readdirSync(authDir).filter((f) => f.endsWith('.js')).sort()
  : [];
const go = readFileSync(join(authDir, 'google-oauth.js'), 'utf8');

const checks = {
  awaitImport: /\bawait\s+import\s*\(/.test(noComments),
  mountGoogle: idx.includes('mountGoogleOAuthRoutes'),
  staticSeo: /from\s+['"]\.\/seo\/index\.js['"]/.test(idx),
  httpMod: existsSync(join(authDir, 'google-oauth-http.js')),
  authCount: authJs.length,
  authJs,
  defaultOauthCb: go.includes('/api/auth/oauth/callback'),
  zipExists: existsSync(zipPath),
  zipBytes: existsSync(zipPath) ? statSync(zipPath).size : 0,
};

console.log(JSON.stringify(checks, null, 2));

if (
  checks.awaitImport ||
  !checks.mountGoogle ||
  !checks.staticSeo ||
  !checks.httpMod ||
  !checks.defaultOauthCb ||
  checks.authCount < 11
) {
  console.error('PACKAGE_FAIL');
  process.exit(1);
}

console.log('PACKAGE_OK');

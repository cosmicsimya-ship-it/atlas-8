/**
 * P0 CORS / origin allowlist unit checks (no HTTP server).
 * Run: node scripts/test-cors-origins.mjs
 */
import {
  normalizeOrigin,
  getAllowedOrigins,
  isAllowedOrigin,
} from '../server/auth/cookie-config.js';

let passed = 0;
let failed = 0;

function assert(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

console.log('=== CORS origin normalization ===\n');

assert('normalize trailing slash', normalizeOrigin('https://cosmicsimya.com/') === 'https://cosmicsimya.com');
assert('normalize exact', normalizeOrigin('https://www.cosmicsimya.com') === 'https://www.cosmicsimya.com');
assert('reject empty', normalizeOrigin('') === null);
assert('reject undefined', normalizeOrigin(undefined) === null);
assert('reject wildcard', normalizeOrigin('*') === null);
assert('reject garbage', normalizeOrigin('not a url') === null);
assert('reject ftp', normalizeOrigin('ftp://cosmicsimya.com') === null);

console.log('\n=== Allowlist (development NODE_ENV) ===\n');
delete process.env.NODE_ENV;
process.env.ATLAS_CORS_ORIGINS = 'http://localhost:5173';

assert('root production allowed', isAllowedOrigin('https://cosmicsimya.com'));
assert('www production allowed', isAllowedOrigin('https://www.cosmicsimya.com'));
assert('trailing slash allowed', isAllowedOrigin('https://cosmicsimya.com/'));
assert('localhost allowed', isAllowedOrigin('http://localhost:5173'));
assert('evil denied', !isAllowedOrigin('https://evil.example'));
assert('suffix spoof denied', !isAllowedOrigin('https://cosmicsimya.com.evil.example'));
assert('subdomain spoof denied', !isAllowedOrigin('https://evil.cosmicsimya.com'));
assert('http production denied by default list', !isAllowedOrigin('http://cosmicsimya.com'));
assert('missing origin helper false', !isAllowedOrigin(null));
assert('no wildcard in list', !getAllowedOrigins().includes('*'));

console.log('\n=== Allowlist (NODE_ENV=production) ===\n');
process.env.NODE_ENV = 'production';
process.env.ATLAS_CORS_ORIGINS = 'http://localhost:5173,https://cosmicsimya.com';

const prodList = getAllowedOrigins();
assert('production drops http localhost', !prodList.includes('http://localhost:5173'));
assert('production keeps https cosmicsimya', prodList.includes('https://cosmicsimya.com'));
assert('production keeps www', isAllowedOrigin('https://www.cosmicsimya.com'));
assert('production denies evil', !isAllowedOrigin('https://evil.example'));
assert('production denies suffix spoof', !isAllowedOrigin('https://cosmicsimya.com.evil.example'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

/**
 * Mobile primary nav IA — static regression (no browser).
 * Ensures Sembolik Analiz is not in mobile exposure; Lara Prime is; order is fixed;
 * symbolic direct route remains wired in App.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed += 1;
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

function read(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

console.log('\n=== Mobile nav IA ===\n');

const nav = read('src/components/cosmic/CosmicNav.tsx');
const app = read('src/App.tsx');
const page = read('src/pages/LaraPrimePage.tsx');
const symbolic = read('src/pages/SymbolicAnalysisPage.tsx');

ok('CosmicNav exists', Boolean(nav));
ok(
  'PRIMARY_NAV_PATHS exact order',
  Boolean(
    nav?.match(
      /PRIMARY_NAV_PATHS\s*=\s*\[\s*'\/'\s*,\s*'\/atlas'\s*,\s*'\/lara-prime'\s*,\s*'\/archive'\s*\]/,
    ),
  ),
);
ok('mobileItems = primaryItems', Boolean(nav?.includes('const mobileItems = primaryItems')));
ok(
  'symbolic not in PRIMARY_NAV_PATHS',
  Boolean(nav && !/PRIMARY_NAV_PATHS\s*=\s*\[[^\]]*analysis\/symbolic/.test(nav)),
);
ok('Sembolik remains in NAV_ITEMS catalog', Boolean(nav?.includes("label: 'Sembolik Analiz'") && nav?.includes("'/analysis/symbolic'")));
ok('Lara Prime accent + ✦', Boolean(nav?.includes("label: 'Lara Prime'") && nav?.includes('accent: true') && nav?.includes('✦')));
ok('no entitlement gate on nav item', Boolean(nav && !/entitlement|isPrime|plan\s*===/.test(nav)));
ok('exact active for atlas + lara-prime', Boolean(nav?.includes('EXACT_ACTIVE_PATHS') && nav?.includes("'/atlas'") && nav?.includes("'/lara-prime'")));
ok('desktop non-chat keeps full NAV_ITEMS', Boolean(nav?.includes('chatMode ? primaryItems : NAV_ITEMS')));
ok('desktop still can show Lara Prime via NAV_ITEMS', Boolean(nav?.includes("{ to: '/lara-prime', label: 'Lara Prime', accent: true }")));
ok('App route lara-prime', Boolean(app?.includes('path="lara-prime"') && app?.includes('LaraPrimePage')));
ok('App route analysis/symbolic', Boolean(app?.includes('path="analysis/symbolic"') && app?.includes('SymbolicAnalysisPage')));
ok('LaraPrimePage exists', Boolean(symbolic && page));
ok('guest auth return path', Boolean(page?.includes("rememberAuthReturnPath('/lara-prime')")));

console.log(`\nMobile nav result: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

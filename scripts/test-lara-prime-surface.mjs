/**
 * Lara Prime membership surface — static/code regression (no live payment).
 * Does not mutate repo; fails closed on missing wiring.
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

console.log('\n=== Lara Prime surface ===\n');

const page = read('src/pages/LaraPrimePage.tsx');
const app = read('src/App.tsx');
const nav = read('src/components/cosmic/CosmicNav.tsx');
const auth = read('src/components/cosmic/AuthSessionControl.tsx');
const authReq = read('src/utils/atlas-auth-request.ts');
const billing = read('src/services/atlas-billing.ts');
const result = read('src/pages/BillingResultPage.tsx');
const landing = read('src/data/landing-content.ts');
const caps = read('server/entitlements/capabilities.js');
const pricing = read('server/entitlements/pricing.js');

ok('LaraPrimePage exists', Boolean(page));
ok('route lara-prime in App', Boolean(app?.includes('path="lara-prime"') && app?.includes('LaraPrimePage')));
ok('HashRouter single router', Boolean(app?.includes('HashRouter') && !app?.match(/BrowserRouter|createBrowserRouter/)));
ok('mobile/desktop CosmicNav Lara Prime', Boolean(nav?.includes("label: 'Lara Prime'") && nav?.includes('/lara-prime') && nav?.includes('✦')));
ok('primary nav includes lara-prime', Boolean(nav?.includes("PRIMARY_NAV_PATHS") && nav?.includes("'/lara-prime'")));
ok(
  'primary nav order Ana Sayfa→Atlas→Lara Prime→Arşiv',
  Boolean(
    nav?.match(
      /PRIMARY_NAV_PATHS\s*=\s*\[\s*'\/'\s*,\s*'\/atlas'\s*,\s*'\/lara-prime'\s*,\s*'\/archive'\s*\]/,
    ),
  ),
);
ok(
  'mobile keeps Lara Prime purchase path without symbolic primary',
  Boolean(
    nav &&
      !/PRIMARY_NAV_PATHS\s*=\s*\[[^\]]*analysis\/symbolic/.test(nav) &&
      (nav.includes('mobileItems = primaryItems') ||
        nav.includes("to: '/lara-prime', label: 'Lara Prime'")) &&
      !/const mobileItems[\s\S]{0,900}analysis\/symbolic/.test(nav),
  ),
);
ok('exact-active includes lara-prime + atlas', Boolean(nav?.includes("'/lara-prime'") && nav?.includes('EXACT_ACTIVE_PATHS') && nav?.includes("'/atlas'")));
ok('landing nav Lara Prime', Boolean(landing?.includes("label: 'Lara Prime'") && landing?.includes("'/lara-prime'")));
ok('guest auth return remember path', Boolean(page?.includes("rememberAuthReturnPath('/lara-prime')") && page?.includes('requestAtlasAuth')));
ok('auth consume return path', Boolean(auth?.includes('consumeAuthReturnPath') && authReq?.includes('consumeAuthReturnPath')));
ok('open-redirect guard', Boolean(authReq?.includes("v.startsWith('//')") && authReq?.includes("includes('://')")));
ok('checkout startPremiumCheckout', Boolean(page?.includes('startPremiumCheckout')));
ok('POST /api/billing/checkout client', Boolean(billing?.includes("'/api/billing/checkout'") && billing?.includes("method: 'POST'")));
ok('GET /api/billing/config client', Boolean(billing?.includes("'/api/billing/config'")));
ok('page uses fetchBillingConfig displayPrice', Boolean(page?.includes('fetchBillingConfig') && page?.includes('displayPrice')));
ok('Prime hides purchase via isPrime branch', Boolean(page?.includes('isPrime') && page?.includes('Üyeliğin aktif')));
ok('CTA label Lara Prime’a Geç', Boolean(page?.includes('Lara Prime’a Geç') || page?.includes("Lara Prime'a Geç")));
ok('BillingResult active copy', Boolean(result?.includes("title: 'Aktivasyon tamamlandı'")));
ok('BillingResult entitlement authority', Boolean(result?.includes('isPremiumPlan') && result?.includes('hintFromQuery') && result?.includes('Never promote query success')));
ok('internal plan premium', Boolean(caps?.includes("PREMIUM: 'premium'") && page?.includes("plan === 'premium'")));
ok('capability voice.lara', Boolean(caps?.includes("VOICE_LARA: 'voice.lara'") && page?.includes("voice.lara")));
ok('capability usage.extended', Boolean(caps?.includes("USAGE_EXTENDED: 'usage.extended'")));
ok('capability image.analysis', Boolean(caps?.includes("IMAGE_ANALYSIS: 'image.analysis'")));
ok('capability memory.extended', Boolean(caps?.includes("MEMORY_EXTENDED: 'memory.extended'")));
ok('default productName Lara Prime', Boolean(pricing?.includes("'Lara Prime'")));
ok('no unsupported marketing on page', Boolean(page && !/higher limits|early access|advanced memory|priority processing|exclusive engines|unlimited usage|BEST VALUE/i.test(page)));
ok(
  'account links to Lara Prime purchase or Prime app',
  Boolean(
    auth?.includes('/lara-prime') &&
      (auth.includes('to="/lara-prime"') || /to=\{[\s\S]*?\/lara-prime/.test(auth)),
  ),
);

console.log(`\nLara Prime result: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);

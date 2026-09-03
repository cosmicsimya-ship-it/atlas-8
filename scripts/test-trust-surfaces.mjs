/**
 * Trust / legal / support foundation — static/code regression.
 * Mirrors scripts/test-lara-prime-surface.mjs's style: reads source files
 * as text and asserts wiring, without executing React or hitting a server.
 * Run: node scripts/test-trust-surfaces.mjs
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

console.log('\n=== Trust / legal / support surface ===\n');

const app = read('src/App.tsx');
const footer = read('src/components/landing/SiteFooter.tsx');
const landing = read('src/data/landing-content.ts');
const trustContent = read('src/data/trust-content.ts');
const laraPrime = read('src/pages/LaraPrimePage.tsx');
const about = read('src/pages/AboutPage.tsx');
const contactForm = read('src/components/trust/ContactForm.tsx');
const trustShell = read('src/components/trust/TrustPageShell.tsx');
const operatorConfigServer = read('server/config/operator-config.js');
const contactStoreServer = read('server/contact/store.js');
const serverIndex = read('server/index.js');

const PAGES = [
  ['src/pages/ContactPage.tsx', 'iletisim'],
  ['src/pages/SupportPage.tsx', 'destek'],
  ['src/pages/PrivacyPolicyPage.tsx', 'gizlilik'],
  ['src/pages/MembershipTermsPage.tsx', 'uyelik-sozlesmesi'],
  ['src/pages/RefundCancellationPage.tsx', 'iade-iptal'],
  ['src/pages/FAQPage.tsx', 'sss'],
];

for (const [file, routePath] of PAGES) {
  const content = read(file);
  ok(`${file} exists`, Boolean(content));
  ok(`App.tsx registers route "${routePath}"`, Boolean(app) && new RegExp(`path="${routePath}"`).test(app));
}

// Routes must be public — not nested inside the AppLayout ops-shell wrapper.
if (app) {
  const opsShellBlock = app.slice(app.indexOf('<Route element={<AppLayout'), app.indexOf('<Route path="*"'));
  for (const [, routePath] of PAGES) {
    ok(`"${routePath}" route is NOT nested inside the internal AppLayout shell`, !opsShellBlock.includes(`path="${routePath}"`));
  }
}

// Footer — dedicated legal/support nav row, separate from product nav.
ok('landing-content.ts defines landingFooter.legalLinks', Boolean(landing) && /legalLinks:\s*\[/.test(landing));
for (const [, routePath] of PAGES) {
  ok(`landingFooter.legalLinks includes "/${routePath}"`, Boolean(landing) && landing.includes(`to: '/${routePath}'`));
}
ok('SiteFooter renders legalLinks in its own nav row', Boolean(footer) && footer.includes('legalLinks') && /aria-label="Yasal ve destek"/.test(footer));

// Old About-page anchors must redirect, not duplicate legal text.
ok('AboutPage redirects legacy #gizlilik/#sartlar/#iletisim anchors to dedicated pages', Boolean(about) && about.includes('LEGACY_ANCHOR_REDIRECT'));
ok('AboutPage no longer duplicates inline Terms text', Boolean(about) && !about.includes('tıbbi, hukuki veya finansal tavsiye'));
ok('AboutPage no longer duplicates inline Privacy text', Boolean(about) && !about.includes('Oturum çerezleri HttpOnly olarak saklanır'));

// Lara Prime sales page — trust-link integration only (no redesign check needed
// beyond confirming the links exist), plus a renewal/cancellation disclosure.
ok('LaraPrimePage links to Üyelik Sözleşmesi', Boolean(laraPrime) && laraPrime.includes('to="/uyelik-sozlesmesi"'));
ok('LaraPrimePage links to İade ve İptal', Boolean(laraPrime) && laraPrime.includes('to="/iade-iptal"'));
ok('LaraPrimePage links to Gizlilik / KVKK', Boolean(laraPrime) && laraPrime.includes('to="/gizlilik"'));
ok('LaraPrimePage links to SSS', Boolean(laraPrime) && laraPrime.includes('to="/sss"'));
ok('LaraPrimePage links to Destek', Boolean(laraPrime) && laraPrime.includes('to="/destek"'));
ok('LaraPrimePage discloses auto-renewal/cancellation near the CTA', Boolean(laraPrime) && laraPrime.includes('Aylık otomatik yenilenir'));
// Superseded by the public sales-page rebuild task: the hero was intentionally
// rebalanced (calmer scale, no giant gold field). Verify the new invariants
// instead — checkout logic intact, no old oversized/gold-heavy hero markup.
ok('LaraPrimePage still drives real checkout (startPremiumCheckout, entitlements)', Boolean(laraPrime) && laraPrime.includes('startPremiumCheckout') && laraPrime.includes('isPremiumPlan'));
ok('LaraPrimePage hero headline scale was reduced (no old 6.3rem clamp)', Boolean(laraPrime) && !laraPrime.includes('clamp(3rem,8vw,6.3rem)'));
ok('LaraPrimePage no longer has a large detached gold hero blob', Boolean(laraPrime) && !laraPrime.includes('rgba(201,179,122,0.08)_0%,rgba(201,179,122,0.025)'));
ok('LaraPrimePage separates available-now vs coming-next transparently', Boolean(laraPrime) && laraPrime.includes('AVAILABLE_NOW') && laraPrime.includes('COMING_NEXT'));
ok('LaraPrimePage presents the four-pillar architecture', Boolean(laraPrime) && ['My Prime', 'Frequency Library', 'Prime Rooms'].every((p) => laraPrime.includes(p)));
ok('LaraPrimePage renders a page-level SiteFooter (legal/social links)', Boolean(laraPrime) && laraPrime.includes('<SiteFooter'));

// Contact form — real backend path, honeypot bot defense, no hardcoded identity.
ok('ContactForm posts to the real backend via submitContactMessage', Boolean(contactForm) && contactForm.includes('submitContactMessage'));
ok('ContactForm has a honeypot field hidden from real users', Boolean(contactForm) && contactForm.includes('tabIndex={-1}') && contactForm.includes('aria-hidden="true"'));
ok('ContactForm success state does NOT claim an email was sent', Boolean(contactForm) && !/e-posta.{0,20}gönderildi/i.test(contactForm) && contactForm.includes('otomatik bir e-posta'));

// Operator/support identity — server-side, env-driven, never invented.
ok('server/config/operator-config.js exists', Boolean(operatorConfigServer));
ok(
  'operator-config.js is decoupled from the owner/admin bootstrap identity',
  Boolean(operatorConfigServer) &&
    !operatorConfigServer.includes("from '../auth/account-store.js'") &&
    !operatorConfigServer.includes('ATLAS_OWNER_EMAIL'),
);
ok('operator-config.js reads supportEmail from env, never hardcodes a domain', Boolean(operatorConfigServer) && operatorConfigServer.includes("nonEmpty(process.env.ATLAS_SUPPORT_EMAIL)") && !/['"`][\w.-]+@[\w.-]+\.\w+['"`]/.test(operatorConfigServer));
ok('server/contact/store.js exists (real persistence, not a fake form)', Boolean(contactStoreServer));
ok('contact store validates email format server-side', Boolean(contactStoreServer) && contactStoreServer.includes('EMAIL_PATTERN'));
ok('contact store implements a silent honeypot drop (no signal to bots)', Boolean(contactStoreServer) && contactStoreServer.includes('dropped: true'));

// Server routes — public config, public submission, admin triage.
ok('server/index.js exposes GET /api/public/operator', Boolean(serverIndex) && serverIndex.includes("'/api/public/operator'"));
ok('server/index.js exposes POST /api/contact', Boolean(serverIndex) && serverIndex.includes("'/api/contact'"));
ok('server/index.js exposes GET /api/admin/contact (admin-only)', Boolean(serverIndex) && serverIndex.includes("'/api/admin/contact'"));
ok('server/index.js gates admin contact routes with requireRole(\'admin\')', Boolean(serverIndex) && /\/api\/admin\/contact[\s\S]{0,300}requireRole\('admin'\)/.test(serverIndex));
ok('POST /api/contact does not require login (createAnonymous: true)', Boolean(serverIndex) && /app\.post\(\s*'\/api\/contact'[\s\S]{0,200}createAnonymous:\s*true/.test(serverIndex));

// Leak guard — the owner/admin bootstrap email must never appear as a
// public-facing support identity anywhere in client-shipped source.
const CLIENT_SOURCE_FILES = [
  'src/pages/ContactPage.tsx',
  'src/pages/SupportPage.tsx',
  'src/pages/PrivacyPolicyPage.tsx',
  'src/pages/MembershipTermsPage.tsx',
  'src/pages/RefundCancellationPage.tsx',
  'src/pages/FAQPage.tsx',
  'src/data/trust-content.ts',
  'src/services/atlas-operator-config.ts',
  'src/services/atlas-contact.ts',
];
for (const file of CLIENT_SOURCE_FILES) {
  const content = read(file);
  ok(`${file} does not hardcode the owner/admin bootstrap email`, Boolean(content) && !content.includes('cosmicsimya@gmail.com'));
}

// Shared shell exists (design-system reuse, not a bespoke look).
ok('TrustPageShell reuses CosmicShell (no new visual system)', Boolean(trustShell) && trustShell.includes('CosmicShell'));

console.log(`\n=== Trust/legal/support surface: ${passed}/${passed + failed} passed ===\n`);
if (failed > 0) process.exit(1);

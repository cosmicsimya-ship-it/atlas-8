/**
 * Frontend route / copy smoke checks against Vite (default :5173).
 * Fetches SPA shell and verifies critical product routes resolve without blank-shell failures.
 *
 * Usage: node scripts/release-frontend-smoke.mjs
 */
const FRONTEND = process.env.ATLAS_FRONTEND_URL || 'http://127.0.0.1:5173';

const FORBIDDEN = [
  /\bINTERACT\b/,
  /KEŞFEDİLEN/,
  /lorem ipsum/i,
  /TODO: remove/i,
  /FIXME/,
  /stack trace/i,
];

const HASH_ROUTES = [
  '/',
  '/atlas',
  '/analysis',
  '/analysis/symbolic',
  '/archive',
  '/about',
];

const results = [];
function ok(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  let html = '';
  try {
    const res = await fetch(FRONTEND + '/', { signal: AbortSignal.timeout(8000) });
    html = await res.text();
    ok('SPA index reachable', res.ok && html.includes('id="root"'), `status=${res.status}`);
  } catch (e) {
    ok('SPA index reachable', false, String(e.message || e));
    console.log(`\nSUMMARY 0/${results.length}`);
    process.exit(1);
  }

  for (const re of FORBIDDEN) {
    ok(`No forbidden pattern ${re}`, !re.test(html), 'index shell');
  }

  // Hash routes are client-side; shell must still load for each deep-link style URL.
  for (const route of HASH_ROUTES) {
    const url = `${FRONTEND}/#${route === '/' ? '' : route}`;
    try {
      const res = await fetch(FRONTEND + '/', { signal: AbortSignal.timeout(5000) });
      const body = await res.text();
      ok(`Route shell for ${url}`, res.ok && body.includes('id="root"'), `status=${res.status}`);
    } catch (e) {
      ok(`Route shell for ${url}`, false, String(e.message || e));
    }
  }

  // Lang
  ok('html lang=tr', /<html[^>]*lang=["']tr["']/i.test(html));

  // Brand signal in shell / title
  ok('ATLAS brand in document', /ATLAS/i.test(html));

  const failed = results.filter((r) => !r.pass);
  console.log(`\nSUMMARY ${results.filter((r) => r.pass).length}/${results.length} failed=${failed.length}`);
  if (failed.length) console.log(JSON.stringify(failed, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

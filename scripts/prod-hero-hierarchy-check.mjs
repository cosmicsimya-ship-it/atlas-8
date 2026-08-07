/**
 * Production hero hierarchy screenshots (mobile + desktop).
 * Run: node scripts/prod-hero-hierarchy-check.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROD_URL || 'https://cosmicsimya.com/';
const OUT = join(process.cwd(), 'tmp', 'prod-hero-verify');
mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
];

const MARKERS = [
  'Her şey zaten ortada',
  'Mesele nasıl okuduğun',
  'Tek cevap aramaz',
  'Denklem kurar',
];

const browser = await chromium.launch({ headless: true });
const report = [];

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    locale: 'tr-TR',
  });
  const page = await context.newPage();
  const row = { viewport: vp.name, ok: true, notes: [], markers: {}, hierarchy: null };
  try {
    await page.goto(`${BASE}?v=${Date.now()}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(1500);

    const bodyText = await page.locator('body').innerText();
    for (const m of MARKERS) {
      row.markers[m] = bodyText.includes(m);
      if (!row.markers[m]) {
        row.ok = false;
        row.notes.push(`missing: ${m}`);
      }
    }

    const h1 = await page.locator('#landing-hero-title').innerText().catch(() => '');
    row.h1 = h1.replace(/\s+/g, ' ').trim();
    const manifestoInH1 =
      /Her şey zaten ortada/i.test(h1) && /Mesele nasıl okuduğun/i.test(h1);
    const methodNotInH1 = !/Tek cevap aramaz/i.test(h1);
    row.hierarchy = {
      manifestoInH1,
      methodNotInH1,
      methodVisible: /Tek cevap aramaz/i.test(bodyText) && /Denklem kurar/i.test(bodyText),
    };
    if (!manifestoInH1 || !methodNotInH1 || !row.hierarchy.methodVisible) {
      row.ok = false;
      row.notes.push('hierarchy fail');
    }

    const overflowX = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 2;
    });
    row.overflowX = overflowX;
    if (overflowX) {
      row.ok = false;
      row.notes.push('horizontal overflow');
    }

    const shot = join(OUT, `${vp.name}-hero.png`);
    await page.screenshot({ path: shot, fullPage: false });
    row.screenshot = shot;
  } catch (err) {
    row.ok = false;
    row.notes.push(String(err?.message || err));
  }
  report.push(row);
  await context.close();
}

await browser.close();
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
for (const r of report) {
  console.log(
    `${r.ok ? 'PASS' : 'FAIL'} ${r.viewport} h1="${r.h1}" overflowX=${r.overflowX} notes=${r.notes.join('; ') || '-'} shot=${r.screenshot}`,
  );
}
if (report.some((r) => !r.ok)) process.exit(1);
console.log('ALL_VIEWPORTS_OK');

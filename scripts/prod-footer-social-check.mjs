/**
 * Production footer social link smoke at key widths.
 * Run: node scripts/prod-footer-social-check.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.PROD_URL || 'https://cosmicsimya.com/';
const widths = [320, 390, 768, 1440];

const browser = await chromium.launch({ headless: true });
let failed = 0;
for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'tr-TR' });
  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    const ig = page.locator('footer a[href*="instagram.com/cosmicsimya"]').first();
    const tg = page.locator('footer a[href*="t.me/cosmicsimya"]').first();
    const igVis = await ig.isVisible();
    const tgVis = await tg.isVisible();
    const igBox = igVis ? await ig.boundingBox() : null;
    const tgBox = tgVis ? await tg.boundingBox() : null;
    const overflow =
      (igBox && (igBox.x < 0 || igBox.x + igBox.width > width + 2)) ||
      (tgBox && (tgBox.x < 0 || tgBox.x + tgBox.width > width + 2));
    const igRel = igVis ? await ig.getAttribute('rel') : '';
    const tgRel = tgVis ? await tg.getAttribute('rel') : '';
    const igTarget = igVis ? await ig.getAttribute('target') : '';
    const tgTarget = tgVis ? await tg.getAttribute('target') : '';
    const ok =
      igVis &&
      tgVis &&
      !overflow &&
      Boolean(igRel?.includes('noopener')) &&
      Boolean(tgRel?.includes('noopener')) &&
      igTarget === '_blank' &&
      tgTarget === '_blank';
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${width}px ig=${igVis} tg=${tgVis} overflow=${Boolean(overflow)} rel_ok=${igRel?.includes('noopener') && tgRel?.includes('noopener')} target=${igTarget}/${tgTarget}`,
    );
    if (!ok) failed += 1;
  } catch (e) {
    console.log(`FAIL ${width}px ${e.message}`);
    failed += 1;
  }
  await context.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;

/**
 * Production responsive smoke for Cosmic Simya auth UI.
 * Run: node scripts/prod-responsive-check.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROD_URL || 'https://cosmicsimya.com/';
const OUT = join(process.cwd(), 'tmp', 'prod-responsive');
mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '393x852', width: 393, height: 852 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

const results = [];

const browser = await chromium.launch({ headless: true });
for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    locale: 'tr-TR',
  });
  const page = await context.newPage();
  const row = { viewport: vp.name, ok: true, notes: [] };
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1200);

    const giris = page.getByRole('button', { name: /Giriş/i }).first();
    const uyeOl = page.getByRole('button', { name: /Üye Ol/i }).first();
    const girisVisible = await giris.isVisible().catch(() => false);
    const uyeVisible = await uyeOl.isVisible().catch(() => false);
    if (!girisVisible) {
      row.ok = false;
      row.notes.push('Giriş not visible');
    }
    if (!uyeVisible) {
      row.ok = false;
      row.notes.push('Üye Ol not visible');
    }

    await page.screenshot({ path: join(OUT, `${vp.name}-header.png`), fullPage: false });

    if (uyeVisible) {
      await uyeOl.click();
      await page.waitForTimeout(600);
      const dialog = page.locator('[role="dialog"]').first();
      const dialogVisible = await dialog.isVisible().catch(() => false);
      if (!dialogVisible) {
        row.ok = false;
        row.notes.push('modal not visible');
      } else {
        const box = await dialog.boundingBox();
        if (box) {
          if (box.y < -2) {
            row.ok = false;
            row.notes.push(`modal top offscreen y=${box.y.toFixed(1)}`);
          }
          if (box.y + box.height > vp.height + 4) {
            // Allowed if dialog scrolls internally — check overflow style
            const overflowY = await dialog.evaluate((el) => getComputedStyle(el).overflowY);
            const maxH = await dialog.evaluate((el) => getComputedStyle(el).maxHeight);
            row.notes.push(`modal extends past viewport; overflowY=${overflowY} maxHeight=${maxH}`);
            if (overflowY !== 'auto' && overflowY !== 'scroll' && !String(maxH).includes('dvh') && !String(maxH).includes('px')) {
              row.ok = false;
            }
            // Prefer: dialog itself within flex column with internal scroll
            const scrollChild = await dialog.locator('.overflow-y-auto').count();
            if (scrollChild === 0 && box.height > vp.height) {
              row.ok = false;
              row.notes.push('no internal scroll region');
            }
          }
          row.notes.push(`box=${Math.round(box.width)}x${Math.round(box.height)}@${Math.round(box.x)},${Math.round(box.y)}`);
        }
        const closeBtn = dialog.getByRole('button', { name: /Kapat/i });
        if (!(await closeBtn.isVisible().catch(() => false))) {
          row.ok = false;
          row.notes.push('close button missing');
        }
      }
      await page.screenshot({ path: join(OUT, `${vp.name}-modal.png`), fullPage: false });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  } catch (err) {
    row.ok = false;
    row.notes.push(String(err?.message || err));
  }
  results.push(row);
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${vp.name} — ${row.notes.join('; ') || 'ok'}`);
  await context.close();
}
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;

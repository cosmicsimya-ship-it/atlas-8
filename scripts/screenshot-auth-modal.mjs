import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp', 'auth-ui-verify');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const sizes = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

for (const s of sizes) {
  const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
  await page.goto('https://cosmicsimya.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);

  if (s.width < 768) {
    const menu = page.getByRole('button', { name: /Menüyü aç|Menuyu ac|Menü/i });
    if ((await menu.count()) > 0) {
      await menu.first().click();
      await page.waitForTimeout(400);
    }
  }

  const uye = page.getByRole('button', { name: /Üye ol|Uye ol/i });
  await uye.first().click({ timeout: 15000 });
  await page.waitForTimeout(600);

  const emailUye = page.getByRole('button', { name: /E-posta ile Üye Ol|E-posta ile Uye Ol/i });
  if ((await emailUye.count()) > 0) {
    await emailUye.first().click();
    await page.waitForTimeout(400);
  }

  const dialog = page.locator('[role=dialog]');
  await dialog.waitFor({ state: 'visible', timeout: 15000 });
  const box = await dialog.boundingBox();
  const overlayCount = await page.locator('.atlas-auth-overlay').count();
  console.log(JSON.stringify({ size: s.name, overlayCount, box }));

  await page.screenshot({ path: join(out, `${s.name}-modal.png`), fullPage: false });

  const checks = {
    title: await dialog.getByRole('heading').isVisible(),
    google: await dialog.getByRole('button', { name: /Google/i }).isVisible(),
    close: await dialog.getByRole('button', { name: /Kapat/i }).isVisible(),
    email: await dialog.locator('input').first().isVisible(),
  };
  console.log(`visible_${s.name}`, JSON.stringify(checks));

  const inView =
    box &&
    box.y >= -1 &&
    box.x >= -1 &&
    box.y + Math.min(box.height, s.height) <= s.height + 4;
  console.log(`in_viewport_${s.name}`, inView, 'h=', box?.height);

  await page.close();
}

await browser.close();
console.log('SCREENSHOTS_OK');

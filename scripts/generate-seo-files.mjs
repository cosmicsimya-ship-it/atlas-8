/**
 * Write static robots.txt + sitemap.xml into public/ (and optionally dist/)
 * so Mod B static hosting and Vite copy work without the Node SEO routes.
 *
 * Usage:
 *   node scripts/generate-seo-files.mjs
 *   node scripts/generate-seo-files.mjs --out dist
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildRobotsTxt } from '../server/seo/robots.js';
import { buildSitemapXml } from '../server/seo/sitemap.js';
import { resolveSiteOrigin } from '../server/seo/public-routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const outArgs = [];
for (let i = 0; i < process.argv.length; i += 1) {
  if (process.argv[i] === '--out' && process.argv[i + 1]) {
    outArgs.push(process.argv[i + 1]);
  }
}
if (outArgs.length === 0) outArgs.push('public');

const origin = resolveSiteOrigin(process.env.FRONTEND_ORIGIN || process.env.SITE_ORIGIN);
const robots = buildRobotsTxt({ origin });
const sitemap = buildSitemapXml({ origin });

for (const rel of outArgs) {
  const dir = join(ROOT, rel);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'robots.txt'), robots, 'utf8');
  writeFileSync(join(dir, 'sitemap.xml'), sitemap, 'utf8');
  console.log(`[generate-seo-files] wrote ${rel}/robots.txt + ${rel}/sitemap.xml (${origin})`);
}

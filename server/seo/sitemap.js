import {
  PUBLIC_SEO_ROUTES,
  resolveSiteOrigin,
  toSitemapLoc,
} from './public-routes.js';

/**
 * @param {object} [options]
 * @param {string} [options.origin]
 * @param {Date|string} [options.lastmod]
 * @param {typeof PUBLIC_SEO_ROUTES} [options.routes]
 * @returns {string}
 */
export function buildSitemapXml(options = {}) {
  const origin = resolveSiteOrigin(options.origin);
  const routes = options.routes || PUBLIC_SEO_ROUTES;
  const lastmodDate = options.lastmod ? new Date(options.lastmod) : new Date();
  const lastmod = Number.isNaN(lastmodDate.getTime())
    ? new Date().toISOString().slice(0, 10)
    : lastmodDate.toISOString().slice(0, 10);

  const urls = routes
    .map((route) => {
      const loc = escapeXml(toSitemapLoc(origin, route.path));
      const changefreq = escapeXml(route.changefreq || 'weekly');
      const priority =
        typeof route.priority === 'number' ? route.priority.toFixed(1) : '0.5';
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

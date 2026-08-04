import { buildRobotsTxt } from './robots.js';
import { buildSitemapXml } from './sitemap.js';
import { resolveSiteOrigin } from './public-routes.js';

/**
 * Mount public SEO endpoints (always available — not gated on frontend serve).
 * @param {import('express').Express} app
 */
export function mountSeoRoutes(app) {
  app.get('/sitemap.xml', (_req, res) => {
    const xml = buildSitemapXml({ origin: resolveSiteOrigin() });
    res
      .status(200)
      .type('application/xml')
      .set('Cache-Control', 'public, max-age=3600')
      .send(xml);
  });

  app.get('/robots.txt', (_req, res) => {
    const body = buildRobotsTxt({ origin: resolveSiteOrigin() });
    res
      .status(200)
      .type('text/plain')
      .set('Cache-Control', 'public, max-age=3600')
      .send(body);
  });
}

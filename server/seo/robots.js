import { resolveSiteOrigin } from './public-routes.js';

/**
 * @param {object} [options]
 * @param {string} [options.origin]
 * @returns {string}
 */
export function buildRobotsTxt(options = {}) {
  const origin = resolveSiteOrigin(options.origin);
  // Always emit a concrete sitemap URL — never an empty "Sitemap:" line.
  const sitemapUrl = `${origin}/sitemap.xml`;
  return `User-agent: *
Allow: /

# API and internal app surfaces
Disallow: /api/
Disallow: /admin
Disallow: /dashboard
Disallow: /agents
Disallow: /workflows
Disallow: /produce
Disallow: /queue
Disallow: /channels
Disallow: /arsenal
Disallow: /assets
Disallow: /memory
Disallow: /analytics
Disallow: /settings

Sitemap: ${sitemapUrl}
`;
}

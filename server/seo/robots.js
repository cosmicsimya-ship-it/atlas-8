import { resolveSiteOrigin } from './public-routes.js';

/**
 * @param {object} [options]
 * @param {string} [options.origin]
 * @returns {string}
 */
export function buildRobotsTxt(options = {}) {
  const origin = resolveSiteOrigin(options.origin);
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

Sitemap: ${origin}/sitemap.xml
`;
}

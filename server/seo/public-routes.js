/**
 * Public, indexable site routes — single source of truth for sitemap.xml.
 *
 * When you add a new public marketing/product page, append it here.
 * Sitemap locs use clean paths (https://host/about). The SPA fallback +
 * path→hash bootstrap in main.tsx map those onto HashRouter routes.
 *
 * Do NOT list auth-gated or internal surfaces (admin, dashboard, agents, …).
 */

/** @typedef {{ path: string, changefreq?: string, priority?: number }} SeoRoute */

/** @type {SeoRoute[]} */
export const PUBLIC_SEO_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: 1.0 },
  { path: '/about', changefreq: 'monthly', priority: 0.8 },
  { path: '/atlas', changefreq: 'weekly', priority: 0.9 },
  { path: '/analysis', changefreq: 'weekly', priority: 0.8 },
  { path: '/analysis/symbolic', changefreq: 'weekly', priority: 0.8 },
  { path: '/archive', changefreq: 'weekly', priority: 0.7 },
];

export const DEFAULT_SITE_ORIGIN = 'https://cosmicsimya.com';

/**
 * @param {string} [origin]
 * @returns {string}
 */
export function resolveSiteOrigin(origin) {
  const raw = String(origin || process.env.FRONTEND_ORIGIN || process.env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN)
    .trim()
    .replace(/\/$/, '');
  return raw || DEFAULT_SITE_ORIGIN;
}

/**
 * @param {string} siteOrigin
 * @param {string} routePath
 * @returns {string}
 */
export function toSitemapLoc(siteOrigin, routePath) {
  const origin = resolveSiteOrigin(siteOrigin);
  const path = routePath === '/' ? '/' : String(routePath || '/');
  if (path === '/') return `${origin}/`;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  // Clean paths — Express SPA fallback serves index.html; client maps path → HashRouter.
  return `${origin}${normalized}`;
}

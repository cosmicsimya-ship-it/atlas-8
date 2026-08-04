/**
 * Domain Core feature flags — default OFF (chat path unchanged).
 */

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isDomainCoreEnabled(env = process.env) {
  const raw = String(env.ATLAS_DOMAIN_CORE ?? '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

/**
 * Dual-run adapter logging / validation without flipping chat.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isDomainCoreDualRunEnabled(env = process.env) {
  if (isDomainCoreEnabled(env)) return true;
  const raw = String(env.ATLAS_DOMAIN_CORE_DUAL_RUN ?? '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

/**
 * Express middleware — require a capability (server-side).
 */

import { ATLAS_PLANS, CAPABILITIES, entitlementsForPlan } from './capabilities.js';
import { resolveEntitlements, hasCapability } from './resolve.js';

export const ENTITLEMENT_ERROR_CODES = Object.freeze({
  PREMIUM_REQUIRED: 'premium_required',
  LOGIN_REQUIRED: 'login_required',
  FORBIDDEN: 'forbidden',
});

/**
 * @param {string} capability
 * @param {{
 *   allowAnonymousReject?: boolean,
 *   feature?: string,
 * }} [opts]
 */
export function requireCapability(capability, opts = {}) {
  const feature = opts.feature || capability;

  return function entitlementGuard(req, res, next) {
    try {
      const auth = req.auth || {};
      let resolved;
      try {
        resolved = resolveEntitlements(auth);
      } catch {
        // Fail closed — store/resolve errors never grant Premium capabilities.
        return res.status(403).json({
          ok: false,
          data: null,
          error: {
            code: ENTITLEMENT_ERROR_CODES.FORBIDDEN,
            feature,
            message: 'Yetki kontrolü başarısız.',
          },
        });
      }

      if (!hasCapability(resolved.entitlements, capability)) {
        const freeCaps = entitlementsForPlan(ATLAS_PLANS.FREE);
        const premiumCaps = entitlementsForPlan(ATLAS_PLANS.PREMIUM);
        const needsPremium =
          hasCapability(premiumCaps, capability) && !hasCapability(freeCaps, capability);

        const code = needsPremium
          ? ENTITLEMENT_ERROR_CODES.PREMIUM_REQUIRED
          : ENTITLEMENT_ERROR_CODES.FORBIDDEN;

        return res.status(403).json({
          ok: false,
          data: null,
          error: {
            code,
            feature,
            message:
              code === ENTITLEMENT_ERROR_CODES.PREMIUM_REQUIRED
                ? 'Bu özellik Lara Prime gerektirir.'
                : 'Bu işlem için yetkiniz yok.',
            plan: resolved.plan,
          },
        });
      }

      req.entitlements = resolved;
      return next();
    } catch {
      return res.status(403).json({
        ok: false,
        data: null,
        error: {
          code: ENTITLEMENT_ERROR_CODES.FORBIDDEN,
          feature,
          message: 'Yetki kontrolü başarısız.',
        },
      });
    }
  };
}

export function requireVoiceLara() {
  return requireCapability(CAPABILITIES.VOICE_LARA, { feature: CAPABILITIES.VOICE_LARA });
}

export function requireImageAnalysis() {
  return requireCapability(CAPABILITIES.IMAGE_ANALYSIS, { feature: CAPABILITIES.IMAGE_ANALYSIS });
}

export function requirePrimeWorld() {
  return requireCapability(CAPABILITIES.PRIME_WORLD, { feature: CAPABILITIES.PRIME_WORLD });
}

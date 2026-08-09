/**
 * Express middleware — require a capability (server-side).
 */

import { CAPABILITIES } from './capabilities.js';
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
      const resolved = resolveEntitlements(auth);

      if (!hasCapability(resolved.entitlements, capability)) {
        const needsPremium =
          capability === CAPABILITIES.VOICE_LARA ||
          capability === CAPABILITIES.VOICE_MULTILINGUAL ||
          capability === CAPABILITIES.PREMIUM_FEATURES ||
          capability === CAPABILITIES.ANALYSIS_EXTENDED;

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
                ? 'Bu özellik Atlas Premium gerektirir.'
                : 'Bu işlem için yetkiniz yok.',
            plan: resolved.plan,
          },
        });
      }

      req.entitlements = resolved;
      return next();
    } catch (err) {
      return res.status(500).json({
        ok: false,
        data: null,
        error: {
          code: 'entitlement_error',
          message: 'Yetki kontrolü başarısız.',
        },
      });
    }
  };
}

export function requireVoiceLara() {
  return requireCapability(CAPABILITIES.VOICE_LARA, { feature: CAPABILITIES.VOICE_LARA });
}

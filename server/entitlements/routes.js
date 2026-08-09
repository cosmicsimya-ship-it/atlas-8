/**
 * Entitlement HTTP API — mobile-ready account plan surface.
 */

import { Router } from 'express';
import { buildEntitlementsResponse } from './resolve.js';

/**
 * @param {{
 *   rateLimit?: import('express').RequestHandler,
 * }} [deps]
 */
export function createEntitlementsRouter(deps = {}) {
  const router = Router();
  const rateLimit = deps.rateLimit || ((_req, _res, next) => next());

  /**
   * GET /api/me/entitlements
   * Also mounted at GET /api/entitlements for non-/me clients if needed.
   */
  router.get('/', rateLimit, (req, res) => {
    try {
      // Ignore any client-supplied plan / entitlements body or query
      const payload = buildEntitlementsResponse(req.auth || {});
      return res.status(200).json({
        ok: true,
        data: payload,
        error: null,
      });
    } catch {
      return res.status(500).json({
        ok: false,
        data: null,
        error: { code: 'entitlement_error', message: 'Entitlement bilgisi alınamadı.' },
      });
    }
  });

  // Reject client attempts to self-grant
  router.post('/', (_req, res) => {
    return res.status(405).json({
      ok: false,
      data: null,
      error: {
        code: 'method_not_allowed',
        message: 'Subscription state cannot be set by the client.',
      },
    });
  });

  router.put('/', (_req, res) => {
    return res.status(405).json({
      ok: false,
      data: null,
      error: {
        code: 'method_not_allowed',
        message: 'Subscription state cannot be set by the client.',
      },
    });
  });

  router.patch('/', (_req, res) => {
    return res.status(405).json({
      ok: false,
      data: null,
      error: {
        code: 'method_not_allowed',
        message: 'Subscription state cannot be set by the client.',
      },
    });
  });

  return router;
}

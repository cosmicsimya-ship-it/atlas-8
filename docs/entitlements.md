# Atlas Entitlements

Capability-based access control. Prefer capabilities over hard-coded `user.plan === 'premium'` checks in product code.

## Capabilities

| Id | Guest | Free | Premium |
|----|-------|------|---------|
| `atlas.basic` | ✓ | ✓ | ✓ |
| `atlas.history` | ✗ | ✓ | ✓ |
| `voice.lara` | ✗ | ✗ | ✓ |
| `voice.multilingual` | ✗ | ✗ | ✓ |
| `analysis.extended` | ✗ | ✗ | ✓ |
| `usage.extended` | ✗ | ✗ | ✓ |
| `image.analysis` | ✗ | ✗ | ✓ |
| `memory.extended` | ✗ | ✗ | ✓ |
| `premium.features` | ✗ | ✗ | ✓ |
| `prime.world` | ✗ | ✗ | ✓ |

Defined in `server/entitlements/capabilities.js` → `PLAN_CAPABILITY_MATRIX`.

## Resolve

```js
import { resolveEntitlements, authHasCapability, CAPABILITIES } from './entitlements/index.js';

const resolved = resolveEntitlements(req.auth);
if (authHasCapability(req.auth, CAPABILITIES.VOICE_LARA)) { /* … */ }
```

Guest detection: anonymous sessions / missing account → `plan: guest`.

## HTTP

### `GET /api/me/entitlements`

```json
{
  "ok": true,
  "data": {
    "authenticated": true,
    "plan": "free",
    "subscriptionStatus": "inactive",
    "entitlements": {
      "atlas.basic": true,
      "atlas.history": true,
      "voice.lara": false
    },
    "pricing": {
      "productName": "Atlas Premium",
      "currency": "TRY",
      "monthlyPrice": null,
      "displayPrice": null
    }
  }
}
```

Alias: `GET /api/entitlements`.

`POST`/`PUT`/`PATCH` → **405** (clients cannot self-grant).

### Middleware

```js
import { requireVoiceLara } from './entitlements/index.js';
// applied on POST /api/voice/synthesize
```

## Adding a new Premium feature

1. Add capability id to `CAPABILITIES` + matrix rows.
2. Guard the server route with `requireCapability('your.capability')`.
3. Optionally surface UX via `GET /api/me/entitlements`.
4. Document in this file.

No need to fork auth or invent a second identity system.

## Billing providers later

Implement `normalizeWebhook` / receipt verify in `server/entitlements/billing-providers.js`, then call `upsertSubscription`. Application code continues to call `resolveEntitlements` only.

Apple / Google Play must update the **same** subscription records so web and native clients stay consistent.

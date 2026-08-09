# Atlas Billing Architecture

Provider-independent billing sits beside canonical entitlements.

```
Provider (Iyzico | Apple | Google | …)
        ↓
Billing Service (verify / webhook / idempotency)
        ↓
Subscription store (data/subscriptions.json)
        ↓
Entitlement resolve (voice.lara, premium.features, …)
```

## Key files

| Path | Role |
|------|------|
| `server/billing/config.js` | Env config; public config strips IBAN/secrets |
| `server/billing/errors.js` | Provider contract + error codes |
| `server/billing/providers/` | Iyzico adapter + future stubs |
| `server/billing/service.js` | Checkout, verify, webhook → subscription |
| `server/billing/webhook-store.js` | Event idempotency |
| `server/billing/manual-bank-transfer.js` | Future extension (disabled) |
| `server/billing/index.js` | HTTP routes |
| `server/entitlements/*` | Canonical plan / capability matrix |

## Security rules

- Premium only after **provider-verified** payment or signed webhook.
- Client `paymentSuccess=true` is rejected.
- `IYZICO_*` and `PREMIUM_PAYOUT_*` are server-only env vars.
- IBAN is never returned by public billing APIs in this build.
- Live checkout requires `ATLAS_BILLING_LIVE_CHECKOUT=true` and dry-run off; this scaffolding still refuses automatic live charges until explicitly wired.

## HTTP

- `GET /api/billing/config`
- `GET /api/billing/subscription` (auth)
- `POST /api/billing/checkout` (auth + CSRF) → pending session + Checkout Form token
- `POST /api/billing/verify` (auth + CSRF) → retrieve + amount/currency/user checks
- `POST /api/billing/cancel` (auth + CSRF)
- `POST /api/billing/webhook/iyzico` (signature)

## Sandbox phase

- Only `https://sandbox-api.iyzipay.com`
- `NODE_ENV=production` or production Iyzico host → blocked
- `ATLAS_BILLING_DRY_RUN` defaults to `true` (no network until explicitly disabled in env)
- Pending sessions: `data/billing_checkout_sessions.json`
- Callback: `GET|POST /api/billing/callback/iyzico` → verify only → redirect `/#/billing/result?status=…`
  (never puts token/secrets in the redirect URL)

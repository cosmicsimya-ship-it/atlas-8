# Atlas Premium Architecture

Membership tiers and how they map to product access. Payment providers are **not** connected in this build.

## Tiers

| Plan | Who | Atlas chat | History | Lara Voice |
|------|-----|------------|---------|------------|
| `guest` | Anonymous session | Limited (existing policy) | No | **No** |
| `free` | Registered account | Yes | Yes (existing memory/archive ownership) | **No** |
| `premium` | Registered + active subscription entitlement | Yes | Yes | **Yes** (TR + EN) |

Canonical plan ids: `guest` | `free` | `premium`.

## Why Lara Voice is Premium

TTS incurs provider cost and abuse risk. Entitlement `voice.lara` is Premium-only; rate/quota guards still apply to Premium users.

## Authorization flow

```
Client (web / future Android / iOS)
  → cookie or future mobile session
  → GET /api/me/entitlements   (read plan + capabilities)
  → POST /api/voice/synthesize
       → CSRF + rate limit
       → requireCapability(voice.lara)   ← server-side
       → synthesis service
```

Frontend “Premium” hints are UX only. Direct API calls without entitlement receive:

```http
HTTP/1.1 403
{ "error": { "code": "premium_required", "feature": "voice.lara" } }
```

Client-sent `plan` / `entitlements` body fields are ignored.

## Subscription states

`inactive` · `trialing` · `active` · `past_due` · `canceled` · `expired`

Premium capabilities require `plan=premium` **and** status in `{ active, trialing }`.

## Storage

- Auth accounts: `data/auth_accounts.json` (unchanged)
- Subscriptions: `data/subscriptions.json` (new; keyed by `userId`)
- Provider customer/subscription IDs stay server-side; never returned on public APIs

## Granting Premium (dev / ops)

No self-serve payment in this build.

```bash
node server/scripts/grant-premium.mjs --userId web:YOUR_ID --days 30
node server/scripts/grant-premium.mjs --userId web:YOUR_ID --revoke
```

Optional env allowlist (server only): `ATLAS_PREMIUM_USER_IDS=web:abc,web:def`

## Pricing config (display)

```bash
PREMIUM_MONTHLY_PRICE_TRY=299
PREMIUM_CURRENCY=TRY
PREMIUM_PRODUCT_NAME=Atlas Premium
```

Display only until a billing provider is the source of truth.

## Payment provider (future)

```
BillingProvider (stripe | iyzico | apple_app_store | google_play)
        ↓ normalize webhook / receipt
upsertSubscription(userId, plan, status, period…)
        ↓
resolveEntitlements(auth)  → capabilities
```

Web and store subscriptions must both write the **same** subscription store so mobile and web share one entitlement view.

## Mobile-ready

Same endpoints:

- `GET /api/auth/session` (includes `plan` + `entitlements`)
- `GET /api/me/entitlements` (or `/api/entitlements`)
- `POST /api/voice/synthesize` (gated)

No browser-only entitlement store.

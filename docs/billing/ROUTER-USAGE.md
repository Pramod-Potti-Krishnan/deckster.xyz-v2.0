# Router credit usage in Studio

Studio's legacy Usage page estimates credits from flat wallet/quota cents. With
the new view enabled, Usage and the Billing usage card instead show the router's
settled plan allowance, used/remaining credits, non-expiring top-ups and image
count/cap. Max is the display name for router plan `premium`.

The authenticated `GET /api/account/usage` keeps `presentationCount` and
`storageBytes`. Only when `STUDIO_ROUTER_CREDITS_READ` is enabled does it add an
allowlisted `billing` projection. The opaque router account is always
`session.user.id`; query parameters, headers and body cannot select another user.
The router's echoed identity must match. All enabled responses are private and
uncached. Missing config, failed/invalid upstream reads or unavailable storage
produce `billing: { available: false }`, never an invented empty balance.

The server-only `ROUTER_CREDITS_READ_API_KEY` needs router `read` scope. The
existing `MODEL_ROUTER_URL` is reused. The key stays in an outbound Authorization
header; it is never returned, logged or imported by client code. Router responses
are byte-bounded and time-bounded. Unknown fields, internal metadata, provider
costs, tokens, models and margins are discarded.

`GET /v1/credits/{user}` supplies the authoritative entitlement-period balance
and images. The optional `GET /v1/usage/user/{user}/credits` supplies UTC-month
activity only. The chart never replaces the plan balance. Chart failure does not
hide a valid balance. Chart days must be complete, ordered, within the UTC month
and add exactly to the reported total.

Amounts remain six-place decimal strings. Whole-credit display uses integer
microcredits; a positive fraction below one reads “under 1 credit.” Display
rounding is not an enforcement decision. A null image cap reads Unlimited.

## Dark controls

- `STUDIO_ROUTER_CREDITS_READ`: server data, default OFF.
- `NEXT_PUBLIC_STUDIO_ROUTER_USAGE`: new Billing/Usage presentation, default OFF.
- `NEXT_PUBLIC_STUDIO_USAGE_PAGE`: existing `/usage` availability gate, retained.

The server and presentation controls are independent. A visible view with server
reads disabled shows “not switched on yet.” Disabling the new presentation
preserves the existing page/components, controls and fetch behavior. The marked
shared-page edits are reversible via the existing later-change registry.

This change performs no accounting, wallet debit, grant, entitlement or Stripe
write. Payment availability and plan/top-up checkout stay under their existing
controls. It changes no Builder/Director refusal or continuation behavior.

## Verification and release boundary

Run `node scripts/test-studio-router-credits.mjs` with `TMPDIR` on the external
drive. Tests execute the real TS route/parser/component sources with fake
authentication, router responses and DB readers. They cover cross-user refusal,
legacy/off identity, malformed/outage/large responses, exact decimal boundaries,
scope configuration, independent chart periods, images, safe DOM, and late
account-change responses. Adjacent billing/usage proofs remain unchanged.

These are offline source/render proofs. Connected read keys, router flags,
approved QA entitlements and schema, deployment, and PK's visual acceptance are
operator release prerequisites. This Draft does not change them. No live Stripe,
paid model calls, shared DB operations, merge, deploy or flag flip is included.

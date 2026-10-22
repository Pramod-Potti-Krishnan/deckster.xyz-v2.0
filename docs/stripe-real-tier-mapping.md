# Stripe real-tier webhook mapping

The server webhook at `app/api/webhooks/stripe/route.ts` can resolve Starter, Pro and Max
subscriptions from trusted server-configured Stripe price IDs. This affects only
`customer.subscription.created` and `customer.subscription.updated`.

`STRIPE_REAL_TIER_MAPPING_ENABLED` defaults to off. Only the exact string `true` enables
the new path. Unset, `false`, or any other value keeps the webhook's pinned legacy behavior:
new subscriptions use `pro`, only the existing Pro yearly ID selects `yearly`, and the
subscription upsert's update payload retains its original fields. The new resolver is not
called and no additional price configuration is read while off.

## Server configuration

All six values must be nonempty, unpadded and distinct before enabling the mapping. The
example environment file contains placeholders only. Use price IDs belonging to the same
Stripe account and mode as the webhook; no real values are part of this change.

| Server environment variable | Stored tier | Stored billing cycle |
| --- | --- | --- |
| `STRIPE_STARTER_MONTHLY_PRICE_ID` | `starter` | `monthly` |
| `STRIPE_STARTER_YEARLY_PRICE_ID` | `starter` | `yearly` |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | `pro` | `monthly` |
| `STRIPE_PRO_YEARLY_PRICE_ID` | `pro` | `yearly` |
| `STRIPE_MAX_MONTHLY_PRICE_ID` | `premium` | `monthly` |
| `STRIPE_MAX_YEARLY_PRICE_ID` | `premium` | `yearly` |

Max uses the existing internal tier `premium`, recognized by quota, authentication and
billing consumers. The webhook never stores an unsupported `max` tier. These variables are
server-only; no `NEXT_PUBLIC_` aliases, client metadata, amounts, price names, product names
or recurring intervals determine the tier or billing cycle.

## Enabled behavior

The pure resolver in `lib/stripe/subscription-plan.ts` requires a complete items list
(`has_more: false`) and exactly one item whose price ID matches one of the six configured
base plans. Unknown add-on prices may appear before or after that one base plan. Two
recognized items fail even if they use the same price or the same tier. An expanded matched
product is persisted using its string ID.

A missing, blank or ambiguous configuration; missing or empty items; an unknown-only
subscription; multiple recognized items; pagination; or a missing matched product ID throws
before any database or wallet writes. The existing webhook error boundary responds with
HTTP 500 and `{ "error": "Webhook processing failed" }`, allowing a later webhook retry.
The webhook does not make a remote lookup to guess or fetch a missing plan.

For a valid subscription, both arms of the subscription upsert store the mapped `tier` and
`billingCycle`, alongside the matched base plan's price and product. This updates existing
rows during upgrades, downgrades and monthly/yearly switches. Active and trialing users get
the mapped tier. Other statuses retain the existing user downgrade to `free` while the
subscription row records its actual plan. Subscription deletion retains its existing free
downgrade and field clearing.

Signature verification, checkout, wallet top-up idempotency and invoice handlers retain
their existing behavior. This change has no schema, checkout UI, plan purchase, deployment
or environment-flip step.

## Focused offline proof

Run from the webapp repository with existing dependencies containing TypeScript and the
target pinned Stripe **17.4.0** package:

```sh
node scripts/test-stripe-real-tier-webhook.mjs
```

An isolated worktree without dependencies can point the test at an existing dependency
checkout without installing or linking anything:

```sh
DECKSTER_TEST_DEPENDENCY_PACKAGE=/path/to/existing-checkout/package.json node scripts/test-stripe-real-tier-webhook.mjs
```

The script transpiles and executes the actual `POST` route with a mocked signature
constructor and in-memory Prisma/wallet implementations. The raw body and fixture signing
secret passed to the constructor are asserted; missing and invalid signatures are rejected.
This test does not exercise Stripe's cryptographic verifier. Its runtime module allowlist
blocks network-capable imports, and its fetch implementation fails on any attempt. The
resolver also type-checks against the real installed Stripe 17.4.0 declarations without
loading a Stripe client.

Coverage includes all six plans on created/updated events; active/trialing and inactive
statuses; sequential upgrades/downgrades/cycle changes; add-on order and expanded products;
invalid selection/configuration with zero writes; spoofed descriptors; customer fallback;
the existing quota consumer for Max; missing/invalid signatures; deletion; checkout;
duplicate wallet credit; invoice success/failure and the existing duplicate-invoice retry.

For disabled-mode proof, the script independently loads the exact route from git commit
`55cef1d29341ed9cf4bc1c1d93657e644ded4de4`. It compares HTTP responses, database/wallet
payloads and final in-memory state across ten off values, and verifies there are no new
price configuration reads or resolver calls. That baseline commit must exist in local git
history.

The local worker proof ran on Node **24.4.1**, TypeScript **5.9.3**, with existing read-only
Stripe **17.4.0** declarations. Node 22, full application checks and connected Stripe or
database operation remain separate release gates. No real credentials, customer data,
database, Stripe request, package installation, full suite or build is used by this proof.

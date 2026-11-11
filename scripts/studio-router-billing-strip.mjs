// CODEX-BILLING: exact insertions/replacements for the default-off router usage slice. No I/O.
export const ROUTER_BILLING_ENV_BLOCK = "# ROUTER BILLING USAGE (CODEX-BILLING). Default off. Server data and browser views are independent.\n# Server-only read key: router read scope only; never sent to the browser. Reuses MODEL_ROUTER_URL.\n# The Usage page also requires its existing page flag; Billing keeps existing controls.\nSTUDIO_ROUTER_CREDITS_READ=\"false\"\nNEXT_PUBLIC_STUDIO_ROUTER_USAGE=\"false\"\nROUTER_CREDITS_READ_API_KEY=\n"
export const ROUTER_BILLING_EDITS = {
  "app/(app)/usage/page.tsx": [
    [
      "import { StudioRouterUsage, STUDIO_ROUTER_USAGE_ENABLED } from \"@/components/billing/studio-router-usage\" // ROUTER-BILLING-USAGE\n",
      ""
    ],
    [
      "  if (STUDIO_ROUTER_USAGE_ENABLED) return <StudioRouterUsage page /> // ROUTER-BILLING-USAGE\n",
      ""
    ]
  ],
  "app/(app)/billing/page.tsx": [
    [
      "import { StudioRouterUsage, STUDIO_ROUTER_USAGE_ENABLED } from \"@/components/billing/studio-router-usage\" // ROUTER-BILLING-USAGE\n",
      ""
    ],
    [
      "              {STUDIO_ROUTER_USAGE_ENABLED && <StudioRouterUsage />} {/* ROUTER-BILLING-USAGE */}\n",
      ""
    ]
  ],
  "app/api/account/usage/route.ts": [
    [
      "import { getRouterCreditsForSession, routerCreditsReadEnabled } from \"@/lib/billing/router-credits\" // ROUTER-BILLING-USAGE\n",
      ""
    ],
    [
      "      return NextResponse.json({ error: \"Unauthorized\" }, { status: 401, ...(routerCreditsReadEnabled() ? { headers: { \"Cache-Control\": \"private, no-store\" } } : {}) }) // ROUTER-BILLING-USAGE\n",
      "      return NextResponse.json({ error: \"Unauthorized\" }, { status: 401 })\n"
    ],
    [
      "    if (routerCreditsReadEnabled()) { // ROUTER-BILLING-USAGE\n",
      ""
    ],
    [
      "      return NextResponse.json({ presentationCount, storageBytes: storageAgg._sum.fileSize ?? 0, billing: await getRouterCreditsForSession(userId) }, { headers: { \"Cache-Control\": \"private, no-store\" } }) // ROUTER-BILLING-USAGE\n",
      ""
    ],
    [
      "    } // ROUTER-BILLING-USAGE\n",
      ""
    ],
    [
      "    return NextResponse.json({ error: \"Failed to load usage\" }, { status: 500, ...(routerCreditsReadEnabled() ? { headers: { \"Cache-Control\": \"private, no-store\" } } : {}) }) // ROUTER-BILLING-USAGE\n",
      "    return NextResponse.json({ error: \"Failed to load usage\" }, { status: 500 })\n"
    ]
  ],
  "scripts/test-studio-billing-f4-f6.mjs": [
    [
      "import * as registry from \"./studio-later-changes.mjs\" // LATER-CHANGES: registry read (ROUTER-BILLING-USAGE)\n",
      ""
    ],
    [
      "const laterStrips = (rel, text) => registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(m.stripBillingF4F6) + 1).reduce((out, strip) => strip(rel, out), text) // LATER-CHANGES: registry read (ROUTER-BILLING-USAGE)\n",
      ""
    ],
    [
      "  ok(m.stripBillingF4F6(rel, laterStrips(rel, readFileSync(rel, 'utf8'))) === base, `A: ${rel} strips to its base`) // LATER-CHANGES: registry read (ROUTER-BILLING-USAGE)\n",
      "  ok(m.stripBillingF4F6(rel, readFileSync(rel, 'utf8')) === base, `A: ${rel} strips to its base`)\n"
    ]
  ]
}
export const ROUTER_BILLING_SCOPE_FILES = new Set([
  "app/(app)/usage/page.tsx",
  "app/(app)/billing/page.tsx",
  "app/api/account/usage/route.ts",
  "lib/billing/router-credit-view.ts",
  "lib/billing/router-credits.ts",
  "components/billing/studio-router-usage.tsx",
  "components/billing/studio-router-usage.css",
  "scripts/studio-router-billing-strip.mjs",
  "scripts/test-studio-router-credits.mjs",
  "docs/billing/ROUTER-USAGE.md",
  ".env.example",
  "scripts/studio-later-changes.mjs",
  "scripts/test-studio-billing-f4-f6.mjs"
])
export function stripRouterBilling(rel, text) {
  if (typeof text !== 'string') return text
  return (ROUTER_BILLING_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

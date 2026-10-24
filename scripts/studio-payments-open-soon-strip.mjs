// FRONTEND-2: "Payments open soon" for the controlled release (NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON, default off).
// The exact text this change adds to the files it touches, so a pin that holds one of them to an earlier commit can first put the base text back
// (stripPaymentsOpenSoon(rel, text)), the way the other *-strip.mjs files do. scripts/test-studio-payments-open-soon.mjs proves that stripping gives back
// BASE_COMMIT's file byte for byte. Every piece is a pure insertion removed on its own (no neighbouring text is needed), .env.example's block included, except
// the top-up modal's one `disabled` expression, which is a swap ([text this change has, text the base has]). New files (no base text to put back): PAYMENTS_OPEN_SOON_NEW_FILES below.

export const BASE_COMMIT = 'c75e4c2d0e5f7319cce890b055567281fe265184'

const ENV_BLOCK = `# PAYMENTS OPEN SOON (FRONTEND-2, controlled release; there is no Stripe account yet). On for the exact value "true"; default off, and then nothing changes.
# Build-time value: change it on Vercel and redeploy. On: every control that would start a NEW payment is disabled and says "Payments open soon": Billing's
# "Upgrade Now", "Upgrade to <plan>", "View Plans" and the four credit-pack buttons, the account menu's "Upgrade for more usage" row, and the Builder's reserve-credit
# top-up buttons. The two checkout routes (POST /api/stripe/create-checkout-session and /api/stripe/create-topup-session) answer 503 {"error":"Payments open soon"}
# before the session, the Stripe customer or Stripe is touched, so a page that was open before the deploy cannot start a payment either. Left exactly as they are: the plan a
# user is on (name, price, status, renewal; a Pro or Max subscriber sees what they saw), "Manage Subscription" (the Stripe portal link of an existing subscriber), the
# credit balance and its transactions, invites, coupons and their redemption, and the Stripe real-tier flag and its code path.
NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON="false"

`

const PAGE_IMPORT = `// NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON (default off): the Builder's account menu upgrade row says "Payments open soon" (hooks/use-studio-payments-open-soon.ts); the top-up modal gates itself.
import { useStudioPaymentsOpenSoon } from '@/hooks/use-studio-payments-open-soon'
`

const PAGE_HOOK = `  // NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON (default off): the account menu's upgrade row is disabled and says "Payments open soon". Flag off, the hook returns before it reads the document.
  useStudioPaymentsOpenSoon()

`

const LAYOUT_IMPORT = `// NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON (default off): the account pages' "Payments open soon" gate (Billing's upgrade and credit-pack buttons, the account menu's upgrade row).
import { STUDIO_PAYMENTS_OPEN_SOON_ENABLED } from "@/lib/studio-payments-open-soon"
import { StudioPaymentsOpenSoonMount } from "@/components/billing/studio-payments-open-soon-mount"
`

const LAYOUT_ELEMENT = `      {STUDIO_PAYMENTS_OPEN_SOON_ENABLED && <StudioPaymentsOpenSoonMount />}
`

const CHECKOUT_IMPORT = `import { PAYMENTS_OPEN_SOON_BODY, PAYMENTS_OPEN_SOON_STATUS, STUDIO_PAYMENTS_OPEN_SOON_ENABLED } from '@/lib/studio-payments-open-soon'
`

const CHECKOUT_GUARD = `  // NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON (default off): no payment can start. Refused before the session, the Stripe customer or Stripe is touched, so a stale page cannot open a checkout.
  if (STUDIO_PAYMENTS_OPEN_SOON_ENABLED) return NextResponse.json({ ...PAYMENTS_OPEN_SOON_BODY }, { status: PAYMENTS_OPEN_SOON_STATUS, headers: { 'Cache-Control': 'no-store' } })
`

const TOPUP_IMPORT = `import { PAYMENTS_OPEN_SOON_BODY, PAYMENTS_OPEN_SOON_STATUS, STUDIO_PAYMENTS_OPEN_SOON_ENABLED } from "@/lib/studio-payments-open-soon"
`

const TOPUP_GUARD = `  // NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON (default off): no payment can start. Refused before the session, the Stripe customer or Stripe is touched, so a stale page cannot open a checkout.
  if (STUDIO_PAYMENTS_OPEN_SOON_ENABLED) return NextResponse.json({ ...PAYMENTS_OPEN_SOON_BODY }, { status: PAYMENTS_OPEN_SOON_STATUS, headers: { "Cache-Control": "no-store" } })
`

const UPGRADE_IMPORT = `import { PAYMENTS_OPEN_SOON_LINE, STUDIO_PAYMENTS_OPEN_SOON_ENABLED } from '@/lib/studio-payments-open-soon'
`

const UPGRADE_BRANCH = `  // NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON (default off): no checkout can start; the button is disabled and says so. Off: the button below, as before.
  if (STUDIO_PAYMENTS_OPEN_SOON_ENABLED) {
    return (
      <Button disabled aria-disabled="true" title={PAYMENTS_OPEN_SOON_LINE} className={className}>
        {PAYMENTS_OPEN_SOON_LINE}
      </Button>
    )
  }

`

const MODAL_IMPORT = `import { PAYMENTS_OPEN_SOON_LINE, STUDIO_PAYMENTS_OPEN_SOON_ENABLED } from "@/lib/studio-payments-open-soon" // NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON (default off): the packs are disabled and the modal says so
`

const MODAL_RETURN = `    if (STUDIO_PAYMENTS_OPEN_SOON_ENABLED) return // NEXT_PUBLIC_STUDIO_PAYMENTS_OPEN_SOON: no request is made (the route refuses too)
`

const MODAL_NOTE = `        {STUDIO_PAYMENTS_OPEN_SOON_ENABLED && <p className="pt-1 text-xs text-muted-foreground" role="note" data-studio-payments-soon-note="true">{PAYMENTS_OPEN_SOON_LINE}</p>}

`

// [text this change has, text the base has]; each `added` is a literal that occurs once in the file.
const CHANGES = {
  '.env.example': [[ENV_BLOCK, '']],
  'app/builder/page.tsx': [
    [PAGE_IMPORT, ''],
    [PAGE_HOOK, ''],
  ],
  'app/(app)/layout.tsx': [
    [LAYOUT_IMPORT, ''],
    [LAYOUT_ELEMENT, ''],
  ],
  'app/api/stripe/create-checkout-session/route.ts': [
    [CHECKOUT_IMPORT, ''],
    [CHECKOUT_GUARD, ''],
  ],
  'app/api/stripe/create-topup-session/route.ts': [
    [TOPUP_IMPORT, ''],
    [TOPUP_GUARD, ''],
  ],
  'components/billing/UpgradeButton.tsx': [
    [UPGRADE_IMPORT, ''],
    [UPGRADE_BRANCH, ''],
  ],
  'components/builder/topup-modal.tsx': [
    [MODAL_IMPORT, ''],
    [MODAL_RETURN, ''],
    ['disabled={loadingPack !== null || STUDIO_PAYMENTS_OPEN_SOON_ENABLED}', 'disabled={loadingPack !== null}'],
    [MODAL_NOTE, ''],
  ],
}

export const PAYMENTS_OPEN_SOON_FILES = Object.keys(CHANGES)
export const PAYMENTS_OPEN_SOON_NEW_FILES = ['lib/studio-payments-open-soon.ts', 'hooks/use-studio-payments-open-soon.ts',
  'components/billing/studio-payments-open-soon.css', 'components/billing/studio-payments-open-soon-mount.tsx',
  'scripts/studio-payments-open-soon-strip.mjs', 'scripts/test-studio-payments-open-soon.mjs']
export const PAYMENTS_OPEN_SOON_CHANGES = CHANGES

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripPaymentsOpenSoon(rel, text) {
  const table = CHANGES[rel]
  if (!table) return text
  return table.reduce((out, [added, original]) => out.replace(added, () => original), text)
}

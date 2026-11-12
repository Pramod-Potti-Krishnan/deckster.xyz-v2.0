// FRONTEND-2 (B67; L-BILLING, the Studio half: PROGRAM-1 8 Nov 04:06Z DEEP, "Pass 5 Studio: billing/usage/entitlements pages per L-BILLING, behind flags"). Three switches, each on only for the exact
// value "true" and off by default: NEXT_PUBLIC_STUDIO_BILLING_PLANS (the Plan & credits UI, build-time), STUDIO_ROUTER_ENTITLEMENTS_PUSH (F3, the entitlement push, server runtime) and STUDIO_METER_RECEIVER_ENABLED
// (F4, the meter receiver, server runtime; its mode METER_RECEIVER_MODE is "receipt_only" unless it is exactly "apply").
// EVERYTHING this change adds to the app is a NEW file. FRONTEND-1 owns every existing billing file (the Billing page, the checkout route, the Stripe webhook, the wallet debit route, sign-up and the account route), so
// each line this change needs in one of them is a DRAFT below (BILLING_L5_DRAFTS): written out byte for byte with its anchor, NOT applied, awaiting the owner's OK. The new page, component, library, route and script
// work and are proven without them (the preview route /billing/plans, the proof's renders and vm runs).
// Its marker is BILLING-L5 (a WHOLE token). What this change adds to existing files: .env.example (one block, appended at the true end), the registry (three lines, at the true end of each list) and ONE subject-filter
// line in each of the two older proofs that read the first-parent commits of BASE..HEAD for their own subjects (the pin table below, tests only, every line carries the registry-read mark), as B62 / B63 did.
// No FRONTEND-1 file is edited: the four lines of scripts/test-studio-voice-call.mjs that FRONTEND-1 OK'd are dev's now (#607, D94), so this change carries nothing there.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '62051603d41f7ce7d9dc999b0dbf7525405d684a' // #600's head 62051603 (tree 576859c9 = Studio dev once #600 merges), the head this change is chained on
export const BILLING_L5_FLAGS = ['NEXT_PUBLIC_STUDIO_BILLING_PLANS', 'STUDIO_ROUTER_ENTITLEMENTS_PUSH', 'STUDIO_METER_RECEIVER_ENABLED']
export const BILLING_L5_KEY_NAMES = ['MODEL_ROUTER_BILLING_KEY', 'METER_WEBHOOK_SECRET']
export const BILLING_L5_MARKER = 'BILLING-L5'
/** The marker as a WHOLE token: BILLING-L5 is this change's; BILLING-L5X, X-BILLING-L5, BILLING-L50 and any other prefix or suffix are not. */
export const BILLING_L5_MARKER_RE = /(?<![\w-])BILLING-L5(?![\w-])/
/** The subject prefix of this change's own commits. */
export const BILLING_L5_SUBJECT = 'Billing L5:'

/** Existing app files that get marked lines: none (every file this change adds to the app is new; the owners' lines are DRAFTS). */
export const BILLING_L5_FILES = []

/** New files (no base text to put back). */
export const BILLING_L5_NEW_FILES = [
  'lib/studio-billing-plans.ts',
  'components/billing/studio-plan-credits.tsx',
  'app/(app)/billing/plans/page.tsx',
  'lib/billing/router-entitlements.ts',
  'scripts/billing-entitlement-backfill.mjs',
  'app/api/internal/meter/route.ts',
  'scripts/studio-billing-l5-strip.mjs',
  'scripts/test-studio-billing-l5.mjs',
]

/**
 * The DRAFT lines for FRONTEND-1's files: NOT in this change. Each is { file, after | before: the anchor line exactly as dev has it, line: its dev line number, add: the new line, byte for byte }.
 * Every new line carries the marker. With its flag off each one is inert: the component draws nothing, a push returns { skipped: true } before it reads anything, the checkout list gains nothing.
 */
export const BILLING_L5_DRAFTS = [
  { file: 'app/(app)/billing/page.tsx', after: 'import { StudioBillingCapacity } from "@/components/billing/studio-billing-capacity"', line: 18,
    add: 'import { StudioPlanCredits } from "@/components/billing/studio-plan-credits" // BILLING-L5' },
  { file: 'app/(app)/billing/page.tsx', before: '        {/* Credit Balance Card */}', line: 270,
    add: '        <StudioPlanCredits currentTier={user.tier} />{/* BILLING-L5 */}' },
  { file: 'app/api/stripe/create-checkout-session/route.ts', after: '      process.env.STRIPE_PRO_YEARLY_PRICE_ID,', line: 28,
    add: '      ...(process.env.NEXT_PUBLIC_STUDIO_BILLING_PLANS === "true" ? [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID, process.env.STRIPE_MAX_MONTHLY_PRICE_ID].filter((id): id is string => !!id) : []), // BILLING-L5: Starter and Max monthly (needs STRIPE_REAL_TIER_MAPPING_ENABLED on, or the webhook writes "pro")' },
  { file: 'app/api/webhooks/stripe/route.ts', after: "import Stripe from 'stripe'", line: 9,
    add: "import { pushEntitlementAfterStripeEvent } from '@/lib/billing/router-entitlements' // BILLING-L5" },
  { file: 'app/api/webhooks/stripe/route.ts', after: '  const outcome = await processStripeWebhookEvent(event, { prisma, creditWallet, clawbackWallet, env: process.env })', line: 37,
    add: '  if (outcome.status === 200) await pushEntitlementAfterStripeEvent(event) // BILLING-L5: after the event\'s own commit; never throws; flag off returns before any read' },
  { file: 'lib/auth-options.ts', after: 'import { applySessionUpdate, refreshEntitlementsIfStale, type ServerEntitlements } from "@/lib/auth-session-update"', line: 8,
    add: 'import { pushEntitlementForUser } from "@/lib/billing/router-entitlements" // BILLING-L5' },
  { file: 'lib/auth-options.ts', before: '  debug: process.env.NODE_ENV === "development",', line: 285,
    add: '  events: { createUser: async ({ user }) => { await pushEntitlementForUser(user.id, "signup") } }, // BILLING-L5: Free, pushed once when the account is created; never throws' },
  { file: 'app/api/account/route.ts', after: 'import { getStripe } from "@/lib/stripe/stripe"', line: 5,
    add: 'import { buildCancelEntitlement, pushEntitlement } from "@/lib/billing/router-entitlements" // BILLING-L5' },
  { file: 'app/api/account/route.ts', before: '    // 2. Payment rows have no cascade relation — remove them explicitly.', line: 45,
    add: '    await pushEntitlement(buildCancelEntitlement(userId, new Date())) // BILLING-L5: the router row goes to status canceled (Free) before the account is deleted; never throws' },
  { file: 'app/api/stripe/create-checkout-session/route.ts', after: "import { PAYMENTS_OPEN_SOON_BODY, PAYMENTS_OPEN_SOON_STATUS, STUDIO_PAYMENTS_OPEN_SOON_ENABLED } from '@/lib/studio-payments-open-soon'", line: 7,
    add: "import { prisma } from '@/lib/prisma' // BILLING-L5" },
  { file: 'app/api/stripe/create-checkout-session/route.ts', before: '    // BILLING-SECURITY begin checkout-cycle', line: 19,
    add: '    if (process.env.NEXT_PUBLIC_STUDIO_BILLING_PLANS === "true" && (await prisma.subscription.findFirst({ where: { userId: session.user.id, status: { in: ["active", "trialing", "past_due"] } }, select: { id: true } }))) return NextResponse.json({ error: "You already have a plan. Change it from Manage Subscription." }, { status: 409 }) // BILLING-L5: never a second subscription' },
]
/** No DRAFT for app/api/wallet/debit/route.ts: dev already reads the WALLET_DEBIT_SOURCE switch there (line 19, BILLING-F4F6, FRONTEND-1's), and the meter receiver reads the same switch. */
export const BILLING_L5_WALLET_DEBIT_ALREADY = { file: 'app/api/wallet/debit/route.ts', line: 19, has: 'if (!flatDebitEnabled()) return NextResponse.json(' }

/** The older proofs this change teaches: [text the proof has now, text the base commit's proof has] per edit, whole lines, so putting them back gives the base file byte for byte. Every line the proof has now carries BILLING_L5_PIN_MARK. None is in FRONTEND-1's or COMPOSER-2's lane. */
export const BILLING_L5_PIN_MARK = '// LATER-CHANGES: registry read (BILLING-L5)'
const FIRST_PARENT_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Billing L5:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (BILLING-L5): on a branch stacked after this change (L-BILLING's Studio half), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
export const BILLING_L5_PIN_EDITS = {
  'scripts/test-studio-deck-sync-truth.mjs': [[FIRST_PARENT_LINE, '']],
  'scripts/test-studio-chat-element-edit.mjs': [[FIRST_PARENT_LINE, '']],
}

/** Where each taught line goes: right after the last subject filter the base proof has, B63's "Usage credits page:" (the line that starts with this text). */
export const BILLING_L5_PIN_AFTER = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Usage credits page:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (USAGE-CREDITS-PAGE)"

/** The older proofs this change teaches. */
export const BILLING_L5_PIN_FILES = Object.keys(BILLING_L5_PIN_EDITS)

/** Every [has, was] pair this change makes, by file: the two taught proofs (nothing of FRONTEND-1's: dev has their voice-call proof lines). */
export const BILLING_L5_EDITS = { ...BILLING_L5_PIN_EDITS }

/** Files this change edits that are not app code: .env.example (its block, appended), the registry (three lines: its files, its block, its strip), and the older proofs it teaches. */
export const BILLING_L5_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...BILLING_L5_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const BILLING_L5_SCOPE_FILES = new Set([...BILLING_L5_FILES, ...BILLING_L5_NEW_FILES, ...BILLING_L5_OWN_EDITS])

/** The whole .env.example block: its comments and its six lines (appended at the end of the file, after one blank line). The two key values are EMPTY: nothing secret is written down. */
export const BILLING_L5_ENV_BLOCK = `# STUDIO BILLING L5 (FRONTEND-2; B67; L-BILLING, the Studio half). Three switches, each on only for the exact value "true" and off by default; off, nothing changes. 1 credit = $0.01; the screens show credits only.
# NEXT_PUBLIC_STUDIO_BILLING_PLANS (build-time): the Plan & credits section (Free 150, Starter 2,000, Pro 5,000, Max 10,000 credits a month; top-ups of 1,000 / 2,500 / 5,000 credits) and its preview page /billing/plans,
# a 404 while it is off. Only a Free account is offered checkout (the existing one, keeping the payments-open-soon state); a paid account gets the pricing page. Starter and Max can be bought only once checkout accepts them (FRONTEND-1's F1).
# STUDIO_ROUTER_ENTITLEMENTS_PUSH (server, runtime): after a plan change Studio sends the person's plan to the Model Router (PUT /v1/entitlements/{user id}) at the same Model Router address Studio's narration uses,
# with MODEL_ROUTER_BILLING_KEY: SERVER-ONLY (never a NEXT_PUBLIC_ name, never sent to the browser or logged), the router key with the entitlements scope only (the router's mint tool, key "billing"), minted by OPS-2.
# Leave it empty until the router's entitlements API is on, and switch the Stripe real-tier mapping on first (until then a live paid plan is not pushed).
# STUDIO_METER_RECEIVER_ENABLED (server, runtime): POST /api/internal/meter takes the router's signed meter feed (a 404 while it is off). METER_WEBHOOK_SECRET is SERVER-ONLY, the same value the router signs with; empty, the route answers 503.
# Do NOT enable it until durable storage or apply exists: receipt_only acknowledges without storing, and while it is off the router keeps every event as a dead letter it can replay.
# METER_RECEIVER_MODE: "receipt_only" (the default, and anything but "apply") checks and acknowledges each event and writes nothing. "apply" takes the top-up part off the wallet once per event, only while the
# wallet debit source above is router; do NOT set it before the router sends from_topup (until then apply answers 503). Any 4xx, 401 included, dead-letters an event: after a secret mismatch fix the secret, then OPS-2 runs the router's admin replay.
NEXT_PUBLIC_STUDIO_BILLING_PLANS="false"
STUDIO_ROUTER_ENTITLEMENTS_PUSH="false"
STUDIO_METER_RECEIVER_ENABLED="false"
METER_RECEIVER_MODE="receipt_only"
MODEL_ROUTER_BILLING_KEY=
METER_WEBHOOK_SECRET=
`

/** `text` with one whole line taken out: `has` is the line with its newline, and it counts only at the start of a line (it must be a whole line, never the tail of a longer one). Only the first occurrence goes: a line that is there twice is a merge mistake the older pins must still see. */
function putBackLine(text, has, was) {
  let at = text.indexOf(has)
  while (at !== -1 && !(at === 0 || text[at - 1] === '\n')) at = text.indexOf(has, at + 1)
  return at === -1 ? text : text.slice(0, at) + was + text.slice(at + has.length)
}

/** The file without this change's lines: an older proof this change taught gets its base text back. Any other file is returned as it is (this change marks no line in an app file). Idempotent. */
export function stripBillingL5(rel, text) {
  if (typeof text !== 'string') return text
  if (!Object.prototype.hasOwnProperty.call(BILLING_L5_EDITS, rel)) return text
  return BILLING_L5_EDITS[rel].reduce((out, [has, was]) => putBackLine(out, has, was), text)
}

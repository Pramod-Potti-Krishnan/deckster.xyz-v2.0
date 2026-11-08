import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { StudioPlanCredits } from '@/components/billing/studio-plan-credits'
import { STUDIO_BILLING_PLANS_ENABLED } from '@/lib/studio-billing-plans'

// BILLING-L5 (FRONTEND-2, B67): a preview of the Plan & credits section at /billing/plans, so it can be seen before FRONTEND-1 mounts it on the Billing page (a DRAFT line awaiting their OK).
// Flag NEXT_PUBLIC_STUDIO_BILLING_PLANS (exact "true", default off): off, this route calls notFound() before anything else (the app's 404 page). Sign-in is the middleware's (/billing/:path*).
// The person's tier comes from the session, so only a Free account is offered checkout; a paid or unknown tier gets the /pricing link.
export default async function BillingPlansPage() {
  if (!STUDIO_BILLING_PLANS_ENABLED) notFound()
  const session = await getServerSession(authOptions)
  return (
    <main className="container mx-auto max-w-4xl px-4 py-8" data-studio-billing-plans-page="true">
      <StudioPlanCredits currentTier={session?.user?.tier ?? null} />
    </main>
  )
}

"use client"

// REDEEM-V4 (NEXT_PUBLIC_STUDIO_REDEEM_V4, default off; FRONTEND-1's UX pass finding UX-15): the /redeem page in the Studio v4 frame. app/(auth)/redeem/page.tsx loads this module lazily, only with the flag on,
// and hands it everything the page already holds: its state, its submit handler and its sign-out call. This view has no state and no request of its own, so it cannot change what the page does.
// What it keeps, word for word: the title and the line under it (with or without a picked plan), the coupon field and its placeholder, the error line, "Redeem Coupon" / "Redeeming...", the success lines (and the
// tier note), "Signed in as ..." and "Sign out". What it changes is the frame: the Studio shell's tokens in light and dark, the Studio brand tile with "Deckster" in place of the old lowercase wordmark image,
// the v4 primary button, no gradient and no purple spinner. components/studio-redeem.css has the rules.

import Link from "next/link"
import { Layers, Loader2, LogOut, Ticket } from "lucide-react"
import type { FormEvent } from "react"
import "./studio-redeem.css"

export type StudioRedeemSuccess = { creditedCents: number; tier: string }

export type StudioRedeemViewProps = {
  /** "loading": the session is still being read (and the Suspense fallback). "form": the page's card, signed in. */
  phase: "loading" | "form"
  email?: string | null
  /** The picked plan's label ("Starter", "Pro", "Max"), or null. */
  planLabel?: string | null
  success?: StudioRedeemSuccess | null
  /** The redeemed tier's label (the page's PLAN_LABELS[tier] ?? tier). */
  successLabel?: string | null
  /** The label of the plan the code activated when it is not the picked plan, else null. */
  tierMismatch?: string | null
  code?: string
  setCode?: (value: string) => void
  error?: string | null
  setError?: (value: string | null) => void
  isRedeeming?: boolean
  onSubmit?: (event: FormEvent) => void
  onSignOut?: () => void
}

/** The v4 frame around the loading state: the page's spinner, in the shell's tokens. */
function StudioRedeemLoading() {
  return (
    <div data-studio-v4-shell="true" data-studio-redeem="true" data-studio-redeem-phase="loading">
      <div className="sr-loading">
        <div className="sr-spinner" />
      </div>
    </div>
  )
}

export function StudioRedeemView(props: StudioRedeemViewProps) {
  if (props.phase === "loading") return <StudioRedeemLoading />
  const { email, planLabel, success, successLabel, tierMismatch, code = "", setCode, error, setError, isRedeeming = false, onSubmit, onSignOut } = props

  return (
    <div data-studio-v4-shell="true" data-studio-redeem="true" data-studio-redeem-phase="form">
      <header className="sr-bar">
        <Link href="/" className="sr-brand">
          <span className="sr-brand-tile" aria-hidden="true">
            <Layers />
          </span>
          <span className="sr-brand-name">Deckster</span>
        </Link>
      </header>

      <main className="sr-main">
        <section className="sr-card">
          <div className="sr-head">
            <span className="sr-badge" aria-hidden="true">
              <Ticket />
            </span>
            <div>
              <h1 className="sr-title">{planLabel ? `Activate your ${planLabel} plan` : "Enter your access coupon"}</h1>
              <p className="sr-desc">
                {planLabel
                  ? `Enter the coupon code you received to unlock the ${planLabel} plan and get started with credits.`
                  : "Enter the coupon code you received to activate your account and get started with credits."}
              </p>
            </div>
          </div>

          <div className="sr-body">
            {success ? (
              <div className="sr-success" role="status">
                <p className="sr-success-title">Coupon redeemed!</p>
                <p>
                  {successLabel} plan activated · $
                  {(success.creditedCents / 100).toFixed(2)} in credits added.
                </p>
                {tierMismatch && (
                  <p className="sr-success-note">
                    Your code activated the <strong>{tierMismatch}</strong> plan.
                  </p>
                )}
                <p>Redirecting to the builder...</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="sr-form">
                <div className="sr-field">
                  <input
                    value={code}
                    onChange={(e) => {
                      setCode?.(e.target.value.toUpperCase())
                      setError?.(null)
                    }}
                    placeholder="e.g. WELCOME50"
                    className="sr-input"
                    autoFocus
                    disabled={isRedeeming}
                  />
                  {error && <p className="sr-error">{error}</p>}
                </div>

                <button type="submit" disabled={!code.trim() || isRedeeming} className="sr-primary">
                  {isRedeeming ? (
                    <>
                      <Loader2 className="sr-spin" />
                      Redeeming...
                    </>
                  ) : (
                    "Redeem Coupon"
                  )}
                </button>
              </form>
            )}
          </div>

          <div className="sr-foot">
            <span>Signed in as {email}</span>
            <button type="button" onClick={onSignOut} className="sr-signout">
              <LogOut />
              Sign out
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

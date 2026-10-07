/**
 * Studio v4 quota gate on the manual-deck handoff auto-submit: pure flag helper
 * (no imports, no side effects).
 *
 * Context (J8.1, 7 Oct): after "Start new deck" in the manual-deck conflict
 * dialog the Builder navigates to a fresh session and a staged request is
 * submitted automatically (the auto-submit effect in app/builder/page.tsx). That
 * effect called `sendMessage` directly. It never went through
 * `preflightDirectorTurn`, the plan/quota gate every typed send and every
 * question-card answer passes. The first Send did pass the gate before the
 * dialog opened, but the staged request is submitted later, possibly from a
 * reloaded page whose plan picture is different or has not even loaded.
 *
 * With this flag on, the auto-submit waits for the plan picture to load, runs
 * the same gate, and when the gate refuses it sends nothing: the staged record is
 * kept untouched (so the existing effect submits it, with its idempotency key,
 * once the gate opens) and the request text is put into the composer if the box
 * is empty so it is never lost.
 *
 * Quota is enforced only in the browser (Director has no plan check), so this is
 * the only gate this send can have.
 *
 * The flag is build-time: both public values are inlined into the client bundle,
 * so switching it needs a rebuild. Only the literal string "true" for BOTH turns
 * the feature on; anything else (including unset) is OFF.
 */

export function studioHandoffQuotaGateFlagOn(shell: string | undefined, flag: string | undefined): boolean {
  return shell === 'true' && flag === 'true'
}

/** Literal `process.env.NEXT_PUBLIC_*` reads so Next inlines them at build time. */
export const STUDIO_HANDOFF_QUOTA_GATE_ENABLED = studioHandoffQuotaGateFlagOn(
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL,
  process.env.NEXT_PUBLIC_STUDIO_HANDOFF_QUOTA_GATE_ENABLED,
)

/**
 * Studio v4 quota gate on the remaining Director-turn paths: pure flag helpers
 * (no imports, no side effects).
 *
 * Context (J8.1, 7 Oct, queue item R-20261007-frontend-13): the plan/quota gate
 * `preflightDirectorTurn` in app/builder/page.tsx is passed by typed sends,
 * question-card answers and (since the handoff gate) the staged handoff
 * auto-submit. Three more paths still send a Director turn without it, so a
 * plan-limited account blocked on typing can still start a build through them:
 *
 *   1. `handleActionClick`: a card button that sends its label (this includes the
 *      post-outline "generate" style actions);
 *   2. `onSessionDirective`: the Director-directed new-session auto-send;
 *   3. the template-ingest auto-send ("Convert my uploaded presentation ...").
 *
 * TURN_PATHS flag: those three paths run the same plan decision (the quota branch
 * of the gate: toast, top-up dialog and, with the blocked-send notice flag, the
 * notice). A refusal sends nothing. It also refreshes the quota snapshot after a
 * turn's spend has been booked (see hooks/use-quota.ts).
 *
 * FAIL_CLOSED flag (separate, so it can be decided on its own): when the plan
 * picture is unknown (nothing has been read yet, or the first read failed) the
 * gate refuses instead of passing. This stops a plan-limited account from building
 * while /api/usage/quota is down, and it also stops a paying account from building
 * until the plan picture is known, so PK decides whether to turn it on.
 *
 * Quota is enforced only in the browser (Director has no plan check), so these are
 * the only gates these sends can have.
 *
 * Both flags are build-time: the public values are inlined into the client bundle,
 * so switching either needs a rebuild. Only the literal string "true" for BOTH the
 * Studio shell flag and the feature flag turns a feature on; anything else
 * (including unset) is OFF.
 */

export function studioTurnPathsQuotaGateFlagOn(shell: string | undefined, flag: string | undefined): boolean {
  return shell === 'true' && flag === 'true'
}

export function studioQuotaFailClosedFlagOn(shell: string | undefined, flag: string | undefined): boolean {
  return shell === 'true' && flag === 'true'
}

/** Literal `process.env.NEXT_PUBLIC_*` reads so Next inlines them at build time. */
export const STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED = studioTurnPathsQuotaGateFlagOn(
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL,
  process.env.NEXT_PUBLIC_STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED,
)

export const STUDIO_QUOTA_FAIL_CLOSED_ENABLED = studioQuotaFailClosedFlagOn(
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL,
  process.env.NEXT_PUBLIC_STUDIO_QUOTA_FAIL_CLOSED_ENABLED,
)

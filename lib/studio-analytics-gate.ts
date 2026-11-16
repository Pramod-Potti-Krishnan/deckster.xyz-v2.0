// AUDIT P-30 (production frontend audit, "Vercel analytics console errors"): on production the browser console shows a 404 for the Vercel Web Analytics script plus a nosniff refusal.
// Flag NEXT_PUBLIC_STUDIO_ANALYTICS_GATE (exact "true", default off, build-time). Off, app/layout.tsx mounts <Analytics /> exactly as before.
//
// ROOT CAUSE. app/layout.tsx mounts <Analytics /> from @vercel/analytics/next unconditionally. The component requests /_vercel/insights/script.js from the deployment itself; Vercel serves that path only for a
// project that has Web Analytics enabled. The production project does not, so the request is a 404 (an HTML body for a script tag: the nosniff refusal). Nothing else breaks, the page just logs two errors.
// The frontend cannot ask Vercel whether Web Analytics is on (a probe would itself log the 404), so the deployment says it.
//
// FIX. With the gate on, <Analytics /> is rendered only when NEXT_PUBLIC_STUDIO_ANALYTICS_SERVED is also exactly "true" (set it on a Vercel project where Web Analytics is enabled). A project that sets the gate and
// not SERVED (production today) mounts nothing: no request, no console errors. A project that sets neither (every environment today) keeps the current behaviour.
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-audit-console.mjs transpiles this file into a bare function scope with a fake `process`.

export function analyticsFlagOn(value: string | undefined): boolean {
  return value === 'true'
}

/** The gate and the deployment's statement that it serves Web Analytics (literal process.env reads, so Next inlines them at build time). */
export const STUDIO_ANALYTICS_GATE_ENABLED = analyticsFlagOn(process.env.NEXT_PUBLIC_STUDIO_ANALYTICS_GATE)
export const STUDIO_ANALYTICS_SERVED = analyticsFlagOn(process.env.NEXT_PUBLIC_STUDIO_ANALYTICS_SERVED)

/** Whether the layout renders <Analytics />: always while the gate is off; with the gate on, only when the deployment says it serves analytics. */
export function analyticsMounts(gate: boolean, served: boolean): boolean {
  return gate !== true || served === true
}

export const STUDIO_ANALYTICS_MOUNTS = analyticsMounts(STUDIO_ANALYTICS_GATE_ENABLED, STUDIO_ANALYTICS_SERVED)

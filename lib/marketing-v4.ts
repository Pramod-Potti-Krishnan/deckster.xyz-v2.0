// MARKETING V4 (flag NEXT_PUBLIC_MARKETING_V4, default off). Import-free.
//
// What the flag does: with it on, the marketing pages (/, /build, /bring, /present, /experts, /pricing, /about, /learn) are the v4 design:
// the agent comes first ("Talk to it. Build with it. Present with it."), a new /build page, the avatar slide, credits pricing with no free plan.
// They are rendered from a parallel tree (components/marketing/v4, styles/marketing-v4.css) inside the UAT marketing shell's own parts.
// With it off nothing of that tree is rendered, /build is a 404 as before, and every page is exactly as it was.
// The v4 tree reuses the UAT tree's client components and slide stills, so it does not need NEXT_PUBLIC_STUDIO_UAT_MARKETING to be on.

/** Exact "true" turns it on. Anything else (unset, "false", "TRUE", " true") is off. The caller passes `process.env.NEXT_PUBLIC_MARKETING_V4` (Next inlines it at build time). */
export function marketingV4On(value: string | null | undefined): boolean {
  return value === "true"
}

/** The class on the page's root `.mv3` element, only in the v4 tree: every rule of styles/marketing-v4.css starts `.mv3:where(.mv4)`. */
export const MARKETING_V4_ROOT_CLASS = "mv4"

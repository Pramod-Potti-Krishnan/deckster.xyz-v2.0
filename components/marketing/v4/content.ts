import { V3_CONTENT } from "@/lib/marketing/v3-uat-view"

/**
 * Marketing v4: the few pieces of copy its components need as data. The page text itself lives in components/marketing/v4/pages.
 *
 * Status words on the v4 pages (decision D4): Live, Beta, Coming, Later. "Coming" uses the `st--build` style and "Later" the `st--planned`
 * style of the UAT sheet. A pill is plain markup in the page files; before a feature's pill changes, check it against production.
 */

/** Header nav: the same labels as today; Build opens the new page instead of the home page's zoom slide. */
export const V4_NAV = V3_CONTENT.nav.map((item) => (item.label === "Build" ? { ...item, href: "/build" } : item))

/** The build log on the Experts slides: today's script, unchanged. The slide-review line joins it when the review step is live in production. */
export const V4_LOOP = V3_CONTENT.experts.loop

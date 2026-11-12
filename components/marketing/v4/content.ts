import { V3_CONTENT } from "@/lib/marketing/v3-uat-view"

/**
 * Marketing v4: the few pieces of copy its components need as data. The page text itself lives in components/marketing/v4/pages.
 *
 * Status words on the v4 pages (decision D4): Live, Beta, Coming, Later. "Coming" uses the `st--build` style and "Later" the `st--planned`
 * style of the UAT sheet. A pill is plain markup in the page files; before a feature's pill changes, check it against production.
 */

/** Header nav: the same labels as today; Build opens the new page instead of the home page's zoom slide. */
export const V4_NAV = V3_CONTENT.nav.map((item) => (item.label === "Build" ? { ...item, href: "/build" } : item))

/**
 * The zoom slide on Home: today's copy, except that the deck-level exchange names "your agent". On the v4 site "the Director" is the
 * role name on the Experts page only (decision D15); every other page says "your agent". The shared v3 copy is left untouched.
 */
export const V4_ZOOM = {
  ...V3_CONTENT.zoom,
  exchanges: V3_CONTENT.zoom.exchanges.map((exchange) =>
    exchange.altitude === "deck"
      ? { ...exchange, who: exchange.who.replace("Director", "your agent"), response: exchange.response.replace(/^Director\b/, "Your agent") }
      : exchange,
  ),
  // Same shape, two strings reworded: the shared copy is typed by its literal text, so the type is restated here.
} as unknown as typeof V3_CONTENT.zoom

/** The build log on the Experts slides: today's script, unchanged. The slide-review line joins it when the review step is live in production. */
export const V4_LOOP = V3_CONTENT.experts.loop

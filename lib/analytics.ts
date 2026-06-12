import { track } from "@vercel/analytics"

/**
 * Central registry of CTA locations so event names stay consistent in the
 * Vercel dashboard. Add to the union when instrumenting a new button —
 * don't pass ad-hoc strings at call sites.
 *
 * Note: custom events require a Vercel Pro plan; on Hobby these calls no-op
 * harmlessly while pageviews still record.
 */
export type CtaLocation =
  | "header_get_started"
  | "header_sign_in"
  | "hero_primary"
  | "hero_secondary"
  | "hero_scroll_cue"
  | "demo_meet_team"
  | "pricing_starter"
  | "pricing_pro"
  | "pricing_max"
  | "pricing_full_page"
  | "final_cta"

export function trackCta(location: CtaLocation, props?: Record<string, string>) {
  track("cta_click", { location, ...props })
}

export function trackSlideView(slide: string, index: number) {
  track("slide_view", { slide, index })
}

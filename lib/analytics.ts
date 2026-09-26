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
  | "header_build_deck"
  | "header_get_started"
  | "header_sign_in"
  | "hero_primary"
  | "hero_scroll_cue"
  | "demo_meet_team"
  | "pricing_starter"
  | "pricing_pro"
  | "pricing_max"
  | "pricing_full_page"
  | "final_cta"
  | "v3_hero_build"
  | "v3_hero_drop"
  | "v3_zoom_approve"
  | "v3_zoom_keep"
  | "v3_zoom_regenerate"
  | "v3_experts_pause"
  | "v3_experts_steer"
  | "v3_theme_switch"
  | "v3_pricing_starter"
  | "v3_pricing_pro"
  | "v3_pricing_max"
  | "v3_pricing_full_page"
  | "v3_close_build"
  | "v3_close_drop"
  | "v3_header_build"
  | "v3_header_sign_in"

export function trackCta(location: CtaLocation, props?: Record<string, string>) {
  track("cta_click", { location, ...props })
}

export function trackSlideView(slide: string, index: number) {
  track("slide_view", { slide, index })
}

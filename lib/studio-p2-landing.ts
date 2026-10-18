/**
 * PASS2-PAGES Landing (streams/ops/PASS2-PAGES/landing.md) LAND-01: the mock paints the page canvas night (`html{background:var(--night)}`,
 * design-marketing-v3 site.css:31); the port dropped it, so rubber-band overscroll and short viewports flash the app body colour above the dark
 * header. With the flag, the v3 deck hook also marks <html> with `mv3-night`, and styles/marketing-v3.css paints that canvas night.
 *
 * Flag NEXT_PUBLIC_STUDIO_P2_LANDING: exact "true", default off (marketing pages are not behind the Studio shell). Off: the class is never added
 * and the rule matches nothing. Import-free on purpose, so scripts/test-studio-p2-landing.mjs can run the real file in a bare vm.
 */
export const STUDIO_P2_LANDING_ENABLED = process.env.NEXT_PUBLIC_STUDIO_P2_LANDING === 'true'

/** The class the hook adds to <html> next to mv3-page. */
export const MV3_NIGHT_CLASS = 'mv3-night'

/** The mock's --night (styles/marketing-v3.css .mv3 scope, which <html> cannot see). */
export const MV3_NIGHT = '#0C0D13'

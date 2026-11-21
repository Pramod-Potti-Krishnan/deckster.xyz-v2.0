// REPLACE-PICTURE-HERO-ONLY (FRONTEND-1; PK's UAT test of 17 Nov 2026 on Replace picture, M10). Flag NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY (exact "true", default off, build-time, read once here as a literal so Next inlines it).
// It acts only where Replace picture itself acts (NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE with the Studio shell). Off, hooks/use-studio-replace-picture.ts, lib/studio-replace-picture.ts and the Replace picture control behave exactly as they did.
//
// WHAT IT CHANGES. (1) Slides with a picture slot only. Layout's slide catalog gives each slide a picture target: hero_slot (the layouts that have a picture slot of their own: H1s, H1-structured, H2, H2-section, H3, H3-closing) or slide_background (every other layout). With the flag on,
// a slide that Layout says IS eligible but whose target is KNOWN to be slide_background does not offer the action: the button is greyed with HERO_ONLY_WORDS (a photo behind a content slide's dense text hurts reading: PK, UAT, layout C1). The words speak of the layout, never of the slide's
// role, because a title, section or closing slide in another layout (an ingested template, a direct-route deck) is a slide_background too, and a sentence that called it "not a title slide" would be false. When Layout ALSO declines the slide (its own eligible: false with a reason, for example a
// saved-template slide's NO_BACKGROUND_PICTURE), Layout's own reason is the one shown; the rule adds nothing there. A slide whose target is not known (the catalog has not been read, or does not list the slide) stays as it is today: available, and Layout decides when Replace is
// pressed. hero_slot is unchanged. (2) Layering. The dialog (and its overlay) are drawn at full strength, in a layer above the viewer, from the first frame (components/builder/replace-picture/replace-picture-hero-only.css, applied only through the data attribute the control sets while this
// flag is on).
//
// HOW THE REASON REACHES THE BUTTON. The hook asks heroOnlyReasonFor(eligibility, flag) and hands the answer to replacePictureDisabledReason as `heroOnlyReason`; that function returns it LAST: after the reasons the person can act on first (a build, a busy Studio, a placeholder ...) and after Layout's
// own not-eligible reason. The hook keeps the final reason in the ref Replace re-reads when it is pressed, so the rule is checked again at click time with no further code.

import type { SlideEligibility } from '@/lib/studio-replace-picture'

/** The flag: the exact string "true", nothing else. */
export function replacePictureHeroOnlyFlagOn(value: string | undefined): boolean {
  return value === 'true'
}

/** The flag (a literal process.env read, so Next inlines it at build time). */
export const STUDIO_REPLACE_PICTURE_HERO_ONLY = replacePictureHeroOnlyFlagOn(process.env.NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY)

/** What the greyed button says on a slide whose layout has no picture slot. It names the layout, never a slide role (title, section, closing, content): it must be true on every slide it is shown on. */
export const HERO_ONLY_WORDS = "This slide's layout has no picture slot, so its picture cannot be replaced here."

/**
 * The reason a slide offers no Replace picture because of the hero-only rule, or null. Flag off: always null. On: only when Layout's answer for the slide is known, says the slide IS eligible, and names slide_background as its target. A slide Layout declines (eligible: false) keeps
 * Layout's own reason. hero_slot, a target Layout did not name, and every state that says nothing about the slide (loading, absent, unknown) give null.
 */
export function heroOnlyReasonFor(eligibility: SlideEligibility | null | undefined, enabled: boolean): string | null {
  if (enabled !== true) return null
  if (eligibility && eligibility.state === 'known' && eligibility.eligible === true && eligibility.target === 'slide_background') return HERO_ONLY_WORDS
  return null
}

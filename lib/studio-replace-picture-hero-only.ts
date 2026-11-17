// REPLACE-PICTURE-HERO-ONLY (FRONTEND-1; PK's UAT test of 17 Nov 2026 on Replace picture, M10). Flag NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY (exact "true", default off, build-time, read once here as a literal so Next inlines it).
// It acts only where Replace picture itself acts (NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE with the Studio shell). Off, hooks/use-studio-replace-picture.ts, lib/studio-replace-picture.ts and the Replace picture control behave exactly as they did.
//
// WHAT IT CHANGES. (1) Hero slides only. Layout's slide catalog gives each slide a picture target: hero_slot (a title / section / closing slide's own picture slot) or slide_background (any other slide). With the flag on, a slide whose
// target is KNOWN to be slide_background does not offer the action: the button is greyed with HERO_ONLY_WORDS. A photo behind a content slide's dense text hurts reading (PK, UAT, layout C1). A slide whose target is not known (the catalog
// has not been read, or does not list the slide) stays as it is today: available, and Layout decides when Replace is pressed. hero_slot is unchanged. (2) Layering. The dialog (and its overlay) are drawn at full strength, in a layer above
// the viewer, from the first frame (components/builder/replace-picture/replace-picture-hero-only.css, applied only through the data attribute the control sets while this flag is on).
//
// HOW THE REASON REACHES THE BUTTON. The hook asks heroOnlyReasonFor(eligibility, flag) and hands the answer to replacePictureDisabledReason as `heroOnlyReason`; that function returns it after the reasons the person can act on first (a build, a
// busy Studio, a placeholder ...) and before Layout's own per-slide answer. The hook keeps the final reason in the ref Replace re-reads when it is pressed, so the rule is checked again at click time with no further code.

import type { SlideEligibility } from '@/lib/studio-replace-picture'

/** The flag: the exact string "true", nothing else. */
export function replacePictureHeroOnlyFlagOn(value: string | undefined): boolean {
  return value === 'true'
}

/** The flag (a literal process.env read, so Next inlines it at build time). */
export const STUDIO_REPLACE_PICTURE_HERO_ONLY = replacePictureHeroOnlyFlagOn(process.env.NEXT_PUBLIC_STUDIO_REPLACE_PICTURE_HERO_ONLY)

/** What the greyed button says on a slide that is not a title, section or closing slide. */
export const HERO_ONLY_WORDS = 'Pictures can be replaced on title, section and closing slides.'

/**
 * The reason a slide offers no Replace picture because of the hero-only rule, or null. Flag off: always null. On: only when Layout's answer for the slide is known and its target is slide_background (eligible or not: the rule is about the
 * kind of slide). hero_slot, a target Layout did not name, and every state that says nothing about the slide (loading, absent, unknown) give null.
 */
export function heroOnlyReasonFor(eligibility: SlideEligibility | null | undefined, enabled: boolean): string | null {
  if (enabled !== true) return null
  if (eligibility && eligibility.state === 'known' && eligibility.target === 'slide_background') return HERO_ONLY_WORDS
  return null
}

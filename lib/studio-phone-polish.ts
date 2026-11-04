// STUDIO PHONE POLISH (FRONTEND-2; B59; FRONTEND-1's pre-promotion UX pass of 4 Nov, finding UX-21, and F-13's two known limits, REAL-PHONE-CHECK.md). Flag NEXT_PUBLIC_STUDIO_PHONE_POLISH (exact "true", build-time, default off), only active together with the
// phone shell (NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL, both exact "true"); the landscape fix also needs the landscape stage (NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE). The pinned phone libs (lib/studio-phone-shell.ts, -landscape.ts, -hints.ts) are not edited:
// this module reads their flags itself. Import-free apart from the flag reads: the flag, the More sheet's focus decision, and the numbers the landscape stylesheet is checked against. No I/O.
//
// THREE SMALL FIXES (each only with the flag on; flag off, nothing here is drawn, no rule matches and every touched file is its base, byte for byte):
//  1. UX-21, the "Account menu" hint over the Help row, and 3. Escape not closing the More sheet, are ONE root cause. Radix Dialog moves focus into the sheet with FocusScope, which skips links (removeLinks) and so lands on the first button: the account menu's avatar.
//     The avatar sits inside StudioNavigationHint (a Radix Tooltip), whose trigger opens on focus, so the hint opens the moment the sheet does (the sheet is at the bottom, so the hint flips above the avatar: over the Help row). A Radix Tooltip content is a
//     DismissableLayer, and Escape dismisses only the TOPMOST layer (DismissableLayer: `isHighestLayer`), so the first Escape closes the hint and only the second closes the sheet. The fix is the sheet's own: its Dialog.Content takes the initial focus itself
//     (onOpenAutoFocus), so the avatar is not focused, no hint opens, and the first Escape closes the sheet. Touch needs no extra rule: a Radix Tooltip ignores touch pointer movement, so focus was the only way it opened. The landscape hamburger's own card
//     already closes on Escape (its capture listener in components/builder/studio-phone-landscape.tsx); its "More" entry opens this same sheet.
//  2. F-13 known limit (a): in a phone turned sideways the hamburger and the plus sat over the slide's bottom-right corner, where the page number is. The number is Reveal's slide number, drawn INSIDE the Layout viewer's frame (backend/layout-builder:
//     src/core/reveal-config.js `slideNumber: 'c/t'`, src/styles/core/reset.css `.reveal .slide-number`: 12 px, padding 5 px 10 px; Reveal puts it 8 px from the bottom and right edges), which Studio cannot restyle: only the buttons can move. The stage's dock is lifted
//     (components/layout/studio-phone-polish.css), with the two cards above it and the page's hidden top bar and authoring row, whose menus open beside the plus, by the same amount.

/** Exact "true" for the flag AND the phone shell AND the Studio shell; anything else (unset, "false", "TRUE", " true", "1") is off. The caller passes the three `process.env` values (Next inlines them at build time). */
export function studioPhonePolishOn(flag: string | null | undefined, phoneShell: string | null | undefined, studioShell: string | null | undefined): boolean {
  return flag === 'true' && phoneShell === 'true' && studioShell === 'true'
}

/** The landscape fix: the polish flag with the phone shell, the Studio shell AND the landscape stage (all exact "true"). */
export function studioPhonePolishLandscapeOn(flag: string | null | undefined, landscape: string | null | undefined, phoneShell: string | null | undefined, studioShell: string | null | undefined): boolean {
  return studioPhonePolishOn(flag, phoneShell, studioShell) && landscape === 'true'
}

/** The flags, resolved once at build time. Every attribute, prop and rule this change adds exists only when true. */
export const STUDIO_PHONE_POLISH_ENABLED = studioPhonePolishOn(process.env.NEXT_PUBLIC_STUDIO_PHONE_POLISH, process.env.NEXT_PUBLIC_STUDIO_PHONE_SHELL, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL)
export const STUDIO_PHONE_POLISH_LANDSCAPE_ENABLED = studioPhonePolishLandscapeOn(process.env.NEXT_PUBLIC_STUDIO_PHONE_POLISH, process.env.NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE, process.env.NEXT_PUBLIC_STUDIO_PHONE_SHELL, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL)

/** The attribute the stylesheet is keyed to: on <html> while the landscape stage is on (value "stage"), and on the More sheet (value "true"). It exists only with the flag on, so with it off no rule of the stylesheet matches anything. */
export const STUDIO_PHONE_POLISH_ATTRIBUTE = 'data-studio-phone-polish'

/** What Radix hands the sheet's onOpenAutoFocus: a native CustomEvent dispatched on the sheet's own box (currentTarget). */
export interface StudioPhoneOpenFocusEvent { preventDefault(): void; currentTarget: EventTarget | null }

/**
 * The More sheet's initial focus (Radix Dialog.Content onOpenAutoFocus): the default (FocusScope's first control that is not a link: the account menu's avatar, which opens its hint and puts that hint above the sheet for Escape) is cancelled and the sheet's own box takes
 * the focus instead (it is tabIndex -1 already, and the focus stays inside the modal sheet, so the trap and the way back to More are Radix's, as they were). Tab then reaches the first link, as it does from any dialog.
 */
export function studioPhoneMoreOpenFocus(event: StudioPhoneOpenFocusEvent): void {
  event.preventDefault()
  const sheet = event.currentTarget as { focus?: (options?: { preventScroll?: boolean }) => void } | null
  if (sheet && typeof sheet.focus === 'function') sheet.focus({ preventScroll: true })
}

/** The props the More sheet's Dialog.Content gets: none with the flag off (an empty spread draws nothing), the focus decision and the attribute the stylesheet's focus rule needs with it on. */
export const STUDIO_PHONE_MORE_PROPS: { onOpenAutoFocus?: (event: Event) => void; 'data-studio-phone-polish'?: 'true' } = STUDIO_PHONE_POLISH_ENABLED
  ? { onOpenAutoFocus: studioPhoneMoreOpenFocus, [STUDIO_PHONE_POLISH_ATTRIBUTE]: 'true' }
  : {}

/**
 * The Reveal slide number's box in the Layout viewer's frame, in px from the bottom-right corner of the screen (the stage's slide fills the screen): 8 px from each edge (Reveal's own place for it) and a box reserved generously for "NN / NN" at 12 px with 5 px 10 px padding
 * (about 70 x 22 px; reserved 88 x 28 px). The viewer is not ours: this is the box the stage's buttons must stay clear of.
 */
export const STUDIO_PHONE_PAGE_NUMBER_BOX = { right: 8, bottom: 8, width: 88, height: 28 } as const

/** How far the stage's dock (and what is anchored to it) is lifted, in px: from 10 px to 44 px off the bottom, so the dock's 2 px hit-area ring is 6 px above the page number's box. The stylesheet's numbers are checked against this and the box (scripts/test-studio-phone-polish.mjs). */
export const STUDIO_PHONE_DOCK_LIFT = 34

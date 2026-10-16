// PASS2D A3 (flag NEXT_PUBLIC_STUDIO_THEME_BLANK_NOTE, exact "true"; default off): the canvas Theme dialog says what a theme does on a blank canvas.
//
// What the J3 / J4 runs saw (ELEMENT-2 item 6, PASS2-J4-FINDINGS item 3): on a blank canvas the user picks a theme and presses Apply; the header
// then reads "Current theme X", "Apply theme" is greyed ("Pick a different theme to change it.") and the slide does not change. Apply is not
// broken: it is enabled exactly while the picked theme differs from the applied one (components/theme-panel.tsx `hasChanges`), so it is greyed once
// the pick has been applied. What is missing is any word that a blank canvas is not repainted: Layout draws a blank slide itself, and the
// dialog's own line says "your deck changes when you apply the theme". The theme is not lost: Studio sends it to Director (set_theme) and Director
// builds the slides with it.
//
// Behaviour with the flag on, only while the deck is the blank canvas and the theme choice is open (not locked): a short note under the dialog's
// header, and the preview line reads the same way. Nothing about Apply, the draft or the payload changes.
//
// This file imports nothing, so a node test can load it on its own.

// Literal property access so Next inlines the value into the client bundle.
export const STUDIO_THEME_BLANK_NOTE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_THEME_BLANK_NOTE === 'true'

export const THEME_BLANK_NOTE = "A blank canvas doesn't change when you apply a theme. Director uses it when it builds your slides."
export const THEME_BLANK_PREVIEW_NOTE = 'A preview only: your slides use this theme when Director builds them.'

export interface ThemeBlankNote {
  /** The note under the dialog's header. */
  note: string
  /** The preview's closing line, in place of "A preview only: your deck changes when you apply the theme." */
  previewNote: string
}

/** The note for the blank canvas, or null: the flag is on and the deck is the blank canvas. The viewer hands the result to the panel. */
export function themeBlankNote(enabled: boolean, isBlankPresentation: boolean | null | undefined): ThemeBlankNote | null {
  return enabled === true && isBlankPresentation === true ? { note: THEME_BLANK_NOTE, previewNote: THEME_BLANK_PREVIEW_NOTE } : null
}

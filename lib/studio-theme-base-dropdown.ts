// PASS2D (flag NEXT_PUBLIC_STUDIO_THEME_BASE_DROPDOWN, exact "true" and the Studio shell; default off): the Themes & brand page chooses a theme's base with the same searchable
// dropdown as the deck Theme dialog, not a native <select>.
//
// What the J4 run saw (PASS2-J4-FINDINGS item 6b): the Create tab's "Base theme" was a plain browser select, so Studio had three ways to pick a theme: the composer popover's
// dropdowns, the deck dialog's searchable dropdown with swatches, and this select. The picker component already exists (components/theme-dropdown-picker.tsx); this feeds it the
// select's own choices.
//
// What does not change: the choices and their order (Auto first, then the presets, then the draft's own base when no preset has its id), the value shown as chosen, the handler a
// choice goes through (`changePreset`), and what is saved. The dropdown only adds search and the same look as the other pickers. It draws no colour chips: the palette the page's
// preview keeps for a preset is not yet the canon one (PASS2-J4-FINDINGS item 5), and a chip with the wrong colours is worse than none.
//
// This file imports nothing, so a node test can load it on its own.

// Literal property access so Next inlines the values into the client bundle.
export const STUDIO_THEME_BASE_DROPDOWN_ENABLED = process.env.NEXT_PUBLIC_STUDIO_THEME_BASE_DROPDOWN === 'true' && process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

/** What the select's first option said. */
export const BASE_THEME_AUTO_NAME = 'Auto / session default'

export interface BaseThemePreset {
  preset_id: string
  name: string
}

export interface BaseThemeDraft {
  mode?: string
  preset_id?: string
}

export interface BaseThemeOption {
  id: string
  name: string
  hint: string
  swatches: string[]
  current: boolean
  /** Absent only for Auto, so the picker's own "Director picks for you" line shows; '' for a row that has nothing to add. */
  sub?: string
}

/** The id shown as chosen: 'auto' for an Auto draft, else the draft's base (corporate_light when it names none). The select's own value rule. */
export function baseThemeSelectedId(draft: BaseThemeDraft): string {
  return draft.mode === 'auto' ? 'auto' : draft.preset_id || 'corporate_light'
}

/** The picker's options, in the select's own order: Auto, every preset, then the draft's own base when no preset has its id ("<id> (saved base)", as the select labelled it). */
export function baseThemeOptions(presets: readonly BaseThemePreset[], draft: BaseThemeDraft): BaseThemeOption[] {
  const options: BaseThemeOption[] = [{ id: 'auto', name: BASE_THEME_AUTO_NAME, hint: '', swatches: [], current: false }]
  for (const preset of presets) options.push({ id: preset.preset_id, name: preset.name, hint: '', swatches: [], current: false, sub: '' })
  if (draft.preset_id && !presets.some(preset => preset.preset_id === draft.preset_id)) {
    options.push({ id: draft.preset_id, name: `${draft.preset_id} (saved base)`, hint: '', swatches: [], current: false, sub: '' })
  }
  return options
}

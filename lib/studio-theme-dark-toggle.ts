// P2C: Light or Dark for a deck, chosen before the build (flag NEXT_PUBLIC_THEME_DARK_MODE_ENABLED, exact "true"; default off).
//
// Dark is a build-time property: Theme Builder prepares the dark tokens during the build, Slide Builder stamps them, Layout
// paints them. The Studio's whole share is one field on the theme selection it already sends, `palette_mode` ('light' | 'dark'),
// in the build message and in the `set_theme` frame. Nothing here talks to a service.
//
// A deck that is already built cannot be switched from the browser: `set_theme` on a built deck would not give dark (and
// would reset a dark deck to light). So for a built deck the control only STAGES a choice, labelled "Rebuild in dark" /
// "Rebuild in light", and says nothing is rebuilt or sent now. It never writes the choice into the theme selection, because
// a changed selection is what makes the page send `set_theme`.
//
// Dark-only presets (corporate_dark, gilded_noir, mission_amber) have no light form: with the flag on, "Light" is disabled for them, the control reads Dark,
// and the selection that goes out can never carry palette_mode 'light' (or 'both') for one.
//
// Flag off: the functions that take the flag (withPaletteMode, customEntryPaletteMode, paletteModeChoices, paletteModeSelectValue, effectivePaletteMode,
// lightDisabledFor, clampDarkOnlyPaletteMode) hand back exactly what today's code computes (same object, same values). Import-free on purpose, so a node
// test can load it alone.

export type DeckPaletteMode = 'light' | 'dark'

/** The slice of the theme selection this file reads and writes. Anything else on the object is carried as is. */
export interface PaletteModeSelection {
  palette_mode?: 'light' | 'dark' | 'both'
  /** Read only to tell a dark-only preset from anything else. */
  mode?: string
  preset_id?: string
}

/**
 * The presets that exist only in dark. Theme Builder's preset summary (FALLBACK_THEME_PRESETS in lib/theme-builder.ts, GET /api/v1/themes/presets) has no
 * dark-only field to read, so the three are named here. `dark-mode` / `dark_mode` are the aliases normalizeThemePresetId maps to corporate_dark.
 */
export const DARK_ONLY_PRESET_IDS: readonly string[] = ['corporate_dark', 'gilded_noir', 'mission_amber', 'dark-mode', 'dark_mode']

/** The reason shown on the disabled Light option. */
export const DARK_ONLY_REASON = 'This theme is dark only'

/** A preset selection of a dark-only preset. Custom colours and Auto are never dark-only; neither is a missing or unknown preset. */
export function isDarkOnlyPreset(selection: { mode?: unknown; preset_id?: unknown } | null | undefined): boolean {
  if (selection?.mode !== 'preset' || typeof selection.preset_id !== 'string') return false
  return DARK_ONLY_PRESET_IDS.includes(selection.preset_id.trim().toLowerCase().replace(/\s+/g, '_'))
}

/** Next inlines the literal `process.env.NEXT_PUBLIC_...` at the call site; this only applies the exact-"true" rule. */
export function themeDarkModeEnabled(raw: string | undefined): boolean {
  return raw === 'true'
}

/** Light, unless the selection says dark. Absent, 'light' and 'both' all read as Light (the control never offers "both"). */
export function paletteModeOf(selection: { palette_mode?: unknown } | null | undefined): DeckPaletteMode {
  return selection?.palette_mode === 'dark' ? 'dark' : 'light'
}

export function otherPaletteMode(mode: DeckPaletteMode): DeckPaletteMode {
  return mode === 'dark' ? 'light' : 'dark'
}

export function paletteModeLabel(mode: DeckPaletteMode): 'Light' | 'Dark' {
  return mode === 'dark' ? 'Dark' : 'Light'
}

/** Flag on and a dark-only preset: Light is not offered. Flag off, never. */
export function lightDisabledFor(selection: PaletteModeSelection, flagOn: boolean): boolean {
  return flagOn && isDarkOnlyPreset(selection)
}

/** The mode the control shows: Dark for a dark-only preset (flag on), else what the selection says (Light when it says nothing). */
export function effectivePaletteMode(selection: PaletteModeSelection, flagOn: boolean): DeckPaletteMode {
  return lightDisabledFor(selection, flagOn) ? 'dark' : paletteModeOf(selection)
}

/** The selection with the chosen mode written (Dark, whatever was asked, for a dark-only preset). Flag off, the very same object comes back. */
export function withPaletteMode<T extends PaletteModeSelection>(selection: T, mode: DeckPaletteMode, flagOn: boolean): T {
  if (!flagOn) return selection
  return { ...selection, palette_mode: lightDisabledFor(selection, flagOn) || mode === 'dark' ? 'dark' : 'light' }
}

/**
 * The last gate before a selection goes out. A mode picked on another preset rides along when the preset changes (selectCanonicalThemePreset carries it),
 * so a dark-only preset can arrive holding 'light' (or 'both'): that is written as 'dark'. An absent palette_mode stays absent (the preset is dark by
 * itself and "untouched adds nothing"). Anything else, and the flag off, comes back as the very same object.
 */
export function clampDarkOnlyPaletteMode<T extends PaletteModeSelection>(selection: T, flagOn: boolean): T {
  if (!lightDisabledFor(selection, flagOn)) return selection
  if (selection.palette_mode == null || selection.palette_mode === 'dark') return selection
  return { ...selection, palette_mode: 'dark' }
}

/**
 * The palette mode a freshly entered custom palette starts with. Today it is the stored mode or 'both'. Flag on, "both" is not
 * offered, so a custom palette starts at the mode the control shows (Light unless Dark was picked, or the preset is dark only).
 */
export function customEntryPaletteMode(selection: PaletteModeSelection, flagOn: boolean): 'light' | 'dark' | 'both' {
  return flagOn ? effectivePaletteMode(selection, flagOn) : selection.palette_mode || 'both'
}

export interface PaletteModeChoice {
  value: 'light' | 'dark' | 'both'
  label: string
}

/** The options of the palette-mode select in Themes & brand: Light, Dark and Both today; Light and Dark with the flag on. */
export function paletteModeChoices(flagOn: boolean): PaletteModeChoice[] {
  const choices: PaletteModeChoice[] = [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]
  return flagOn ? choices : [...choices, { value: 'both', label: 'Both' }]
}

/** The value that select shows: today's `palette_mode || 'both'`; with the flag on, Light or Dark. */
export function paletteModeSelectValue(selection: PaletteModeSelection, flagOn: boolean): 'light' | 'dark' | 'both' {
  return flagOn ? paletteModeOf(selection) : selection.palette_mode || 'both'
}

/** The action on a built deck: the opposite of the mode it was built in. */
export function existingDeckActionLabel(builtMode: DeckPaletteMode): 'Rebuild in dark' | 'Rebuild in light' {
  return builtMode === 'dark' ? 'Rebuild in light' : 'Rebuild in dark'
}

/** The line under that action. It always says nothing is rebuilt or sent now. */
export function existingDeckNote(builtMode: DeckPaletteMode, staged: DeckPaletteMode | null): string {
  if (staged && staged !== builtMode) {
    return `${paletteModeLabel(staged)} is staged. It applies the next time this deck is rebuilt. Nothing is rebuilt or sent now.`
  }
  return `This deck was built in ${paletteModeLabel(builtMode).toLowerCase()}. Choosing a rebuild only stages it for the next rebuild. Nothing is rebuilt or sent now.`
}

/** The mode a click on the existing-deck action stages: the opposite mode, or nothing when it is already staged (click again to undo). */
export function nextStagedMode(builtMode: DeckPaletteMode, staged: DeckPaletteMode | null): DeckPaletteMode | null {
  const target = otherPaletteMode(builtMode)
  return staged === target ? null : target
}

/**
 * PASS2B batch 1 (J3-01 / J5-01 / J6-01): a greyed-out control must say why. Flag NEXT_PUBLIC_STUDIO_DISABLED_REASONS, exact 'true', default off;
 * off is today's markup exactly.
 *
 * The Add Slide, Add Element, Template and Theme buttons in the Studio toolbar went grey with no word on screen (the title stayed "Add an
 * element" / "Presentation theme"; only the tab-paused case, ONE_LIVE_TAB #396, explained itself), and the Add Element panel's greyed research
 * sources kept their reason in a hover-only title. Users could not tell "wait" from "blocked".
 *
 * This file only decides the words. It mirrors, one for one, the `disabled` expressions the viewer already has for each control
 * (components/presentation-viewer.tsx: Add Slide / Add Element `!viewerIsReady || templateModeOn || isSlideMutationPending || tabPaused`, Theme
 * `!viewerIsReady || templateModeOn || tabPaused`, Template `!viewerIsReady || tabPaused`), so a reason exists exactly when the control is
 * disabled; scripts/test-studio-pass2b-batch1.mjs checks that against the viewer's own code for every combination of those inputs. The words are
 * shown by components/studio-disabled-reason.tsx (a tooltip on hover and keyboard focus, and aria-describedby) which extends, not replaces, the
 * wrapper ONE_LIVE_TAB added.
 *
 * Pure: no React, no DOM, no network.
 */

export const STUDIO_DISABLED_REASONS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_DISABLED_REASONS === 'true'

export type StudioToolbarControl = 'add-slide' | 'add-element' | 'theme' | 'template'

export interface StudioToolbarDisabledState {
  /** The ONE_LIVE_TAB sentence, set only while this tab is paused (the viewer's `studioTabPausedHint`). */
  tabPausedHint?: string
  viewerIsReady: boolean
  templateModeOn: boolean
  /** An add / delete / move is in flight (the viewer's `isSlideMutationPending`). */
  slideMutationPending: boolean
}

export const REASON_VIEWER_LOADING = 'Loading the slide…'
export const REASON_CHANGE_IN_FLIGHT = 'Finishing your last change…'
/** An Add Element card that is disabled while the toolbar button itself is enabled (no generation panel is wired in this view). */
export const REASON_ELEMENT_UNAVAILABLE = 'Not available in this view.'

const REASON_TEMPLATE_MODE: Record<'add-slide' | 'add-element' | 'theme', string> = {
  'add-slide': 'Exit Template Mode to add slides',
  'add-element': 'Exit Template Mode to add elements',
  'theme': 'Exit Template Mode to change the theme',
}

/**
 * Why `control` is disabled right now, or null when it is enabled. Order: a paused tab first (the existing hint), then the slide still loading,
 * then Template Mode, then a change in flight. Template is not disabled by Template Mode or by a change in flight (its menu hosts the exit).
 */
export function studioToolbarDisabledReason(control: StudioToolbarControl, state: StudioToolbarDisabledState): string | null {
  if (state.tabPausedHint) return state.tabPausedHint
  if (!state.viewerIsReady) return REASON_VIEWER_LOADING
  if (control !== 'template' && state.templateModeOn) return REASON_TEMPLATE_MODE[control]
  if ((control === 'add-slide' || control === 'add-element') && state.slideMutationPending) return REASON_CHANGE_IN_FLIGHT
  return null
}

/** What the Add Element gallery / dropdown shows for its disabled cards: the toolbar reason when there is one, else the per-card fallback. */
export function studioElementCardsDisabledReason(toolbarReason: string | null): string {
  return toolbarReason ?? REASON_ELEMENT_UNAVAILABLE
}

/** A research source that is disabled with no reason of its own (the capability said `available: false` and gave no text). */
export const REASON_SOURCE_UNAVAILABLE = 'Not available right now.'

/**
 * PASS2B G21: a "+ Add slide" button in the slide rail's footer, as the accepted Studio v4 mockup has it (the mockup's filmstrip ends in a dashed
 * "+ Add slide" button; Studio dev's only Add Slide is in the toolbar). Flag NEXT_PUBLIC_STUDIO_RAIL_ADD_SLIDE, exact 'true', Studio shell only,
 * default off. Off, the rail is exactly as before.
 *
 * What the button is: a second way to OPEN the existing Add Slide panel (J2 v2, NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED), through the same handler the
 * toolbar's button calls (`addSlideV2Settings.onPanelOpenChange`, the page's handleAddSlideV2PanelOpenChange). It sends no Layout or viewer command
 * of its own: opening the panel sends nothing, and the panel's own Generate / Blank slide remain the only things that ever do, exactly as when the
 * toolbar opened it. With the Add Slide panel flag off there is no panel to open, so the button is not drawn.
 *
 * When it is drawn, and when it is greyed: it follows the toolbar's Add Slide, no more and no less.
 *  - not drawn when the panel cannot open: Add Slide v2 off, or the authoring strip (where the panel is mounted) is not on screen; the rail itself
 *    is not drawn for a deck with no slides, so "no deck" never shows it;
 *  - greyed (disabled) exactly when the toolbar's button is: the viewer not ready (no deck loaded / loading), Template Mode, a slide change in flight,
 *    or this tab paused (ONE_LIVE_TAB #396); plus while a build runs, when the viewer fades the whole authoring strip and makes it inert;
 *  - the words: with NEXT_PUBLIC_STUDIO_DISABLED_REASONS (#403) on, the same sentence the toolbar's Add Slide shows (studioToolbarDisabledReason); with it
 *    off, only the paused-tab sentence, as the toolbar does (a title on the box around the button).
 * scripts/test-studio-rail-add-slide.mjs checks the `disabled` rule against the viewer's own Add Slide expression for every combination of its inputs.
 *
 * Pure: no React, no DOM, no network.
 */

import { studioToolbarDisabledReason } from './studio-disabled-reasons'

/** Literal property access so Next inlines the value into the client bundle. */
export const STUDIO_RAIL_ADD_SLIDE = process.env.NEXT_PUBLIC_STUDIO_RAIL_ADD_SLIDE === 'true'

/** The button's words. The mockup writes "Add slide" (the plus is an icon). */
export const RAIL_ADD_SLIDE_LABEL = 'Add slide'

export interface RailAddSlideInput {
  /** The Add Slide panel can open from here: Add Slide v2 is on and wired, and the authoring strip that hosts the panel is on screen. */
  panelAvailable: boolean
  /** The viewer's own inputs to the toolbar Add Slide's `disabled` (components/presentation-viewer.tsx). */
  viewerIsReady: boolean
  templateModeOn: boolean
  slideMutationPending: boolean
  /** The ONE_LIVE_TAB sentence while this tab is paused (the viewer's `studioTabPausedHint`); undefined or empty otherwise. */
  tabPausedHint?: string
  /** A build is running (the viewer's `isGenerating`): the authoring strip is faded and takes no pointer events. */
  building: boolean
  /** NEXT_PUBLIC_STUDIO_DISABLED_REASONS. */
  disabledReasons: boolean
}

export interface RailAddSlideState {
  disabled: boolean
  /** Why it is disabled, in words; null when enabled or when nothing is said (a build, or a reason the toolbar also leaves unsaid). */
  reason: string | null
  /** The reason is the paused-tab sentence (keeps the ONE_LIVE_TAB marker on the box, as the toolbar's does). */
  tabPaused: boolean
}

/** The toolbar's Add Slide `disabled`, with the viewer's names: `!viewerIsReady || templateModeOn || isSlideMutationPending || tabPaused`. */
export function toolbarAddSlideDisabled(input: Pick<RailAddSlideInput, 'viewerIsReady' | 'templateModeOn' | 'slideMutationPending' | 'tabPausedHint'>): boolean {
  return !input.viewerIsReady || input.templateModeOn || input.slideMutationPending || Boolean(input.tabPausedHint)
}

/** Null when the button is not drawn; otherwise whether it is greyed and what it says about it. */
export function railAddSlideState(input: RailAddSlideInput): RailAddSlideState | null {
  if (!input.panelAvailable) return null
  const tabPaused = Boolean(input.tabPausedHint)
  const disabled = toolbarAddSlideDisabled(input) || input.building
  const reason = input.disabledReasons
    ? studioToolbarDisabledReason('add-slide', {
        tabPausedHint: input.tabPausedHint,
        viewerIsReady: input.viewerIsReady,
        templateModeOn: input.templateModeOn,
        slideMutationPending: input.slideMutationPending,
      })
    : tabPaused ? (input.tabPausedHint as string) : null
  return { disabled, reason, tabPaused }
}

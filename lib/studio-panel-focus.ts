/**
 * PASS2 #3: Add Slide / Add Element no longer squeeze the canvas (flag NEXT_PUBLIC_STUDIO_PANEL_FOCUS, exact 'true',
 * default off).
 *
 * Today, in the Studio shell's side-by-side workspace, opening Add Slide (J2 v2 panel) or Add Element (the Text Labs
 * generation panel) puts the panel beside the chat AND the slide rail, so at 1440x900 the slide is left with about a
 * quarter of the width. With the flag on, while either panel is open:
 * - the chat steps aside: the workspace lays out as if the chat were closed, but the chat stays mounted (draft,
 *   transcript and scroll are kept) and `showChat`, its width and every saved preference are untouched;
 * - the slide rail steps aside the same way: the viewer takes it out of the layout and makes it invisible, without
 *   changing the user's own show/hide choice or its width; it stays mounted, so its scroll position, selection and live
 *   previews are intact when it comes back;
 * When the panel closes, both come back exactly as they were. The Director handle and the Thumbnails handle stay on
 * screen; pressing one brings that pane back for the rest of this panel's life (the user's own choice wins).
 * Only the side-by-side (dual-pane) layout collapses the chat: the narrower single-pane layout already shows the chat
 * or the panel, never both. The phone-width overlay layout is left alone (the panel already covers the canvas).
 *
 * Pure: no React, no DOM, no network.
 */
import { STUDIO_DUAL_PANE_MIN_WIDTH } from './studio-workspace-layout'

export const STUDIO_PANEL_FOCUS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_PANEL_FOCUS === 'true'

/** Panes the user brought back by hand while a creation panel is open. */
export interface StudioPanelFocusReveal {
  readonly chat: boolean
  readonly rail: boolean
}

/** Nothing brought back. One shared value, so resetting to it is a no-op state write. */
export const STUDIO_PANEL_FOCUS_NONE: StudioPanelFocusReveal = Object.freeze({ chat: false, rail: false })

/** True while a creation panel (Add Slide or Add Element) is open in the Studio shell's non-overlay workspace. */
export function studioPanelFocusActive(input: {
  enabled: boolean
  studioShell: boolean
  overlay: boolean
  addSlideOpen: boolean
  addElementOpen: boolean
}): boolean {
  return input.enabled && input.studioShell && !input.overlay && (input.addSlideOpen || input.addElementOpen)
}

/**
 * The chat's open state as the workspace allocator sees it. Equal to `chatOpen` whenever focus is off.
 * `workspaceWidth` is the width the allocator gets; it is side by side (dual pane) under the allocator's own rule.
 */
export function studioPanelFocusChatOpen(input: {
  chatOpen: boolean
  focus: boolean
  workspaceWidth: number
  revealed: boolean
}): boolean {
  const width = input.workspaceWidth
  const dualPane = !(Number.isFinite(width) && width > 0) || width >= STUDIO_DUAL_PANE_MIN_WIDTH
  return input.chatOpen && !(input.focus && dualPane && !input.revealed)
}

/** Whether the viewer should hide the slide rail for the open creation panel. False whenever focus is off. */
export function studioPanelFocusRailCollapsed(input: { focus: boolean; revealed: boolean }): boolean {
  return input.focus && !input.revealed
}

/** The rail wrapper's extra style while collapsed: out of the flex row (the canvas takes its width), invisible, inert to the pointer. */
export const STUDIO_RAIL_FOCUS_HIDDEN_STYLE = Object.freeze({
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  visibility: 'hidden',
  pointerEvents: 'none',
} as const)

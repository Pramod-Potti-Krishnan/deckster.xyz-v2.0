// STUDIO PHONE LANDSCAPE (FRONTEND-1; F-13 PR 1, PK's answers of 1 Nov). Flag NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE (exact "true", default off, read at build time), only active with the phone shell
// (NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL, both exact "true"). Import-free: the flag, the landscape-phone query, the attributes the stylesheet is keyed to, and the decisions (when the
// stage is on, the stage fit padding, the one-Menu bar fold, the action fan's entries). No I/O; the hook (hooks/use-studio-phone-landscape.ts) and the component (components/builder/studio-phone-landscape.tsx) read the page and call these.
//
// What the flag does on a phone: turned sideways (a short, coarse-pointer landscape window, not a narrow desktop window) with a deck on the stage, the page becomes a viewing stage: the slide fills the screen, the
// thumbnails are a collapsible strip on the left, the rail, top bar, Slides | Director switch, toolbar, pull tabs and the tab bar go, a "Chat" button goes back to the Director (a full-screen pane switch) and ONE floating
// button opens an overlay fan of actions (Add slide, Add element and the deck actions the phone "..." menu has). In portrait the slide view folds the bottom bar into one Menu button. Flag off, nothing here is drawn.

/** Exact "true" for the flag AND the phone shell AND the Studio shell; anything else (unset, "false", "TRUE", " true", "1") is off. The caller passes the three `process.env` values (Next inlines them at build time). */
export function studioPhoneLandscapeOn(flag: string | null | undefined, phoneShell: string | null | undefined, studioShell: string | null | undefined): boolean {
  return flag === 'true' && phoneShell === 'true' && studioShell === 'true'
}

/** The flag, resolved once at build time. Every element this change adds is drawn only when it is true. */
export const STUDIO_PHONE_LANDSCAPE_ENABLED = studioPhoneLandscapeOn(process.env.NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE, process.env.NEXT_PUBLIC_STUDIO_PHONE_SHELL, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL)

/** A phone turned sideways: height-based, not width-based (667x375, 844x390 and 932x430 all match; a short desktop window does not, its pointer is fine). The stylesheet's media query is the same text. */
export const STUDIO_PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 500px) and (pointer: coarse)'
/** The phone-shell width (components/layout/studio-phone-shell.css) that is not turned sideways: the portrait phone, where the bar folds. */
export const STUDIO_PHONE_PORTRAIT_QUERY = '(max-width: 640px) and (orientation: portrait)'

/** The attributes the page's <html> carries (set by the component, only while it is mounted); every rule of the stylesheet is keyed to one of them. */
export const STUDIO_PHONE_STAGE_ATTRIBUTE = 'data-studio-phone-landscape'
export const STUDIO_PHONE_BAR_ATTRIBUTE = 'data-studio-phone-bar'
export const STUDIO_PHONE_STRIP_ATTRIBUTE = 'data-studio-phone-strip'
export const STUDIO_PHONE_FAN_ATTRIBUTE = 'data-studio-phone-fan'

/** The stage is on only with a phone turned sideways, a deck on the stage and the stage (not the chat or a panel) the surface the user is on. */
export function studioPhoneLandscapeStage(input: { enabled: boolean; landscape: boolean; deckOnStage: boolean; stageVisible: boolean }): boolean {
  return input.enabled === true && input.landscape === true && input.deckOnStage === true && input.stageVisible === true
}

/** The portrait slide view that folds the bar: a portrait phone with a deck on the stage and the stage the surface on screen. */
export function studioPhonePortraitSlideView(input: { enabled: boolean; portrait: boolean; deckOnStage: boolean; stageVisible: boolean }): boolean {
  return input.enabled === true && input.portrait === true && input.deckOnStage === true && input.stageVisible === true
}

/** The bar's state on the page: folded to one Menu button (the slide view), open as a floating card (Menu tapped), or not this change's (the bar as the phone shell draws it). */
export type StudioPhoneBarState = 'folded' | 'open' | null
export function studioPhoneBarState(slideView: boolean, menuOpen: boolean): StudioPhoneBarState {
  if (!slideView) return null
  return menuOpen ? 'open' : 'folded'
}

/** The page's own test for "one pane at a time" is a workspace 880 px wide or narrower (app/builder/page.tsx: studioOverlayWorkspace). */
export const STUDIO_PHONE_OVERLAY_MAX_WIDTH = 880

/**
 * The workspace width the page's layout decisions are given on a phone turned sideways: never wider than the overlay threshold. The stage hides the rail, so a 926 or 932 px phone's workspace is wider than 880 px and the page would drop its one-pane layout
 * (and the stage with it, which brings the rail back, and so on); the real box is not changed, only the number the page decides by.
 */
export function studioPhoneWorkspaceWidth(landscape: boolean, width: number): number {
  return landscape === true && width > STUDIO_PHONE_OVERLAY_MAX_WIDTH ? STUDIO_PHONE_OVERLAY_MAX_WIDTH : width
}

/** The stage strip's state: open (the thumbnails on the left) or collapsed (a 30 px handle). It is its own state, never the viewer's portrait one (a rail opened sideways must not squeeze the portrait slide). */
export type StudioPhoneStripState = 'open' | 'collapsed'
export const STUDIO_PHONE_STRIP_DEFAULT: StudioPhoneStripState = 'open'
export function studioPhoneStripToggle(state: StudioPhoneStripState): StudioPhoneStripState {
  return state === 'open' ? 'collapsed' : 'open'
}

/** The viewer's own rail toggle (components/presentation-viewer.tsx draws it, `aria-expanded` says whether the rail is open); the stage uses it, it never changes the viewer. */
export const STUDIO_PHONE_RAIL_TOGGLE = '[data-studio-v4-thumbnail-toggle="true"]'

/**
 * What the stage does to the viewer's own rail toggle. `railOpen` is what the toggle says now (null: it is not on the page yet), `remembered` the viewer's own (portrait) value kept while the stage is on (null off the stage).
 * While the stage is on the rail is the strip's: it is made open or closed to match the strip's state, once, with the viewer's own value remembered first; when the stage goes off, that value is put back, and forgotten.
 */
export function studioPhoneRailSync(input: { stage: boolean; strip: StudioPhoneStripState; railOpen: boolean | null; remembered: boolean | null }): { click: boolean; remembered: boolean | null; done: boolean } {
  const { stage, strip, railOpen, remembered } = input
  if (railOpen === null) return { click: false, remembered, done: false }
  if (stage) {
    const keep = remembered === null ? railOpen : remembered
    return { click: railOpen !== (strip === 'open'), remembered: keep, done: true }
  }
  if (remembered === null) return { click: false, remembered: null, done: true }
  return { click: railOpen !== remembered, remembered: null, done: true }
}

/** The fan's entries, in the order PK's brief gives: the two authoring actions, then the deck actions the phone "..." menu has (the menu's own order), then the thumbnails strip. */
export type StudioPhoneFanKey = 'addSlide' | 'addElement' | 'newDeck' | 'export' | 'notes' | 'thumbnails' | 'slide' | 'deckList' | 'presenter'
export const STUDIO_PHONE_FAN_ORDER: readonly StudioPhoneFanKey[] = ['addSlide', 'addElement', 'newDeck', 'export', 'notes', 'thumbnails', 'slide', 'deckList', 'presenter']

/** How an entry uses the page's own control: a plain click, or the key press a menu trigger opens on (a Radix dropdown trigger opens on pointer-down and on Enter, never on a click that has no pointer). */
export const STUDIO_PHONE_FAN_OPENS_MENU: Readonly<Record<StudioPhoneFanKey, boolean>> = {
  addSlide: false, addElement: true, newDeck: false, export: true, notes: false, thumbnails: false, slide: false, deckList: false, presenter: false,
}

/** The words an entry falls back to when its control has no name of its own. */
const FAN_FALLBACK: Record<StudioPhoneFanKey, string> = {
  addSlide: 'Add slide', addElement: 'Add element', newDeck: 'New deck', export: 'Export', notes: 'Notes', thumbnails: 'Thumbnails', slide: 'Slide panel', deckList: 'Decks', presenter: 'Presenter details',
}

/** What the component read from a control: its name (aria-label, else title, else its words) and whether it is disabled. Null: the control is not on the page. */
export interface StudioPhoneFanProbe { label: string | null; disabled: boolean }

/** The fan's entries for what is on the page: one per control found, in STUDIO_PHONE_FAN_ORDER, named as the control is named, disabled when it is. The thumbnails entry is the stage strip's own and is always there. */
export function studioPhoneFanItems(probes: Partial<Record<StudioPhoneFanKey, StudioPhoneFanProbe | null>>, stripState: StudioPhoneStripState): Array<{ key: StudioPhoneFanKey; label: string; disabled: boolean }> {
  const items: Array<{ key: StudioPhoneFanKey; label: string; disabled: boolean }> = []
  for (const key of STUDIO_PHONE_FAN_ORDER) {
    if (key === 'thumbnails') { items.push({ key, label: stripState === 'open' ? 'Hide thumbnails' : 'Show thumbnails', disabled: false }); continue }
    const probe = probes[key]
    if (!probe) continue
    const label = typeof probe.label === 'string' && probe.label.trim() !== '' ? probe.label.trim() : FAN_FALLBACK[key]
    items.push({ key, label, disabled: probe.disabled === true })
  }
  return items
}

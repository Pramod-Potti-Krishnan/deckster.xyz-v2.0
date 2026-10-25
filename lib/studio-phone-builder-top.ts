// STUDIO PHONE SHELL, PR 2: the Builder top (FRONTEND-2; PK's phone review, 25 Oct, decision B). The SAME flag as PR 1, NEXT_PUBLIC_STUDIO_PHONE_SHELL (lib/studio-phone-shell.ts). Import-free: the Director
// status dot's states and the "..." menu's entries, both pure. No I/O; the component (components/builder/studio-phone-builder-top.tsx) reads the page and calls these.
//
// PK, quoted: "I like this broadly, but I would still like the slides director switch to be in one row below, and the today one in that second row. Slide director, I like better."
// So on a phone: row 1 is the logo, a "..." menu and Publish; row 2 is today's Slides | Director switch, unchanged, with a status dot on its Director segment; the separate "Director / Connected" row and
// the edge pull tabs go, and every function those had keeps a home (STUDIO_PHONE_EDGE_TAB_HOMES).

/** The connection, in the words the Director header already uses, and its dot: green connected, amber connecting or reconnecting, red otherwise (not connected and not trying right now). */
export type StudioDirectorDotTone = 'green' | 'amber' | 'red'
export interface StudioDirectorDot { tone: StudioDirectorDotTone; state: string }

/**
 * The dot for the connection state the Director hook reports (`connectionState`) and its reconnect status (`reconnectStatus`), in the Director header's own order (components/builder/chat/studio-director-header.tsx,
 * chatHeaderConnection): connected first, then the reconnect status, then the socket state. `state` is the word the Director segment's name gets ("Director connected", "Director reconnecting" ...).
 */
export function studioDirectorDot(connectionState: string | null | undefined, reconnectStatus?: string | null): StudioDirectorDot {
  if (connectionState === 'connected') return { tone: 'green', state: 'connected' }
  if (reconnectStatus === 'superseded') return { tone: 'red', state: 'open in another tab' }
  if (reconnectStatus === 'scheduled') return { tone: 'amber', state: 'reconnecting' }
  if (reconnectStatus === 'paused_offline') return { tone: 'red', state: 'offline, will retry' }
  if (reconnectStatus === 'exhausted') return { tone: 'red', state: "couldn't reconnect" }
  if (connectionState === 'connecting') return { tone: 'amber', state: 'connecting' }
  if (connectionState === 'error') return { tone: 'red', state: 'connection error' }
  return { tone: 'red', state: 'disconnected' }
}

/** The page's own controls the "..." menu opens, by the attributes they already carry. A control that is not on the page (no deck yet, the flag that draws it off) has no entry. */
export const STUDIO_PHONE_DECK_MENU_TARGETS = {
  title: '[data-studio-v4-shell-header] .studio-shell-heading > span[title]',
  newDeck: '[data-studio-v4-shell-header] .studio-shell-header-actions > .studio-shell-new',
  export: '[data-studio-v4-shell-header] [data-studio-v4-toolbar-target] [data-studio-download-control] button[aria-haspopup="menu"]',
  notes: '[data-studio-v4-shell-workspace] [data-studio-notes-handle="true"] > button',
  thumbnails: '[data-studio-v4-shell-workspace] [data-studio-v4-thumbnail-toggle="true"]',
  slide: '[data-studio-v4-shell-workspace] [data-studio-drawer-handle="slide"]',
  deckList: '[data-studio-v4-shell-header] .studio-shell-heading > button',
  presenter: '[data-studio-v4-shell-header] [data-studio-deck-identity-trigger="true"]',
} as const

export type StudioPhoneDeckMenuKey = Exclude<keyof typeof STUDIO_PHONE_DECK_MENU_TARGETS, 'title'>

/** What the component read from a control: its name (aria-label, else title) and whether it is disabled. Null: the control is not on the page. */
export interface StudioPhoneDeckMenuProbe { label: string | null; disabled: boolean }

/** The order PK's brief gives (New deck, Export, Notes) and then the rest of what row 1 and the edge tabs did. */
export const STUDIO_PHONE_DECK_MENU_ORDER: readonly StudioPhoneDeckMenuKey[] = ['newDeck', 'export', 'notes', 'thumbnails', 'slide', 'deckList', 'presenter']

/** The words an entry falls back to when its control has no name of its own. */
const FALLBACK: Record<StudioPhoneDeckMenuKey, string> = {
  newDeck: 'New deck', export: 'Export', notes: 'Notes', thumbnails: 'Thumbnails', slide: 'Slide panel', deckList: 'Decks', presenter: 'Presenter details',
}

/** The menu's entries for what is on the page: one per control found, in STUDIO_PHONE_DECK_MENU_ORDER, named as the control is named, disabled when it is. */
export function studioPhoneDeckMenuItems(probes: Partial<Record<StudioPhoneDeckMenuKey, StudioPhoneDeckMenuProbe | null>>): Array<{ key: StudioPhoneDeckMenuKey; label: string; disabled: boolean }> {
  const items: Array<{ key: StudioPhoneDeckMenuKey; label: string; disabled: boolean }> = []
  for (const key of STUDIO_PHONE_DECK_MENU_ORDER) {
    const probe = probes[key]
    if (!probe) continue
    const label = typeof probe.label === 'string' && probe.label.trim() !== '' ? probe.label.trim() : FALLBACK[key]
    items.push({ key, label, disabled: probe.disabled === true })
  }
  return items
}

/** Where each phone edge pull tab's function lives once the tabs are gone (PK: "Edge pull tabs: remove on phones"). */
export const STUDIO_PHONE_EDGE_TAB_HOMES = {
  director: 'the Director segment of the Slides | Director switch (row 2)',
  notes: 'the "..." menu: Show / Hide script and notes',
  thumbnails: 'the "..." menu: Show / Hide thumbnails',
  slide: 'the "..." menu: Open / Close slide panel',
} as const

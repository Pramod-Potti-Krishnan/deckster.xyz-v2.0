// NEXT_PUBLIC_STUDIO_PASS3_POLISH, PR D (accessibility; FRONTEND-2, Pass 3 polish set; default off, exact "true", read at build time). The SAME flag as PR A, PR B and PR C: it is PR A's STUDIO_PASS3_POLISH_ENABLED
// (exact "true" and the Studio shell), not a flag of its own.
//
// Two findings of the accessibility facts pass (scenes/facts-a11y, the run of 01:05Z):
//   (b) the Decks tab list (role="tablist", data-studio-deck-tabs) has no accessible name: components/ui/tabs.tsx gives a TabsList that carries data-studio-deck-tabs the aria-label "Deck views" (deckTabsLabel below);
//       a list the page names itself (aria-label or aria-labelledby) keeps its own name;
//   (d) /builder has no main landmark and no h1: its central workspace container (the one div that holds the chat, the canvas and the inspector) gets role="main" (useStudioPass3PolishDMain: the container is one
//       long base line, so the attribute is set on the node by an effect, like PR A sets its attribute on <html>), and a visually hidden h1 (the sr-only class the app already uses) says "Builder", or
//       "Builder: <deck title>" once the deck has a title (builderHeading).
// The session-history panel (the facts' item a) needs nothing: components/chat-history-sidebar.tsx already sets inert together with aria-hidden while the panel is closed, so its controls cannot be reached
// by Tab (the facts listed them because the check counted inert subtrees as focusable; the check is fixed).
//
// Flag off every function here returns before it reads anything and returns nothing: not an attribute, not a class, not an element.

import { useEffect, type RefObject } from 'react'
import { STUDIO_PASS3_POLISH_ENABLED } from '@/lib/studio-pass3-polish'

export const STUDIO_PASS3_POLISH_D_ENABLED = STUDIO_PASS3_POLISH_ENABLED

/** What the Decks tab list is called (it switches between the completed decks and the outline previews). */
export const DECK_VIEWS_LABEL = 'Deck views'
/** The h1 of /builder when the deck has no title (and the start of it when it has one). */
export const BUILDER_HEADING = 'Builder'

/**
 * The attribute components/ui/tabs.tsx spreads onto a TabsList after the props the page gave it: the aria-label "Deck views" for the Decks tab list (the one that carries data-studio-deck-tabs), nothing
 * for every other list, for a list that already has a name (aria-label or aria-labelledby) and with the flag off.
 */
export function deckTabsLabel(props: object): { 'aria-label'?: string } {
  if (!STUDIO_PASS3_POLISH_D_ENABLED) return {}
  const own = props as Record<string, unknown>
  if (own['data-studio-deck-tabs'] !== 'true' && own['data-studio-deck-tabs'] !== true) return {}
  if (own['aria-label'] || own['aria-labelledby']) return {}
  return { 'aria-label': DECK_VIEWS_LABEL }
}

/** The text of the hidden h1: "Builder", or "Builder: <title>" when the deck has a title (spaces collapsed, nothing else changed). */
export function builderHeading(title: unknown): string {
  const text = typeof title === 'string' ? title.replace(/\s+/g, ' ').trim() : ''
  return text ? `${BUILDER_HEADING}: ${text}` : BUILDER_HEADING
}

/**
 * role="main" on the Builder's workspace container, after every render (a node React remade has no role yet). The container is the page's own ref; the role is set only when the node has none, and it is
 * an attribute React does not manage, so no render removes it. Flag off: the effects return before they read the ref. The node goes with the page, so there is nothing to take back.
 */
export function useStudioPass3PolishDMain(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!STUDIO_PASS3_POLISH_D_ENABLED) return
    const node = ref.current
    if (node && !node.hasAttribute('role')) node.setAttribute('role', 'main')
  })
}

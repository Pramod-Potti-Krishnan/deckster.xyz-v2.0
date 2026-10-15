// PASS2B G01 + G02 (flag NEXT_PUBLIC_STUDIO_WELCOME_POLISH, default off). Import-free: pure decisions only, no React, no network, no clock.
//
// G01: the welcome's eyebrow reads "GOOD MORNING, ALEX" (the accepted v4 mockup) instead of the static "Your presentation brief".
//      Words follow the mockup's own rule: before 12:00 morning, before 17:00 afternoon, otherwise evening. The name is the first word of
//      the signed-in user's display name and nothing else: an email, an empty name or a string with no letters is never drawn, and then
//      the greeting is the time of day alone. With no clock (server render) the eyebrow keeps its static words.
// G02: the collapsed "SLIDE" edge tab is hidden while there is nothing to edit yet: the welcome screen and the outline on the canvas.

export type StudioGreetingPart = 'morning' | 'afternoon' | 'evening'

const GREETING_WORDS: Record<StudioGreetingPart, string> = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' }

/** The part of the day for a local hour (0-23). null for anything that is not such an hour. */
export function studioGreetingPart(hour: unknown): StudioGreetingPart | null {
  if (typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour > 23) return null
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
}

/**
 * The first word of a display name, or null when it should not be drawn: not a string, empty, anything with an "@" (an email stored as the
 * name), a first word with no letter in it, or one too long to be a given name (a layout guard).
 */
export function studioFirstName(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  if (!trimmed || trimmed.includes('@')) return null
  const first = trimmed.split(/\s+/)[0]
  if (!/\p{L}/u.test(first) || first.length > 24) return null
  return first
}

/** The eyebrow's words: "Good morning, Alex", "Good morning" without a usable name, `fallback` without a usable hour. */
export function studioWelcomeEyebrow({ hour, name, fallback }: { hour: unknown; name?: unknown; fallback: string }): string {
  const part = studioGreetingPart(hour)
  if (!part) return fallback
  const first = studioFirstName(name)
  return first ? `${GREETING_WORDS[part]}, ${first}` : GREETING_WORDS[part]
}

/**
 * G02: whether the collapsed Slide edge tab is left out. Only with the flag, only while its panel is closed, and only where nothing is built
 * yet: the welcome screen (`landing`) and the outline on the canvas (`activeVersion` strawman). A built deck, a hand-made blank deck and a
 * final deck that is still loading keep the tab.
 */
export function studioSlideEdgeTabHidden({ enabled, panelOpen, landing, builtDeck, activeVersion }: {
  enabled: boolean
  /** The Slide panel is open or on screen: its tab is the way to close it. */
  panelOpen: boolean
  landing: boolean
  /** A generated deck is on the canvas. */
  builtDeck: boolean
  activeVersion: 'blank' | 'strawman' | 'final'
}): boolean {
  if (!enabled || panelOpen || builtDeck) return false
  return landing || activeVersion === 'strawman'
}

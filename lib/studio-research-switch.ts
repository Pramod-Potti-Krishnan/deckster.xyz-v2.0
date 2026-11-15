// RESEARCH-SWITCH (FRONTEND-1, PK mandate M4 of 15 Nov 2026: "Research is its own switch, separate from the level, feeding the same package to every level"). Flag NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH, exact "true", default off, build-time.
// It acts only with NEXT_PUBLIC_STUDIO_V4_SHELL and NEXT_PUBLIC_STUDIO_CHAT_CLEAN on as well (each exact "true"): the switch is a chip beside the model / level button in the clean composer. Off, the composer is byte for byte what it was.
//
// WHAT IT SENDS: nothing new. Studio already sends the two research booleans on every build message (user_message data.web_search and data.deep_research, hooks/use-deckster-websocket-v2.ts), and Director already reads exactly those two (src/handlers/websocket.py,
// "Extract and latch researcher + extended generation flags": a true latches has_web_search / has_deep_research on the session, and the research settings freeze once the strawman exists, src/utils/research_settings.py). The switch is the plain on / off over them:
// ON is web search (standard research); OFF is both false. Deep research (which includes web search, the page's handlers keep that) stays in the composer's research options menu as the deeper setting on top of an ON switch. The page's handlers are the
// ones the menu uses (handleWebSearchEnabledChange: turning web search off also turns deep research off), so the switch and the menu always agree. The default is today's: off. It is independent of the level picker (lib/studio-thinking-levels.ts): the same two
// booleans go out at Fast, Balanced, Best and Max alike, and Studio sends no level-dependent research field.
// Pure: nothing here sends, stores or fetches anything.

/** Exact "true" for each of the three, and only then. */
export const studioResearchSwitchOn = (flag: string | undefined, shell: string | undefined, chatClean: string | undefined): boolean => flag === 'true' && shell === 'true' && chatClean === 'true'
export const STUDIO_RESEARCH_SWITCH_ENABLED = studioResearchSwitchOn(process.env.NEXT_PUBLIC_STUDIO_RESEARCH_SWITCH, process.env.NEXT_PUBLIC_STUDIO_V4_SHELL, process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN)

export const RESEARCH_COPY = {
  label: 'Research',
  note: 'Gather sources before building this deck. Deep research is in the research options.',
  lockedNote: 'Locked for this deck — research already ran',
} as const

/** The composer's research state the switch reads: web search, deep research (which includes web search), and whether the deck's research settings are frozen (the strawman exists). */
export interface ResearchSwitchState { web: boolean; deep: boolean; locked: boolean }
/** The switch is on while research of either depth is on. */
export const researchSwitchOn = (state: ResearchSwitchState): boolean => state.web || state.deep
/** What a click asks of the composer's web-search handler (turning it off turns deep research off with it), or null when the settings are frozen: nothing is changed then. */
export const researchSwitchNext = (state: ResearchSwitchState): boolean | null => (state.locked ? null : !researchSwitchOn(state))

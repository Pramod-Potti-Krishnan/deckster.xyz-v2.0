// RESEARCH-BY-LEVEL (FRONTEND-1, wave 1 step 0.5c "research by level"; rules settled by DIRECTOR-2, AGENT-1G and FRONTEND-1). Flag NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL, the exact string "true", default off, build-time (read once, as a literal, so Next inlines it).
// It is the levels-3/4 default: in a chat with no outline yet, moving the level picker to Best or Max turns web search on; moving it to anything else (Fast, Balanced, or Auto, the automatic return to Auto after a run or a chat change included) turns it off again, but only if THIS rule turned it on.
// The person's own change of the web switch in a chat always wins: after it the rule does nothing more in that chat. A new chat starts over. Once the chat has an outline the rule does nothing (Director locks research once the outline exists). Deep research and the knowledge graph are not touched.
// Pure: nothing here reads the page, sends, stores or fetches anything; the Builder page (app/builder/page.tsx, marked lines) keeps one state per chat in a ref, feeds this function the shown level, the chat id, the outline test and the switch's value, and sets web search when the answer carries `web`.
export const STUDIO_RESEARCH_DEFAULT_BY_LEVEL = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL === 'true'

/** What the rule remembers about one chat: which chat it is, whether the person changed the switch in it, and whether the rule itself turned web search on (so that it, and only it, turns it off again). */
export interface ResearchByLevelState { chat: string | null; touched: boolean; auto: boolean }
/** A page's first state: no chat yet, nothing touched, nothing turned on. */
export const RESEARCH_BY_LEVEL_FRESH: ResearchByLevelState = { chat: null, touched: false, auto: false }

export type ResearchByLevelEvent =
  /** The person changed the web-search (or deep-research) switch in the composer. */
  | { kind: 'touch' }
  /** The picture to decide from: the chat's id, the level the picker shows, whether the chat has no outline yet, and the switch's value now. */
  | { kind: 'level'; chat: string | null; level: string; noOutline: boolean; web: boolean }

export interface ResearchByLevelResult { state: ResearchByLevelState; web?: boolean }

/**
 * The rule, in one table. `on` is the flag (the build-time constant by default); off, nothing changes and the state is handed back as it came.
 * - touch: the person's own change in this chat; the rule does nothing more in it.
 * - level, in another chat than the state's (one the state already knew): a fresh state for that chat (a new chat starts over; the picker returns to Auto with the chat change, and the next change of level is decided on its own). The one thing carried over is the rule's own switch: if the rule turned web search on in the chat being left (the person never touched the switch there) and the new chat has no outline, the level has gone back to Auto, so web search goes back off; the base does not clear the switch when another chat is opened. A state with no chat yet takes the chat it meets, and keeps what it knew (a change made before the page's first chat had an id belongs to that chat).
 * - level, touched, or the chat has an outline: nothing.
 * - level Best or Max, switch off: web search on, and remembered as turned on by the rule. Switch already on (the person's, or any other default's): nothing, and not remembered.
 * - level anything else, and the rule turned it on: back off (when it is still on), and forgotten; the level may come back to Best or Max and turn it on again.
 */
export function researchByLevel(prev: ResearchByLevelState, event: ResearchByLevelEvent, on: boolean = STUDIO_RESEARCH_DEFAULT_BY_LEVEL): ResearchByLevelResult {
  if (on !== true) return { state: prev }
  if (event.kind === 'touch') return prev.touched ? { state: prev } : { state: { ...prev, touched: true } }
  let state = prev
  if (prev.chat !== event.chat) {
    if (prev.chat !== null) {
      const fresh: ResearchByLevelState = { chat: event.chat, touched: false, auto: false }
      return prev.auto && !prev.touched && event.web && event.noOutline ? { state: fresh, web: false } : { state: fresh }
    }
    state = { ...prev, chat: event.chat }
  }
  if (state.touched || !event.noOutline) return { state }
  if (event.level === 'best' || event.level === 'max') return event.web ? { state } : { state: { ...state, auto: true }, web: true }
  if (state.auto) return event.web ? { state: { ...state, auto: false }, web: false } : { state: { ...state, auto: false } }
  return { state }
}

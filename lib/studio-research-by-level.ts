// RESEARCH-BY-LEVEL (FRONTEND-1, wave 1 step 0.5c "research by level"; rules settled by DIRECTOR-2, AGENT-1G and FRONTEND-1). Flag NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL, the exact string "true", default off, build-time (read once, as a literal, so Next inlines it).
// It is the levels-3/4 default: in a chat with no outline yet, moving the level picker to Best or Max turns web search on; moving it to anything else (Fast, Balanced, or Auto, the automatic return to Auto after a run or a chat change included) turns it off again, but only if THIS rule turned it on.
// The person's own change of the web switch in a chat always wins: after it the rule does nothing more in that chat. A new chat starts over. Once the chat has an outline the rule does nothing (Director locks research once the outline exists). Deep research and the knowledge graph are not touched.
// Pure: nothing here reads the page, sends, stores or fetches anything; the Builder page (app/builder/page.tsx, marked lines) keeps one state per chat in a ref, feeds this function the shown level, the chat id, the outline test and the switch's value, and sets web search when the answer carries `web`.
export const STUDIO_RESEARCH_DEFAULT_BY_LEVEL = process.env.NEXT_PUBLIC_STUDIO_RESEARCH_DEFAULT_BY_LEVEL === 'true'

/**
 * What the rule remembers about one chat: which chat it is, whether the person changed the switch in it, whether the rule itself turned web search on (so that it, and only it, turns it off again), and `pending`:
 * a change of the switch made for a chat the rule has not looked at yet (the chat being opened, while it loads), kept with the id of the chat it was made for so that the state for that chat starts with it.
 */
export interface ResearchByLevelState { chat: string | null; touched: boolean; auto: boolean; pending: { chat: string | null } | null }
/** A page's first state: no chat yet, nothing touched, nothing turned on, nothing waiting. */
export const RESEARCH_BY_LEVEL_FRESH: ResearchByLevelState = { chat: null, touched: false, auto: false, pending: null }

export type ResearchByLevelEvent =
  /** The person's own choice of the web-search or deep-research switch, made for `chat`: the composer's switch (the chat the page shows when it is changed, a chat that is still loading included), or the dashboard hand-off (the chat it opens). */
  | { kind: 'touch'; chat: string | null }
  /** The picture to decide from: the chat's id, the level the picker shows, whether the chat has no outline yet, and the switch's value now. */
  | { kind: 'level'; chat: string | null; level: string; noOutline: boolean; web: boolean }

export interface ResearchByLevelResult { state: ResearchByLevelState; web?: boolean }

/**
 * The rule, in one table. `on` is the flag (the build-time constant by default); off, nothing changes and the state is handed back as it came.
 * - touch, for the chat the state knows (or for a state with no chat yet, which takes it): the person's own change in this chat; the rule does nothing more in it. For another chat (the one being opened, which the rule has not looked at: the effect waits while a chat loads): kept as `pending` with that chat's id, so that the fresh state for that chat starts touched, and the rule does not take its own switch back over it.
 * - level, in another chat than the state's (one the state already knew): a fresh state for that chat, touched if a change was kept for it (a new chat starts over otherwise; the picker returns to Auto with the chat change, and the next change of level is decided on its own). The one thing carried over is the rule's own switch: if the rule turned web search on in the chat being left (the person never touched the switch there, and has not touched it for the new chat while it loaded) and the new chat has no outline, the level has gone back to Auto, so web search goes back off; the base does not clear the switch when another chat is opened. A state with no chat yet takes the chat it meets, and keeps what it knew (a change made before the page's first chat had an id belongs to that chat).
 * - level, touched, or the chat has an outline: nothing.
 * - level Best or Max, switch off: web search on, and remembered as turned on by the rule. Switch already on (the person's, or any other default's): nothing, and not remembered.
 * - level anything else, and the rule turned it on: back off (when it is still on), and forgotten; the level may come back to Best or Max and turn it on again.
 */
export function researchByLevel(prev: ResearchByLevelState, event: ResearchByLevelEvent, on: boolean = STUDIO_RESEARCH_DEFAULT_BY_LEVEL): ResearchByLevelResult {
  if (on !== true) return { state: prev }
  if (event.kind === 'touch') {
    if (prev.chat !== null && prev.chat !== event.chat) return { state: { ...prev, pending: { chat: event.chat } } }
    return prev.touched && prev.chat === event.chat && prev.pending === null ? { state: prev } : { state: { ...prev, chat: event.chat, touched: true, pending: null } }
  }
  let state = prev
  if (prev.chat !== event.chat) {
    if (prev.chat !== null) {
      const owned = prev.pending !== null && prev.pending.chat === event.chat
      const fresh: ResearchByLevelState = { chat: event.chat, touched: owned, auto: false, pending: null }
      return !owned && prev.auto && !prev.touched && event.web && event.noOutline ? { state: fresh, web: false } : { state: fresh }
    }
    state = { ...prev, chat: event.chat, pending: null }
  } else if (prev.pending !== null) state = { ...prev, pending: null } // a change kept for another chat, and the page is in this one: it was never this chat's
  if (state.touched || !event.noOutline) return { state }
  if (event.level === 'best' || event.level === 'max') return event.web ? { state } : { state: { ...state, auto: true }, web: true }
  if (state.auto) return event.web ? { state: { ...state, auto: false }, web: false } : { state: { ...state, auto: false } }
  return { state }
}

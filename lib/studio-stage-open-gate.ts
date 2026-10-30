// STUDIO-STAGE-OPEN-GATE (flag NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE, exact "true", default off; PK UAT feedback F-03, 30 Oct). Pure decisions only: no React, no DOM, no clock, no network.
//
// PK: "Stay full-width chat during Director's clarifying questions. Open the stage only when (a) strawman/build stages start streaming, (b) the deck is ready, or (c) the user explicitly asks."
// Today (NEXT_PUBLIC_STUDIO_FIRST_RUN_V2) the chat takes the whole workspace only while the first-run welcome is in the chat; the first message removes the welcome and the empty stage appears.
// With this flag on, the page marks the stage `data-studio-stage-gate="closed"` (components/builder/studio-first-run.css keeps the chat full-width and the stage out of sight while it is there) from the
// moment a FRESH session shows its welcome until the first of the triggers below; then the gate latches open for that session and never closes again by itself.
//  - It does not follow today's landing state after the first message: Director's plan card (an accept_plan action_request) already moves the build narration to 'awaiting_user', which ends the landing
//    (lib/studio-canvas-lifecycle.ts), yet it is still the conversation (DIRECTOR-2's recording pk-f03-new-session, scenario A, turn 2). Only the triggers below open it.
//  - A workflow link, fullscreen or an open inspector opens it as today (the page's studioFirstRunStage excludes the same three), while it lasts: they do not latch; Add Slide, an inspector of its own, does.
//  - It closes only in a session seen fresh in this tab (its welcome was up: no user turn, not loading, not resumed). A restored session (history loaded, a deck or authored slides) is never closed, so it has no
//    full-width flash while it loads; a new session reloaded mid-clarification counts as restored and shows the stage (known limit).
//  - The latch is per session (currentSessionId || wsSessionId): a New Chat (a new id) starts closed again; the first adoption of an id by a session that had none keeps its state.
//  - PK Q1 (30 Oct, yes): while the gate holds the stage closed, the chat header offers "Show canvas"; a click opens the stage and latches it ('show_canvas'). The header and the page meet in a tiny store below
//    (the page publishes the gate after render and reads the click; the header reads the gate and writes the click), so the page needs no new prop. useStudioStageOpen() is for FRONTEND-1's F-09.

import { useLayoutEffect, useSyncExternalStore } from 'react'

export const STUDIO_STAGE_OPEN_GATE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE === 'true'
/** PASS2D W's column (NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560): the closed gate keeps the welcome's column width (lib/studio-welcome-width.ts). */
export const STUDIO_STAGE_GATE_WIDTH_560 = process.env.NEXT_PUBLIC_STUDIO_WELCOME_WIDTH_560 === 'true'

/**
 * (c) The typed ask. Whole phrases, matched on the user's SENT text after normalising (case, punctuation, whitespace). Conservative on purpose: a false open is cheap, a missed one just waits for the strawman.
 * One phrase per line, lower case, words separated by single spaces, no punctuation; PK may edit this list.
 */
export const STUDIO_STAGE_OPEN_PHRASES: readonly string[] = [
  'show me the deck',
  'show the deck',
  'open the deck',
  'show me the slides',
  'show the slides',
  'open the slides',
  'add slides',
  'add a slide',
  'show me the canvas',
  'open the canvas',
]

/** What latched the gate open (the first one seen wins and is kept for the session). */
export type StudioStageTrigger = 'strawman' | 'build' | 'deck' | 'authored' | 'typed' | 'blank' | 'add_slide' | 'show_canvas'
/** Why the gate is as it is: the latched trigger, or an open that does not latch, or 'closed'. */
export type StudioStageGateReason = StudioStageTrigger | 'off' | 'not_fresh' | 'workflow' | 'fullscreen' | 'inspector' | 'closed'

export interface StudioStageGateState {
  key: string | null
  /** The session was seen fresh (its welcome was up) in this tab. */
  armed: boolean
  latched: StudioStageTrigger | null
}

export interface StudioStageGateInput {
  /** NEXT_PUBLIC_STUDIO_STAGE_OPEN_GATE, the Studio shell and NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 all on. */
  enabled: boolean
  /** currentSessionId || wsSessionId. */
  sessionKey: string | null | undefined
  /** The page's studioWelcome (the canvas lifecycle's landing): read only to see that a session starts fresh (arming). */
  landing: boolean
  workflow: boolean
  fullscreen: boolean
  inspector: boolean
  /** session.isLoadingSession / session.isResumedSession. */
  historyLoading: boolean
  resumed: boolean
  /** session.userMessages (only `.text` is read). */
  userMessages: readonly { text?: unknown }[]
  generatingStrawman: boolean
  generatingFinal: boolean
  /** The effective narration phase (buildNarration.active ? buildNarration.phase : 'idle'). */
  phase: string
  hasGeneratedDeck: boolean
  /** The session owns a final deck (its URL arrived), even before the viewer has it selected. */
  hasOwnedFinal: boolean
  hasAuthoredDeck: boolean
  /** The blank-canvas choice (blankPlaceholderDismissed). */
  blankChosen: boolean
  /** The Add Slide panel is open (addSlideV2Open). */
  addSlideOpen: boolean
  /** The chat header's "Show canvas" was clicked in this session (useStudioStageCanvasAsked). */
  canvasAsked?: boolean
}

export interface StudioStageGate {
  closed: boolean
  reason: StudioStageGateReason
  state: StudioStageGateState
}

/** Lower case, NFKC, apostrophes dropped, every run of anything but letters and digits made one space, trimmed. */
export function normaliseStageAsk(text: unknown): string {
  if (typeof text !== 'string') return ''
  return text.normalize('NFKC').toLowerCase().replace(/['’‘`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** The phrase the text asks with, as a whole phrase (word boundaries), or null. */
export function matchStageAsk(text: unknown, phrases: readonly string[] = STUDIO_STAGE_OPEN_PHRASES): string | null {
  const said = normaliseStageAsk(text)
  if (!said) return null
  const padded = ` ${said} `
  for (const phrase of phrases) {
    const wanted = normaliseStageAsk(phrase)
    if (wanted && padded.includes(` ${wanted} `)) return phrase
  }
  return null
}

/**
 * Phases that mean the build is under way or past: anything but idle, planning (the plan being drafted: the stage would only be empty), strawman (its own trigger) and awaiting_user, which the narration
 * enters at the plan card (from planning: still the conversation) and at the outline gate (from strawman, which has already opened the stage).
 */
function buildPhase(phase: string): boolean {
  return phase !== 'idle' && phase !== 'planning' && phase !== 'strawman' && phase !== 'awaiting_user'
}

/** The latching trigger present in this input, or null. Order: deck, build, strawman, authored, blank, Add Slide, Show canvas, typed. */
export function studioStageTrigger(input: StudioStageGateInput): StudioStageTrigger | null {
  if (input.hasGeneratedDeck || input.hasOwnedFinal) return 'deck'
  if (input.generatingFinal || buildPhase(String(input.phase || 'idle'))) return 'build'
  if (input.generatingStrawman || input.phase === 'strawman') return 'strawman'
  if (input.hasAuthoredDeck) return 'authored'
  if (input.blankChosen) return 'blank'
  if (input.addSlideOpen) return 'add_slide'
  if (input.canvasAsked === true) return 'show_canvas'
  if ((input.userMessages || []).some(message => matchStageAsk(message?.text) !== null)) return 'typed'
  return null
}

/** The session key the gate keeps its latch under: the id, or null for none yet ('new' is none). */
export function normaliseSessionKey(sessionKey: unknown): string | null {
  return typeof sessionKey === 'string' && sessionKey.trim() && sessionKey !== 'new' ? sessionKey : null
}

const EMPTY: StudioStageGateState = Object.freeze({ key: null, armed: false, latched: null }) as StudioStageGateState

function same(a: StudioStageGateState, b: StudioStageGateState): boolean {
  return a.key === b.key && a.armed === b.armed && a.latched === b.latched
}

/**
 * One step of the gate: the previous state (null the first time) and this render's input give whether the stage is held closed, why, and the state to keep. Never mutates `prev`; returns it unchanged
 * (the same object) when nothing moved. Flag off: never closed, and the state is not touched.
 */
export function stepStudioStageGate(prev: StudioStageGateState | null | undefined, input: StudioStageGateInput): StudioStageGate {
  const before = prev ?? EMPTY
  if (input.enabled !== true) return { closed: false, reason: 'off', state: before }
  const key = normaliseSessionKey(input.sessionKey)
  let next: StudioStageGateState
  if (before.key === key) next = before
  else if (before.key === null && key !== null && before !== EMPTY) next = { ...before, key } // a session without an id adopts one: the same conversation
  else next = { key, armed: false, latched: null } // another session (a New Chat, the sidebar): starts over
  const fresh = input.landing === true && !input.historyLoading && !input.resumed && (input.userMessages || []).length === 0
  const armed = input.resumed ? false : next.armed || fresh
  const latched = next.latched ?? studioStageTrigger(input)
  const candidate: StudioStageGateState = { key: next.key, armed, latched }
  const state = same(candidate, before) ? before : candidate
  const override: StudioStageGateReason | null = input.workflow ? 'workflow' : input.fullscreen ? 'fullscreen' : input.inspector ? 'inspector' : null
  const closed = state.armed && state.latched === null && override === null
  const reason: StudioStageGateReason = state.latched ?? (!state.armed ? 'not_fresh' : override ?? 'closed')
  return { closed, reason, state }
}

/** Props for the stage (presentation) element: the marker while the gate is closed, `{}` (no key at all) otherwise. */
export function studioStageGateProps(closed: boolean, width560: boolean = STUDIO_STAGE_GATE_WIDTH_560): { 'data-studio-stage-gate'?: 'closed'; 'data-studio-stage-gate-width'?: '560' } {
  if (closed !== true) return {}
  return width560 === true ? { 'data-studio-stage-gate': 'closed', 'data-studio-stage-gate-width': '560' } : { 'data-studio-stage-gate': 'closed' }
}

// ---- the store the page and the chat header share (no new prop on either) ----------------------------------------------------------------------------------------------------------------------
export interface StudioStageGateSnapshot {
  /** The session the page last published. */
  key: string | null
  /** The gate holds the stage closed (the page's studioStageGate.closed). */
  closed: boolean
  /** "Show canvas" was clicked while that session's stage was closed. */
  ask: { key: string | null } | null
}

export function createStudioStageGateStore() {
  let snapshot: StudioStageGateSnapshot = { key: null, closed: false, ask: null }
  const listeners = new Set<() => void>()
  const set = (next: StudioStageGateSnapshot) => {
    if (next.key === snapshot.key && next.closed === snapshot.closed && next.ask === snapshot.ask) return
    snapshot = next
    for (const listener of [...listeners]) listener()
  }
  return {
    getSnapshot: (): StudioStageGateSnapshot => snapshot,
    subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener) } },
    /** The page, after each render: this session's gate. */
    publish(sessionKey: unknown, closed: boolean) { set({ ...snapshot, key: normaliseSessionKey(sessionKey), closed: closed === true }) },
    /** The header's click: asks for the stage of the session on screen; nothing while the stage is not held closed. */
    askCanvas() { if (snapshot.closed) set({ ...snapshot, ask: { key: snapshot.key } }) },
    /** Whether `sessionKey`'s "Show canvas" was clicked. */
    asked(sessionKey: unknown): boolean { return snapshot.ask !== null && snapshot.ask.key === normaliseSessionKey(sessionKey) },
  }
}

export const studioStageGateStore = createStudioStageGateStore()

/** One boolean read of the store; a component re-renders only when that boolean changes (the server snapshot is the client's: the store only ever changes in the browser, after the page has rendered). */
function useStudioStageGateBoolean(read: () => boolean): boolean {
  return useSyncExternalStore(studioStageGateStore.subscribe, read, read)
}

const readClosed = () => studioStageGateStore.getSnapshot().closed

/** For FRONTEND-1 (F-09, the quiet chat line while the stage is hidden): true whenever the flag is off or the gate is open. */
export function useStudioStageOpen(): boolean {
  const closed = useStudioStageGateBoolean(readClosed)
  return !STUDIO_STAGE_OPEN_GATE_ENABLED || !closed
}

/** The chat header's "Show canvas": its click handler while the gate holds the stage closed, else null (nothing is drawn). */
export function useStudioStageShowCanvas(): (() => void) | null {
  return useStudioStageOpen() ? null : studioStageGateStore.askCanvas
}

/** The page: whether this session's "Show canvas" was clicked. The page re-renders only when that answer changes (the click), never for its own publish. */
export function useStudioStageCanvasAsked(sessionKey: unknown): boolean {
  const key = normaliseSessionKey(sessionKey)
  return useStudioStageGateBoolean(() => studioStageGateStore.asked(key))
}

/** The page: publishes this render's gate after the render (before paint), and clears it when the page goes. */
export function useStudioStageGatePublish(sessionKey: unknown, closed: boolean): void {
  const key = normaliseSessionKey(sessionKey)
  useLayoutEffect(() => { studioStageGateStore.publish(key, closed === true) }, [key, closed])
  useLayoutEffect(() => () => { studioStageGateStore.publish(null, false) }, [])
}

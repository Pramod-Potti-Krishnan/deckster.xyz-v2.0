// CHAT-PARITY-C2 (FRONTEND-1): the executors of Director's `deck_ops` studio_action requests (cap `deckops1`, flag NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS), one per action, each calling the SAME function the click
// path calls: the viewer's own go-to-slide, native Add Slide (blank), Change Layout, Present, Mode and rail handlers (components/presentation-viewer.tsx, reached through the viewer's bus), the welcome's own "Start on a blank
// canvas", the Duplicate a deck path (lib/studio-duplicate-deck.ts runDuplicateDeck), the Sessions list's own delete (useChatSessions.deleteSession + its cache cleanup). lib/studio-chat-parity-c2.ts decides what a request is;
// this file does the running and returns a result with a known status on every exit. The page hands in `deps` (it holds the state and the I/O); a fake can stand in for all of it.
// What `done` means here (Director: "Report done only for observed or persisted completion, never queued work, an opened dialog, an optimistic state update", c2-deck-contract.md):
//   goto: the viewer's own order of slides (Layout's composeGetState) shows the named slide selected; add: one more slide, a new id at the insertion index, every other slide where it was; change layout: the same deck shape
//   and Layout's own record of that slide's layout (its slide inventory) reads the requested layout; present: the browser is in full screen; mode / rail: the viewer's state reads the requested value; rename: the saved row
//   answers the new title; duplicate: the copy's session row is saved; delete: the server acknowledged the delete; start blank: the canvas is started. Evidence that does not come in time is `timeout`, evidence that disagrees is a failure.
// Director waits 25 s for an answer (mdc_studio_action.DEFAULT_TIMEOUT_SECONDS :47); the whole run is held to CHAT_PARITY_DECKOPS_BUDGET_MS, so Studio answers first.
// Studio shows no chat line of its own: Director closes the turn with its fixed line (mdc_chat_parity_deck.closing_text :426), which points at the button on a failure.

import {
  chatParityC2AddVerified, chatParityC2CountStale, chatParityC2LayoutShapeKept, chatParityC2Result, chatParityC2TargetStale, CHAT_PARITY_C2_BLANK_LAYOUT,
  type ChatParityC2ErrorCode, type ChatParityC2SlideOrder, type ChatParityDeckOpsArgs,
} from '@/lib/studio-chat-parity-c2'
import { duplicateTargetFor, runDuplicateDeck, type DuplicateDeckDeps, type ViewerUrlDecision } from '@/lib/studio-duplicate-deck'
import type { ChatParityResultData } from '@/lib/studio-chat-parity'

/** The whole run's budget: inside Director's 25 s so Studio's answer, not Director's timeout line, is what the user reads. */
export const CHAT_PARITY_DECKOPS_BUDGET_MS = 20_000
/** How long a write's evidence is waited for, and how often it is read. */
export const CHAT_PARITY_DECKOPS_EVIDENCE_MS = 12_000
export const CHAT_PARITY_DECKOPS_POLL_MS = 250

/** What the viewer registers on the C2 bus (components/presentation-viewer.tsx, one marked effect): the viewer's own handlers, never a copy of them. */
export interface ChatParityDeckOpsViewer {
  /** handleAddSlide(layoutId, options): the native Add Slide, called as the Add Slide panel's Blank button calls it. */
  addSlide: (layout: string, options?: { position?: number; backgroundColor?: string }) => Promise<void>
  /** handleChangeLayout(slideIndex, layout): the slide's ⋯ menu → Change Layout. */
  changeLayout: (slideIndex: number, layout: string) => Promise<void>
  /** handleFullscreen(): the toolbar's Present. It toggles, so the executor calls it only when the browser is not in full screen. */
  present: () => Promise<void>
  /** handleToggleEditModeButton(requestedMode): true = Edit, false = View; the requested mode, never a blind toggle. */
  setMode: (edit: boolean) => Promise<void>
  /** setShowThumbnails(visible): the slide rail's own state. */
  setRail: (visible: boolean) => void
  /** The viewer's live state, read at call time. */
  state: () => { ready: boolean; mutationPending: boolean; editMode: boolean; rail: boolean }
}

/** The bus between the viewer and the page (the idiom of chatParityBus.openMaster in lib/studio-chat-parity.ts): the viewer sets `viewer` in one gated effect and clears it on unmount; the page's deps read it at call time. One viewer per page. */
export const chatParityDeckOpsBus: { viewer: ChatParityDeckOpsViewer | null } = { viewer: null }

export interface ChatParityDeckOpsSessionDeps {
  /** PATCH /api/sessions/{id} { title } (useChatSessions.updateSession): the title the saved row answers, null when the save did not come back. */
  rename: (sessionId: string, name: string) => Promise<string | null>
  /** useChatSessions.deleteSession plus the Sessions list's own cache cleanup (components/chat-history-sidebar.tsx handleDeleteSession): true only when the server acknowledged. */
  deleteDeck: (sessionId: string) => Promise<boolean>
  /** The Builder's New flow (handleNewChatWrapped), as the Sessions list calls it after it deletes the open deck. Run AFTER the answer is sent. */
  startNew: () => void
  /** Duplicate a deck (NEXT_PUBLIC_STUDIO_DUPLICATE_DECK): null with that flag off (no click path then). */
  duplicate: {
    loadSession: (sessionId: string) => Promise<{ title?: string | null; currentStage?: number | null; slideCount?: number | null; finalPresentationUrl?: string | null; strawmanPreviewUrl?: string | null } | null>
    evaluateUrl: (url: string) => ViewerUrlDecision
    deps: DuplicateDeckDeps
  } | null
}

export interface ChatParityDeckOpsDeps {
  sessionId: () => string | null
  viewer: () => ChatParityDeckOpsViewer | null
  /** The viewer's go-to-slide (layoutServiceApis.goToSlide, the viewer's handleGoToSlide). */
  goToSlide: () => ((slideIndex: number) => Promise<void>) | null
  /** Layout's own order of slides from the viewer (composeGetState): 'busy' while a compose placeholder is on screen, null when it cannot be read now. */
  readOrder: () => Promise<ChatParityC2SlideOrder | 'busy' | null>
  /** The layout code Layout holds for the slide at this index (its slide inventory), null when it cannot be read. */
  readLayout: (slideIndex: number) => Promise<string | null>
  /** The options the Add Slide panel's Blank button passes for a position (addSlideV2BlankNativeOptions). */
  blankOptions: (position: number) => { position?: number; backgroundColor?: string } | undefined
  /** What stops a write: a build running, this tab paused for another, a template in use. Read at call time. */
  gate: () => { building: boolean; paused: boolean; templateMode: boolean }
  /** document.fullscreenElement is set. */
  fullscreen: () => boolean
  /** The welcome's "Start on a blank canvas": null when this build has no such control. */
  blank: { available: () => boolean; start: () => void; started: () => boolean } | null
  session: ChatParityDeckOpsSessionDeps
  wait: (ms: number) => Promise<void>
  now: () => number
}

export interface ChatParityDeckOpsOutcome {
  data: ChatParityResultData
  /** Runs after the answer has been sent (a deleted open deck starts a new session only then: the answer goes on the socket of the deck it belongs to). */
  after: (() => void) | null
}

const fail = (requestId: string, code: ChatParityC2ErrorCode): ChatParityDeckOpsOutcome => ({ data: chatParityC2Result(requestId, 'failed', code), after: null })
const done = (requestId: string, after: (() => void) | null = null): ChatParityDeckOpsOutcome => ({ data: chatParityC2Result(requestId, 'done'), after })

/** The layout code Layout's slide inventory holds for one slide (GET {layout}/api/presentations/{id}/slides/inventory, the read the stale-viewer guard's signature already makes), null when it cannot be read. */
export async function readChatParityInventoryLayout(input: { fetch: (input: string, init?: RequestInit) => Promise<Response>; baseUrl: string; presentationId: string | null; slideIndex: number }): Promise<string | null> {
  if (!input.presentationId) return null
  try {
    const response = await input.fetch(`${input.baseUrl.replace(/\/+$/, '')}/api/presentations/${encodeURIComponent(input.presentationId)}/slides/inventory`, { cache: 'no-store' })
    if (!response.ok) return null
    const body: unknown = await response.json()
    const rows = (body as { slides?: unknown } | null)?.slides
    const row = Array.isArray(rows) ? (rows[input.slideIndex] as { layout?: unknown } | undefined) : undefined
    return row && typeof row.layout === 'string' && row.layout ? row.layout : null
  } catch { return null }
}

/** Polls `read` until it returns a value `accept` takes, or the window ends. Returns the last value read and whether it was accepted. */
async function until<T>(deps: Pick<ChatParityDeckOpsDeps, 'wait' | 'now'>, windowMs: number, read: () => Promise<T> | T, accept: (value: T) => boolean): Promise<{ ok: boolean; last: T | undefined }> {
  const end = deps.now() + windowMs
  let last: T | undefined
  for (;;) {
    try { last = await read() } catch { /* a read that throws is a read that did not come back */ }
    if (last !== undefined && accept(last)) return { ok: true, last }
    if (deps.now() >= end) return { ok: false, last }
    await deps.wait(CHAT_PARITY_DECKOPS_POLL_MS)
  }
}

/** The viewer's order of slides, read until it is there (a short retry: the iframe may be answering another command), 'busy' as soon as a compose placeholder shows. */
async function readOrderSettled(deps: ChatParityDeckOpsDeps, windowMs = 3_000): Promise<ChatParityC2SlideOrder | 'busy' | null> {
  const result = await until(deps, windowMs, () => deps.readOrder(), value => value !== null)
  return result.last ?? null
}

type Gate = { block: ChatParityC2ErrorCode | null; viewer: ChatParityDeckOpsViewer | null }

/** The write gate: a build, a paused tab, a template in use or a slide write still pending waits (Director's own rule, mdc_chat_parity_deck._busy :197); the viewer must be ready. Reads never come here. */
function writeGate(deps: ChatParityDeckOpsDeps, needsViewer: boolean): Gate {
  const state = deps.gate()
  const viewer = deps.viewer()
  if (state.building || state.paused || state.templateMode) return { block: 'busy', viewer }
  if (needsViewer) {
    if (!viewer || !viewer.state().ready) return { block: 'viewer_unavailable', viewer }
    if (viewer.state().mutationPending) return { block: 'busy', viewer }
  }
  return { block: null, viewer }
}

export async function runChatParityDeckOpsAction(requestId: string, args: ChatParityDeckOpsArgs, deps: ChatParityDeckOpsDeps): Promise<ChatParityDeckOpsOutcome> {
  const sessionId = deps.sessionId()
  switch (args.action) {
    case 'goto_slide': {
      const goTo = deps.goToSlide()
      if (!goTo) return fail(requestId, 'viewer_unavailable')
      const before = await readOrderSettled(deps)
      if (before === 'busy') return fail(requestId, 'busy')
      if (!before) return fail(requestId, 'viewer_unavailable')
      if (chatParityC2TargetStale(before, args.target)) return fail(requestId, 'stale_target')
      await goTo(args.target.slideIndex)
      const seen = await until(deps, 3_000, () => deps.readOrder(), value => value !== null && value !== 'busy' && value.currentVisualIndex === args.target.slideIndex && value.slideIds[args.target.slideIndex] === args.target.slideId)
      return seen.ok ? done(requestId) : fail(requestId, 'write_failed')
    }
    case 'add_blank_slide': {
      const gate = writeGate(deps, true)
      if (gate.block || !gate.viewer) return fail(requestId, gate.block ?? 'viewer_unavailable')
      const before = await readOrderSettled(deps)
      if (before === 'busy') return fail(requestId, 'busy')
      if (!before) return fail(requestId, 'viewer_unavailable')
      if (chatParityC2CountStale(before, args.expectedSlideCount) || (args.target && chatParityC2TargetStale(before, args.target))) return fail(requestId, 'stale_target')
      // The native Add Slide's position is the 0-based slot the slide lands in (components/presentation-viewer.tsx handleAddSlide: "Insert after current slide", currentSlide being 1-based), so the insertion index is passed as it is.
      await gate.viewer.addSlide(CHAT_PARITY_C2_BLANK_LAYOUT, deps.blankOptions(args.insertionIndex))
      const seen = await until(deps, CHAT_PARITY_DECKOPS_EVIDENCE_MS, () => deps.readOrder(), value => value !== null && value !== 'busy' && value.nativeCount > before.nativeCount)
      if (!seen.ok) return fail(requestId, 'timeout')
      return chatParityC2AddVerified(before, seen.last as ChatParityC2SlideOrder, args.insertionIndex) ? done(requestId) : fail(requestId, 'write_failed')
    }
    case 'change_layout': {
      const gate = writeGate(deps, true)
      if (gate.block || !gate.viewer) return fail(requestId, gate.block ?? 'viewer_unavailable')
      const before = await readOrderSettled(deps)
      if (before === 'busy') return fail(requestId, 'busy')
      if (!before) return fail(requestId, 'viewer_unavailable')
      if (chatParityC2TargetStale(before, args.target)) return fail(requestId, 'stale_target')
      // Already that layout (Layout's own record): nothing to change, and the deck is as asked.
      if ((await deps.readLayout(args.target.slideIndex).catch(() => null)) === args.layout) return done(requestId)
      await gate.viewer.changeLayout(args.target.slideIndex, args.layout)
      // Layout's own record is read until it shows the requested layout (the change may still be settling when the handler returns); a layout that is readable and still the old one at the end is a failure, one that cannot be read is unknown.
      const seen = await until(deps, CHAT_PARITY_DECKOPS_EVIDENCE_MS, async () => {
        const order = await deps.readOrder()
        if (order === null || order === 'busy') return null
        return { order, layout: await deps.readLayout(args.target.slideIndex).catch(() => null) }
      }, value => value !== null && value.layout === args.layout)
      if (!seen.ok || !seen.last) return seen.last && seen.last.layout !== null ? fail(requestId, 'write_failed') : fail(requestId, 'timeout')
      return chatParityC2LayoutShapeKept(before, seen.last.order, args.target.slideIndex) ? done(requestId) : fail(requestId, 'write_failed')
    }
    case 'present': {
      if (deps.fullscreen()) return done(requestId)
      const viewer = deps.viewer()
      if (!viewer || !viewer.state().ready) return fail(requestId, 'viewer_unavailable')
      // The browser wants a recent user gesture for full screen; one that is gone is refused (fullscreen_denied), never claimed.
      await viewer.present()
      const seen = await until(deps, 1_500, () => deps.fullscreen(), value => value === true)
      return seen.ok ? done(requestId) : fail(requestId, 'fullscreen_denied')
    }
    case 'set_view_mode': {
      const viewer = deps.viewer()
      if (!viewer || !viewer.state().ready) return fail(requestId, 'viewer_unavailable')
      const edit = args.mode === 'edit'
      if (viewer.state().editMode === edit) return done(requestId)
      await viewer.setMode(edit)
      const seen = await until(deps, 3_000, () => viewer.state().editMode, value => value === edit)
      return seen.ok ? done(requestId) : fail(requestId, 'write_failed')
    }
    case 'set_slide_rail': {
      const viewer = deps.viewer()
      if (!viewer || !viewer.state().ready) return fail(requestId, 'viewer_unavailable')
      if (viewer.state().rail === args.visible) return done(requestId)
      viewer.setRail(args.visible)
      const seen = await until(deps, 1_500, () => viewer.state().rail, value => value === args.visible)
      return seen.ok ? done(requestId) : fail(requestId, 'write_failed')
    }
    case 'start_blank_canvas': {
      const blank = deps.blank
      // Director's own line for these: "Use Start on a blank canvas on the welcome screen. If a deck is already open, use New first." Studio never starts a canvas over an open deck.
      if (!blank || !blank.available()) return fail(requestId, 'unsupported')
      const state = deps.gate()
      if (state.building || state.paused) return fail(requestId, 'busy')
      blank.start()
      const seen = await until(deps, 3_000, () => blank.started(), value => value === true)
      return seen.ok ? done(requestId) : fail(requestId, 'write_failed')
    }
    case 'rename_deck': {
      const state = deps.gate()
      if (state.building || state.paused) return fail(requestId, 'busy')
      if (!sessionId) return fail(requestId, 'no_deck')
      const saved = await deps.session.rename(sessionId, args.name)
      return saved === args.name ? done(requestId) : fail(requestId, 'write_failed')
    }
    case 'duplicate_deck': {
      const state = deps.gate()
      if (state.building || state.paused) return fail(requestId, 'busy')
      const copy = deps.session.duplicate
      if (!copy) return fail(requestId, 'unsupported')
      if (!sessionId) return fail(requestId, 'no_deck')
      const row = await copy.loadSession(sessionId)
      if (!row) return fail(requestId, 'not_found')
      const target = duplicateTargetFor(row, copy.evaluateUrl)
      if (!target.ok) return fail(requestId, 'unsupported')
      const shownTitle = typeof row.title === 'string' && row.title.trim() ? row.title : 'Untitled Presentation'
      const result = await runDuplicateDeck({ source: { sessionId, shownTitle, currentStage: row.currentStage ?? null, slideCount: row.slideCount ?? null }, target, deps: copy.deps })
      if (result.ok) return done(requestId)
      return fail(requestId, result.step === 'layout' && (result.reason === 'unavailable' || result.reason === 'not_configured') ? 'unsupported' : 'write_failed')
    }
    case 'delete_deck': {
      // Director's card was clicked before this frame existed (structured action_value only); the id in the frame is that card's single-use token. A deleted open deck leaves for a new session only after the answer is sent.
      const state = deps.gate()
      if (state.building || state.paused) return fail(requestId, 'busy')
      if (!sessionId) return fail(requestId, 'no_deck')
      const acknowledged = await deps.session.deleteDeck(sessionId)
      return acknowledged ? done(requestId, () => deps.session.startNew()) : fail(requestId, 'write_failed')
    }
    default: {
      const never: never = args
      void never
      return fail(requestId, 'unsupported')
    }
  }
}

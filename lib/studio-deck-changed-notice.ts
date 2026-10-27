/**
 * MULTITAB J2 P1: a second tab never learned that the first one changed the deck (tab A 7 slides, tab B still 6) and gave no warning.
 *
 * Flag NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE (exact "true", default off). Off, nothing here runs: every entry point below returns
 * before doing anything, the page renders no notice, and no request, timer, listener or channel is created.
 *
 * Why it happened: Add Slide goes viewer -> Layout, not through Director, and Director keeps one socket per session, so no path told
 * another tab. Studio re-read the deck only after its own mutations. This module adds the missing tab-to-tab signal WITHOUT touching
 * the WebSocket:
 *  1. a tab that changes the deck (slide add / delete / duplicate / reorder / layout, element create / delete, theme apply, a
 *     Director deck_mutation) posts one small message on a BroadcastChannel keyed by session id + presentation id (ids only, no PII);
 *  2. a tab that receives one shows a calm notice, "This deck changed in another tab" with "Reload deck", and reads the slide
 *     inventory ONCE through the existing read path (fetchSlideInventory, no new endpoint);
 *  3. a tab that becomes visible / focused reads the inventory once (throttled) and shows the same notice when the slide count or
 *     the inventory differs from what this tab last knew. That covers another browser profile or device, where no channel reaches.
 * "Reload deck" reuses the existing deck reload (a new refresh token on the viewer URL, plus the rail's inventory re-read). It is
 * always the user's click: nothing here reloads on its own, and a tab with edits that are not saved yet asks first.
 *
 * Never loops: a tab ignores its own messages; receiving a message, reloading and the rail's re-read post nothing; sends are throttled
 * with a trailing send, are suppressed for a moment after a received message or a reload (those acks are consequences, not edits),
 * and a circuit breaker caps the rate. A superseded second tab (NEXT_PUBLIC_STUDIO_ONE_LIVE_TAB) still receives notices: the channel
 * does not depend on the Director socket.
 *
 * Import-free (types only) so scripts/test-studio-deck-changed-notice.mjs can run it under plain node. The Next build inlines the flag.
 */

/** Read as a literal so the Next build inlines it into client bundles. */
export const STUDIO_DECK_CHANGED_NOTICE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE === 'true'
/** P3-4 (flag NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC, exact "true", default off; acts only with the notice flag on): after Director's
 * socket reconnects, the tab reads the slide inventory once and, when the deck differs from what it shows, reloads it (no unsaved
 * edits) or shows the notice (unsaved edits: the user decides). Off: resyncAfterReconnect is never called. */
export const STUDIO_RECONNECT_RESYNC_ENABLED = process.env.NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC === 'true'
/** At most one reconnect resync read per this gap (a reconnect loop, or two tabs fighting over one session, cannot hammer Layout). */
export const RECONNECT_RESYNC_MIN_GAP_MS = 10_000

export type DeckChangeKind = 'slide' | 'element' | 'theme'

/** The Layout viewer commands whose success ack means the deck changed (slide structure, element create / delete). */
const SLIDE_COMMANDS: ReadonlySet<string> = new Set([
  'addSlide', 'duplicateSlide', 'deleteSlides', 'reorderSlides', 'changeSlideLayout',
  // Slide Composer / Refine: the generated slide landing in the deck.
  'composeSlideReconcile', 'refineSlideReconcile',
])
const ELEMENT_COMMANDS: ReadonlySet<string> = new Set([
  'insertTextBox', 'insertTable', 'insertImage', 'insertChart', 'insertInfographic', 'insertDiagram', 'insertShape',
  'upsertSemanticElement', 'upsertCitedElement', 'deleteElement', 'deleteTextBox',
  // Elementor generation that injects into Layout (acked by its own response, not a viewer command).
  'generateImage', 'generateChartData', 'generateInfographic', 'generateDiagram', 'generateTableData', 'generateText',
])

/** null = this command does not change the shared deck (navigation, edit mode, reads, previews, placeholders...). */
export function classifyDeckCommand(action: unknown): DeckChangeKind | null {
  if (typeof action !== 'string') return null
  if (SLIDE_COMMANDS.has(action)) return 'slide'
  if (ELEMENT_COMMANDS.has(action)) return 'element'
  return null
}

// ---------------------------------------------------------------- message

export const DECK_CHANGED_MESSAGE_VERSION = 1

/** The whole wire payload: ids and a kind. No names, titles, e-mail or content. */
export interface DeckChangedMessage {
  v: typeof DECK_CHANGED_MESSAGE_VERSION
  type: 'deck-changed'
  tabId: string
  sessionId: string
  presentationId: string
  change: DeckChangeKind
  sentAt: number
}

/** One channel per session + deck: a tab on another deck or session never even receives the message. */
export function deckChangedChannelName(sessionId: string | null | undefined, presentationId: string | null | undefined): string | null {
  if (typeof sessionId !== 'string' || typeof presentationId !== 'string') return null
  const session = sessionId.trim()
  const deck = presentationId.trim()
  if (!session || !deck || session.length > 200 || deck.length > 200) return null
  return `deckster:deck-changed:v${DECK_CHANGED_MESSAGE_VERSION}:${session}:${deck}`
}

const CHANGES: ReadonlySet<string> = new Set(['slide', 'element', 'theme'])

/** null = ignore: not ours, not valid, from this very tab, or about another session / deck. */
export function parseDeckChangedMessage(
  data: unknown,
  expected: { sessionId: string; presentationId: string; tabId: string },
): DeckChangedMessage | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const m = data as Record<string, unknown>
  if (m.v !== DECK_CHANGED_MESSAGE_VERSION || m.type !== 'deck-changed') return null
  if (typeof m.tabId !== 'string' || !m.tabId || m.tabId === expected.tabId) return null
  if (m.sessionId !== expected.sessionId || m.presentationId !== expected.presentationId) return null
  if (typeof m.change !== 'string' || !CHANGES.has(m.change)) return null
  if (typeof m.sentAt !== 'number' || !Number.isFinite(m.sentAt)) return null
  return {
    v: DECK_CHANGED_MESSAGE_VERSION, type: 'deck-changed', tabId: m.tabId,
    sessionId: m.sessionId as string, presentationId: m.presentationId as string,
    change: m.change as DeckChangeKind, sentAt: m.sentAt,
  }
}

// ---------------------------------------------------------------- theme apply

/** How long a theme the user picked here may wait for Director's confirmation and still count as that pick. */
export const THEME_PICK_ANNOUNCE_WINDOW_MS = 60_000

/**
 * A theme the user picked in this tab reaches the shared deck when Director confirms it (the page's theme sync turns `applied`).
 * `pickedAt` is when the user picked (null = nobody did: the connect-time sync, a restored theme and another tab's pick never
 * announce). 'drop' = that sync failed (nothing changed) or the pick is too old to be the one being confirmed; 'wait' = not yet.
 */
export function themeAnnounceDecision(
  pickedAt: number | null,
  now: number,
  sync: { status: string; requestId: string | null },
): 'announce' | 'drop' | 'wait' {
  if (pickedAt === null) return 'wait'
  if (now - pickedAt > THEME_PICK_ANNOUNCE_WINDOW_MS) return 'drop'
  if (sync.requestId === null) return 'wait'
  if (sync.status === 'applied') return 'announce'
  if (sync.status === 'failed') return 'drop'
  return 'wait'
}

// ---------------------------------------------------------------- inventory comparison

/** The slice of Layout's slide inventory this module needs (lib/slide-rail-identity.ts SlideInventory is assignable to it). */
export interface DeckInventoryLike {
  slideCount: number
  slides: ReadonlyArray<{ slideId: string; contentVersion: string | null; layout?: string | null }>
}

/** Same slides, same order, same content versions -> same signature. */
export function inventorySignature(inventory: DeckInventoryLike): string {
  return `${inventory.slideCount}|${inventory.slides.map(s => `${s.slideId}:${s.layout ?? ''}:${s.contentVersion ?? ''}`).join(',')}`
}

/**
 * Whether a fresh inventory read differs from what this tab shows.
 *  - count: the viewer's slide count versus the inventory's slide_count (null viewer count = unknown, no verdict);
 *  - signature: only when this tab has a baseline from an earlier read of its own (it is cleared by this tab's own edits, so
 *    its own autosaves never read as "another tab").
 */
export function inventoryDiffers(input: { viewerSlideCount: number | null; readCount: number; readSignature: string; knownSignature: string | null }): boolean {
  if (input.viewerSlideCount === null || !Number.isFinite(input.viewerSlideCount)) return false
  // An empty inventory is not a deck another tab left behind (Layout hiding an untouched blank deck, a read racing a rebuild): no verdict.
  if (input.readCount <= 0) return false
  if (input.readCount !== input.viewerSlideCount) return true
  return input.knownSignature !== null && input.knownSignature !== input.readSignature
}

// ---------------------------------------------------------------- controller

export type DeckChangedNoticeSource = 'broadcast' | 'visibility' | 'focus' | 'reconnect'

export interface DeckChangedNotice {
  id: number
  source: DeckChangedNoticeSource
  /** What the other tab did; null when a visibility / focus read found the difference. */
  change: DeckChangeKind | null
}

export interface DeckChangedChannel {
  postMessage(data: unknown): void
  close(): void
  onmessage: ((event: { data: unknown }) => void) | null
}

export interface DeckChangedViewerState {
  presentationId: string | null
  /** The slide count the viewer shows. null until its iframe is ready. */
  slideCount: number | null
  /** The viewer has edits that Layout has not confirmed saved. */
  unsaved: boolean
}

interface EventTargetLike {
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

export interface DeckChangedControllerDeps {
  sessionId: string
  presentationId: string
  tabId: string
  /** null = BroadcastChannel is unavailable: only the visibility / focus path runs. */
  createChannel: (name: string) => DeckChangedChannel | null
  /** ONE inventory read through the existing path (fetchSlideInventory). null = unavailable or failed. */
  readInventory: () => Promise<DeckInventoryLike | null>
  getViewerState: () => DeckChangedViewerState
  onNotice: (notice: DeckChangedNotice | null) => void
  doc?: (EventTargetLike & { visibilityState?: string }) | null
  win?: EventTargetLike | null
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  /** Minimum gap between two sends (the first send of a burst goes at once, the rest collapse into one trailing send). */
  sendThrottleMs?: number
  /** After this tab's own change / edit, visibility checks stay quiet (its viewer count may lag a moment). */
  ownChangeQuietMs?: number
  /** After a received message or a reload, this tab's own acks are consequences, not edits, and are not announced. */
  echoQuietMs?: number
  /** Minimum gap between two visibility / focus reads (visibilitychange + focus fire as a pair). */
  checkMinGapMs?: number
  /** Circuit breaker: at most this many sends in `breakerWindowMs`. */
  breakerMaxSends?: number
  breakerWindowMs?: number
  /** P3-4 reconnect resync: the page's deck reload, run when a reconnect finds the deck changed and the viewer has no unsaved edits. */
  onResync?: () => void
  /** Minimum gap between two reconnect resync reads (RECONNECT_RESYNC_MIN_GAP_MS). */
  reconnectMinGapMs?: number
  /** DECK-SYNC-TRUTH (NEXT_PUBLIC_STUDIO_DECK_SYNC_TRUTH, the three below are passed only with it on): a difference found this soon after a change announced on this tab (Director's deck_mutation, the tab's own viewer ack) is that change's, not another tab's. */ // DECK-SYNC-TRUTH
  directorWindowMs?: number // DECK-SYNC-TRUTH
  /** DECK-SYNC-TRUTH: the page's deck reload, run quietly (no notice) for such a difference when the viewer has no unsaved edits. */ // DECK-SYNC-TRUTH
  quietRefresh?: () => void // DECK-SYNC-TRUTH
  /** DECK-SYNC-TRUTH: a difference nobody announced is shown only if it is still there this long after it was found (a viewer restored with an old count corrects itself on its first poll). */ // DECK-SYNC-TRUTH
  confirmDelayMs?: number // DECK-SYNC-TRUTH
}

export interface DeckChangedController {
  /** This tab changed the deck. */
  announce(change: DeckChangeKind): void
  /** This tab edited the deck (autosave): its own edits must not read as another tab's. */
  noteOwnEdit(): void
  /** The tab became visible / focused: read the inventory once and compare. */
  check(source?: 'visibility' | 'focus'): Promise<void>
  /** The user chose Reload deck (the caller then runs the reload). */
  markReloaded(): void
  dismiss(): void
  dispose(): void
  getNotice(): DeckChangedNotice | null
  /** P3-4: Director's socket reconnected. Read the inventory once; a changed deck is reloaded (onResync, no unsaved edits) or noticed. */
  resyncAfterReconnect(): Promise<'reloaded' | 'notice' | 'same' | 'skipped' | 'deferred'>
}

export function createDeckChangedController(deps: DeckChangedControllerDeps): DeckChangedController {
  const now = deps.now ?? Date.now
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer = deps.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  const sendThrottleMs = deps.sendThrottleMs ?? 250
  const ownChangeQuietMs = deps.ownChangeQuietMs ?? 5000
  const echoQuietMs = deps.echoQuietMs ?? 1500
  const checkMinGapMs = deps.checkMinGapMs ?? 5000
  const breakerMaxSends = deps.breakerMaxSends ?? 20
  const breakerWindowMs = deps.breakerWindowMs ?? 10_000
  const reconnectMinGapMs = deps.reconnectMinGapMs ?? RECONNECT_RESYNC_MIN_GAP_MS
  let nextReconnectAt = 0
  let reconnectRetryTimer: unknown = null
  /** This tab is editing (its own-change quiet window): resync once that window ends, never during the user's own edits. */
  const deferReconnect = (t: number) => {
    if (reconnectRetryTimer === null) reconnectRetryTimer = setTimer(() => { reconnectRetryTimer = null; void api.resyncAfterReconnect() }, ownChangeQuietUntil - t + 50)
    return 'deferred' as const
  }

  let disposed = false
  let notice: DeckChangedNotice | null = null
  let noticeSeq = 0
  let lastSentAt = Number.NEGATIVE_INFINITY
  let queuedChange: DeckChangeKind | null = null
  let sendTimer: unknown = null
  let recentSends: number[] = []
  let ownChangeQuietUntil = 0
  let echoQuietUntil = 0
  let reloadedAt = Number.NEGATIVE_INFINITY
  let nextCheckAt = 0
  let checking = false
  let knownSignature: string | null = null
  let lastRead: { count: number; signature: string } | null = null
  let reading: Promise<{ count: number; signature: string } | null> | null = null
  let lastAnnounceAt = Number.NEGATIVE_INFINITY // DECK-SYNC-TRUTH: when a change was last announced on this tab
  let confirmTimer: unknown = null // DECK-SYNC-TRUTH: a found difference waiting to be confirmed

  const channelName = deckChangedChannelName(deps.sessionId, deps.presentationId)
  let channel: DeckChangedChannel | null = null
  if (channelName) {
    try { channel = deps.createChannel(channelName) } catch { channel = null }
  }

  const show = (source: DeckChangedNoticeSource, change: DeckChangeKind | null) => {
    noticeSeq += 1
    notice = { id: noticeSeq, source, change }
    deps.onNotice(notice)
  }
  // DECK-SYNC-TRUTH: what a difference found on a focus or visibility check becomes. A change announced on this tab a moment ago explains it: refresh quietly (nothing unsaved), never "another tab".
  // DECK-SYNC-TRUTH: Otherwise it is shown only if it outlasts confirmDelayMs. Called only with confirmDelayMs set (the flag on); the flag off never reaches it.
  const settleDifference = (source: 'visibility' | 'focus', read: { count: number; signature: string }, previous: string | null, confirmed: boolean): void => { // DECK-SYNC-TRUTH
    confirmTimer = null // DECK-SYNC-TRUTH
    if (disposed || notice) return // DECK-SYNC-TRUTH
    const viewer = deps.getViewerState() // DECK-SYNC-TRUTH
    if (viewer.presentationId !== deps.presentationId) return // DECK-SYNC-TRUTH
    if (!inventoryDiffers({ viewerSlideCount: viewer.slideCount, readCount: read.count, readSignature: read.signature, knownSignature: previous })) return // DECK-SYNC-TRUTH: the viewer caught up
    if (deps.quietRefresh && !viewer.unsaved && deps.directorWindowMs !== undefined && now() - lastAnnounceAt <= deps.directorWindowMs) { api.markReloaded(); deps.quietRefresh(); return } // DECK-SYNC-TRUTH
    if (!confirmed && deps.confirmDelayMs !== undefined) { confirmTimer = setTimer(() => settleDifference(source, read, previous, true), deps.confirmDelayMs); return } // DECK-SYNC-TRUTH
    show(source, null) // DECK-SYNC-TRUTH
  } // DECK-SYNC-TRUTH

  /** The ONE inventory read per notice: concurrent callers share it. */
  const readOnce = (): Promise<{ count: number; signature: string } | null> => {
    if (reading) return reading
    reading = (async () => {
      try {
        const inventory = await deps.readInventory()
        if (disposed || !inventory) return null
        lastRead = { count: inventory.slideCount, signature: inventorySignature(inventory) }
        return lastRead
      } catch {
        return null
      } finally {
        reading = null
      }
    })()
    return reading
  }

  const flushSend = () => {
    sendTimer = null
    if (disposed || queuedChange === null || !channel) { queuedChange = null; return }
    const t = now()
    recentSends = recentSends.filter(at => t - at < breakerWindowMs)
    if (recentSends.length >= breakerMaxSends) { queuedChange = null; return }
    const change = queuedChange
    queuedChange = null
    const message: DeckChangedMessage = {
      v: DECK_CHANGED_MESSAGE_VERSION, type: 'deck-changed', tabId: deps.tabId,
      sessionId: deps.sessionId, presentationId: deps.presentationId, change, sentAt: t,
    }
    try { channel.postMessage(message) } catch { return }
    recentSends.push(t)
    lastSentAt = t
  }

  const handleMessage = (event: { data: unknown }) => {
    if (disposed) return
    let message: DeckChangedMessage | null = null
    try {
      message = parseDeckChangedMessage(event?.data, { sessionId: deps.sessionId, presentationId: deps.presentationId, tabId: deps.tabId })
    } catch { message = null }
    if (!message) return
    // Sent before this tab last reloaded the deck: the reload already includes that change.
    if (message.sentAt < reloadedAt) return
    echoQuietUntil = now() + echoQuietMs
    if (notice) return // one notice, one read: a second message while it is up adds nothing
    show('broadcast', message.change)
    void readOnce()
  }
  if (channel) channel.onmessage = handleMessage

  const onVisibility = () => {
    if (deps.doc && deps.doc.visibilityState && deps.doc.visibilityState !== 'visible') return
    void api.check('visibility')
  }
  const onFocus = () => { void api.check('focus') }
  if (deps.doc) deps.doc.addEventListener('visibilitychange', onVisibility)
  if (deps.win) deps.win.addEventListener('focus', onFocus)

  const api: DeckChangedController = {
    announce(change) {
      if (disposed) return
      const t = now()
      lastAnnounceAt = t // DECK-SYNC-TRUTH
      ownChangeQuietUntil = t + ownChangeQuietMs
      knownSignature = null
      if (t < echoQuietUntil) return
      queuedChange = change
      if (sendTimer !== null) return // a send is already scheduled: it carries the latest change
      const wait = Math.max(0, lastSentAt + sendThrottleMs - t)
      if (wait === 0) flushSend()
      else sendTimer = setTimer(flushSend, wait)
    },
    noteOwnEdit() {
      if (disposed) return
      ownChangeQuietUntil = now() + ownChangeQuietMs
      knownSignature = null
    },
    async check(source = 'visibility') {
      if (disposed || notice || checking) return
      if (confirmTimer !== null) return // DECK-SYNC-TRUTH: a difference is already waiting to be confirmed
      if (deps.doc && deps.doc.visibilityState && deps.doc.visibilityState !== 'visible') return
      const t = now()
      if (t < nextCheckAt || t < ownChangeQuietUntil) return
      nextCheckAt = t + checkMinGapMs
      checking = true
      try {
        const read = await readOnce()
        if (!read || disposed || notice) return
        if (now() < ownChangeQuietUntil) return // this tab changed the deck while the read was in flight
        const viewer = deps.getViewerState()
        const previous = knownSignature
        knownSignature = read.signature
        if (viewer.presentationId !== deps.presentationId) return
        if (inventoryDiffers({ viewerSlideCount: viewer.slideCount, readCount: read.count, readSignature: read.signature, knownSignature: previous })) {
          if (deps.confirmDelayMs !== undefined) { settleDifference(source, read, previous, false); return } // DECK-SYNC-TRUTH
          show(source, null)
        }
      } finally {
        checking = false
      }
    },
    markReloaded() {
      if (disposed) return
      if (confirmTimer !== null) { clearTimer(confirmTimer); confirmTimer = null } // DECK-SYNC-TRUTH
      const t = now()
      reloadedAt = t
      echoQuietUntil = t + echoQuietMs
      // What the reload loads is at least what the last read saw; a later difference is a new change.
      knownSignature = lastRead ? lastRead.signature : null
      nextCheckAt = t + checkMinGapMs
      if (notice) { notice = null; deps.onNotice(null) }
    },
    dismiss() {
      if (disposed || !notice) return
      notice = null
      nextCheckAt = now() + checkMinGapMs
      if (lastRead) knownSignature = lastRead.signature // the user has seen this change
      deps.onNotice(null)
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (sendTimer !== null) { clearTimer(sendTimer); sendTimer = null }
      if (reconnectRetryTimer !== null) { clearTimer(reconnectRetryTimer); reconnectRetryTimer = null }
      if (confirmTimer !== null) { clearTimer(confirmTimer); confirmTimer = null } // DECK-SYNC-TRUTH
      queuedChange = null
      if (channel) {
        channel.onmessage = null
        try { channel.close() } catch { /* a closed channel is fine */ }
        channel = null
      }
      if (deps.doc) deps.doc.removeEventListener('visibilitychange', onVisibility)
      if (deps.win) deps.win.removeEventListener('focus', onFocus)
      notice = null
    },
    getNotice: () => notice,
    async resyncAfterReconnect() {
      if (disposed || checking) return 'skipped'
      // A hidden tab waits: its visibility check reads the inventory when the user comes back.
      if (deps.doc && deps.doc.visibilityState && deps.doc.visibilityState !== 'visible') return 'skipped'
      const t = now()
      if (t < nextReconnectAt) return 'skipped'
      if (t < ownChangeQuietUntil) return deferReconnect(t)
      nextReconnectAt = t + reconnectMinGapMs
      checking = true
      try {
        const read = await readOnce()
        if (!read || disposed) return 'skipped'
        if (now() < ownChangeQuietUntil) { nextReconnectAt = 0; return deferReconnect(now()) } // this tab edited while the read was in flight
        const viewer = deps.getViewerState()
        const previous = knownSignature
        knownSignature = read.signature
        if (viewer.presentationId !== deps.presentationId) return 'skipped'
        if (!inventoryDiffers({ viewerSlideCount: viewer.slideCount, readCount: read.count, readSignature: read.signature, knownSignature: previous })) return 'same'
        if (notice) return 'notice' // a notice is already up: the user decides
        if (viewer.unsaved || !deps.onResync) { show('reconnect', null); return 'notice' }
        api.markReloaded()
        deps.onResync()
        return 'reloaded'
      } finally {
        checking = false
      }
    },
  }
  return api
}

// ---------------------------------------------------------------- bridge (viewer / page -> the notice hook)
// The viewer (components/presentation-viewer.tsx) and the page hand over what only they see; the hook listens. Same pattern as
// lib/studio-deck-mutation-refresh.ts' rail refresh requests. Every entry returns at once with the flag off.

type DeckChangeListener = (change: DeckChangeKind) => void
const changeListeners = new Set<DeckChangeListener>()
const editListeners = new Set<() => void>()

/** The hook subscribes to deck changes made in THIS tab. */
export function onDeckChange(listener: DeckChangeListener): () => void {
  changeListeners.add(listener)
  return () => { changeListeners.delete(listener) }
}

/** The hook subscribes to this tab's own autosave activity. */
export function onOwnDeckEdit(listener: () => void): () => void {
  editListeners.add(listener)
  return () => { editListeners.delete(listener) }
}

/** This tab changed the deck. */
export function reportDeckChange(change: DeckChangeKind): void {
  if (!STUDIO_DECK_CHANGED_NOTICE_ENABLED) return
  for (const listener of Array.from(changeListeners)) {
    try { listener(change) } catch { /* a listener never breaks the caller */ }
  }
}

/** A successful Layout viewer command ack (or an Elementor injection): reported only when it changes the shared deck. */
export function reportLayoutCommandAck(action: string): void {
  if (!STUDIO_DECK_CHANGED_NOTICE_ENABLED) return
  const change = classifyDeckCommand(action)
  if (change) reportDeckChange(change)
}

/** The viewer saw an unsaved / saving / error save status: this tab is editing. */
export function reportOwnDeckEdit(): void {
  if (!STUDIO_DECK_CHANGED_NOTICE_ENABLED) return
  for (const listener of Array.from(editListeners)) {
    try { listener() } catch { /* ignore */ }
  }
}

const EMPTY_VIEWER_STATE: DeckChangedViewerState = { presentationId: null, slideCount: null, unsaved: false }
let viewerState: DeckChangedViewerState = EMPTY_VIEWER_STATE
const viewerListeners = new Set<() => void>()

/** The viewer reports the deck it shows (null slideCount until its iframe is ready) and whether it has unsaved edits. */
export function reportViewerDeckState(state: DeckChangedViewerState | null): void {
  if (!STUDIO_DECK_CHANGED_NOTICE_ENABLED) return
  const next = state ?? EMPTY_VIEWER_STATE
  if (next.presentationId === viewerState.presentationId && next.slideCount === viewerState.slideCount && next.unsaved === viewerState.unsaved) return
  viewerState = next
  for (const listener of Array.from(viewerListeners)) {
    try { listener() } catch { /* ignore */ }
  }
}

export function getViewerDeckState(): DeckChangedViewerState {
  return viewerState
}

export function onViewerDeckState(listener: () => void): () => void {
  viewerListeners.add(listener)
  return () => { viewerListeners.delete(listener) }
}

/** A random id for this tab's lifetime. Not derived from anything about the user. */
let tabIdMemo: string | null = null
export function getDeckChangedTabId(): string {
  if (tabIdMemo) return tabIdMemo
  let id: string | null = null
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
    if (c && typeof c.randomUUID === 'function') id = c.randomUUID()
  } catch { id = null }
  tabIdMemo = id ?? `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return tabIdMemo
}

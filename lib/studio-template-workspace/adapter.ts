// PASS2-PK-FOUR item 4 (frontend-2): THE adapter between an event source and the template workspace. Flag
// NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE (default off; nothing imports this module's runtime with the flag off).
//
// Every event the workspace sees passes through `TemplateWorkspaceStore.receive`: validated by `normaliseTemplateWorkspaceEvent`
// (contract.ts), then applied by `reduceTemplateWorkspace` (state.ts). One store per upload, shared by every surface that shows it
// (workspace, top bar, Template ▾ picker, library card, toast), so they always agree and a source runs once.
//
// Sources:
//  - MOCK (dev/test only): deterministic and timer-driven (./mock-source.ts). Used only when NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE_MOCK
//    is exactly "true" AT BUILD TIME. The import below sits behind that literal check, so a build without the switch has no mock code.
//  - DIRECTOR: see `createDirectorJobSource` (a TODO until COMPOSER-2 / Director deliver the events). This module never touches the
//    Director WebSocket: no reducer, no send path.
import { useMemo, useSyncExternalStore } from 'react'
import { normaliseTemplateWorkspaceEvent, type TemplateWorkspaceEvent } from './contract'
import { initialTemplateWorkspaceState, reduceTemplateWorkspace, type TemplateWorkspaceState } from './state'
import type { TemplateWorkspaceRecord } from './registry'

/** One element of a fixture slide (the mock deck), as drawn. */
export interface TemplateFixtureElement {
  id: string
  kind: string
  role: string
  policy: 'fixed' | 'fillable'
}

/** A deck the workspace can draw itself (mock only). The real as-is deck is drawn by the Layout viewer from `viewer_url`. */
export interface TemplateFixtureDeck {
  /** Trusted, static fixture HTML of one slide at 960x540 (never user or network content). */
  slideHtml(index: number): string
  slideLabel(index: number): string
  slideElements(index: number): TemplateFixtureElement[]
}

export type TemplateStartMode = 'new_topic' | 'as_is'

/** What the user can ask of a job. A source leaves out what it cannot do, and the workspace then hides that control. */
export interface TemplateWorkspaceCommands {
  /** "Finish now" after a pause, "Try again" after a retryable failure. */
  resume?: () => void
  /** Start a NEW deck from this template (PK, Q3). Resolves with a line to tell the user. */
  startDeck?: (mode: TemplateStartMode) => Promise<string>
}

export interface TemplateWorkspaceSource {
  kind: 'mock' | 'director'
  /** Starts the stream (replaying anything already known), returns stop. `emit` takes RAW events: the store validates them. */
  subscribe(emit: (raw: unknown) => void): () => void
  commands: TemplateWorkspaceCommands
  /** Mock only. Resolves once the fixture deck is loaded. */
  fixture?: () => TemplateFixtureDeck | null
}

// ── the real source (later PR) ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * TODO(COMPOSER-2 + Director, S4/S5): the real source, in a later PR once the events exist. Interface to keep:
 *  1. The job: the upload dialog's builder session (`record.session_id`) already gets a Director ingest job; its id is written by the
 *     existing WebSocket hook to sessionStorage `deckster_ingest_job_<session id>` (INGEST_JOB_KEY_PREFIX). Read it from there; do not
 *     add a send or a reducer branch to the socket.
 *  2. The stream: poll the existing proxy `GET /api/ingest-jobs/{job_id}` at the job's `poll.next_interval_ms` (or read pushes of the
 *     same job status), and turn each NEW part of a snapshot into contract events: `stage` + `slides_converted`, `as_is_ready`
 *     (template id, presentation id + viewer_url, counts, the S4 "What changed" report), the per-slide array as slide_analysing /
 *     slide_analysed (+ roles by element id) / slide_locked / slide_unlockable (+ reason), `slides_done` / `slide_count` + ETA,
 *     `template_ready` (+ capability projection, learned layouts), `paused` / `failed` (+ reason, retryable). Pass a `seq` if the
 *     job status has one. Snapshots repeat: that is fine, the reducer is idempotent.
 *  3. Commands: `resume` (Finish now / Retry) and `startDeck` (a NEW deck from the template: as-is = the composer "use original"
 *     path, new topic = Director) once Director exposes them; until then leave them out and the controls stay hidden.
 * Until then this source emits nothing, so the workspace stays in its "converting" state; keep the flag off outside dev/test.
 */
export function createDirectorJobSource(record: TemplateWorkspaceRecord): TemplateWorkspaceSource {
  void record
  return { kind: 'director', subscribe: () => () => {}, commands: {} }
}

// ── the mock source (dev/test switch, build time) ───────────────────────────────────────────────────────────────────────

function createSource(record: TemplateWorkspaceRecord, userKey: string): TemplateWorkspaceSource {
  if (process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE_MOCK === 'true') {
    // Dev/test only: a build without the switch never reaches (or bundles) this import.
    let loaded: TemplateWorkspaceSource | null = null
    let loading: Promise<TemplateWorkspaceSource> | null = null
    const load = () => (loading ||= import('./mock-source').then(mod => (loaded = mod.createMockTemplateWorkspaceSource(record, userKey))))
    return {
      kind: 'mock',
      subscribe(emit) {
        let stop: (() => void) | null = null
        let stopped = false
        void load().then(source => { if (!stopped) stop = source.subscribe(emit) })
        return () => { stopped = true; stop?.() }
      },
      commands: {
        resume: () => { void load().then(source => source.commands.resume?.()) },
        startDeck: mode => load().then(source => source.commands.startDeck ? source.commands.startDeck(mode) : ''),
      },
      fixture: () => loaded?.fixture?.() ?? null,
    }
  }
  return createDirectorJobSource(record)
}

// ── the store: one per (account, upload) ─────────────────────────────────────────────────────────────────────────────────

export interface TemplateWorkspaceSnapshot {
  state: TemplateWorkspaceState
  fixture: TemplateFixtureDeck | null
  sourceKind: TemplateWorkspaceSource['kind']
}

export class TemplateWorkspaceStore {
  private snapshot: TemplateWorkspaceSnapshot
  private listeners = new Set<() => void>()
  private stopSource: (() => void) | null = null
  private stopTimer: ReturnType<typeof setTimeout> | null = null
  /** Events dropped by validation or for another job (diagnostics only; dropping never re-renders anything). */
  dropped = 0

  constructor(readonly record: TemplateWorkspaceRecord, readonly source: TemplateWorkspaceSource) {
    // The job id is learned from the first valid event; events for any other job are then ignored.
    this.snapshot = { state: initialTemplateWorkspaceState(''), fixture: null, sourceKind: source.kind }
  }

  get commands(): TemplateWorkspaceCommands {
    return this.source.commands
  }

  getSnapshot = (): TemplateWorkspaceSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    if (this.stopTimer) { clearTimeout(this.stopTimer); this.stopTimer = null }
    if (!this.stopSource) this.stopSource = this.source.subscribe(raw => this.receive(raw))
    return () => {
      this.listeners.delete(listener)
      // A re-render unsubscribes and subscribes again at once; only stop when nobody is left a moment later.
      if (this.listeners.size === 0 && !this.stopTimer) {
        this.stopTimer = setTimeout(() => {
          this.stopTimer = null
          if (this.listeners.size === 0 && this.stopSource) { this.stopSource(); this.stopSource = null }
        }, 1500)
      }
    }
  }

  /** The single entry point for events. */
  receive(raw: unknown): void {
    const event: TemplateWorkspaceEvent | null = normaliseTemplateWorkspaceEvent(raw)
    if (!event) { this.dropped += 1; return }
    let { state } = this.snapshot
    if (state.jobId === '') state = initialTemplateWorkspaceState(event.job_id)
    if (event.job_id !== state.jobId) { this.dropped += 1; return }
    const next = reduceTemplateWorkspace(state, event)
    const fixture = this.source.fixture?.() ?? null
    if (next === this.snapshot.state && fixture === this.snapshot.fixture) return
    this.snapshot = { ...this.snapshot, state: next, fixture }
    this.listeners.forEach(listener => listener())
  }
}

const stores = new Map<string, TemplateWorkspaceStore>()

export function templateWorkspaceStore(userKey: string, record: TemplateWorkspaceRecord): TemplateWorkspaceStore {
  const key = `${userKey}\n${record.session_id}`
  let store = stores.get(key)
  if (!store) {
    store = new TemplateWorkspaceStore(record, createSource(record, userKey))
    stores.set(key, store)
  }
  return store
}

const idle: TemplateWorkspaceSnapshot = { state: initialTemplateWorkspaceState(''), fixture: null, sourceKind: 'director' }
const subscribeToNothing = () => () => {}
const readIdle = () => idle

/** The workspace state of one upload (or an idle snapshot when there is none). */
export function useTemplateWorkspace(userKey: string | null, record: TemplateWorkspaceRecord | null): { snapshot: TemplateWorkspaceSnapshot; store: TemplateWorkspaceStore | null } {
  const store = useMemo(() => (userKey && record ? templateWorkspaceStore(userKey, record) : null), [userKey, record?.session_id]) // eslint-disable-line react-hooks/exhaustive-deps
  const snapshot = useSyncExternalStore(store ? store.subscribe : subscribeToNothing, store ? store.getSnapshot : readIdle, readIdle)
  return { snapshot, store }
}

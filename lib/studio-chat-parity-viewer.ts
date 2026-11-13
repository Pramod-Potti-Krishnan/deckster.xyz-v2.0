/**
 * FRONTEND-1, overnight chat parity (10 Nov), the VIEWER half: "/" commands that do what a viewer button does.
 * Gated by NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (which already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell). No new flag, no backend, no Director change.
 *
 * ONE small bus, module level, in two halves:
 *   the viewer (components/presentation-viewer.tsx) REGISTERS a getter of its latest { state, actions } in a gated effect (the same shape as the Master opener on chatParityBus);
 *   the composer (components/builder/chat/studio-chat-commands.tsx) EMITS a command and shows the answer, and reads the viewer's state to draw each row enabled or disabled.
 * Every action is the handler the matching button calls; every state field is what that button reads. A command that runs says what happened AFTER it looked: it reads the viewer's state again
 * and never reports a change it did not see. Everything here is pure or module-level state: no React, no DOM, nothing from the network.
 *
 *   /goto N            handleGoToSlide(N - 1)                  /next, /prev       handleNextSlide / handlePrevSlide
 *   /blank-slide       handleAddSlide('B1-blank', {position})  /layout <name>     handleChangeLayout(this slide, id)   the names are SLIDE_LAYOUTS, matched loosely
 *   /present           handleFullscreen                        /edit, /view       handleToggleEditModeButton(the mode asked for)
 *   /rail show|hide    handleToggleOverview (the rail button)  /grid, /borders    handleToggleGrid / handleToggleBorders
 *   /save              handleSaveChanges                       /discard           handleCancelEdits (its own confirm box: a typed word never confirms)
 *   /version custom|strawman|final   the Version menu's onVersionSwitch            /canvas   the Show canvas button's own function
 *   /theme <preset>    the theme popup's preset chip (ChatInput handlePresetChange -> the page's handleBuildThemeChange), before the build only
 */
import { SLIDE_LAYOUTS } from '@/types/elements'
import { addSlideV2BlankNativeOptions, type AddSlideV2BlankTarget } from '@/lib/studio-add-slide-v2'

// ---- the words (one place) ------------------------------------------------------------------------------------------------------------------

/** The viewer's own "the slide is not there yet" reason (lib/studio-disabled-reasons.ts REASON_VIEWER_LOADING, the same words). */
const LOADING = 'Loading the slide…'

export const PARITY_WORDS = Object.freeze({
  loading: LOADING,
  noDeck: 'Open or build a deck first.',
  noSlides: 'There are no slides yet.',
  building: 'A build is running. Wait for it, or stop it first.',
  lastSlide: "You're on the last slide.",
  firstSlide: "You're on the first slide.",
  alreadyEditing: 'Already in Edit mode.',
  alreadyViewing: 'Already in View mode.',
  nothingToSave: 'Everything is saved already.',
  saving: 'Saving now…',
  notEditing: 'Switch to Edit mode first.',
  canvasOpen: 'The canvas is already open.',
  noThemes: 'No themes to choose from yet.',
  gotoHint: (count: number) => (count > 0 ? `Type a slide number, 1 to ${count}.` : 'Type a slide number.'),
  gotoRange: (count: number) => `This deck has ${count} slide${count === 1 ? '' : 's'}.`,
  noLayout: (typed: string) => `No layout matches "${typed}". Try Text, Chart or Comparison.`,
  noTheme: (typed: string) => `No theme matches "${typed}".`,
  railHint: 'Say /rail show or /rail hide.',
  onOffHint: (name: string) => `Say /${name} on or /${name} off.`,
  versionHint: 'Pick Custom, Strawman or Final.',
  nothingAfter: (name: string) => `Nothing goes after /${name}.`,
  noVersion: (label: string) => `There is no ${label} version yet.`,
  alreadyShowing: 'Already showing it.',
  railAlready: (show: boolean) => (show ? 'The rail is already showing.' : 'The rail is already hidden.'),
  onOffAlready: (label: string, on: boolean) => `${label} is already ${on ? 'on' : 'off'}.`,
})

// ---- what the viewer says about itself, and what it can do -----------------------------------------------------------------------------------

export type VersionName = 'blank' | 'strawman' | 'final'
export const VERSION_LABELS: Readonly<Record<VersionName, string>> = Object.freeze({ blank: 'Custom', strawman: 'Strawman', final: 'Final' })
const VERSION_WORDS: Readonly<Record<string, VersionName>> = Object.freeze({ custom: 'blank', strawman: 'strawman', final: 'final' })

/** What a button reads. Plain data: the viewer builds it on every render, the bus compares it by value. */
export interface ViewerState {
  /** The slide is on screen and answers commands (the toolbar's viewerIsReady). */
  ready: boolean
  /** How many slides the deck has, and the one on screen (1-based). */
  slideCount: number
  slide: number
  editing: boolean
  grid: boolean
  borders: boolean
  /** The rail is visible (the user's choice, and not folded away by a panel). */
  rail: boolean
  presenting: boolean
  /** A build is filling the deck (the viewer's isGenerating). */
  building: boolean
  /** Why Add Slide cannot start now, in the Add Slide button's own words (loading, a paused tab, Template Mode, a change in flight), else null. Change layout waits on the same things. */
  slideReason: string | null
  save: 'saved' | 'saving' | 'unsaved' | 'error'
  version: { active: VersionName; has: VersionName[] }
}

export interface ViewerActions {
  goTo: (index: number) => unknown
  next: () => unknown
  prev: () => unknown
  /** A string answer is the reason the add was refused (the page's own: a compose placeholder is on screen). */
  addBlank: (position: number) => unknown
  /** true when the viewer confirmed the change (handleChangeLayout's own success path). */
  changeLayout: (index: number, layout: string) => unknown
  present: () => unknown
  setEditing: (editing: boolean) => unknown
  setRail: (show: boolean) => unknown
  toggleGrid: () => unknown
  toggleBorders: () => unknown
  save: () => unknown
  discard: () => unknown
  setVersion: (version: VersionName) => unknown
}

export interface ViewerHandle { state: ViewerState; actions: ViewerActions }

/** The part of the page the composer hands this feature: where a note goes (the thread). */
export interface ChatParityPage { addNote?: (text: string) => void }

// ---- the commands ---------------------------------------------------------------------------------------------------------------------------

export type ViewerRun =
  | { name: 'goto'; slide: number }
  | { name: 'next' }
  | { name: 'prev' }
  | { name: 'blank-slide' }
  | { name: 'layout'; layout: string; label: string }
  | { name: 'present' }
  | { name: 'edit' }
  | { name: 'view' }
  | { name: 'rail'; show: boolean }
  | { name: 'grid'; on: boolean | null }
  | { name: 'borders'; on: boolean | null }
  | { name: 'save' }
  | { name: 'discard' }
  | { name: 'version'; version: VersionName }
export type ParityRun = ViewerRun | { name: 'theme'; preset: { id: string; name: string } } | { name: 'canvas' }
export type ParityName = ParityRun['name']
export type ParityGroup = 'Slides' | 'View' | 'Deck'
export const PARITY_GROUPS: readonly ParityGroup[] = Object.freeze(['Slides', 'View', 'Deck'] as ParityGroup[])

interface ParityDef {
  name: ParityName
  group: ParityGroup
  blurb: string
  /** Takes a word after its name: picking it fills "/name " so the choices show. */
  takes: boolean
  /** How the row reads when it is not just "/name". */
  label?: string
}

/** The menu's order inside each group. The existing "/theme" row (Commands) opens the popup; "/theme <name>" here fills "/theme " and shows the presets to pick by name. */
export const PARITY_COMMANDS: readonly ParityDef[] = Object.freeze([
  { name: 'goto', group: 'Slides', blurb: 'Go to a slide by number', takes: true },
  { name: 'next', group: 'Slides', blurb: 'Go to the next slide', takes: false },
  { name: 'prev', group: 'Slides', blurb: 'Go to the previous slide', takes: false },
  { name: 'blank-slide', group: 'Slides', blurb: 'Add a blank slide after this one', takes: false },
  { name: 'layout', group: 'Slides', blurb: "Change this slide's layout", takes: true },
  { name: 'present', group: 'View', blurb: 'Present the deck full screen', takes: false },
  { name: 'edit', group: 'View', blurb: 'Switch to Edit mode', takes: false },
  { name: 'view', group: 'View', blurb: 'Switch to View mode', takes: false },
  { name: 'rail', group: 'View', blurb: 'Show or hide the slide rail', takes: true },
  { name: 'grid', group: 'View', blurb: 'Show or hide the grid', takes: false },
  { name: 'borders', group: 'View', blurb: 'Show or hide the borders', takes: false },
  { name: 'save', group: 'Deck', blurb: 'Save your edits now', takes: false },
  { name: 'discard', group: 'Deck', blurb: 'Discard your unsaved edits (asks first)', takes: false },
  { name: 'version', group: 'Deck', blurb: 'Switch between Custom, Strawman and Final', takes: true },
  { name: 'theme', group: 'Deck', blurb: 'Pick a preset by name for your next build', takes: true, label: '/theme <name>' },
  { name: 'canvas', group: 'Deck', blurb: 'Show the canvas', takes: false },
] as ParityDef[])

/** The real handler behind each command (the proof reads these names from the viewer and the page sources). */
export const PARITY_HANDLERS: Readonly<Record<string, string>> = Object.freeze({
  goto: 'handleGoToSlide',
  next: 'handleNextSlide',
  prev: 'handlePrevSlide',
  'blank-slide': 'handleAddSlide',
  layout: 'handleChangeLayout',
  present: 'handleFullscreen',
  edit: 'handleToggleEditModeButton',
  view: 'handleToggleEditModeButton',
  rail: 'handleToggleOverview',
  grid: 'handleToggleGrid',
  borders: 'handleToggleBorders',
  save: 'handleSaveChanges',
  discard: 'handleCancelEdits',
  version: 'onVersionSwitch',
  canvas: 'useStudioStageShowCanvas',
  theme: 'handlePresetChange',
})

// ---- when a command cannot run (one place: the rows and the run both ask it) ------------------------------------------------------------------

/** The commands that change the deck or its edit state. A build running, or a change still in flight, holds them. */
const MUTATIONS: ReadonlySet<string> = new Set(['blank-slide', 'layout', 'edit', 'save', 'discard'])

/**
 * Why `run` cannot run right now, else null. Mirrors the button it stands for: no deck yet, the slide still loading, a build running (for a mutation), the Add Slide button's own reason
 * (a change in flight, Template Mode, a paused tab: the deck is view-only here), and the plain "already" cases.
 */
export function blockedReason(run: ViewerRun, state: ViewerState | null, building: boolean): string | null {
  if (!state) return PARITY_WORDS.noDeck
  if (!state.ready) return PARITY_WORDS.loading
  if (MUTATIONS.has(run.name) && (building || state.building)) return PARITY_WORDS.building
  if (state.slideCount < 1) return PARITY_WORDS.noSlides
  switch (run.name) {
    case 'next': return state.slide >= state.slideCount ? PARITY_WORDS.lastSlide : null
    case 'prev': return state.slide <= 1 ? PARITY_WORDS.firstSlide : null
    case 'blank-slide':
    case 'layout': return state.slideReason
    case 'edit': return state.editing ? PARITY_WORDS.alreadyEditing : null
    case 'view': return state.editing ? null : PARITY_WORDS.alreadyViewing
    case 'save': return state.save === 'saving' ? PARITY_WORDS.saving : state.save === 'saved' ? PARITY_WORDS.nothingToSave : null
    case 'discard': return state.editing ? null : PARITY_WORDS.notEditing
    case 'rail': return state.rail === run.show ? PARITY_WORDS.railAlready(run.show) : null
    case 'grid': return run.on !== null && state.grid === run.on ? PARITY_WORDS.onOffAlready('Grid', run.on) : null
    case 'borders': return run.on !== null && state.borders === run.on ? PARITY_WORDS.onOffAlready('Borders', run.on) : null
    case 'version':
      if (!state.version.has.includes(run.version)) return PARITY_WORDS.noVersion(VERSION_LABELS[run.version])
      return state.version.active === run.version ? PARITY_WORDS.alreadyShowing : null
    default: return null
  }
}

// ---- loose matching (layouts, themes) ---------------------------------------------------------------------------------------------------------

const tokens = (value: string): string[] => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)

/** How well `query` names `text`: 100 the same words, 80 each word starts a word of it in order, 60 each starts some word, 30 the letters in order; 0 not at all. */
export function looseScore(query: string, text: string): number {
  const q = tokens(query), t = tokens(text)
  if (!q.length) return 1
  if (q.join(' ') === t.join(' ')) return 100
  let at = 0
  const inOrder = q.every(word => { const found = t.findIndex((candidate, index) => index >= at && candidate.startsWith(word)); if (found < 0) return false; at = found + 1; return true })
  if (inOrder) return 80
  if (q.every(word => t.some(candidate => candidate.startsWith(word)))) return 60
  const letters = q.join('')
  let next = 0
  for (const ch of t.join('')) if (ch === letters[next]) next++
  return letters.length >= 3 && next === letters.length ? 30 : 0
}

export interface LayoutChoice { id: string; label: string }
/** The slide layouts, as the rail's "Change layout" menu lists them (SLIDE_LAYOUTS, in its order). */
export const layoutChoices = (): LayoutChoice[] => SLIDE_LAYOUTS.map(item => ({ id: item.layout as string, label: item.label }))

/** The layouts a typed word names, best first (all of them for an empty query). A word of the description counts too ("thank you" finds Closing). */
export function matchLayouts(query: string): LayoutChoice[] {
  const scored = SLIDE_LAYOUTS.map((item, order) => {
    const score = Math.max(looseScore(query, item.label), looseScore(query, item.layout), Math.min(looseScore(query, item.description), 50))
    return { choice: { id: item.layout as string, label: item.label }, score, order }
  }).filter(entry => entry.score > 0)
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map(entry => entry.choice)
}

export function matchThemes<T extends { name: string }>(items: readonly T[], query: string): T[] {
  return items.map((item, order) => ({ item, score: looseScore(query, item.name), order })).filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order).map(entry => entry.item)
}

// ---- the rows the "/" menu draws -------------------------------------------------------------------------------------------------------------

export interface ParityTrigger { name: string; arg: string | null }

export interface ParityEnv {
  /** The viewer's state, null with no deck on screen. */
  viewer: ViewerState | null
  /** The composer's own "a build is running" (Send is Stop). */
  building: boolean
  /** /theme: null = the theme popup is open to choices; else why it is not. */
  themeBlocked: string | null
  presets: ReadonlyArray<{ id: string; name: string }>
  /** The Show canvas button is drawn (the stage gate holds the canvas closed). */
  canvasClosed: boolean
}

export interface ParityRow {
  key: string
  command: ParityName
  group: ParityGroup
  label: string
  blurb: string
  /** Why the row cannot run now (drawn instead of the blurb; picking it does nothing and the menu stays open). */
  disabled: string | null
  /** A problem with what was typed after the name (drawn the same way, same rule). */
  hint: string | null
  /** Picking fills "/name " so the choices show, instead of running. */
  fill: boolean
  run: ParityRun | null
}

const groupRank = (group: ParityGroup) => PARITY_GROUPS.indexOf(group)

function build(command: ParityName, label: string, blurb: string, run: ParityRun | null, env: ParityEnv, key = label): ParityRow {
  const group = PARITY_COMMANDS.find(def => def.name === command)?.group ?? 'Deck'
  return { key, command, group, label, blurb, disabled: run ? runBlocked(run, env) : null, hint: null, fill: false, run }
}

/** Why `run` cannot run in `env`: the viewer's reasons, or for /theme and /canvas their own. */
export function runBlocked(run: ParityRun, env: ParityEnv): string | null {
  if (run.name === 'theme') return env.themeBlocked
  if (run.name === 'canvas') return env.canvasClosed ? null : PARITY_WORDS.canvasOpen
  return blockedReason(run, env.viewer, env.building)
}

/** The reason a "type a word after it" command is out of reach even before any word (no deck, loading, a build running ...). */
function generalBlock(name: ParityName, env: ParityEnv): string | null {
  switch (name) {
    case 'goto': return blockedReason({ name: 'goto', slide: 1 }, env.viewer, env.building)
    case 'layout': return blockedReason({ name: 'layout', layout: '', label: '' }, env.viewer, env.building)
    case 'rail': return env.viewer ? blockedReason({ name: 'goto', slide: 1 }, env.viewer, env.building) : PARITY_WORDS.noDeck
    case 'version': return env.viewer ? blockedReason({ name: 'goto', slide: 1 }, env.viewer, env.building) : PARITY_WORDS.noDeck
    case 'theme': return env.themeBlocked
    default: return null
  }
}

const problem = (command: ParityName, label: string, text: string, env: ParityEnv, key = label): ParityRow => ({ ...build(command, label, '', null, env, key), hint: text })

const FIRST_LEVEL_RUN: Readonly<Record<string, ParityRun>> = Object.freeze({
  next: { name: 'next' }, prev: { name: 'prev' }, 'blank-slide': { name: 'blank-slide' }, present: { name: 'present' }, edit: { name: 'edit' }, view: { name: 'view' },
  grid: { name: 'grid', on: null }, borders: { name: 'borders', on: null }, save: { name: 'save' }, discard: { name: 'discard' }, canvas: { name: 'canvas' },
})

/** The row of a command that needs no word (or the "fill" row of one that does). */
function firstLevel(def: ParityDef, env: ParityEnv): ParityRow {
  const label = def.label ?? `/${def.name}`
  if (def.takes) return { ...build(def.name, label, def.blurb, null, env), disabled: generalBlock(def.name, env), fill: true }
  return build(def.name, label, def.blurb, FIRST_LEVEL_RUN[def.name] ?? null, env)
}

/** A slide number as typed: "3", "slide 3", "first", "last". */
export function parseSlideNumber(arg: string, count: number): number | null {
  const text = arg.trim().toLowerCase()
  if (text === 'first') return count > 0 ? 1 : null
  if (text === 'last') return count > 0 ? count : null
  const found = /^(?:slide\s*)?(\d{1,4})$/.exec(text)
  return found ? Number(found[1]) : null
}

/**
 * The rows for a "/" trigger. Nothing after the name: every command whose name starts with it, then those that contain it, kept in the menu's three groups. A word after the name: the choices of
 * that command (a slide number, the layouts, show or hide, on or off, the versions, the theme presets), or a hint when nothing it could mean is there. Never an empty answer for a command this file owns.
 */
export function parityRows(trigger: ParityTrigger, env: ParityEnv): ParityRow[] {
  const name = trigger.name.toLowerCase()
  if (trigger.arg === null) {
    const starts = PARITY_COMMANDS.filter(def => def.name.startsWith(name))
    const contains = name ? PARITY_COMMANDS.filter(def => !def.name.startsWith(name) && def.name.includes(name)) : []
    return [...starts, ...contains].map(def => firstLevel(def, env)).sort((a, b) => groupRank(a.group) - groupRank(b.group))
  }
  const arg = trigger.arg.trim()
  if (name === 'theme') return themeRows(arg, env)
  const def = PARITY_COMMANDS.find(item => item.name === name)
  if (!def) return []
  if (!def.takes && def.name !== 'grid' && def.name !== 'borders') return arg ? [problem(def.name, `/${def.name}`, PARITY_WORDS.nothingAfter(def.name), env)] : [firstLevel(def, env)]
  const held = generalBlock(def.name, env)
  switch (def.name) {
    case 'goto': {
      const count = env.viewer?.slideCount ?? 0
      const label = `/goto ${arg}`.trimEnd()
      if (held) return [{ ...build('goto', label, held, null, env), disabled: held }]
      const slide = parseSlideNumber(arg, count)
      if (slide === null) return [problem('goto', label, PARITY_WORDS.gotoHint(count), env)]
      if (slide < 1 || slide > count) return [problem('goto', label, PARITY_WORDS.gotoRange(count), env)]
      return [build('goto', `/goto ${slide}`, `Go to slide ${slide} of ${count}`, { name: 'goto', slide }, env)]
    }
    case 'layout': {
      if (held) return [{ ...build('layout', `/layout ${arg}`.trimEnd(), held, null, env), disabled: held }]
      const hits = matchLayouts(arg)
      if (!hits.length) return [problem('layout', `/layout ${arg}`, PARITY_WORDS.noLayout(arg), env)]
      const slide = env.viewer?.slide ?? 1
      return hits.map(hit => build('layout', `/layout ${hit.label}`, `Change slide ${slide} to ${hit.label}`, { name: 'layout', layout: hit.id, label: hit.label }, env, `layout:${hit.id}`))
    }
    case 'rail': {
      if (held) return [{ ...build('rail', `/rail ${arg}`.trimEnd(), held, null, env), disabled: held }]
      const choices = ([['show', true], ['hide', false]] as const).filter(([word]) => word.startsWith(arg.toLowerCase()))
      return choices.length ? choices.map(([word, show]) => build('rail', `/rail ${word}`, show ? 'Show the slide rail' : 'Hide the slide rail', { name: 'rail', show }, env))
        : [problem('rail', `/rail ${arg}`, PARITY_WORDS.railHint, env)]
    }
    case 'grid':
    case 'borders': {
      const which = def.name === 'grid' ? 'grid' as const : 'borders' as const
      if (!arg) return [firstLevel(def, env)]
      const choices = ([['on', true], ['off', false]] as const).filter(([word]) => word.startsWith(arg.toLowerCase()))
      return choices.length ? choices.map(([word, on]) => build(which, `/${which} ${word}`, `${on ? 'Show' : 'Hide'} the ${which}`, { name: which, on }, env))
        : [problem(which, `/${which} ${arg}`, PARITY_WORDS.onOffHint(which), env)]
    }
    case 'version': {
      if (held) return [{ ...build('version', `/version ${arg}`.trimEnd(), held, null, env), disabled: held }]
      const names = Object.keys(VERSION_WORDS).filter(word => word.startsWith(arg.toLowerCase()))
      return names.length ? names.map(word => build('version', `/version ${word}`, `Show the ${VERSION_LABELS[VERSION_WORDS[word]]} version`, { name: 'version', version: VERSION_WORDS[word] }, env))
        : [problem('version', `/version ${arg}`, PARITY_WORDS.versionHint, env)]
    }
    default: return []
  }
}

function themeRows(arg: string, env: ParityEnv): ParityRow[] {
  if (!env.presets.length) return [problem('theme', `/theme ${arg}`.trimEnd(), PARITY_WORDS.noThemes, env)]
  const hits = matchThemes(env.presets, arg).slice(0, 8)
  if (!hits.length) return [problem('theme', `/theme ${arg}`, PARITY_WORDS.noTheme(arg), env)]
  return hits.map(hit => build('theme', `/theme ${hit.name}`, `Use ${hit.name} for your next build`, { name: 'theme', preset: { id: hit.id, name: hit.name } }, env, `theme:${hit.id}`))
}

// ---- the bus --------------------------------------------------------------------------------------------------------------------------------

let live: (() => ViewerHandle | null) | null = null
let snapshot: ViewerState | null = null
let signature = ''
const listeners = new Set<() => void>()

/** The viewer's latest handle, null with no viewer registered. */
const handleNow = (): ViewerHandle | null => { try { return live?.() ?? null } catch { return null } }

/** Called by the viewer after every commit: the composer hears about it only when the state it shows changed. */
export function publishViewerState(): void {
  const next = handleNow()?.state ?? null
  const text = next ? JSON.stringify(next) : ''
  if (text === signature) return
  signature = text
  snapshot = next
  for (const listener of Array.from(listeners)) listener()
}

/** The viewer registers a getter of its latest { state, actions }; the returned function unregisters it (only if it is still the one registered). */
export function registerViewer(get: () => ViewerHandle | null): () => void {
  live = get
  publishViewerState()
  return () => { if (live === get) { live = null; publishViewerState() } }
}

/** For useSyncExternalStore in the composer. */
export const subscribeViewerState = (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const viewerStateSnapshot = (): ViewerState | null => snapshot

// ---- running a command ---------------------------------------------------------------------------------------------------------------------

export interface ParityResult { ok: boolean; note: string }
const done = (note: string): ParityResult => ({ ok: true, note })
const failed = (note: string): ParityResult => ({ ok: false, note })

/** How long each kind of command waits to SEE its effect in the viewer's state (ms). A move is quick; a slide added or a save goes through the Layout service. */
export const PARITY_WAIT = Object.freeze({ move: 2000, change: 5000, save: 5000, version: 5000, present: 2500 })

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
const fresh = (): ViewerState | null => handleNow()?.state ?? null

/** Look at the viewer's state until `test` holds (null when it never does within `ms`). */
async function settle(test: (state: ViewerState) => boolean, ms: number): Promise<ViewerState | null> {
  const end = Date.now() + ms
  for (;;) {
    const state = fresh()
    if (state && test(state)) return state
    if (Date.now() >= end) return null
    await sleep(40)
  }
}

/**
 * Run a viewer command: ask for its block once more (the same words the menu showed), call the real handler, then look at the viewer and say what happened. Never throws; a command that
 * did not do what it was asked says so (ok: false) and never claims the change.
 */
export async function emitViewerCommand(run: ViewerRun, options: { building?: boolean; scale?: number } = {}): Promise<ParityResult> {
  const handle = handleNow()
  const before = handle?.state ?? null
  const blocked = blockedReason(run, before, Boolean(options.building))
  if (blocked || !handle || !before) return failed(blocked ?? PARITY_WORDS.noDeck)
  const wait = (ms: number) => Math.max(1, Math.round(ms * (options.scale ?? 1)))
  const a = handle.actions
  try {
    switch (run.name) {
      case 'goto': {
        await a.goTo(run.slide - 1)
        return (await settle(s => s.slide === run.slide, wait(PARITY_WAIT.move))) ? done(`Went to slide ${run.slide}`) : failed(`Couldn't go to slide ${run.slide}.`)
      }
      case 'next':
      case 'prev': {
        const target = before.slide + (run.name === 'next' ? 1 : -1)
        await (run.name === 'next' ? a.next() : a.prev())
        return (await settle(s => s.slide === target, wait(PARITY_WAIT.move))) ? done(`Went to slide ${target}`) : failed(`Couldn't go to slide ${target}.`)
      }
      case 'blank-slide': {
        const refused = await a.addBlank(before.slide)
        if (typeof refused === 'string') return failed(refused)
        return (await settle(s => s.slideCount > before.slideCount, wait(PARITY_WAIT.change))) ? done(`Added a blank slide after slide ${before.slide}`) : failed("Couldn't confirm the new slide. Check the rail before you try again.")
      }
      case 'layout': {
        const confirmed = await a.changeLayout(before.slide - 1, run.layout)
        return confirmed === true ? done(`Changed slide ${before.slide} to ${run.label}`) : failed(`Couldn't confirm the layout change. Check slide ${before.slide}.`)
      }
      case 'present': {
        await a.present()
        return (await settle(s => s.presenting, wait(PARITY_WAIT.present))) ? done('Presenting. Press Esc to leave.') : failed("Couldn't go full screen. Your browser may have said no.")
      }
      case 'edit':
      case 'view': {
        const want = run.name === 'edit'
        await a.setEditing(want)
        return (await settle(s => s.editing === want, wait(PARITY_WAIT.move))) ? done(want ? 'Edit mode on' : 'View mode on') : failed(`Couldn't switch to ${want ? 'Edit' : 'View'} mode.`)
      }
      case 'rail': {
        await a.setRail(run.show)
        return (await settle(s => s.rail === run.show, wait(PARITY_WAIT.move))) ? done(run.show ? 'Slide rail shown' : 'Slide rail hidden') : failed(`Couldn't ${run.show ? 'show' : 'hide'} the rail.`)
      }
      case 'grid':
      case 'borders': {
        const key = run.name === 'grid' ? 'grid' : 'borders'
        const label = run.name === 'grid' ? 'Grid' : 'Borders'
        const want = run.on ?? !before[key]
        await (run.name === 'grid' ? a.toggleGrid() : a.toggleBorders())
        return (await settle(s => s[key] === want, wait(PARITY_WAIT.move))) ? done(`${label} ${want ? 'on' : 'off'}`) : failed(`Couldn't turn ${label.toLowerCase()} ${want ? 'on' : 'off'}.`)
      }
      case 'save': {
        await a.save()
        if (await settle(s => s.save === 'saved', wait(PARITY_WAIT.save))) return done('Saved your edits')
        return failed(fresh()?.save === 'error' ? "Couldn't save. Try again." : "Asked to save, but it hasn't confirmed yet.")
      }
      case 'discard': {
        await a.discard() // the viewer's own confirm box: it answers before this returns. Nothing here confirms it.
        await sleep(wait(80))
        return fresh()?.editing === false ? done('Discarded your edits') : done('Kept your edits')
      }
      case 'version': {
        await a.setVersion(run.version)
        return (await settle(s => s.version.active === run.version, wait(PARITY_WAIT.version))) ? done(`Showing the ${VERSION_LABELS[run.version]} version`) : failed(`Couldn't switch to the ${VERSION_LABELS[run.version]} version.`)
      }
    }
  } catch {
    return failed("That didn't work. Nothing was changed that we could confirm.")
  }
}

export interface ParityDeps {
  building: boolean
  /** The theme popup's preset chip (ChatInput handlePresetChange). */
  choosePreset: (presetId: string) => void
  /** The Show canvas button's own function, null while the canvas is open. */
  showCanvas: (() => void) | null
  scale?: number
}

/** Run any of the commands: the viewer's through the bus, /theme through the preset chip, /canvas through the Show canvas function. */
export async function runParity(run: ParityRun, deps: ParityDeps): Promise<ParityResult> {
  if (run.name === 'theme') {
    deps.choosePreset(run.preset.id)
    return done(`Theme set to ${run.preset.name} for your next build`)
  }
  if (run.name === 'canvas') {
    if (!deps.showCanvas) return failed(PARITY_WORDS.canvasOpen)
    deps.showCanvas()
    return done('Showing the canvas')
  }
  return emitViewerCommand(run, { building: deps.building, scale: deps.scale })
}

/** /blank-slide's call into the viewer's add handler: the Blank choice of the J2 Add Slide panel does the same (its own insert point and background), else the plain add after this slide. A string answer is a refusal. */
export async function addBlankSlide(
  add: (layout: 'B1-blank', options?: { position?: number; backgroundColor?: string }) => Promise<void> | void,
  position: number,
  j2: { resolveBlankTarget?: (expectedVisualIndex: number) => AddSlideV2BlankTarget } | undefined,
  currentSlide: number,
): Promise<string | void> {
  if (!j2) { await add('B1-blank', { position }); return }
  const target: AddSlideV2BlankTarget = j2.resolveBlankTarget?.(Math.max(0, currentSlide - 1)) ?? { ok: true, position: undefined }
  if (!target.ok) return target.message
  await add('B1-blank', addSlideV2BlankNativeOptions(target.position))
}

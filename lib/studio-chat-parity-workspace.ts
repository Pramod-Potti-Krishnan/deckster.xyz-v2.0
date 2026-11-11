/**
 * FRONTEND-1, overnight chat parity (11 Nov), the WORKSPACE half: "/" commands that do what a workspace button does.
 * Gated by NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (which already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell), the same gate as the viewer commands under it. No new flag, no backend, no Director change.
 * Stacked on lib/studio-chat-parity-viewer.ts: it reuses that file's words, waits, loose matching and result type, and its menu draws these rows in one more group, "Workspace".
 *
 * ONE small bus, module level, in PARTS (the viewer's bus has one owner; the workspace is owned by five places, so each registers the part it owns):
 *   the Builder page        kg, template, pane, introReady     the viewer              Template Mode (the toolbar's own toggle)
 *   the notes panel         notes                              the introduction        the replay
 *   the composer            appearance (next-themes) and the version history bridge
 * A part is a getter of its latest { state, actions }; the composer EMITS a command and shows the answer, and reads the merged state to draw each row enabled or disabled.
 * Every action is the handler the matching button calls; every state field is what that button reads. A command that runs says what happened AFTER it looked: it reads the state again and never
 * reports a change it did not see. Everything here is pure or module-level state: no React, no DOM, nothing from the network.
 *
 *   /kg on|off              setKnowledgeGraphEnabled (the Research options switch; locked once research ran, like the other two)
 *   /template <name>        handleSelectTemplate (the templates the toolbar lists)          /template clear   handleClearTemplate
 *   /template stop          handleCancelTemplateReuse (the Stop template reuse button)       /template-mode on|off   handleTemplateModeChange (the Template menu's toggle)
 *   /notes show|hide        handleToggleExpanded (the Notes bar)                            /dark /light /system   setTheme (next-themes, the Appearance choices)
 *   /intro                  requestReplay (the Replay intro button)                         /pane chat|slides|inspector   the workspace switcher's own handlers (selectWorkspacePane ...)
 *   /history                versionHistoryBridge.open (the account menu's Version history)   Restoring a version stays a click in that panel (it has its own confirm).
 */
import { PARITY_WAIT, PARITY_WORDS, looseScore } from '@/lib/studio-chat-parity-viewer'
import type { ParityDeps, ParityResult, ParityRow, ParityRun } from '@/lib/studio-chat-parity-viewer'

// ---- the words (one place) ------------------------------------------------------------------------------------------------------------------

export const WORKSPACE_WORDS = Object.freeze({
  noDeck: PARITY_WORDS.noDeck,
  noPage: 'Open the builder first.',
  kgLocked: 'Locked: research already ran for this deck.',
  kgPro: 'Knowledge graph is a Pro feature.',
  kgOffline: 'Knowledge graph is offline right now.',
  kgLoading: 'Checking your knowledge graph access…',
  kgSetup: 'Enable it in Research options first.',
  kgAlready: (on: boolean) => `Knowledge graph is already ${on ? 'on' : 'off'}.`,
  onOffHint: (name: string) => `Say /${name} on or /${name} off.`,
  templateOff: "Templates aren't turned on in this build.",
  templateLocked: 'Template selection is locked for this deck.',
  noTemplateChosen: 'No template is chosen.',
  reuseNotRunning: "Template reuse isn't running.",
  templatesLoading: 'Loading your templates…',
  templatesFailed: "Couldn't load your templates.",
  noTemplates: 'No saved templates yet.',
  noTemplate: (typed: string) => `No template matches "${typed}".`,
  templateAlready: 'That template is already chosen.',
  modeNeedsTemplate: 'Select a template first.',
  modeAlready: (on: boolean) => `Template Mode is already ${on ? 'on' : 'off'}.`,
  notesAlready: (show: boolean) => (show ? 'The notes are already showing.' : 'The notes are already hidden.'),
  notesHint: 'Say /notes show or /notes hide.',
  themeAlready: (label: string) => `Already using ${label}.`,
  introNone: "The introduction isn't available here.",
  introBusy: 'Finish what you are doing first.',
  introDraft: 'Clear the message box first.',
  introPlaying: 'The introduction is already playing.',
  paneDual: 'Chat and slides both show at this width.',
  paneSlidesShown: 'The slides already show at this width.',
  paneNoInspector: 'Nothing to edit yet. Pick a slide or element.',
  paneAlready: (label: string) => `Already showing ${label}.`,
  paneHint: 'Say /pane chat, slides or inspector.',
  historyOff: "Version history isn't turned on in this build.",
})
const W = WORKSPACE_WORDS

// ---- what the parts say about themselves, and what they can do --------------------------------------------------------------------------------

export type KgAccess = 'locked' | 'setup' | 'ready' | 'unavailable' | 'loading'
export type PaneName = 'chat' | 'slides' | 'inspector'
export type ThemeChoice = 'light' | 'dark' | 'system'
export const PANE_LABELS: Readonly<Record<PaneName, string>> = Object.freeze({ chat: 'Chat', slides: 'Slides', inspector: 'Inspector' })
export const THEME_LABELS: Readonly<Record<ThemeChoice, string>> = Object.freeze({ light: 'Light', dark: 'Dark', system: 'System' })
const PANE_WORDS: readonly PaneName[] = Object.freeze(['chat', 'slides', 'inspector'] as PaneName[])

/** The record the template picker hands the page when a template is clicked (components/builder/template-picker.tsx toSelection): the page's handleSelectTemplate takes exactly this. */
export const TEMPLATE_PICK_FIELDS = Object.freeze(['id', 'name', 'blueprint_generation_method', 'blueprint_enrichment_status', 'blueprint_enrichment_error', 'template_purity_status', 'template_purity_error'] as const)
export type TemplatePick = { id: string; name: string } & Record<string, unknown>

/** What the buttons read. Plain data: each part builds it on every render, the bus compares the merged result by value. A part that is not mounted leaves its keys null. */
export interface WorkspaceState {
  /** The Builder page: the Research options switch (its access, its value, the lock). */
  kg: { access: KgAccess; on: boolean; locked: boolean } | null
  /** The Builder page: templates (the templates feature, the chosen one, the lock, a reuse running = the Stop template reuse button). */
  template: { builder: boolean; active: { id: string; name: string } | null; locked: boolean; running: boolean } | null
  /** The viewer: the Template menu's Template Mode item (drawn with the templates feature; blocked = the Template button's own reason; available = a template is chosen). */
  mode: { builder: boolean; on: boolean; available: boolean; blocked: string | null } | null
  /** The Builder page: the workspace switcher (drawn when chat and the stage do not both fit). */
  pane: { dual: boolean; overlay: boolean; showing: PaneName; inspector: boolean } | null
  /** The Builder page: the introduction could start if the composer were empty (the typed command is not a draft). */
  introReady: boolean | null
  /** The introduction's owner: it is mounted, and whether it is playing. */
  intro: { active: boolean } | null
  /** The notes panel: it is on screen, and open. */
  notes: { shown: boolean } | null
  /** The composer: the appearance the user chose (null before the browser has said). */
  theme: { choice: ThemeChoice | null } | null
  /** The composer: the Version history row (the profile menu's own: only with its flag, and only while a deck is on screen). */
  history: { enabled: boolean; available: boolean } | null
}

export interface WorkspaceActions {
  setKg: (on: boolean) => unknown
  selectTemplate: (pick: TemplatePick) => unknown
  clearTemplate: () => unknown
  stopTemplateReuse: () => unknown
  /** The Template menu's toggle, asked for the mode wanted. */
  setTemplateMode: (on: boolean) => unknown
  selectPane: (pane: PaneName) => unknown
  toggleNotes: () => unknown
  replayIntro: () => unknown
  setTheme: (choice: ThemeChoice) => unknown
  /** versionHistoryBridge.open(): true when the panel's opener ran. */
  openHistory: () => unknown
}

export interface WorkspacePart { state?: Partial<WorkspaceState>; actions?: Partial<WorkspaceActions> }

export const EMPTY_WORKSPACE_STATE: WorkspaceState = Object.freeze({
  kg: null, template: null, mode: null, pane: null, introReady: null, intro: null, notes: null, theme: null, history: null,
}) as WorkspaceState

// ---- the commands ---------------------------------------------------------------------------------------------------------------------------

/** Every run carries `ws: true`: the viewer commands' union and the menu tell the two halves apart by it. */
export type WorkspaceRun =
  | { ws: true; name: 'kg'; on: boolean }
  | { ws: true; name: 'template'; op: 'clear' }
  | { ws: true; name: 'template'; op: 'stop' }
  | { ws: true; name: 'template'; op: 'select'; pick: TemplatePick }
  | { ws: true; name: 'template-mode'; on: boolean }
  | { ws: true; name: 'notes'; show: boolean }
  | { ws: true; name: 'dark' | 'light' | 'system' }
  | { ws: true; name: 'intro' }
  | { ws: true; name: 'pane'; pane: PaneName }
  | { ws: true; name: 'history' }
export type WorkspaceName = WorkspaceRun['name']
export const WORKSPACE_GROUP = 'Workspace' as const

interface WorkspaceDef {
  name: WorkspaceName
  blurb: string
  /** Takes a word after its name: picking it fills "/name " so the choices show. */
  takes: boolean
  label?: string
}

/** The menu's order. "/template <name>" sits next to the existing "/template" (which opens the popup): it fills "/template " and shows clear, stop and the saved templates to pick by name. */
export const WORKSPACE_COMMANDS: readonly WorkspaceDef[] = Object.freeze([
  { name: 'kg', blurb: 'Use your knowledge graph for this deck', takes: true },
  { name: 'template', blurb: 'Reuse a saved template, or clear it', takes: true, label: '/template <name>' },
  { name: 'template-mode', blurb: 'Turn Template Mode on or off', takes: true },
  { name: 'notes', blurb: 'Show or hide the notes panel', takes: true },
  { name: 'dark', blurb: 'Use the dark appearance', takes: false },
  { name: 'light', blurb: 'Use the light appearance', takes: false },
  { name: 'system', blurb: 'Follow your device appearance', takes: false },
  { name: 'intro', blurb: 'Replay the Studio introduction', takes: false },
  { name: 'pane', blurb: 'Switch between Chat, Slides and Inspector', takes: true },
  { name: 'history', blurb: 'Open the version history', takes: false },
] as WorkspaceDef[])

/** The real handler behind each command (the proof reads these names from the page, the viewer, the notes panel, the introduction and the bridge). */
export const WORKSPACE_HANDLERS: Readonly<Record<string, string>> = Object.freeze({
  kg: 'setKnowledgeGraphEnabled',
  'template:select': 'handleSelectTemplate',
  'template:clear': 'handleClearTemplate',
  'template:stop': 'handleCancelTemplateReuse',
  'template-mode': 'handleTemplateModeChange',
  notes: 'handleToggleExpanded',
  theme: 'setTheme',
  intro: 'requestReplay',
  pane: 'selectWorkspacePane',
  history: 'versionHistoryBridge.open',
})

/** A run this file owns (the viewer's union also holds the viewer's own runs). */
export const isWorkspaceRun = (run: unknown): run is WorkspaceRun => Boolean(run) && typeof run === 'object' && (run as { ws?: unknown }).ws === true

// ---- when a command cannot run (one place: the rows and the run both ask it) ------------------------------------------------------------------

/** The Research options switch's own reasons: no switch is drawn unless access is ready; the switch is disabled once research ran. Same for either direction. */
function kgGeneral(state: WorkspaceState): string | null {
  const kg = state.kg
  if (!kg) return W.noPage
  if (kg.access === 'locked') return W.kgPro
  if (kg.access === 'unavailable') return W.kgOffline
  if (kg.access === 'loading') return W.kgLoading
  if (kg.access === 'setup') return W.kgSetup
  return kg.locked ? W.kgLocked : null
}

function templateGeneral(state: WorkspaceState): string | null {
  if (!state.template) return W.noPage
  return state.template.builder ? null : W.templateOff
}

function modeGeneral(state: WorkspaceState): string | null {
  if (!state.mode) return W.noDeck
  if (!state.mode.builder) return W.templateOff
  return state.mode.blocked
}

function paneGeneral(state: WorkspaceState): string | null {
  if (!state.pane) return W.noPage
  return state.pane.dual ? W.paneDual : null
}

/** Why `run` cannot run now, else null. Mirrors the button it stands for. The rows and the run both ask this (the run asks again, with the state it reads just before it calls). */
export function workspaceBlocked(run: WorkspaceRun, state: WorkspaceState): string | null {
  switch (run.name) {
    case 'kg': {
      const held = kgGeneral(state)
      if (held) return held
      return state.kg!.on === run.on ? W.kgAlready(run.on) : null
    }
    case 'template': {
      const held = templateGeneral(state)
      const template = state.template
      if (held || !template) return held ?? W.noPage
      if (run.op === 'stop') return template.running ? null : W.reuseNotRunning
      if (run.op === 'clear') return !template.active ? W.noTemplateChosen : template.locked ? W.templateLocked : null
      if (template.locked) return W.templateLocked
      return template.active?.id === run.pick.id ? W.templateAlready : null
    }
    case 'template-mode': {
      const held = modeGeneral(state)
      if (held) return held
      const mode = state.mode!
      if (mode.on === run.on) return W.modeAlready(run.on)
      return run.on && !mode.available ? W.modeNeedsTemplate : null
    }
    case 'notes':
      if (!state.notes) return W.noDeck
      return state.notes.shown === run.show ? W.notesAlready(run.show) : null
    case 'dark':
    case 'light':
    case 'system':
      if (!state.theme) return W.noPage
      return state.theme.choice === run.name ? W.themeAlready(THEME_LABELS[run.name]) : null
    case 'intro':
      if (!state.intro) return W.introNone
      if (state.intro.active) return W.introPlaying
      return state.introReady === true ? null : W.introBusy
    case 'pane': {
      const held = paneGeneral(state)
      if (held) return held
      const pane = state.pane!
      if (run.pane === 'slides' && !pane.overlay) return W.paneSlidesShown
      if (run.pane === 'inspector' && !pane.inspector) return W.paneNoInspector
      return pane.showing === run.pane ? W.paneAlready(PANE_LABELS[run.pane]) : null
    }
    case 'history':
      if (!state.history) return W.noPage
      if (!state.history.enabled) return W.historyOff
      return state.history.available ? null : W.noDeck
  }
}

// ---- the saved templates (what the toolbar lists) ---------------------------------------------------------------------------------------------

export interface TemplateChoice { id: string; name: string; pick: TemplatePick; ready: boolean; why: string | null }
export interface TemplatesState { status: 'off' | 'idle' | 'loading' | 'ready' | 'failed'; items: TemplateChoice[] }
export const NO_TEMPLATES: TemplatesState = Object.freeze({ status: 'off', items: [] as TemplateChoice[] }) as TemplatesState

export interface TemplateRules<T> {
  /** NEXT_PUBLIC_COMPOSER_LIBRARY_ENABLED: the composer's own templates are not saved ones; the toolbar's list leaves them out. */
  composerLibrary: boolean
  /** isTemplateGenerationReady / templateGenerationUnavailableReason (hooks/use-templates.ts): the picker toasts instead of choosing a template that is not ready. */
  ready: (template: T) => boolean
  why: (template: T) => string
}

/** The pick handed to handleSelectTemplate: the same fields the picker's own click hands over. */
export function pickOf(template: object): TemplatePick {
  const record = template as Record<string, unknown>
  const pick: Record<string, unknown> = {}
  for (const field of TEMPLATE_PICK_FIELDS) pick[field] = record[field]
  return pick as TemplatePick
}

/** Read the saved templates the way the toolbar's picker does (listTemplates, composer carriers left out when that library is on) into the choices the "/template" menu lists. Never throws. */
export async function loadWorkspaceTemplates<T extends { id: string; name: string }>(list: () => Promise<{ templates: T[] } | null | undefined>, rules: TemplateRules<T>): Promise<TemplatesState> {
  try {
    const res = await list()
    if (!res || !Array.isArray(res.templates)) return { status: 'failed', items: [] }
    const listed = rules.composerLibrary ? res.templates.filter(template => !('stage_template_summary' in template)) : res.templates
    const items = listed.filter(template => typeof template.id === 'string' && typeof template.name === 'string').map((template): TemplateChoice => {
      const ready = rules.ready(template)
      return { id: template.id, name: template.name, pick: pickOf(template), ready, why: ready ? null : rules.why(template) }
    })
    return { status: 'ready', items }
  } catch {
    return { status: 'failed', items: [] }
  }
}

// ---- the rows the "/" menu draws -------------------------------------------------------------------------------------------------------------

export interface WorkspaceTrigger { name: string; arg: string | null }

export interface WorkspaceEnv {
  /** The merged state of every part (the bus's snapshot). */
  state: WorkspaceState
  /** The message box holds something besides the command (a typed draft stays when a command is picked). */
  draft: boolean
  templates: TemplatesState
  /** The composer's own reason the template popup is out of reach (not signed in, the conversation still loading), else null. */
  templateBlocked: string | null
}

/** A run of this file, as data (the one cast: the union is keyed by name, the call sites name the fields). */
const R = (value: { name: WorkspaceName } & Record<string, unknown>): WorkspaceRun => ({ ws: true, ...value }) as WorkspaceRun
const mk = (command: WorkspaceName, label: string, blurb: string, what: WorkspaceRun | null, disabled: string | null, key = `ws:${label}`): ParityRow =>
  ({ key, command, group: WORKSPACE_GROUP, label, blurb, disabled, hint: null, fill: false, run: what as ParityRun | null })
const problem = (command: WorkspaceName, label: string, text: string, key = `ws:${label}`): ParityRow => ({ ...mk(command, label, '', null, null, key), hint: text })
const fill = (def: WorkspaceDef, disabled: string | null): ParityRow => ({ ...mk(def.name, def.label ?? `/${def.name}`, def.blurb, null, disabled), fill: true })

const FIRST_LEVEL_RUN: Readonly<Record<string, WorkspaceRun>> = Object.freeze({
  dark: R({ name: 'dark' }), light: R({ name: 'light' }), system: R({ name: 'system' }), intro: R({ name: 'intro' }), history: R({ name: 'history' }),
})

/** The reason a "type a word after it" command is out of reach even before any word. */
function general(name: WorkspaceName, env: WorkspaceEnv): string | null {
  switch (name) {
    case 'kg': return kgGeneral(env.state)
    case 'template': return templateGeneral(env.state) ?? env.templateBlocked
    case 'template-mode': return modeGeneral(env.state)
    case 'notes': return env.state.notes ? null : W.noDeck
    case 'pane': return paneGeneral(env.state)
    default: return null
  }
}

function firstLevel(def: WorkspaceDef, env: WorkspaceEnv): ParityRow {
  if (def.takes) return fill(def, general(def.name, env))
  const what = FIRST_LEVEL_RUN[def.name] ?? null
  const blocked = what ? workspaceBlocked(what, env.state) : null
  return mk(def.name, `/${def.name}`, def.blurb, what, blocked ?? (def.name === 'intro' && env.draft ? W.introDraft : null))
}

/** The words of a choice list that start with what was typed. */
const choices = <T extends string>(words: readonly T[], typed: string): T[] => words.filter(word => word.startsWith(typed.toLowerCase()))

function onOffRows(name: 'kg' | 'template-mode', arg: string, env: WorkspaceEnv): ParityRow[] {
  const held = general(name, env)
  if (held) return [mk(name, `/${name} ${arg}`.trimEnd(), held, null, held)]
  const words = choices(['on', 'off'] as const, arg)
  if (!words.length) return [problem(name, `/${name} ${arg}`, W.onOffHint(name))]
  return words.map(word => {
    const what = R({ name, on: word === 'on' })
    const blurb = name === 'kg' ? `Turn the knowledge graph ${word}` : `Turn Template Mode ${word}`
    return mk(name, `/${name} ${word}`, blurb, what, workspaceBlocked(what, env.state))
  })
}

function templateRows(arg: string, env: WorkspaceEnv): ParityRow[] {
  const held = general('template', env)
  if (held) return [mk('template', `/template ${arg}`.trimEnd(), held, null, held)]
  const out: ParityRow[] = []
  const clear = R({ name: 'template', op: 'clear' })
  const stop = R({ name: 'template', op: 'stop' })
  const typed = choices(['clear', 'stop'] as const, arg)
  if (typed.includes('clear')) out.push(mk('template', '/template clear', 'Clear the chosen template', clear, workspaceBlocked(clear, env.state)))
  if (typed.includes('stop')) out.push(mk('template', '/template stop', 'Stop the template reuse that is running', stop, workspaceBlocked(stop, env.state)))
  const { status, items } = env.templates
  const hits = items.map((item, order) => ({ item, order, score: looseScore(arg, item.name) })).filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order).slice(0, 8)
  for (const { item } of hits) {
    const what = R({ name: 'template', op: 'select', pick: item.pick })
    out.push(mk('template', `/template ${item.name}`, 'Reuse it for your next build', what, workspaceBlocked(what, env.state) ?? (item.ready ? null : item.why), `ws:template:${item.id}`))
  }
  if (!hits.length) {
    if (status === 'idle' || status === 'loading') out.push(problem('template', '/template …', W.templatesLoading, 'ws:template:loading'))
    else if (status === 'failed') out.push(problem('template', '/template …', W.templatesFailed, 'ws:template:failed'))
    else if (!out.length) out.push(problem('template', `/template ${arg}`, arg ? W.noTemplate(arg) : W.noTemplates, 'ws:template:none'))
    else if (!arg && !items.length) out.push(problem('template', '/template …', W.noTemplates, 'ws:template:none'))
  }
  return out
}

/**
 * The rows for a "/" trigger. Nothing after the name: every command whose name starts with it, then those that contain it. A word after the name: the choices of that command (on or off, show or
 * hide, a pane, clear / stop / a saved template), or a hint when nothing it could mean is there. Never an empty answer for a command this file owns.
 */
export function workspaceRows(trigger: WorkspaceTrigger, env: WorkspaceEnv): ParityRow[] {
  const name = trigger.name.toLowerCase()
  if (trigger.arg === null) {
    const starts = WORKSPACE_COMMANDS.filter(def => def.name.startsWith(name))
    const contains = name ? WORKSPACE_COMMANDS.filter(def => !def.name.startsWith(name) && def.name.includes(name)) : []
    return [...starts, ...contains].map(def => firstLevel(def, env))
  }
  const arg = trigger.arg.trim()
  const def = WORKSPACE_COMMANDS.find(item => item.name === name)
  if (!def) return []
  if (!def.takes) return arg ? [problem(def.name, `/${def.name}`, PARITY_WORDS.nothingAfter(def.name))] : [firstLevel(def, env)]
  switch (def.name) {
    case 'kg':
    case 'template-mode': return onOffRows(def.name, arg, env)
    case 'template': return templateRows(arg, env)
    case 'notes': {
      const held = general('notes', env)
      if (held) return [mk('notes', `/notes ${arg}`.trimEnd(), held, null, held)]
      const words = choices(['show', 'hide'] as const, arg)
      if (!words.length) return [problem('notes', `/notes ${arg}`, W.notesHint)]
      return words.map(word => { const what = R({ name: 'notes', show: word === 'show' }); return mk('notes', `/notes ${word}`, word === 'show' ? 'Show the notes panel' : 'Hide the notes panel', what, workspaceBlocked(what, env.state)) })
    }
    case 'pane': {
      const held = general('pane', env)
      if (held) return [mk('pane', `/pane ${arg}`.trimEnd(), held, null, held)]
      const words = choices(PANE_WORDS, arg)
      if (!words.length) return [problem('pane', `/pane ${arg}`, W.paneHint)]
      return words.map(word => { const what = R({ name: 'pane', pane: word }); return mk('pane', `/pane ${word}`, `Show ${PANE_LABELS[word]}`, what, workspaceBlocked(what, env.state)) })
    }
    default: return []
  }
}

// ---- the bus --------------------------------------------------------------------------------------------------------------------------------

const parts = new Map<string, () => WorkspacePart | null>()
let snapshot: WorkspaceState = EMPTY_WORKSPACE_STATE
let signature = ''
const listeners = new Set<() => void>()

/** What every part says, merged (a key no part owns stays null). A part that throws says nothing. */
export function workspaceHandle(): { state: WorkspaceState; actions: Partial<WorkspaceActions> } {
  const state: Record<string, unknown> = { ...EMPTY_WORKSPACE_STATE }
  const actions: Partial<WorkspaceActions> = {}
  for (const get of Array.from(parts.values())) {
    let part: WorkspacePart | null = null
    try { part = get() } catch { part = null }
    if (!part) continue
    for (const [key, value] of Object.entries(part.state ?? {})) if (value !== undefined) state[key] = value
    Object.assign(actions, part.actions ?? {})
  }
  return { state: state as unknown as WorkspaceState, actions }
}

/** Called by each part after every commit: the composer hears about it only when the merged state it shows changed. */
export function publishWorkspaceState(): void {
  const next = workspaceHandle().state
  const text = JSON.stringify(next)
  if (text === signature) return
  signature = text
  snapshot = next
  for (const listener of Array.from(listeners)) listener()
}

/** A part registers a getter of its latest { state, actions }; the returned function unregisters it (only if it is still the one registered under that key). */
export function registerWorkspacePart(key: string, get: () => WorkspacePart | null): () => void {
  parts.set(key, get)
  publishWorkspaceState()
  return () => { if (parts.get(key) === get) { parts.delete(key); publishWorkspaceState() } }
}

/** For useSyncExternalStore in the composer. */
export const subscribeWorkspaceState = (listener: () => void): (() => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const workspaceStateSnapshot = (): WorkspaceState => snapshot

// ---- running a command ---------------------------------------------------------------------------------------------------------------------

const done = (note: string): ParityResult => ({ ok: true, note })
const failed = (note: string): ParityResult => ({ ok: false, note })

/** How long the introduction waits for the typed command to leave the message box (and the page to see it) before it asks to start (ms). */
export const WORKSPACE_WAIT = Object.freeze({ cleared: 90 })

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
const fresh = (): WorkspaceState => workspaceHandle().state

/** Look at the merged state until `test` holds (false when it never does within `ms`). */
async function settle(test: (state: WorkspaceState) => boolean, ms: number): Promise<boolean> {
  const end = Date.now() + ms
  for (;;) {
    if (test(fresh())) return true
    if (Date.now() >= end) return false
    await sleep(40)
  }
}

/**
 * Run a workspace command: ask for its block once more (the same words the menu showed), call the real handler, then look at the state and say what happened. Never throws; a command that did not do
 * what it was asked says so (ok: false) and never claims the change.
 */
export async function emitWorkspaceCommand(what: WorkspaceRun, options: { scale?: number } = {}): Promise<ParityResult> {
  const handle = workspaceHandle()
  const blocked = workspaceBlocked(what, handle.state)
  if (blocked) return failed(blocked)
  const wait = (ms: number) => Math.max(1, Math.round(ms * (options.scale ?? 1)))
  const a = handle.actions
  const missing = () => failed(W.noPage)
  try {
    switch (what.name) {
      case 'kg': {
        if (!a.setKg) return missing()
        await a.setKg(what.on)
        return (await settle(s => s.kg?.on === what.on, wait(PARITY_WAIT.move))) ? done(`Knowledge graph ${what.on ? 'on' : 'off'}`) : failed(`Couldn't turn the knowledge graph ${what.on ? 'on' : 'off'}.`)
      }
      case 'template': {
        if (what.op === 'select') {
          if (!a.selectTemplate) return missing()
          await a.selectTemplate(what.pick)
          return (await settle(s => s.template?.active?.id === what.pick.id, wait(PARITY_WAIT.move))) ? done(`Template set to ${what.pick.name}`) : failed("Couldn't choose that template.")
        }
        if (what.op === 'clear') {
          if (!a.clearTemplate) return missing()
          await a.clearTemplate()
          return (await settle(s => s.template?.active === null, wait(PARITY_WAIT.move))) ? done('Template cleared') : failed("Couldn't clear the template.")
        }
        if (!a.stopTemplateReuse) return missing()
        await a.stopTemplateReuse()
        return (await settle(s => s.template?.running === false, wait(PARITY_WAIT.move))) ? done('Asked Director to stop the template reuse') : failed("Couldn't stop the template reuse.")
      }
      case 'template-mode': {
        if (!a.setTemplateMode) return missing()
        await a.setTemplateMode(what.on)
        return (await settle(s => s.mode?.on === what.on, wait(PARITY_WAIT.change))) ? done(`Template Mode ${what.on ? 'on' : 'off'}`) : failed(`Couldn't turn Template Mode ${what.on ? 'on' : 'off'}.`)
      }
      case 'notes': {
        if (!a.toggleNotes) return missing()
        await a.toggleNotes()
        return (await settle(s => s.notes?.shown === what.show, wait(PARITY_WAIT.move))) ? done(what.show ? 'Notes shown' : 'Notes hidden') : failed(`Couldn't ${what.show ? 'show' : 'hide'} the notes.`)
      }
      case 'dark':
      case 'light':
      case 'system': {
        if (!a.setTheme) return missing()
        await a.setTheme(what.name)
        const label = THEME_LABELS[what.name]
        return (await settle(s => s.theme?.choice === what.name, wait(PARITY_WAIT.move))) ? done(what.name === 'system' ? 'Following your device appearance' : `${label} appearance on`) : failed(`Couldn't switch to ${label}.`)
      }
      case 'intro': {
        if (!a.replayIntro) return missing()
        await sleep(wait(WORKSPACE_WAIT.cleared)) // the typed command leaves the message box first: the introduction does not start over a draft
        await a.replayIntro()
        return (await settle(s => s.intro?.active === true, wait(PARITY_WAIT.present))) ? done('Replaying the introduction') : failed("The introduction couldn't start right now.")
      }
      case 'pane': {
        if (!a.selectPane) return missing()
        await a.selectPane(what.pane)
        return (await settle(s => s.pane?.showing === what.pane, wait(PARITY_WAIT.move))) ? done(`Showing ${PANE_LABELS[what.pane]}`) : failed(`Couldn't show ${PANE_LABELS[what.pane]}.`)
      }
      case 'history': {
        if (!a.openHistory) return missing()
        return (await a.openHistory()) === true ? done('Opened the version history. Pick a version in History to restore it.') : failed("Couldn't open the version history.")
      }
    }
  } catch {
    return failed("That didn't work. Nothing was changed that we could confirm.")
  }
}

/** The runner the viewer commands' bus calls first (lib/studio-chat-parity-viewer.ts registerParityRunner): it answers the runs this file owns, else null. */
export function runWorkspace(what: ParityRun, deps: ParityDeps): Promise<ParityResult> | null {
  return isWorkspaceRun(what) ? emitWorkspaceCommand(what, { scale: deps.scale }) : null
}

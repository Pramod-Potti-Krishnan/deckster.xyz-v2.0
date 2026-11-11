/**
 * FRONTEND-1, overnight chat parity (11 Nov), the REMAINING commands: "/" commands that open or call what an existing control does. Stacked on the workspace half (lib/studio-chat-parity-workspace.ts, PR #614) and the viewer half
 * (lib/studio-chat-parity-viewer.ts, PR #611): it reuses their words, loose matching, row and result types, and its rows draw in the same menu and the same index.
 * Gated by NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (which already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell). No new flag, no backend, no Director change.
 *
 *   /delete-theme <name>     the Themes page's own delete confirmation (components/studio-libraries/library-manage.tsx), opened for that theme: the page is opened, the person clicks Delete there
 *   /delete-template <name>  the Templates page's own, the same way (a Composer template shows the page's own reason)
 *   /model auto|fast|balanced|best   the model gauge's stop (the picker's own save: useModelChoice().select)      /model reset   the same save with nothing chosen (the Intelligence page's Reset)
 *   /model <work> <model>    the Intelligence page's per-task choice (the same account / device store and the same checks)
 *   /kg-search <words>       the Knowledge page, with its own search box filled and its own search run (read only)
 *   /ask <question>          the Knowledge page, with the Ask box FILLED. It is never sent from here: Ask costs money, so the person presses Ask
 *   /publish                 (the existing row) now presses the Publish button, which opens the Publish wizard; publishing itself stays a click inside it
 *   /switch-template <name>  the Template picker's "Switch to <name>" for the template Director suggested (switchTemplate)
 *   @template                a picked saved template is CHOSEN, the way the toolbar's Template picker chooses it (the workspace half's /template <name>), not written into the message
 *
 * Four rules (Opus design): one short note per command, said after it looked; a bad word is a hint row and the menu stays open; a command that cannot run is its row with its button's own reason; anything destructive,
 * outward-facing or paid OPENS the existing confirmation, wizard or box and never runs from typed text (a delete is a click on the page's own Delete; Ask is a click on Ask; Publish a click in the wizard).
 * The model rows run only when picked, and a tier or model that costs more says so in its row.
 *
 * A page this opens in a NEW TAB when a build is running or edits are unsaved (the Go to half's rule, kept here as it was not in this stack): the build keeps going, the edits stay.
 * Everything here is pure or module-level state: no React, no DOM, nothing from the network; the browser calls (router, tab, storage, the Publish press) are handles the composer hands in.
 */
import { PARITY_WAIT, PARITY_WORDS, looseScore } from '@/lib/studio-chat-parity-viewer'
import type { ParityResult, ParityRow, ViewerState } from '@/lib/studio-chat-parity-viewer'
import type { TemplatesState, WorkspaceRun } from '@/lib/studio-chat-parity-workspace'
import type { MoreHandoffKind, MoreHandoffRequest } from '@/lib/studio-chat-parity-more-handoff'

// ---- the words (one place) ------------------------------------------------------------------------------------------------------------------

export const MORE_WORDS = Object.freeze({
  noPage: 'Open the builder first.',
  themeOff: "Deleting themes isn't switched on here.",
  templateOff: "Deleting templates isn't switched on here.",
  loadingThemes: 'Looking up your themes…',
  themesFailed: "Couldn't load your themes. Try again.",
  noThemes: 'You have no saved themes yet.',
  noTheme: (typed: string) => `No saved theme matches "${typed}".`,
  loadingTemplates: 'Looking up your templates…',
  templatesFailed: "Couldn't load your templates. Try again.",
  noTemplates: 'You have no saved templates yet.',
  noTemplate: (typed: string) => `No saved template matches "${typed}".`,
  notYours: 'Only templates you saved can be deleted.',
  composerTemplate: "Composer templates can't be deleted here yet.",
  pickToConfirm: 'Opens the confirmation on the page',
  modelOff: "The model picker isn't turned on in this build.",
  modelLoading: 'Model choice is still loading. Try again in a moment.',
  modelHint: 'Say /model fast, /model reset, or /model <kind of work> <model>.',
  modelWork: 'Or type planning, writing or research, then a model.',
  modelNoTask: (typed: string) => `No kind of work matches "${typed}". Try planning, writing or research.`,
  modelNoModel: (task: string, typed: string) => `No model for ${task} matches "${typed}".`,
  modelAlready: (label: string) => `Already on ${label}.`,
  modelDefaults: 'Already following the defaults.',
  modelNoChoices: (task: string) => `${task} has nothing to choose from yet.`,
  modelFixed: (task: string) => `${task} isn't a choice yet: Deckster keeps it fixed for now.`,
  costNote: 'Higher tiers cost more.',
  searchHint: 'Type what to search your knowledge graph for.',
  searchLong: 'Keep the search under 300 characters.',
  askOff: "Ask your second brain isn't switched on here.",
  askHint: 'Type your question after /ask.',
  noMatch: 'Director has not suggested a template for this deck.',
  matchNone: (typed: string) => `No suggested template matches "${typed}".`,
  matchInUse: 'That template is already in use.',
  matchSent: 'Director could not be reached. Try again.',
  publishNotReady: 'Publish is not ready. The Publish button opens once the deck is built.',
  handoffFailed: "Couldn't hand that to the page. Your browser won't keep it.",
  templateGone: 'That template is not in your list any more.',
  nothingAfter: PARITY_WORDS.nothingAfter,
})
const W = MORE_WORDS

// ---- what the composer hands this file --------------------------------------------------------------------------------------------------------

export type MoreGroup = 'Library' | 'Model' | 'Knowledge' | 'Workspace'
export const MORE_GROUPS: readonly MoreGroup[] = Object.freeze(['Library', 'Model', 'Knowledge', 'Workspace'] as MoreGroup[])

export interface MoreThemeChoice { id: string; name: string }
export interface MoreTemplateChoice { id: string; name: string; /** The page's own reason this one cannot be deleted, else null. */ why: string | null }
export type MoreListStatus = 'idle' | 'loading' | 'ready' | 'failed'

/** The model gauge's choices, as plain data (lib/studio-chat-parity-more-model.ts builds it from the hook the gauge uses). */
export interface MoreModelStop { id: string; label: string; /** "$", "$$", "$$$": the cost hint the gauge shows, else null. */ hint: string | null; auto: boolean }
export interface MoreModelOption { value: string; label: string; preset: boolean }
export interface MoreModelTask { id: string; label: string; /** Imagery and narration: not a choice yet. */ fixed: boolean; /** What the page's select reads for it in this scope. */ choice: string; options: MoreModelOption[] }
export interface MoreModelState {
  ready: boolean
  scope: 'deck' | 'user'
  /** The gauge's current choice as a key: "auto", "tier:<id>", "model:<slug>" or "mixed". */
  current: string
  currentLabel: string
  stops: MoreModelStop[]
  /** Reset has something to reset (a choice is kept). */
  resetNeeded: boolean
  tasks: MoreModelTask[]
}
/** The answer of a model action: ok, and the words for a save that did not simply succeed (a conflict, a refusal, a missing deck scope). */
export interface MoreModelAnswer { ok: boolean; words: string }
export interface MoreModelActions {
  chooseStop: (stopId: string) => Promise<MoreModelAnswer>
  reset: () => Promise<MoreModelAnswer>
  chooseTask: (task: string, value: string) => Promise<MoreModelAnswer>
}
export interface MoreModelPart { state: MoreModelState | null; actions: MoreModelActions | null }

export interface MoreMatchRow { templateId: string | null; name: string; inUse: boolean }
export interface MoreEnv {
  themes: { status: MoreListStatus; items: MoreThemeChoice[] }
  templates: { status: MoreListStatus; items: MoreTemplateChoice[] }
  /** The gauge (null: no gauge is drawn). */
  model: MoreModelState | null
  /** The model gauge is switched on in this build (NEXT_PUBLIC_STUDIO_MODEL_CHOICE). */
  modelOn: boolean
  /** The suggested templates Director sent (the Template picker's "Use with this deck" group), empty with none. */
  match: MoreMatchRow[]
  flags: { themeDelete: boolean; templateDelete: boolean; ask: boolean }
  /** studioKgAskCheck: the Ask box's own refusal of an empty or over-long question. */
  checkQuestion: (text: string) => { ok: true; question: string } | { ok: false; message: string }
}

/** The browser calls a run makes. The composer sets them on every render (setMoreLive). */
export interface MorePage {
  /** The rows' env as the composer last drew it (the run asks for its block again with it; the gauge's part is read fresh from the bus). */
  env: () => MoreEnv
  /** A build is running now. */
  building: () => boolean
  /** The viewer's state now (edits unsaved?), null with no deck. */
  viewer: () => ViewerState | null
  /** The hand-off write (lib/studio-chat-parity-more-handoff.ts putBrowserHandoff): false when it could not be kept. */
  handoff: (request: MoreHandoffRequest) => boolean
  /** router.push. */
  go: (path: string) => void
  /** window.open(path, '_blank', 'noopener'). */
  openTab: (path: string) => void
  /** Press the Publish button: 'clicked' | 'missing' | 'disabled' (components pressControl). */
  pressPublish: () => 'clicked' | 'missing' | 'disabled'
  /** switchTemplate (hooks/use-studio-template-match.ts): true when it went out on an open socket. */
  switchTemplate: (templateId: string | null) => boolean
}
let live: MorePage | null = null
export function setMoreLive(page: MorePage | null): void { live = page }
export const moreLive = (): MorePage | null => live

// ---- the commands ---------------------------------------------------------------------------------------------------------------------------

export type MoreRun =
  | { more: true; name: 'delete-theme'; theme: MoreThemeChoice }
  | { more: true; name: 'delete-template'; template: { id: string; name: string } }
  | { more: true; name: 'model'; op: 'stop'; stop: string; label: string }
  | { more: true; name: 'model'; op: 'reset' }
  | { more: true; name: 'model'; op: 'task'; task: string; taskLabel: string; value: string; label: string }
  | { more: true; name: 'kg-search'; text: string }
  | { more: true; name: 'ask'; text: string }
  | { more: true; name: 'switch-template'; templateId: string | null; label: string }
export type MoreName = MoreRun['name']

interface MoreDef { name: MoreName; group: MoreGroup; blurb: string; label: string }

/** The menu's order: the template switch first, so it draws under the workspace half's own "Workspace" heading (the rows are pushed after those); then Library, Model, Knowledge. Every one takes a word after its name, so each first-level row is a "fill" row: picking it writes "/name " and the choices show. */
export const MORE_COMMANDS: readonly MoreDef[] = Object.freeze([
  { name: 'switch-template', group: 'Workspace', blurb: 'Switch to a template Director suggests', label: '/switch-template <name>' },
  { name: 'delete-theme', group: 'Library', blurb: 'Delete a saved theme (asks first)', label: '/delete-theme <name>' },
  { name: 'delete-template', group: 'Library', blurb: 'Delete a saved template (asks first)', label: '/delete-template <name>' },
  { name: 'model', group: 'Model', blurb: "Director's depth, or a model for one kind of work", label: '/model <choice>' },
  { name: 'kg-search', group: 'Knowledge', blurb: 'Search your knowledge graph', label: '/kg-search <words>' },
  { name: 'ask', group: 'Knowledge', blurb: 'Ask your second brain (you press Ask)', label: '/ask <question>' },
] as MoreDef[])

/** The real handler or control behind each command (the proof reads these names from the sources). */
export const MORE_HANDLERS: Readonly<Record<string, string>> = Object.freeze({
  'delete-theme': 'ManagedLibraryRow confirmDelete (the Themes page: deleteTheme)',
  'delete-template': 'ManagedLibraryRow confirmDelete (the Templates page: deleteTemplate)',
  'model:stop': 'useModelChoice select (the gauge stop: ModelPickerSlider commit)',
  'model:reset': 'useModelChoice select(null) (the Intelligence page reset)',
  'model:task': 'store.saveChoices (the Intelligence page choose)',
  'kg-search': 'runSearch (the Knowledge page search)',
  ask: 'StudioKgAsk (the Ask box, filled only)',
  publish: 'PublishControls trigger (data-studio-publish-trigger)',
  'switch-template': 'switchTemplate (StudioTemplateMatchChoices apply)',
  'template-mention': 'handleSelectTemplate (the workspace half: /template <name>)',
})

/** Where each page is (the routes the rail and the account menu already link to). */
export const MORE_PAGES = Object.freeze({
  themes: { path: '/studio/themes', label: 'Themes' },
  templates: { path: '/studio/templates', label: 'Templates' },
  knowledge: { path: '/knowledge', label: 'Knowledge' },
})
/** How many choices a typed word shows. */
export const MORE_ROWS = Object.freeze({ items: 8, models: 8 })
export const MORE_SEARCH_MAX = 300

export const isMoreRun = (run: unknown): run is MoreRun => Boolean(run) && typeof run === 'object' && (run as { more?: unknown }).more === true

// ---- when a command cannot run -----------------------------------------------------------------------------------------------------------------

const clip = (text: string, max: number): string => { const flat = text.replace(/\s+/g, ' ').trim(); return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat }

/** The reason a "type a word after it" command is out of reach even before any word. */
export function moreGeneral(name: MoreName, env: MoreEnv): string | null {
  switch (name) {
    case 'delete-theme': return env.flags.themeDelete ? null : W.themeOff
    case 'delete-template': return env.flags.templateDelete ? null : W.templateOff
    case 'ask': return env.flags.ask ? null : W.askOff
    case 'model': return !env.modelOn ? W.modelOff : !env.model || !env.model.ready ? W.modelLoading : null
    case 'switch-template': return env.match.length ? null : W.noMatch
    default: return null
  }
}

/** Why `run` cannot run now, else null (the run asks again, with the state it reads just before it acts). */
export function moreBlocked(run: MoreRun, env: MoreEnv): string | null {
  const held = moreGeneral(run.name, env)
  if (held) return held
  switch (run.name) {
    case 'model': {
      const model = env.model as MoreModelState
      if (run.op === 'stop') return model.current === (model.stops.find(stop => stop.id === run.stop)?.auto ? 'auto' : `tier:${run.stop}`) ? W.modelAlready(run.label) : null
      if (run.op === 'reset') return model.resetNeeded ? null : W.modelDefaults
      const task = model.tasks.find(item => item.id === run.task)
      if (!task || task.fixed) return W.modelFixed(run.taskLabel)
      return task.choice === run.value ? W.modelAlready(run.label) : null
    }
    case 'delete-template': {
      const item = env.templates.items.find(entry => entry.id === run.template.id)
      return item?.why ?? null
    }
    case 'switch-template': {
      const row = env.match.find(entry => entry.templateId === run.templateId)
      return row?.inUse ? W.matchInUse : null
    }
    default: return null
  }
}

// ---- the rows the "/" menu draws -------------------------------------------------------------------------------------------------------------

export interface MoreTrigger { name: string; arg: string | null }

/** A row of this file is the viewer half's row shape; its group, command and run go in through this one cast (the viewer half's lib is left as it is). */
const mk = (command: MoreName, group: MoreGroup, label: string, blurb: string, what: MoreRun | null, disabled: string | null, key: string): ParityRow =>
  ({ key, command: command as unknown as ParityRow['command'], group: group as unknown as ParityRow['group'], label, blurb, disabled, hint: null, fill: false, run: what as unknown as ParityRow['run'] })
const problem = (command: MoreName, group: MoreGroup, label: string, text: string, key: string): ParityRow => ({ ...mk(command, group, label, '', null, null, key), hint: text })
const fillRow = (def: MoreDef, disabled: string | null): ParityRow => ({ ...mk(def.name, def.group, def.label, def.blurb, null, disabled, `more:${def.name}`), fill: true })
const R = (value: { name: MoreName } & Record<string, unknown>): MoreRun => ({ more: true, ...value }) as MoreRun
const best = <T extends { name: string }>(items: readonly T[], query: string, extra?: (item: T) => number): T[] =>
  items.map((item, order) => ({ item, order, score: Math.max(looseScore(query, item.name), extra ? extra(item) : 0) })).filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order).map(entry => entry.item).slice(0, MORE_ROWS.items)

function themeRows(arg: string, env: MoreEnv): ParityRow[] {
  const { status, items } = env.themes
  const hits = best(items, arg)
  if (hits.length) return hits.map(item => mk('delete-theme', 'Library', `/delete-theme ${clip(item.name, 28)}`, `${W.pickToConfirm} Themes`, R({ name: 'delete-theme', theme: item }), null, `more:delete-theme:${item.id}`))
  if (status === 'idle' || status === 'loading') return [problem('delete-theme', 'Library', '/delete-theme …', W.loadingThemes, 'more:delete-theme:loading')]
  if (status === 'failed') return [problem('delete-theme', 'Library', '/delete-theme …', W.themesFailed, 'more:delete-theme:failed')]
  return [problem('delete-theme', 'Library', `/delete-theme ${arg}`.trimEnd(), arg ? W.noTheme(arg) : W.noThemes, 'more:delete-theme:none')]
}

function templateRowsFor(arg: string, env: MoreEnv): ParityRow[] {
  const { status, items } = env.templates
  const hits = best(items, arg)
  if (hits.length) {
    return hits.map(item => {
      const what = R({ name: 'delete-template', template: { id: item.id, name: item.name } })
      return mk('delete-template', 'Library', `/delete-template ${clip(item.name, 28)}`, `${W.pickToConfirm} Templates`, what, item.why, `more:delete-template:${item.id}`)
    })
  }
  if (status === 'idle' || status === 'loading') return [problem('delete-template', 'Library', '/delete-template …', W.loadingTemplates, 'more:delete-template:loading')]
  if (status === 'failed') return [problem('delete-template', 'Library', '/delete-template …', W.templatesFailed, 'more:delete-template:failed')]
  return [problem('delete-template', 'Library', `/delete-template ${arg}`.trimEnd(), arg ? W.noTemplate(arg) : W.noTemplates, 'more:delete-template:none')]
}

const depthBlurb = (stop: MoreModelStop): string => (stop.auto ? 'Let Deckster choose' : `Set Director's depth to ${stop.label}${stop.hint ? ` (cost ${stop.hint})` : ''}`)

function modelRows(arg: string, env: MoreEnv): ParityRow[] {
  const model = env.model as MoreModelState
  const words = arg.trim().split(/\s+/).filter(Boolean)
  const first = (words[0] ?? '').toLowerCase()
  const rest = words.slice(1).join(' ')
  const rows: ParityRow[] = []
  const stopRow = (stop: MoreModelStop) => {
    const what = R({ name: 'model', op: 'stop', stop: stop.id, label: stop.label })
    return mk('model', 'Model', `/model ${stop.label.toLowerCase()}`, depthBlurb(stop), what, moreBlocked(what, env), `more:model:stop:${stop.id}`)
  }
  // a typed first word that names a kind of work, then the model typed after it
  const named = first ? model.tasks.filter(task => looseScore(first, task.label) > 0 || looseScore(first, task.id.replace(/_/g, ' ')) > 0) : []
  if (words.length > 1 || (named.length > 0 && !model.stops.some(stop => stop.label.toLowerCase().startsWith(first)) && !'reset'.startsWith(first))) {
    if (!named.length) return [problem('model', 'Model', `/model ${arg}`, W.modelNoTask(words[0] ?? arg), 'more:model:none')]
    for (const task of named) {
      if (task.fixed) { rows.push(problem('model', 'Model', `/model ${task.label.toLowerCase()}`, W.modelFixed(task.label), `more:model:task:${task.id}:fixed`)); continue }
      const hits = best(task.options.map(option => ({ ...option, name: option.label })), rest)
      const shown = rest ? hits : task.options.slice(0, MORE_ROWS.models).map(option => ({ ...option, name: option.label }))
      if (!shown.length) { rows.push(problem('model', 'Model', `/model ${first} ${rest}`.trimEnd(), rest ? W.modelNoModel(task.label, rest) : W.modelNoChoices(task.label), `more:model:task:${task.id}:none`)); continue }
      for (const option of shown) {
        const label = clip(option.label.split(' · ')[0].split(' — ')[0], 26)
        const what = R({ name: 'model', op: 'task', task: task.id, taskLabel: task.label, value: option.value, label })
        rows.push(mk('model', 'Model', `/model ${task.label.split(' ')[0].toLowerCase()} ${label}`, `Use ${label} for ${task.label}${option.preset ? ` · ${W.costNote}` : ''}`, what, moreBlocked(what, env), `more:model:task:${task.id}:${option.value}`))
      }
    }
    return rows
  }
  for (const stop of model.stops.filter(item => !first || item.label.toLowerCase().startsWith(first))) rows.push(stopRow(stop))
  if (!first || 'reset'.startsWith(first)) {
    const what = R({ name: 'model', op: 'reset' })
    rows.push(mk('model', 'Model', '/model reset', 'Go back to the default model choices', what, moreBlocked(what, env), 'more:model:reset'))
  }
  for (const task of named) rows.push(mk('model', 'Model', `/model ${task.label.split(' ')[0].toLowerCase()} …`, `Type the model for ${task.label}`, null, null, `more:model:task:${task.id}:fill`))
  if (!first) rows.push(problem('model', 'Model', '/model <work> <model>', W.modelWork, 'more:model:work'))
  if (!rows.length) rows.push(problem('model', 'Model', `/model ${arg}`, W.modelHint, 'more:model:none'))
  return rows
}

function searchRows(arg: string): ParityRow[] {
  if (!arg) return [problem('kg-search', 'Knowledge', '/kg-search …', W.searchHint, 'more:kg-search:hint')]
  if (arg.length > MORE_SEARCH_MAX) return [problem('kg-search', 'Knowledge', `/kg-search ${clip(arg, 20)}`, W.searchLong, 'more:kg-search:long')]
  return [mk('kg-search', 'Knowledge', `/kg-search ${clip(arg, 28)}`, 'Open Knowledge and search for it', R({ name: 'kg-search', text: arg }), null, 'more:kg-search:run')]
}

function askRows(arg: string, env: MoreEnv): ParityRow[] {
  if (!arg) return [problem('ask', 'Knowledge', '/ask …', W.askHint, 'more:ask:hint')]
  const checked = env.checkQuestion(arg)
  if (!checked.ok) return [problem('ask', 'Knowledge', `/ask ${clip(arg, 20)}`, checked.message, 'more:ask:refused')]
  return [mk('ask', 'Knowledge', `/ask ${clip(checked.question, 28)}`, 'Open Knowledge with your question in the Ask box. You press Ask', R({ name: 'ask', text: checked.question }), null, 'more:ask:run')]
}

function matchRows(arg: string, env: MoreEnv): ParityRow[] {
  const hits = best(env.match.map(row => ({ ...row, name: row.name })), arg)
  if (!hits.length) return [problem('switch-template', 'Workspace', `/switch-template ${arg}`.trimEnd(), arg ? W.matchNone(arg) : W.noMatch, 'more:switch-template:none')]
  return hits.map(row => {
    const what = R({ name: 'switch-template', templateId: row.templateId, label: row.name })
    return mk('switch-template', 'Workspace', `/switch-template ${clip(row.name, 28)}`, 'Use it for the slides not built yet', what, moreBlocked(what, env), `more:switch-template:${row.templateId ?? 'none'}`)
  })
}

/**
 * The rows for a "/" trigger. Nothing after the name: every command whose name starts with it, then those that contain it. A word after the name: the choices of that command (the saved themes or templates, a depth or a
 * model, the suggested templates), or a hint when nothing it could mean is there. A command out of reach is its fill row with its reason. Never an empty answer for a command this file owns.
 */
export function moreRows(trigger: MoreTrigger, env: MoreEnv): ParityRow[] {
  const name = trigger.name.toLowerCase()
  if (trigger.arg === null) {
    const starts = MORE_COMMANDS.filter(def => def.name.startsWith(name))
    const contains = name ? MORE_COMMANDS.filter(def => !def.name.startsWith(name) && def.name.includes(name)) : []
    return [...starts, ...contains].map(def => fillRow(def, moreGeneral(def.name, env)))
  }
  const def = MORE_COMMANDS.find(item => item.name === name)
  if (!def) return []
  const arg = trigger.arg.trim()
  const held = moreGeneral(def.name, env)
  if (held) return [mk(def.name, def.group, `/${def.name} ${arg}`.trimEnd(), held, null, held, `more:${def.name}:held`)]
  switch (def.name) {
    case 'delete-theme': return themeRows(arg, env)
    case 'delete-template': return templateRowsFor(arg, env)
    case 'model': return modelRows(arg, env)
    case 'kg-search': return searchRows(arg)
    case 'ask': return askRows(arg, env)
    case 'switch-template': return matchRows(arg, env)
  }
}

/** The run behind a picked "@" template: the workspace half's own select (handleSelectTemplate), or the reason it is not chosen. */
export function templateMentionRun(templates: TemplatesState, id: string): { run: WorkspaceRun } | { note: string } {
  const item = templates.items.find(entry => entry.id === id)
  if (!item) return { note: W.templateGone }
  if (!item.ready) return { note: item.why || W.templateGone }
  return { run: { ws: true, name: 'template', op: 'select', pick: item.pick } }
}

// ---- the model gauge's part (the hook the gauge uses registers it) -------------------------------------------------------------------------------

let modelGet: (() => MoreModelPart | null) | null = null
let modelSnapshot: MoreModelState | null = null
let modelSignature = ''
const modelListeners = new Set<() => void>()
const modelNow = (): MoreModelPart | null => { try { return modelGet?.() ?? null } catch { return null } }

/** Called by the gauge's hook after every commit: the composer hears about it only when the state it shows changed. */
export function publishMoreModel(): void {
  const next = modelNow()?.state ?? null
  const text = next ? JSON.stringify(next) : ''
  if (text === modelSignature) return
  modelSignature = text
  modelSnapshot = next
  for (const listener of Array.from(modelListeners)) listener()
}
/** The gauge's hook registers a getter of its latest { state, actions }; the returned function unregisters it (only if it is still the one registered). */
export function registerMoreModel(get: () => MoreModelPart | null): () => void {
  modelGet = get
  publishMoreModel()
  return () => { if (modelGet === get) { modelGet = null; publishMoreModel() } }
}
export const subscribeMoreModel = (listener: () => void): (() => void) => { modelListeners.add(listener); return () => { modelListeners.delete(listener) } }
export const moreModelSnapshot = (): MoreModelState | null => modelSnapshot
export const moreModelNow = (): MoreModelPart | null => modelNow()

// ---- running a command ---------------------------------------------------------------------------------------------------------------------

const done = (note: string): ParityResult => ({ ok: true, note })
const failed = (note: string): ParityResult => ({ ok: false, note })
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/** Why this page opens in a new tab: a build is running, or the viewer holds edits that are not saved (a save still going, or the last one failed). */
export function awayReason(building: boolean, viewer: ViewerState | null): 'build' | 'edits' | null {
  if (building || Boolean(viewer?.building)) return 'build'
  return viewer && viewer.save !== 'saved' ? 'edits' : null
}
const NEW_TAB = Object.freeze({ build: ' in a new tab so your build keeps going', edits: ' in a new tab so your edits stay here' })

/** Look at the gauge's state until `test` holds (false when it never does within `ms`). */
async function settleModel(test: (state: MoreModelState) => boolean, ms: number): Promise<boolean> {
  const end = Date.now() + ms
  for (;;) {
    const state = modelNow()?.state
    if (state && test(state)) return true
    if (Date.now() >= end) return false
    await sleep(40)
  }
}

/** The Publish button, pressed: it opens the Publish wizard; nothing is published from here. */
export function openPublish(press: () => 'clicked' | 'missing' | 'disabled'): ParityResult {
  return press() === 'clicked' ? done('Opened Publish. Press Publish there to share the deck.') : failed(W.publishNotReady)
}

/**
 * Run a command: ask for its block once more (the same words the menu showed), then do what the control does. A page it opens is opened, not driven (the page does its own work from the hand-off); a model change is
 * called on the gauge's own hook and then SEEN in its state; nothing here deletes, publishes or asks. Never throws.
 */
export async function emitMoreCommand(what: MoreRun, options: { scale?: number } = {}): Promise<ParityResult> {
  const page = live
  if (!page) return failed(W.noPage)
  const env: MoreEnv = { ...page.env(), model: modelNow()?.state ?? null }
  const blocked = moreBlocked(what, env)
  if (blocked) return failed(blocked)
  const wait = (ms: number) => Math.max(1, Math.round(ms * (options.scale ?? 1)))
  try {
    switch (what.name) {
      case 'delete-theme':
      case 'delete-template':
      case 'kg-search':
      case 'ask': {
        const kind: MoreHandoffKind = what.name === 'delete-theme' ? 'delete-theme' : what.name === 'delete-template' ? 'delete-template' : what.name === 'kg-search' ? 'kg-search' : 'kg-ask'
        const target = what.name === 'delete-theme' ? MORE_PAGES.themes : what.name === 'delete-template' ? MORE_PAGES.templates : MORE_PAGES.knowledge
        const text = what.name === 'delete-theme' ? what.theme.name : what.name === 'delete-template' ? what.template.name : what.text
        const id = what.name === 'delete-theme' ? what.theme.id : what.name === 'delete-template' ? what.template.id : null
        if (!page.handoff({ kind, text, id })) return failed(W.handoffFailed)
        const away = awayReason(page.building(), page.viewer())
        if (away) page.openTab(target.path); else page.go(target.path)
        const where = `${target.label}${away ? NEW_TAB[away] : ''}`
        if (what.name === 'delete-theme' || what.name === 'delete-template') return done(`Opened ${where}. Confirm there to delete “${clip(text, 40)}”.`)
        if (what.name === 'kg-search') return done(`Opened ${where} and searched for “${clip(text, 40)}”.`)
        return done(`Opened ${where} with your question in the Ask box. Press Ask there to send it.`)
      }
      case 'model': {
        const part = modelNow()
        const actions = part?.actions
        if (!actions) return failed(W.modelOff)
        if (what.op === 'stop') {
          const stop = (env.model as MoreModelState).stops.find(item => item.id === what.stop)
          const answer = await actions.chooseStop(what.stop)
          if (!answer.ok) return failed(answer.words || "Couldn't save that choice.")
          const key = stop?.auto ? 'auto' : `tier:${what.stop}`
          return (await settleModel(state => state.current === key, wait(PARITY_WAIT.move))) ? done(`Director depth: ${what.label}${answer.words ? `. ${answer.words}` : ''}`) : failed("Couldn't confirm the change. Check the gauge.")
        }
        if (what.op === 'reset') {
          const answer = await actions.reset()
          if (!answer.ok) return failed(answer.words || "Couldn't reset the model choices.")
          return (await settleModel(state => !state.resetNeeded, wait(PARITY_WAIT.move))) ? done('Model choices are back to the defaults') : failed("Couldn't confirm the reset. Check the gauge.")
        }
        const answer = await actions.chooseTask(what.task, what.value)
        if (!answer.ok) return failed(answer.words || "Couldn't save that choice.")
        return (await settleModel(state => state.tasks.find(task => task.id === what.task)?.choice === what.value, wait(PARITY_WAIT.move))) ? done(`${what.taskLabel} now uses ${what.label}${answer.words ? `. ${answer.words}` : ''}`) : failed("Couldn't confirm the change. Check the Intelligence page.")
      }
      case 'switch-template': {
        return page.switchTemplate(what.templateId) ? done(`Asked Director to use ${what.label} for the slides not built yet`) : failed(W.matchSent)
      }
    }
  } catch {
    return failed("That didn't work. Nothing was changed that we could confirm.")
  }
}

/** The runner the viewer commands' bus calls (lib/studio-chat-parity-viewer.ts registerParityRunner, after the workspace half's): it answers the runs this file owns, else null. */
export function runMore(what: { name: string }, deps: { scale?: number }): Promise<ParityResult> | null {
  return isMoreRun(what) ? emitMoreCommand(what, { scale: deps.scale }) : null
}

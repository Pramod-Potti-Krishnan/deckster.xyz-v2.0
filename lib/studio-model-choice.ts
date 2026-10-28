// FRONTEND-2 P3-10 MODEL CHOICE (flag NEXT_PUBLIC_STUDIO_MODEL_CHOICE, exact "true", default off, build-time; it acts only with NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE on, and the Intelligence page
// exists only with the Studio shell on). Everything the live model picker decides, with no request made here: which catalogue group each of the five tasks reads, what each row's select offers, how a
// choice resolves, and the adapter that keeps choices (the requests it makes are injected).
//
// The catalogue is Director's read-only passthrough of the Model Router's catalogue (GET /api/models/catalogue, lib/studio-model-catalog.ts parses it). ROUTER-2's rules, as this file applies them:
//   - a task reads the catalogue group of the same id, and only while that group's visibility is "user"; embeddings (D24) and every non-user group are never offered, whatever the catalogue says;
//   - v1: only the three text groups can be chosen; imagery and narration are "Fixed for now" (no certified model; the router refuses a choice there);
//   - the options are the group's selectable_models (certified for the group) and its presets; a preset is offered only when the model it names is one of those, so a choice is always a certified one;
//   - narration offers audio (speech output) models only and imagery image-output models only (for when they open); a model whose capabilities the catalogue does not carry is not offered there;
//   - the presets are quick, economy, balanced, best and max (model-router, 26 Oct); the wire value of "Fast" stays "economy". Cost: a model's catalogue cost_hint ($ / $$ / $$$) when the router sends one, else the tier's hint
//     ($ Fast, $$ Balanced, $$$ Best); never a price;
//   - the default ("Recommended") names no model: with no choice the router picks the task's own model per call, which the catalogue does not name.
// A text task whose group is missing or not user-visible, and every text task when the catalogue cannot be loaded, keeps today's static options (lib/studio-intelligence-p2.ts).
//
// Choices are kept through the adapter: loadChoices(scope) / saveChoices(scope, choices). Design (A) of ROUTER-2's P3-10 doc: they are SAVED in the router, through Studio's own server routes
// (lib/studio-model-choice-server.ts; the browser never calls the router and never sends a user id). "This presentation" is this Studio session (its id is the deck key). While those routes answer 503
// router_not_configured (no MODEL_ROUTER_FRONTEND_KEY yet), or cannot be reached, the choices stay in this browser (localStorage, a NEW key per scope; the Pass 2 picker's key is read once and copied,
// never changed), and the page says so.

import { P2_DEFAULT_CHOICE, P2_TASKS, isP2Choice, p2Options, p2Resolve, type P2Catalog, type P2OptionGroups, type P2TaskId } from '@/lib/studio-intelligence-p2'
import { modelTitle, providerLabel, providerOf, type Catalogue, type CatalogueGroup } from '@/lib/studio-model-catalog'

export const STUDIO_MODEL_CHOICE_FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE'

// ---------------------------------------------------------------------------------------------------------------- tasks, groups, tiers

/** The catalogue group each Pass 2 task reads. The five task ids are the router's own group ids. */
export const MODEL_CHOICE_GROUP_FOR_TASK: Readonly<Record<P2TaskId, string>> = {
  planning_strategy: 'planning_strategy',
  content_writing: 'content_writing',
  research_analysis: 'research_analysis',
  imagery: 'imagery',
  voice_narration: 'voice_narration',
}
/** Never switched by a person, whatever the catalogue says about them (D24). */
export const MODEL_CHOICE_NEVER_GROUPS: readonly string[] = ['embeddings']
/** The groups a person can choose in v1 (ROUTER-2, P3-10 doc 3.4 and 6.8): the three text groups. Imagery and narration have no certified model, so they are "Fixed for now". */
export const MODEL_CHOICE_CHOOSABLE_GROUPS: readonly string[] = ['planning_strategy', 'content_writing', 'research_analysis']
/** The capability a group's models must have to be offered there (narration: audio models only; imagery: image models only). */
export const MODEL_CHOICE_GROUP_NEEDS: Readonly<Record<string, 'speechOutput' | 'imageOutput'>> = { voice_narration: 'speechOutput', imagery: 'imageOutput' }

/** The presets the router has (model-router, 26 Oct: quick and max joined the three of Pass 2). The wire value of "Fast" stays "economy". */
export type PresetId = 'quick' | 'economy' | 'balanced' | 'best' | 'max'
/** THE list of preset ids Studio carries, quickest and cheapest first: the router's enum as the Studio routes accept it (lib/studio-model-choice-server.ts reads it) and the compact picker and the slider offer it
 * (lib/studio-model-slider.ts SLIDER_SAVABLE_PRESETS). It is also the order the picker uses while the catalogue sends no preset_order. */
export const MODEL_CHOICE_PRESET_IDS: readonly PresetId[] = ['quick', 'economy', 'balanced', 'best', 'max']
/** The presets as Studio shows them (the Intelligence page lists them dearest first). Their cost hints are the tier's own; a model's catalogue cost_hint wins where the router sends one. */
export const MODEL_CHOICE_TIERS: readonly { id: PresetId; label: string; hint: string }[] = [
  { id: 'max', label: 'Max', hint: '$$$' },
  { id: 'best', label: 'Best', hint: '$$$' },
  { id: 'balanced', label: 'Balanced', hint: '$$' },
  { id: 'economy', label: 'Fast', hint: '$' },
  { id: 'quick', label: 'Quick', hint: '$' },
]
export const modelChoiceTier = (id: PresetId) => MODEL_CHOICE_TIERS.find(tier => tier.id === id) as { id: PresetId; label: string; hint: string }
const COST_HINTS = ['$', '$$', '$$$']
/** The longest preset hint kept (the catalogue's preset_hints are one short line each; a longer one is dropped, not cut). */
export const PRESET_HINT_MAX = 200

const isPreset = (value: string): value is PresetId => (MODEL_CHOICE_PRESET_IDS as readonly string[]).includes(value)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

// ---------------------------------------------------------------------------------------------------------------- words

export const MODEL_CHOICE_DEFAULT_NAME = 'Deckster chooses'
export const MODEL_CHOICE_SUGGESTED = 'Suggested'
export const MODEL_CHOICE_FIXED = 'Fixed for now'
export const MODEL_CHOICE_FIXED_NOTE = 'Deckster picks this model. No model is certified for choosing here yet.'
export const MODEL_CHOICE_COST_NOTE = 'Cost hint: $ is the lowest-cost tier and $$$ the highest. Prices are not listed.'
/** The one note, per where the choices are kept. None of them claims a choice is used before the next build, and the device ones claim nothing. */
export const MODEL_CHOICE_NOTE = {
  pending: 'Your choices are kept on this device. Deckster does not use them to pick models yet.',
  account: 'Your choices are saved to your account. They apply from the next build.',
  'not-configured': 'Saving isn’t switched on yet; your choice stays on this device.',
  unreachable: 'Your choices could not be saved to your account right now, so they stay on this device. They do not change which models Deckster uses.',
  'no-storage': 'This browser cannot keep your choices, so they last only until you reload or leave. Deckster does not use them to pick models yet.',
} as const
export const MODEL_CHOICE_FALLBACK_NOTE = 'The live model list could not be loaded, so the built-in list is shown.'
export const MODEL_CHOICE_LOADING = 'Loading the model list…'
export const MODEL_CHOICE_DROPPED = 'An earlier choice is not open for selection now, so that task follows the recommendation.'
export const MODEL_CHOICE_RESTORED = 'Your earlier choices were restored.'
export const MODEL_CHOICE_CONFLICT = 'Your choices changed elsewhere, so the saved ones are shown.'
export const MODEL_CHOICE_REFUSED = 'That choice cannot be saved for this task right now.'
/** The router refused { auto: true } for this presentation (code invalid_preference_auto, or the router has not got Auto yet): the earlier choice stays, and the words say it was Auto. */
export const MODEL_CHOICE_REFUSED_AUTO = 'Auto cannot be saved for this presentation right now, so it keeps what it had.'
/** "This presentation" has two ways to leave a task to Deckster: the deck's own Auto (the sentinel { auto: true }, kept as the value "auto") and "Use my default" (the group left out, kept as "default"). On "Reusable defaults" there is only Auto, which is no choice at all. */
export const MODEL_CHOICE_AUTO = 'auto'
export const MODEL_CHOICE_AUTO_LABEL = 'Auto: Deckster chooses'
export const MODEL_CHOICE_USE_DEFAULT = 'Use my default'
export const MODEL_CHOICE_AUTO_NAME = 'Auto'
export const MODEL_CHOICE_NO_MODELS = 'No models are open for selection for this task yet, so Deckster chooses.'
export const MODEL_CHOICE_SCOPE_DECK_NONE = 'Open this page from a presentation to choose for it alone.'
export const MODEL_CHOICE_SCOPE_DECK_UNAVAILABLE = 'Choices for one presentation aren’t available yet, so your reusable defaults apply.'
export const MODEL_CHOICE_SCOPE_DECK_NOT_SAVED = 'Choices for this presentation can’t be saved yet, so your reusable defaults apply.'
export const MODEL_CHOICE_SCOPE_DECK_RULE = 'Applies from this presentation’s next build. A new presentation’s first build uses your reusable defaults.'

// ---------------------------------------------------------------------------------------------------------------- the live catalogue, with its presets and cost hints

/** A parsed catalogue (lib/studio-model-catalog.ts) plus each group's presets and each model's cost_hint, which that parser does not keep. */
export type ChoiceCatalogue = Catalogue & {
  presets: Record<string, Partial<Record<PresetId, string>>>
  costHints: Record<string, string>
  /** The catalogue's top-level preset_order (only the ids Studio knows, each once); null while the catalogue sends none (Director's flag DIRECTOR_MODEL_CATALOGUE_PRESETS_ENABLED is off): the picker then uses MODEL_CHOICE_PRESET_IDS. */
  presetOrder: PresetId[] | null
  /** The catalogue's top-level preset_hints: one short line per known preset id (a string of 1 to PRESET_HINT_MAX characters; anything else is dropped). */
  presetHints: Record<string, string>
}

/** `catalogue` (parsed from `body`) with `body`'s presets (only the ids Studio knows, only non-empty ones), its preset_order and preset_hints (absent until Director's flag is on) and cost hints (only "$", "$$" or "$$$"; absent while the router's flag is off). */
export function withPresets(catalogue: Catalogue, body: unknown): ChoiceCatalogue {
  const presets: Record<string, Partial<Record<PresetId, string>>> = Object.create(null)
  const costHints: Record<string, string> = Object.create(null)
  const groups = isRecord(body) && isRecord(body.groups) ? body.groups : {}
  for (const key of Object.keys(groups)) {
    const group = groups[key]
    const raw = isRecord(group) && isRecord(group.presets) ? group.presets : {}
    const kept: Partial<Record<PresetId, string>> = {}
    for (const tier of MODEL_CHOICE_TIERS) if (typeof raw[tier.id] === 'string' && raw[tier.id] !== '') kept[tier.id] = raw[tier.id] as string
    presets[key] = kept
  }
  const order = isRecord(body) && Array.isArray(body.preset_order) ? [...new Set(body.preset_order.filter((id): id is PresetId => typeof id === 'string' && isPreset(id)))] : []
  const presetHints: Record<string, string> = Object.create(null)
  const hintsRaw = isRecord(body) && isRecord(body.preset_hints) ? body.preset_hints : {}
  for (const id of Object.keys(hintsRaw)) {
    const text = hintsRaw[id]
    if (isPreset(id) && typeof text === 'string' && text.trim() !== '' && text.trim().length <= PRESET_HINT_MAX) presetHints[id] = text.trim()
  }
  const models = isRecord(body) && isRecord(body.models) ? body.models : {}
  for (const slug of Object.keys(models)) {
    const model = models[slug]
    const hint = isRecord(model) ? model.cost_hint : undefined
    if (typeof hint === 'string' && COST_HINTS.includes(hint)) costHints[slug] = hint
  }
  return { ...catalogue, presets, costHints, presetOrder: order.length > 0 ? order : null, presetHints }
}

/** The group a task reads, or null: no catalogue, no such group, a group that is not user-visible, or one that is never switched. */
export function choiceGroup(catalogue: ChoiceCatalogue | null, task: P2TaskId): CatalogueGroup | null {
  if (!catalogue) return null
  const key = MODEL_CHOICE_GROUP_FOR_TASK[task]
  if (!key || MODEL_CHOICE_NEVER_GROUPS.includes(key)) return null
  const group = catalogue.groups.find(candidate => candidate.key === key)
  return group && group.visible && !MODEL_CHOICE_NEVER_GROUPS.includes(group.key) ? group : null
}

/** The models a group offers: its selectable (certified) models, each once, and for narration and imagery only those with the capability the group needs. */
export function offeredModels(catalogue: ChoiceCatalogue, group: CatalogueGroup): string[] {
  const need = MODEL_CHOICE_GROUP_NEEDS[group.key]
  const seen = new Set<string>()
  return group.selectable.filter(slug => {
    if (seen.has(slug)) return false
    seen.add(slug)
    if (!need) return true
    const model = catalogue.models[slug]
    return Boolean(model && model[need] === true)
  })
}

/** The model a preset names for a group, or null when it names none or one the group does not offer. */
export function presetModel(catalogue: ChoiceCatalogue, group: CatalogueGroup, tier: PresetId): string | null {
  const slug = catalogue.presets[group.key]?.[tier]
  return slug && offeredModels(catalogue, group).includes(slug) ? slug : null
}

const suggestedSet = (group: CatalogueGroup) => new Set(Object.keys(group.suggested))
const titleOf = (catalogue: ChoiceCatalogue, slug: string) => modelTitle(slug, catalogue.models[slug])
const providerNameOf = (catalogue: ChoiceCatalogue, slug: string) => { const vendor = providerOf(slug, catalogue.models[slug]); return vendor ? providerLabel(vendor) : null }

// ---------------------------------------------------------------------------------------------------------------- one row: its options, its choices, what a choice is

export type ChoiceOrigin = 'Recommended' | 'Your choice' | 'Reusable default' | 'Fixed' | 'Deckster chooses'
export interface ChoiceResolved {
  /** What the row shows in bold. */
  name: string
  provider: string | null
  /** The model behind the choice; null for the live default, which names none. */
  modelId: string | null
  tier: PresetId | null
  /** The cost hint the row shows with a tier: the model's own when the catalogue has one, else the tier's. */
  hint: string | null
  origin: ChoiceOrigin
}
export interface ModelInfo { name: string; contextWindow: number | null; imageOutput: boolean; tools: boolean }
export interface RowSource {
  task: P2TaskId
  /** live: the catalogue group of the same id; static: today's built-in list (no user-visible group, or no catalogue); fixed: not choosable in v1 (imagery, narration). */
  kind: 'live' | 'static' | 'fixed'
  options: P2OptionGroups
  isChoice(value: unknown): value is string
  resolve(value: string): ChoiceResolved
  /** The models the comparison may show (narration and fixed rows: none). */
  compareIds: string[]
  info(id: string): ModelInfo | null
}
/** The static catalog the page carries (components/studio-personal/model-catalog-snapshot*.json): the Pass 2 shape plus the comparison fields. */
export type StaticCatalog = P2Catalog & { models: Record<string, { name: string; provider: string; contextWindow?: number; imageOutput?: boolean; tools?: boolean }> }

const DEFAULT_RESOLVED: ChoiceResolved = { name: MODEL_CHOICE_DEFAULT_NAME, provider: null, modelId: null, tier: null, hint: null, origin: 'Recommended' }
const NO_OPTIONS = (label: string): P2OptionGroups => ({ recommended: { value: P2_DEFAULT_CHOICE, label }, presets: [], models: [], voices: [] })

function fixedSource(task: P2TaskId): RowSource {
  return {
    task, kind: 'fixed', options: NO_OPTIONS(MODEL_CHOICE_FIXED),
    isChoice: (value: unknown): value is string => value === P2_DEFAULT_CHOICE,
    resolve: () => ({ name: MODEL_CHOICE_FIXED, provider: null, modelId: null, tier: null, hint: null, origin: 'Fixed' }),
    compareIds: [], info: () => null,
  }
}

function liveSource(catalogue: ChoiceCatalogue, group: CatalogueGroup, task: P2TaskId): RowSource {
  const offered = offeredModels(catalogue, group)
  const suggested = suggestedSet(group)
  const isChoice = (value: unknown): value is string => {
    if (typeof value !== 'string') return false
    if (value === P2_DEFAULT_CHOICE) return true
    if (isPreset(value)) return presetModel(catalogue, group, value) !== null
    return value.startsWith('model:') && offered.includes(value.slice(6))
  }
  const hintFor = (slug: string, tier: PresetId | null) => catalogue.costHints[slug] ?? (tier ? modelChoiceTier(tier).hint : null)
  const resolve = (value: string): ChoiceResolved => {
    const valid = isChoice(value) ? value : P2_DEFAULT_CHOICE
    if (valid === P2_DEFAULT_CHOICE) return DEFAULT_RESOLVED
    const tier = isPreset(valid) ? valid : null
    const slug = tier ? (presetModel(catalogue, group, tier) as string) : valid.slice(6)
    return { name: titleOf(catalogue, slug), provider: providerNameOf(catalogue, slug), modelId: slug, tier, hint: hintFor(slug, tier), origin: 'Your choice' }
  }
  const presets = MODEL_CHOICE_TIERS.flatMap(tier => {
    const slug = presetModel(catalogue, group, tier.id)
    return slug ? [{ value: tier.id, label: `${tier.label} — ${titleOf(catalogue, slug)} · ${hintFor(slug, tier.id)}` }] : []
  })
  const models = offered.map(slug => ({ value: `model:${slug}`, label: [titleOf(catalogue, slug), providerNameOf(catalogue, slug), catalogue.costHints[slug] ?? null, suggested.has(slug) ? MODEL_CHOICE_SUGGESTED : null].filter(Boolean).join(' · ') }))
  return {
    task, kind: 'live', isChoice, resolve,
    options: { recommended: { value: P2_DEFAULT_CHOICE, label: `Recommended — ${MODEL_CHOICE_DEFAULT_NAME}` }, presets, models, voices: [] },
    compareIds: task === 'voice_narration' ? [] : offered,
    info: id => {
      const model = catalogue.models[id]
      return offered.includes(id) ? { name: titleOf(catalogue, id), contextWindow: model?.contextWindow ?? null, imageOutput: Boolean(model?.imageOutput), tools: Boolean(model?.tools) } : null
    },
  }
}

/** Today's built-in list for a text task. Its presets name no model: a saved preset is the router's tier, whose model the built-in list cannot know. */
function staticSource(catalog: StaticCatalog, task: P2TaskId): RowSource {
  const isChoice = (value: unknown): value is string => isP2Choice(catalog, task, value)
  const resolve = (value: string): ChoiceResolved => {
    const valid = isChoice(value) ? value : P2_DEFAULT_CHOICE
    if (valid === P2_DEFAULT_CHOICE) return DEFAULT_RESOLVED
    if (isPreset(valid)) return { name: modelChoiceTier(valid).label, provider: null, modelId: null, tier: valid, hint: modelChoiceTier(valid).hint, origin: 'Your choice' }
    const resolved = p2Resolve(catalog, task, valid)
    return { name: resolved.name, provider: resolved.provider, modelId: resolved.modelId, tier: null, hint: null, origin: 'Your choice' }
  }
  const options = p2Options(catalog, task)
  const presets = options.presets.map(option => { const tier = modelChoiceTier(option.value as PresetId); return { value: option.value, label: `${tier.label} · ${tier.hint}` } })
  return {
    task, kind: 'static', isChoice, resolve,
    options: { recommended: { value: P2_DEFAULT_CHOICE, label: `Recommended — ${MODEL_CHOICE_DEFAULT_NAME}` }, presets, models: options.models, voices: [] },
    compareIds: [...catalog.tasks[task].models],
    info: id => {
      const model = catalog.models[id]
      return model && catalog.tasks[task].models.includes(id) ? { name: model.name, contextWindow: model.contextWindow ?? null, imageOutput: Boolean(model.imageOutput), tools: Boolean(model.tools) } : null
    },
  }
}
/** Where a task's options come from: fixed when it cannot be chosen in v1, else its live user-visible group when there is one, else today's static list. */
export function rowSource(task: P2TaskId, live: ChoiceCatalogue | null, catalog: StaticCatalog): RowSource {
  if (!MODEL_CHOICE_CHOOSABLE_GROUPS.includes(MODEL_CHOICE_GROUP_FOR_TASK[task])) return fixedSource(task)
  const group = choiceGroup(live, task)
  return live && group ? liveSource(live, group, task) : staticSource(catalog, task)
}
export function rowSources(live: ChoiceCatalogue | null, catalog: StaticCatalog): Record<P2TaskId, RowSource> {
  return Object.fromEntries(P2_TASKS.map(task => [task.id, rowSource(task.id, live, catalog)])) as Record<P2TaskId, RowSource>
}
/** The text tasks that keep today's static list although a catalogue was loaded (their group is missing or not user-visible). */
export const staticTasks = (sources: Record<P2TaskId, RowSource>, live: ChoiceCatalogue | null) => (live ? P2_TASKS.filter(task => sources[task.id].kind === 'static').map(task => task.id) : [])

// ---------------------------------------------------------------------------------------------------------------- choices, scopes

export type ModelChoices = Record<P2TaskId, string>
export const modelChoiceDefaults = (): ModelChoices => ({ planning_strategy: P2_DEFAULT_CHOICE, content_writing: P2_DEFAULT_CHOICE, research_analysis: P2_DEFAULT_CHOICE, imagery: P2_DEFAULT_CHOICE, voice_narration: P2_DEFAULT_CHOICE })
/** Each choice the row offers stays; anything else reads as the recommendation. `deck`: the choices are this presentation's, where the deck's own Auto ("auto") is a choice on every row that can be chosen. */
export function effectiveChoices(choices: ModelChoices, sources: Record<P2TaskId, RowSource>, deck = false): ModelChoices {
  const out = modelChoiceDefaults()
  for (const task of P2_TASKS) {
    if (deck && choices[task.id] === MODEL_CHOICE_AUTO && sources[task.id].kind !== 'fixed') out[task.id] = MODEL_CHOICE_AUTO
    else if (sources[task.id].isChoice(choices[task.id])) out[task.id] = choices[task.id]
  }
  return out
}
export const changedCount = (choices: ModelChoices) => P2_TASKS.filter(task => choices[task.id] !== P2_DEFAULT_CHOICE).length
/** The choosable tasks whose kept choice is not one the row offers now (another catalogue, a model no longer certified): they follow the recommendation, and the person is told so. */
export const droppedChoices = (choices: ModelChoices, sources: Record<P2TaskId, RowSource>) => P2_TASKS.filter(task => sources[task.id].kind !== 'fixed' && choices[task.id] !== P2_DEFAULT_CHOICE && choices[task.id] !== MODEL_CHOICE_AUTO && !sources[task.id].isChoice(choices[task.id])).map(task => task.id)

/** "Reusable defaults" (the person, every deck) or "This presentation" (this Studio session: its id is the deck key, as ROUTER-2 confirmed). */
export type ModelChoiceScope = { kind: 'user' } | { kind: 'deck'; deckId: string }
export const USER_SCOPE: ModelChoiceScope = { kind: 'user' }
const PLAIN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/
/** The query parameter that carries the deck key: the Builder's own session id. The one place to change if the deck key ever becomes the presentation id. */
export const MODEL_CHOICE_DECK_PARAM = 'session_id'
/** The deck the page was opened from (`?session_id=`), or null: none, "new", or not a plain id. */
export function deckIdFromSearch(search: string): string | null {
  let id: string | null = null
  try { id = new URLSearchParams(search).get(MODEL_CHOICE_DECK_PARAM) } catch { return null }
  return id && id !== 'new' && PLAIN_ID.test(id) ? id : null
}

/** In "This presentation", a task with no choice of its own follows the reusable default (precedence: this presentation > reusable default > the task's own model). */
export function resolveInScope(source: RowSource, scope: ModelChoiceScope, choice: string, userChoice: string): ChoiceResolved {
  if (scope.kind === 'deck' && choice === MODEL_CHOICE_AUTO && source.kind !== 'fixed') return { name: MODEL_CHOICE_AUTO_NAME, provider: null, modelId: null, tier: null, hint: null, origin: 'Deckster chooses' }
  if (scope.kind === 'deck' && source.kind !== 'fixed' && !(source.isChoice(choice) && choice !== P2_DEFAULT_CHOICE) && source.isChoice(userChoice) && userChoice !== P2_DEFAULT_CHOICE) return { ...source.resolve(userChoice), origin: 'Reusable default' }
  return source.resolve(choice)
}
/** The select's first option: the recommendation, or in "This presentation" "Use my default: <the default>" (the group left out; "Auto" when the default is Auto). */
export function defaultOption(source: RowSource, scope: ModelChoiceScope, userChoice: string) {
  if (scope.kind === 'deck') return { value: P2_DEFAULT_CHOICE, label: `${MODEL_CHOICE_USE_DEFAULT}: ${source.isChoice(userChoice) && userChoice !== P2_DEFAULT_CHOICE ? source.resolve(userChoice).name : MODEL_CHOICE_AUTO_NAME}` }
  return source.options.recommended
}
/** In "This presentation" only: the deck's own Auto, a second row beside "Use my default". Null on "Reusable defaults" and for a task that cannot be chosen. */
export function deckAutoOption(source: RowSource, scope: ModelChoiceScope) {
  return scope.kind === 'deck' && source.kind !== 'fixed' ? { value: MODEL_CHOICE_AUTO, label: MODEL_CHOICE_AUTO_LABEL } : null
}
export const originLine = (resolved: ChoiceResolved) => [resolved.provider, resolved.tier ? `${modelChoiceTier(resolved.tier).label} ${resolved.hint ?? modelChoiceTier(resolved.tier).hint}` : null, resolved.origin === 'Fixed' ? 'Not open for choice yet' : resolved.origin].filter(Boolean).join(' · ')

// ---------------------------------------------------------------------------------------------------------------- the wire form (what the Studio routes take and give)

const MODEL_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199}$/
export type WireChoice = { preset: PresetId } | { model: string } | { auto: true } | null
/** The choices of the choosable groups as the Studio PATCH body: a tier as { preset }, a model as { model }, the recommendation as null ("use my defaults" / clear). On "This presentation" ('deck') the deck's
 * own Auto is { auto: true }; "Reusable defaults" have none, so an "auto" there is sent as null and never as auto. */
export function toWire(choices: ModelChoices, kind: 'user' | 'deck' = 'user'): { preferences: Record<string, WireChoice> } {
  const preferences: Record<string, WireChoice> = {}
  for (const group of MODEL_CHOICE_CHOOSABLE_GROUPS) {
    const value = choices[group as P2TaskId]
    preferences[group] = isPreset(value) ? { preset: value } : value.startsWith('model:') && MODEL_SHAPE.test(value.slice(6)) ? { model: value.slice(6) } : value === MODEL_CHOICE_AUTO && kind === 'deck' ? { auto: true } : null
  }
  return { preferences }
}
/** A Studio route's answer as choices: only the choosable groups, a preset as its tier, a model as model:<id>, and on "This presentation" ('deck') an { auto: true } row as "auto". */
export function fromWire(body: unknown, kind: 'user' | 'deck' = 'user'): ModelChoices {
  const out = modelChoiceDefaults()
  const preferences = isRecord(body) && isRecord(body.preferences) ? body.preferences : {}
  for (const group of MODEL_CHOICE_CHOOSABLE_GROUPS) {
    const row = preferences[group]
    if (!isRecord(row)) continue
    if (typeof row.preset === 'string' && isPreset(row.preset)) out[group as P2TaskId] = row.preset
    else if (typeof row.model === 'string' && MODEL_SHAPE.test(row.model)) out[group as P2TaskId] = `model:${row.model}`
    else if (kind === 'deck' && row.auto === true) out[group as P2TaskId] = MODEL_CHOICE_AUTO
  }
  return out
}
// ---------------------------------------------------------------------------------------------------------------- keeping choices: the adapter

export const MODEL_CHOICE_STORAGE_PREFIX = 'deckster-studio-model-choice-v1'
export const modelChoiceKey = (scope: ModelChoiceScope) => (scope.kind === 'user' ? `${MODEL_CHOICE_STORAGE_PREFIX}:user` : `${MODEL_CHOICE_STORAGE_PREFIX}:deck:${scope.deckId}`)
/** The Pass 2 picker's key (lib/studio-intelligence-p2.ts p2StorageKey): read once for the reusable defaults when this picker has kept nothing yet, and never written or removed. */
export const LEGACY_P2_PREFIX = 'deckster-studio-intelligence-p2-v1:'

const CHOICE_SHAPE = /^(default|auto|quick|economy|balanced|best|max|model:[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199})$/
const shapeOk = (value: unknown): value is string => typeof value === 'string' && CHOICE_SHAPE.test(value)

/** The kept form: only the choices that differ from the recommendation, with the scope they belong to. Whether a choice is offered is decided when it is shown, against the catalogue of the day. */
export function serializeChoices(scope: ModelChoiceScope, choices: ModelChoices): string {
  const kept: Record<string, string> = {}
  for (const task of P2_TASKS) if (shapeOk(choices[task.id]) && choices[task.id] !== P2_DEFAULT_CHOICE) kept[task.id] = choices[task.id]
  return JSON.stringify(scope.kind === 'user' ? { v: 1, scope: 'user', choices: kept } : { v: 1, scope: 'deck', deck: scope.deckId, choices: kept })
}
/** The kept choices for `scope`, or null: nothing kept, another format, another scope or deck. A value of the wrong shape reads as the recommendation. */
export function parseChoices(scope: ModelChoiceScope, raw: string | null): ModelChoices | null {
  if (!raw) return null
  let saved: unknown
  try { saved = JSON.parse(raw) } catch { return null }
  if (!isRecord(saved) || saved.v !== 1 || saved.scope !== scope.kind || (scope.kind === 'deck' && saved.deck !== scope.deckId) || !isRecord(saved.choices)) return null
  const stored = saved.choices
  const out = modelChoiceDefaults()
  for (const task of P2_TASKS) if (Object.prototype.hasOwnProperty.call(stored, task.id) && shapeOk(stored[task.id]) && !(scope.kind === 'user' && stored[task.id] === MODEL_CHOICE_AUTO)) out[task.id] = stored[task.id] as string
  return out
}
/** The Pass 2 picker's kept choices as this picker's: presets and models carry over, a voice becomes its model (the catalogue lists no voices), anything else is the recommendation. Null when nothing differs. */
export function migrateLegacyP2(raw: string | null): ModelChoices | null {
  if (!raw) return null
  let saved: unknown
  try { saved = JSON.parse(raw) } catch { return null }
  if (!isRecord(saved) || saved.v !== 1 || !isRecord(saved.choices)) return null
  const stored = saved.choices
  const out = modelChoiceDefaults()
  for (const task of P2_TASKS) {
    const value = Object.prototype.hasOwnProperty.call(stored, task.id) ? stored[task.id] : undefined
    if (typeof value !== 'string') continue
    const carried = value.startsWith('voice:') ? (task.id === 'voice_narration' && value.includes('::') ? `model:${value.slice(6, value.indexOf('::'))}` : null) : value
    if (carried && shapeOk(carried)) out[task.id] = carried
  }
  return changedCount(out) ? out : null
}

/** Where a scope's choices are kept now: the account (the router, through Studio's routes) or this device; and why the device, when it is. */
export type SaveMode = 'account' | 'device'
export type DeviceReason = 'not-configured' | 'unreachable' | null
export interface ModelChoiceLoad {
  choices: ModelChoices
  restored: boolean
  mode: SaveMode
  reason: DeviceReason
  /** This presentation's scope is not available: the router has no deck scope yet (R3), or the session is not saved yet. */
  deckUnavailable?: 'not-available' | 'not-saved'
}
export interface ModelChoiceSave { mode: SaveMode; reason: DeviceReason; conflict?: ModelChoices; refused?: boolean; /** The router's code for a refusal, when the route passed it on (invalid_preference_auto: Auto was refused). */ refusedCode?: string | null; deckUnavailable?: 'not-available' | 'not-saved' }
/** The adapter every caller goes through. */
export interface ModelChoiceStore {
  loadChoices(scope: ModelChoiceScope): Promise<ModelChoiceLoad>
  saveChoices(scope: ModelChoiceScope, choices: ModelChoices): Promise<ModelChoiceSave>
}

export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** This browser. A storage access that throws rejects the call (the caller keeps the choices for the session only). The reusable defaults, when this picker has kept none, are copied once from the
 * Pass 2 key (`legacyKey`) to the new key; the Pass 2 key itself is never written or removed, so the Pass 2 picker keeps its own. */
export function createDeviceChoiceStore(deps: { storage: () => StorageLike; legacyKey?: string | null }): ModelChoiceStore {
  return {
    async loadChoices(scope) {
      const storage = deps.storage()
      const kept = parseChoices(scope, storage.getItem(modelChoiceKey(scope)))
      if (kept) return { choices: kept, restored: changedCount(kept) > 0, mode: 'device', reason: null }
      if (scope.kind === 'user' && deps.legacyKey && deps.legacyKey.startsWith(LEGACY_P2_PREFIX) && storage.getItem(modelChoiceKey(scope)) === null) {
        const legacy = migrateLegacyP2(storage.getItem(deps.legacyKey))
        if (legacy) {
          storage.setItem(modelChoiceKey(scope), serializeChoices(scope, legacy))
          return { choices: legacy, restored: true, mode: 'device', reason: null }
        }
      }
      return { choices: modelChoiceDefaults(), restored: false, mode: 'device', reason: null }
    },
    async saveChoices(scope, choices) {
      deps.storage().setItem(modelChoiceKey(scope), serializeChoices(scope, choices))
      return { mode: 'device', reason: null }
    },
  }
}

/** The Studio routes (never the router). */
export const MODEL_CHOICE_PREFS_ENDPOINT = '/api/model-choice/prefs'
export const modelChoicePrefsUrl = (scope: ModelChoiceScope) => (scope.kind === 'user' ? MODEL_CHOICE_PREFS_ENDPOINT : `${MODEL_CHOICE_PREFS_ENDPOINT}/deck/${encodeURIComponent(scope.deckId)}`)
export const modelChoiceUsedUrl = (buildId: string) => `/api/model-choice/used/${encodeURIComponent(buildId)}`
/** NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION (exact "true", default off; build-time). On, the read's version travels in its own request header, X-Prefs-Version, never in If-Match: Vercel's edge applies If-Match to the function's RESPONSE and swaps in its own 412 error page (E2E-2 capture, 28 Oct 02:15-02:17Z). */ // MODEL-CHOICE-PREFS-VERSION
export const PREFS_VERSION_ON = process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE_PREFS_VERSION === 'true' // MODEL-CHOICE-PREFS-VERSION
export const PREFS_VERSION_HEADER = 'X-Prefs-Version' // MODEL-CHOICE-PREFS-VERSION
/** The request with the version in its own header: a PATCH's If-Match becomes X-Prefs-Version (the same tag, as the read gave it); any other request is as it was. */ // MODEL-CHOICE-PREFS-VERSION
export const versionRequest = <T extends { headers?: Record<string, string> }>(init: T): T => { const tag = init.headers?.['If-Match']; if (tag === undefined) return init; const { 'If-Match': _ifMatch, ...rest } = init.headers as Record<string, string>; return { ...init, headers: { ...rest, [PREFS_VERSION_HEADER]: tag } } } // MODEL-CHOICE-PREFS-VERSION
export type RouteFetch = (url: string, init: { method: 'GET' | 'PATCH'; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; body: unknown; etag: string | null }>
/** Thrown by the account store when the choices must stay on this device (the caller switches to it). */
export class DeviceFallback extends Error { constructor(readonly reason: 'not-configured' | 'unreachable') { super(reason) } }
const codeOf = (body: unknown) => (isRecord(body) && typeof body.code === 'string' ? body.code : null)
/** This presentation's scope cannot be used: the router has no deck scope yet (404 deck_scope_not_available, R3), or this session cannot take choices of its own (not saved yet, or not the signed-in user's). */
const deckState = (status: number, body: unknown): 'not-available' | 'not-saved' | null => (status === 404 && codeOf(body) === 'deck_scope_not_available' ? 'not-available' : (status === 404 && codeOf(body) === 'session_not_found') || (status === 403 && codeOf(body) === 'forbidden') ? 'not-saved' : null)
const deviceReason = (status: number, body: unknown) => new DeviceFallback(status === 503 && codeOf(body) === 'router_not_configured' ? 'not-configured' : 'unreachable')

/** The account: Studio's routes, with the router's ETag kept per scope and sent as If-Match, so a write never overwrites a change made elsewhere (412: the saved choices come back). */
export function createAccountChoiceStore(deps: { fetchJson: RouteFetch }): ModelChoiceStore {
  const tags = new Map<string, string>()
  const keyOf = (scope: ModelChoiceScope) => modelChoiceKey(scope)
  return {
    async loadChoices(scope) {
      const answer = await deps.fetchJson(modelChoicePrefsUrl(scope), { method: 'GET' })
      if (answer.status === 200) {
        if (answer.etag) tags.set(keyOf(scope), answer.etag); else tags.delete(keyOf(scope))
        const choices = fromWire(answer.body, scope.kind)
        return { choices, restored: changedCount(choices) > 0, mode: 'account', reason: null }
      }
      const deck = scope.kind === 'deck' ? deckState(answer.status, answer.body) : null
      if (deck) return { choices: modelChoiceDefaults(), restored: false, mode: 'account', reason: null, deckUnavailable: deck }
      throw deviceReason(answer.status, answer.body)
    },
    async saveChoices(scope, choices) {
      const tag = tags.get(keyOf(scope))
      const answer = await deps.fetchJson(modelChoicePrefsUrl(scope), { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(tag ? { 'If-Match': tag } : {}) }, body: JSON.stringify(toWire(choices, scope.kind)) })
      if (answer.etag) tags.set(keyOf(scope), answer.etag)
      if (answer.status === 200) return { mode: 'account', reason: null }
      if (PREFS_VERSION_ON && (answer.status === 412 || answer.status === 409) && codeOf(answer.body) !== 'preferences_modified') { // MODEL-CHOICE-PREFS-VERSION: a 412 that is not Studio's own JSON (an edge's error page, no body) says nothing about the choices: read them again
        const fresh = await deps.fetchJson(modelChoicePrefsUrl(scope), { method: 'GET' }) // MODEL-CHOICE-PREFS-VERSION
        if (fresh.status !== 200) return { mode: 'account', reason: null, refused: true, refusedCode: 'save_unconfirmed' } // MODEL-CHOICE-PREFS-VERSION
        if (fresh.etag) tags.set(keyOf(scope), fresh.etag); else tags.delete(keyOf(scope)) // MODEL-CHOICE-PREFS-VERSION
        const stored = fromWire(fresh.body, scope.kind) // MODEL-CHOICE-PREFS-VERSION
        if (serializeChoices(scope, stored) === serializeChoices(scope, choices)) return { mode: 'account', reason: null } // MODEL-CHOICE-PREFS-VERSION: the read shows what was asked for, so the save had landed
        const unconfirmed = { mode: 'account' as const, reason: null, conflict: stored, unconfirmed: true } // MODEL-CHOICE-PREFS-VERSION: not saved, and nothing says anyone else changed it: the stored choice is shown, with the refusal words
        return unconfirmed // MODEL-CHOICE-PREFS-VERSION
      } // MODEL-CHOICE-PREFS-VERSION
      if (answer.status === 412 || answer.status === 409) {
        const fresh = await deps.fetchJson(modelChoicePrefsUrl(scope), { method: 'GET' })
        if (fresh.status === 200) { if (fresh.etag) tags.set(keyOf(scope), fresh.etag); return { mode: 'account', reason: null, conflict: fromWire(fresh.body, scope.kind) } }
        return { mode: 'account', reason: null, conflict: fromWire(answer.body, scope.kind) }
      }
      if (answer.status === 422 || answer.status === 400) return { mode: 'account', reason: null, refused: true, refusedCode: codeOf(answer.body) }
      const deck = scope.kind === 'deck' ? deckState(answer.status, answer.body) : null
      if (deck) return { mode: 'account', reason: null, deckUnavailable: deck }
      throw deviceReason(answer.status, answer.body)
    },
  }
}

/** The store the page uses: the account first; once it answers "not configured" or cannot be reached, this device for the rest of the visit (and the page says why). */
export function createModelChoiceStore(deps: { account: ModelChoiceStore; device: ModelChoiceStore }): ModelChoiceStore & { mode(): SaveMode | 'pending'; reason(): DeviceReason } {
  let mode: SaveMode | 'pending' = 'pending'
  let reason: DeviceReason = null
  const toDevice = (error: unknown) => {
    mode = 'device'
    reason = error instanceof DeviceFallback ? error.reason : 'unreachable'
  }
  return {
    mode: () => mode,
    reason: () => reason,
    async loadChoices(scope) {
      if (mode !== 'device') {
        try { const loaded = await deps.account.loadChoices(scope); mode = 'account'; return loaded } catch (error) { toDevice(error) }
      }
      return { ...(await deps.device.loadChoices(scope)), reason }
    },
    async saveChoices(scope, choices) {
      if (mode === 'account') {
        try { return await deps.account.saveChoices(scope, choices) } catch (error) { toDevice(error) }
      }
      return { ...(await deps.device.saveChoices(scope, choices)), reason }
    },
  }
}

export function choiceFeedback(taskLabel: string, resolved: ChoiceResolved, choice: string, mode: SaveMode | 'session', scope: ModelChoiceScope) {
  const forWhat = scope.kind === 'deck' ? ' for this presentation' : ''
  if (choice === MODEL_CHOICE_AUTO) return mode === 'account' ? `${taskLabel}: Auto, Deckster chooses, saved${forWhat}. Applies from the next build.` : `${taskLabel}: Auto, Deckster chooses, kept ${mode === 'session' ? 'for this session' : 'on this device'}${forWhat}.`
  if (choice === P2_DEFAULT_CHOICE) return resolved.origin === 'Reusable default' ? `${taskLabel} follows your reusable default, ${resolved.name}.` : `${taskLabel} follows the recommendation${forWhat}.`
  if (mode === 'account') return `${taskLabel}: ${resolved.name} saved${forWhat}. Applies from the next build.`
  return `${taskLabel}: ${resolved.name} kept ${mode === 'session' ? 'for this session' : 'on this device'}${forWhat}.`
}

// ---------------------------------------------------------------------------------------------------------------- "Used for this deck"

/** The build whose models are shown: the narrator's build_id (bld_<hex12>; Director uses it as the router trace id). Taken from a build_phase frame, else a sync_response's build_state after a reload;
 * anything that is not a plain id is no build. */
export function buildIdFromFrame(frame: unknown): string | null {
  if (!isRecord(frame)) return null
  const payload = isRecord(frame.payload) ? frame.payload : frame
  const type = frame.type
  const id = type === 'build_phase' ? payload.build_id : type === 'sync_response' && isRecord(payload.build_state) ? payload.build_state.build_id : undefined
  return typeof id === 'string' && PLAIN_ID.test(id) ? id : null
}
export const buildIdFromSearch = (search: string) => { let id: string | null = null; try { id = new URLSearchParams(search).get('build_id') } catch { return null } return id && PLAIN_ID.test(id) ? id : null }

/** The reason field of a timeline row (the router's R4 stores it; until then rows carry none). */
export const USED_REASON_FIELD = 'resolution'
const NEEDS_WORDS: Record<string, string> = { image_output: 'images', imageOutput: 'images', images: 'images', tools: 'tools', json_schema: 'structured output', structured_output: 'structured output', vision: 'vision' }
/** One timeline row in the doc's words (P3-10 doc, section 4). A fallback (depth 1 or more) on the person's own pick reads "Your pick failed"; anything without a reason is "Fixed for this step". */
export function usedReasonCopy(row: { resolution?: string | null; fallback_depth?: number; needs?: string[] }, model: string): string {
  const reason = row.resolution ?? null
  const mine = reason === 'user_model' || reason === 'user_preset' || reason === 'deck_model' || reason === 'deck_preset'
  if (mine && (row.fallback_depth ?? 0) >= 1) return `Your pick failed; used backup ${model}`
  if (reason === 'user_model' || reason === 'user_preset') return `Your default: ${model}`
  if (reason === 'deck_model' || reason === 'deck_preset') return `This presentation: ${model}`
  if (reason === 'deck_auto') return `This presentation: Auto (Deckster's choice): ${model}`
  if (reason === 'capability_fallback') {
    const needs = [...new Set((row.needs ?? []).map(need => NEEDS_WORDS[need]).filter(Boolean))]
    return `Used ${model}: your pick can't do this step${needs.length ? ` (needs ${needs.join(' / ')})` : ''}`
  }
  if (reason === 'choice_not_certified') return `Your pick isn't available right now; used ${model}`
  if (reason === 'choice_not_allowed') return `This step uses tested models only; used ${model}`
  return `Fixed for this step: ${model}`
}
export interface ModelsUsedRow { key: string; label: string; copy: string }
/** "Used for this deck": the rows of the Studio route (already only the person's own), one per step (service and task) and model, in the doc's words; a row of a system group or embeddings is not
 * listed. Nothing at all when there is no data: an empty-state contract. */
export function modelsUsedRows(data: unknown, live: ChoiceCatalogue | null): ModelsUsedRow[] {
  const items = isRecord(data) && Array.isArray(data.rows) ? data.rows : Array.isArray(data) ? data : null
  if (!items) return []
  const rows: ModelsUsedRow[] = []
  const seen = new Set<string>()
  for (const entry of items) {
    if (!isRecord(entry) || typeof entry.group !== 'string' || typeof entry.model !== 'string' || !entry.group || !entry.model) continue
    if (MODEL_CHOICE_NEVER_GROUPS.includes(entry.group)) continue
    const group = live?.groups.find(candidate => candidate.key === entry.group)
    if (live && group && !group.visible) continue
    const label = group?.label ?? P2_TASKS.find(task => task.id === entry.group)?.label
    if (!label) continue
    const model = live ? titleOf(live, entry.model) : entry.model
    const copy = usedReasonCopy({ resolution: typeof entry[USED_REASON_FIELD] === 'string' ? (entry[USED_REASON_FIELD] as string) : null, fallback_depth: typeof entry.fallback_depth === 'number' ? entry.fallback_depth : 0, needs: Array.isArray(entry.needs) ? (entry.needs as string[]) : [] }, model)
    const key = `${entry.group}|${typeof entry.task === 'string' ? entry.task : ''}|${copy}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ key, label, copy })
  }
  return rows
}

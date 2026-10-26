// FRONTEND-2 P3-10 MODEL CHOICE, the compact picker for the chat composer (flag NEXT_PUBLIC_STUDIO_MODEL_CHOICE, exact "true", default off). Everything the picker decides, with no request made here and no React:
// what a choice is, how it reads from and writes to the router's three text groups, which options the menu offers, what the chip says, and the two notes the menu carries. The requests, the ETags, the
// 503 / 404 fallbacks and the device copy are the adapter's (lib/studio-model-choice.ts); nothing of that is repeated here.
//
// A choice is { tier: 'economy' | 'balanced' | 'best' } | { model: '<id>' } | null, and null is "Auto" (Deckster chooses). It applies to the three text groups together (planning_strategy, content_writing,
// research_analysis); imagery and narration stay "Fixed for now" and are never written. Tiers show as Fast / Balanced / Best (the wire value of Fast is "economy"). A specific model is offered only when it is
// certified (selectable) in all three groups; a tier only when the model it names is certified in each live group (a group the catalogue does not open keeps the router's own tier, as the Intelligence page does).
// With no catalogue (not loaded, not switched on, not reachable) the tiers are offered and no specific model is.

import { P2_DEFAULT_CHOICE, type P2PresetId, type P2TaskId } from '@/lib/studio-intelligence-p2'
import { modelTitle, providerLabel, providerOf } from '@/lib/studio-model-catalog'
import {
  MODEL_CHOICE_CHOOSABLE_GROUPS, MODEL_CHOICE_DECK_PARAM, MODEL_CHOICE_TIERS, choiceGroup, deckIdFromSearch, modelChoiceDefaults, offeredModels, presetModel,
  type ChoiceCatalogue, type DeviceReason, type ModelChoices, type SaveMode,
} from '@/lib/studio-model-choice'

export const STUDIO_MODEL_PICKER_FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE'

// ---------------------------------------------------------------------------------------------------------------- what a choice is

export type PickerTier = P2PresetId
export type ModelChoice = { tier: PickerTier } | { model: string } | null
/** What the three text groups say together: Auto, one tier, one model, or (set apart, on the Intelligence page) different things. */
export type PickerState = { kind: 'auto' } | { kind: 'tier'; tier: PickerTier } | { kind: 'model'; model: string } | { kind: 'mixed' }
export const PICKER_AUTO: PickerState = { kind: 'auto' }
const MIXED: PickerState = { kind: 'mixed' }

/** The three groups a choice is written to, as task ids (the router's group ids are the task ids). */
export const PICKER_GROUPS = MODEL_CHOICE_CHOOSABLE_GROUPS as readonly P2TaskId[]
/** The tiers in the order the menu lists them (cheapest first). */
export const PICKER_TIERS: readonly PickerTier[] = ['economy', 'balanced', 'best']
const isTier = (value: string): value is PickerTier => (PICKER_TIERS as readonly string[]).includes(value)
const tierMeta = (tier: PickerTier) => MODEL_CHOICE_TIERS.find(entry => entry.id === tier) as { id: PickerTier; label: string; hint: string }
export const tierLabel = (tier: PickerTier) => tierMeta(tier).label

/** The kept form of one choice (what lib/studio-model-choice.ts stores per task): "default", a tier, or "model:<id>". */
export const choiceValue = (choice: ModelChoice): string => (choice === null ? P2_DEFAULT_CHOICE : 'tier' in choice ? choice.tier : `model:${choice.model}`)

export function pickerStateOf(choices: ModelChoices): PickerState {
  const first = choices[PICKER_GROUPS[0]]
  if (PICKER_GROUPS.some(group => choices[group] !== first)) return MIXED
  if (isTier(first)) return { kind: 'tier', tier: first }
  if (first.startsWith('model:')) return { kind: 'model', model: first.slice(6) }
  return PICKER_AUTO
}
/** The choice a state stands for, or undefined for "mixed" (it is not one choice, so nothing is reported for it). */
export function choiceOfState(state: PickerState): ModelChoice | undefined {
  return state.kind === 'auto' ? null : state.kind === 'tier' ? { tier: state.tier } : state.kind === 'model' ? { model: state.model } : undefined
}

/** `choices` with the three text groups set to `choice`. Imagery and narration are left as they are. */
export function applyChoice(choices: ModelChoices, choice: ModelChoice): ModelChoices {
  const out = { ...choices }
  for (const group of PICKER_GROUPS) out[group] = choiceValue(choice)
  return out
}
/** In a presentation, a text group with no choice of its own follows the reusable default (this presentation, then the default, then the task's own model). */
export function mergeChoices(user: ModelChoices, deck: ModelChoices | null): ModelChoices {
  const out = { ...modelChoiceDefaults() }
  for (const group of PICKER_GROUPS) out[group] = deck && deck[group] !== P2_DEFAULT_CHOICE ? deck[group] : user[group]
  return out
}

// ---------------------------------------------------------------------------------------------------------------- what the catalogue opens

/** The tier is offered when each live group certifies the model it names; a group the catalogue does not open (or no catalogue) leaves the router's own tier, which names no model. */
export function tierOffered(catalogue: ChoiceCatalogue | null, tier: PickerTier): boolean {
  if (!catalogue) return true
  return PICKER_GROUPS.every(task => { const group = choiceGroup(catalogue, task); return group === null || presetModel(catalogue, group, tier) !== null })
}
/** The models certified in all three text groups, by name. None unless every one of the three groups is open in the catalogue. */
export function commonModels(catalogue: ChoiceCatalogue | null): string[] {
  if (!catalogue) return []
  const lists: string[][] = []
  for (const task of PICKER_GROUPS) {
    const group = choiceGroup(catalogue, task)
    if (!group) return []
    lists.push(offeredModels(catalogue, group))
  }
  const [first, ...rest] = lists
  return first.filter(slug => rest.every(list => list.includes(slug))).sort((a, b) => modelName(catalogue, a).localeCompare(modelName(catalogue, b)))
}
/** The tier's cost hint: the models' own cost_hint when the three groups' models agree on one, else the tier's. */
export function tierHint(catalogue: ChoiceCatalogue | null, tier: PickerTier): string {
  if (!catalogue) return tierMeta(tier).hint
  const hints = PICKER_GROUPS.map(task => { const group = choiceGroup(catalogue, task); const slug = group ? presetModel(catalogue, group, tier) : null; return slug ? catalogue.costHints[slug] ?? null : null })
  return hints[0] !== null && hints.every(hint => hint === hints[0]) ? (hints[0] as string) : tierMeta(tier).hint
}
export const modelHint = (catalogue: ChoiceCatalogue | null, slug: string): string | null => catalogue?.costHints[slug] ?? null
export const modelName = (catalogue: ChoiceCatalogue | null, slug: string): string => modelTitle(slug, catalogue?.models[slug])
const providerName = (catalogue: ChoiceCatalogue | null, slug: string): string | null => { const vendor = providerOf(slug, catalogue?.models[slug]); return vendor ? providerLabel(vendor) : null }

/** Whether the picker may write `choice` now: Auto always, a tier the catalogue opens, a model certified in all three groups (never a model with no catalogue to check it against). */
export function offerable(catalogue: ChoiceCatalogue | null, choice: ModelChoice): boolean {
  if (choice === null) return true
  if ('tier' in choice) return isTier(choice.tier) && tierOffered(catalogue, choice.tier)
  return typeof choice.model === 'string' && commonModels(catalogue).includes(choice.model)
}
/** The state as shown: a kept tier or model the catalogue no longer opens follows the recommendation, as on the Intelligence page (it stays kept, so a catalogue that comes back offers it again). */
export function shownState(state: PickerState, catalogue: ChoiceCatalogue | null): PickerState {
  if (!catalogue) return state
  if (state.kind === 'tier') return tierOffered(catalogue, state.tier) ? state : PICKER_AUTO
  if (state.kind === 'model') return commonModels(catalogue).includes(state.model) ? state : PICKER_AUTO
  return state
}

// ---------------------------------------------------------------------------------------------------------------- words

export const PICKER_AUTO_LABEL = 'Auto'
export const PICKER_MIXED_LABEL = 'Custom'
export const PICKER_MORE_LABEL = 'More models…'
export const PICKER_BACK_LABEL = 'Back'
export const PICKER_AUTO_DETAIL = 'Deckster chooses'
export const PICKER_MENU_LABEL = 'Choose model'
export const PICKER_SCOPE_USER = 'Applies to new decks'
export const PICKER_SCOPE_DECK = 'Applies to this deck'
export const PICKER_SAVE_NOTE = {
  account: 'Saved to your account. Applies from the next build.',
  'not-configured': 'Saved on this device for now',
  unreachable: 'Your account could not be reached; saved on this device for now',
  'no-storage': 'This browser cannot keep it; it lasts until you leave',
} as const
/** A model's name on the chip: whole as far as PICKER_SHORT_MAX characters, else cut at the last word that fits (or mid-word when the first word alone is longer) with an ellipsis. The full name goes in the label and the title. */
export const PICKER_SHORT_MAX = 16
export function shortName(name: string): string {
  if (name.length <= PICKER_SHORT_MAX) return name
  const head = name.slice(0, PICKER_SHORT_MAX - 1)
  const space = name.charAt(head.length) === ' ' ? head.length : head.lastIndexOf(' ')
  return `${(space >= 4 ? head.slice(0, space) : head).trimEnd()}…`
}

export interface ChipLabel {
  /** What the chip shows: the tier only (Auto / Fast / Balanced / Best), a short model name, or Custom. */
  text: string
  /** What the accessible label and the title say. */
  full: string
}
export function chipLabel(state: PickerState, catalogue: ChoiceCatalogue | null): ChipLabel {
  if (state.kind === 'tier') { const label = tierLabel(state.tier); return { text: label, full: label } }
  if (state.kind === 'model') { const name = modelName(catalogue, state.model); return { text: shortName(name), full: name } }
  const label = state.kind === 'mixed' ? PICKER_MIXED_LABEL : PICKER_AUTO_LABEL
  return { text: label, full: state.kind === 'mixed' ? `${PICKER_MIXED_LABEL} (set per task on the Intelligence page)` : label }
}

/** The first line of the menu's footer: where a choice lands. */
export const scopeNote = (scope: 'deck' | 'user') => (scope === 'deck' ? PICKER_SCOPE_DECK : PICKER_SCOPE_USER)
/** The second line: where it is kept. Empty until the first answer is in. */
export function saveNote(mode: SaveMode | 'pending', reason: DeviceReason, storageOk: boolean): string {
  if (!storageOk) return PICKER_SAVE_NOTE['no-storage']
  if (mode === 'pending') return ''
  if (mode === 'account') return PICKER_SAVE_NOTE.account
  return reason === 'unreachable' ? PICKER_SAVE_NOTE.unreachable : PICKER_SAVE_NOTE['not-configured']
}

// ---------------------------------------------------------------------------------------------------------------- the menu

export interface PickerOption {
  /** auto | economy | balanced | best | model:<id> */
  id: string
  label: string
  detail: string | null
  /** $ / $$ / $$$, when there is one. */
  hint: string | null
  choice: ModelChoice
  selected: boolean
}
export interface PickerMenu {
  /** Auto, then the tiers the catalogue opens. */
  main: PickerOption[]
  /** "More models…": the certified models common to the three groups; null when there are none. */
  more: { label: string; detail: string | null; count: number } | null
  models: PickerOption[]
}
/** `inherited`: in a presentation with no choice of its own, the reusable default Auto follows (a state), so Auto says so. */
export function pickerMenu(args: { catalogue: ChoiceCatalogue | null; state: PickerState; inherited?: PickerState | null }): PickerMenu {
  const { catalogue, state } = args
  const inheritedLabel = args.inherited && args.inherited.kind !== 'auto' ? chipLabel(args.inherited, catalogue).full : null
  const main: PickerOption[] = [{ id: 'auto', label: PICKER_AUTO_LABEL, detail: inheritedLabel ? `Your default: ${inheritedLabel}` : PICKER_AUTO_DETAIL, hint: null, choice: null, selected: state.kind === 'auto' }]
  for (const tier of PICKER_TIERS) {
    if (tierOffered(catalogue, tier)) main.push({ id: tier, label: tierLabel(tier), detail: null, hint: tierHint(catalogue, tier), choice: { tier }, selected: state.kind === 'tier' && state.tier === tier })
  }
  const common = commonModels(catalogue)
  const models: PickerOption[] = common.map(slug => ({
    id: `model:${slug}`, label: modelName(catalogue, slug), detail: providerName(catalogue, slug), hint: modelHint(catalogue, slug), choice: { model: slug }, selected: state.kind === 'model' && state.model === slug,
  }))
  const more = common.length > 0 ? { label: PICKER_MORE_LABEL, detail: state.kind === 'model' ? modelName(catalogue, state.model) : null, count: common.length } : null
  return { main, more, models }
}

/** The deck key for a Studio session id: the plain id, or null for none, "new" and anything that is not a plain id (the adapter's own rule, lib/studio-model-choice.ts deckIdFromSearch). */
export const deckIdFromSessionId = (sessionId: string | null | undefined): string | null => (sessionId ? deckIdFromSearch(`?${MODEL_CHOICE_DECK_PARAM}=${encodeURIComponent(sessionId)}`) : null)

// FRONTEND-2 P3-10 MODEL CHOICE, the SLIDER variant of the composer picker (flag NEXT_PUBLIC_STUDIO_MODEL_CHOICE, exact "true", default off; stacked on #521). PK wants the composer's model picker as a slider: a
// gauge icon opens a popover with a slider over ORDERED STOPS, quicker and cheaper on the left, deeper and dearer on the right. Everything it decides, with no request made here and no React: the stops, where the
// choice sits on them, what the trigger says, what "Advanced" holds. What a stop SAVES is the compact picker's: the same choices (lib/studio-model-picker.ts), the same adapter and routes, three text groups together.
//
// Stops: the catalogue's presets in cost order, Fast, Balanced, Best today, plus any extra preset the catalogue lists, five at most (FRONTEND-1, 26 Oct: Auto is NOT on the scale). A stop is offered only when its
// preset can be saved (SLIDER_SAVABLE_PRESETS: the router's enum as the Studio routes carry it, best / balanced / economy today) and the model it names is certified in every open text group. Auto lives in "Advanced":
// on the reusable default it clears the choice (null), on a deck it is the deck's own Auto ({ auto: true }); SLIDER_AUTO_STOP = true would put it back as the first stop. The thumb says what is chosen: a filled
// thumb on the stop that is chosen; NO thumb while nothing is chosen (Auto); a HOLLOW thumb on the default's stop while a deck follows the reusable default; a faint dashed one off the scale for a specific
// model ("Custom").

import { MODEL_CHOICE_AUTO_LABEL, choiceGroup, offeredModels, type ChoiceCatalogue } from '@/lib/studio-model-choice'
import {
  PICKER_AUTO_LABEL, PICKER_GROUPS, PICKER_MIXED_LABEL, PICKER_TIERS, modelName, pickerMenu, tierHint, tierLabel, tierOffered,
  type DeckOwn, type ModelChoice, type PickerOption, type PickerState, type PickerTier,
} from '@/lib/studio-model-picker'

/** THE one switch for whether Auto is a stop on the slider: false (FRONTEND-1's pick, 26 Oct) leaves it to Advanced, a row on both scopes; true puts it first on the scale. */
export const SLIDER_AUTO_STOP = false
export const SLIDER_MAX_STOPS = 5
export const SLIDER_CAPTION = 'Low = quicker, lower cost · High = deeper thinking, higher cost'
export const SLIDER_ADVANCED_LABEL = 'Advanced'
export const SLIDER_MODELS_LABEL = 'Specific models'
export const SLIDER_LABEL = 'Model'
export const SLIDER_CUSTOM_LABEL = 'Custom'
/** The presets a stop may write, in the order of their cost: what the Studio routes carry (lib/studio-model-choice-server.ts PRESETS). A preset the router adds is one more entry here and there, not before. */
export const SLIDER_SAVABLE_PRESETS: readonly string[] = PICKER_TIERS

export interface PickerStop {
  /** auto | economy | balanced | best | <an extra preset's id> */
  id: string
  label: string
  /** $ / $$ / $$$, when there is one. */
  hint: string | null
  /** The stop is Auto (Deckster chooses). */
  auto: boolean
  /** The preset a stop writes; null for Auto. */
  tier: PickerTier | null
}

const BASE_RANK: Record<string, number> = { economy: 1, balanced: 2, best: 3 }
const AUTO_STOP: PickerStop = { id: 'auto', label: PICKER_AUTO_LABEL, hint: null, auto: true, tier: null }
const isBaseTier = (id: string): id is PickerTier => (PICKER_TIERS as readonly string[]).includes(id)
const capitalised = (id: string) => id.split('_').filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
const stopLabel = (id: string) => (isBaseTier(id) ? tierLabel(id) : capitalised(id))

/** The extra presets (ids other than the three tiers) any open text group lists. */
function extraPresetIds(catalogue: ChoiceCatalogue | null): string[] {
  if (!catalogue) return []
  const ids = new Set<string>()
  for (const task of PICKER_GROUPS) {
    const group = choiceGroup(catalogue, task)
    for (const id of Object.keys(group ? catalogue.allPresets[group.key] ?? {} : {})) if (!isBaseTier(id)) ids.add(id)
  }
  return [...ids].sort()
}
/** The model an extra preset names in each open group, or null when one group does not certify it (it is then not a stop). */
function extraSlugs(catalogue: ChoiceCatalogue, id: string): string[] | null {
  const slugs: string[] = []
  for (const task of PICKER_GROUPS) {
    const group = choiceGroup(catalogue, task)
    if (!group) continue
    const slug = catalogue.allPresets[group.key]?.[id]
    if (!slug || !offeredModels(catalogue, group).includes(slug)) return null
    slugs.push(slug)
  }
  return slugs
}
/** An extra preset's cost hint: the models' own when every group's model has the same one. */
function extraHint(catalogue: ChoiceCatalogue, slugs: string[]): string | null {
  const hints = slugs.map(slug => catalogue.costHints[slug] ?? null)
  return hints.length > 0 && hints[0] !== null && hints.every(hint => hint === hints[0]) ? hints[0] : null
}

/** The slider's stops, left to right: Auto first only when SLIDER_AUTO_STOP, then Fast, Balanced, Best and any extra preset the catalogue lists, by cost (the three tiers first at their own level; an extra by its cost hint, one
 * with none last), five at most. With no catalogue (not loaded, not reachable) the three tiers are stops, as the compact picker offers them. `options.presets` and `options.auto` are for a proof or a mock. */
export function MODEL_PICKER_STOPS(catalogue: ChoiceCatalogue | null, options: { auto?: boolean; presets?: readonly string[] } = {}): PickerStop[] {
  const savable = options.presets ?? SLIDER_SAVABLE_PRESETS
  const ranked: { stop: PickerStop; rank: number; order: number }[] = []
  let order = 0
  for (const id of [...PICKER_TIERS, ...extraPresetIds(catalogue)]) {
    if (!savable.includes(id)) continue
    if (isBaseTier(id)) {
      if (tierOffered(catalogue, id)) ranked.push({ stop: { id, label: stopLabel(id), hint: tierHint(catalogue, id), auto: false, tier: id }, rank: BASE_RANK[id], order: order++ })
    } else if (catalogue) {
      const slugs = extraSlugs(catalogue, id)
      if (!slugs) continue
      const hint = extraHint(catalogue, slugs)
      ranked.push({ stop: { id, label: stopLabel(id), hint, auto: false, tier: id as PickerTier }, rank: hint ? hint.length : 4, order: order++ })
    }
  }
  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order)
  const stops = ranked.map(entry => entry.stop)
  return ((options.auto ?? SLIDER_AUTO_STOP) ? [AUTO_STOP, ...stops] : stops).slice(0, SLIDER_MAX_STOPS)
}
/** The stops with no catalogue: the list FRONTEND-1's mock can render as it stands. */
export const MODEL_PICKER_DEFAULT_STOPS: readonly PickerStop[] = MODEL_PICKER_STOPS(null)

/** What a stop writes on `scope`: Auto is null on the reusable default and the deck's own Auto on a deck; a tier is its preset. */
export const stopChoice = (stop: PickerStop, scope: 'deck' | 'user'): ModelChoice => (stop.auto ? (scope === 'deck' ? { auto: true } : null) : { tier: stop.tier as PickerTier })

/** The index of the stop `state` sits on, or -1: off the scale (a specific model, a mix, Auto when Auto is no stop). */
export function stopIndex(stops: readonly PickerStop[], state: PickerState): number {
  if (state.kind === 'auto') return stops.findIndex(stop => stop.auto)
  if (state.kind === 'tier') return stops.findIndex(stop => stop.tier === state.tier)
  return -1
}

/** What the thumb shows: "selected" (a filled thumb on the stop that is chosen), "hollow" (a deck that follows the reusable default: a hollow thumb on the default's stop), "none" (nothing chosen, Auto: no thumb) and
 * "custom" (a specific model or a mix: off the scale, a faint dashed thumb). */
export type ThumbKind = 'selected' | 'hollow' | 'none' | 'custom'
export interface SliderView {
  stops: PickerStop[]
  /** The thumb's stop, or -1 when it is on none (Auto with no Auto stop, Custom). */
  index: number
  thumb: ThumbKind
  /** The current choice in words for the trigger's label and the title ("Balanced", "Auto", "Custom (Kimi K3)"). */
  label: string
  /** What the screen reader says for the thumb ("Balanced, cost 2 of 3"). */
  valueText: string
}
const costWords = (hint: string | null) => (hint ? `, cost ${hint.length} of 3` : '')
/** `own`: on a deck, what its own groups hold; "default" is a deck that follows the reusable default (its thumb is hollow). */
export function sliderView(args: { catalogue: ChoiceCatalogue | null; state: PickerState; stops?: PickerStop[]; own?: DeckOwn | null }): SliderView {
  const stops = args.stops ?? MODEL_PICKER_STOPS(args.catalogue)
  const { state } = args
  const index = stopIndex(stops, state)
  if (index >= 0) {
    const stop = stops[index]
    const following = args.own === 'default'
    const base = stop.auto ? `${stop.label}, Deckster chooses` : `${stop.label}${costWords(stop.hint)}`
    return { stops, index, thumb: following ? 'hollow' : 'selected', label: stop.label, valueText: following ? `${base}, your default` : base }
  }
  if (state.kind === 'auto') return { stops, index, thumb: 'none', label: PICKER_AUTO_LABEL, valueText: `${PICKER_AUTO_LABEL}, Deckster chooses` }
  const label = state.kind === 'model' ? `${SLIDER_CUSTOM_LABEL} (${modelName(args.catalogue, state.model)})` : state.kind === 'mixed' ? `${SLIDER_CUSTOM_LABEL} (set per task on the Intelligence page)` : PICKER_MIXED_LABEL
  return { stops, index, thumb: 'custom', label, valueText: `${SLIDER_CUSTOM_LABEL}, off the scale` }
}

export interface SliderAdvanced {
  /** "Auto: Deckster chooses" (null on the reusable default, { auto: true } on a deck) and, on a deck, "Use my default: <it>"; with SLIDER_AUTO_STOP true the reusable default has no row for Auto (it is a stop). */
  rows: PickerOption[]
  /** The certified models common to the three text groups. */
  models: PickerOption[]
}
/** "Advanced": the rows the stops cannot say, and the specific models. */
export function sliderAdvanced(args: { catalogue: ChoiceCatalogue | null; state: PickerState; scope: 'deck' | 'user'; own?: DeckOwn | null; userState?: PickerState | null; autoStop?: boolean }): SliderAdvanced {
  const menu = pickerMenu({ catalogue: args.catalogue, state: args.state, scope: args.scope, own: args.own, userState: args.userState })
  const head = menu.main.filter(option => option.id === 'auto' || option.id === 'default').map(option => (option.id === 'auto' ? { ...option, label: MODEL_CHOICE_AUTO_LABEL, detail: null } : option))
  const rows = args.scope === 'deck' ? head : (args.autoStop ?? SLIDER_AUTO_STOP) ? [] : head
  return { rows, models: menu.models }
}

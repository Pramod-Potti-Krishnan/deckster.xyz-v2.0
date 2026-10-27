// FRONTEND-2 P3-10 MODEL CHOICE, the SLIDER variant of the composer picker (flag NEXT_PUBLIC_STUDIO_MODEL_CHOICE, exact "true", default off; stacked on #521). PK wants the composer's model picker as a slider: a
// gauge icon opens a popover with a slider over ORDERED STOPS, quicker and cheaper on the left, deeper and dearer on the right. Everything it decides, with no request made here and no React: the stops, where the
// choice sits on them, what the trigger says, what "Advanced" holds. What a stop SAVES is the compact picker's: the same choices (lib/studio-model-picker.ts), the same adapter and routes, three text groups together.
//
// Stops (PK, 26 Oct: five): the router's presets in the order the catalogue gives them (its top-level preset_order; else Quick, Fast, Balanced, Best, Max), each with the one-line hint the catalogue sends
// (preset_hints), five at most. A stop is offered when its preset can be saved (SLIDER_SAVABLE_PRESETS, the list the Studio routes accept) and the model it names is certified in every open text group; two stops
// may name the SAME model (research_analysis: Best and Max are both Opus 5.5) and both show. Auto is NOT on the scale (FRONTEND-1, 26 Oct): it lives in "Advanced": on the reusable default it clears the
// choice (null), on a deck it is the deck's own Auto ({ auto: true }); SLIDER_AUTO_STOP = true would put it back as the first stop. The thumb says what is chosen: a filled thumb on the stop that is chosen;
// NO thumb while nothing is chosen (Auto); a HOLLOW thumb on the default's stop while a deck follows the reusable default; a faint dashed one off the scale for a specific model ("Custom").

import { MODEL_CHOICE_AUTO_LABEL, MODEL_CHOICE_PRESET_IDS, type ChoiceCatalogue } from '@/lib/studio-model-choice'
import {
  PICKER_AUTO_LABEL, PICKER_MIXED_LABEL, modelName, orderedPresets, pickerMenu, presetHint, tierHint, tierLabel, tierOffered,
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
/** The presets a stop may write: what the Studio routes accept (lib/studio-model-choice-server.ts PRESETS reads the same list, MODEL_CHOICE_PRESET_IDS: quick, economy, balanced, best, max). */
export const SLIDER_SAVABLE_PRESETS: readonly string[] = MODEL_CHOICE_PRESET_IDS

export interface PickerStop {
  /** auto | quick | economy | balanced | best | max */
  id: string
  label: string
  /** $ / $$ / $$$, when there is one. */
  hint: string | null
  /** The catalogue's one-line hint for the preset (its preset_hints), or null: the sub-line of the stop. */
  sub: string | null
  /** The stop is Auto (Deckster chooses). */
  auto: boolean
  /** The preset a stop writes; null for Auto. */
  tier: PickerTier | null
}

const AUTO_STOP: PickerStop = { id: 'auto', label: PICKER_AUTO_LABEL, hint: null, sub: null, auto: true, tier: null }

/** The slider's stops, left to right: Auto first only when SLIDER_AUTO_STOP, then the presets in the catalogue's preset_order (else Quick, Fast, Balanced, Best, Max), five at most. A preset every open text group
 * certifies is a stop, however many stops name the same model; with no catalogue (not loaded, not reachable) the five are stops. `options.presets` and `options.auto` are for a proof or a mock. */
export function MODEL_PICKER_STOPS(catalogue: ChoiceCatalogue | null, options: { auto?: boolean; presets?: readonly string[] } = {}): PickerStop[] {
  const savable = options.presets ?? SLIDER_SAVABLE_PRESETS
  const stops: PickerStop[] = orderedPresets(catalogue)
    .filter(id => savable.includes(id) && tierOffered(catalogue, id))
    .map(id => ({ id, label: tierLabel(id), hint: tierHint(catalogue, id), sub: presetHint(catalogue, id), auto: false, tier: id as PickerTier }))
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
    const base = stop.auto ? `${stop.label}, Deckster chooses` : `${stop.label}${costWords(stop.hint)}${stop.sub ? `. ${stop.sub}` : ''}`
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

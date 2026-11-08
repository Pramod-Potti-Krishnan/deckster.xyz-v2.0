// FRONTEND-1 (F-14, the simplified Studio model picker; PK's final of 4 Nov). Flag NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE (exact "true", build-time, default off), and only where the picker itself is on (NEXT_PUBLIC_STUDIO_MODEL_CHOICE):
// the composer's slider picker (<ModelPicker variant="slider">) opens a calmer popover, and on a phone a bottom sheet, with the same content. Everything it decides, with no request made here and no React: the four stops,
// what the title says, the model line and the per-step list under it, the reset. What a stop SAVES is the slider's and the compact picker's, unchanged: the PRESET (a tier), never a model, for the three text
// groups together (lib/studio-model-slider.ts stopChoice, lib/studio-model-picker.ts, the same adapter and routes).
//
// PK's seven points: (1) the stops keep the names Fast / Balanced / Best / Max over the router's economy / balanced / best / max; Quick stays out. (2) The title is the current preset's name; under it the router-resolved WRITING
// model, read from the catalogue (none is hardcoded here), with a chevron that opens the per-step list (read-only) and "Choose a specific model...", which opens Advanced. (3) One slider, its bar a little thicker than the slider's; PK's
// small relative-cost marker ($ ... $$$$$) was tried beside each stop's name and DROPPED: Fast, Balanced, Best and Max with their markers do not fit one line in the 272 px popover (they run into each other and pull the stops out of line with the thumb). (4) A reset icon top right: it clears the choice ("Use my default" on a deck, Auto on the reusable default). (5) None of the slider's extra
// text: no legend, no hint line, no "Applies to ..." / "Saved ..." footer, nothing written under Advanced. (6) "Advanced" is a plain collapsed row; open, it holds the slider's own rows unchanged (Auto, Use my default, Specific models).
// (7) On a phone the same content is a bottom sheet.

import { p2TaskLabel, type P2TaskId } from '@/lib/studio-intelligence-p2'
import { MODEL_CHOICE_USE_DEFAULT, choiceGroup, presetModel, type ChoiceCatalogue } from '@/lib/studio-model-choice'
import {
  PICKER_AUTO_DETAIL, PICKER_AUTO_LABEL, modelName, orderedPresets, presetHint, tierHint, tierLabel, tierOffered, type DeckOwn, type PickerState, type PickerTier,
} from '@/lib/studio-model-picker'
import { sliderView, type PickerStop, type ThumbKind } from '@/lib/studio-model-slider'

export const STUDIO_MODEL_PICKER_SIMPLE_FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE'
/** The flag's reading: only the exact string "true". */
export const modelPickerSimpleFlagOn = (value: string | undefined | null) => value === 'true'
/** NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE (exact "true", default off; build-time). The picker is drawn only where NEXT_PUBLIC_STUDIO_MODEL_CHOICE is on as well (ModelPicker renders nothing without it). */
export const STUDIO_MODEL_PICKER_SIMPLE_ENABLED = modelPickerSimpleFlagOn(process.env.NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE)

/** The stops, as the router's preset ids, quickest and cheapest first: Fast, Balanced, Best, Max. Quick (the router's fifth preset) is not one of them, whatever the catalogue says. */
export const SIMPLE_STOP_IDS: readonly PickerTier[] = ['economy', 'balanced', 'best', 'max']
/** The model line's lead-in: the step whose model it names. */
export const SIMPLE_LINE_STEP: P2TaskId = 'content_writing'
export const SIMPLE_LINE_LEAD = 'Writing'
/** The three text steps a preset (and a specific model) is written to, in the order the list shows them. */
export const SIMPLE_STEPS: readonly P2TaskId[] = ['planning_strategy', 'content_writing', 'research_analysis']
export const SIMPLE_LIST_ACTION = 'Choose a specific model…'
export const SIMPLE_LIST_HEADING = 'Resolved by the router for'
export const SIMPLE_ADVANCED_LABEL = 'Advanced'
export const SIMPLE_MIXED_LINE = 'Set per task on the Intelligence page'
export const SIMPLE_CUSTOM_LABEL = 'Custom'
export const SIMPLE_RESET_USER = 'Reset to Auto'
export const SIMPLE_MENU_LABEL = 'Choose model'
/** The width (px) at or below which the picker is a bottom sheet: the phone shell's own query (max-width: 640px). */
export const SIMPLE_SHEET_QUERY = '(max-width: 640px)'

/** The slider's stops for the simple picker: the catalogue's preset order (else the Studio order), only Fast, Balanced, Best and Max, and only those the catalogue opens (the model each names is certified in every open text group). */
export function simpleStops(catalogue: ChoiceCatalogue | null): PickerStop[] {
  return orderedPresets(catalogue)
    .filter(id => SIMPLE_STOP_IDS.includes(id) && tierOffered(catalogue, id))
    .map(id => ({ id, label: tierLabel(id), hint: tierHint(catalogue, id), sub: presetHint(catalogue, id), auto: false, tier: id }))
}

export interface SimpleModelLine {
  /** "Writing" for a preset; null when the line names no single step. */
  lead: string | null
  name: string
}
export interface SimpleStepRow { id: P2TaskId; label: string; model: string }
export interface SimpleList {
  /** The small heading over the rows ("Resolved by the router for Best"); null where there is none. */
  heading: string | null
  rows: SimpleStepRow[]
}
export interface SimpleView {
  stops: PickerStop[]
  /** The thumb's stop, or -1 when it is on none. */
  index: number
  thumb: ThumbKind
  /** The title: the current preset's name (Fast, Balanced, Best, Max), Auto, or Custom. */
  title: string
  /** What the screen reader says for the thumb. */
  valueText: string
  /** The line under the title; null while there is nothing to read (no catalogue). */
  line: SimpleModelLine | null
  /** The read-only list the line's chevron opens; null where there is no chevron. */
  list: SimpleList | null
  /** The reset icon: its name, and whether there is anything to clear. */
  resetLabel: string
  resetEnabled: boolean
}

const stepRows = (catalogue: ChoiceCatalogue, pick: (task: P2TaskId) => string | null): SimpleStepRow[] =>
  SIMPLE_STEPS.flatMap(id => { const slug = pick(id); return slug ? [{ id, label: p2TaskLabel(id), model: modelName(catalogue, slug) }] : [] })
/** The model a preset names for a step, from the catalogue; null when the catalogue holds none or the step's group is not open. */
export function presetStepModel(catalogue: ChoiceCatalogue | null, tier: PickerTier, task: P2TaskId): string | null {
  if (!catalogue) return null
  const group = choiceGroup(catalogue, task)
  return group ? presetModel(catalogue, group, tier) : null
}

/** Everything the popover shows for `state`. `own` is what a deck's own groups hold; `userState` the reusable default (only its absence matters here). `stops` are handed in so a caller can reuse them. */
export function simpleView(args: { catalogue: ChoiceCatalogue | null; state: PickerState; scope: 'deck' | 'user'; own?: DeckOwn | null; stops?: PickerStop[] }): SimpleView {
  const { catalogue, state, scope } = args
  const stops = args.stops ?? simpleStops(catalogue)
  const base = sliderView({ catalogue, state, stops, own: args.own })
  const resetLabel = scope === 'deck' ? MODEL_CHOICE_USE_DEFAULT : SIMPLE_RESET_USER
  const resetEnabled = scope === 'deck' ? args.own !== 'default' : state.kind !== 'auto'
  const common = { stops, index: base.index, thumb: base.thumb, valueText: base.valueText, resetLabel, resetEnabled }
  if (state.kind === 'tier') {
    const writing = presetStepModel(catalogue, state.tier, SIMPLE_LINE_STEP)
    const title = base.index >= 0 ? stops[base.index].label : tierLabel(state.tier) // a preset off this scale (Quick, kept earlier) reads by its own name, on a faint thumb
    const rows = catalogue ? stepRows(catalogue, task => presetStepModel(catalogue, state.tier, task)) : []
    return { ...common, title, line: catalogue && writing ? { lead: SIMPLE_LINE_LEAD, name: modelName(catalogue, writing) } : null, list: rows.length > 0 ? { heading: `${SIMPLE_LIST_HEADING} ${title}`, rows } : null }
  }
  if (state.kind === 'model') {
    const name = modelName(catalogue, state.model)
    return { ...common, title: SIMPLE_CUSTOM_LABEL, line: { lead: null, name }, list: { heading: null, rows: SIMPLE_STEPS.map(id => ({ id, label: p2TaskLabel(id), model: name })) } }
  }
  if (state.kind === 'mixed') return { ...common, title: SIMPLE_CUSTOM_LABEL, line: { lead: null, name: SIMPLE_MIXED_LINE }, list: null }
  return { ...common, title: PICKER_AUTO_LABEL, line: { lead: null, name: PICKER_AUTO_DETAIL }, list: { heading: null, rows: [] } }
}

/** The view while the thumb is dragged to `tier` (nothing is saved yet): the title, the line and the spoken value follow the stop, built WITHOUT `own` (a dragged stop is not "your default"), and the reset stays exactly as the saved view has it. */
export function simpleDragView(args: { catalogue: ChoiceCatalogue | null; scope: 'deck' | 'user'; tier: PickerTier; saved: SimpleView; stops?: PickerStop[] }): SimpleView {
  const preview = simpleView({ catalogue: args.catalogue, state: { kind: 'tier', tier: args.tier }, scope: args.scope, stops: args.stops })
  return { ...preview, resetEnabled: args.saved.resetEnabled }
}

/** What the reset icon writes: null, which is "Use my default" on a deck and Auto on the reusable default. */
export const simpleResetChoice = null

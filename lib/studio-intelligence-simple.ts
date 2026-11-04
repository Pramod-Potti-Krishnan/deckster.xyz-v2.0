// FRONTEND-1 (UX-02, a blocker of the Studio UX pass: the Intelligence page was still five per-task dropdowns with raw model names; PK's model rule F-14 is Fast / Balanced / Best / Max, model names only under Advanced).
// Flag NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE (exact "true", build-time, default off). It acts only together with NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE (the composer's simple picker, whose logic this page reuses) and
// NEXT_PUBLIC_STUDIO_MODEL_CHOICE (the picker's own flag: without it nothing is read or saved). On, the Intelligence page's main control is ONE preset slider for the account default (the reusable default, the picker's
// "user" scope): the title is the preset's name, under it the model the router resolves for each text step (read-only, read from the catalogue), the slider, the picker's reset icon; the page's per-task dropdowns are
// moved, unchanged, under a collapsed "Advanced". Everything here is the composer picker's own logic (lib/studio-model-picker-simple.ts simpleStops / simpleView, lib/studio-model-slider.ts stopChoice), so the page and
// the picker always agree. A stop saves the PRESET only (ROUTER-1, 3 Nov 21:45Z: Studio saves the preset per text group and never hardcodes a model). No request is made here and there is no React.

import { simpleStops, simpleView, type SimpleStepRow, type SimpleView } from '@/lib/studio-model-picker-simple'
import type { ChoiceCatalogue } from '@/lib/studio-model-choice'
import type { ModelChoice, PickerState } from '@/lib/studio-model-picker'
import { stopChoice, type PickerStop } from '@/lib/studio-model-slider'

export const STUDIO_INTELLIGENCE_SIMPLE_FLAG = 'NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE'
/** One flag's reading: only the exact string "true". */
export const intelligenceSimpleFlagOn = (value: string | undefined | null) => value === 'true'
/** The page is the simple one only with all three: this flag, the simple picker's and the picker's own. */
export const intelligenceSimpleActive = (simple: string | undefined | null, pickerSimple: string | undefined | null, modelChoice: string | undefined | null) =>
  intelligenceSimpleFlagOn(simple) && intelligenceSimpleFlagOn(pickerSimple) && intelligenceSimpleFlagOn(modelChoice)
/** Build-time: each value is read as a literal so the build inlines it. */
export const STUDIO_INTELLIGENCE_SIMPLE_ENABLED = intelligenceSimpleActive(
  process.env.NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE, process.env.NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE, process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE,
)

export const INTELLIGENCE_SIMPLE_ADVANCED = 'Advanced'

export interface IntelligenceSimpleView extends SimpleView {
  /** The read-only per-step list under the title: the step and the model the router resolves for it; empty when there is nothing to list (Auto, a mix, no catalogue). */
  rows: SimpleStepRow[]
  /** One muted line in place of the list (Auto: "Deckster chooses"); null otherwise. */
  detail: string | null
}

/** What the page shows for `state` on the reusable default: the composer picker's simpleView (scope "user"), its list always open. */
export function intelligenceSimpleView(args: { catalogue: ChoiceCatalogue | null; state: PickerState; stops?: PickerStop[] }): IntelligenceSimpleView {
  const view = simpleView({ catalogue: args.catalogue, state: args.state, scope: 'user', stops: args.stops ?? simpleStops(args.catalogue) })
  const rows = view.list?.rows ?? []
  const detail = rows.length === 0 && args.state.kind === 'auto' && view.line ? view.line.name : null
  return { ...view, rows, detail }
}

/** What moving the thumb to stop `index` saves: the stop's PRESET (never a model), or null for nothing (no such stop, or the stop already chosen while no save is in flight, as in the composer picker). */
export function intelligenceStopSave(view: Pick<SimpleView, 'stops' | 'index' | 'thumb'>, index: number, busy = false): ModelChoice | null {
  const stop = view.stops[index]
  if (!stop) return null
  if (!busy && view.thumb === 'selected' && index === view.index) return null
  return stopChoice(stop, 'user')
}

/** What the reset icon saves: null, Auto on the reusable default (the picker's own reset). */
export const intelligenceResetChoice: ModelChoice = null

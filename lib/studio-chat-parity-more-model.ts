/**
 * FRONTEND-1, overnight chat parity (11 Nov), the REMAINING commands: the model rows of the "/" menu (/model fast, /model reset, /model <work> <model>).
 * Gated by NEXT_PUBLIC_STUDIO_CHAT_PARITY_COMMANDS (default off) on top of NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (which already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN): the model hook reads the flag where it registers. No backend, no Director change.
 *
 * The model gauge's own hook (components/model-choice/use-model-choice.ts useModelChoice) registers ONE getter of its latest state on lib/studio-chat-parity-more.ts's bus, in a gated effect, and this file turns that
 * state into what the rows read (the stops the gauge shows, the choices the Intelligence page offers per kind of work) and what a row calls (the SAME save the gauge's stop calls: select; the same store and checks as the
 * Intelligence page for a kind of work). Registering inside the hook (not one picker) puts every variant of the gauge on the bus, and a save made from chat lands in the same state the gauge draws.
 * Dynamically imported by that gated effect, so a build with the flag off never loads it (nor the two catalog snapshots).
 */
import { MODEL_PICKER_STOPS, sliderView, stopChoice, type PickerStop } from '@/lib/studio-model-slider'
import type { ModelChoice, PickerState, DeckOwn } from '@/lib/studio-model-picker'
import {
  MODEL_CHOICE_CONFLICT, MODEL_CHOICE_REFUSED, MODEL_CHOICE_REFUSED_AUTO, MODEL_CHOICE_SCOPE_DECK_NOT_SAVED, MODEL_CHOICE_SCOPE_DECK_UNAVAILABLE, effectiveChoices, modelChoiceDefaults, rowSources,
  type ChoiceCatalogue, type ModelChoiceSave, type ModelChoiceScope, type ModelChoices, type RowSource, type StaticCatalog,
} from '@/lib/studio-model-choice'
import { P2_TASKS } from '@/lib/studio-intelligence-p2'
import baseCatalog from '@/components/studio-personal/model-catalog-snapshot.json'
import refreshedCatalog from '@/components/studio-personal/model-catalog-snapshot-2026-10.json'
import type { MoreModelAnswer, MoreModelPart, MoreModelStop, MoreModelTask } from '@/lib/studio-chat-parity-more'

/** The built-in list the Intelligence page falls back to (the same two snapshots and the same flag it reads). */
export const STATIC_MODEL_CATALOG = (process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG_2026_10 === 'true' ? refreshedCatalog : baseCatalog) as unknown as StaticCatalog

const AUTO_STOP: PickerStop = { id: 'auto', label: 'Auto', hint: null, sub: null, auto: true, tier: null }
export const MODEL_SAVE_BUSY = 'A model choice is still saving. Try again in a moment.'
export const MODEL_SAVE_SESSION = 'Saved for this visit only: your browser would not keep it.'

/** What the composer's hook hands over: this render's state and the saves it can make. */
export interface ModelHookLive {
  ready: boolean
  scope: 'deck' | 'user'
  catalogue: ChoiceCatalogue | null
  /** What applies now, as the gauge shows it. */
  state: PickerState
  userState: PickerState
  /** In a deck: what its own groups hold; undefined on the reusable default. */
  deckOwn: DeckOwn | undefined
  /** The choices kept in this scope (this presentation's own, else the reusable default's), per kind of work. */
  choices: ModelChoices
  /** The gauge's save (useModelChoice select), resolved once it settled. */
  select: (choice: ModelChoice) => Promise<{ kind: 'saved' | 'conflict' | 'refused' | 'deck-unavailable' | 'ignored' }>
  /** The per-kind-of-work save (saveTaskChoice below, wired to the hook's own state). */
  selectTask: (task: string, value: string) => Promise<MoreModelAnswer>
}

/** The words for a save that did not simply succeed (the ones the gauge and the Intelligence page already say). */
export function outcomeWords(kind: 'saved' | 'conflict' | 'refused' | 'deck-unavailable' | 'ignored', scope: 'deck' | 'user', askedAuto: boolean): MoreModelAnswer {
  if (kind === 'saved') return { ok: true, words: '' }
  if (kind === 'conflict') return { ok: false, words: MODEL_CHOICE_CONFLICT }
  if (kind === 'refused') return { ok: false, words: askedAuto ? MODEL_CHOICE_REFUSED_AUTO : MODEL_CHOICE_REFUSED }
  if (kind === 'deck-unavailable') return { ok: false, words: scope === 'deck' ? MODEL_CHOICE_SCOPE_DECK_UNAVAILABLE : MODEL_CHOICE_SCOPE_DECK_NOT_SAVED }
  return { ok: false, words: MODEL_SAVE_BUSY }
}

const stopsOf = (live: ModelHookLive): PickerStop[] => {
  const stops = MODEL_PICKER_STOPS(live.catalogue)
  return stops.some(stop => stop.auto) ? stops : [AUTO_STOP, ...stops]
}

/** The gauge's current choice as a key. A deck that only FOLLOWS its default is "following:<key>", so choosing that very stop is still a choice of the deck's own (the gauge's hollow thumb). */
export function currentKey(live: ModelHookLive): { key: string; label: string } {
  const stops = MODEL_PICKER_STOPS(live.catalogue)
  const view = sliderView({ catalogue: live.catalogue, state: live.state, stops, own: live.deckOwn })
  const state = live.state
  const base = view.index >= 0 ? (stops[view.index].auto ? 'auto' : `tier:${stops[view.index].id}`)
    : state.kind === 'auto' ? 'auto' : state.kind === 'model' ? `model:${state.model}` : 'mixed'
  const following = live.scope === 'deck' && live.deckOwn === 'default'
  return { key: following ? `following:${base}` : base, label: view.label }
}

/** The state the rows read, built from the hook's live state. */
export function modelStateOf(live: ModelHookLive): NonNullable<MoreModelPart['state']> {
  const stops: MoreModelStop[] = stopsOf(live).map(stop => ({ id: stop.id, label: stop.label, hint: stop.hint, auto: stop.auto }))
  const sources: Record<string, RowSource> = rowSources(live.catalogue, STATIC_MODEL_CATALOG)
  const effective = effectiveChoices(live.choices, sources as never, live.scope === 'deck')
  const tasks: MoreModelTask[] = P2_TASKS.map(task => {
    const source = sources[task.id]
    const options = source.kind === 'fixed' ? [] : [
      ...source.options.presets.map(option => ({ value: option.value, label: option.label, preset: true })),
      ...source.options.models.map(option => ({ value: option.value, label: option.label, preset: false })),
    ]
    return { id: task.id, label: task.label, fixed: source.kind === 'fixed', choice: effective[task.id], options }
  })
  const current = currentKey(live)
  return {
    ready: live.ready, scope: live.scope, current: current.key, currentLabel: current.label, stops,
    resetNeeded: live.scope === 'deck' ? live.deckOwn !== 'default' : live.state.kind !== 'auto' || live.userState.kind !== 'auto',
    tasks,
  }
}

/** The part the bus holds: the state, and the three saves (the gauge's stop, the reset, a kind of work). */
export function modelPartOf(live: ModelHookLive): MoreModelPart {
  return {
    state: modelStateOf(live),
    actions: {
      chooseStop: async stopId => {
        const stop = stopsOf(live).find(item => item.id === stopId)
        if (!stop) return { ok: false, words: MODEL_SAVE_BUSY }
        const outcome = await live.select(stopChoice(stop, live.scope))
        return outcomeWords(outcome.kind, live.scope, stop.auto)
      },
      reset: async () => outcomeWords((await live.select(null)).kind, live.scope, false),
      chooseTask: (task, value) => live.selectTask(task, value),
    },
  }
}

// ---- the per-kind-of-work save: the Intelligence page's `choose` -> `keep`, on the hook's own state -------------------------------------------------------

/** The hook's own pieces the save needs (the same state the gauge's select writes). */
export interface TaskSaveDeps {
  now: () => {
    loaded: { user: ModelChoices; deck: ModelChoices | null; storageOk: boolean } | null
    scope: ModelChoiceScope
    catalogue: ChoiceCatalogue | null
    runtime: { store: { saveChoices(scope: ModelChoiceScope, choices: ModelChoices): Promise<ModelChoiceSave>; mode(): string; reason(): unknown } }
  }
  busy: { current: boolean }
  /** Put `choices` on screen at once for the scope (the gauge reads it). */
  put: (scope: ModelChoiceScope, choices: ModelChoices) => void
  /** The save went to this device only, or its storage threw: the choices last for the visit. */
  storageFailed: () => void
  /** A deck scope the router does not have: the page falls back to the reusable defaults. */
  deckGone: (why: 'not-available' | 'not-saved') => void
  meta: () => void
  saving: (value: boolean) => void
  feedback: (words: string) => void
  unconfirmed?: (result: ModelChoiceSave) => boolean
}

/** Save one kind of work's choice the way the Intelligence page does: the same checks (the row's own list), the same store, the same words when a save is refused. Never throws. */
export async function saveTaskChoice(deps: TaskSaveDeps, task: string, value: string): Promise<MoreModelAnswer> {
  const now = deps.now()
  if (!now.loaded || deps.busy.current) return { ok: false, words: MODEL_SAVE_BUSY }
  const sources = rowSources(now.catalogue, STATIC_MODEL_CATALOG) as Record<string, RowSource>
  const source = sources[task]
  if (!source || source.kind === 'fixed' || !source.isChoice(value)) return { ok: false, words: MODEL_CHOICE_REFUSED }
  deps.busy.current = true
  deps.saving(true)
  const target = now.scope
  const own = target.kind === 'deck' ? now.loaded.deck ?? modelChoiceDefaults() : now.loaded.user
  const next = { ...own, [task]: value } as ModelChoices
  deps.put(target, next)
  let words = ''
  let session = false
  try {
    let result: ModelChoiceSave | { mode: 'session' }
    if (!now.loaded.storageOk) result = { mode: 'session' }
    else {
      try { result = await now.runtime.store.saveChoices(target, next) } catch { deps.storageFailed(); result = { mode: 'session' } }
    }
    session = result.mode === 'session'
    deps.meta()
    if ('conflict' in result && result.conflict) {
      deps.put(target, result.conflict)
      words = deps.unconfirmed?.(result as ModelChoiceSave) ? MODEL_CHOICE_REFUSED : MODEL_CHOICE_CONFLICT
    } else if ('refused' in result && result.refused) {
      deps.put(target, own)
      words = MODEL_CHOICE_REFUSED
    } else if ('deckUnavailable' in result && result.deckUnavailable) {
      deps.deckGone(result.deckUnavailable)
      words = result.deckUnavailable === 'not-available' ? MODEL_CHOICE_SCOPE_DECK_UNAVAILABLE : MODEL_CHOICE_SCOPE_DECK_NOT_SAVED
    }
  } finally {
    deps.feedback(words)
    deps.busy.current = false
    deps.saving(false)
  }
  return words === '' && session ? { ok: true, words: MODEL_SAVE_SESSION } : { ok: words === '', words }
}

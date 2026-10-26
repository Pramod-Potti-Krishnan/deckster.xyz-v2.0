"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MODEL_CATALOG_ENDPOINT, classifyCatalogueResponse } from "@/lib/studio-model-catalog"
import {
  MODEL_CHOICE_CONFLICT, MODEL_CHOICE_REFUSED, MODEL_CHOICE_SCOPE_DECK_NOT_SAVED, MODEL_CHOICE_SCOPE_DECK_UNAVAILABLE, USER_SCOPE, createAccountChoiceStore, createDeviceChoiceStore, createModelChoiceStore, modelChoiceDefaults, withPresets,
  type ChoiceCatalogue, type DeviceReason, type ModelChoiceSave, type ModelChoiceScope, type ModelChoiceStore, type ModelChoices, type RouteFetch, type SaveMode,
} from "@/lib/studio-model-choice"
import {
  applyChoice, choiceOfState, deckIdFromSessionId, mergeChoices, offerable, pickerStateOf, saveNote, shownState, type ModelChoice, type PickerState,
} from "@/lib/studio-model-picker"

/** NEXT_PUBLIC_STUDIO_MODEL_CHOICE (exact "true", default off; build-time). The picker needs nothing else: it does not depend on the Intelligence page's flag. */
export const STUDIO_MODEL_PICKER_ENABLED = process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE === "true"
/** The Studio route /api/models/catalogue exists only with NEXT_PUBLIC_STUDIO_MODEL_CATALOG on; without it nothing is asked and only the tiers are offered. */
const CATALOGUE_ROUTE_ON = process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG === "true"

/** What the picker runs on: the adapter (the account first, this device when saving is not switched on or cannot be reached) and the catalogue. Tests hand in their own. */
export interface PickerRuntime {
  store: ModelChoiceStore & { mode(): SaveMode | "pending"; reason(): DeviceReason }
  loadCatalogue(): Promise<ChoiceCatalogue | null>
}

/** Studio's own routes only (same origin): the browser never calls Director or the router, and never sends a user id. */
const routeFetch: RouteFetch = async (url, init) => {
  const response = await fetch(url, { method: init.method, headers: init.headers, body: init.body, credentials: "same-origin", cache: "no-store" })
  let body: unknown = null
  try { body = await response.json() } catch { body = null }
  return { status: response.status, body, etag: response.headers.get("etag") }
}

async function fetchCatalogue(): Promise<ChoiceCatalogue | null> {
  if (!CATALOGUE_ROUTE_ON) return null
  try {
    const response = await fetch(MODEL_CATALOG_ENDPOINT, { credentials: "same-origin", cache: "no-store" })
    let body: unknown = null
    try { body = await response.json() } catch { body = null }
    const result = classifyCatalogueResponse(response.status, body)
    return result.kind === "ready" ? withPresets(result.catalogue, body) : null
  } catch { return null }
}
let cachedCatalogue: { value: ChoiceCatalogue; expires: number } | null = null
let pendingCatalogue: Promise<ChoiceCatalogue | null> | null = null
/** One read per page visit (and per the catalogue's own ttl): every picker on the page shares it. An answer that is not a catalogue is not kept. */
function loadCatalogueOnce(): Promise<ChoiceCatalogue | null> {
  if (cachedCatalogue && cachedCatalogue.expires > Date.now()) return Promise.resolve(cachedCatalogue.value)
  if (!pendingCatalogue) {
    pendingCatalogue = fetchCatalogue().then(value => { if (value) cachedCatalogue = { value, expires: Date.now() + value.ttlSeconds * 1000 }; return value }).finally(() => { pendingCatalogue = null })
  }
  return pendingCatalogue
}

let sharedRuntime: PickerRuntime | null = null
/** The browser's runtime: ONE store for every picker on the page, so the router's ETags and the "this device" decision are shared. The Pass 2 key is the Intelligence page's to carry over, not this picker's. */
export function browserRuntime(): PickerRuntime {
  if (!sharedRuntime) {
    sharedRuntime = {
      store: createModelChoiceStore({ account: createAccountChoiceStore({ fetchJson: routeFetch }), device: createDeviceChoiceStore({ storage: () => window.localStorage }) }),
      loadCatalogue: loadCatalogueOnce,
    }
  }
  return sharedRuntime
}

type DeckState = "none" | "ok" | "not-available" | "not-saved"
interface Loaded { user: ModelChoices; deck: ModelChoices | null; deckState: DeckState; storageOk: boolean }
type CatalogueState = { status: "loading" | "unavailable"; catalogue: null } | { status: "ready"; catalogue: ChoiceCatalogue }

export type SelectOutcome =
  | { kind: "saved"; choice: ModelChoice }
  | { kind: "conflict" }
  | { kind: "refused" }
  | { kind: "deck-unavailable" }
  | { kind: "ignored" }

export interface ModelChoiceApi {
  /** The kept choices are in (from the account, or this device). Until then nothing can be chosen. */
  ready: boolean
  /** Where a choice lands: this presentation, or the reusable defaults (no presentation yet, or its scope is not available). */
  scope: "deck" | "user"
  catalogue: ChoiceCatalogue | null
  catalogueStatus: "loading" | "ready" | "unavailable"
  /** What applies now, as shown (a kept choice the catalogue no longer opens reads as Auto). In a presentation with no choice of its own, the reusable default. */
  state: PickerState
  /** The reusable default alone (what Auto follows in a presentation). */
  userState: PickerState
  /** The choice that applies: null is Auto. Undefined while loading, and for a mix of per-task choices (set on the Intelligence page). */
  choice: ModelChoice | undefined
  saving: boolean
  mode: SaveMode | "pending"
  reason: DeviceReason
  /** False once this browser refused to keep anything: choices last for the visit only. */
  storageOk: boolean
  /** The words for the last save that did not simply succeed (a conflict, a refusal, a presentation scope that is not there); empty otherwise. */
  feedback: string
  /** Where it is kept, in words. */
  saveNote: string
  /** Writes `choice` to the three text groups (null clears them: Auto). Resolves once the save has settled. */
  select(choice: ModelChoice): Promise<SelectOutcome>
}

export interface UseModelChoiceOptions {
  /** Called after a save (or a conflict that changed what applies) with the choice now in force. Not called when nothing was saved, nor for a mix of per-task choices. */
  onChange?: (choice: ModelChoice) => void
  /** Tests only. */
  runtime?: PickerRuntime
}

/** The picker's state: the catalogue, the kept choice for `sessionId` (this presentation, falling back to the reusable default; with no session, the default), and `select`, which saves through the same
 * adapter and routes as the Intelligence page. Exported so a caller can build its own control on it. */
export function useModelChoice(sessionId: string | null, options: UseModelChoiceOptions = {}): ModelChoiceApi {
  const runtime = options.runtime ?? browserRuntime()
  const deckId = deckIdFromSessionId(sessionId)
  const [catalogueState, setCatalogueState] = useState<CatalogueState>({ status: "loading", catalogue: null })
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [meta, setMeta] = useState<{ mode: SaveMode | "pending"; reason: DeviceReason }>({ mode: "pending", reason: null })
  const [feedback, setFeedback] = useState("")
  const [saving, setSaving] = useState(false)

  // The catalogue, once per page visit. Anything but a catalogue this picker can read leaves the tiers only.
  useEffect(() => {
    let alive = true
    runtime.loadCatalogue().then(
      catalogue => { if (alive) setCatalogueState(catalogue ? { status: "ready", catalogue } : { status: "unavailable", catalogue: null }) },
      () => { if (alive) setCatalogueState({ status: "unavailable", catalogue: null }) },
    )
    return () => { alive = false }
  }, [runtime])

  // The kept choices: the reusable default, and this presentation's when there is one. A deck scope the router does not have (R3 404) or that is not the person's falls back to the default. A throwing
  // device storage keeps choices for this visit only.
  useEffect(() => {
    let alive = true
    setLoaded(null)
    setFeedback("")
    ;(async () => {
      let next: Loaded
      try {
        const user = await runtime.store.loadChoices(USER_SCOPE)
        let deck: ModelChoices | null = null
        let deckState: DeckState = "none"
        if (deckId) {
          const answer = await runtime.store.loadChoices({ kind: "deck", deckId })
          if (answer.deckUnavailable) deckState = answer.deckUnavailable
          else { deck = answer.choices; deckState = "ok" }
        }
        next = { user: user.choices, deck, deckState, storageOk: true }
      } catch {
        next = { user: modelChoiceDefaults(), deck: deckId ? modelChoiceDefaults() : null, deckState: deckId ? "ok" : "none", storageOk: false }
      }
      if (!alive) return
      setMeta({ mode: runtime.store.mode(), reason: runtime.store.reason() })
      setLoaded(next)
    })()
    return () => { alive = false }
  }, [runtime, deckId])

  const scope: ModelChoiceScope = deckId && loaded?.deckState === "ok" ? { kind: "deck", deckId } : USER_SCOPE
  const catalogue = catalogueState.catalogue
  const userChoices = loaded ? loaded.user : modelChoiceDefaults()
  const ownDeck = loaded && scope.kind === "deck" ? loaded.deck : null
  const state = shownState(pickerStateOf(mergeChoices(userChoices, ownDeck)), catalogue)
  const userState = shownState(pickerStateOf(userChoices), catalogue)

  const latest = useRef({ loaded, scope, catalogue, runtime, onChange: options.onChange })
  latest.current = { loaded, scope, catalogue, runtime, onChange: options.onChange }
  const busy = useRef(false)

  const select = useCallback(async (choice: ModelChoice): Promise<SelectOutcome> => {
    const now = latest.current
    if (!now.loaded || busy.current || !offerable(now.catalogue, choice)) return { kind: "ignored" }
    busy.current = true
    setSaving(true)
    const target = now.scope
    const own = target.kind === "deck" ? now.loaded.deck ?? modelChoiceDefaults() : now.loaded.user
    const next = applyChoice(own, choice)
    const put = (value: ModelChoices) => setLoaded(prior => (prior ? (target.kind === "deck" ? { ...prior, deck: value } : { ...prior, user: value }) : prior))
    put(next)
    let result: ModelChoiceSave | { mode: "session" }
    if (!now.loaded.storageOk) result = { mode: "session" }
    else {
      try { result = await now.runtime.store.saveChoices(target, next) } catch { setLoaded(prior => (prior ? { ...prior, storageOk: false } : prior)); result = { mode: "session" } }
    }
    setMeta({ mode: now.runtime.store.mode(), reason: now.runtime.store.reason() })
    let outcome: SelectOutcome
    let words = ""
    let reported: ModelChoice | undefined = choice
    if ("conflict" in result && result.conflict) {
      const saved = result.conflict
      put(saved)
      outcome = { kind: "conflict" }
      words = MODEL_CHOICE_CONFLICT
      reported = choiceOfState(pickerStateOf(mergeChoices(target.kind === "deck" ? now.loaded.user : saved, target.kind === "deck" ? saved : null)))
    } else if ("refused" in result && result.refused) {
      put(own)
      outcome = { kind: "refused" }
      words = MODEL_CHOICE_REFUSED
      reported = undefined
    } else if ("deckUnavailable" in result && result.deckUnavailable) {
      const why = result.deckUnavailable
      setLoaded(prior => (prior ? { ...prior, deckState: why, deck: null } : prior))
      outcome = { kind: "deck-unavailable" }
      words = why === "not-available" ? MODEL_CHOICE_SCOPE_DECK_UNAVAILABLE : MODEL_CHOICE_SCOPE_DECK_NOT_SAVED
      reported = undefined
    } else outcome = { kind: "saved", choice }
    setFeedback(words)
    busy.current = false
    setSaving(false)
    const notify = latest.current.onChange
    if (reported !== undefined && notify) notify(reported)
    return outcome
  }, [])

  return {
    ready: loaded !== null,
    scope: scope.kind,
    catalogue,
    catalogueStatus: catalogueState.status,
    state,
    userState,
    choice: loaded ? choiceOfState(state) : undefined,
    saving,
    mode: meta.mode,
    reason: meta.reason,
    storageOk: loaded ? loaded.storageOk : true,
    feedback,
    saveNote: saveNote(meta.mode, meta.reason, loaded ? loaded.storageOk : true),
    select,
  }
}

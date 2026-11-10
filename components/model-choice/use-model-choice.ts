"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MODEL_CATALOG_ENDPOINT, classifyCatalogueResponse } from "@/lib/studio-model-catalog"
import {
  MODEL_CHOICE_CONFLICT, MODEL_CHOICE_REFUSED, MODEL_CHOICE_REFUSED_AUTO, MODEL_CHOICE_SCOPE_DECK_NOT_SAVED, MODEL_CHOICE_SCOPE_DECK_UNAVAILABLE, USER_SCOPE, createAccountChoiceStore, createDeviceChoiceStore, createModelChoiceStore, modelChoiceDefaults, withPresets,
  type ChoiceCatalogue, type DeviceReason, type ModelChoiceSave, type ModelChoiceScope, type ModelChoiceStore, type ModelChoices, type RouteFetch, type SaveMode,
} from "@/lib/studio-model-choice"
import { PREFS_VERSION_ON, versionRequest } from "@/lib/studio-model-choice" // MODEL-CHOICE-PREFS-VERSION
import {
  applyChoice, choiceOfState, deckIdFromSessionId, deckOwnOf, mergeChoices, offerable, pickerStateOf, saveNote, shownState, type DeckOwn, type ModelChoice, type PickerState,
} from "@/lib/studio-model-picker"

/** NEXT_PUBLIC_STUDIO_MODEL_CHOICE (exact "true", default off; build-time). The picker needs nothing else: it does not depend on the Intelligence page's flag. */
export const STUDIO_MODEL_PICKER_ENABLED = process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE === "true"
/** NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE (exact "true", default off; build-time). On, the picker says "Saved to your account" only after a save the server confirmed; a save that failed says so in the words it already has. The server route reads the same flag (lib/studio-model-choice-server.ts). */ // MODEL-CHOICE-DECK-SAVE
const DECK_SAVE_ON = process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE === "true" // MODEL-CHOICE-DECK-SAVE
/** The Studio route /api/models/catalogue exists only with NEXT_PUBLIC_STUDIO_MODEL_CATALOG on; without it nothing is asked and only the tiers are offered. */
const CATALOGUE_ROUTE_ON = process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG === "true"

/** What the picker runs on: the adapter (the account first, this device when saving is not switched on or cannot be reached) and the catalogue. Tests hand in their own. */
export interface PickerRuntime {
  store: ModelChoiceStore & { mode(): SaveMode | "pending"; reason(): DeviceReason }
  loadCatalogue(): Promise<ChoiceCatalogue | null>
}

/** Studio's own routes only (same origin): the browser never calls Director or the router, and never sends a user id. */
const routeFetch: RouteFetch = async (url, init) => {
  if (PREFS_VERSION_ON) init = versionRequest(init) // MODEL-CHOICE-PREFS-VERSION: the read's version goes in X-Prefs-Version, not If-Match
  const response = await fetch(url, { method: init.method, headers: init.headers, body: init.body, credentials: "same-origin", cache: "no-store" })
  let body: unknown = null
  try { body = await response.json() } catch { body = null }
  if (PREFS_VERSION_ON) return { status: response.status, body, etag: response.headers.get("x-prefs-version") ?? response.headers.get("etag") } // MODEL-CHOICE-PREFS-VERSION: the version comes back in its own header (ETag stays on a read)
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
  /** The reusable default alone (what "Use my default" follows in a presentation). */
  userState: PickerState
  /** In a presentation: what its own groups hold (it follows the default, the deck's own Auto, a choice of its own, or a mix). Undefined on the reusable default. */
  deckOwn: DeckOwn | undefined
  /** The choice that applies: null is Auto (on a deck, null is "use my default", and the deck's own Auto is { auto: true }). Undefined while loading, and for a mix of per-task choices (set on the Intelligence page). */
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
  /** Writes `choice` to the three text groups (null clears them: Auto on the reusable default, "use my default" on a deck; { auto: true } is the deck's own Auto and is refused on the reusable default). Resolves once the save has settled. */
  select(choice: ModelChoice): Promise<SelectOutcome>
}

export interface UseModelChoiceOptions {
  /** Called after a save (or a conflict that changed what applies) with the choice now in force: { tier }, { model }, { auto: true } (a deck's own Auto) or null. Not called when nothing was saved, nor for a mix of per-task choices. */
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
  const [confirmed, setConfirmed] = useState(false) // MODEL-CHOICE-DECK-SAVE: the last save of this visit was confirmed by the account (a conflict, a refusal, a missing deck scope or a fall back to this device clears it)

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
    setConfirmed(false) // MODEL-CHOICE-DECK-SAVE
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
  const deckOwn = ownDeck ? deckOwnOf(ownDeck) : undefined

  const latest = useRef({ loaded, scope, catalogue, runtime, onChange: options.onChange })
  latest.current = { loaded, scope, catalogue, runtime, onChange: options.onChange }
  const busy = useRef(false)

  const select = useCallback(async (choice: ModelChoice): Promise<SelectOutcome> => {
    const now = latest.current
    if (!now.loaded || busy.current || !offerable(now.catalogue, choice, now.scope.kind)) return { kind: "ignored" }
    busy.current = true
    setSaving(true)
    const target = now.scope
    const own = target.kind === "deck" ? now.loaded.deck ?? modelChoiceDefaults() : now.loaded.user
    const next = applyChoice(own, choice)
    const askedAuto = choice !== null && "auto" in choice
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
      if (PREFS_VERSION_ON && (result as { unconfirmed?: boolean }).unconfirmed) words = MODEL_CHOICE_REFUSED // MODEL-CHOICE-PREFS-VERSION: a 412 that was not Studio's own JSON: the stored choice is shown, with the refusal words, not "changed elsewhere"
      reported = choiceOfState(pickerStateOf(mergeChoices(target.kind === "deck" ? now.loaded.user : saved, target.kind === "deck" ? saved : null)))
    } else if ("refused" in result && result.refused) {
      put(own)
      outcome = { kind: "refused" }
      words = askedAuto || result.refusedCode === "invalid_preference_auto" ? MODEL_CHOICE_REFUSED_AUTO : MODEL_CHOICE_REFUSED
      reported = undefined
    } else if ("deckUnavailable" in result && result.deckUnavailable) {
      const why = result.deckUnavailable
      setLoaded(prior => (prior ? { ...prior, deckState: why, deck: null } : prior))
      outcome = { kind: "deck-unavailable" }
      words = why === "not-available" ? MODEL_CHOICE_SCOPE_DECK_UNAVAILABLE : MODEL_CHOICE_SCOPE_DECK_NOT_SAVED
      reported = undefined
    } else outcome = { kind: "saved", choice }
    setFeedback(words)
    if (DECK_SAVE_ON) setConfirmed(outcome.kind === "saved" && result.mode === "account") // MODEL-CHOICE-DECK-SAVE: only the account's own 200 counts as saved
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
    deckOwn,
    choice: loaded ? choiceOfState(state) : undefined,
    saving,
    mode: meta.mode,
    reason: meta.reason,
    storageOk: loaded ? loaded.storageOk : true,
    feedback,
    saveNote: saveNote(meta.mode, meta.reason, loaded ? loaded.storageOk : true),
    select,
    ...(DECK_SAVE_ON && meta.mode === "account" && (loaded ? loaded.storageOk : true) ? { saveNote: feedback || (confirmed ? saveNote(meta.mode, meta.reason, true) : "") } : {}), // MODEL-CHOICE-DECK-SAVE: kept in the account: "Saved" after a confirmed save, the failure words after a failed one, nothing before a save
  }
}

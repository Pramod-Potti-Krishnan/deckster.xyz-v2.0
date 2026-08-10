"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { getPresentation, updateSlideNarration, SlideNarrationFields } from '@/lib/layout-service-client'
import { DeckQaInbox } from '@/components/deck-qa-inbox'
import { SlideScriptPreview } from '@/components/slide-script-preview'

// localStorage keys for panel UI state (shared across sessions)
const COLLAPSED_STORAGE_KEY = 'deckster.notesPanel.collapsed'
const TAB_STORAGE_KEY = 'deckster.notesPanel.tab'

// Debounced autosave interval for textarea edits
const SAVE_DEBOUNCE_MS = 800
// How long the "Saved" affordance stays visible after a successful save
const SAVED_INDICATOR_MS = 2000
// Single-worker drain: how many save passes before we stop looping and lean on
// the scheduled fallback retry; the backoff between passes that left a conflict
// or error; and the fallback-retry delay that recovers a persistent backlog even
// after the user stops typing.
const MAX_DRAIN_PASSES = 4
const DRAIN_BACKOFF_MS = 600
const DRAIN_RETRY_MS = 3000

type NotesTab = 'script' | 'notes' | 'references' | 'qa'
type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'syncing'

const NOTES_TABS: NotesTab[] = ['script', 'notes', 'references', 'qa']

// Per-slide editable content. References are edited as one-per-line text
// and converted to/from the Layout Service's string array on the wire.
interface SlideNarrationDraft {
  script: string
  notes: string
  references: string
}

type DirtyField = keyof SlideNarrationDraft

// Per-presentation save state. Everything a drain worker touches lives here and
// is keyed by presentationId (see saversRef), so a drain bound to deck A only
// ever reads/writes A's sub-state and only ever PATCHes A — cross-deck
// contamination is structurally impossible even while a deck swap is mid-flight.
interface SaverState {
  // Dirty fields awaiting a save, keyed by stable slide_id (globally unique).
  pending: Map<string, Set<DirtyField>>
  // At most one active drain per presentation (guards this deck's updated_at token
  // against concurrent debounce/retry fires racing each other).
  isSaving: boolean
  // This deck's updated_at from its last authoritative read/save — the optimistic
  // concurrency token threaded into every narration PATCH for THIS deck.
  updatedAt: string | null
  // Fallback retry timer recovering THIS deck's stuck backlog after the user stops.
  retryTimer: ReturnType<typeof setTimeout> | null
  // Per-outage hard-error toast de-dup for THIS deck (reset on a successful save).
  errorToastShown: boolean
}

function createSaverState(): SaverState {
  return {
    pending: new Map(),
    isSaving: false,
    updatedAt: null,
    retryTimer: null,
    errorToastShown: false,
  }
}

interface SlideNotesPanelProps {
  /** The presentation currently shown in the viewer (writes go here) */
  presentationId: string | null
  /**
   * The chat session, used to resolve this deck's PUBLISHED record for the Q&A
   * inbox. Absent (or unpublished) simply means the Q&A tab has nothing to show
   * — it never blocks the narration tabs, which are the panel's main job.
   */
  sessionId?: string | null
  /** 0-based index of the slide currently on screen */
  currentSlideIndex: number
  /** SlideUpdate payload from the WebSocket — speaker_notes fallback source */
  slideStructure?: any
}

function emptyDraft(): SlideNarrationDraft {
  return { script: '', notes: '', references: '' }
}

// Synthetic placeholder id for a slide whose stable slide_id hasn't resolved yet
// (deck fetch / WS still pending). NAMESPACED BY PRESENTATION: a real slide_id is
// globally unique, but a bare `idx:N` is NOT — deck A's index 0 would collide with
// deck B's. Prefixing the presentation id (with a `::idx:` delimiter that cannot
// appear in a real slide_id) makes `A::idx:0` and `B::idx:0` distinct, so a parked
// placeholder edit can never render as, or fold into, another deck's slide.
function placeholderId(presentationId: string | null, index: number): string {
  return `${presentationId ?? ''}::idx:${index}`
}

// True for the synthetic placeholder ids above, for ANY presentation namespace.
// Replaces the old bare `startsWith('idx:')` check.
function isPlaceholder(id: string): boolean {
  return id.includes('::idx:')
}

/** references may arrive as an array (canonical) or legacy free text */
function referencesToText(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join('\n')
  if (typeof value === 'string') return value
  return ''
}

function textToReferences(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * SlideNotesPanel — collapsible Script | Notes | References panel below the
 * slide canvas. Collapsed = a slim handle bar (Thumbnails-handle style);
 * expanded = Radix tabs with per-slide textareas and debounced autosave to the
 * Layout Service via the concurrency-guarded narration PATCH
 * (PATCH /api/presentations/{id}/slides/{slide_id}/narration).
 */
export function SlideNotesPanel({
  presentationId,
  currentSlideIndex,
  slideStructure,
  sessionId = null,
}: SlideNotesPanelProps) {
  const { toast } = useToast()

  // --- UI state (persisted) ---------------------------------------------
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'false'
  })
  const [activeTab, setActiveTab] = useState<NotesTab>(() => {
    if (typeof window === 'undefined') return 'notes'
    const stored = window.localStorage.getItem(TAB_STORAGE_KEY) as NotesTab | null
    // A stored tab that no longer exists — 'voice' moved to the publish dialog —
    // falls back rather than leaving the panel on a tab with no content.
    return stored && NOTES_TABS.includes(stored) ? stored : 'notes'
  })

  const handleToggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(!next))
      } catch { /* storage unavailable — non-fatal */ }
      return next
    })
  }, [])

  // Questions waiting on the owner. Lives here rather than in the inbox so the
  // count can badge the tab while the tab is closed — which is the only way a
  // publisher learns a viewer is waiting without going looking.
  const [unansweredQuestions, setUnansweredQuestions] = useState(0)
  // Bumped to force an authoritative re-read after a script is written elsewhere.
  const [reloadToken, setReloadToken] = useState(0)

  const handleTabChange = useCallback((value: string) => {
    const tab = value as NotesTab
    setActiveTab(tab)
    try {
      window.localStorage.setItem(TAB_STORAGE_KEY, tab)
    } catch { /* storage unavailable — non-fatal */ }
  }, [])

  // --- Per-slide content -------------------------------------------------
  // Drafts are keyed by the slide's STABLE slide_id (not numeric index) so a
  // draft follows its slide across add / delete / reorder / async-compose,
  // which all shift indices. The PUT still targets the numeric index (the
  // Layout Service is index-based); we map slide_id → current index at save time.
  const [drafts, setDrafts] = useState<Record<string, SlideNarrationDraft>>({})
  // index → slide_id, from the authoritative deck fetch
  const [slideIds, setSlideIds] = useState<string[]>([])
  // Fields the user has touched — the authoritative fetch must not clobber these.
  // Keyed by `${slide_id}:${field}`; slide_ids are globally unique, so this safely
  // persists across deck switches (it is NOT reset on presentation change).
  const editedFieldsRef = useRef<Set<string>>(new Set())
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
  // Latest presentation id — so an in-flight save for a since-swapped deck never
  // folds its fresh drafts back onto the deck now on screen (updated_at is now
  // per-deck, so only the shared drafts/slideIds still need this guard).
  const presentationIdRef = useRef(presentationId)
  presentationIdRef.current = presentationId

  // Save orchestration is PER-PRESENTATION: each deck gets its own SaverState
  // (pending / isSaving / updatedAt / retryTimer / errorToastShown). A drain is
  // bound to one presentationId and only ever touches that id's SaverState and
  // PATCHes that id, so a mid-flight deck swap can neither discard nor misroute a
  // queued edit. Drafts stay a single map keyed by globally-unique slide_id.
  const saversRef = useRef<Map<string, SaverState>>(new Map())
  const getSaver = useCallback((id: string): SaverState => {
    let saver = saversRef.current.get(id)
    if (!saver) {
      saver = createSaverState()
      saversRef.current.set(id, saver)
    }
    return saver
  }, [])

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Late-bound handle to the drain, so the retry scheduler can invoke it without
  // a useCallback dependency cycle (scheduler ↔ drain).
  const drainSavesRef = useRef<((targetPresentationId: string) => void) | null>(null)

  // WS fallback: speaker_notes already travel on slideStructure (index-keyed —
  // this only ever backs the slide currently on screen)
  const wsNotesByIndex = useMemo(() => {
    const map: Record<number, string> = {}
    const slides = slideStructure?.slides
    if (Array.isArray(slides)) {
      slides.forEach((slide: any, index: number) => {
        if (typeof slide?.speaker_notes === 'string' && slide.speaker_notes) {
          map[index] = slide.speaker_notes
        }
      })
    }
    return map
  }, [slideStructure])

  // index → slide_id from the WS SlideUpdate payload — the fallback id map
  // until the authoritative deck fetch resolves.
  const wsSlideIds = useMemo(() => {
    const slides = slideStructure?.slides
    if (!Array.isArray(slides)) return [] as string[]
    return slides.map((slide: any, index: number) =>
      typeof slide?.slide_id === 'string' && slide.slide_id
        ? slide.slide_id
        : placeholderId(presentationId, index)
    )
  }, [slideStructure, presentationId])

  // Number of slides in the current deck — a change (add/delete) re-triggers the
  // authoritative read so drafts pick up new slides. (A reorder keeps the count
  // the same, so it won't refetch — that's fine: the live WS order below already
  // reflects it and drafts are keyed by slide_id, so content follows regardless.)
  const slideListLength = wsSlideIds.length

  // Effective index→id map. Prefer the live WS order: it matches what the viewer
  // shows and reflects reorders immediately (which don't refetch). Fall back to
  // the authoritative fetch order, then a synthetic idx: key. Held in a ref so the
  // edit handler and debounced flush resolve id↔index against the freshest order.
  const effectiveSlideIds = useMemo(() => {
    const len = Math.max(wsSlideIds.length, slideIds.length)
    const out: string[] = []
    for (let i = 0; i < len; i++)
      out.push(wsSlideIds[i] ?? slideIds[i] ?? placeholderId(presentationId, i))
    return out
  }, [wsSlideIds, slideIds, presentationId])
  const slideIdsRef = useRef(effectiveSlideIds)
  slideIdsRef.current = effectiveSlideIds

  // On a presentation change we set up FRESH on-screen state for the NEW deck but
  // deliberately DO NOT clear the OLD deck's work:
  //   • The old deck's SaverState (pending / updatedAt / retry timer / isSaving)
  //     stays in saversRef, owned by its own drain. The flush-on-change cleanup
  //     below kicks that drain so it finishes saving to the OLD deck independently.
  //   • drafts and editedFieldsRef are keyed by globally-unique slide_id, so the
  //     old deck's entries coexist harmlessly with the new deck's — and clearing
  //     them would strand the in-flight old-deck drain (it reads drafts by id).
  // We only reset the on-screen id map and the shared save indicator.
  useEffect(() => {
    setSlideIds([])
    setSaveState('idle')
  }, [presentationId])

  // Merge a freshly-fetched deck into local state: refresh the id map and fill
  // any field the user hasn't edited (keyed by stable slide_id). Returns the
  // deck's updated_at so callers can advance the concurrency token — the caller
  // decides whether to store it (it must NOT for a deck no longer on screen).
  const mergeDeck = useCallback(
    (
      presentation: Record<string, any>,
      forPresentationId: string,
    ): { ids: string[]; updatedAt: string | null } => {
      const slides = Array.isArray(presentation.slides) ? presentation.slides : []
      const ids = slides.map((slide: any, index: number) =>
        typeof slide?.slide_id === 'string' && slide.slide_id
          ? slide.slide_id
          : placeholderId(forPresentationId, index)
      )
      setSlideIds(ids)

      // idx:N → real slide_id migration (F4): an edit made before a stable id
      // resolved was parked under this deck's synthetic placeholder key
      // (`placeholderId(forPresentationId, N)`) across drafts, editedFields, and the
      // pending queue. Now that this GET resolved the real id for index N, move those
      // entries onto the real id so the previously-stuck edit can drain. (pending +
      // editedFields migrate synchronously here; drafts inside setDrafts below. The
      // migration-kick effect then flushes the freed edit once drafts commit.) We only
      // ever migrate the placeholders of the deck this merge is FOR.
      const saver = getSaver(forPresentationId)
      // Capture, per (realId, field), the PRE-migration edited state so the drafts
      // merge below can pick the NEWEST edit field-by-field (BUG 2). `realHadEdit` =
      // the user independently re-edited this field under the real id AFTER it
      // resolved (a newer edit that must win); `placeholderHadEdit` = the parked
      // placeholder carried an edit for this field. This MUST be read BEFORE the
      // editedFields union below folds placeholder:field into realId:field, which
      // erases the distinction.
      const migrations = new Map<
        string,
        {
          placeholder: string
          fields: Record<DirtyField, { realHadEdit: boolean; placeholderHadEdit: boolean }>
        }
      >()
      ids.forEach((realId, index) => {
        if (isPlaceholder(realId)) return
        const placeholder = placeholderId(forPresentationId, index)

        const fields = {} as Record<DirtyField, { realHadEdit: boolean; placeholderHadEdit: boolean }>
        ;(['script', 'notes', 'references'] as DirtyField[]).forEach((field) => {
          fields[field] = {
            realHadEdit: editedFieldsRef.current.has(`${realId}:${field}`),
            placeholderHadEdit: editedFieldsRef.current.has(`${placeholder}:${field}`),
          }
        })
        migrations.set(realId, { placeholder, fields })

        // pending union (unchanged): both the parked and any real dirty fields stay
        // queued so nothing the user typed is dropped.
        const parkedPending = saver.pending.get(placeholder)
        if (parkedPending && parkedPending.size > 0) {
          const target = saver.pending.get(realId) ?? new Set<DirtyField>()
          parkedPending.forEach((field) => target.add(field))
          saver.pending.set(realId, target)
        }
        saver.pending.delete(placeholder)
        // editedFields union (unchanged): a placeholder edit keeps the field protected
        // from the server refill under the real id too.
        ;(['script', 'notes', 'references'] as DirtyField[]).forEach((field) => {
          if (editedFieldsRef.current.has(`${placeholder}:${field}`)) {
            editedFieldsRef.current.add(`${realId}:${field}`)
            editedFieldsRef.current.delete(`${placeholder}:${field}`)
          }
        })
      })

      setDrafts((prev) => {
        const next: Record<string, SlideNarrationDraft> = { ...prev }
        // Field-aware idx:N → real id draft migration (BUG 2): the NEWEST edit per
        // field wins, driven by the pre-migration edited state captured above.
        //   • realHadEdit  → the user re-edited this field under the real id after it
        //     resolved: keep the real value, never clobber it with the older parked one.
        //   • placeholderHadEdit → the placeholder carried the newest edit: take it.
        //   • neither → keep the real draft (the server fill below handles unedited
        //     fields), so an empty placeholder value can never overwrite real content.
        migrations.forEach(({ placeholder, fields }, realId) => {
          const parkedDraft = next[placeholder]
          if (!parkedDraft) return
          const merged: SlideNarrationDraft = { ...(next[realId] ?? emptyDraft()) }
          ;(['script', 'notes', 'references'] as DirtyField[]).forEach((field) => {
            const { realHadEdit, placeholderHadEdit } = fields[field]
            if (realHadEdit) return
            if (placeholderHadEdit) merged[field] = parkedDraft[field]
          })
          next[realId] = merged
          delete next[placeholder]
        })
        slides.forEach((slide: any, index: number) => {
          const id = ids[index]
          const draft = { ...(next[id] ?? emptyDraft()) }
          const edited = editedFieldsRef.current
          if (!edited.has(`${id}:script`)) {
            draft.script = typeof slide?.script === 'string' ? slide.script : ''
          }
          if (!edited.has(`${id}:notes`)) {
            // Lazy migration: lift content.speaker_notes when top-level is empty
            draft.notes =
              (typeof slide?.speaker_notes === 'string' && slide.speaker_notes) ||
              (typeof slide?.content?.speaker_notes === 'string' && slide.content.speaker_notes) ||
              ''
          }
          if (!edited.has(`${id}:references`)) {
            draft.references = referencesToText(slide?.references)
          }
          next[id] = draft
        })
        return next
      })
      return {
        ids,
        updatedAt: typeof presentation.updated_at === 'string' ? presentation.updated_at : null,
      }
    },
    [getSaver]
  )

  // Authoritative read: GET the deck JSON from the Layout Service on mount,
  // presentation change, or whenever the slide list length changes (slides
  // added / removed). Fills unedited fields and captures the deck's updated_at
  // as the optimistic-concurrency token for narration saves.
  useEffect(() => {
    if (!presentationId) return

    let cancelled = false
    getPresentation(presentationId).then((presentation) => {
      if (cancelled || !presentation) return
      const { updatedAt } = mergeDeck(presentation, presentationId)
      // Store into THIS presentation's saver (keyed, so no on-screen guard needed).
      if (updatedAt) getSaver(presentationId).updatedAt = updatedAt
    })

    return () => {
      cancelled = true
    }
  }, [presentationId, slideListLength, reloadToken, mergeDeck, getSaver])

  // Scripts can be written from somewhere else entirely — the publish dialog's
  // "Write the script" drafts all of them at once. This panel has no idea that
  // happened, so without this the author closes the dialog, opens the Script
  // tab, and sees the empty box they left behind. A window event is the honest
  // mechanism here: the two components have no shared ancestor holding this
  // state, and inventing one to carry a refresh signal would be worse.
  useEffect(() => {
    const onExternalWrite = () => setReloadToken((token) => token + 1)
    window.addEventListener('deckster:narration-script-written', onExternalWrite)
    return () => window.removeEventListener('deckster:narration-script-written', onExternalWrite)
  }, [])

  // --- Saving --------------------------------------------------------------
  // Re-queue a slide's dirty fields onto ITS presentation's saver so a later drain
  // pass / retry re-attempts them (never leaks into another deck's queue).
  const requeue = useCallback(
    (saver: SaverState, slideId: string, fields: SlideNarrationFields) => {
      const set = saver.pending.get(slideId) ?? new Set<DirtyField>()
      if (fields.script !== undefined) set.add('script')
      if (fields.speaker_notes !== undefined) set.add('notes')
      if (fields.references !== undefined) set.add('references')
      saver.pending.set(slideId, set)
    },
    [],
  )

  // Persist queued narration edits via the concurrency-guarded PATCH (addressed
  // by stable slide_id). Runs SEQUENTIALLY so each save's fresh updated_at threads
  // into the next — parallel writes would race the deck's updated_at and 409 each
  // other. `targetPresentationId` is passed so a flush-on-presentation-change
  // writes to the deck it queued for, not whatever deck is on screen now.
  const runNarrationSaves = useCallback(
    async (
      targetPresentationId: string,
      saver: SaverState,
      jobs: Array<{ slideId: string; fields: SlideNarrationFields }>,
    ): Promise<{ hadError: boolean; hadConflict: boolean }> => {
      // The updated_at token now lives on THIS deck's saver, so it is always safe
      // to advance regardless of what's on screen. isCurrent() still gates mergeDeck
      // because that folds fresh state into the SHARED on-screen drafts/slideIds.
      const isCurrent = () => targetPresentationId === presentationIdRef.current
      let hadError = false
      let hadConflict = false

      for (const job of jobs) {
        // Establish the expected updated_at (refetch to seed it if we lack one).
        let expected = saver.updatedAt
        if (!expected) {
          const fresh = await getPresentation(targetPresentationId)
          if (fresh) {
            const updatedAt = typeof fresh.updated_at === 'string' ? fresh.updated_at : null
            if (isCurrent()) mergeDeck(fresh, targetPresentationId)
            expected = updatedAt
            if (updatedAt) saver.updatedAt = updatedAt
          }
        }
        if (!expected) {
          // No baseline — the required guard can't be satisfied; retry next pass.
          requeue(saver, job.slideId, job.fields)
          hadConflict = true
          continue
        }

        let result = await updateSlideNarration(
          targetPresentationId,
          job.slideId,
          job.fields,
          expected,
        )

        // 409 → the deck moved under us. Refetch, re-apply this slide's draft onto
        // the fresh state, and retry ONCE with the fresh updated_at (bounded).
        if (result.status === 409) {
          const fresh = await getPresentation(targetPresentationId)
          let freshUpdatedAt = result.currentUpdatedAt ?? null
          if (fresh) {
            if (!freshUpdatedAt) {
              freshUpdatedAt = typeof fresh.updated_at === 'string' ? fresh.updated_at : null
            }
            // Only fold fresh state into the on-screen drafts for the live deck.
            // The user's edited fields survive (editedFieldsRef gates them), so
            // the retry still carries their pending draft (job.fields).
            if (isCurrent()) mergeDeck(fresh, targetPresentationId)
          }
          if (freshUpdatedAt) {
            saver.updatedAt = freshUpdatedAt
            result = await updateSlideNarration(
              targetPresentationId,
              job.slideId,
              job.fields,
              freshUpdatedAt,
            )
          }
        }

        if (result.success) {
          // A successful save means any prior outage is over — allow the next
          // hard error to surface a fresh toast for THIS deck.
          saver.errorToastShown = false
          if (result.updatedAt) saver.updatedAt = result.updatedAt
        } else if (result.status === 409) {
          // Still conflicting after one retry — back off softly; next pass tries.
          hadConflict = true
          requeue(saver, job.slideId, job.fields)
        } else {
          hadError = true
          requeue(saver, job.slideId, job.fields)
          // Toast once per outage — the drain retries every few seconds, so
          // toasting each failed pass would spam a destructive toast while the
          // server is down. Reset on the next successful save (above).
          if (!saver.errorToastShown) {
            saver.errorToastShown = true
            toast({
              title: 'Failed to save notes',
              description:
                result.error?.message ||
                'Your latest edits could not be saved. They will retry automatically.',
              variant: 'destructive',
            })
          }
        }
      }

      // The drain loop owns the final save-state transition (and any retry) so
      // it can weigh the whole backlog across passes — return what this pass saw.
      return { hadError, hadConflict }
    },
    [mergeDeck, requeue, toast],
  )

  // Is there anything the drain can save right now? Drainable = a real slide_id
  // (not a synthetic idx: key, which means no stable id yet) with a materialized
  // draft. idx: entries stay parked until the authoritative fetch resolves them.
  const hasDrainablePending = useCallback((saver: SaverState) => {
    for (const [slideId, dirty] of saver.pending) {
      if (isPlaceholder(slideId) || dirty.size === 0) continue
      if (draftsRef.current[slideId]) return true
    }
    return false
  }, [])

  // Pull the drainable PATCH jobs out of the pending queue (payloads addressed by
  // stable slide_id), leaving idx: / not-yet-materialized entries parked for a
  // later pass. MOVES jobs out of pending so requeue-on-failure re-adds cleanly.
  const buildJobs = useCallback(
    (saver: SaverState): Array<{ slideId: string; fields: SlideNarrationFields }> => {
      const jobs: Array<{ slideId: string; fields: SlideNarrationFields }> = []
      const parked = new Map<string, Set<DirtyField>>()
      saver.pending.forEach((dirty, slideId) => {
        const draft = draftsRef.current[slideId]
        // A synthetic placeholder key means we lack a stable id yet (deck fetch / WS
        // still pending) — keep it queued so a later pass retries rather than dropping it.
        if (!draft || isPlaceholder(slideId)) {
          parked.set(slideId, dirty)
          return
        }
        const payload: SlideNarrationFields = {}
        if (dirty.has('script')) payload.script = draft.script
        if (dirty.has('notes')) payload.speaker_notes = draft.notes
        if (dirty.has('references')) payload.references = textToReferences(draft.references)
        if (Object.keys(payload).length > 0) jobs.push({ slideId, fields: payload })
      })
      saver.pending = parked
      return jobs
    },
    [],
  )

  // Reschedule the drain after a persistent conflict/error so a stuck backlog
  // recovers even if the user stops typing (otherwise the panel would sit on
  // "Syncing…"/"Not saved" until the next edit or unmount).
  const scheduleDrainRetry = useCallback(
    (targetPresentationId: string) => {
      const saver = getSaver(targetPresentationId)
      if (saver.retryTimer) clearTimeout(saver.retryTimer)
      saver.retryTimer = setTimeout(() => {
        saver.retryTimer = null
        // Retry THIS deck regardless of what's on screen — its pending is isolated
        // and only ever PATCHes this deck, so a since-swapped deck still recovers.
        drainSavesRef.current?.(targetPresentationId)
      }, DRAIN_RETRY_MS)
    },
    [getSaver],
  )

  // Single-worker drain loop, bound to ONE presentationId. At most one runs per
  // deck at a time (the saver.isSaving guard), so concurrent debounce/retry fires
  // can't race that deck's updated_at token. It fully drains THIS deck's isolated
  // pending queue (safe to keep looping even after a deck swap — the queue only
  // ever holds this deck's slide_ids and every PATCH targets this deck). Each pass
  // uses the per-job logic (updated_at seeding, single 409 refetch+retry); a pass
  // that left a conflict/error backs off before the next.
  const drainSaves = useCallback(
    async (targetPresentationId: string) => {
      const saver = getSaver(targetPresentationId)
      if (saver.isSaving) return
      if (!hasDrainablePending(saver)) return
      saver.isSaving = true
      // Only drive the shared save indicator when this IS the on-screen deck; an
      // off-screen deck draining in the background must not hijack the UI.
      const ownsUi = () => targetPresentationId === presentationIdRef.current
      if (ownsUi()) setSaveState('saving')

      let hadError = false
      try {
        for (let pass = 0; pass < MAX_DRAIN_PASSES; pass++) {
          const jobs = buildJobs(saver)
          if (jobs.length === 0) break
          const result = await runNarrationSaves(targetPresentationId, saver, jobs)
          hadError = result.hadError
          if (result.hadError || result.hadConflict) {
            await new Promise((resolve) => setTimeout(resolve, DRAIN_BACKOFF_MS))
          }
        }
      } finally {
        saver.isSaving = false
      }

      const stillPending = hasDrainablePending(saver)

      // An off-screen deck never touches the on-screen UI, but still schedules a
      // fallback retry if it couldn't fully drain, so it recovers on its own.
      if (!ownsUi()) {
        if (stillPending) scheduleDrainRetry(targetPresentationId)
        return
      }

      if (stillPending) {
        // Persistent conflict/error after the bounded passes — surface it and
        // schedule a fallback retry so it recovers without another edit.
        setSaveState(hadError ? 'error' : 'syncing')
        scheduleDrainRetry(targetPresentationId)
      } else {
        setSaveState('saved')
        if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current)
        savedIndicatorRef.current = setTimeout(() => {
          setSaveState((prev) => (prev === 'saved' ? 'idle' : prev))
        }, SAVED_INDICATOR_MS)
      }
    },
    [getSaver, hasDrainablePending, buildJobs, runNarrationSaves, scheduleDrainRetry],
  )
  drainSavesRef.current = drainSaves

  // Entry point: ensure the single drain worker is running for this deck. A
  // second call while one is in flight is a no-op (the worker picks up newly
  // queued items on its next pass).
  const flushPending = useCallback(
    (targetPresentationId: string) => {
      void drainSaves(targetPresentationId)
    },
    [drainSaves],
  )

  const scheduleSave = useCallback(() => {
    if (!presentationId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      // The debounced save always targets the on-screen presentation
      flushPending(presentationId)
    }, SAVE_DEBOUNCE_MS)
  }, [presentationId, flushPending])

  // Flush straight away when the presentation changes / panel unmounts. This runs
  // as the OLD presentationId's cleanup (BEFORE the reset effect body), kicking the
  // old deck's own drain so it finishes saving to the old deck independently. The
  // narration PATCH is addressed by stable slide_id and the drain reads the old
  // deck's isolated SaverState (never cleared on change), so it resolves against
  // the right deck (targetPresentationId) without an index map.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (presentationId) flushPending(presentationId)
    }
  }, [presentationId, flushPending])

  // When an authoritative merge resolves synthetic idx:N keys into real slide_ids
  // the id map (slideIds) changes and mergeDeck migrates any parked idx:N edit onto
  // its real id (pending + editedFields synchronously, drafts via setDrafts). This
  // effect runs post-commit — so draftsRef is fresh — and kicks the on-screen
  // deck's drain to finally save that previously-stuck edit (F4).
  useEffect(() => {
    if (!presentationId) return
    const saver = saversRef.current.get(presentationId)
    if (saver && hasDrainablePending(saver)) {
      flushPending(presentationId)
    }
  }, [slideIds, presentationId, hasDrainablePending, flushPending])

  useEffect(() => {
    return () => {
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current)
      // Clear EVERY presentation's fallback retry timer, not just the on-screen one.
      for (const saver of saversRef.current.values()) {
        if (saver.retryTimer) {
          clearTimeout(saver.retryTimer)
          saver.retryTimer = null
        }
      }
    }
  }, [])

  const handleFieldChange = useCallback((field: DirtyField, value: string) => {
    const slideIndex = currentSlideIndex
    // The ON-SCREEN deck — the only deck the user can type into. Its id namespaces
    // any placeholder fallback so a pre-resolution edit can't collide across decks.
    const pid = presentationIdRef.current
    const slideId = slideIdsRef.current[slideIndex] ?? placeholderId(pid, slideIndex)
    editedFieldsRef.current.add(`${slideId}:${field}`)
    if (pid) {
      const saver = getSaver(pid)
      const set = saver.pending.get(slideId) ?? new Set<DirtyField>()
      set.add(field)
      saver.pending.set(slideId, set)
    }
    setDrafts((prev) => ({
      ...prev,
      [slideId]: { ...(prev[slideId] ?? emptyDraft()), [field]: value },
    }))
    scheduleSave()
  }, [currentSlideIndex, getSaver, scheduleSave])

  // --- Render ---------------------------------------------------------------
  const currentSlideId = effectiveSlideIds[currentSlideIndex] ?? placeholderId(presentationId, currentSlideIndex)
  const draft = drafts[currentSlideId] ?? emptyDraft()
  // WS fallback only applies while the user hasn't touched the field and the
  // deck JSON gave us nothing (otherwise clearing the textarea would resurrect it)
  const notesValue = editedFieldsRef.current.has(`${currentSlideId}:notes`)
    ? draft.notes
    : draft.notes || wsNotesByIndex[currentSlideIndex] || ''
  const disabled = !presentationId

  return (
    <>
      {/* Handle — zero-height context so the tab floats over the slide area */}
      <div className="relative h-0 flex-shrink-0 z-10">
        <button
          onClick={handleToggleExpanded}
          className={cn(
            "absolute left-1/2 -translate-x-1/2 bottom-0",
            "px-3 py-0.5 rounded-t-md shadow-sm border border-b-0",
            "flex items-center justify-center gap-1 cursor-pointer transition-colors",
            expanded
              ? "bg-indigo-200 hover:bg-indigo-300 border-indigo-400 text-indigo-700 dark:bg-indigo-900/50 dark:hover:bg-indigo-800/60 dark:border-indigo-700 dark:text-indigo-200"
              : "bg-indigo-100 hover:bg-indigo-200 border-indigo-300 text-indigo-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-indigo-300"
          )}
          title={expanded ? "Hide script & notes" : "Show script & notes"}
        >
          {expanded ? (
            <ChevronDown className="h-2.5 w-2.5" />
          ) : (
            <ChevronUp className="h-2.5 w-2.5" />
          )}
          <span className="text-[9px] font-semibold uppercase tracking-wider select-none leading-none">
            Notes
          </span>
        </button>
      </div>

      {/* Expanded panel — fixed height; the slide container's ResizeObserver
          fit-contain shrinks the 16:9 slide to make room. */}
      {expanded && (
        <div
          className={cn(
            // The narration tabs are single textareas and 240px is plenty. A
            // question QUEUE is not — at that height it shows one item and a
            // scrollbar, which is the cramped-surface problem this panel exists
            // to avoid. The slide container's ResizeObserver fit-contain
            // absorbs the difference either way.
            'flex-shrink-0 border-t border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 flex flex-col',
            activeTab === 'qa' ? 'h-96' : 'h-60'
          )}
        >
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="flex-1 flex flex-col min-h-0 px-4 pt-2 pb-3"
          >
            <div className="flex-shrink-0 flex items-center justify-between gap-2">
              <TabsList className="h-8">
                <TabsTrigger value="script" className="text-xs px-2.5 py-1">Script</TabsTrigger>
                <TabsTrigger value="notes" className="text-xs px-2.5 py-1">Notes</TabsTrigger>
                <TabsTrigger value="references" className="text-xs px-2.5 py-1">References</TabsTrigger>
                <TabsTrigger value="qa" className="text-xs px-2.5 py-1">
                  Q&amp;A
                  {unansweredQuestions > 0 && (
                    <span
                      className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white"
                      aria-label={`${unansweredQuestions} questions waiting`}
                    >
                      {unansweredQuestions > 99 ? '99+' : unansweredQuestions}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                {saveState === 'saving' && (
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </span>
                )}
                {saveState === 'saved' && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" />
                    Saved
                  </span>
                )}
                {saveState === 'syncing' && (
                  <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <span className="h-3 w-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    Syncing…
                  </span>
                )}
                {saveState === 'error' && (
                  <span className="text-amber-600 dark:text-amber-400">Not saved</span>
                )}
                <span>Slide {currentSlideIndex + 1}</span>
              </div>
            </div>

            <TabsContent value="script" className="flex-1 min-h-0 mt-2 flex flex-col">
              {/* Above the words, not below: the question "does this sound
                  right?" occurs while reading them, and the answer should not
                  require leaving the tab. */}
              <SlideScriptPreview
                presentationId={presentationId}
                slideId={slideIds[currentSlideIndex] ?? null}
                refreshToken={reloadToken}
              />
              <Textarea
                value={draft.script}
                onChange={(e) => handleFieldChange('script', e.target.value)}
                disabled={disabled}
                placeholder="Write the spoken narration for this slide…"
                className="flex-1 min-h-0 resize-none text-sm"
              />
            </TabsContent>
            <TabsContent value="notes" className="flex-1 min-h-0 mt-2">
              <Textarea
                value={notesValue}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                disabled={disabled}
                placeholder="Speaker notes for this slide…"
                className="h-full min-h-0 resize-none text-sm"
              />
            </TabsContent>
            <TabsContent value="references" className="flex-1 min-h-0 mt-2">
              <Textarea
                value={draft.references}
                onChange={(e) => handleFieldChange('references', e.target.value)}
                disabled={disabled}
                placeholder={"Sources and citations for this slide — one per line…"}
                className="h-full min-h-0 resize-none text-sm"
              />
            </TabsContent>
            {/* Deck-scoped, not slide-scoped: a viewer asks about the deck, so
                the queue must not change as the owner clicks through slides.

                forceMount, because Radix unmounts an inactive tab — and an
                unmounted inbox never fetches, so the badge would only ever
                appear AFTER opening the tab, which is the one moment it is no
                longer needed. Hidden via CSS instead. */}
            <TabsContent
              forceMount
              value="qa"
              className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden"
            >
              <DeckQaInbox sessionId={sessionId} onUnansweredChange={setUnansweredQuestions} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { getPresentation, updateSlideNarration, SlideNarrationFields } from '@/lib/layout-service-client'

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

type NotesTab = 'script' | 'notes' | 'references'
type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'syncing'

const NOTES_TABS: NotesTab[] = ['script', 'notes', 'references']

// Per-slide editable content. References are edited as one-per-line text
// and converted to/from the Layout Service's string array on the wire.
interface SlideNarrationDraft {
  script: string
  notes: string
  references: string
}

type DirtyField = keyof SlideNarrationDraft

interface SlideNotesPanelProps {
  /** The presentation currently shown in the viewer (writes go here) */
  presentationId: string | null
  /** 0-based index of the slide currently on screen */
  currentSlideIndex: number
  /** SlideUpdate payload from the WebSocket — speaker_notes fallback source */
  slideStructure?: any
}

function emptyDraft(): SlideNarrationDraft {
  return { script: '', notes: '', references: '' }
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
  // Fields the user has touched — the authoritative fetch must not clobber these
  const editedFieldsRef = useRef<Set<string>>(new Set())
  // Dirty fields awaiting a save, keyed by slide_id
  const pendingRef = useRef<Map<string, Set<DirtyField>>>(new Map())
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
  // Latest presentation id — so an in-flight save for a since-swapped deck never
  // writes its updated_at / drafts back onto the deck now on screen.
  const presentationIdRef = useRef(presentationId)
  presentationIdRef.current = presentationId
  // The deck's updated_at from the last authoritative read/save — the optimistic
  // concurrency token threaded into every narration PATCH.
  const updatedAtRef = useRef<string | null>(null)

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // One active save worker per presentation — a second debounce fire must NOT
  // launch a concurrent worker (both would read the same updatedAtRef and race
  // the server guard, the older-finishing write winning → the newer draft lost).
  const isSavingRef = useRef(false)
  // Fallback retry timer: reschedules the drain after a persistent conflict/error
  // so a stuck backlog recovers even if the user stops typing.
  const drainRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      typeof slide?.slide_id === 'string' && slide.slide_id ? slide.slide_id : `idx:${index}`
    )
  }, [slideStructure])

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
    for (let i = 0; i < len; i++) out.push(wsSlideIds[i] ?? slideIds[i] ?? `idx:${i}`)
    return out
  }, [wsSlideIds, slideIds])
  const slideIdsRef = useRef(effectiveSlideIds)
  slideIdsRef.current = effectiveSlideIds

  // Full reset when the presentation itself changes. (isSavingRef is intentionally
  // NOT reset here — a drain flushing the OLD deck owns that flag for its full
  // lifetime and clears it itself; the flush-on-change cleanup below runs before
  // this reset, so the old deck's pending is already captured.)
  useEffect(() => {
    editedFieldsRef.current = new Set()
    pendingRef.current = new Map()
    updatedAtRef.current = null
    if (drainRetryTimerRef.current) {
      clearTimeout(drainRetryTimerRef.current)
      drainRetryTimerRef.current = null
    }
    setDrafts({})
    setSlideIds([])
    setSaveState('idle')
  }, [presentationId])

  // Merge a freshly-fetched deck into local state: refresh the id map and fill
  // any field the user hasn't edited (keyed by stable slide_id). Returns the
  // deck's updated_at so callers can advance the concurrency token — the caller
  // decides whether to store it (it must NOT for a deck no longer on screen).
  const mergeDeck = useCallback(
    (presentation: Record<string, any>): { ids: string[]; updatedAt: string | null } => {
      const slides = Array.isArray(presentation.slides) ? presentation.slides : []
      const ids = slides.map((slide: any, index: number) =>
        typeof slide?.slide_id === 'string' && slide.slide_id ? slide.slide_id : `idx:${index}`
      )
      setSlideIds(ids)
      setDrafts((prev) => {
        const next: Record<string, SlideNarrationDraft> = { ...prev }
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
    []
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
      const { updatedAt } = mergeDeck(presentation)
      if (updatedAt && presentationIdRef.current === presentationId) {
        updatedAtRef.current = updatedAt
      }
    })

    return () => {
      cancelled = true
    }
  }, [presentationId, slideListLength, mergeDeck])

  // --- Saving --------------------------------------------------------------
  // Re-queue a slide's dirty fields so the next debounce retries them.
  const requeue = useCallback((slideId: string, fields: SlideNarrationFields) => {
    const set = pendingRef.current.get(slideId) ?? new Set<DirtyField>()
    if (fields.script !== undefined) set.add('script')
    if (fields.speaker_notes !== undefined) set.add('notes')
    if (fields.references !== undefined) set.add('references')
    pendingRef.current.set(slideId, set)
  }, [])

  // Persist queued narration edits via the concurrency-guarded PATCH (addressed
  // by stable slide_id). Runs SEQUENTIALLY so each save's fresh updated_at threads
  // into the next — parallel writes would race the deck's updated_at and 409 each
  // other. `targetPresentationId` is passed so a flush-on-presentation-change
  // writes to the deck it queued for, not whatever deck is on screen now.
  const runNarrationSaves = useCallback(
    async (
      targetPresentationId: string,
      jobs: Array<{ slideId: string; fields: SlideNarrationFields }>,
    ): Promise<{ hadError: boolean; hadConflict: boolean }> => {
      const isCurrent = () => targetPresentationId === presentationIdRef.current
      let hadError = false
      let hadConflict = false

      for (const job of jobs) {
        // Establish the expected updated_at (refetch to seed it if we lack one).
        let expected = updatedAtRef.current
        if (!expected) {
          const fresh = await getPresentation(targetPresentationId)
          if (fresh) {
            const updatedAt = typeof fresh.updated_at === 'string' ? fresh.updated_at : null
            if (isCurrent()) mergeDeck(fresh)
            expected = updatedAt
            if (updatedAt && isCurrent()) updatedAtRef.current = updatedAt
          }
        }
        if (!expected) {
          // No baseline — the required guard can't be satisfied; retry next debounce.
          requeue(job.slideId, job.fields)
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
            if (isCurrent()) mergeDeck(fresh)
          }
          if (freshUpdatedAt) {
            if (isCurrent()) updatedAtRef.current = freshUpdatedAt
            result = await updateSlideNarration(
              targetPresentationId,
              job.slideId,
              job.fields,
              freshUpdatedAt,
            )
          }
        }

        if (result.success) {
          if (result.updatedAt && isCurrent()) updatedAtRef.current = result.updatedAt
        } else if (result.status === 409) {
          // Still conflicting after one retry — back off softly; next debounce tries.
          hadConflict = true
          requeue(job.slideId, job.fields)
        } else {
          hadError = true
          requeue(job.slideId, job.fields)
          toast({
            title: 'Failed to save notes',
            description:
              result.error?.message ||
              'Your latest edits could not be saved. They will retry on your next change.',
            variant: 'destructive',
          })
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
  const hasDrainablePending = useCallback(() => {
    for (const [slideId, dirty] of pendingRef.current) {
      if (slideId.startsWith('idx:') || dirty.size === 0) continue
      if (draftsRef.current[slideId]) return true
    }
    return false
  }, [])

  // Pull the drainable PATCH jobs out of the pending queue (payloads addressed by
  // stable slide_id), leaving idx: / not-yet-materialized entries parked for a
  // later pass. MOVES jobs out of pending so requeue-on-failure re-adds cleanly.
  const buildJobs = useCallback((): Array<{ slideId: string; fields: SlideNarrationFields }> => {
    const jobs: Array<{ slideId: string; fields: SlideNarrationFields }> = []
    const parked = new Map<string, Set<DirtyField>>()
    pendingRef.current.forEach((dirty, slideId) => {
      const draft = draftsRef.current[slideId]
      // A synthetic idx: key means we lack a stable id yet (deck fetch / WS still
      // pending) — keep it queued so a later pass retries rather than dropping it.
      if (!draft || slideId.startsWith('idx:')) {
        parked.set(slideId, dirty)
        return
      }
      const payload: SlideNarrationFields = {}
      if (dirty.has('script')) payload.script = draft.script
      if (dirty.has('notes')) payload.speaker_notes = draft.notes
      if (dirty.has('references')) payload.references = textToReferences(draft.references)
      if (Object.keys(payload).length > 0) jobs.push({ slideId, fields: payload })
    })
    pendingRef.current = parked
    return jobs
  }, [])

  // Reschedule the drain after a persistent conflict/error so a stuck backlog
  // recovers even if the user stops typing (otherwise the panel would sit on
  // "Syncing…"/"Not saved" until the next edit or unmount).
  const scheduleDrainRetry = useCallback((targetPresentationId: string) => {
    if (drainRetryTimerRef.current) clearTimeout(drainRetryTimerRef.current)
    drainRetryTimerRef.current = setTimeout(() => {
      drainRetryTimerRef.current = null
      // Only retry the on-screen deck; a since-swapped deck was already flushed.
      if (targetPresentationId === presentationIdRef.current) {
        drainSavesRef.current?.(targetPresentationId)
      }
    }, DRAIN_RETRY_MS)
  }, [])

  // Single-worker drain loop. Only one runs per presentation at a time (the
  // isSavingRef guard), so concurrent debounce fires can't race the shared
  // updated_at token. Each pass saves the queued jobs with the existing per-job
  // logic (expected_updated_at seeding, single 409 refetch+retry, isCurrent()
  // guards); a pass that left a conflict/error backs off before the next pass.
  const drainSaves = useCallback(
    async (targetPresentationId: string) => {
      if (isSavingRef.current) return
      if (!hasDrainablePending()) return
      isSavingRef.current = true
      setSaveState('saving')

      let hadError = false
      try {
        for (let pass = 0; pass < MAX_DRAIN_PASSES; pass++) {
          // After the first pass, only keep looping while we're still the
          // on-screen deck. A flush-on-presentation-change drains the old deck's
          // captured pending once (correct target) then stops — re-reading pending
          // would pick up the NEW deck's edits and mis-save them to the old deck.
          if (pass > 0 && targetPresentationId !== presentationIdRef.current) break
          const jobs = buildJobs()
          if (jobs.length === 0) break
          const result = await runNarrationSaves(targetPresentationId, jobs)
          hadError = result.hadError
          if (result.hadError || result.hadConflict) {
            await new Promise((resolve) => setTimeout(resolve, DRAIN_BACKOFF_MS))
          }
        }
      } finally {
        isSavingRef.current = false
      }

      // Only own the UI state if we're still the on-screen deck — a drain that was
      // flushing a since-swapped deck must not stomp the current deck's state.
      if (targetPresentationId !== presentationIdRef.current) return

      if (hasDrainablePending()) {
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
    [hasDrainablePending, buildJobs, runNarrationSaves, scheduleDrainRetry],
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

  // Flush straight away when the presentation changes / panel unmounts. The
  // narration PATCH is addressed by stable slide_id, so the flush resolves
  // against the right deck (targetPresentationId) without an index map — and
  // updatedAtRef still holds this deck's token at cleanup time (reset runs after).
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (presentationId) flushPending(presentationId)
    }
  }, [presentationId, flushPending])

  useEffect(() => {
    return () => {
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current)
      if (drainRetryTimerRef.current) clearTimeout(drainRetryTimerRef.current)
    }
  }, [])

  const handleFieldChange = useCallback((field: DirtyField, value: string) => {
    const slideIndex = currentSlideIndex
    const slideId = slideIdsRef.current[slideIndex] ?? `idx:${slideIndex}`
    editedFieldsRef.current.add(`${slideId}:${field}`)
    const set = pendingRef.current.get(slideId) ?? new Set<DirtyField>()
    set.add(field)
    pendingRef.current.set(slideId, set)
    setDrafts((prev) => ({
      ...prev,
      [slideId]: { ...(prev[slideId] ?? emptyDraft()), [field]: value },
    }))
    scheduleSave()
  }, [currentSlideIndex, scheduleSave])

  // --- Render ---------------------------------------------------------------
  const currentSlideId = effectiveSlideIds[currentSlideIndex] ?? `idx:${currentSlideIndex}`
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
        <div className="flex-shrink-0 h-60 border-t border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 flex flex-col">
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

            <TabsContent value="script" className="flex-1 min-h-0 mt-2">
              <Textarea
                value={draft.script}
                onChange={(e) => handleFieldChange('script', e.target.value)}
                disabled={disabled}
                placeholder="Write the spoken narration for this slide…"
                className="h-full min-h-0 resize-none text-sm"
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
          </Tabs>
        </div>
      )}
    </>
  )
}

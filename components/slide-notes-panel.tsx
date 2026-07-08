"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { getPresentation, updateSlideFields, SlideNarrationFields } from '@/lib/layout-service-client'

// localStorage keys for panel UI state (shared across sessions)
const COLLAPSED_STORAGE_KEY = 'deckster.notesPanel.collapsed'
const TAB_STORAGE_KEY = 'deckster.notesPanel.tab'

// Debounced autosave interval for textarea edits
const SAVE_DEBOUNCE_MS = 800
// How long the "Saved" affordance stays visible after a successful save
const SAVED_INDICATOR_MS = 2000

type NotesTab = 'script' | 'notes' | 'references'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

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
 * expanded = Radix tabs with per-slide textareas and debounced autosave to
 * the Layout Service (PUT /api/presentations/{id}/slides/{idx}).
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

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Full reset when the presentation itself changes
  useEffect(() => {
    editedFieldsRef.current = new Set()
    pendingRef.current = new Map()
    setDrafts({})
    setSlideIds([])
    setSaveState('idle')
  }, [presentationId])

  // Authoritative read: GET the deck JSON from the Layout Service on mount,
  // presentation change, or whenever the slide list length changes (slides
  // added / removed). Refreshes the id↔index map and fills any field the user
  // hasn't edited — all keyed by stable slide_id.
  useEffect(() => {
    if (!presentationId) return

    let cancelled = false
    getPresentation(presentationId).then((presentation) => {
      if (cancelled || !presentation) return
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
    })

    return () => {
      cancelled = true
    }
  }, [presentationId, slideListLength])

  // --- Saving --------------------------------------------------------------
  // `ids` is the index→slide_id map for `targetPresentationId` — passed in so a
  // flush-on-presentation-change resolves against the deck it's actually writing
  // to, not whatever deck is on screen now.
  const flushPending = useCallback((targetPresentationId: string, ids: string[]) => {
    const pending = pendingRef.current
    if (pending.size === 0) return
    pendingRef.current = new Map()

    // Resolve each dirty slide_id to its CURRENT numeric index — the PUT target
    // (the Layout Service is index-based). Mapping at flush time is what makes a
    // reorder/delete land on the right slide.
    const indexById = new Map<string, number>()
    ids.forEach((id, index) => {
      if (!indexById.has(id)) indexById.set(id, index)
    })

    const jobs: Array<{ slideId: string; slideIndex: number; fields: SlideNarrationFields }> = []
    pending.forEach((fields, slideId) => {
      const slideIndex = indexById.get(slideId)
      const draft = draftsRef.current[slideId]
      if (slideIndex === undefined || !draft) {
        // Can't resolve id→index yet (deck fetch still pending) — re-queue so a
        // later flush retries rather than dropping the edit.
        pendingRef.current.set(slideId, fields)
        return
      }
      const payload: SlideNarrationFields = {}
      if (fields.has('script')) payload.script = draft.script
      if (fields.has('notes')) payload.speaker_notes = draft.notes
      if (fields.has('references')) payload.references = textToReferences(draft.references)
      if (Object.keys(payload).length > 0) jobs.push({ slideId, slideIndex, fields: payload })
    })
    if (jobs.length === 0) return

    setSaveState('saving')
    Promise.all(
      jobs.map(({ slideIndex, fields }) =>
        updateSlideFields(targetPresentationId, slideIndex, fields)
      )
    ).then((results) => {
      const failed = results.find((result) => result?.success === false)
      if (failed) {
        setSaveState('error')
        toast({
          title: 'Failed to save notes',
          description: failed.error?.message || 'Your latest edits could not be saved. They will retry on your next change.',
          variant: 'destructive',
        })
        // Re-queue the failed fields (by slide_id) so the next edit retries them
        jobs.forEach(({ slideId, fields }) => {
          const set = pendingRef.current.get(slideId) ?? new Set<DirtyField>()
          if (fields.script !== undefined) set.add('script')
          if (fields.speaker_notes !== undefined) set.add('notes')
          if (fields.references !== undefined) set.add('references')
          pendingRef.current.set(slideId, set)
        })
        return
      }
      setSaveState('saved')
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current)
      savedIndicatorRef.current = setTimeout(() => {
        setSaveState((prev) => (prev === 'saved' ? 'idle' : prev))
      }, SAVED_INDICATOR_MS)
    })
  }, [toast])

  const scheduleSave = useCallback(() => {
    if (!presentationId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      // Live map — the debounced save always targets the on-screen presentation
      flushPending(presentationId, slideIdsRef.current)
    }, SAVE_DEBOUNCE_MS)
  }, [presentationId, flushPending])

  // Flush straight away when the presentation changes / panel unmounts. Capture
  // the id map for THIS presentation at setup so the cleanup (which runs after
  // the new presentation's props have landed) still resolves against this deck.
  useEffect(() => {
    const idsForThisDeck = slideIdsRef.current
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (presentationId) flushPending(presentationId, idsForThisDeck)
    }
  }, [presentationId, flushPending])

  useEffect(() => {
    return () => {
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current)
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

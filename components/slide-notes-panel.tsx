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
  // drafts: what the textareas show, keyed by 0-based slide index
  const [drafts, setDrafts] = useState<Record<number, SlideNarrationDraft>>({})
  // Fields the user has touched — the authoritative fetch must not clobber these
  const editedFieldsRef = useRef<Set<string>>(new Set())
  // Dirty fields awaiting a save, per slide index
  const pendingRef = useRef<Map<number, Set<DirtyField>>>(new Map())
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // WS fallback: speaker_notes already travel on slideStructure
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

  // Authoritative read: GET the deck JSON from the Layout Service on
  // mount / presentation change. Fills any field the user hasn't edited.
  useEffect(() => {
    // Reset per-presentation state
    editedFieldsRef.current = new Set()
    pendingRef.current = new Map()
    setDrafts({})
    setSaveState('idle')

    if (!presentationId) return

    let cancelled = false
    getPresentation(presentationId).then((presentation) => {
      if (cancelled || !presentation) return
      const slides = Array.isArray(presentation.slides) ? presentation.slides : []
      setDrafts((prev) => {
        const next: Record<number, SlideNarrationDraft> = { ...prev }
        slides.forEach((slide: any, index: number) => {
          const draft = { ...(next[index] ?? emptyDraft()) }
          const edited = editedFieldsRef.current
          if (!edited.has(`${index}:script`)) {
            draft.script = typeof slide?.script === 'string' ? slide.script : ''
          }
          if (!edited.has(`${index}:notes`)) {
            // Lazy migration: lift content.speaker_notes when top-level is empty
            draft.notes =
              (typeof slide?.speaker_notes === 'string' && slide.speaker_notes) ||
              (typeof slide?.content?.speaker_notes === 'string' && slide.content.speaker_notes) ||
              ''
          }
          if (!edited.has(`${index}:references`)) {
            draft.references = referencesToText(slide?.references)
          }
          next[index] = draft
        })
        return next
      })
    })

    return () => {
      cancelled = true
    }
  }, [presentationId])

  // --- Saving --------------------------------------------------------------
  const flushPending = useCallback((targetPresentationId: string) => {
    const pending = pendingRef.current
    if (pending.size === 0) return
    pendingRef.current = new Map()

    const jobs: Array<{ slideIndex: number; fields: SlideNarrationFields }> = []
    pending.forEach((fields, slideIndex) => {
      const draft = draftsRef.current[slideIndex]
      if (!draft) return
      const payload: SlideNarrationFields = {}
      if (fields.has('script')) payload.script = draft.script
      if (fields.has('notes')) payload.speaker_notes = draft.notes
      if (fields.has('references')) payload.references = textToReferences(draft.references)
      if (Object.keys(payload).length > 0) jobs.push({ slideIndex, fields: payload })
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
        // Re-queue the failed fields so the next edit retries them
        jobs.forEach(({ slideIndex, fields }) => {
          const set = pendingRef.current.get(slideIndex) ?? new Set<DirtyField>()
          if (fields.script !== undefined) set.add('script')
          if (fields.speaker_notes !== undefined) set.add('notes')
          if (fields.references !== undefined) set.add('references')
          pendingRef.current.set(slideIndex, set)
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
      flushPending(presentationId)
    }, SAVE_DEBOUNCE_MS)
  }, [presentationId, flushPending])

  // Flush straight away when the presentation changes / panel unmounts
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (presentationId) flushPending(presentationId)
    }
  }, [presentationId, flushPending])

  useEffect(() => {
    return () => {
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current)
    }
  }, [])

  const handleFieldChange = useCallback((field: DirtyField, value: string) => {
    const slideIndex = currentSlideIndex
    editedFieldsRef.current.add(`${slideIndex}:${field}`)
    const set = pendingRef.current.get(slideIndex) ?? new Set<DirtyField>()
    set.add(field)
    pendingRef.current.set(slideIndex, set)
    setDrafts((prev) => ({
      ...prev,
      [slideIndex]: { ...(prev[slideIndex] ?? emptyDraft()), [field]: value },
    }))
    scheduleSave()
  }, [currentSlideIndex, scheduleSave])

  // --- Render ---------------------------------------------------------------
  const draft = drafts[currentSlideIndex] ?? emptyDraft()
  // WS fallback only applies while the user hasn't touched the field and the
  // deck JSON gave us nothing (otherwise clearing the textarea would resurrect it)
  const notesValue = editedFieldsRef.current.has(`${currentSlideIndex}:notes`)
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

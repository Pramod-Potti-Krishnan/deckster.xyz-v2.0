"use client"

// J2 v2 scaffold: the generate-first Add Slide pop-up body (flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED).
// State, copy and the request seam live in lib/studio-add-slide-v2.ts; this file only draws them.
// It makes no backend call itself: `submit` is a prop, and without one the Generate button stays disabled.
import './studio-add-slide-v2.css'
import { useEffect, useId, useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react'
import { Plus, Sparkles, Square, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { FALLBACK_THEME_PRESETS } from '@/lib/theme-builder'
import {
  ADD_SLIDE_V2_BLANK_LABEL,
  ADD_SLIDE_V2_BLOCKER_COPY,
  ADD_SLIDE_V2_CONTENT_SUBTYPES,
  ADD_SLIDE_V2_PROMPT_LABEL,
  ADD_SLIDE_V2_SLIDE_TYPES,
  addSlideV2Blocker,
  addSlideV2DraftKey,
  addSlideV2PlacementNote,
  buildAddSlideV2Request,
  clearAddSlideV2Draft,
  describeAddSlideV2Research,
  describeAddSlideV2Theme,
  initialAddSlideV2Draft,
  isPristineAddSlideV2Draft,
  loadAddSlideV2Draft,
  reduceAddSlideV2Draft,
  saveAddSlideV2Draft,
  type AddSlideV2Context,
  type AddSlideV2Draft,
  type AddSlideV2DraftStorage,
  type AddSlideV2EntryConfig,
  type AddSlideV2Submit,
} from '@/lib/studio-add-slide-v2'

export interface AddSlideV2PanelProps<TTheme = unknown> {
  context: AddSlideV2Context<TTheme>
  /** Supplied by the builder page when the composer and its async mode are on. Absent = Generate stays disabled. */
  submit?: AddSlideV2Submit<TTheme>
  /** P6: the existing blank-slide insert path. A refusal ({ ok: false }) keeps the pop-up open and shows its message. */
  onInsertBlank: () => void | Promise<void | { ok: false; message: string }>
  onClose: () => void
  disabled?: boolean
  /** Test and preview seam: a draft that wins over the stored one. */
  initialDraft?: AddSlideV2Draft
  /** sessionStorage-like store for the draft. Default: the browser's sessionStorage; null = nothing is kept. */
  storage?: AddSlideV2DraftStorage | null
}

// Reading the property itself can throw (blocked site data), so it is guarded like every other access.
function browserSessionStorage(): AddSlideV2DraftStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function AddSlideV2Panel<TTheme = unknown>({
  context,
  submit,
  onInsertBlank,
  onClose,
  disabled = false,
  initialDraft,
  storage: storageProp,
}: AddSlideV2PanelProps<TTheme>) {
  const [storage] = useState(() => (storageProp === undefined ? browserSessionStorage() : storageProp))
  const draftKey = addSlideV2DraftKey(context.sessionId, context.presentationId)
  const [draft, dispatch] = useReducer(reduceAddSlideV2Draft, undefined, () => initialDraft ?? loadAddSlideV2Draft(storage, draftKey))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ids = useId()
  const textId = `${ids}-text`
  const hintId = `${ids}-hint`
  const blocker = addSlideV2Blocker(draft, context, Boolean(submit))
  const busy = disabled || pending
  const researchRows = describeAddSlideV2Research(context.research)
  const dirty = !isPristineAddSlideV2Draft(draft)

  // Keep the draft across closing the pop-up; it clears only after a successful Generate or an explicit Discard.
  useEffect(() => { saveAddSlideV2Draft(storage, draftKey, draft) }, [storage, draftKey, draft])

  function discard() {
    dispatch({ type: 'reset' })
    clearAddSlideV2Draft(storage, draftKey)
    setError(null)
  }

  async function insertBlank() {
    if (busy) return
    const outcome = await onInsertBlank()
    if (outcome && outcome.ok === false) setError(outcome.message)
  }

  async function generate() {
    if (busy || blocker) return
    const request = buildAddSlideV2Request(draft, context)
    if (!submit || !request) return
    setPending(true)
    setError(null)
    try {
      const result = await submit(request)
      if (result.ok) {
        dispatch({ type: 'reset' })
        clearAddSlideV2Draft(storage, draftKey)
        onClose()
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Slide generation failed.')
    } finally {
      setPending(false)
    }
  }

  function onTextKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void generate()
    }
  }

  return (
    <div className="asv2">
      <header className="asv2-heading">
        <div>
          <h2>Add a slide</h2>
          <p>{addSlideV2PlacementNote(context.currentSlide)}</p>
        </div>
        <button type="button" className="asv2-close" aria-label="Close add slide" onClick={onClose}><X size={14} /></button>
      </header>

      <div className="asv2-body">
        <fieldset className="asv2-group">
          <legend>Slide type</legend>
          <div className="asv2-choices asv2-types">
            {ADD_SLIDE_V2_SLIDE_TYPES.map(option => (
              <label key={option.value} className="asv2-choice" title={option.hint}>
                <input
                  type="radio"
                  name={`${ids}-type`}
                  value={option.value}
                  checked={draft.slideType === option.value}
                  disabled={busy}
                  onChange={() => dispatch({ type: 'set_slide_type', value: option.value })}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {draft.slideType === 'content' && (
          <fieldset className="asv2-group">
            <legend>Content style</legend>
            <div className="asv2-choices asv2-subtypes">
              {ADD_SLIDE_V2_CONTENT_SUBTYPES.map(option => (
                <label key={option.value} className="asv2-choice" title={option.hint}>
                  <input
                    type="radio"
                    name={`${ids}-subtype`}
                    value={option.value}
                    checked={draft.contentSubtype === option.value}
                    disabled={busy}
                    onChange={() => dispatch({ type: 'set_content_subtype', value: option.value })}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="asv2-group">
          <label className="asv2-label" htmlFor={textId}>{ADD_SLIDE_V2_PROMPT_LABEL}</label>
          <textarea
            id={textId}
            className="asv2-text"
            rows={4}
            value={draft.text}
            disabled={busy}
            placeholder="e.g. Why a phased rollout beats a big-bang launch, with the three milestones"
            aria-describedby={hintId}
            onChange={event => dispatch({ type: 'set_text', value: event.target.value })}
            onKeyDown={onTextKeyDown}
          />
          <p id={hintId} className="asv2-hint">Everything else is chosen for you unless you set it above.</p>
        </div>

        <section className="asv2-chat" aria-label="Settings from your chat">
          <h3>Follows your chat settings</h3>
          <dl>
            <div>
              <dt>Research</dt>
              <dd>
                <ul>
                  {researchRows.map(row => (
                    <li key={row.key} data-on={row.on ? 'true' : 'false'}>{row.label} <b>{row.on ? 'on' : 'off'}</b></li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt>Theme</dt>
              <dd>{context.themeLabel}</dd>
            </div>
          </dl>
        </section>

        {error && <p className="asv2-error" role="alert">{error}</p>}

        <div className="asv2-actions">
          <button
            type="button"
            className="asv2-generate"
            disabled={busy || Boolean(blocker)}
            aria-describedby={blocker ? `${ids}-blocker` : undefined}
            onClick={() => void generate()}
          >
            <Sparkles size={14} aria-hidden="true" />{pending ? 'Generating…' : 'Generate slide'}
          </button>
          {dirty && <button type="button" className="asv2-discard" disabled={busy} onClick={discard}>Discard draft</button>}
          {blocker && <p id={`${ids}-blocker`} className="asv2-blocker" data-blocker={blocker}>{ADD_SLIDE_V2_BLOCKER_COPY[blocker]}</p>}
        </div>
      </div>

      <footer className="asv2-footer">
        <span>Or start empty</span>
        <button type="button" className="asv2-blank" disabled={busy} onClick={() => void insertBlank()}>
          <Square size={13} aria-hidden="true" />{ADD_SLIDE_V2_BLANK_LABEL}
        </button>
      </footer>
    </div>
  )
}

export interface AddSlideV2EntryProps<TTheme = unknown> {
  config: AddSlideV2EntryConfig<TTheme>
  disabled?: boolean
  /** The picker is mid-insert (blank slide); same "Adding" state as today. */
  isAdding?: boolean
  className?: string
  /** P6: the existing blank-slide insert path; `position` is the real Layout position when placeholders are in play. */
  onInsertBlank: (position?: number) => void | Promise<void>
}

/** The flag-on Add Slide entry: the toolbar button plus the generate-first pop-up. */
export function AddSlideV2Entry<TTheme = unknown>({
  config,
  disabled = false,
  isAdding = false,
  className = '',
  onInsertBlank,
}: AddSlideV2EntryProps<TTheme>) {
  const [open, setOpen] = useState(false)
  const [portalContainer, setPortalContainer] = useState<Element | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const { settings, currentSlide, slideCount, theme } = config
  const context = useMemo<AddSlideV2Context<TTheme>>(() => ({
    sessionId: settings.sessionId,
    presentationId: settings.presentationId,
    currentSlide,
    slideCount,
    research: settings.research,
    theme,
    themeLabel: describeAddSlideV2Theme(theme as { mode?: string; preset_id?: string; primary_hex?: string }, settings.themeProfileName, FALLBACK_THEME_PRESETS),
  }), [settings.sessionId, settings.presentationId, settings.research, settings.themeProfileName, currentSlide, slideCount, theme])

  return (
    <Popover open={open} onOpenChange={nextOpen => {
      setPortalContainer(nextOpen ? document.fullscreenElement : null)
      setOpen(nextOpen)
    }}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled || isAdding}
          className={cn(
            "flex h-12 min-w-[88px] flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 text-slate-700 dark:text-slate-200",
            "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
            className
          )}
        >
          <Plus className="h-5 w-5" />
          <span className="text-[10px] font-medium whitespace-nowrap">{isAdding ? 'Adding' : 'Add Slide'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        portalContainer={portalContainer}
        data-studio-add-slide-v2="true"
        align="start"
        sideOffset={8}
        aria-label="Add a slide"
        onOpenAutoFocus={event => {
          // Generation is the default path, so land in the one text box.
          event.preventDefault()
          contentRef.current?.querySelector('textarea')?.focus()
        }}
      >
        <AddSlideV2Panel
          key={addSlideV2DraftKey(context.sessionId, context.presentationId)}
          context={context}
          submit={settings.submit}
          disabled={disabled || isAdding}
          onClose={() => setOpen(false)}
          onInsertBlank={async () => {
            // Same resolution as Generate; a placeholder on screen has no real position, so refuse and say why.
            const target = settings.resolveBlankTarget?.(Math.max(0, currentSlide - 1)) ?? { ok: true as const, position: undefined }
            if (!target.ok) return { ok: false as const, message: target.message }
            setOpen(false)
            await onInsertBlank(target.position)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

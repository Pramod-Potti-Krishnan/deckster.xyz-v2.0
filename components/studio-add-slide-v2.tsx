"use client"

// J2 v2: the generate-first Add Slide SIDE PANEL (flag NEXT_PUBLIC_STUDIO_ADD_SLIDE_V2_ENABLED).
// It renders inside the Element drawer, in the same frame and with the same panel markers as the Add Element
// generation panel (data-studio-v4-panel / -header / -context / -fields), through a portal into a host the builder
// page provides. State, copy, options and the request seam live in lib/studio-add-slide-v2.ts; this file draws them.
// It makes no backend call itself: `submit` is a prop, and without one the Generate button stays disabled.
import '@/components/builder/studio-panels.css'
import './studio-add-slide-v2.css'
import { createPortal } from 'react-dom'
import { useEffect, useId, useMemo, useReducer, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Layout, Plus, Sparkles, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FALLBACK_THEME_PRESETS } from '@/lib/theme-builder'
import {
  ADD_SLIDE_V2_BLANK_LABEL,
  ADD_SLIDE_V2_BLOCKER_COPY,
  ADD_SLIDE_V2_CATALOG_LABEL,
  ADD_SLIDE_V2_OPTIONS,
  ADD_SLIDE_V2_PROMPT_LABEL,
  addSlideV2Blocker,
  addSlideV2BlankNativeOptions,
  addSlideV2DraftKey,
  addSlideV2PlacementNote,
  availableAddSlideV2Subtypes,
  availableAddSlideV2Types,
  buildAddSlideV2Request,
  clearAddSlideV2Draft,
  describeAddSlideV2Research,
  describeAddSlideV2Theme,
  isPristineAddSlideV2Draft,
  loadAddSlideV2Draft,
  reduceAddSlideV2Draft,
  saveAddSlideV2Draft,
  type AddSlideV2Context,
  type AddSlideV2Draft,
  type AddSlideV2DraftStorage,
  type AddSlideV2EntryConfig,
  type AddSlideV2NativeAddOptions,
  type AddSlideV2Submit,
} from '@/lib/studio-add-slide-v2'

export interface AddSlideV2PanelProps<TTheme = unknown> {
  context: AddSlideV2Context<TTheme>
  /** Supplied by the builder page when the composer and its async mode are on. Absent = Generate stays disabled. */
  submit?: AddSlideV2Submit<TTheme>
  /** P6: the existing blank-slide insert path. A refusal ({ ok: false }) shows its message and keeps the draft. */
  onInsertBlank: () => void | Promise<void | { ok: false; message: string }>
  onClose: () => void
  /** DEC-P1: opens the classic layout picker. Absent (or the `catalog` option off) = no link. */
  onBrowseCatalog?: () => void
  disabled?: boolean
  /** Test and preview seam: a draft that wins over the stored one. */
  initialDraft?: AddSlideV2Draft
  /** sessionStorage-like store for the draft. Default: the browser's sessionStorage; null = nothing is kept. */
  storage?: AddSlideV2DraftStorage | null
  /** The options that are shown (default: the build's kill-switch resolution). */
  options?: ReadonlySet<string>
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
  onBrowseCatalog,
  disabled = false,
  initialDraft,
  storage: storageProp,
  options = ADD_SLIDE_V2_OPTIONS,
}: AddSlideV2PanelProps<TTheme>) {
  const [storage] = useState(() => (storageProp === undefined ? browserSessionStorage() : storageProp))
  const draftKey = addSlideV2DraftKey(context.sessionId, context.presentationId)
  const reducer = useMemo(() => (state: AddSlideV2Draft, action: Parameters<typeof reduceAddSlideV2Draft>[1]) => reduceAddSlideV2Draft(state, action, options), [options])
  const [draft, dispatch] = useReducer(reducer, undefined, () => initialDraft ?? loadAddSlideV2Draft(storage, draftKey, options))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queued, setQueued] = useState<string | null>(null)
  const ids = useId()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const textId = `${ids}-text`
  const hintId = `${ids}-hint`
  const types = availableAddSlideV2Types(options)
  const styles = availableAddSlideV2Subtypes(options)
  const blocker = addSlideV2Blocker(draft, context, Boolean(submit), options)
  const busy = disabled || pending
  const diagram = draft.slideType === 'content' && draft.contentSubtype === 'diagram'
  const researchRows = describeAddSlideV2Research(context.research).map(row => diagram ? { ...row, on: false } : row)
  const dirty = !isPristineAddSlideV2Draft(draft, options)
  const showBlank = options.has('blank')
  const showCatalog = options.has('catalog') && Boolean(onBrowseCatalog)

  // Generation is the default path, so land in the one text box when the panel opens.
  useEffect(() => { textRef.current?.focus() }, [])

  // Keep the draft across closing the panel; it clears only after a successful Generate or an explicit Discard.
  useEffect(() => { saveAddSlideV2Draft(storage, draftKey, draft, options) }, [storage, draftKey, draft, options])

  // An error or a "Queued" note belongs to the slide it was raised on: the panel stays open while the user moves
  // between slides (or the viewer follows a new one), so both clear when the current slide changes.
  useEffect(() => {
    setError(null)
    setQueued(null)
  }, [context.currentSlide])

  function discard() {
    dispatch({ type: 'reset' })
    clearAddSlideV2Draft(storage, draftKey)
    setError(null)
    setQueued(null)
  }

  async function insertBlank() {
    if (busy) return
    setQueued(null)
    const outcome = await onInsertBlank()
    if (outcome && outcome.ok === false) setError(outcome.message)
  }

  async function generate() {
    if (busy || blocker) return
    const request = buildAddSlideV2Request(draft, context, options)
    if (!submit || !request) return
    setPending(true)
    setError(null)
    setQueued(null)
    try {
      const result = await submit(request)
      if (result.ok) {
        dispatch({ type: 'reset' })
        clearAddSlideV2Draft(storage, draftKey)
        // The panel stays open so several slides can be queued; it says where this one lands.
        setQueued(`Queued. It appears right after slide ${context.currentSlide} when it is ready.`)
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
    <div className="absolute inset-0 z-20 flex pointer-events-none">
      <div
        data-studio-v4-panel="add-slide-generation"
        data-studio-add-slide-v2="true"
        className="asv2 flex-1 bg-white dark:bg-slate-900 flex flex-col shadow-2xl overflow-hidden pointer-events-auto"
        onKeyDown={event => { if (event.key === 'Escape' && !pending) onClose() }}
      >
        <div data-studio-v4-panel-header className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Layout className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h3 className="max-w-[300px] truncate text-xs font-semibold text-gray-900 dark:text-slate-100">Add slide</h3>
              <p className="text-[10px] text-gray-500 dark:text-slate-400">Generate a slide, or start blank</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close add slide panel"
            onClick={onClose}
            className="asv2-close p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-700 transition-colors"
            title="Close panel"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        <div data-studio-v4-panel-context className="px-3 py-1.5 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-800">{addSlideV2PlacementNote(context.currentSlide)}</p>
        </div>

        <div data-studio-v4-panel-fields className="asv2-body flex-1 overflow-y-auto px-3 py-3">
          {types.length > 0 && (
            <fieldset className="asv2-group">
              <legend>Slide type</legend>
              <div className="asv2-choices asv2-types">
                {types.map(option => (
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
          )}

          {draft.slideType === 'content' && styles.length > 0 && (
            <fieldset className="asv2-group">
              <legend>Content style</legend>
              <div className="asv2-choices asv2-subtypes">
                {styles.map(option => (
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
              ref={textRef}
              className="asv2-text"
              rows={4}
              value={draft.text}
              disabled={busy}
              placeholder="e.g. Why a phased rollout beats a big-bang launch, with the three milestones"
              aria-describedby={hintId}
              onChange={event => { setQueued(null); setError(null); dispatch({ type: 'set_text', value: event.target.value }) }}
              onKeyDown={onTextKeyDown}
            />
            <p id={hintId} className="asv2-hint">Everything else is chosen for you unless you set it above.</p>
          </div>

          <section className="asv2-chat" aria-label="Settings from your chat">
            <h4>Follows your chat settings</h4>
            <dl>
              <div>
                <dt>Research</dt>
                <dd>
                  <ul>
                    {researchRows.map(row => (
                      <li key={row.key} data-on={row.on ? 'true' : 'false'}>{row.label} <b>{row.on ? 'on' : 'off'}</b></li>
                    ))}
                  </ul>
                  {diagram && <p className="asv2-note">Diagrams are built without research.</p>}
                </dd>
              </div>
              <div>
                <dt>Theme</dt>
                <dd>{context.themeLabel}</dd>
              </div>
            </dl>
          </section>

          {error && <p className="asv2-error" role="alert">{error}</p>}
          {queued && <p className="asv2-queued" role="status">{queued}</p>}

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

        {(showBlank || showCatalog) && (
          <footer className="asv2-footer">
            {showBlank ? <span>Or start empty</span> : <span />}
            <div className="asv2-footer-actions">
              {showBlank && (
                <button type="button" className="asv2-blank" disabled={busy} onClick={() => void insertBlank()}>
                  <Square size={13} aria-hidden="true" />{ADD_SLIDE_V2_BLANK_LABEL}
                </button>
              )}
              {showCatalog && (
                <button type="button" className="asv2-catalog" disabled={busy} onClick={() => onBrowseCatalog?.()}>{ADD_SLIDE_V2_CATALOG_LABEL}</button>
              )}
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}

export interface AddSlideV2EntryProps<TTheme = unknown> {
  config: AddSlideV2EntryConfig<TTheme>
  disabled?: boolean
  className?: string
  /** The viewer's native Add (the picker's onAddSlide). The Blank slide goes through it. */
  onAddSlide: (layoutId: 'B1-blank', options?: AddSlideV2NativeAddOptions) => Promise<void>
  /** DEC-P1: the classic layout picker, kept mounted but invisible so the panel's link can open it where it always opened. */
  classicPicker?: ReactNode
  options?: ReadonlySet<string>
}

/** The flag-on Add Slide entry: the toolbar button, and the panel rendered into the Element drawer host. */
export function AddSlideV2Entry<TTheme = unknown>({
  config,
  disabled = false,
  className = '',
  onAddSlide,
  classicPicker,
  options = ADD_SLIDE_V2_OPTIONS,
}: AddSlideV2EntryProps<TTheme>) {
  const [adding, setAdding] = useState(false)
  const catalogRef = useRef<HTMLSpanElement>(null)
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
  const panelOpen = settings.panelOpen && Boolean(settings.panelHost)

  // Same resolution as Generate; a placeholder on screen has no real position, so refuse and say why.
  async function insertBlank() {
    const target = settings.resolveBlankTarget?.(Math.max(0, currentSlide - 1)) ?? { ok: true as const, position: undefined }
    if (!target.ok) return { ok: false as const, message: target.message }
    setAdding(true)
    try {
      await onAddSlide('B1-blank', addSlideV2BlankNativeOptions(target.position, options))
    } finally {
      setAdding(false)
    }
  }

  return (
    <span className="asv2-entry">
      <button
        type="button"
        disabled={disabled || adding}
        aria-expanded={settings.panelOpen}
        aria-pressed={settings.panelOpen}
        onClick={() => settings.onPanelOpenChange(!settings.panelOpen)}
        className={cn(
          "flex h-12 min-w-[88px] flex-col items-center justify-center gap-0.5 rounded-md px-3 py-1 text-slate-700 dark:text-slate-200",
          "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors",
          settings.panelOpen && "bg-slate-100 dark:bg-slate-800",
          className
        )}
      >
        <Plus className="h-5 w-5" />
        <span className="text-[10px] font-medium whitespace-nowrap">{adding ? 'Adding' : 'Add Slide'}</span>
      </button>
      {classicPicker && <span ref={catalogRef} aria-hidden="true" className="asv2-catalog-anchor">{classicPicker}</span>}
      {panelOpen && settings.panelHost && createPortal(
        <AddSlideV2Panel
          key={addSlideV2DraftKey(context.sessionId, context.presentationId)}
          context={context}
          submit={settings.submit}
          disabled={disabled || adding}
          options={options}
          onClose={() => settings.onPanelOpenChange(false)}
          onBrowseCatalog={classicPicker ? () => catalogRef.current?.querySelector('button')?.click() : undefined}
          onInsertBlank={insertBlank}
        />,
        settings.panelHost,
      )}
    </span>
  )
}

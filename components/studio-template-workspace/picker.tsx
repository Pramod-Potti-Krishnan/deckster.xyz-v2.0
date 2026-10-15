"use client"

// PASS2-PK-FOUR item 4 (flag NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE, default off): Template ▾ next to Theme (frame 3b). The mockup's
// "Start from a template" popover, extended: search, "Your templates" (uploads: ready ones, and ones still locking with "Locking 12/18 ·
// as-is ready"), a live preview, the choice between New topic and Reuse as-is, and "Upload a template (.pptx)". Picking a template
// creates a NEW deck (PK, Q3). It shares the theme dropdown's search rule and keyboard model (#372, PK Q11): every typed word must
// appear in the name, arrows move, Enter picks, Escape closes.
// Replaces the toolbar's Template menu with the flag on; that menu's "Save Template" and "Template Mode" stay here as footer links.
//
// Fix-forward (same flag): with the composer library on, "Your templates" also lists the library's own templates (the uploads the composer's
// template popup and the library dialog list: the dialog's own `composerRequest('templates')`, read through `loadComposerTemplates`, as that popup
// reads it). A composer template has the library dialog's actions (Use original, Rebuild from own content, New topic), which the page hands to
// the dialog to run with its own handlers (`onComposerTemplateAction`, the same callback the composer's template popup uses). "Template library"
// opens that dialog, and /studio/templates is linked only where that page works. An empty list says why in plain words.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, ChevronDown, LayoutTemplate, Save, Search, Sparkles, Upload, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { themeDropdownMatches } from '@/components/theme-dropdown-picker'
import { cn } from '@/lib/utils'
import { composerTemplateActions, composerTemplateSlideCount, loadComposerTemplates, templateLibraryTarget, type ComposerLibraryRequest } from '@/lib/studio-composer-popups'
import type { ComposerTemplate } from '@/lib/composer-library'
import { templateNameFromFile } from '@/lib/studio-template-workspace/registry'
import { studioTemplateShownName, studioTemplateTitleProps } from '@/lib/studio-template-display-name'
import { templateCapabilities, templateWorkspaceCounts } from '@/lib/studio-template-workspace/state'
import type { TemplateWorkspaceSnapshot } from '@/lib/studio-template-workspace/adapter'
import { SlideView, uploadedAgo, useTemplateWorkspaceRecords, useTemplateWorkspaceSnapshots, useTemplateWorkspaceUserKey } from './shared'

export interface StudioTemplatePickerProps {
  disabled?: boolean
  /** The toolbar's own button classes, so Template ▾ looks like its neighbours. */
  triggerClassName?: string
  labelClassName?: string
  portalContainer?: HTMLElement | null
  /** Opens the existing upload dialog; omitted when uploads are not enabled. */
  onUploadTemplate?: () => void
  /** The Template Builder's actions, kept from the old menu (only when that feature is on). */
  onSaveTemplate?: (() => void) | null
  saveTemplateDisabled?: boolean
  templateMode?: { on: boolean; available: boolean; toggle: () => void } | null
  /** Fix-forward: runs a composer library action (Use original, Rebuild, New topic) in the library dialog. Absent: no composer library, nothing is listed or requested. */
  onComposerTemplateAction?: (request: ComposerLibraryRequest) => void
  /** Fix-forward: opens the composer library dialog ("Template library"). Absent: that link goes to the Templates page, only where it works. */
  onOpenComposerLibrary?: () => void
}

// Fix-forward: the Templates page works only with saved templates connected (the page's own rule), and the library dialog's actions follow its flags.
// Read here as the dialog and the page read them.
const TEMPLATES_PAGE_ENABLED = process.env.NEXT_PUBLIC_TEMPLATE_BUILDER_ENABLED === 'true'
const COMPOSER_DITTO_ENABLED = process.env.NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED === 'true'
const COMPOSER_NEW_TOPIC_ENABLED = process.env.NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED === 'true'
/** A composer library template's key in the picker's one list; it can never equal an upload's session id. */
const COMPOSER_ROW_PREFIX = 'composer:'
// PASS2B G38 (NEXT_PUBLIC_STUDIO_TEMPLATE_DISPLAY_NAMES, default off): templates are drawn by a short display name; the full stored name stays in a tooltip and in every payload.
const TEMPLATE_DISPLAY_NAMES = process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_DISPLAY_NAMES === 'true'
const displayName = (name: string) => studioTemplateShownName(name, TEMPLATE_DISPLAY_NAMES)
const nameTitle = (name: string) => studioTemplateTitleProps(name, TEMPLATE_DISPLAY_NAMES)
type ComposerRow = { key: string; template: ComposerTemplate; name: string }

type Entry = { record: ReturnType<typeof useTemplateWorkspaceRecords>[number]; snapshot: TemplateWorkspaceSnapshot; start: ((mode: 'new_topic' | 'as_is') => Promise<string>) | null; name: string }

function metaLine(entry: Entry): ReactNode {
  const { state } = entry.snapshot
  const counts = templateWorkspaceCounts(state)
  if (state.status === 'ready') return <>{counts.total} slides · {state.ready?.layoutCount ?? 0} layouts · {uploadedAgo(entry.record.created_at)}</>
  if (state.status === 'converting') return <span className="prog">Converting…</span>
  if (state.status === 'paused') return <><span className="warn">Locking paused {counts.done}/{counts.total}</span> · as-is ready</>
  if (state.status === 'failed') return <><span className="warn">Locking stopped {counts.done}/{counts.total}</span> · as-is ready</>
  return <><span className="prog">Locking {counts.done}/{counts.total}</span> · as-is ready</>
}

/**
 * Fix-forward: the composer library's list, as the composer's template popup reads it (`loadComposerTemplates`, the library dialog's own request),
 * made under the dialog's rule: only while the popover is open and the user is signed in. Nothing is requested for `listing` false.
 */
function useComposerTemplates(listing: boolean) {
  const [templates, setTemplates] = useState<ComposerTemplate[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(0)
  const refresh = useCallback(async () => {
    const request = ++latest.current
    setLoading(true)
    setError(null)
    try {
      const listed = await loadComposerTemplates()
      if (request === latest.current) setTemplates(listed)
    } catch (reason) {
      if (request === latest.current) setError(reason instanceof Error ? reason.message : 'Could not load templates.')
    } finally {
      if (request === latest.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    if (!listing) return
    void refresh()
    return () => { latest.current += 1; setLoading(false) }
  }, [listing, refresh])
  return { templates, loading, error, refresh }
}

export function StudioTemplatePicker({ disabled, triggerClassName, labelClassName, portalContainer, onUploadTemplate, onSaveTemplate, saveTemplateDisabled, templateMode, onComposerTemplateAction, onOpenComposerLibrary }: StudioTemplatePickerProps) {
  const uid = useId()
  const userKey = useTemplateWorkspaceUserKey()
  const records = useTemplateWorkspaceRecords(userKey)
  const live = useTemplateWorkspaceSnapshots(userKey, records)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [mode, setMode] = useState<'new_topic' | 'as_is'>('new_topic')
  const [message, setMessage] = useState<string | null>(null)
  const composerList = useComposerTemplates(Boolean(onComposerTemplateAction && open && userKey))

  const entries: Entry[] = useMemo(() => live
    .filter(item => item.snapshot.state.status !== 'refused' && !(item.snapshot.state.status === 'failed' && !item.snapshot.state.deck))
    // The newest ready template first (pinned, NEW), then the rest, newest first.
    .sort((a, b) => Number(b.snapshot.state.status === 'ready') - Number(a.snapshot.state.status === 'ready') || b.record.created_at - a.record.created_at)
    .map(item => ({ record: item.record, snapshot: item.snapshot, start: item.store.commands.startDeck ?? null, name: item.snapshot.state.deck?.templateName ?? templateNameFromFile(item.record.file_name) })), [live])
  // The composer library's templates come first (they are complete and usable; an upload of this tab still locking has no action yet).
  const composerRows: ComposerRow[] = useMemo(() => (onComposerTemplateAction && userKey ? composerList.templates ?? [] : [])
    .map(template => ({ key: `${COMPOSER_ROW_PREFIX}${template.id}`, template, name: template.name })), [onComposerTemplateAction, userKey, composerList.templates])
  const visibleComposer = composerRows.filter(row => themeDropdownMatches(row.name, query))
  const visible = entries.filter(entry => themeDropdownMatches(entry.name, query))
  const visibleKeys = [...visibleComposer.map(row => row.key), ...visible.map(entry => entry.record.session_id)]
  const fallback = entries.find(entry => entry.snapshot.state.status === 'ready') ?? entries[0] ?? null
  const chosenEntry = entries.find(entry => entry.record.session_id === selectedId)
  const selectedComposer = composerRows.find(row => row.key === selectedId) ?? (chosenEntry ? null : composerRows[0] ?? null)
  const selected = selectedComposer ? null : chosenEntry ?? fallback
  const selectedKey = selectedComposer?.key ?? selected?.record.session_id
  const highlightedKey = visibleKeys.find(key => key === highlightId) ?? (query.trim() ? visibleKeys[0] : undefined)
  const caps = selected ? templateCapabilities(selected.snapshot.state) : { reuseAsIs: false, newTopic: false }
  const effectiveMode = mode === 'new_topic' && !caps.newTopic && caps.reuseAsIs ? 'as_is' : mode
  const canStart = Boolean(selected?.start) && (effectiveMode === 'new_topic' ? caps.newTopic : caps.reuseAsIs)
  const composerActions = composerTemplateActions({ ditto: COMPOSER_DITTO_ENABLED, newTopic: COMPOSER_NEW_TOPIC_ENABLED })
  const library = templateLibraryTarget({ composerLibrary: Boolean(onOpenComposerLibrary), templatesPage: TEMPLATES_PAGE_ENABLED })
  const listedCount = composerRows.length + entries.length
  // The composer list's state, in plain words (only with the composer library: without it nothing here has changed). `failed`: no answer yet, and the
  // request failed; `stale`: a refresh failed, so the last loaded list is shown.
  const composerState = !onComposerTemplateAction ? null : !userKey ? 'signed-out' as const
    : composerList.templates === null ? (composerList.error ? 'failed' as const : 'loading' as const) : composerList.error ? 'stale' as const : 'ready' as const
  const composerNote = composerState === 'loading' ? 'Loading your templates…'
    : composerState === 'failed' ? `Your templates could not be loaded: ${composerList.error}`
      : composerState === 'stale' ? `Your templates could not be refreshed: ${composerList.error} Showing the last loaded list.` : null
  const composerFailed = composerState === 'failed' || composerState === 'stale'
  const emptyText = !onComposerTemplateAction ? 'No templates yet. Upload a PowerPoint and Deckster turns it into a template you can reuse here.'
    : composerState === 'signed-out' ? 'Sign in to see your templates.'
      : composerState === 'ready' || composerState === 'stale' ? `No templates yet. Upload a PowerPoint${onOpenComposerLibrary ? ' in the template library' : ''} and Deckster turns it into a template you can reuse here.` : null

  useEffect(() => { if (!open) { setQuery(''); setHighlightId(null); setMessage(null) } }, [open])

  const chooseKey = (key: string) => { setSelectedId(key); setHighlightId(key); setMessage(null) }
  const move = (step: 1 | -1) => {
    if (!visibleKeys.length) return
    const at = Math.max(0, visibleKeys.findIndex(key => key === (highlightedKey ?? selectedKey)))
    setHighlightId(visibleKeys[(at + step + visibleKeys.length) % visibleKeys.length])
  }
  const optionId = (id: string) => `${uid}-opt-${id}`
  const start = async () => {
    if (!selected?.start || !canStart) return
    setMessage(await selected.start(effectiveMode))
  }
  // A composer template's action is handed to the library dialog, which runs it with its own handlers; the popover then closes, as the composer's does.
  const runComposerAction = (request: ComposerLibraryRequest) => { setOpen(false); onComposerTemplateAction?.(request) }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} className={cn(triggerClassName, 'stw-tool-trigger')} aria-label="Template" data-studio-v4-secondary="true" data-studio-template-picker-trigger="true">
          <LayoutTemplate className="h-5 w-5" />
          <span className={labelClassName}>Template</span>
          <ChevronDown className="chev" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent portalContainer={portalContainer ?? undefined} align="center" sideOffset={8} data-studio-v4-shell="true" data-studio-template-picker="true" className="stw-picker stw-tokens"
        onOpenAutoFocus={event => { event.preventDefault(); document.getElementById(`${uid}-search`)?.focus() }}>
        <div className="stw-picker-main">
          <div className="stw-picker-head">
            <div>
              <h3>Start from a template <span>{listedCount}</span></h3>
              <p>Creates a new presentation.</p>
            </div>
            <button type="button" className="stw-btn quiet" style={{ width: 26, height: 26, padding: 0 }} aria-label="Close" onClick={() => setOpen(false)}><X /></button>
          </div>
          <label className="stw-picker-search">
            <Search aria-hidden="true" />
            <input id={`${uid}-search`} type="text" role="combobox" aria-expanded="true" aria-controls={`${uid}-list`} aria-autocomplete="list" autoComplete="off" spellCheck={false}
              aria-activedescendant={highlightedKey ? optionId(highlightedKey) : undefined} placeholder="Search templates" value={query}
              onChange={event => { setQuery(event.target.value); setHighlightId(null) }}
              onKeyDown={event => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); move(event.key === 'ArrowDown' ? 1 : -1) }
                else if (event.key === 'Enter') { event.preventDefault(); if (highlightedKey) chooseKey(highlightedKey) }
              }} />
          </label>
          <div id={`${uid}-list`} role="listbox" aria-label="Your templates" className="stw-picker-list">
            <div className="stw-picker-group" aria-hidden="true">Your templates</div>
            {composerNote && (
              <div className={cn('stw-picker-empty', composerFailed && 'err')} role={composerFailed ? 'alert' : 'status'} data-studio-template-composer-note={composerState}>
                {composerNote}
                {composerFailed && <> <button type="button" className="stw-picker-retry" disabled={composerList.loading} onClick={() => void composerList.refresh()}>Try again</button></>}
              </div>
            )}
            {listedCount === 0 ? (
              emptyText && <div className="stw-picker-empty" {...(onComposerTemplateAction ? { 'data-studio-template-composer-note': composerState } : {})}>{emptyText}</div>
            ) : visibleKeys.length === 0 ? (
              <div className="stw-picker-empty">No templates match “{query.trim()}”.</div>
            ) : <>
              {visibleComposer.map(row => {
                const isSelected = selectedKey === row.key
                return (
                  <button key={row.key} id={optionId(row.key)} type="button" role="option" aria-selected={isSelected} data-active={highlightedKey === row.key ? 'true' : undefined}
                    className="stw-pick" title={row.name} data-studio-template-composer-option={row.template.id} onClick={() => chooseKey(row.key)} onMouseMove={() => setHighlightId(row.key)}>
                    <span className="info">
                      <span className="name"><span>{displayName(row.name)}</span></span>
                      <span className="meta">{composerTemplateSlideCount(row.template)} slides</span>
                    </span>
                    {isSelected ? <Check className="tick" aria-hidden="true" /> : <span className="tick" />}
                  </button>
                )
              })}
              {visible.map(entry => {
              const id = entry.record.session_id
              const isSelected = selectedKey === id
              const total = entry.snapshot.state.slideCount ?? 0
              const fresh = entry.snapshot.state.status === 'ready' && Date.now() - entry.record.created_at < 24 * 3600 * 1000
              return (
                <button key={id} id={optionId(id)} type="button" role="option" aria-selected={isSelected} data-active={highlightedKey === id ? 'true' : undefined}
                  className="stw-pick" onClick={() => chooseKey(id)} onMouseMove={() => setHighlightId(id)}>
                  <span className="info">
                    <span className="name"><span {...nameTitle(entry.name)}>{displayName(entry.name)}</span>{fresh && <span className="new">NEW</span>}</span>
                    <span className="meta">{metaLine(entry)}</span>
                  </span>
                  <span className="minis" aria-hidden="true">
                    {entry.snapshot.state.deck && [0, 1, 4].filter(i => i < total).map(i => <SlideView key={i} index={i} width={26} fixture={entry.snapshot.fixture} thumb />)}
                    {total > 3 && <small>+{total - 3}</small>}
                  </span>
                  {isSelected ? <Check className="tick" aria-hidden="true" /> : <span className="tick" />}
                </button>
              )
              })}
            </>}
          </div>
          <div className="stw-picker-foot">
            {selectedComposer ? (
              <div className="stw-picker-actions" role="group" aria-label={`What to do with ${displayName(selectedComposer.name)}`} data-studio-template-composer={selectedComposer.template.id}>
                {composerActions.map(({ action, label }) => (
                  <button key={action} type="button" className={cn('stw-btn', action === 'use' && 'teal')} data-studio-template-composer-action={action} disabled={!userKey}
                    onClick={() => runComposerAction({ action, template: selectedComposer.template })}>{label}{action === 'use' && <ArrowRight />}</button>
                ))}
              </div>
            ) : (
              <button type="button" className="stw-btn teal" disabled={!canStart} onClick={() => void start()}>Start presentation<ArrowRight /></button>
            )}
            {message && <span className="stw-picker-note" role="status">{message}</span>}
            <div className="stw-picker-links">
              {library === 'dialog' && <button type="button" data-studio-template-action="library" onClick={() => { setOpen(false); onOpenComposerLibrary?.() }}><LayoutTemplate />Template library</button>}
              {library === 'page' && <Link href="/studio/templates" prefetch={false}><LayoutTemplate />Template library</Link>}
              {onUploadTemplate && <button type="button" onClick={() => { setOpen(false); onUploadTemplate() }}><Upload />Upload a template (.pptx)</button>}
            </div>
            {(onSaveTemplate !== undefined || templateMode) && (
              <div className="stw-picker-links">
                {onSaveTemplate !== undefined && <button type="button" disabled={!onSaveTemplate || saveTemplateDisabled} onClick={() => { setOpen(false); onSaveTemplate?.() }}><Save />Save this deck as a template</button>}
                {templateMode && <button type="button" disabled={!templateMode.available && !templateMode.on} onClick={() => { setOpen(false); templateMode.toggle() }}><Sparkles />{templateMode.on ? 'Exit Template Mode' : 'Template Mode'}</button>}
              </div>
            )}
          </div>
        </div>
        <section className="stw-picker-prev" aria-label="Preview of the selected template">
          <span className="eyebrow">Preview</span>
          {selectedComposer ? <ComposerPreview row={selectedComposer} /> : selected ? <Preview entry={selected} mode={effectiveMode} onMode={setMode} /> : <p>Pick a template to see it here.</p>}
        </section>
      </PopoverContent>
    </Popover>
  )
}

/** Fix-forward: a composer library template in the preview. The list carries only its name and slide count, so there is no picture to show. */
function ComposerPreview({ row }: { row: ComposerRow }) {
  return (
    <>
      <h4 {...nameTitle(row.name)}>{displayName(row.name)}</h4>
      <p>{composerTemplateSlideCount(row.template)} slides · from your template library</p>
      <p>Use original opens the uploaded deck as a new presentation. Each option opens a new deck; the template library shows its progress.</p>
    </>
  )
}

function Preview({ entry, mode, onMode }: { entry: Entry; mode: 'new_topic' | 'as_is'; onMode: (mode: 'new_topic' | 'as_is') => void }) {
  const { state, fixture } = entry.snapshot
  const counts = templateWorkspaceCounts(state)
  const caps = templateCapabilities(state)
  const total = state.slideCount ?? 0
  const minis = (state.ready?.representatives.map(rep => rep.slide_index) ?? [1, 2, 3, 4]).filter(i => i > 0 && i < total).slice(0, 4)
  const description = state.status === 'ready'
    ? `Your uploaded deck, locked into ${state.ready?.layoutCount ?? 0} layouts. Fonts, colours and logo stay exactly as designed.${counts.kept ? ` ${counts.kept} slide${counts.kept === 1 ? ' is' : 's are'} kept as-is.` : ''}`
    : state.deck ? `Locking ${counts.done} of ${counts.total} slides. Reuse as-is works now; New topic opens when every slide is locked.`
      : 'Still converting. It appears here as soon as the as-is deck is ready.'
  return (
    <>
      {state.deck ? <SlideView index={0} width={270} fixture={fixture} thumb /> : <div className="stw-slide thumb" style={{ width: 270, height: 152 }} />}
      {state.deck && minis.length > 0 && <div className="row">{minis.map(i => <SlideView key={i} index={i} width={62} fixture={fixture} thumb />)}</div>}
      <h4 {...nameTitle(entry.name)}>{displayName(entry.name)}</h4>
      <p>{description}</p>
      <span className="eyebrow" style={{ marginTop: 2 }}>How to use it</span>
      <div role="radiogroup" aria-label="How to use it" style={{ display: 'grid', gap: 6 }}>
        <button type="button" role="radio" className="stw-radio" aria-checked={mode === 'new_topic' && caps.newTopic} disabled={!caps.newTopic} onClick={() => onMode('new_topic')}>
          <span className="ring" /><span><b>New topic</b>{caps.newTopic ? 'Tell Director what the deck is about; it writes into these layouts.' : 'Opens when every slide is locked.'}</span>
        </button>
        <button type="button" role="radio" className="stw-radio" aria-checked={mode === 'as_is' && caps.reuseAsIs} disabled={!caps.reuseAsIs} onClick={() => onMode('as_is')}>
          <span className="ring" /><span><b>Reuse as-is</b>Copy the deck exactly, then edit it yourself.</span>
        </button>
      </div>
    </>
  )
}

"use client"

// PASS2-PK-FOUR item 4 (flag NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE, default off): Template ▾ next to Theme (frame 3b). The mockup's
// "Start from a template" popover, extended: search, "Your templates" (uploads: ready ones, and ones still locking with "Locking 12/18 ·
// as-is ready"), a live preview, the choice between New topic and Reuse as-is, and "Upload a template (.pptx)". Picking a template
// creates a NEW deck (PK, Q3). It shares the theme dropdown's search rule and keyboard model (#372, PK Q11): every typed word must
// appear in the name, arrows move, Enter picks, Escape closes.
// Replaces the toolbar's Template menu with the flag on; that menu's "Save Template" and "Template Mode" stay here as footer links.
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, ChevronDown, LayoutTemplate, Save, Search, Sparkles, Upload, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { themeDropdownMatches } from '@/components/theme-dropdown-picker'
import { cn } from '@/lib/utils'
import { templateNameFromFile } from '@/lib/studio-template-workspace/registry'
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
}

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

export function StudioTemplatePicker({ disabled, triggerClassName, labelClassName, portalContainer, onUploadTemplate, onSaveTemplate, saveTemplateDisabled, templateMode }: StudioTemplatePickerProps) {
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

  const entries: Entry[] = useMemo(() => live
    .filter(item => item.snapshot.state.status !== 'refused' && !(item.snapshot.state.status === 'failed' && !item.snapshot.state.deck))
    // The newest ready template first (pinned, NEW), then the rest, newest first.
    .sort((a, b) => Number(b.snapshot.state.status === 'ready') - Number(a.snapshot.state.status === 'ready') || b.record.created_at - a.record.created_at)
    .map(item => ({ record: item.record, snapshot: item.snapshot, start: item.store.commands.startDeck ?? null, name: item.snapshot.state.deck?.templateName ?? templateNameFromFile(item.record.file_name) })), [live])
  const visible = entries.filter(entry => themeDropdownMatches(entry.name, query))
  const fallback = entries.find(entry => entry.snapshot.state.status === 'ready') ?? entries[0] ?? null
  const selected = entries.find(entry => entry.record.session_id === selectedId) ?? fallback
  const highlighted = visible.find(entry => entry.record.session_id === highlightId) ?? (query.trim() ? visible[0] : undefined)
  const caps = selected ? templateCapabilities(selected.snapshot.state) : { reuseAsIs: false, newTopic: false }
  const effectiveMode = mode === 'new_topic' && !caps.newTopic && caps.reuseAsIs ? 'as_is' : mode
  const canStart = Boolean(selected?.start) && (effectiveMode === 'new_topic' ? caps.newTopic : caps.reuseAsIs)

  useEffect(() => { if (!open) { setQuery(''); setHighlightId(null); setMessage(null) } }, [open])

  const choose = (entry: Entry) => { setSelectedId(entry.record.session_id); setHighlightId(entry.record.session_id); setMessage(null) }
  const move = (step: 1 | -1) => {
    if (!visible.length) return
    const at = Math.max(0, visible.findIndex(entry => entry.record.session_id === (highlighted ?? selected)?.record.session_id))
    setHighlightId(visible[(at + step + visible.length) % visible.length].record.session_id)
  }
  const optionId = (id: string) => `${uid}-opt-${id}`
  const start = async () => {
    if (!selected?.start || !canStart) return
    setMessage(await selected.start(effectiveMode))
  }

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
              <h3>Start from a template <span>{entries.length}</span></h3>
              <p>Creates a new presentation.</p>
            </div>
            <button type="button" className="stw-btn quiet" style={{ width: 26, height: 26, padding: 0 }} aria-label="Close" onClick={() => setOpen(false)}><X /></button>
          </div>
          <label className="stw-picker-search">
            <Search aria-hidden="true" />
            <input id={`${uid}-search`} type="text" role="combobox" aria-expanded="true" aria-controls={`${uid}-list`} aria-autocomplete="list" autoComplete="off" spellCheck={false}
              aria-activedescendant={highlighted ? optionId(highlighted.record.session_id) : undefined} placeholder="Search templates" value={query}
              onChange={event => { setQuery(event.target.value); setHighlightId(null) }}
              onKeyDown={event => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); move(event.key === 'ArrowDown' ? 1 : -1) }
                else if (event.key === 'Enter') { event.preventDefault(); if (highlighted) choose(highlighted) }
              }} />
          </label>
          <div id={`${uid}-list`} role="listbox" aria-label="Your templates" className="stw-picker-list">
            <div className="stw-picker-group" aria-hidden="true">Your templates</div>
            {entries.length === 0 ? (
              <div className="stw-picker-empty">No templates yet. Upload a PowerPoint and Deckster turns it into a template you can reuse here.</div>
            ) : visible.length === 0 ? (
              <div className="stw-picker-empty">No templates match “{query.trim()}”.</div>
            ) : visible.map(entry => {
              const id = entry.record.session_id
              const isSelected = selected?.record.session_id === id
              const total = entry.snapshot.state.slideCount ?? 0
              const fresh = entry.snapshot.state.status === 'ready' && Date.now() - entry.record.created_at < 24 * 3600 * 1000
              return (
                <button key={id} id={optionId(id)} type="button" role="option" aria-selected={isSelected} data-active={highlighted?.record.session_id === id ? 'true' : undefined}
                  className="stw-pick" onClick={() => choose(entry)} onMouseMove={() => setHighlightId(id)}>
                  <span className="info">
                    <span className="name"><span>{entry.name}</span>{fresh && <span className="new">NEW</span>}</span>
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
          </div>
          <div className="stw-picker-foot">
            <button type="button" className="stw-btn teal" disabled={!canStart} onClick={() => void start()}>Start presentation<ArrowRight /></button>
            {message && <span className="stw-picker-note" role="status">{message}</span>}
            <div className="stw-picker-links">
              <Link href="/studio/templates" prefetch={false}><LayoutTemplate />Template library</Link>
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
          {selected ? <Preview entry={selected} mode={effectiveMode} onMode={setMode} /> : <p>Pick a template to see it here.</p>}
        </section>
      </PopoverContent>
    </Popover>
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
      <h4>{entry.name}</h4>
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

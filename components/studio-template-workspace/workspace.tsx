"use client"

// PASS2-PK-FOUR item 4 (flag NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE, default off): the template workspace (frames 1, 2, 3 and the edge
// states). It opens over the builder's stage for the session the upload dialog handed off to, and shows the as-is deck once
// `as_is_ready` arrives, each slide's state while it locks, and the "Template ready" moment. Browse and Present work throughout;
// Edit opens only when the template is ready (PK, Q5). Everything it shows comes from the adapter's store.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle, Bell, Check, ChevronLeft, ChevronRight, CircleDashed, Eye, EyeOff, FileUp, LayoutGrid, LayoutTemplate, ListChecks, LoaderCircle,
  Lock, Palette, Play, Plus, Type, X,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { TEMPLATE_WORKSPACE_OUTLINE_FADE_MS } from '@/lib/studio-template-workspace/contract'
import { useTemplateWorkspace, type TemplateWorkspaceSnapshot, type TemplateWorkspaceStore } from '@/lib/studio-template-workspace/adapter'
import {
  adoptTemplateWorkspaceHandoff,
  publishTemplateWorkspaceHeader,
  templateNameFromFile,
  updateTemplateWorkspaceRecord,
  type TemplateWorkspaceRecord,
} from '@/lib/studio-template-workspace/registry'
import {
  isLongDeck,
  templateCapabilities,
  templateEtaLabel,
  templateReadySummary,
  templateWorkspaceCounts,
} from '@/lib/studio-template-workspace/state'
import { SlideStateLabel, SlideView, formatFileSize, useTemplateWorkspaceRecords, useTemplateWorkspaceUserKey } from './shared'

const LEAVE_HREF = '/builder'
const LIBRARY_HREF = '/studio/templates'

function leaveTo(href: string) {
  // A full page load, like the upload dialog's handoff: the builder's socket belongs to one session.
  window.location.assign(href)
}

/**
 * Mounted from the builder's top bar (flag on). For the session in the URL (the upload dialog opens /builder?session_id=<new id>) it
 * opens the workspace over the builder's stage, and it shows "Template ready" toasts for uploads finishing elsewhere. It renders into
 * the stage element itself (a portal), so the builder page needs no change of its own.
 */
export function StudioTemplateWorkspaceHost() {
  const sessionId = useSearchParams()?.get('session_id') ?? null
  const [stage, setStage] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const found = document.querySelector<HTMLElement>('[data-studio-v4-shell-presentation="true"]')
    if (found !== stage) setStage(found)
  })
  const userKey = useTemplateWorkspaceUserKey()
  const records = useTemplateWorkspaceRecords(userKey)
  useEffect(() => {
    if (userKey && sessionId && sessionId !== 'new') adoptTemplateWorkspaceHandoff(userKey, sessionId)
  }, [userKey, sessionId])
  const record = records.find(item => item.session_id === sessionId && !item.closed) ?? null

  const onLeave = useCallback(() => leaveTo(LEAVE_HREF), [])
  useEffect(() => {
    if (!record || !userKey) return
    publishTemplateWorkspaceHeader({ userKey, sessionId: record.session_id, onLeave })
    return () => publishTemplateWorkspaceHeader(null)
  }, [record?.session_id, userKey, onLeave]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!stage) return null
  return createPortal(
    <>
      {record && userKey && <TemplateWorkspace userKey={userKey} record={record} />}
      {userKey && <TemplateReadyToasts userKey={userKey} records={records} activeSessionId={record?.session_id ?? null} placement="canvas" />}
    </>,
    stage,
  )
}

// ── the workspace ───────────────────────────────────────────────────────────────────────────────────────────────────────

function useStageWidth(ref: React.RefObject<HTMLDivElement | null>, reserve: number): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const style = getComputedStyle(el)
      const w = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const h = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - reserve
      setWidth(Math.max(120, Math.floor(Math.min(w, (h * 16) / 9))))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, reserve])
  return width
}

export function TemplateWorkspace({ userKey, record }: { userKey: string; record: TemplateWorkspaceRecord }) {
  const { snapshot, store } = useTemplateWorkspace(userKey, record)
  const { state, fixture } = snapshot
  const counts = templateWorkspaceCounts(state)
  const caps = templateCapabilities(state)
  const total = state.slideCount ?? 0
  const [current, setCurrent] = useState(0)
  const [view, setView] = useState<'slide' | 'grid'>('slide')
  const [outlines, setOutlines] = useState<'on' | 'faded' | 'off'>('off')
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const width = useStageWidth(stageRef, 26)
  const name = state.deck?.templateName ?? templateNameFromFile(record.file_name)
  const hasDeck = state.deck !== null && state.status !== 'refused'
  const index = Math.min(current, Math.max(0, total - 1))

  // Q7: "Deckster mode" outlines show when the as-is deck arrives, then fade after a few seconds.
  const deckArrived = hasDeck
  const seenDeck = useRef(false)
  useEffect(() => {
    if (!deckArrived || seenDeck.current) return
    seenDeck.current = true
    if (state.status !== 'locking' || counts.done > 0) return
    setOutlines('on')
    const fade = setTimeout(() => setOutlines(value => (value === 'on' ? 'faded' : value)), TEMPLATE_WORKSPACE_OUTLINE_FADE_MS)
    const off = setTimeout(() => setOutlines(value => (value === 'faded' ? 'off' : value)), TEMPLATE_WORKSPACE_OUTLINE_FADE_MS + 1000)
    return () => { clearTimeout(fade); clearTimeout(off) }
  }, [deckArrived]) // eslint-disable-line react-hooks/exhaustive-deps

  // The builder behind the workspace stays out of the tab order while the workspace covers it.
  useEffect(() => {
    const root = rootRef.current
    const parent = root?.parentElement
    if (!root || !parent) return
    const covered = [...parent.children].filter(child => child !== root && !child.hasAttribute('inert') && !child.hasAttribute('data-studio-template-workspace-toasts')) as HTMLElement[]
    covered.forEach(child => { child.setAttribute('inert', ''); child.setAttribute('data-stw-inert', '') })
    return () => covered.forEach(child => { if (child.hasAttribute('data-stw-inert')) { child.removeAttribute('inert'); child.removeAttribute('data-stw-inert') } })
  }, [])

  const go = useCallback((next: number) => setCurrent(Math.max(0, Math.min(next, Math.max(0, total - 1)))), [total])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.closest('input, textarea, [contenteditable="true"], [role="menu"], [role="dialog"]'))) return
      if (!rootRef.current?.isConnected || !hasDeck) return
      if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); setCurrent(value => Math.min(value + 1, Math.max(0, total - 1))) }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); setCurrent(value => Math.max(0, value - 1)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasDeck, total])

  const present = () => {
    setView('slide')
    void stageRef.current?.requestFullscreen?.().catch(() => {})
  }
  const startDeck = async (mode: 'new_topic' | 'as_is') => {
    const run = store?.commands.startDeck
    if (!run) return
    setToast(await run(mode))
  }
  const closeToEditor = () => updateTemplateWorkspaceRecord(userKey, record.session_id, { closed: true, ready_seen: true })
  const readyOpen = state.status === 'ready' && !record.ready_seen && view === 'slide'
  const slide = state.slides[index] ?? null
  const label = state.deck?.labels[index] ?? fixture?.slideLabel(index) ?? `Slide ${index + 1}`
  const elementsOnSlide = fixture ? fixture.slideElements(index).length : null

  // ── notices ──
  const notices: ReactNode[] = []
  const asIsNotice = hasDeck && state.status === 'locking' && counts.done < 3 && !dismissed.asis
  if (asIsNotice) {
    const changes = state.deck!.changes.length
    notices.push(
      <div key="asis" className="stw-notice one-line" role="status">
        <span className="stw-dot"><Check /></span>
        <span className="text"><strong>Your deck, as-is, in Deckster.</strong> <span className="m">{total} slides · {state.deck!.elementCount} elements placed{changes ? ` · ${changes} small change${changes === 1 ? '' : 's'}` : ''}</span></span>
        <span className="sep" />
        {changes > 0 && <WhatChangedButton snapshot={snapshot} asLink />}
        <button type="button" className="stw-link" onClick={() => setOutlines(value => (value === 'off' ? 'on' : 'off'))}>
          {outlines === 'off' ? <><Eye />Show outlines</> : <><EyeOff />Hide outlines</>}
        </button>
      </div>,
    )
  }
  if (hasDeck && state.status === 'locking' && isLongDeck(total) && !record.watch) {
    const minutes = templateEtaLabel(state.etaSeconds)
    notices.push(
      <div key="long" className="stw-notice block ai" role="status">
        <span className="stw-dot" style={{ background: 'var(--stw-ai)' }}><Bell /></span>
        <div className="body">
          <span><strong>Big one: {total} slides.</strong> You can reuse it as-is now. Locking takes a while{minutes ? ` (${minutes})` : ''}; we’ll tell you when it’s done.</span>
          <div className="acts">
            <button type="button" className="stw-btn ink" onClick={() => { updateTemplateWorkspaceRecord(userKey, record.session_id, { watch: 'notify' }); leaveTo(LIBRARY_HREF) }}><Bell />Notify me</button>
            <button type="button" className="stw-btn" onClick={() => updateTemplateWorkspaceRecord(userKey, record.session_id, { watch: 'stay' })}>Stay and watch</button>
          </div>
        </div>
      </div>,
    )
  }
  if ((state.status === 'paused' || state.status === 'failed') && hasDeck && state.problem && !dismissed[`problem-${state.problem.code}`]) {
    const paused = state.status === 'paused'
    const resume = store?.commands.resume
    notices.push(
      <div key="problem" className="stw-notice block warn" role="alert">
        <span className="stw-dot warn"><AlertTriangle /></span>
        <div className="body">
          <span><strong>{paused ? `Locking paused at ${counts.done} of ${total}.` : `Locking stopped at ${counts.done} of ${total}.`}</strong> {state.problem.text}</span>
          <span className="m">Locked slides stay locked; reuse as-is keeps working.</span>
          <div className="acts">
            {state.problem.retryable && resume && <button type="button" className="stw-btn ink" onClick={resume}>{paused ? 'Finish now' : 'Try again'}</button>}
            <button type="button" className="stw-btn" onClick={() => setDismissed(value => ({ ...value, [`problem-${state.problem!.code}`]: true }))}>{paused ? 'Leave it' : 'Close'}</button>
          </div>
        </div>
      </div>,
    )
  }
  if (hasDeck && view === 'slide' && slide?.state === 'unlockable' && slide.reason && !dismissed[`kept-${index}`]) {
    notices.push(
      <div key="kept" className="stw-notice block warn" role="status">
        <span className="stw-dot warn"><AlertTriangle /></span>
        <div className="body">
          <span><strong>Slide {index + 1} is kept as-is.</strong> {slide.reason.text}</span>
          <div className="acts"><button type="button" className="stw-btn" onClick={() => setDismissed(value => ({ ...value, [`kept-${index}`]: true }))}>Keep as-is</button></div>
        </div>
      </div>,
    )
  }

  const caption = asIsNotice && elementsOnSlide !== null ? `${label} · ${elementsOnSlide} element${elementsOnSlide === 1 ? '' : 's'} placed` : `${label} · slide ${index + 1}`

  return (
    <div ref={rootRef} className="stw-root stw-tokens" data-studio-template-workspace="true" data-stw-status={state.status} role="region" aria-label={`Template workspace: ${name}`}>
      <div className="stw-main">
        <div className="stw-top">
          <span className="cap"><i />{state.status === 'ready' ? `Template workspace · ${name}` : `Template workspace · as-is from ${record.file_name}`}</span>
          {hasDeck && <span className="num">{index + 1} / {total}</span>}
        </div>
        <div className="stw-island" role="toolbar" aria-label="Template workspace">
          <button type="button" aria-pressed={view === 'grid'} disabled={!hasDeck} onClick={() => setView(value => (value === 'grid' ? 'slide' : 'grid'))}><LayoutGrid />Grid</button>
          <span className="div" />
          <WhatChangedButton snapshot={snapshot} />
          <span className="div" />
          <button type="button" disabled={state.status !== 'ready'} title={state.status === 'ready' ? 'Edit this deck in the builder' : 'Editing opens when the template is ready'} onClick={closeToEditor}><Type />Edit</button>
          <button type="button" className="present" disabled={!hasDeck} onClick={present}><Play />Present</button>
        </div>
        {notices.length > 0 && <div className="stw-notices">{notices}</div>}
        <div ref={stageRef} className="stw-stage">
          {!hasDeck ? (
            <ConvertingCard snapshot={snapshot} record={record} onClose={() => updateTemplateWorkspaceRecord(userKey, record.session_id, { closed: true })} />
          ) : view === 'grid' ? (
            <div className="stw-grid">
              {Array.from({ length: total }, (_, i) => (
                <button key={i} type="button" className="stw-grid-cell" onClick={() => { setCurrent(i); setView('slide') }} aria-label={`Slide ${i + 1}`}>
                  <SlideView index={i} width={180} fixture={fixture} thumb slide={state.slides[i] ?? null} status={state.status} />
                  <span className="lbl">{String(i + 1).padStart(2, '0')} {state.deck?.labels[i] ?? fixture?.slideLabel(i) ?? ''}<SlideStateLabel slide={state.slides[i] ?? null} status={state.status} /></span>
                </button>
              ))}
            </div>
          ) : width > 0 ? (
            <div className="stw-stage-inner">
              <SlideView index={index} width={width} fixture={fixture} viewerUrl={fixture ? null : state.deck?.viewerUrl} slide={slide} status={state.status} outlines={outlines} />
              <span className="stw-caption"><i />{caption}</span>
            </div>
          ) : null}
        </div>
        <div className="stw-foot">
          <span className="nav">
            <button type="button" aria-label="Previous slide" disabled={!hasDeck || index === 0} onClick={() => go(index - 1)}><ChevronLeft /></button>
            {hasDeck ? <span>Slide <b>{index + 1}</b> of {total}</span> : <span>Converting…</span>}
            <button type="button" aria-label="Next slide" disabled={!hasDeck || index >= total - 1} onClick={() => go(index + 1)}><ChevronRight /></button>
          </span>
          {hasDeck && <span className="saved"><Check />Saved to your templates</span>}
        </div>
        {readyOpen && (
          <>
            <div className="stw-dim" />
            <ReadyCard snapshot={snapshot} name={name} onStart={store?.commands.startDeck ? () => void startDeck('new_topic') : null}
              onDone={() => updateTemplateWorkspaceRecord(userKey, record.session_id, { ready_seen: true, toast_seen: true })} />
          </>
        )}
        {toast && (
          <div className="stw-toast" role="status">
            <span className="stw-dot" style={{ background: 'var(--stw-ai)' }}><LayoutTemplate /></span>
            <span className="text">{toast}</span>
            <button type="button" className="x" aria-label="Dismiss" onClick={() => setToast(null)}><X /></button>
          </div>
        )}
      </div>
      <Rail snapshot={snapshot} current={index} onSelect={i => { setCurrent(i); setView('slide') }} />
      <span className="stw-sr" role="status">{state.status === 'ready' ? `${name} is ready. ${templateReadySummary(state)}.` : state.status === 'paused' ? 'Locking paused.' : state.status === 'failed' ? 'Locking stopped.' : hasDeck ? 'Your deck is ready to reuse as-is. Locking has started.' : ''}</span>
    </div>
  )
}

function WhatChangedButton({ snapshot, asLink = false }: { snapshot: TemplateWorkspaceSnapshot; asLink?: boolean }) {
  const changes = snapshot.state.deck?.changes ?? []
  const trigger = asLink
    ? <button type="button" className="stw-link"><ListChecks />What changed</button>
    : <button type="button" disabled={!snapshot.state.deck}><ListChecks />What changed{snapshot.state.deck ? ` · ${changes.length}` : ''}</button>
  if (!snapshot.state.deck) return trigger
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent data-studio-v4-shell="true" className="stw-changes stw-tokens" align="center" sideOffset={8}>
        <h4>What changed</h4>
        {changes.length === 0 ? <p>Nothing: every slide came across exactly.</p> : (
          <ol>{changes.map((change, i) => <li key={i}>{change.text}</li>)}</ol>
        )}
      </PopoverContent>
    </Popover>
  )
}

function ConvertingCard({ snapshot, record, onClose }: { snapshot: TemplateWorkspaceSnapshot; record: TemplateWorkspaceRecord; onClose: () => void }) {
  const { state, fixture } = snapshot
  const [now, setNow] = useState(() => Date.now())
  const stopped = state.status === 'failed' || state.status === 'refused'
  useEffect(() => {
    if (stopped) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [stopped])
  const elapsed = Math.max(0, Math.floor((now - record.created_at) / 1000))
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
  const N = state.slideCount
  const stage = state.stage
  const read = stage === 'placing' || stage === 'checking'
  const skeleton = Math.min(N ?? 12, 12)
  if (stopped && state.problem) {
    return (
      <div className="stw-convert" role="alert">
        <span className="eyebrow" style={{ color: 'var(--stw-warn)' }}><AlertTriangle style={{ color: 'var(--stw-warn)' }} />{state.status === 'refused' ? 'Too many slides' : 'Conversion stopped'}</span>
        <h3>{state.status === 'refused' ? `We can’t make a template from ${record.file_name}` : `We couldn’t convert ${record.file_name}`}</h3>
        <p className="stw-picker-note">{state.problem.text}</p>
        <div className="stw-ready-acts">
          <a className="stw-btn ink" href={LIBRARY_HREF}><FileUp />Upload another file</a>
          <button type="button" className="stw-btn" onClick={() => leaveTo(LEAVE_HREF)}>Back to Studio</button>
        </div>
      </div>
    )
  }
  return (
    <div className="stw-convert" role="status" aria-live="polite">
      <span className="eyebrow"><LoaderCircle className="stw-spin" />Converting · {clock}</span>
      <h3>Turning {record.file_name} into Deckster slides</h3>
      <div className="stw-steps">
        <span className={read ? 'done' : 'now'}>{read ? <Check /> : <LoaderCircle className="stw-spin" />}{read && N ? `Read ${N} slides` : 'Reading your slides'}</span>
        <span className={stage === 'placing' ? 'now' : stage === 'checking' ? 'done' : ''}>{stage === 'checking' ? <Check /> : stage === 'placing' ? <LoaderCircle className="stw-spin" /> : <CircleDashed />}Placing elements{N && stage === 'placing' ? ` · ${state.slidesConverted}/${N}` : ''}</span>
        <span className={stage === 'checking' ? 'now' : ''}>{stage === 'checking' ? <LoaderCircle className="stw-spin" /> : <CircleDashed />}Fidelity check</span>
      </div>
      <div className="stw-skel" aria-hidden="true">
        {Array.from({ length: skeleton }, (_, i) => (fixture && i < state.slidesConverted
          ? <SlideView key={i} index={i} width={80} fixture={fixture} thumb />
          : <i key={i} className={i < state.slidesConverted ? 'filled' : undefined} />))}
      </div>
      <p className="stw-picker-note" style={{ marginTop: 12 }}>Your deck appears here as soon as it is converted, usually in a minute or two. {formatFileSize(record.file_size) ? `(${formatFileSize(record.file_size)})` : ''}</p>
      <div className="stw-ready-acts" style={{ marginTop: 10 }}>
        <button type="button" className="stw-link" onClick={onClose}>Continue in the builder instead</button>
      </div>
    </div>
  )
}

function ReadyCard({ snapshot, name, onStart, onDone }: { snapshot: TemplateWorkspaceSnapshot; name: string; onStart: (() => void) | null; onDone: () => void }) {
  const { state, fixture } = snapshot
  const reps = (state.ready?.representatives ?? []).slice(0, 10)
  const layoutCount = state.ready?.layoutCount ?? reps.length
  const caps = templateCapabilities(state)
  return (
    <section className="stw-ready" role="dialog" aria-modal="false" aria-labelledby="stw-ready-title">
      <span className="eyebrow"><span className="stw-dot"><Lock /></span>Template ready · {templateReadySummary(state)}</span>
      <h2 id="stw-ready-title">{name} is ready.</h2>
      <p>Deckster learned {layoutCount} layout{layoutCount === 1 ? '' : 's'} from your deck, plus your fonts, colours and logo.{reps.length && reps.length < layoutCount ? ` Here are ${reps.length} of them.` : ''}</p>
      {reps.length > 0 && (
        <div className="stw-layouts">
          {reps.map(rep => (
            <figure key={rep.layout_id}>
              <SlideView index={rep.slide_index} width={102} fixture={fixture} thumb slide={state.slides[rep.slide_index] ?? null} status={state.status} />
              <figcaption>{rep.label}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <div className="stw-caps">
        <div className="stw-cap"><Check /><span><b>Reuse as-is</b>Copy the deck exactly</span></div>
        <div className={cn('stw-cap', !caps.newTopic && 'wait')}>{caps.newTopic ? <Check /> : <LoaderCircle />}<span><b>New topics</b>{caps.newTopic ? 'Director writes into these layouts' : 'Not available for this template yet'}</span></div>
      </div>
      <div className="stw-ready-acts">
        <button type="button" className="stw-btn ink" disabled={!onStart || !caps.newTopic} onClick={onStart ?? undefined}><Plus />Start a deck with it</button>
        <button type="button" className="stw-btn" onClick={onDone}>Done</button>
        <span className="stw-findit">In any deck:<span className="faux"><span><Palette />Theme</span><span className="hl"><LayoutTemplate />Template ▾</span></span></span>
      </div>
    </section>
  )
}

function Rail({ snapshot, current, onSelect }: { snapshot: TemplateWorkspaceSnapshot; current: number; onSelect: (index: number) => void }) {
  const { state, fixture } = snapshot
  const total = state.slideCount ?? 0
  const counts = templateWorkspaceCounts(state)
  const listRef = useRef<HTMLDivElement>(null)
  const touched = useRef(0)
  const firstWorking = useMemo(() => {
    for (let i = 0; i < total; i++) { const s = state.slides[i]?.state; if (s === 'analysing' || s === 'analysed') return i }
    return -1
  }, [state.slides, total])
  // Long decks: the rail follows the slides being analysed, unless the user is browsing it.
  useEffect(() => {
    if (firstWorking < 0 || Date.now() - touched.current < 6000 || state.status !== 'locking') return
    const item = listRef.current?.querySelector<HTMLElement>(`[data-stw-rail-index="${firstWorking}"]`)
    const list = listRef.current
    if (!item || !list) return
    const top = item.offsetTop - list.offsetTop - list.clientHeight / 2 + item.clientHeight
    list.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
  }, [firstWorking, state.status])
  const head = state.status === 'converting' ? null
    : counts.analysing > 0 && state.status === 'locking' && counts.done === 0 ? <em className="a">{counts.analysing} analysing</em>
      : state.status === 'paused' ? <em className="w">Paused</em> : state.status === 'failed' ? <em className="w">Stopped</em>
        : <em title={counts.kept ? `${counts.locked} locked, ${counts.kept} kept as-is` : undefined}>{counts.locked} locked{counts.kept ? ` · ${counts.kept} kept` : ''}</em>
  return (
    <aside className="stw-rail" aria-label="Slides">
      <div className="stw-rail-head">Slides <small>{total || ''}</small>{head}</div>
      <div ref={listRef} className="stw-rail-list" onScroll={() => { touched.current = Date.now() }} onPointerDown={() => { touched.current = Date.now() }}>
        {Array.from({ length: total }, (_, i) => (
          <button key={i} type="button" className="stw-rail-item" data-stw-rail-index={i} aria-current={i === current ? 'true' : undefined} onClick={() => onSelect(i)} aria-label={`Slide ${i + 1}`}>
            <span className="lbl"><span className="n">{String(i + 1).padStart(2, '0')}</span><span className="t">{state.deck?.labels[i] ?? fixture?.slideLabel(i) ?? ''}</span><SlideStateLabel slide={state.slides[i] ?? null} status={state.status} /></span>
            {state.status === 'converting' && i >= state.slidesConverted
              ? <span className="stw-slide thumb" style={{ width: 124, height: 70 }} />
              : <SlideView index={i} width={124} fixture={fixture} thumb slide={state.slides[i] ?? null} status={state.status} />}
          </button>
        ))}
      </div>
    </aside>
  )
}

// ── "Template ready" toasts, anywhere in Studio ─────────────────────────────────────────────────────────────────────────

function ReadyWatcher({ userKey, record, onReady }: { userKey: string; record: TemplateWorkspaceRecord; onReady: (record: TemplateWorkspaceRecord, snapshot: TemplateWorkspaceSnapshot) => void }) {
  const { snapshot } = useTemplateWorkspace(userKey, record)
  const ready = snapshot.state.status === 'ready'
  useEffect(() => { if (ready) onReady(record, snapshot) }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export function TemplateReadyToasts({ userKey, records, activeSessionId, placement }: {
  userKey: string
  records: TemplateWorkspaceRecord[]
  activeSessionId: string | null
  placement: 'canvas' | 'page'
}) {
  const [ready, setReady] = useState<Array<{ record: TemplateWorkspaceRecord; name: string; summary: string }>>([])
  const watch = records.filter(record => record.session_id !== activeSessionId && !record.toast_seen)
  const onReady = useCallback((record: TemplateWorkspaceRecord, snapshot: TemplateWorkspaceSnapshot) => {
    setReady(list => list.some(item => item.record.session_id === record.session_id) ? list : [...list, {
      record, name: snapshot.state.deck?.templateName ?? templateNameFromFile(record.file_name), summary: templateReadySummary(snapshot.state),
    }])
  }, [])
  const visible = ready.filter(item => watch.some(record => record.session_id === item.record.session_id)).slice(-1)[0]
  const dismiss = (sessionId: string) => updateTemplateWorkspaceRecord(userKey, sessionId, { toast_seen: true })
  return (
    <div data-studio-template-workspace-toasts="true" className="stw-tokens">
      {watch.map(record => <ReadyWatcher key={record.session_id} userKey={userKey} record={record} onReady={onReady} />)}
      {visible && (
        <div className={cn('stw-toast', placement === 'page' && 'fixed')} role="status">
          <span className="stw-dot"><Lock /></span>
          <span className="text"><strong>Template ready:</strong> {visible.name} · {visible.summary}. It’s now under Template, next to Theme.</span>
          <button type="button" className="stw-link" onClick={() => { dismiss(visible.record.session_id); updateTemplateWorkspaceRecord(userKey, visible.record.session_id, { closed: false }); leaveTo(`/builder?session_id=${encodeURIComponent(visible.record.session_id)}`) }}>Open</button>
          <button type="button" className="x" aria-label="Dismiss" onClick={() => dismiss(visible.record.session_id)}><X /></button>
        </div>
      )}
    </div>
  )
}

export type { TemplateWorkspaceStore }

"use client"

// PASS2-PK-FOUR item 4 (flag NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE, default off): parts shared by the workspace, the top bar, the
// Template ▾ picker and the Templates page. Loaded only with the flag on (see ./entry.tsx).
import "./studio-template-workspace.css"

import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AlertTriangle, Image as ImageIcon, LoaderCircle, Lock, Pin, Shapes, Type, BarChart3 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { templateWorkspaceStore, type TemplateFixtureDeck, type TemplateWorkspaceSnapshot, type TemplateWorkspaceStore } from '@/lib/studio-template-workspace/adapter'
import {
  readTemplateWorkspaceRecords,
  subscribeTemplateWorkspaceRecords,
  templateWorkspaceRecordsVersion,
  type TemplateWorkspaceRecord,
} from '@/lib/studio-template-workspace/registry'
import type { TemplateSlideStatus, TemplateWorkspaceStatus, TemplateTick } from '@/lib/studio-template-workspace/state'

/** The account the workspace list belongs to (the same id the upload dialog and the Director socket use). */
export function useTemplateWorkspaceUserKey(): string | null {
  const { user } = useAuth()
  const typed = user as { id?: string; email?: string | null } | undefined
  return typed?.id || typed?.email || null
}

const serverVersion = () => -1

export function useTemplateWorkspaceRecords(userKey: string | null): TemplateWorkspaceRecord[] {
  const version = useSyncExternalStore(subscribeTemplateWorkspaceRecords, templateWorkspaceRecordsVersion, serverVersion)
  return useMemo(() => (userKey && version >= 0 ? readTemplateWorkspaceRecords(userKey) : []), [userKey, version])
}

/** The live snapshots of several uploads at once (the picker and the library card list them all). */
export function useTemplateWorkspaceSnapshots(userKey: string | null, records: TemplateWorkspaceRecord[]): Array<{ record: TemplateWorkspaceRecord; store: TemplateWorkspaceStore; snapshot: TemplateWorkspaceSnapshot }> {
  const stores = useMemo(() => (userKey ? records.map(record => templateWorkspaceStore(userKey, record)) : []), [userKey, records])
  const subscribe = useCallback((listener: () => void) => {
    const offs = stores.map(store => store.subscribe(listener))
    return () => offs.forEach(off => off())
  }, [stores])
  const cache = useRef<TemplateWorkspaceSnapshot[]>([])
  const read = useCallback(() => {
    const next = stores.map(store => store.getSnapshot())
    if (next.length === cache.current.length && next.every((snapshot, i) => snapshot === cache.current[i])) return cache.current
    cache.current = next
    return next
  }, [stores])
  const snapshots = useSyncExternalStore(subscribe, read, read)
  return stores.map((store, i) => ({ record: records[i], store, snapshot: snapshots[i] ?? store.getSnapshot() }))
}

export function Ticks({ ticks }: { ticks: TemplateTick[] }) {
  if (!ticks.length) return null
  return (
    <span className={cn('stw-ticks', ticks.length > 40 && 'long')} aria-hidden="true">
      {ticks.map((tick, i) => <i key={i} className={tick === 'q' ? undefined : tick} />)}
    </span>
  )
}

const KIND_ICON: Record<string, ReactNode> = { Text: <Type />, Logo: <ImageIcon />, Picture: <ImageIcon />, Chart: <BarChart3 />, Shape: <Shapes /> }
const BADGED_ROLES = new Set(['Logo', 'Title', 'Decoration'])
const CHIP_PLACE: Record<string, string> = { Logo: 'c-r', Title: 'c-tr', Decoration: 'c-in', Footer: 'c-tr' }
const DARK_LABELS = new Set(['Title', 'Closing'])

type Box = { x: number; y: number; w: number; h: number }

export interface SlideViewProps {
  index: number
  /** Rendered width in px; the height follows 16:9. */
  width: number
  fixture: TemplateFixtureDeck | null
  /** The real as-is deck (Layout viewer); only drawn on the canvas. */
  viewerUrl?: string | null
  thumb?: boolean
  /** Per-slide state, for the overlays. Omit for a plain picture of the slide. */
  slide?: TemplateSlideStatus | null
  status?: TemplateWorkspaceStatus
  /** "Deckster mode" outlines on the as-is deck: shown, fading, or off. */
  outlines?: 'on' | 'faded' | 'off'
  className?: string
}

/**
 * One slide, drawn at 960x540 and scaled, with the per-slide state over it. Element boxes are measured from the rendered slide
 * (data-el-id), as the frames do. Thumbnails get the light states only (lock badge, shimmer, kept-as-is chip).
 */
export function SlideView({ index, width, fixture, viewerUrl = null, thumb = false, slide = null, status, outlines = 'off', className }: SlideViewProps) {
  const height = Math.round((width * 9) / 16)
  const scale = width / 960
  const host = useRef<HTMLDivElement>(null)
  const [boxes, setBoxes] = useState<Record<string, Box>>({})
  const html = fixture ? fixture.slideHtml(index) : null
  const state = slide?.state ?? 'queued'
  const paused = status === 'paused' || status === 'failed'

  useLayoutEffect(() => {
    if (thumb || !html || !host.current) return
    const root = host.current
    let live = true
    const measure = () => {
      if (!live) return
      const rootBox = root.getBoundingClientRect()
      const s = rootBox.width / 960 || 1
      const next: Record<string, Box> = {}
      root.querySelectorAll<HTMLElement>('[data-el-id]').forEach(el => {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) next[el.dataset.elId!] = { x: (r.left - rootBox.left) / s, y: (r.top - rootBox.top) / s, w: r.width / s, h: r.height / s }
      })
      setBoxes(next)
    }
    measure()
    // Text boxes settle once the fonts are in.
    void document.fonts?.ready.then(measure)
    return () => { live = false }
  }, [html, thumb, width])

  const elements = fixture && !thumb ? fixture.slideElements(index) : []
  const dark = fixture ? DARK_LABELS.has(fixture.slideLabel(index)) : false
  const fixedIds = new Set((slide?.fixed ?? []).map(role => role.element_id))
  const roleById = new Map((slide?.roles ?? []).map(role => [role.element_id, role]))
  const pad = 4
  const region = (id: string, cls: string, chip: ReactNode, place = '') => {
    const box = boxes[id]
    if (!box) return null
    return (
      <div key={`${cls}-${id}`} className={cn('stw-reg', cls, place)} style={{ left: box.x - pad, top: box.y - pad, width: box.w + pad * 2, height: box.h + pad * 2 }}>
        {chip ? <b>{chip}</b> : null}
      </div>
    )
  }

  let overlay: ReactNode = null
  if (!thumb && fixture) {
    const showOutlines = outlines !== 'off'
    const parts: ReactNode[] = []
    if (showOutlines) {
      for (const el of elements) {
        const badge = BADGED_ROLES.has(el.role) ? <>{KIND_ICON[el.kind] ?? null}{el.kind === 'Text' ? 'Text · editable' : el.kind}</> : null
        parts.push(region(el.id, cn('placed', dark && 'on-dark'), badge, CHIP_PLACE[el.role] ?? ''))
      }
    } else if (state === 'analysing') {
      elements.forEach(el => {
        if (fixedIds.has(el.id) || el.policy === 'fixed') parts.push(region(el.id, 'fixed', <><Pin />{el.role} · fixed</>, CHIP_PLACE[el.role] ?? ''))
        else parts.push(region(el.id, paused ? 'fixed' : 'reading', null))
      })
    } else if (state === 'analysed') {
      elements.forEach(el => {
        const role = roleById.get(el.id)
        if (!role) return
        parts.push(role.policy === 'fixed'
          ? region(el.id, 'fixed', <><Pin />{role.role} · fixed</>, CHIP_PLACE[el.role] ?? '')
          : region(el.id, 'landed', <>{role.role}</>, el.role === 'Source note' ? 'c-below' : ''))
      })
    }
    const working = (state === 'analysing' || state === 'analysed') && !paused
    const fillable = elements.filter(el => el.policy !== 'fixed').length
    overlay = (
      <div className={cn('stw-ov', outlines === 'faded' && 'faded')}>
        {parts}
        {working && <div className="stw-sweep" />}
        {state === 'analysing' && !paused && (showOutlines
          ? <span className="stw-chip ai right"><LoaderCircle className="stw-spin" />Analysing this slide</span>
          : <span className="stw-chip ai right"><LoaderCircle className="stw-spin" />Analysing {fillable} regions · fixed parts already known</span>)}
        {state === 'analysed' && !paused && <span className="stw-chip ai right"><LoaderCircle className="stw-spin" />Roles found · locking</span>}
        {(state === 'analysing' || state === 'analysed') && paused && <span className="stw-chip warn right">{status === 'paused' ? 'Paused' : 'Stopped'}</span>}
        {state === 'locked' && <span className="stw-chip ok right"><Lock />Locked{fillable ? ` · ${fillable} slots` : ''}</span>}
        {state === 'unlockable' && <span className="stw-chip warn left"><AlertTriangle />KEPT AS-IS</span>}
      </div>
    )
  }

  return (
    <div
      className={cn('stw-slide', thumb && 'thumb', state === 'unlockable' && 'kept', thumb && (state === 'analysing' || state === 'analysed') && 'analysing', className)}
      style={{ width, height }}
      data-stw-slide={index + 1}
      data-stw-slide-state={slide ? state : undefined}
    >
      {html ? (
        // Trusted fixture HTML from the mock deck (static strings, dev/test builds only); the real deck is drawn by the Layout viewer.
        <div ref={host} className="stw-scale" style={{ transform: `scale(${scale})` }} aria-hidden="true">
          <div dangerouslySetInnerHTML={{ __html: html }} />
          {overlay}
        </div>
      ) : viewerUrl && !thumb ? (
        <iframe src={viewerUrl} title={`Slide ${index + 1} of the as-is deck`} />
      ) : (
        <div className="stw-real-thumb">{index + 1}</div>
      )}
      {thumb && slide && state === 'locked' && <span className="stw-thumb-lock"><Lock /></span>}
      {thumb && slide && state === 'unlockable' && <span className="stw-thumb-kept"><AlertTriangle />KEPT</span>}
      {thumb && (!slide || state === 'queued') && status !== undefined && status !== 'converting' && <span className="stw-thumb-q" />}
      {thumb && slide && (state === 'analysing' || state === 'analysed') && !paused && <><span className="stw-thumb-shimmer" /><span className="stw-thumb-bar"><i /></span></>}
    </div>
  )
}

/** The per-slide state label of the rail and the grid. */
export function SlideStateLabel({ slide, status }: { slide: TemplateSlideStatus | null; status: TemplateWorkspaceStatus }) {
  const state = slide?.state ?? 'queued'
  if (status === 'converting') return null
  if (state === 'locked') return <span className="stw-state l"><Lock />Locked</span>
  if (state === 'unlockable') return <span className="stw-state w"><AlertTriangle />Kept as-is</span>
  if ((state === 'analysing' || state === 'analysed') && (status === 'paused' || status === 'failed')) return <span className="stw-state w">Paused</span>
  if (state === 'analysing' || state === 'analysed') return <span className="stw-state a"><LoaderCircle className="stw-spin" />Analysing</span>
  return <span className="stw-state">○ Queued</span>
}

/** "18.4 MB" */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** "uploaded 4 min ago" / "uploaded today" */
export function uploadedAgo(createdAt: number, now = Date.now()): string {
  const minutes = Math.floor((now - createdAt) / 60000)
  if (minutes < 1) return 'uploaded just now'
  if (minutes < 60) return `uploaded ${minutes} min ago`
  return 'uploaded today'
}

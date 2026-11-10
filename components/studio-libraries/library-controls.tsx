"use client"

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, FolderOpen, Loader2, Plus, Search, X } from 'lucide-react'
import { BackToBuilderButton } from '@/components/layout/app-header'
import './libraries.css'
import { StudioIntroReplay } from '@/components/studio-intro-replay'
import type { WorkspaceIntroScreen } from '@/components/workspace-intro/types'
import './destination-intros.css'

export type LibraryMode = 'create' | 'library'

export function libraryDate(value?: string | null): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : undefined
}

export function LibraryWorkspace({ title, description, mode, onModeChange, children, actions, workspaceId, introScreen, introAutoStart, introEnabled = true }: {
  title: string; description: string; mode: LibraryMode
  onModeChange: (mode: LibraryMode) => void; children: ReactNode; actions?: ReactNode; workspaceId?: string
  introScreen?: WorkspaceIntroScreen; introAutoStart?: boolean; introEnabled?: boolean
}) {
  return <main className="studio-library" data-studio-library={workspaceId ?? title.toLowerCase()} data-studio-intro-surface={introScreen}>
    <div className="sl-heading"><div><p className="sl-eyebrow">YOUR REUSABLE LIBRARY</p><h1>{title}</h1><p>{description}</p></div>
      <div className="sl-heading-actions">{!introScreen && <StudioIntroReplay />}{actions}<div className="sl-mode" aria-label={`${title} workspace`}>
        <button type="button" aria-pressed={mode === 'create'} onClick={() => onModeChange('create')}><Plus size={15} />Create</button>
        <button type="button" aria-pressed={mode === 'library'} onClick={() => onModeChange('library')}><FolderOpen size={15} />Library</button>
      </div></div>
    </div>
    {children}
    {introScreen && <StudioIntroReplay screen={introScreen} autoStart={introAutoStart} enabled={introEnabled} targetSelector={`[data-studio-intro-surface="${introScreen}"]`} className="studio-destination-intro-replay" />}
  </main>
}

export function LibrarySearch({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const input = useRef<HTMLInputElement>(null)
  return <div className="sl-search" onClick={event => { if (!(event.target as Element).closest('button')) input.current?.focus() }}><Search size={16} aria-hidden="true" /><input ref={input} aria-label={label} placeholder={label} value={value} onChange={event => onChange(event.target.value)} />{value && <button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => { onChange(''); input.current?.focus() }}><X size={14} aria-hidden="true" /></button>}</div>
}

export function LibraryNotice({ children, error = false, readingLabel }: { children: ReactNode; error?: boolean; readingLabel?: string }) {
  const studioReading = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && Boolean(readingLabel)
  return <div className={`sl-notice${error ? ' sl-error' : ''}`} role={error ? 'alert' : 'status'} data-studio-library-notice-reading={studioReading ? 'true' : undefined} tabIndex={studioReading ? 0 : undefined} aria-label={studioReading ? readingLabel : undefined}>{children}</div>
}

export function LibraryLoading({ children = 'Loading your library…' }: { children?: ReactNode }) {
  return <div className="sl-empty" role="status"><Loader2 className="sl-spin" size={22} /><p>{children}</p></div>
}

export function StudioWorkflowLink({ children, disclosure = false }: { children: ReactNode; disclosure?: boolean }) {
  return <div className="sl-workflow-link"><div>{disclosure ? <details className="sl-disclosure"><summary>Continue in Studio</summary><p>{children}</p></details> : <><strong>Continue in Studio</strong><p>{children}</p></>}</div><BackToBuilderButton /><ArrowRight size={14} aria-hidden="true" /></div>
}

export function ReadValue({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return <div className="sl-read-value"><dt>{label}</dt><dd>{value}</dd></div>
}

export function MetadataDisclosure({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null
  const studio = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  return <details className="sl-disclosure"><summary>{label}</summary><pre data-studio-library-metadata={studio ? 'true' : undefined} tabIndex={studio ? 0 : undefined} role={studio ? 'region' : undefined} aria-label={studio ? label : undefined}>{JSON.stringify(value, null, 2)}</pre></details>
}

/** Fits authored content inside the remaining preview space without scaling UI. */
export function FittedLibraryStage({ children }: { children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const observer = new ResizeObserver(entries => {
      const bounds = entries[0]?.contentRect
      if (bounds) setWidth(Math.min(bounds.width, bounds.height * 16 / 9))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return <div className="sl-stage-space" ref={stage}><div className="sl-stage" style={width ? { width } : undefined}>{children}</div></div>
}

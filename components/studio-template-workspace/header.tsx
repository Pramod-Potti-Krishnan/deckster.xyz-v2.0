"use client"

// PASS2-PK-FOUR item 4 (flag NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE, default off): the top bar while the template workspace is open
// (frames 1-3): "Templates / <template>" and "Saved to your templates" on the left; the progress pill ("Locking template: 18/30", one
// tick per slide, time left), "Back to Studio" and "Use template ▾" on the right, beside the builder's own "+ New deck". The deck's
// title and the delivery controls (Export, Publish) step aside while it is open (CSS :has on [data-stw-header]).
// Nothing renders unless the workspace (./workspace.tsx) has published itself as active.
import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, ChevronDown, LayoutTemplate, LoaderCircle, Lock, AlertTriangle, Copy, Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useTemplateWorkspace } from '@/lib/studio-template-workspace/adapter'
import {
  getTemplateWorkspaceHeader,
  subscribeTemplateWorkspaceHeader,
  templateNameFromFile,
} from '@/lib/studio-template-workspace/registry'
import { templateCapabilities, templateWorkspacePill } from '@/lib/studio-template-workspace/state'
import { Ticks, useTemplateWorkspaceRecords } from './shared'
import { StudioTemplateWorkspaceHost } from './workspace'

const none = () => null

function useActiveWorkspace() {
  const model = useSyncExternalStore(subscribeTemplateWorkspaceHeader, getTemplateWorkspaceHeader, none)
  const records = useTemplateWorkspaceRecords(model?.userKey ?? null)
  const record = model ? records.find(item => item.session_id === model.sessionId) ?? null : null
  const { snapshot, store } = useTemplateWorkspace(model?.userKey ?? null, record)
  return { model, record, snapshot, store }
}

export function StudioTemplateWorkspaceHeading() {
  const { model, record, snapshot } = useActiveWorkspace()
  if (!model || !record) return null
  const name = snapshot.state.deck?.templateName ?? templateNameFromFile(record.file_name)
  return (
    <span className="stw-crumbs stw-tokens" data-stw-header="true">
      <span className="div" aria-hidden="true" />
      <Link href="/studio/templates" prefetch={false}>Templates</Link>
      <span className="sep" aria-hidden="true">/</span>
      <strong title={name}>{name}</strong>
      {snapshot.state.deck && <span className="saved" role="status"><Check aria-hidden="true" />Saved to your templates</span>}
    </span>
  )
}

/** The top bar's right-hand slot: the workspace itself (rendered over the stage) and, while it is open, its pill and actions. */
export function StudioTemplateWorkspaceHeaderActions() {
  return <><StudioTemplateWorkspaceHost /><WorkspaceHeaderActions /></>
}

function WorkspaceHeaderActions() {
  const { model, record, snapshot, store } = useActiveWorkspace()
  const [message, setMessage] = useState<string | null>(null)
  if (!model || !record) return null
  const pill = templateWorkspacePill(snapshot.state)
  const caps = templateCapabilities(snapshot.state)
  const startDeck = store?.commands.startDeck
  const start = async (mode: 'new_topic' | 'as_is') => { if (startDeck) setMessage(await startDeck(mode)) }
  const icon = pill.tone === 'ok' ? <Lock aria-hidden="true" /> : pill.tone === 'warn' ? <AlertTriangle aria-hidden="true" /> : <LoaderCircle aria-hidden="true" className={pill.spinning ? 'stw-spin' : undefined} />
  return (
    <span className="stw-head-actions stw-tokens">
      <span className={cn('stw-pill', pill.tone === 'ok' && 'ok', pill.tone === 'warn' && 'warn')} data-stw-pill={pill.tone} aria-label={pill.label}>
        {icon}<span>{pill.label}</span><Ticks ticks={pill.ticks} />{pill.eta && <small>{pill.eta}</small>}
      </span>
      <button type="button" className="stw-btn quiet stw-back" onClick={model.onLeave}><ArrowLeft /><span>Back to Studio</span></button>
      <DropdownMenu onOpenChange={open => { if (!open) setMessage(null) }}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="stw-btn ink stw-use" disabled={!caps.reuseAsIs}><LayoutTemplate />Use template<ChevronDown style={{ width: 12, height: 12 }} /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} data-studio-v4-shell="true" className="stw-menu stw-tokens">
          <DropdownMenuItem disabled={!caps.newTopic || !startDeck} onSelect={event => { event.preventDefault(); void start('new_topic') }}>
            <Sparkles /><span><b>New topic</b><small>{caps.newTopic ? 'A new deck; Director writes into these layouts' : 'Opens when every slide is locked'}</small></span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!caps.reuseAsIs || !startDeck} onSelect={event => { event.preventDefault(); void start('as_is') }}>
            <Copy /><span><b>Reuse as-is</b><small>A new deck, an exact copy of this one</small></span>
          </DropdownMenuItem>
          {message && <p className="stw-picker-note" role="status" style={{ padding: '6px 9px 4px', maxWidth: 260 }}>{message}</p>}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}

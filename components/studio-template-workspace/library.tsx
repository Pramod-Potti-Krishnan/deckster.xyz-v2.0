"use client"

// PASS2-PK-FOUR item 4 (flag NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE, default off): the Templates page side of "leave and come back
// mid-lock" (edge-states.png): a card per upload of this tab with its live progress ("Locking 18/30 · reuse as-is ready") and Open,
// plus the "Template ready" toast. The job runs on the server; closing the workspace never cancels it.
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { templateNameFromFile, updateTemplateWorkspaceRecord } from '@/lib/studio-template-workspace/registry'
import { templateWorkspaceCounts } from '@/lib/studio-template-workspace/state'
import { SlideView, uploadedAgo, useTemplateWorkspaceRecords, useTemplateWorkspaceSnapshots, useTemplateWorkspaceUserKey } from './shared'
import { TemplateReadyToasts } from './workspace'

export function StudioTemplateWorkspaceLibrary() {
  const userKey = useTemplateWorkspaceUserKey()
  const records = useTemplateWorkspaceRecords(userKey)
  const live = useTemplateWorkspaceSnapshots(userKey, records)
  // Uploads still working, or ready but not yet opened from here.
  const cards = live.filter(item => item.snapshot.state.status !== 'ready' || !item.record.toast_seen).slice(0, 3)
  if (!userKey) return null
  return (
    <>
      <TemplateReadyToasts userKey={userKey} records={records} activeSessionId={null} placement="page" />
      {cards.length > 0 && (
        <div className="stw-library stw-tokens" data-studio-template-workspace-library="true" aria-label="Templates being prepared">
          {cards.map(({ record, snapshot }) => {
            const { state, fixture } = snapshot
            const counts = templateWorkspaceCounts(state)
            const name = state.deck?.templateName ?? templateNameFromFile(record.file_name)
            const tone = state.status === 'ready' ? 'ok' : state.status === 'paused' || state.status === 'failed' || state.status === 'refused' ? 'warn' : ''
            const line = state.status === 'converting' ? 'Converting…'
              : state.status === 'ready' ? `Template ready · ${counts.locked}/${counts.total} locked`
                : state.status === 'paused' ? `Locking paused ${counts.done}/${counts.total} · reuse as-is ready`
                  : state.status === 'failed' ? (state.deck ? `Locking stopped ${counts.done}/${counts.total} · reuse as-is ready` : 'Conversion stopped')
                    : state.status === 'refused' ? 'Too many slides for a template'
                      : `Locking ${counts.done}/${counts.total} · reuse as-is ready`
            const percent = counts.total ? Math.round((counts.done / counts.total) * 100) : 0
            return (
              <div key={record.session_id} className="stw-libcard" data-stw-library-card={record.session_id}>
                {state.deck ? <SlideView index={0} width={110} fixture={fixture} thumb /> : <div className="stw-slide thumb" style={{ width: 110, height: 62 }} />}
                <div className="info">
                  <strong title={name}>{name}</strong>
                  <small>Templates · {uploadedAgo(record.created_at)}</small>
                  <span className={cn('state', tone)}>{line}</span>
                  {state.deck && state.status !== 'ready' && <div className={cn('stw-bar')} aria-hidden="true"><i style={{ width: `${percent}%` }} /></div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <a className="stw-btn" href={`/builder?session_id=${encodeURIComponent(record.session_id)}`}
                    onClick={() => updateTemplateWorkspaceRecord(userKey, record.session_id, { closed: false, ...(state.status === 'ready' ? { toast_seen: true } : {}) })}>Open</a>
                  {state.status === 'ready' && <button type="button" className="stw-btn quiet" aria-label="Hide" onClick={() => updateTemplateWorkspaceRecord(userKey, record.session_id, { toast_seen: true })}><X /></button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

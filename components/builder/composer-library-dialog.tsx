"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { useChatSessions } from '@/hooks/use-chat-sessions'
import { uploadFileToResearcher } from '@/lib/researcher-upload'
import { evaluateLayoutViewerUrl } from '@/lib/layout-viewer-url-policy'
import { LAYOUT_VIEWER_URL_POLICY } from '@/lib/layout-service-client'
import {
  COMPOSER_READY_KEY_PREFIX, composerReadyResult, composerRequest, requireComposerServiceUrl,
  validateComposerFile, waitForComposerJob, type ComposerJob, type ComposerTemplate,
} from '@/lib/composer-library'
import { composerBriefLengthValid, composerBriefLimitMessage, composerBriefMax } from '@/lib/composer-long-brief'
import './studio-composer-library.css'

interface PendingJob { job_id: string; session_id: string; kind: 'upload' | 'use' }

export function ComposerLibraryDialog({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  const { user } = useAuth()
  const { createSession } = useChatSessions()
  const userId = user?.id || user?.email
  const pendingKey = `deckster_composer_job_${encodeURIComponent(userId || '')}`
  const [templates, setTemplates] = useState<ComposerTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [newBrief, setNewBrief] = useState('')
  const [newTopicTemplateId, setNewTopicTemplateId] = useState<string | null>(null)
  const longBriefEnabled = process.env.NEXT_PUBLIC_COMPOSER_LONG_BRIEF_ENABLED === 'true'
  const newTopicEnabled = process.env.NEXT_PUBLIC_COMPOSER_STAGE1B_NEW_TOPIC_ENABLED === 'true'
  const controllerRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await composerRequest<{ templates: ComposerTemplate[] }>('templates')
      setTemplates(response.templates || [])
    } finally { setLoading(false) }
  }, [])

  const finishJob = useCallback(async (pending: PendingJob, signal: AbortSignal) => {
    sessionStorage.setItem(pendingKey, JSON.stringify(pending))
    const job = await waitForComposerJob(pending.job_id, signal, next => {
      if (['failed', 'cancelled'].includes(next.status)) sessionStorage.removeItem(pendingKey)
      const label = next.status.replaceAll('_', ' ')
      setProgress(pending.kind === 'upload' ? `Preparing template: ${label}…` : `Creating deck: ${label}…`)
    })
    if (pending.kind === 'upload') {
      sessionStorage.removeItem(pendingKey)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await refresh()
      setProgress('Template added to your library.')
    } else {
      const ready = composerReadyResult(job, pending.session_id)
      if (!ready) throw new Error('The completed job did not return a deck.')
      // Require explicit Composer-safe configuration in addition to the shared viewer allowlist.
      requireComposerServiceUrl(process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL, 'layout-builder-v75-uat.up.railway.app')
      requireComposerServiceUrl(new URL(ready.viewer_url).origin, 'layout-builder-v75-uat.up.railway.app')
      if (evaluateLayoutViewerUrl(ready.viewer_url, LAYOUT_VIEWER_URL_POLICY).status !== 'allowed') {
        throw new Error('The new deck returned an unapproved viewer address.')
      }
      sessionStorage.setItem(`${COMPOSER_READY_KEY_PREFIX}${pending.session_id}`, JSON.stringify({ user_id: userId, result: ready }))
      sessionStorage.removeItem(pendingKey)
      // A fresh page owns one session and one WebSocket; no previous deck can adopt this result.
      window.location.assign(`/builder?session_id=${encodeURIComponent(pending.session_id)}`)
    }
  }, [pendingKey, refresh, userId])

  const run = useCallback(async (operation: (signal: AbortSignal) => Promise<void>) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setBusy(true)
    setError(null)
    try { await operation(controller.signal) }
    catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Template library request failed.')
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !userId) return
    void refresh().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load templates.'))
    let pending: PendingJob | null = null
    try { pending = JSON.parse(sessionStorage.getItem(pendingKey) || 'null') } catch { /* no recovery record */ }
    if (pending?.job_id && pending.session_id && ['upload', 'use'].includes(pending.kind)) {
      const originJob = pending
      void run(signal => finishJob(originJob, signal))
    }
    return () => { controllerRef.current?.abort() }
  }, [open, userId, pendingKey, refresh, run, finishJob])

  const upload = () => {
    if (!file || !userId || busy) return
    const validation = validateComposerFile(file)
    if (validation) { setError(validation); return }
    const selected = file
    void run(async signal => {
      // Validate before creating a session or calling the existing signed-upload helper.
      requireComposerServiceUrl(process.env.NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL, 'researcher-v11-uat.up.railway.app')
      const sessionId = crypto.randomUUID()
      if (!await createSession(sessionId, `Template upload: ${selected.name}`)) throw new Error('Could not create the upload session.')
      if (signal.aborted) return
      const uploaded = await uploadFileToResearcher({
        sessionId, userId, file: selected, intent: 'composer_template', storageOnly: true,
        onProgress: ({ percent }) => { if (!signal.aborted) setProgress(`Uploading presentation: ${percent}%`) },
      })
      if (signal.aborted) return
      const job = await composerRequest<ComposerJob>('upload-reference', {
        session_id: sessionId, researcher_session_id: uploaded.researcherSessionId,
        storage_path: uploaded.storagePath, file_name: selected.name, kind: 'pptx',
      }, signal)
      await finishJob({ job_id: job.job_id, session_id: sessionId, kind: 'upload' }, signal)
    })
  }

  const useTemplate = (template: ComposerTemplate, brief?: string) => {
    if (!userId || busy) return
    if (brief !== undefined && !composerBriefLengthValid(brief, longBriefEnabled)) {
      setError(composerBriefLimitMessage(longBriefEnabled))
      return
    }
    void run(async signal => {
      setProgress('Preparing a new deck…')
      requireComposerServiceUrl(process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL, 'layout-builder-v75-uat.up.railway.app')
      const sessionId = crypto.randomUUID()
      if (!await createSession(sessionId, brief ? `New topic: ${brief.trim().slice(0, 80)}` : `Template: ${template.name}`)) {
        throw new Error('Could not create the deck session.')
      }
      if (signal.aborted) return
      const job = await composerRequest<ComposerJob>(`templates/${encodeURIComponent(template.id)}/use`,
        { session_id: sessionId, ...(brief ? { brief: brief.trim() } : {}) }, signal)
      await finishJob({ job_id: job.job_id, session_id: sessionId, kind: 'use' }, signal)
    })
  }

  const body = <>
        <div data-studio-composer-upload={studioShell ? 'true' : undefined} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="composer-template-file">Add a presentation</label>
          <input id="composer-template-file" ref={fileInputRef} type="file" accept=".pptx" disabled={busy || !userId}
            className="block w-full text-sm" onChange={event => {
              const next = event.target.files?.[0] || null
              setFile(next)
              setError(next ? validateComposerFile(next) : null)
            }} />
          <Button data-studio-composer-action={studioShell ? 'upload' : undefined} onClick={upload} disabled={!file || !!validateComposerFile(file) || busy || !userId}>
            <FileUp className="mr-2 h-4 w-4" /> Upload template
          </Button>
          <p className="text-xs text-muted-foreground">PowerPoint (.pptx), up to 100 MB.</p>
        </div>
        {progress && <p data-studio-composer-progress={studioShell ? 'true' : undefined} tabIndex={studioShell ? 0 : undefined} aria-label={studioShell ? 'Template operation status' : undefined} role="status" aria-live="polite" className="flex items-center gap-2 text-sm">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {progress}
        </p>}
        {error && <p data-studio-composer-error={studioShell ? 'true' : undefined} tabIndex={studioShell ? 0 : undefined} aria-label={studioShell ? 'Template library error' : undefined} role="alert" className="text-sm text-red-600">{error}</p>}
        <div data-studio-composer-list={studioShell ? 'true' : undefined} role={studioShell ? 'group' : undefined} aria-label={studioShell ? 'Saved Composer templates' : undefined} className="max-h-72 space-y-2 overflow-y-auto border-t pt-4">
          {loading && !templates.length ? <p className="text-sm text-muted-foreground">Loading templates…</p>
            : !templates.length ? <p className="text-sm text-muted-foreground">Your uploaded templates will appear here.</p>
              : templates.map(template => <div data-studio-composer-record={studioShell ? template.id : undefined} key={template.id} className="space-y-3 rounded-md border p-3">
                <div data-studio-composer-record-row={studioShell ? 'true' : undefined} className="flex items-center justify-between gap-3">
                  <div data-studio-composer-record-info={studioShell ? 'true' : undefined} className="min-w-0">
                    <p data-studio-composer-name={studioShell ? 'true' : undefined} className="truncate text-sm font-medium" title={template.name}>{template.name}</p>
                    <p data-studio-composer-count={studioShell ? 'true' : undefined} className="text-xs text-muted-foreground">{template.stage_template_summary?.slide_count ?? template.slide_count ?? 0} slides</p>
                  </div>
                  <div data-studio-composer-actions={studioShell ? 'true' : undefined} className="flex shrink-0 gap-2">
                    <Button data-studio-composer-action={studioShell ? 'use' : undefined} size="sm" variant="outline" disabled={busy || !userId} onClick={() => useTemplate(template)}>Use original</Button>
                    {newTopicEnabled && <Button data-studio-composer-action={studioShell ? 'new-topic' : undefined} size="sm" variant="outline" disabled={busy || !userId}
                      onClick={() => { setNewTopicTemplateId(template.id); setNewBrief(''); setError(null) }}>New topic</Button>}
                  </div>
                </div>
                {newTopicEnabled && newTopicTemplateId === template.id && <div data-studio-composer-topic={studioShell ? 'true' : undefined} className="space-y-2">
                  <label htmlFor="composer-new-brief" className="text-sm font-medium">Describe the new presentation</label>
                  <Textarea id="composer-new-brief" value={newBrief} disabled={busy} maxLength={composerBriefMax(longBriefEnabled)}
                    placeholder="What is the topic, audience, and key message? Include any numbers you want shown."
                    onChange={event => setNewBrief(event.target.value)} />
                  <Button data-studio-composer-action={studioShell ? 'create' : undefined} size="sm" disabled={busy || newBrief.trim().length < 20}
                    onClick={() => useTemplate(template, newBrief)}>Create deck</Button>
                </div>}
              </div>)}
        </div>
  </>

  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next) }}>
      <DialogContent data-studio-composer-library={studioShell ? 'true' : undefined} className="sm:max-w-xl">
        <DialogHeader data-studio-composer-header={studioShell ? 'true' : undefined}>
          <DialogTitle>Template library</DialogTitle>
          <DialogDescription>Upload a PowerPoint presentation, then use its template to open an editable deck.</DialogDescription>
        </DialogHeader>
        {studioShell ? <div data-studio-composer-body="true" tabIndex={0} role="region" aria-label="Template upload and library">{body}</div> : body}
      </DialogContent>
    </Dialog>
  )
}

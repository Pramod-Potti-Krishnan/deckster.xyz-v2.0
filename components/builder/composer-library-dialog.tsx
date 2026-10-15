"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { useChatSessions } from '@/hooks/use-chat-sessions'
import { COMPOSER_DITTO_MODE } from '@/lib/composer-ditto'
import { uploadFileToResearcher } from '@/lib/researcher-upload'
import { evaluateLayoutViewerUrl } from '@/lib/layout-viewer-url-policy'
import { LAYOUT_VIEWER_URL_POLICY } from '@/lib/layout-service-client'
import {
  COMPOSER_READY_KEY_PREFIX, composerReadyResult, composerRequest, requireComposerServiceUrl,
  validateComposerFile, waitForComposerJob, type ComposerJob, type ComposerTemplate,
} from '@/lib/composer-library'
// NEXT_PUBLIC_STUDIO_COMPOSER_JOB_RECOVERY (default off): a stored job that failed or stopped moving ends as a notice with Retry and Dismiss.
import {
  composerJobRecovery, composerJobRecoveryMessage, composerRetryAction, dismissComposerJob, type ComposerJobRecovery, type ComposerRetryAction,
} from '@/lib/composer-library'
import { composerBriefLengthValid, composerBriefLimitMessage, composerBriefMax } from '@/lib/composer-long-brief'
// NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS (default off): an uploaded template is read in the background and shown as progress; Use original opens as soon as the as-is template is saved.
import { useTemplateProgress } from '@/components/builder/composer-template-progress'
import type { ComposerLibraryRequest } from '@/lib/studio-composer-popups'
import { studioTemplateShownName } from '@/lib/studio-template-display-name'
import './studio-composer-library.css'

interface PendingJob { job_id: string; session_id: string; kind: 'upload' | 'use'; retry?: ComposerRetryAction | null }
// PASS2B G38 (NEXT_PUBLIC_STUDIO_TEMPLATE_DISPLAY_NAMES, default off): templates are drawn by a short display name; the full stored name stays in a tooltip and in every payload.
const TEMPLATE_DISPLAY_NAMES = process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_DISPLAY_NAMES === 'true'
const displayName = (name: string) => studioTemplateShownName(name, TEMPLATE_DISPLAY_NAMES)

export function ComposerLibraryDialog({ open, onOpenChange, request = null, onRequestTaken }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** PASS2-COMPOSER-POPUPS fix: an action picked in the composer's template popup. Passed only with NEXT_PUBLIC_STUDIO_COMPOSER_POPUPS_V2 on. */
  request?: ComposerLibraryRequest | null
  onRequestTaken?: () => void
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
  const dittoEnabled = process.env.NEXT_PUBLIC_COMPOSER_STAGE1B_DITTO_ENABLED === 'true'
  // NEXT_PUBLIC_STUDIO_COMPOSER_JOB_RECOVERY (exact "true", default off). Off: `recovery` stays null, no record gains `retry`, nothing below runs.
  const jobRecoveryEnabled = process.env.NEXT_PUBLIC_STUDIO_COMPOSER_JOB_RECOVERY === 'true'
  const [recovery, setRecovery] = useState<ComposerJobRecovery | null>(null)
  const uploadRetryFile = useRef<File | null>(null)
  // The stored job record gains the action that started it (a template's id and name only, or a new topic's brief), for Retry.
  const retryRecord = (retry: ComposerRetryAction) => jobRecoveryEnabled ? { retry: composerRetryAction(retry) } : {}
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
    let stopped: ComposerJobRecovery | null = null
    const polling = waitForComposerJob(pending.job_id, signal, next => {
      if (['failed', 'cancelled'].includes(next.status)) sessionStorage.removeItem(pendingKey)
      const label = next.status.replaceAll('_', ' ')
      setProgress(pending.kind === 'upload' ? `Preparing template: ${label}…` : `Creating deck: ${label}…`)
      // NEXT_PUBLIC_STUDIO_COMPOSER_JOB_RECOVERY: a failed job (the poll then throws) or a stale one (stopped here) ends the wait below.
      if (jobRecoveryEnabled && (stopped = composerJobRecovery(pending, next, Date.now()))?.reason === 'stale') throw new Error('stale job')
    })
    // Flag on: that ending shows the notice in place of the progress line, and the dialog is free again (run() clears `busy`).
    const job = await (jobRecoveryEnabled ? polling.catch(reason => {
      if (!stopped || signal.aborted) throw reason
      setProgress(null)
      setRecovery(stopped)
      return null
    }) : polling)
    if (!job) return
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
    setRecovery(null) // flag on: a new action, a Retry or a resume replaces the notice (flag off it is always null)
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

  // NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS (exact "true"). Off: the hook answers with an inert object and nothing below changes anything.
  const templateProgress = useTemplateProgress({
    enabled: process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS === 'true', userId, refresh,
    // A job that ended with no Retry to offer lets go of the chosen file, as a finished upload always did; a failed one keeps it for Retry.
    onEnd: view => { if (!view.retry) { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' } },
    // The card's Retry for a failed upload is #406's: the dialog's own upload of the same chosen file (below), or none when it cannot run.
    retryUpload: () => { const retry: ComposerRetryAction = { action: 'upload' }; return retryable(retry) ? () => retryJob(retry) : null },
  })

  const upload = () => {
    if (!file || !userId || busy) return
    const validation = validateComposerFile(file)
    if (validation) { setError(validation); return }
    const selected = file
    if (jobRecoveryEnabled) uploadRetryFile.current = selected
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
      // NEXT_PUBLIC_STUDIO_TEMPLATE_PROGRESS: the job is read in the background, not waited for here, so the library stays usable while it runs.
      if (templateProgress.enabled) {
        uploadRetryFile.current = selected
        templateProgress.track({ job_id: job.job_id, session_id: sessionId, file_name: selected.name })
        setProgress(null)
        return
      }
      await finishJob({ job_id: job.job_id, session_id: sessionId, kind: 'upload', ...retryRecord({ action: 'upload' }) }, signal)
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
      await finishJob({ job_id: job.job_id, session_id: sessionId, kind: 'use',
        ...retryRecord(brief ? { action: 'new-topic', template, brief } : { action: 'use', template }) }, signal)
    })
  }

  // Stage 1B G3: rebuild the deck from the template's own content (zero model calls on the backend).
  const rebuildTemplate = (template: ComposerTemplate) => {
    if (!userId || busy) return
    void run(async signal => {
      setProgress('Preparing a new deck…')
      requireComposerServiceUrl(process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL, 'layout-builder-v75-uat.up.railway.app')
      const sessionId = crypto.randomUUID()
      if (!await createSession(sessionId, `Rebuild: ${template.name}`)) throw new Error('Could not create the deck session.')
      if (signal.aborted) return
      const job = await composerRequest<ComposerJob>(`templates/${encodeURIComponent(template.id)}/use`,
        { session_id: sessionId, mode: COMPOSER_DITTO_MODE }, signal)
      await finishJob({ job_id: job.job_id, session_id: sessionId, kind: 'use', ...retryRecord({ action: 'ditto', template }) }, signal)
    })
  }

  // PASS2-COMPOSER-POPUPS fix (only the page passes `request`, and only with the flag on): an action picked in the composer's template popup
  // runs here, through this dialog's own handlers, as the same button in the list below would. It is taken when the dialog opens and run
  // on the next render, so a job the dialog resumes on opening already shows as busy, and the request is then dropped, as a click on a
  // disabled button is. Without a request nothing here runs.
  const takenRequest = useRef<ComposerLibraryRequest | null>(null)
  const [pickedRequest, setPickedRequest] = useState<ComposerLibraryRequest | null>(null)
  useEffect(() => {
    if (!open || !request || takenRequest.current === request) return
    takenRequest.current = request
    onRequestTaken?.()
    setPickedRequest(request)
  }, [open, request, onRequestTaken])
  useEffect(() => {
    if (!pickedRequest) return
    setPickedRequest(null)
    const { action, template } = pickedRequest
    if (action === 'use') useTemplate(template)
    else if (action === 'ditto' && dittoEnabled) rebuildTemplate(template)
    else if (action === 'new-topic' && newTopicEnabled && !busy && userId) { setNewTopicTemplateId(template.id); setNewBrief(''); setError(null) }
  }, [pickedRequest]) // only the picked request: it runs this render's handlers, once

  // NEXT_PUBLIC_STUDIO_COMPOSER_JOB_RECOVERY: the notice for a stored job that failed or went stale, shown where the progress line was.
  // Retry runs the action that started the job again, through the same handler with the same arguments, as its button would (a new session
  // and a new job); an upload can be retried only while its presentation is still the one chosen here. Dismiss forgets the job in this tab:
  // it removes this dialog's stored record if that still names the job, and asks nothing of the server. Every other action stays available.
  const retryable = (retry: ComposerRetryAction | null) => retry?.action === 'upload' ? !!file && file === uploadRetryFile.current
    : retry?.action === 'ditto' ? dittoEnabled : retry?.action === 'new-topic' ? newTopicEnabled : retry?.action === 'use'
  const retryJob = (retry: ComposerRetryAction) => {
    if (retry.action === 'upload') upload()
    else if (retry.action === 'ditto') rebuildTemplate(retry.template)
    else useTemplate(retry.template, retry.action === 'new-topic' ? retry.brief : undefined)
  }
  const recoveryRetry = recovery && retryable(recovery.retry) ? recovery.retry : null
  const recoveryNotice = recovery && <div data-studio-composer-recovery={studioShell ? 'true' : undefined} role="alert" className="space-y-2 text-sm text-red-600">
    <p>{composerJobRecoveryMessage(recovery, !!recoveryRetry)}</p>
    <div className="flex flex-wrap gap-2">
      {recoveryRetry && <Button data-studio-composer-action={studioShell ? 'retry' : undefined} size="sm" variant="outline" disabled={busy || !userId}
        onClick={() => retryJob(recoveryRetry)}>Retry</Button>}
      <Button data-studio-composer-action={studioShell ? 'dismiss' : undefined} size="sm" variant="ghost"
        onClick={() => { dismissComposerJob(sessionStorage, pendingKey, recovery.job_id); setRecovery(null) }}>Dismiss</Button>
    </div>
  </div>

  const body = <>
        <div data-studio-composer-upload={studioShell ? 'true' : undefined} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="composer-template-file">Add a presentation</label>
          <input id="composer-template-file" ref={fileInputRef} type="file" accept=".pptx" disabled={busy || !userId}
            className="block w-full text-sm" onChange={event => {
              const next = event.target.files?.[0] || null
              setFile(next)
              setError(next ? validateComposerFile(next) : null)
            }} />
          <Button data-studio-composer-action={studioShell ? 'upload' : undefined} onClick={upload} disabled={!file || !!validateComposerFile(file) || busy || !userId || templateProgress.uploadHeld}>
            <FileUp className="mr-2 h-4 w-4" /> Upload template
          </Button>
          <p className="text-xs text-muted-foreground">PowerPoint (.pptx), up to 100 MB.</p>
        </div>
        {templateProgress.around(recoveryNotice ?? (progress && <p data-studio-composer-progress={studioShell ? 'true' : undefined} tabIndex={studioShell ? 0 : undefined} aria-label={studioShell ? 'Template operation status' : undefined} role="status" aria-live="polite" className="flex items-center gap-2 text-sm">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {progress}
        </p>), studioShell)}
        {error && <p data-studio-composer-error={studioShell ? 'true' : undefined} tabIndex={studioShell ? 0 : undefined} aria-label={studioShell ? 'Template library error' : undefined} role="alert" className="text-sm text-red-600">{error}</p>}
        <div data-studio-composer-list={studioShell ? 'true' : undefined} role={studioShell ? 'group' : undefined} aria-label={studioShell ? 'Saved Composer templates' : undefined} className="max-h-72 space-y-2 overflow-y-auto border-t pt-4">
          {loading && !templates.length ? <p className="text-sm text-muted-foreground">Loading templates…</p>
            : !templates.length ? <p className="text-sm text-muted-foreground">Your uploaded templates will appear here.</p>
              : templates.map(template => <div data-studio-composer-record={studioShell ? template.id : undefined} key={template.id} className="space-y-3 rounded-md border p-3">
                <div data-studio-composer-record-row={studioShell ? 'true' : undefined} className="flex items-center justify-between gap-3">
                  <div data-studio-composer-record-info={studioShell ? 'true' : undefined} className="min-w-0">
                    <p data-studio-composer-name={studioShell ? 'true' : undefined} className="truncate text-sm font-medium" title={template.name}>{displayName(template.name)}</p>
                    <p data-studio-composer-count={studioShell ? 'true' : undefined} className="text-xs text-muted-foreground">{template.stage_template_summary?.slide_count ?? template.slide_count ?? 0} slides</p>
                  </div>
                  <div data-studio-composer-actions={studioShell ? 'true' : undefined} className="flex shrink-0 gap-2">
                    <Button data-studio-composer-action={studioShell ? 'use' : undefined} size="sm" variant="outline" disabled={busy || !userId || templateProgress.held(template.id, 'use')} onClick={() => useTemplate(template)}>Use original</Button>
                    {dittoEnabled && <Button data-studio-composer-action={studioShell ? 'ditto' : undefined} size="sm" variant="outline" disabled={busy || !userId || templateProgress.held(template.id, 'ditto')} onClick={() => rebuildTemplate(template)}>Rebuild from own content</Button>}
                    {newTopicEnabled && <Button data-studio-composer-action={studioShell ? 'new-topic' : undefined} size="sm" variant="outline" disabled={busy || !userId || templateProgress.held(template.id, 'new-topic')}
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

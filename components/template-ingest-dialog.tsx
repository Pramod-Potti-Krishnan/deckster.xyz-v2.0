"use client"

import "./studio-editor-dialogs.css"
import "./studio-template-flows.css"

/**
 * Template Ingest (C-7): "Upload presentation…" dialog.
 *
 * Single-file dropzone (.pptx/.ppt/.pdf, ≤100MB) → Researcher signed-URL
 * pipeline with intent:"template_ingest" (lib/researcher-upload.ts) → mint a
 * NEW builder session (DB row first, createNewSession idiom) → drop the
 * one-shot handoff key `deckster_ingest_intent_<newId>` → route to
 * /builder?session_id=<newId>, where the builder auto-sends the ingest
 * WS message to Director.
 */

import { Fragment, type ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AlertTriangle, FileUp, Loader2, Upload } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useChatSessions } from '@/hooks/use-chat-sessions'
import { uploadFileToResearcher } from '@/lib/researcher-upload'
import { INGEST_INTENT_KEY_PREFIX } from '@/hooks/use-deckster-websocket-v2'

const STUDIO_TEMPLATE_FLOW = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

function TemplateFlowBody({ children }: { children: ReactNode }) {
  return STUDIO_TEMPLATE_FLOW ? <div className="studio-template-flow-body">{children}</div> : <Fragment>{children}</Fragment>
}

const MAX_INGEST_FILE_BYTES = 100 * 1024 * 1024 // 100MB (contract C-7)
const ACCEPTED_EXTENSIONS = ['.pptx', '.ppt', '.pdf'] as const

// Canonical INGEST_INTENT_KEY_PREFIX now lives in the WS hook (review fix:
// the hook clears stale intents on terminal ingest frames); re-export keeps
// existing `import { INGEST_INTENT_KEY_PREFIX } from this file` working.
export { INGEST_INTENT_KEY_PREFIX }

export interface IngestIntentPayload {
  storage_path: string
  file_name: string
  kind: 'pptx' | 'ppt' | 'pdf'
}

type IngestDialogPhase = 'idle' | 'uploading' | 'session' | 'redirecting' | 'paused'

function fileKind(name: string): IngestIntentPayload['kind'] | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pptx')) return 'pptx'
  if (lower.endsWith('.ppt')) return 'ppt'
  if (lower.endsWith('.pdf')) return 'pdf'
  return null
}

function validateIngestFile(file: File): string | null {
  if (!fileKind(file.name)) {
    return `Unsupported file type. Use ${ACCEPTED_EXTENSIONS.join(', ')}.`
  }
  if (file.size > MAX_INGEST_FILE_BYTES) {
    return 'File is larger than 100MB.'
  }
  if (file.size === 0) {
    return 'File is empty.'
  }
  return null
}

interface TemplateIngestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Outer identity/readiness, independent of the dialog's intentional close. */
  isCurrent?: () => boolean
  canStart?: () => boolean
}

export function TemplateIngestDialog({ open, onOpenChange, isCurrent, canStart }: TemplateIngestDialogProps) {
  const { user } = useAuth()
  const { createSession } = useChatSessions()

  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<IngestDialogPhase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const busy = phase !== 'idle' && phase !== 'paused'
  const latestOuter = useRef({ isCurrent, canStart })
  latestOuter.current = { isCurrent, canStart }
  const outerCurrent = () => (!isCurrent || isCurrent())
    && (!latestOuter.current.isCurrent || latestOuter.current.isCurrent())
  const outerCanStart = () => outerCurrent() && (!canStart || canStart())
    && (!latestOuter.current.canStart || latestOuter.current.canStart())

  // Dialog close is normally blocked while work is pending. External route,
  // account or parent-close intent must still retire that work immediately.
  const pathname = usePathname()
  const readStudioRoute = () => typeof window === 'undefined'
    ? pathname : `${window.location.pathname}${window.location.search}`
  const studioRoute = readStudioRoute()
  const studioSourceKey = JSON.stringify([user?.id ?? user?.email ?? 'anonymous', pathname, studioRoute, open])
  const studioOwnerRef = useRef({ key: studioSourceKey })
  if (studioOwnerRef.current.key !== studioSourceKey) studioOwnerRef.current = { key: studioSourceKey }
  const studioOwner = studioOwnerRef.current
  const studioClosedOwnerRef = useRef<typeof studioOwner | null>(null)
  const studioMountEpochRef = useRef({})
  const studioMountEpoch = studioMountEpochRef.current
  const [, refreshStudioMountHandlers] = useState(0)
  const studioMountedRef = useRef<object | null>(null)
  const studioRequestRef = useRef<{ owner: typeof studioOwner; mount: object; route: string } | null>(null)
  const studioActiveOwnerRef = useRef(studioOwner)
  const studioOpenChangeRef = useRef(onOpenChange)
  studioOpenChangeRef.current = onOpenChange
  const checkpointRef = useRef<{
    owner: typeof studioOwner; mount: object; route: string; file: File;
    sessionId: string; kind: IngestIntentPayload['kind']; storagePath?: string;
    sessionCreated: boolean; staged: boolean; paused: boolean;
  } | null>(null)
  const isCurrentStudioRequest = (request: NonNullable<typeof studioRequestRef.current>) =>
    outerCurrent() && studioClosedOwnerRef.current !== request.owner && studioMountedRef.current === request.mount && studioOwnerRef.current === request.owner
      && studioRequestRef.current === request && readStudioRoute() === request.route

  const dialogCurrent = () => outerCurrent() && (!STUDIO_TEMPLATE_FLOW || (
    studioMountedRef.current === studioMountEpoch && studioOwnerRef.current === studioOwner
    && studioClosedOwnerRef.current !== studioOwner && readStudioRoute() === studioRoute
  ))
  const dialogCanStart = () => dialogCurrent() && outerCanStart()

  const reset = useCallback(() => {
    checkpointRef.current = null
    setFile(null)
    setPhase('idle')
    setProgress(0)
    setError(null)
    setDragActive(false)
  }, [])

  useLayoutEffect(() => {
    if (!STUDIO_TEMPLATE_FLOW) return
    studioMountedRef.current = studioMountEpochRef.current
    // Strict Mode replays setup after cleanup. Refresh committed handlers even
    // when there was no pending request/state reset to schedule a render.
    if (studioMountEpochRef.current !== studioMountEpoch) refreshStudioMountHandlers(value => value + 1)
    // A verification-paused handoff contains acknowledged facts, not active work.
    // Same-owner effect replay refreshes only its local mount ownership.
    const paused = checkpointRef.current
    if (paused?.paused && paused.owner === studioOwnerRef.current && paused.route === readStudioRoute()) {
      paused.mount = studioMountEpochRef.current
    }
    if (studioRequestRef.current) { studioRequestRef.current = null; reset() }
    return () => { studioMountedRef.current = null; studioMountEpochRef.current = {} }
  }, [reset])

  useLayoutEffect(() => {
    if (!STUDIO_TEMPLATE_FLOW || studioActiveOwnerRef.current === studioOwner) return
    studioActiveOwnerRef.current = studioOwner
    studioRequestRef.current = null
    reset()
  }, [studioOwner, reset])

  const handleOpenChange = useCallback((next: boolean) => {
    if (!outerCurrent()) return
    if (STUDIO_TEMPLATE_FLOW && (!studioMountedRef.current || studioOwnerRef.current !== studioOwner || studioMountEpochRef.current !== studioMountEpoch || readStudioRoute() !== studioRoute || studioClosedOwnerRef.current === studioOwner)) return
    if (STUDIO_TEMPLATE_FLOW && !next && studioRequestRef.current) return
    if (!next && busy && phase !== 'redirecting') return // don't close mid-upload
    if (!next) { if (STUDIO_TEMPLATE_FLOW) studioClosedOwnerRef.current = studioOwner; reset() }
    onOpenChange(next)
  }, [busy, phase, reset, onOpenChange, isCurrent, STUDIO_TEMPLATE_FLOW ? studioOwner : undefined, STUDIO_TEMPLATE_FLOW ? studioMountEpoch : undefined])

  const acceptFile = useCallback((candidate: File | null) => {
    if (!outerCanStart()) return
    if (STUDIO_TEMPLATE_FLOW && (studioClosedOwnerRef.current === studioOwner || !studioMountedRef.current || studioMountEpochRef.current !== studioMountEpoch || studioOwnerRef.current !== studioOwner || readStudioRoute() !== studioRoute || studioRequestRef.current)) return
    if (!candidate) return
    const validationError = validateIngestFile(candidate)
    if (validationError) {
      setError(validationError)
      if (checkpointRef.current?.paused) { setPhase('idle'); setProgress(0) }
      checkpointRef.current = null
      setFile(null)
      return
    }
    // Retaining the same paused File retains its acknowledged handoff stages.
    if (checkpointRef.current?.paused && checkpointRef.current.file === candidate) return
    if (checkpointRef.current?.paused) { setPhase('idle'); setProgress(0) }
    setError(null)
    checkpointRef.current = null
    setFile(candidate)
  }, [STUDIO_TEMPLATE_FLOW ? studioOwner : undefined, STUDIO_TEMPLATE_FLOW ? studioMountEpoch : undefined, isCurrent, canStart])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!dialogCurrent()) return
    setDragActive(false)
    if (busy) return
    acceptFile(event.dataTransfer?.files?.[0] ?? null)
  }, [busy, acceptFile, isCurrent])

  const handleStart = useCallback(async () => {
    if (!file || busy || !outerCanStart()) return
    const kind = fileKind(file.name)
    if (!kind) return
    if (STUDIO_TEMPLATE_FLOW && (studioClosedOwnerRef.current === studioOwner || !studioMountedRef.current || studioMountEpochRef.current !== studioMountEpoch || studioOwnerRef.current !== studioOwner || readStudioRoute() !== studioRoute || studioRequestRef.current)) return
    const studioRequest = STUDIO_TEMPLATE_FLOW
      ? { owner: studioOwner, mount: studioMountedRef.current!, route: readStudioRoute() } : null
    if (studioRequest) studioRequestRef.current = studioRequest

    const previous = checkpointRef.current
    const checkpoint = previous?.paused && previous.file === file
      && previous.owner === studioOwner && previous.mount === studioMountEpoch
      && previous.route === readStudioRoute() ? previous : {
        owner: studioOwner, mount: studioMountEpoch, route: readStudioRoute(), file,
        sessionId: crypto.randomUUID(), kind, sessionCreated: false, staged: false, paused: false,
        storagePath: undefined as string | undefined,
      }
    checkpointRef.current = checkpoint
    checkpoint.paused = false
    const newSessionId = checkpoint.sessionId
    const live = () => outerCurrent() && (!STUDIO_TEMPLATE_FLOW || isCurrentStudioRequest(studioRequest!))
    const pauseIfUnready = () => {
      if (outerCanStart()) return false
      checkpoint.paused = true
      setPhase('paused')
      setError('Verification paused this handoff. Its completed upload/session stages are retained in this dialog. Continue after verification; closing does not undo them.')
      return true
    }
    setError(null)

    try {
      if (!checkpoint.storagePath) {
        setPhase('uploading')
        setProgress(2)
        const uploadResult = await uploadFileToResearcher({
          sessionId: newSessionId,
          userId: user?.id ?? user?.email ?? 'anonymous',
          file,
          intent: 'template_ingest',
          onProgress: ({ percent }) => {
            if (!live()) return
            setProgress(Math.min(90, Math.max(2, Math.round(percent * 0.9))))
          },
        })
        if (!live()) return
        checkpoint.storagePath = uploadResult.storagePath
      }
      if (!live() || pauseIfUnready()) return

      // createNewSession idiom: create the DB row before navigating.
      if (!checkpoint.sessionCreated) {
        setPhase('session')
        setProgress(92)
        if (!live() || pauseIfUnready()) return
        const dbSession = await createSession(newSessionId, `Template: ${file.name}`)
        if (!live()) return
        if (!dbSession) throw new Error('Failed to create a new builder session')
        checkpoint.sessionCreated = true
      }
      if (!live() || pauseIfUnready()) return

      const payload: IngestIntentPayload = {
        storage_path: checkpoint.storagePath!,
        file_name: file.name,
        kind,
      }
      try {
        if (!checkpoint.staged) {
          sessionStorage.setItem(`${INGEST_INTENT_KEY_PREFIX}${newSessionId}`, JSON.stringify(payload))
          checkpoint.staged = true
        }
      } catch {
        throw new Error('Could not stage the ingest handoff (storage unavailable)')
      }

      // Commit the owned handoff before closing. The library parent unmounts
      // on this close; that intentional unmount must not suppress navigation.
      if (!live() || pauseIfUnready()) return
      setPhase('redirecting')
      setProgress(100)
      if (STUDIO_TEMPLATE_FLOW) studioOpenChangeRef.current(false)
      else onOpenChange(false)
      // Intentional close may unmount the child; only the OUTER owner can veto.
      if (!outerCurrent()) return
      // Round-3 fix (review N1/F8): HARD navigation, not an SPA route. The
      // shared WS hook keeps session A's socket OPEN across an SPA session-id
      // change, so B's one-shot intent could be sent over A's socket (and A's
      // frames could clear B's keys). A full page load destroys A's socket and
      // all in-memory state; the fresh mount connects under B only.
      // (Precedent: marketing cards navigate to /builder with
      // window.location.href.)
      window.location.assign(`/builder?session_id=${newSessionId}`)
    } catch (err) {
      if (!live()) return
      if (checkpointRef.current === checkpoint) checkpointRef.current = null
      const message = err instanceof Error ? err.message : 'Upload failed'
      console.error('[TemplateIngest] Upload failed:', err)
      setPhase('idle')
      setProgress(0)
      setError(message)
    } finally {
      if (studioRequest && isCurrentStudioRequest(studioRequest)) studioRequestRef.current = null
    }
  }, [file, busy, user, createSession, onOpenChange, isCurrent, canStart, STUDIO_TEMPLATE_FLOW ? studioOwner : undefined, STUDIO_TEMPLATE_FLOW ? studioMountEpoch : undefined])

  const phaseLabel = phase === 'uploading'
    ? 'Uploading presentation…'
    : phase === 'session'
      ? 'Preparing a new session…'
      : phase === 'redirecting'
        ? 'Opening builder…'
        : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent portalContainer={STUDIO_TEMPLATE_FLOW && open && typeof document !== 'undefined' ? document.fullscreenElement : undefined} data-studio-v4-shell={STUDIO_TEMPLATE_FLOW ? "true" : undefined} data-studio-template-flow={STUDIO_TEMPLATE_FLOW ? "import" : undefined} data-studio-v4-dialog={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'template-import' : undefined} className="sm:max-w-md">
        <DialogHeader className="studio-template-flow-header">
          {STUDIO_TEMPLATE_FLOW && <span className="studio-template-flow-eyebrow">Templates · Import a presentation</span>}
          <DialogTitle>Upload presentation</DialogTitle>
          <DialogDescription>
            Convert an existing PowerPoint or PDF deck into a reusable template.
            One file, up to 100MB.
          </DialogDescription>
        </DialogHeader>
        <TemplateFlowBody>

          <div
            role="button"
            aria-disabled={STUDIO_TEMPLATE_FLOW ? busy || !outerCanStart() : undefined}
            data-drag-active={STUDIO_TEMPLATE_FLOW ? dragActive : undefined}
            tabIndex={0}
            aria-label="Choose a presentation file"
            onClick={() => { if (!busy && dialogCanStart()) fileInputRef.current?.click() }}
            onKeyDown={(event) => {
              if (!busy && dialogCanStart() && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragOver={(event) => { event.preventDefault(); if (!busy && dialogCanStart()) setDragActive(true) }}
            onDragLeave={(event) => { event.preventDefault(); if (dialogCurrent()) setDragActive(false) }}
            onDrop={handleDrop}
            className={cn(
              'studio-template-flow-dropzone flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
              busy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
              dragActive
                ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
                : 'border-slate-300 hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(',')}
              className="hidden"
              disabled={busy || !outerCanStart()}
              onChange={(event) => {
                acceptFile(event.target.files?.[0] ?? null)
                event.target.value = ''
              }}
            />
            {file ? (
              <>
                <FileUp className="h-8 w-8 text-blue-500" />
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · {STUDIO_TEMPLATE_FLOW && busy ? 'file selected' : 'click to choose a different file'}
                </div>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-slate-400" />
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Drop a file here or click to browse
                </div>
                <div className="text-xs text-muted-foreground">.pptx, .ppt, or .pdf — max 100MB</div>
              </>
            )}
          </div>

          {STUDIO_TEMPLATE_FLOW && <p className="studio-template-flow-help">Upload this file, then continue conversion in a new Builder conversation.</p>}
          {phaseLabel && (
            <div className="space-y-2 studio-template-flow-progress" role={STUDIO_TEMPLATE_FLOW ? 'status' : undefined} aria-live={STUDIO_TEMPLATE_FLOW ? 'polite' : undefined} aria-busy={STUDIO_TEMPLATE_FLOW ? busy : undefined}>
              {STUDIO_TEMPLATE_FLOW && <ol className="studio-template-flow-phases" aria-label="Upload handoff progress">{(['uploading', 'session', 'redirecting'] as const).map((item, index) => {
                const current = ['uploading', 'session', 'redirecting'].indexOf(phase)
                const state = index < current ? 'done' : index === current ? 'active' : 'waiting'
                return <li key={item} data-phase-state={state} aria-current={state === 'active' ? 'step' : undefined}><span>{['Upload file', 'Prepare session', 'Open Builder'][index]}</span><small>{state === 'done' ? 'Done' : state === 'active' ? 'In progress' : 'Waiting'}</small></li>
              })}</ol>}
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{phaseLabel}</span>
              </div>
              <div role={STUDIO_TEMPLATE_FLOW ? "progressbar" : undefined} aria-label={STUDIO_TEMPLATE_FLOW ? "Upload and Builder handoff" : undefined} aria-valuemin={STUDIO_TEMPLATE_FLOW ? 0 : undefined} aria-valuemax={STUDIO_TEMPLATE_FLOW ? 100 : undefined} aria-valuenow={STUDIO_TEMPLATE_FLOW ? progress : undefined} className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div role={STUDIO_TEMPLATE_FLOW ? "alert" : undefined} className="studio-template-flow-error flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

        </TemplateFlowBody>
        <DialogFooter className="studio-template-flow-footer">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy && phase !== 'redirecting'}>
            Cancel
          </Button>
          <Button onClick={() => { void handleStart() }} disabled={!file || busy || !outerCanStart()}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Working…
              </>
            ) : (
              phase === 'paused' ? 'Continue handoff' : 'Upload & convert'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

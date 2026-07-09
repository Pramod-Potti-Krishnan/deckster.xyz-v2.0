"use client"

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

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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

type IngestDialogPhase = 'idle' | 'uploading' | 'session' | 'redirecting'

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
}

export function TemplateIngestDialog({ open, onOpenChange }: TemplateIngestDialogProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { createSession } = useChatSessions()

  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<IngestDialogPhase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const busy = phase !== 'idle'

  const reset = useCallback(() => {
    setFile(null)
    setPhase('idle')
    setProgress(0)
    setError(null)
    setDragActive(false)
  }, [])

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next && busy && phase !== 'redirecting') return // don't close mid-upload
    if (!next) reset()
    onOpenChange(next)
  }, [busy, phase, reset, onOpenChange])

  const acceptFile = useCallback((candidate: File | null) => {
    if (!candidate) return
    const validationError = validateIngestFile(candidate)
    if (validationError) {
      setError(validationError)
      setFile(null)
      return
    }
    setError(null)
    setFile(candidate)
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
    if (busy) return
    acceptFile(event.dataTransfer?.files?.[0] ?? null)
  }, [busy, acceptFile])

  const handleStart = useCallback(async () => {
    if (!file || busy) return
    const kind = fileKind(file.name)
    if (!kind) return

    setError(null)
    setPhase('uploading')
    setProgress(2)

    // Mint the new builder session id FIRST so the researcher session (and
    // therefore the storage path) lives under the session that will own the
    // ingest conversation.
    const newSessionId = crypto.randomUUID()

    try {
      const uploadResult = await uploadFileToResearcher({
        sessionId: newSessionId,
        userId: user?.id ?? user?.email ?? 'anonymous',
        file,
        intent: 'template_ingest',
        onProgress: ({ percent }) => setProgress(Math.min(90, Math.max(2, Math.round(percent * 0.9)))),
      })

      // createNewSession idiom: create the DB row before navigating.
      setPhase('session')
      setProgress(92)
      const dbSession = await createSession(newSessionId, `Template: ${file.name}`)
      if (!dbSession) {
        throw new Error('Failed to create a new builder session')
      }

      const payload: IngestIntentPayload = {
        storage_path: uploadResult.storagePath,
        file_name: file.name,
        kind,
      }
      try {
        sessionStorage.setItem(`${INGEST_INTENT_KEY_PREFIX}${newSessionId}`, JSON.stringify(payload))
      } catch {
        throw new Error('Could not stage the ingest handoff (storage unavailable)')
      }

      setPhase('redirecting')
      setProgress(100)
      onOpenChange(false)
      router.push(`/builder?session_id=${newSessionId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      console.error('[TemplateIngest] Upload failed:', err)
      setPhase('idle')
      setProgress(0)
      setError(message)
    }
  }, [file, busy, user, createSession, onOpenChange, router])

  const phaseLabel = phase === 'uploading'
    ? 'Uploading presentation…'
    : phase === 'session'
      ? 'Preparing a new session…'
      : phase === 'redirecting'
        ? 'Opening builder…'
        : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload presentation</DialogTitle>
          <DialogDescription>
            Convert an existing PowerPoint or PDF deck into a reusable template.
            One file, up to 100MB.
          </DialogDescription>
        </DialogHeader>

        <div
          role="button"
          tabIndex={0}
          aria-label="Choose a presentation file"
          onClick={() => { if (!busy) fileInputRef.current?.click() }}
          onKeyDown={(event) => {
            if (!busy && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          onDragOver={(event) => { event.preventDefault(); if (!busy) setDragActive(true) }}
          onDragLeave={(event) => { event.preventDefault(); setDragActive(false) }}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
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
            disabled={busy}
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
                {(file.size / 1024 / 1024).toFixed(1)} MB · click to choose a different file
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

        {phaseLabel && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{phaseLabel}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy && phase !== 'redirecting'}>
            Cancel
          </Button>
          <Button onClick={() => { void handleStart() }} disabled={!file || busy}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Working…
              </>
            ) : (
              'Upload & convert'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

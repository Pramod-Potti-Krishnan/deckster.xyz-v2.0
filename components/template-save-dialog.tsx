"use client"

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RotateCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  isTemplateGenerationReady,
  useTemplates,
  type SaveTemplateResult,
  type TemplateSnapshot,
} from '@/hooks/use-templates'

interface TemplateSaveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The WS session whose agreed deck Director will snapshot (source_session_id). */
  sessionId: string | null
  /** The session that produced the currently displayed deck URLs. */
  deckOwnerSessionId?: string | null
  /** The built presentation currently owned by that session. */
  sourcePresentationId?: string | null
  /** Promote the saved template into the active builder template. */
  onSavedTemplate?: (template: SaveTemplateResult) => void
  /** Clear the template from generation state if async optimization fails. */
  onTemplateOptimizationFailed?: (templateId: string) => void
}

const MAX_POLL_ATTEMPTS = 24
const POLL_INTERVAL_MS = 5000

function templateResultFromSnapshot(snapshot: TemplateSnapshot): SaveTemplateResult {
  return {
    id: snapshot.id,
    name: snapshot.name,
    slide_count: snapshot.slide_count ?? snapshot.template_blueprint?.slides?.length ?? 0,
    created_at: snapshot.created_at,
    blueprint_generation_method: snapshot.blueprint_generation_method ?? snapshot.template_blueprint?.generation_method,
    blueprint_enrichment_status: snapshot.blueprint_enrichment_status,
    blueprint_enrichment_error: snapshot.blueprint_enrichment_error,
    blueprint_enriched_at: snapshot.blueprint_enriched_at,
  }
}

/**
 * "Save as Template" dialog. Captures a name and asks Director to freeze the
 * current deck's design (structure + theme, content → typed slots) for reuse.
 * Director builds the snapshot from the session's strawman + the frozen plans
 * captured during the build. See TEMPLATE_PLAN.md §1/§3.
 */
export function TemplateSaveDialog({
  open,
  onOpenChange,
  sessionId,
  deckOwnerSessionId,
  sourcePresentationId,
  onSavedTemplate,
  onTemplateOptimizationFailed,
}: TemplateSaveDialogProps) {
  const { toast } = useToast()
  const { getTemplate, reoptimizeTemplate, saveTemplate, loading } = useTemplates()
  const [name, setName] = useState('')
  const [trackedTemplate, setTrackedTemplate] = useState<SaveTemplateResult | null>(null)
  const [polling, setPolling] = useState(false)
  const [pollToken, setPollToken] = useState(0)

  const startStatusPolling = useCallback((template: SaveTemplateResult) => {
    setTrackedTemplate(template)
    if (isTemplateGenerationReady(template) || template.blueprint_enrichment_status === 'failed') {
      setPolling(false)
      return
    }
    setPolling(true)
    setPollToken((value) => value + 1)
  }, [])

  useEffect(() => {
    const templateId = trackedTemplate?.id
    if (!templateId || !polling) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async (attempt: number) => {
      const snapshot = await getTemplate(templateId)
      if (cancelled) return

      if (snapshot) {
        const next = templateResultFromSnapshot(snapshot)
        setTrackedTemplate(next)

        if (isTemplateGenerationReady(next)) {
          setPolling(false)
          onSavedTemplate?.(next)
          toast({
            title: 'Template ready',
            description: `"${next.name}" is ready to reuse.`,
          })
          return
        }

        if (next.blueprint_enrichment_status === 'failed') {
          setPolling(false)
          onTemplateOptimizationFailed?.(next.id)
          toast({
            title: 'Template optimization failed',
            description: next.blueprint_enrichment_error || 'Review is available; retry optimization from this dialog or the template picker.',
            variant: 'destructive',
          })
          return
        }
      }

      if (attempt >= MAX_POLL_ATTEMPTS) {
        setPolling(false)
        toast({
          title: 'Template still optimizing',
          description: 'Review is available now. Reopen Available Templates to refresh readiness before reuse.',
        })
        return
      }

      timer = setTimeout(() => void poll(attempt + 1), POLL_INTERVAL_MS)
    }

    timer = setTimeout(() => void poll(1), POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [getTemplate, onSavedTemplate, onTemplateOptimizationFailed, polling, pollToken, toast, trackedTemplate?.id])

  const handleRetryOptimization = async () => {
    if (!trackedTemplate) return
    const result = await reoptimizeTemplate(trackedTemplate.id)
    if (!result) {
      toast({
        title: 'Could not retry optimization',
        description: 'Director could not start template optimization. Please try again.',
        variant: 'destructive',
      })
      return
    }
    const next = {
      ...trackedTemplate,
      blueprint_enrichment_status: result.blueprint_enrichment_status ?? 'queued',
      blueprint_enrichment_error: result.blueprint_enrichment_error ?? null,
      blueprint_enriched_at: result.blueprint_enriched_at,
    }
    toast({
      title: 'Optimizing template',
      description: `"${trackedTemplate.name}" will unlock for generation when optimization completes.`,
    })
    startStatusPolling(next)
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast({ title: 'Name required', description: 'Give your template a name.', variant: 'destructive' })
      return
    }
    if (!sessionId) {
      toast({ title: 'No deck to save', description: 'Build and agree a deck first.', variant: 'destructive' })
      return
    }
    if (!sourcePresentationId) {
      toast({ title: 'No completed deck to save', description: 'Build a deck before saving a template.', variant: 'destructive' })
      return
    }
    if (!deckOwnerSessionId || deckOwnerSessionId !== sessionId) {
      toast({
        title: 'Deck/session mismatch',
        description: 'Refresh this session before saving the deck as a template.',
        variant: 'destructive',
      })
      return
    }
    const result = await saveTemplate({
      name: trimmed,
      sourceSessionId: sessionId,
      sourcePresentationId,
    })
    if (result) {
      onSavedTemplate?.(result)
      const generationReady = isTemplateGenerationReady(result)
      toast({
        title: 'Template saved',
        description: !generationReady
          ? `"${result.name}" (${result.slide_count} slides) is saved. Optimizing template...`
          : `"${result.name}" (${result.slide_count} slides) is ready to reuse.`,
      })
      startStatusPolling(result)
      setName('')
      if (generationReady) onOpenChange(false)
    } else {
      toast({
        title: 'Could not save template',
        description: 'The deck may not be finished yet, or the service is unreachable.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Lock this deck&apos;s structure, layout and theme so you can reuse it later
            with fresh content. The content is replaced by typed slots — nothing you typed
            is stored as-is.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="template-name">Template name</Label>
          <Input
            id="template-name"
            placeholder="e.g. Monthly Revenue Report"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSave() }}
            autoFocus
            disabled={loading}
          />
        </div>
        {trackedTemplate && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {isTemplateGenerationReady(trackedTemplate) ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="font-medium">Ready to reuse</span>
              </div>
            ) : trackedTemplate.blueprint_enrichment_status === 'failed' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <span className="font-medium">Optimization failed</span>
                </div>
                {trackedTemplate.blueprint_enrichment_error && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {trackedTemplate.blueprint_enrichment_error}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRetryOptimization()}
                  disabled={loading}
                >
                  <RotateCw className="mr-2 h-3.5 w-3.5" />
                  Retry optimization
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                <span className="font-medium">Optimizing template...</span>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {trackedTemplate ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={loading || !name.trim() || !sessionId || !sourcePresentationId || deckOwnerSessionId !== sessionId}
          >
            {loading ? 'Saving…' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

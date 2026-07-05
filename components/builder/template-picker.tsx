"use client"

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, LayoutTemplate, Loader2, RotateCw } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  isTemplateGenerationReady,
  templateGenerationStatus,
  templateGenerationStatusLabel,
  templateGenerationUnavailableReason,
  useTemplates,
  type SavedTemplate,
  type TemplateSelection,
} from '@/hooks/use-templates'

type TemplatePickerMode = 'generation' | 'review'

interface TemplatePickerProps {
  onSelect: (template: TemplateSelection) => void
  disabled?: boolean
  mode?: TemplatePickerMode
}

interface TemplatePickerContentProps {
  onSelect: (template: TemplateSelection) => void
  isOpen?: boolean
  label?: string
  mode?: TemplatePickerMode
}

export function TemplatePickerContent({
  onSelect,
  isOpen = true,
  label = 'Reuse a template',
  mode = 'generation',
}: TemplatePickerContentProps) {
  const { toast } = useToast()
  const { listTemplates, loading, reoptimizeTemplate } = useTemplates()
  const [templates, setTemplates] = useState<SavedTemplate[] | null>(null)

  const refresh = useCallback(async () => {
    const res = await listTemplates()
    setTemplates(res?.templates ?? [])
  }, [listTemplates])

  useEffect(() => {
    if (isOpen) void refresh()
  }, [isOpen, refresh])

  const toSelection = (template: SavedTemplate): TemplateSelection => ({
    id: template.id,
    name: template.name,
    blueprint_generation_method: template.blueprint_generation_method,
    blueprint_enrichment_status: template.blueprint_enrichment_status,
    blueprint_enrichment_error: template.blueprint_enrichment_error,
  })

  const handleTemplateClick = (template: SavedTemplate) => {
    const ready = isTemplateGenerationReady(template)
    if (mode === 'generation' && !ready) {
      const status = templateGenerationStatus(template)
      toast({
        title: status === 'failed'
          ? 'Template not ready'
          : status === 'optimizing'
            ? 'Template optimizing'
            : 'Template needs optimization',
        description: templateGenerationUnavailableReason(template),
        variant: status === 'failed' ? 'destructive' : undefined,
      })
      return
    }
    onSelect(toSelection(template))
  }

  const handleRetryOptimization = async (template: SavedTemplate) => {
    const result = await reoptimizeTemplate(template.id)
    if (!result) {
      toast({
        title: 'Could not retry optimization',
        description: 'Director could not start template optimization. Please try again.',
        variant: 'destructive',
      })
      return
    }
    toast({
      title: 'Optimizing template',
      description: `"${template.name}" will unlock for generation when optimization completes.`,
    })
    await refresh()
  }

  return (
    <>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {loading && templates === null ? (
        <div className="flex items-center gap-2 px-2 py-3 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="px-2 py-3 text-sm text-gray-500">
          No saved templates yet. Build a deck and use “Save as Template”.
        </div>
      ) : (
        templates.map((t) => {
          const ready = isTemplateGenerationReady(t)
          const status = templateGenerationStatus(t)
          const failed = status === 'failed'
          const optimizing = status === 'optimizing'
          const needsOptimization = status === 'needs_optimization'
          const statusLabel = templateGenerationStatusLabel(t)
          return (
            <DropdownMenuItem
              key={t.id}
              className={cn(
                "flex-col items-start gap-0.5",
                mode === 'generation' && !ready ? "cursor-not-allowed opacity-90" : "cursor-pointer",
              )}
              onSelect={(event) => {
                if (mode === 'generation' && !ready) event.preventDefault()
              }}
              onClick={() => handleTemplateClick(t)}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium">{t.name}</span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    ready && "bg-emerald-50 text-emerald-700",
                    failed && "bg-rose-50 text-rose-700",
                    optimizing && "bg-amber-50 text-amber-700",
                    needsOptimization && "bg-slate-100 text-slate-600",
                  )}
                >
                  {ready
                    ? <CheckCircle2 className="h-3 w-3" />
                    : optimizing
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <AlertTriangle className="h-3 w-3" />}
                  {statusLabel}
                </span>
              </span>
              <span className="text-xs text-gray-500">
                {t.slide_count != null ? `${t.slide_count} slides` : 'template'}
                {t.description ? ` · ${t.description}` : ''}
              </span>
              {!ready && (
                <span className="flex w-full items-center justify-between gap-2 pt-0.5 text-[11px] text-gray-500">
                  <span>
                    {mode === 'generation'
                      ? optimizing ? 'Review only until ready' : 'Needs optimization before generation'
                      : 'Review available'}
                  </span>
                  {failed && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-rose-700 hover:bg-rose-50"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        void handleRetryOptimization(t)
                      }}
                    >
                      <RotateCw className="h-3 w-3" />
                      Retry
                    </button>
                  )}
                </span>
              )}
            </DropdownMenuItem>
          )
        })
      )}
    </>
  )
}

/**
 * In-chat template picker — a sibling of the attach button. Click → lists the
 * user's saved templates → selecting one "locks it in" (handled by the parent,
 * which then carries template_mode/template_id on the next send). See
 * TEMPLATE_PLAN.md §6 (retrieval = in-chat control beside attach).
 */
export function TemplatePicker({ onSelect, disabled, mode = 'generation' }: TemplatePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center rounded-lg p-1.5 text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-200 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          title="Reuse a saved template"
          aria-label="Reuse a saved template"
        >
          <LayoutTemplate className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <TemplatePickerContent onSelect={onSelect} isOpen={open} mode={mode} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

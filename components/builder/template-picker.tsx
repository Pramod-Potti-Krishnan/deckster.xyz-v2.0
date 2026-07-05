"use client"

import { useCallback, useEffect, useState } from 'react'
import { LayoutTemplate, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  isTemplateGenerationReady,
  useTemplates,
  type SavedTemplate,
  type TemplateSelection,
} from '@/hooks/use-templates'

interface TemplatePickerProps {
  onSelect: (template: TemplateSelection) => void
  disabled?: boolean
}

interface TemplatePickerContentProps {
  onSelect: (template: TemplateSelection) => void
  isOpen?: boolean
  label?: string
}

export function TemplatePickerContent({
  onSelect,
  isOpen = true,
  label = 'Reuse a template',
}: TemplatePickerContentProps) {
  const { listTemplates, loading } = useTemplates()
  const [templates, setTemplates] = useState<SavedTemplate[] | null>(null)

  const refresh = useCallback(async () => {
    const res = await listTemplates()
    setTemplates(res?.templates ?? [])
  }, [listTemplates])

  useEffect(() => {
    if (isOpen) void refresh()
  }, [isOpen, refresh])

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
        templates.map((t) => (
          <DropdownMenuItem
            key={t.id}
            className="cursor-pointer flex-col items-start gap-0.5"
            onClick={() => onSelect({
              id: t.id,
              name: t.name,
              blueprint_generation_method: t.blueprint_generation_method,
              blueprint_enrichment_status: t.blueprint_enrichment_status,
              blueprint_enrichment_error: t.blueprint_enrichment_error,
            })}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{t.name}</span>
              {!isTemplateGenerationReady(t) && (
                <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  Optimizing
                </span>
              )}
            </span>
            <span className="text-xs text-gray-500">
              {t.slide_count != null ? `${t.slide_count} slides` : 'template'}
              {t.description ? ` · ${t.description}` : ''}
            </span>
          </DropdownMenuItem>
        ))
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
export function TemplatePicker({ onSelect, disabled }: TemplatePickerProps) {
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
        <TemplatePickerContent onSelect={onSelect} isOpen={open} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

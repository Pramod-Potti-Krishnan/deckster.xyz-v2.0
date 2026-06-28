"use client"

import { Image as ImageIcon, Lock, Rows3, Variable } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TemplateSnapshot } from '@/hooks/use-templates'
import {
  getFrozenPlanEntry,
  getLayoutPlan,
  getRenderedImageUrl,
  getRenderSpecs,
  getTemplateModeElements,
  getTemplateSlot,
  summarizeRecord,
} from '@/lib/template-mode'

interface TemplateModeInspectorProps {
  snapshot: TemplateSnapshot | null
  currentSlideIndex: number
  loading?: boolean
}

function ConstantRow({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  if (!value) return null
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-1 flex items-center gap-1.5 font-semibold uppercase text-slate-500">
        <Lock className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="break-words text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  )
}

function VariableRow({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  if (!value) return null
  return (
    <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs dark:border-violet-900 dark:bg-violet-950/40">
      <div className="mb-1 flex items-center gap-1.5 font-semibold uppercase text-violet-600 dark:text-violet-300">
        <Variable className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="break-words text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  )
}

export function TemplateModeInspector({
  snapshot,
  currentSlideIndex,
  loading,
}: TemplateModeInspectorProps) {
  const slot = getTemplateSlot(snapshot, currentSlideIndex)
  const frozenEntry = getFrozenPlanEntry(snapshot, currentSlideIndex)
  const layoutPlan = getLayoutPlan(frozenEntry)
  const elements = getTemplateModeElements(snapshot, currentSlideIndex)
  const renderSpecs = getRenderSpecs(layoutPlan)
  const lockedImages = renderSpecs
    .map(getRenderedImageUrl)
    .filter((url): url is string => Boolean(url))

  const selectedPattern = typeof layoutPlan?.selected_pattern === 'string'
    ? layoutPlan.selected_pattern
    : null
  const layoutRationale = typeof layoutPlan?.layout_rationale === 'string'
    ? layoutPlan.layout_rationale
    : null
  const accessoryPlan = typeof layoutPlan?.accessory_plan === 'string'
    ? layoutPlan.accessory_plan
    : summarizeRecord(layoutPlan?.accessory_plan)
  const themeSummary = summarizeRecord(layoutPlan?.theme_aliases)
    ?? summarizeRecord(layoutPlan?.theme_css_variables)
    ?? summarizeRecord(layoutPlan?.theme_color_ramps)

  const hasFrozenPlan = Boolean(layoutPlan && (renderSpecs.length > 0 || selectedPattern))

  return (
    <aside
      className={cn(
        "hidden w-[340px] shrink-0 border-l border-slate-200 bg-white/95 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-100 xl:flex",
        "min-h-0 flex-col"
      )}
    >
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
              Template Mode
            </div>
            <h3 className="mt-0.5 truncate text-sm font-semibold">
              {snapshot?.name || 'Template snapshot'}
            </h3>
          </div>
          <Badge variant="outline" className="shrink-0">
            Slide {currentSlideIndex + 1}
          </Badge>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            Loading template snapshot...
          </div>
        ) : !snapshot ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            Select an available template to inspect its saved structure.
          </div>
        ) : !hasFrozenPlan ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Rows3 className="h-4 w-4 text-violet-500" />
              Hero design locked
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Title regenerates from the new period while the hero design stays locked.
            </p>
            {slot?.abstract_intent && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {slot.abstract_intent}
              </p>
            )}
          </div>
        ) : (
          <>
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Constants
                </h4>
                <Badge variant="secondary">{elements.length || renderSpecs.length}</Badge>
              </div>
              <ConstantRow label="Blueprint" value={selectedPattern} />
              <ConstantRow label="Accessory plan" value={accessoryPlan} />
              <ConstantRow label="Theme" value={themeSummary} />
              {elements.map((element) => (
                <ConstantRow
                  key={`geometry-${element.overrideKey}`}
                  label={`${element.role} geometry`}
                  value={element.geometry}
                />
              ))}
              {lockedImages.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Locked image
                  </div>
                  <img
                    src={url}
                    alt=""
                    className="h-28 w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Variables
              </h4>
              <VariableRow label="Slide role" value={slot?.abstract_intent || slot?.key_message || null} />
              {elements.map((element) => (
                <VariableRow
                  key={`variable-${element.overrideKey}`}
                  label={element.label}
                  value={element.contentIntent}
                />
              ))}
            </section>

            {(layoutRationale || selectedPattern || slot?.abstract_intent) && (
              <section className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {layoutRationale && <p>{layoutRationale}</p>}
                {selectedPattern && <p className="mt-2">Pattern: {selectedPattern}</p>}
                {slot?.abstract_intent && <p className="mt-2">{slot.abstract_intent}</p>}
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  )
}

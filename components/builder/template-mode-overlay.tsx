"use client"

import { Info, Lock, Pencil, Rows3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TemplateSnapshot } from '@/hooks/use-templates'
import {
  asRecord,
  getFrozenPlanEntry,
  getLayoutPlan,
  getTemplateModeElements,
  getTemplateSlot,
  summarizeRecord,
  type TemplateModeElement,
} from '@/lib/template-mode'

interface TemplateModeOverlayProps {
  snapshot: TemplateSnapshot | null
  currentSlideIndex: number
  loading?: boolean
  selectedElementId?: string | null
  onSelectElement?: (overrideKey: string | null) => void
}

const GRID_COLUMNS = 32
const GRID_ROWS = 18

function isVariableElement(element: TemplateModeElement): boolean {
  const atomType = element.atomType.toUpperCase()
  return atomType.includes('TEXT') || atomType.includes('METRICS')
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getConstantValue(element: TemplateModeElement): string {
  const atomType = element.atomType.toUpperCase()
  const renderSpec = element.renderSpec

  if (atomType.includes('IMAGE')) return 'Image - locked'

  if (atomType.includes('CHART')) {
    const chartHints = asRecord(renderSpec.chart_hints)
    const chartType = textValue(chartHints?.chart_type) ?? textValue(renderSpec.chart_type)
    return chartType ? `Chart - ${chartType.replace(/_/g, ' ')}` : 'Chart structure'
  }

  if (atomType.includes('INFOGRAPHIC')) {
    const infographicHints = asRecord(renderSpec.infographic_hints)
    const segmentCount = infographicHints?.segment_count
    return typeof segmentCount === 'number'
      ? `Infographic - ${segmentCount} segments`
      : 'Infographic structure'
  }

  if (atomType.includes('DIAGRAM')) return 'Diagram structure'
  if (atomType.includes('TABLE')) return 'Table structure'

  return `${element.role} structure`
}

function getVariableLabel(element: TemplateModeElement): string {
  return element.contentIntent
    ? `${element.role} - ${element.contentIntent}`
    : element.role
}

function pct(value: number, total: number): string {
  return `${(Math.max(0, value) / total) * 100}%`
}

export function TemplateModeOverlay({
  snapshot,
  currentSlideIndex,
  loading,
  selectedElementId,
  onSelectElement,
}: TemplateModeOverlayProps) {
  const slot = getTemplateSlot(snapshot, currentSlideIndex)
  const frozenEntry = getFrozenPlanEntry(snapshot, currentSlideIndex)
  const layoutPlan = getLayoutPlan(frozenEntry)
  const elements = getTemplateModeElements(snapshot, currentSlideIndex)
    .filter((element) => element.gridRect)

  const selectedPattern = textValue(layoutPlan?.selected_pattern)
  const accessoryPlan = textValue(layoutPlan?.accessory_plan) ?? summarizeRecord(layoutPlan?.accessory_plan, 3)
  const themeSummary = summarizeRecord(layoutPlan?.theme_aliases, 3)
    ?? summarizeRecord(layoutPlan?.theme_css_variables, 3)
    ?? summarizeRecord(layoutPlan?.theme_color_ramps, 3)
  const showLockedChip = !loading && snapshot && elements.length === 0

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-sm">
      <div className="absolute left-3 top-3 z-30 flex max-w-[70%] flex-wrap items-center gap-2">
        <div className="rounded-full border border-white/70 bg-slate-950/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-lg backdrop-blur">
          Template overlay
        </div>
        <div className="rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-slate-700 shadow-lg backdrop-blur dark:bg-slate-950/90 dark:text-slate-200">
          Slide {currentSlideIndex + 1}
        </div>
      </div>

      <div className="absolute right-3 top-3 z-30 flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-slate-700 shadow-lg backdrop-blur dark:bg-slate-950/90 dark:text-slate-200">
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Constant
        </span>
        <span className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
        <span className="inline-flex items-center gap-1">
          <Pencil className="h-3 w-3" />
          Variable
        </span>
      </div>

      {(selectedPattern || accessoryPlan || themeSummary) && (
        <details className="pointer-events-auto absolute bottom-3 left-3 z-30 max-w-[340px] rounded-md border border-white/70 bg-white/95 text-xs text-slate-700 shadow-lg backdrop-blur dark:bg-slate-950/95 dark:text-slate-200">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 font-semibold">
            <Info className="h-3.5 w-3.5 text-violet-500" />
            Slide info
          </summary>
          <div className="space-y-1 border-t border-slate-200 px-2.5 py-2 dark:border-slate-800">
            {selectedPattern && <p><span className="font-semibold">Blueprint:</span> {selectedPattern}</p>}
            {accessoryPlan && <p><span className="font-semibold">Accessory:</span> {accessoryPlan}</p>}
            {themeSummary && <p><span className="font-semibold">Theme:</span> {themeSummary}</p>}
          </div>
        </details>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full border border-white/70 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-lg backdrop-blur dark:bg-slate-950/95 dark:text-slate-200">
            Loading template structure...
          </div>
        </div>
      )}

      {showLockedChip && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full border border-violet-200 bg-white/95 px-4 py-2 text-sm font-semibold text-violet-700 shadow-xl backdrop-blur dark:border-violet-800 dark:bg-slate-950/95 dark:text-violet-200">
            <span className="inline-flex items-center gap-2">
              <Rows3 className="h-4 w-4" />
              {slot?.canvas_type?.toUpperCase().startsWith('H') ? 'Hero design locked' : 'Design locked'}
            </span>
          </div>
        </div>
      )}

      {elements.map((element) => {
        const rect = element.gridRect
        if (!rect) return null
        const variable = isVariableElement(element)
        const selected = selectedElementId === element.overrideKey

        return (
          <button
            key={element.overrideKey}
            type="button"
            className={cn(
              "pointer-events-auto absolute overflow-hidden rounded-md px-2 py-1 text-left text-[10px] leading-tight shadow-lg transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1",
              variable
                ? "border-2 border-dashed border-violet-400 bg-violet-50/90 text-violet-950 hover:bg-violet-100/95 dark:bg-violet-950/75 dark:text-violet-50"
                : "border border-slate-300 bg-slate-50/90 text-slate-800 hover:bg-white/95 dark:border-slate-600 dark:bg-slate-950/75 dark:text-slate-100",
              selected && "ring-2 ring-violet-500 ring-offset-2"
            )}
            style={{
              left: pct(rect.x, GRID_COLUMNS),
              top: pct(rect.y, GRID_ROWS),
              width: pct(rect.w, GRID_COLUMNS),
              height: pct(rect.h, GRID_ROWS),
            }}
            onClick={(event) => {
              event.stopPropagation()
              onSelectElement?.(element.overrideKey)
            }}
          >
            <span className="flex h-full min-h-0 items-start gap-1.5">
              {variable ? (
                <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {variable ? element.role : getConstantValue(element)}
                </span>
                <span className="mt-0.5 line-clamp-2 block opacity-80">
                  {variable ? getVariableLabel(element) : element.atomType}
                </span>
                {!variable && element.renderedImageUrl && (
                  <img
                    src={element.renderedImageUrl}
                    alt=""
                    className="mt-1 h-8 w-12 rounded-sm object-cover"
                    loading="lazy"
                  />
                )}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

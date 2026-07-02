"use client"

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Database,
  Image as ImageIcon,
  Info,
  Lock,
  Minimize2,
  Pencil,
  Plus,
  Rows3,
  Type,
  Unlock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  TemplateAtomContract,
  TemplateBlueprint,
  TemplateBlueprintElement,
  TemplateBlueprintMissingDataPolicy,
  TemplateBlueprintSlide,
  TemplateSnapshot,
} from '@/hooks/use-templates'
import {
  asRecord,
  getBlueprintSlide,
  getFrozenPlanEntry,
  getLayoutPlan,
  getTemplateBlueprint,
  getTemplateModeElements,
  getTemplateSlot,
  summarizeRecord,
  type TemplateGridRect,
  type TemplateModeElement,
} from '@/lib/template-mode'
import { updateElement } from './template-params-panel'

interface TemplateModeOverlayProps {
  snapshot: TemplateSnapshot | null
  currentSlideIndex: number
  loading?: boolean
  selectedElementId?: string | null
  blueprintEditorV2Enabled?: boolean
  onSelectElement?: (overrideKey: string | null) => void
  onBlueprintChange?: (blueprint: TemplateBlueprint) => void
}

const GRID_COLUMNS = 32
const GRID_ROWS = 18

type AtomGroup = 'TEXT' | 'IMAGE' | 'CHART' | 'DIAGRAM' | 'INFOGRAPHIC' | 'METRIC' | 'TABLE' | 'KANBAN' | 'UNKNOWN'

const ATOM_STYLES: Record<AtomGroup, {
  label: string
  border: string
  bg: string
  text: string
  chip: string
}> = {
  TEXT: {
    label: 'Text',
    border: 'border-sky-400',
    bg: 'bg-sky-50/90 dark:bg-sky-950/75',
    text: 'text-sky-950 dark:text-sky-50',
    chip: 'bg-sky-500',
  },
  IMAGE: {
    label: 'Image',
    border: 'border-emerald-400',
    bg: 'bg-emerald-50/90 dark:bg-emerald-950/75',
    text: 'text-emerald-950 dark:text-emerald-50',
    chip: 'bg-emerald-500',
  },
  CHART: {
    label: 'Chart',
    border: 'border-orange-500',
    bg: 'bg-orange-50/90 dark:bg-orange-950/75',
    text: 'text-orange-950 dark:text-orange-50',
    chip: 'bg-orange-500',
  },
  DIAGRAM: {
    label: 'Diagram',
    border: 'border-indigo-500',
    bg: 'bg-indigo-50/90 dark:bg-indigo-950/75',
    text: 'text-indigo-950 dark:text-indigo-50',
    chip: 'bg-indigo-500',
  },
  INFOGRAPHIC: {
    label: 'Infographic',
    border: 'border-fuchsia-500',
    bg: 'bg-fuchsia-50/90 dark:bg-fuchsia-950/75',
    text: 'text-fuchsia-950 dark:text-fuchsia-50',
    chip: 'bg-fuchsia-500',
  },
  METRIC: {
    label: 'Metric',
    border: 'border-violet-500',
    bg: 'bg-violet-50/90 dark:bg-violet-950/75',
    text: 'text-violet-950 dark:text-violet-50',
    chip: 'bg-violet-500',
  },
  TABLE: {
    label: 'Table',
    border: 'border-teal-500',
    bg: 'bg-teal-50/90 dark:bg-teal-950/75',
    text: 'text-teal-950 dark:text-teal-50',
    chip: 'bg-teal-500',
  },
  KANBAN: {
    label: 'Kanban',
    border: 'border-rose-500',
    bg: 'bg-rose-50/90 dark:bg-rose-950/75',
    text: 'text-rose-950 dark:text-rose-50',
    chip: 'bg-rose-500',
  },
  UNKNOWN: {
    label: 'Element',
    border: 'border-slate-400',
    bg: 'bg-slate-50/90 dark:bg-slate-950/75',
    text: 'text-slate-900 dark:text-slate-100',
    chip: 'bg-slate-500',
  },
}

const MISSING_DATA_LABELS: Record<TemplateBlueprintMissingDataPolicy, string> = {
  ask_user: 'Ask user',
  assume_and_continue: 'Assume and continue',
  reuse_prior_as_placeholder: 'Reuse prior as placeholder',
}

const MISSING_DATA_OPTIONS: TemplateBlueprintMissingDataPolicy[] = [
  'ask_user',
  'assume_and_continue',
  'reuse_prior_as_placeholder',
]

function isVariableElement(element: TemplateModeElement): boolean {
  if (element.fixedness) return element.fixedness === 'variable'
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
  return element.contentIntent ?? element.label ?? element.role
}

function pct(value: number, total: number): string {
  return `${(Math.max(0, value) / total) * 100}%`
}

function gridLinePct(line: number, total: number): string {
  return pct(line - 1, total)
}

function getAtomGroup(element: TemplateModeElement): AtomGroup {
  const contractKind = element.blueprintElement?.atom_contract?.kind ?? ''
  const text = `${element.atomType} ${element.role} ${contractKind}`.toUpperCase()
  if (text.includes('KANBAN') || text.includes('GANTT')) return 'KANBAN'
  if (text.includes('METRIC')) return 'METRIC'
  if (text.includes('CHART')) return 'CHART'
  if (text.includes('TABLE')) return 'TABLE'
  if (text.includes('DIAGRAM')) return 'DIAGRAM'
  if (text.includes('INFOGRAPHIC')) return 'INFOGRAPHIC'
  if (text.includes('IMAGE')) return 'IMAGE'
  if (text.includes('TEXT') || text.includes('INTRO') || text.includes('TAKEAWAY')) return 'TEXT'
  return 'UNKNOWN'
}

function isDataAtom(element: TemplateModeElement): boolean {
  return ['METRIC', 'CHART', 'TABLE', 'KANBAN', 'DIAGRAM', 'INFOGRAPHIC'].includes(getAtomGroup(element))
}

function lockPolicyFor(element: TemplateBlueprintElement | null): 'lock_exact' | 'regenerate' {
  if (element?.lock_policy === 'lock_exact' || element?.lock_policy === 'regenerate') {
    return element.lock_policy
  }
  return element?.fixedness === 'locked_media' || element?.fixedness === 'constant'
    ? 'lock_exact'
    : 'regenerate'
}

function contractFor(element: TemplateModeElement): TemplateAtomContract | null {
  return element.blueprintElement?.atom_contract ?? null
}

function storageKey(slideIndex: number, overrideKey: string): string {
  return `deckster_template_overlay_box_${slideIndex}_${overrideKey}`
}

function compactText(value: string | null | undefined, fallback: string): string {
  return value && value.trim() ? value.trim() : fallback
}

function elementBoxStyle(rect: TemplateGridRect, expanded: boolean) {
  const leftGrid = Math.max(0, rect.x - 1)
  const topGrid = Math.max(0, rect.y - 1)
  const widthGrid = Math.max(0, rect.w)
  const heightGrid = Math.max(0, rect.h)
  const left = (leftGrid / GRID_COLUMNS) * 100
  const top = (topGrid / GRID_ROWS) * 100
  const width = (widthGrid / GRID_COLUMNS) * 100
  const height = (heightGrid / GRID_ROWS) * 100

  if (!expanded) {
    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
    }
  }

  const maxRightGrid = GRID_COLUMNS - 1
  const maxBottomGrid = GRID_ROWS - 1
  const originalRightGrid = leftGrid + widthGrid
  const originalBottomGrid = topGrid + heightGrid
  const targetArea = Math.max(widthGrid * heightGrid, 80)
  const preferredWidthGrid = Math.max(widthGrid, Math.ceil(Math.sqrt(targetArea * 2.2)))

  const rightCapacity = maxRightGrid - leftGrid
  const leftCapacity = originalRightGrid
  const useRightExpansion = rightCapacity >= preferredWidthGrid || rightCapacity >= leftCapacity
  const expandedWidthGrid = Math.min(
    maxRightGrid,
    Math.max(
      Math.min(widthGrid, maxRightGrid),
      Math.min(preferredWidthGrid, Math.max(rightCapacity, leftCapacity)),
    ),
  )
  const expandedLeftGrid = useRightExpansion
    ? Math.min(leftGrid, maxRightGrid - expandedWidthGrid)
    : Math.max(0, Math.min(originalRightGrid, maxRightGrid) - expandedWidthGrid)
  const expandedHeightGrid = Math.max(heightGrid, Math.ceil(targetArea / Math.max(expandedWidthGrid, 1)))
  const downCapacity = maxBottomGrid - topGrid
  const upCapacity = originalBottomGrid
  const useDownExpansion = downCapacity >= expandedHeightGrid || downCapacity >= upCapacity
  const finalHeightGrid = Math.min(
    maxBottomGrid,
    Math.max(
      Math.min(heightGrid, maxBottomGrid),
      Math.min(expandedHeightGrid, Math.max(downCapacity, upCapacity)),
    ),
  )
  const expandedTopGrid = useDownExpansion
    ? Math.min(topGrid, maxBottomGrid - finalHeightGrid)
    : Math.max(0, Math.min(originalBottomGrid, maxBottomGrid) - finalHeightGrid)

  return {
    left: `${(expandedLeftGrid / GRID_COLUMNS) * 100}%`,
    top: `${(expandedTopGrid / GRID_ROWS) * 100}%`,
    width: `${(expandedWidthGrid / GRID_COLUMNS) * 100}%`,
    height: `${(finalHeightGrid / GRID_ROWS) * 100}%`,
  }
}

function intentBoxStyle(rect: TemplateGridRect, expanded: boolean) {
  if (!expanded) {
    return {
      left: gridLinePct(rect.x, GRID_COLUMNS),
      top: gridLinePct(rect.y, GRID_ROWS),
    }
  }

  return elementBoxStyle(rect, true)
}

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function isDuplicateLabel(value: string | null | undefined, existing: Array<string | null | undefined>): boolean {
  const normalized = normalizeLabel(value)
  return Boolean(normalized) && existing.some((item) => normalizeLabel(item) === normalized)
}

function conciseRoleLabel(element: TemplateModeElement, group: AtomGroup): string | null {
  if (!element.role || isDuplicateLabel(element.role, [ATOM_STYLES[group].label, element.atomType])) {
    return null
  }
  return element.role
}

function shortElementLabel(element: TemplateModeElement, blueprintElement: TemplateBlueprintElement | null): string {
  return compactText(
    blueprintElement?.semantic_role ?? blueprintElement?.purpose,
    element.label ?? element.role,
  )
}

function collapsedPreviewText(
  element: TemplateModeElement,
  blueprintElement: TemplateBlueprintElement | null,
  group: AtomGroup,
  semanticLabel: string,
): string | null {
  const candidates = [
    blueprintElement?.storyline_link,
    semanticLabel,
    blueprintElement?.purpose,
    blueprintElement?.content_intent,
    element.contentIntent,
    element.label,
  ]

  for (const candidate of candidates) {
    if (!candidate || !candidate.trim()) continue
    if (isDuplicateLabel(candidate, [ATOM_STYLES[group].label, element.role, element.atomType])) continue
    return candidate.trim()
  }

  return null
}

function MetadataSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-md border border-white/70 bg-white/55 px-2 py-1.5 dark:bg-slate-950/40">
      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h4>
      <div className="text-[11px] leading-relaxed">
        {children}
      </div>
    </section>
  )
}

function fieldBlock(label: string, value: string | null | undefined) {
  if (!value || !value.trim()) return null
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-xs leading-relaxed text-slate-700 dark:text-slate-200">{value}</dd>
    </div>
  )
}

function listBlock(label: string, values: string[] | null | undefined) {
  if (!Array.isArray(values) || values.length === 0) return null
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 flex flex-wrap gap-1">
        {values.slice(0, 5).map((value) => (
          <span
            key={value}
            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            {value}
          </span>
        ))}
      </dd>
    </div>
  )
}

function dataPolicySummary(elements: TemplateModeElement[]): string | null {
  const policies = elements
    .filter(isDataAtom)
    .map((element) => contractFor(element)?.missing_data_policy ?? 'ask_user')
  const unique = Array.from(new Set(policies))
  if (unique.length === 0) return null
  return unique.map((policy) => MISSING_DATA_LABELS[policy]).join(', ')
}

function titleSubtitleBoxes(
  slide: TemplateBlueprintSlide | null,
  elements: TemplateModeElement[],
  currentSlideIndex: number,
) {
  const realKeys = new Set(elements.map((element) => element.overrideKey))
  const boxes: Array<{
    overrideKey: string
    label: string
    value: string
    emptyLabel: string
    rect: TemplateGridRect
  }> = []
  const textRects = elements
    .filter((element) => {
      const rect = element.gridRect
      if (!rect) return false
      const group = getAtomGroup(element)
      return group !== 'IMAGE'
    })
    .map((element) => element.gridRect as TemplateGridRect)
  const contentLeft = textRects.length
    ? Math.min(Math.max(1.5, Math.min(...textRects.map((rect) => rect.x))), 24)
    : 2
  const contentRight = textRects.length
    ? Math.max(...textRects.map((rect) => rect.x + rect.w))
    : 30
  const contentWidth = Math.max(8, Math.min(30 - contentLeft, contentRight - contentLeft))

  const titleKey = `${currentSlideIndex}:title`
  if (!realKeys.has(titleKey)) {
    boxes.push({
      overrideKey: titleKey,
      label: 'Title intent',
      value: slide?.title_intent ?? '',
      emptyLabel: 'Add title intent',
      rect: { x: contentLeft, y: 1.35, w: contentWidth, h: 1.1 },
    })
  }

  const subtitleKey = `${currentSlideIndex}:subtitle`
  if (!realKeys.has(subtitleKey)) {
    boxes.push({
      overrideKey: subtitleKey,
      label: 'Subtitle intent',
      value: slide?.subtitle_intent ?? '',
      emptyLabel: 'Add subtitle intent',
      rect: { x: contentLeft, y: 2.55, w: Math.max(8, contentWidth - 1), h: 0.9 },
    })
  }

  return boxes
}

function LegacyTemplateModeOverlay({
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
              left: gridLinePct(rect.x, GRID_COLUMNS),
              top: gridLinePct(rect.y, GRID_ROWS),
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
                  {variable ? getVariableLabel(element) : element.label}
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

export function TemplateModeOverlay(props: TemplateModeOverlayProps) {
  const {
    snapshot,
    currentSlideIndex,
    loading,
    selectedElementId,
    blueprintEditorV2Enabled = false,
    onSelectElement,
    onBlueprintChange,
  } = props

  const [slideDetailsOpen, setSlideDetailsOpen] = useState(true)
  const [intentOpenState, setIntentOpenState] = useState<Record<string, boolean>>({})
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>({})
  const [activeExpandedKey, setActiveExpandedKey] = useState<string | null>(null)
  const slot = getTemplateSlot(snapshot, currentSlideIndex)
  const frozenEntry = getFrozenPlanEntry(snapshot, currentSlideIndex)
  const layoutPlan = getLayoutPlan(frozenEntry)
  const blueprint = getTemplateBlueprint(snapshot)
  const blueprintSlide = getBlueprintSlide(snapshot, currentSlideIndex)
  const elements = getTemplateModeElements(snapshot, currentSlideIndex)
    .filter((element) => element.gridRect)
  const legendGroups = useMemo(
    () => Array.from(new Set(elements.map(getAtomGroup))).filter((group) => group !== 'UNKNOWN').slice(0, 6),
    [elements],
  )

  useEffect(() => {
    if (!blueprintEditorV2Enabled) return
    const next: Record<string, boolean> = {}
    for (const element of elements) {
      const saved = window.sessionStorage.getItem(storageKey(currentSlideIndex, element.overrideKey))
      if (saved === 'expanded') next[storageKey(currentSlideIndex, element.overrideKey)] = true
      if (saved === 'collapsed') next[storageKey(currentSlideIndex, element.overrideKey)] = false
    }
    setExpandedState(next)
  }, [blueprintEditorV2Enabled, currentSlideIndex, elements.map((element) => element.overrideKey).join('|')])

  if (!blueprintEditorV2Enabled) {
    return <LegacyTemplateModeOverlay {...props} />
  }

  const selectedPattern = textValue(layoutPlan?.selected_pattern)
  const accessoryPlan = textValue(layoutPlan?.accessory_plan) ?? summarizeRecord(layoutPlan?.accessory_plan, 3)
  const themeSummary = summarizeRecord(layoutPlan?.theme_aliases, 3)
    ?? summarizeRecord(layoutPlan?.theme_css_variables, 3)
    ?? summarizeRecord(layoutPlan?.theme_color_ramps, 3)
  const showLockedChip = !loading && snapshot && elements.length === 0
  const slideDataPolicy = dataPolicySummary(elements)
  const syntheticBoxes = titleSubtitleBoxes(blueprintSlide, elements, currentSlideIndex)

  const isExpanded = (element: TemplateModeElement) => {
    const key = storageKey(currentSlideIndex, element.overrideKey)
    return expandedState[key] ?? false
  }

  const setExpanded = (element: TemplateModeElement, expanded: boolean) => {
    const key = storageKey(currentSlideIndex, element.overrideKey)
    setExpandedState((previous) => ({ ...previous, [key]: expanded }))
    if (expanded) setActiveExpandedKey(key)
    window.sessionStorage.setItem(key, expanded ? 'expanded' : 'collapsed')
  }

  const patchElement = (element: TemplateModeElement, patch: Partial<TemplateBlueprintElement>) => {
    if (!blueprint || !element.blueprintElement || !onBlueprintChange) return
    onBlueprintChange(updateElement(blueprint, currentSlideIndex, element.blueprintElement.element_key, patch))
  }

  const patchContract = (element: TemplateModeElement, patch: Partial<TemplateAtomContract>) => {
    const blueprintElement = element.blueprintElement
    if (!blueprintElement) return
    const current = blueprintElement.atom_contract ?? { kind: contractKindFor(element) }
    patchElement(element, {
      atom_contract: {
        ...current,
        ...patch,
      },
    })
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible rounded-sm">
      <div className="absolute left-3 top-3 z-30 flex max-w-[70%] flex-wrap items-center gap-2">
        <div className="rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-slate-700 shadow-lg backdrop-blur dark:bg-slate-950/90 dark:text-slate-200">
          Slide {currentSlideIndex + 1}
        </div>
      </div>

      <div className="absolute right-3 top-3 z-30 flex max-w-[56%] flex-wrap items-center gap-1 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-slate-700 shadow-lg backdrop-blur dark:bg-slate-950/90 dark:text-slate-200">
        {legendGroups.map((group) => (
          <span key={group} className="inline-flex items-center gap-1">
            <span className={cn("h-2.5 w-2.5 rounded-full", ATOM_STYLES[group].chip)} />
            {ATOM_STYLES[group].label}
          </span>
        ))}
        <span className="mx-1 h-3 w-px bg-slate-300 dark:bg-slate-700" />
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Exact content
        </span>
        <span className="inline-flex items-center gap-1">
          <Unlock className="h-3 w-3" />
          Use blueprint
        </span>
        <span className="hidden max-w-[210px] truncate text-[9px] text-slate-500 lg:inline dark:text-slate-400">
          Exact keeps source copy; blueprint regenerates.
        </span>
      </div>

      {slideDetailsOpen ? (
        <div className="pointer-events-auto absolute bottom-3 left-3 z-40 max-h-[48%] w-[min(520px,calc(100%-1.5rem))] overflow-y-auto rounded-lg border border-white/70 bg-white/95 text-xs text-slate-700 shadow-xl backdrop-blur dark:bg-slate-950/95 dark:text-slate-200">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <div className="flex min-w-0 items-center gap-1.5 font-semibold">
              <Info className="h-4 w-4 shrink-0 text-violet-500" />
              <span className="truncate">Slide details</span>
            </div>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-100"
              onClick={(event) => {
                event.stopPropagation()
                setSlideDetailsOpen(false)
              }}
              aria-label="Minimize slide details"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <dl className="space-y-2.5 px-3 py-3">
            {blueprintSlide ? (
              <>
                {fieldBlock('Purpose', blueprintSlide.purpose)}
                {fieldBlock('Storyline', blueprintSlide.storyline ?? blueprintSlide.narrative_role)}
                {fieldBlock('Proof goal', blueprintSlide.proof_goal)}
                {fieldBlock('Title intent', blueprintSlide.title_intent)}
                {fieldBlock('Subtitle intent', blueprintSlide.subtitle_intent)}
                {listBlock('Needs', blueprintSlide.required_inputs)}
                {slideDataPolicy && fieldBlock('Data policy', slideDataPolicy)}
              </>
            ) : (
              <>
                {selectedPattern && <div><dt className="font-semibold">Blueprint</dt><dd>{selectedPattern}</dd></div>}
                {accessoryPlan && <div><dt className="font-semibold">Accessory</dt><dd>{accessoryPlan}</dd></div>}
                {themeSummary && <div><dt className="font-semibold">Theme</dt><dd>{themeSummary}</dd></div>}
              </>
            )}
            {selectedPattern && (
              <div className="border-t border-slate-200 pt-2 text-[10px] text-slate-500 dark:border-slate-800">
                Layout: {selectedPattern}
              </div>
            )}
          </dl>
        </div>
      ) : (
        <button
          type="button"
          className="pointer-events-auto absolute bottom-3 left-3 z-40 inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur hover:bg-white dark:bg-slate-950/95 dark:text-slate-200"
          onClick={(event) => {
            event.stopPropagation()
            setSlideDetailsOpen(true)
          }}
        >
          <Info className="h-3.5 w-3.5 text-violet-500" />
          Slide details
          <Plus className="h-3.5 w-3.5 text-violet-500" />
        </button>
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

      {syntheticBoxes.map((box) => {
        const selected = selectedElementId === box.overrideKey
        const open = intentOpenState[box.overrideKey] ?? false
        return (
          <div
            key={box.overrideKey}
            className={cn(
              "pointer-events-auto absolute text-left text-slate-700 shadow-lg backdrop-blur transition dark:text-slate-200",
              open
                ? "z-50 overflow-y-auto rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950/95"
                : "z-[42] rounded-full border border-white/70 bg-white/95 px-2.5 py-1 text-[10px] font-semibold hover:bg-white dark:bg-slate-950/95",
              selected && "ring-2 ring-violet-500 ring-offset-2"
            )}
            style={intentBoxStyle(box.rect, open)}
            onClick={(event) => {
              event.stopPropagation()
              onSelectElement?.(box.overrideKey)
              if (!open) {
                setIntentOpenState((previous) => ({ ...previous, [box.overrideKey]: true }))
              }
            }}
          >
            {open ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5 dark:border-slate-800">
                  <div className="flex min-w-0 items-center gap-1.5 font-semibold">
                    {box.label.startsWith('Title') ? <Type className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                    <span className="truncate">{box.label}</span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                    onClick={(event) => {
                      event.stopPropagation()
                      setIntentOpenState((previous) => ({ ...previous, [box.overrideKey]: false }))
                    }}
                    aria-label={`Collapse ${box.label}`}
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className={cn("leading-relaxed", box.value ? "text-slate-700 dark:text-slate-200" : "italic text-slate-500")}>
                  {box.value || box.emptyLabel}
                </p>
              </>
            ) : (
              <span className="flex items-center gap-1.5">
                {box.label.startsWith('Title') ? <Type className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                <span>{box.label}</span>
                <button
                  type="button"
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-200"
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelectElement?.(box.overrideKey)
                    setIntentOpenState((previous) => ({ ...previous, [box.overrideKey]: true }))
                  }}
                  aria-label={`Expand ${box.label}`}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )
      })}

      {elements.map((element) => {
        const rect = element.gridRect
        if (!rect) return null
        const group = getAtomGroup(element)
        const style = ATOM_STYLES[group]
        const expanded = isExpanded(element)
        const selected = selectedElementId === element.overrideKey
        const blueprintElement = element.blueprintElement
        const locked = lockPolicyFor(blueprintElement) === 'lock_exact'
        const contract = contractFor(element)
        const requiredData = contract?.required_data ?? []
        const missingDataPolicy = contract?.missing_data_policy ?? 'ask_user'
        const abstractionInstruction = contract?.abstraction_instruction ?? null
        const secondaryIntent = blueprintElement?.content_intent
          && blueprintElement.content_intent !== element.contentIntent
          ? blueprintElement.content_intent
          : null
        const canMutate = Boolean(blueprint && blueprintElement && onBlueprintChange)
        const expandedKey = storageKey(currentSlideIndex, element.overrideKey)
        const semanticLabel = shortElementLabel(element, blueprintElement ?? null)
        const sectionPurpose = compactText(blueprintElement?.purpose, element.contentIntent ?? semanticLabel)
        const roleLabel = conciseRoleLabel(element, group)
        const previewText = collapsedPreviewText(element, blueprintElement ?? null, group, semanticLabel)
        const isLargeElement = rect.w * rect.h >= 40
        const whyText = blueprintElement?.storyline_link?.trim() || previewText

        return (
          <div
            key={element.overrideKey}
            role="button"
            tabIndex={0}
            className={cn(
              "pointer-events-auto absolute rounded-md text-left text-[10px] leading-tight shadow-lg transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1",
              "border-2 border-solid",
              style.border,
              style.bg,
              style.text,
              selected && "ring-2 ring-violet-500 ring-offset-2",
              expanded ? "overflow-y-auto p-3" : "overflow-hidden px-2 py-1.5",
            )}
            style={{
              ...elementBoxStyle(rect, expanded),
              zIndex: expanded
                ? activeExpandedKey === expandedKey ? 78 : 68
                : selected ? 58 : 34,
            }}
            onClick={(event) => {
              event.stopPropagation()
              onSelectElement?.(element.overrideKey)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelectElement?.(element.overrideKey)
              }
            }}
          >
            <div className="flex min-w-0 items-start gap-2">
              <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", style.chip)} />
              <div className="min-w-0 flex-1 space-y-1 pr-7">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="truncate text-[11px] font-bold">{style.label}</span>
                  {roleLabel && (
                    <span className="truncate text-[10px] font-medium opacity-80">{roleLabel}</span>
                  )}
                  <div className="ml-auto flex min-w-0 flex-wrap items-center gap-1.5">
                    {isDataAtom(element) && (
                      <div className="flex min-w-0 items-center gap-1">
                        <Database className="h-3 w-3 shrink-0 opacity-70" />
                        <span className="whitespace-nowrap text-[9px] font-semibold opacity-80">If data missing</span>
                        <select
                          value={missingDataPolicy}
                          disabled={!canMutate}
                          className="h-5 min-w-0 max-w-[146px] rounded border border-white/70 bg-white/80 px-1 text-[9px] font-medium text-slate-700 disabled:opacity-50 dark:bg-slate-950/80 dark:text-slate-100"
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            patchContract(element, {
                              missing_data_policy: event.target.value as TemplateBlueprintMissingDataPolicy,
                            })
                          }}
                        >
                          {MISSING_DATA_OPTIONS.map((policy) => (
                            <option key={policy} value={policy}>{MISSING_DATA_LABELS[policy]}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex min-w-0 items-center gap-1">
                      <Rows3 className="h-3 w-3 shrink-0 opacity-70" />
                      <span className="whitespace-nowrap text-[9px] font-semibold opacity-80">Template from</span>
                      <button
                        type="button"
                        disabled={!canMutate}
                        className={cn(
                          "inline-flex h-5 min-w-0 max-w-[136px] items-center gap-1 rounded-full border px-1.5 text-[9px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-55",
                          locked
                            ? "border-slate-300 bg-slate-950 text-white dark:border-slate-700 dark:bg-white dark:text-slate-950"
                            : "border-white/80 bg-white/90 text-slate-700 hover:bg-white dark:bg-slate-950/80 dark:text-slate-100"
                        )}
                        onClick={(event) => {
                          event.stopPropagation()
                          const nextLocked = !locked
                          patchElement(element, {
                            lock_policy: nextLocked ? 'lock_exact' : 'regenerate',
                            fixedness: nextLocked
                              ? (group === 'IMAGE' ? 'locked_media' : 'constant')
                              : 'variable',
                          })
                        }}
                        aria-label={locked ? 'Regenerate this element from abstraction' : 'Lock exact source content for this element'}
                        title={locked ? 'Exact Content: source content is reused' : 'Blueprint: content is regenerated from abstraction'}
                      >
                        {locked ? <Lock className="h-3 w-3 shrink-0" /> : <Unlock className="h-3 w-3 shrink-0" />}
                        <span className="truncate">{locked ? 'Exact Content' : 'Blueprint'}</span>
                      </button>
                    </div>
                  </div>
                </div>
                {!expanded && whyText && !isLargeElement && (
                  <div className="line-clamp-2 text-[10px] leading-snug opacity-85">
                    <span className="font-semibold uppercase tracking-wide opacity-70">Why it is on this slide: </span>
                    {whyText}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/70 opacity-80 hover:bg-white hover:opacity-100 dark:bg-slate-950/70 dark:hover:bg-slate-950"
                onClick={(event) => {
                  event.stopPropagation()
                  setExpanded(element, !expanded)
                }}
                aria-label={expanded ? 'Collapse element abstraction' : 'Expand element abstraction'}
              >
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            </div>

            {!expanded && isLargeElement && whyText && (
              <div className="mt-1 max-h-[calc(100%-4.8rem)] overflow-y-auto rounded-md border border-white/45 bg-white/35 px-2 py-1 text-[10px] leading-snug opacity-90 dark:bg-slate-950/25">
                <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Why it is on this slide
                </div>
                {whyText}
              </div>
            )}

            {expanded && (
              <div className="mt-3 space-y-2 pr-1">
                {blueprintElement?.storyline_link && (
                  <MetadataSection title="Why it is on this slide">
                    <p>{blueprintElement.storyline_link}</p>
                  </MetadataSection>
                )}

                <MetadataSection title="Reusable role">
                  <p>{sectionPurpose}</p>
                  {secondaryIntent && (
                    <p className="mt-1 text-[10px] opacity-75">{secondaryIntent}</p>
                  )}
                </MetadataSection>

                {element.renderedImageUrl && (
                  <MetadataSection title="Image treatment">
                    <div className="flex items-start gap-2">
                      <img
                        src={element.renderedImageUrl}
                        alt=""
                        className="h-14 w-20 shrink-0 rounded-sm object-cover"
                        loading="lazy"
                      />
                      <p className="text-[10px] leading-snug opacity-85">
                        {abstractionInstruction ?? 'Image abstraction will be captured on newly saved templates.'}
                      </p>
                    </div>
                  </MetadataSection>
                )}

                {isDataAtom(element) && (
                  <MetadataSection title="Data needed">
                    {requiredData.length > 0 ? (
                      <ul className="list-disc space-y-0.5 pl-4 text-[10px] leading-snug">
                        {requiredData.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    ) : (
                      <p className="text-[10px] opacity-70">No specific data requirements saved yet.</p>
                    )}
                    <div className="mt-2 flex items-center gap-1">
                      <Database className="h-3 w-3 opacity-75" />
                      <span className="text-[10px] font-semibold opacity-80">If data is missing</span>
                    </div>
                    <select
                      value={missingDataPolicy}
                      disabled={!canMutate}
                      className="mt-1 h-7 w-full rounded border border-white/70 bg-white/80 px-1 text-[10px] text-slate-700 disabled:opacity-50 dark:bg-slate-950/80 dark:text-slate-100"
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        patchContract(element, {
                          missing_data_policy: event.target.value as TemplateBlueprintMissingDataPolicy,
                        })
                      }}
                    >
                      {MISSING_DATA_OPTIONS.map((policy) => (
                        <option key={policy} value={policy}>{MISSING_DATA_LABELS[policy]}</option>
                      ))}
                    </select>
                  </MetadataSection>
                )}

                {group === 'IMAGE' && !element.renderedImageUrl && (
                  <div className="inline-flex items-center gap-1 rounded-md bg-white/55 px-2 py-1 text-[10px] opacity-80 dark:bg-slate-950/40">
                    <ImageIcon className="h-3 w-3" />
                    No locked thumbnail saved.
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function contractKindFor(element: TemplateModeElement): TemplateAtomContract['kind'] {
  const group = getAtomGroup(element)
  if (group === 'METRIC') return 'metric'
  if (group === 'CHART') return 'chart'
  if (group === 'TABLE') return 'table'
  if (group === 'KANBAN') return 'kanban'
  if (group === 'DIAGRAM') return 'diagram'
  if (group === 'INFOGRAPHIC') return 'infographic'
  if (group === 'IMAGE') return 'image'
  if (group === 'TEXT') return 'text'
  return 'unknown'
}

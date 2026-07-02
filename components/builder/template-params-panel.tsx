"use client"

import type { MouseEvent as ReactMouseEvent } from 'react'
import { ChevronLeft, ChevronRight, GripVertical, Image as ImageIcon, LineChart, Palette, Save, Shapes, TextCursorInput, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type {
  TemplateAtomContract,
  TemplateBlueprint,
  TemplateBlueprintElement,
  TemplateBlueprintLockPolicy,
  TemplateBlueprintMissingDataPolicy,
  TemplateBlueprintScope,
  TemplateBlueprintScopeLevel,
  TemplateBlueprintSlide,
  TemplateSnapshot,
} from '@/hooks/use-templates'
import {
  asRecord,
  getBlueprintSlide,
  getTemplateBlueprint,
  getTemplateModeElements,
  type TemplateModeElement,
  type TemplateModeOverride,
  type TemplateOverrides,
} from '@/lib/template-mode'

interface TemplateParamsPanelProps {
  isOpen: boolean
  width: number
  collapsed?: boolean
  snapshot: TemplateSnapshot | null
  currentSlideIndex: number
  overrides: TemplateOverrides
  selectedElementId?: string | null
  loading?: boolean
  blueprintEditorV2Enabled?: boolean
  blueprintDirty?: boolean
  blueprintSaving?: boolean
  onClose: () => void
  onCollapsedChange?: (collapsed: boolean) => void
  onResizeStart?: (event: ReactMouseEvent<HTMLDivElement>) => void
  onOverrideChange: (slideIndex: number, overrideKey: string, patch: TemplateModeOverride) => void
  onBlueprintChange?: (blueprint: TemplateBlueprint) => void
  onSaveBlueprint?: () => void | Promise<void>
}

export const TEMPLATE_PANEL_COLLAPSED_WIDTH = 28

const SCOPE_OPTIONS: Array<{ value: TemplateBlueprintScopeLevel; label: string }> = [
  { value: 'period', label: 'Same subject, new period' },
  { value: 'sibling', label: 'Related subject' },
  { value: 'category', label: 'Category level' },
  { value: 'structure', label: 'Pure structure' },
]

const OPTIONAL_SCOPE_OPTIONS = [
  { value: 'inherit', label: 'Inherit' },
  ...SCOPE_OPTIONS,
]

const LOCK_POLICY_OPTIONS: Array<{ value: TemplateBlueprintLockPolicy; label: string }> = [
  { value: 'regenerate', label: 'Blueprint' },
  { value: 'lock_exact', label: 'Exact Content' },
]

const MISSING_DATA_POLICY_OPTIONS: Array<{ value: TemplateBlueprintMissingDataPolicy; label: string }> = [
  { value: 'ask_user', label: 'Ask user' },
  { value: 'assume_and_continue', label: 'Assume and continue' },
  { value: 'reuse_prior_as_placeholder', label: 'Reuse prior as placeholder' },
]

const VISUAL_STRATEGY_OPTIONS = [
  { value: 'hero_priority', label: 'Hero priority' },
  { value: 'recede', label: 'Recede' },
  { value: 'contrast', label: 'Contrast' },
  { value: 'soft_support', label: 'Soft support' },
  { value: 'quiet_support', label: 'Quiet support' },
  { value: 'emphasis', label: 'Emphasis' },
  { value: 'decision_emphasis', label: 'Decision emphasis' },
]

const COLOR_SLOT_OPTIONS = [
  { value: 'primary', label: 'Primary' },
  { value: 'accent-1', label: 'Accent 1' },
  { value: 'accent-2', label: 'Accent 2' },
  { value: 'neutral', label: 'Neutral' },
]

const CHART_TYPE_OPTIONS = [
  'line',
  'bar_vertical',
  'bar_horizontal',
  'area',
  'pie',
  'donut',
  'scatter',
  'waterfall',
]

const CHART_COLOR_OPTIONS = [
  { value: 'brand', label: 'Brand', colors: ['#805AA0', '#2980B9', '#16A085'] },
  { value: 'cool', label: 'Cool', colors: ['#2563EB', '#06B6D4', '#14B8A6'] },
  { value: 'warm', label: 'Warm', colors: ['#D97706', '#DC2626', '#BE123C'] },
  { value: 'mono', label: 'Mono', colors: ['#0F172A', '#64748B', '#CBD5E1'] },
]

const INFOGRAPHIC_COLOR_OPTIONS = [
  { value: 'brand', label: 'Brand', colors: ['#805AA0', '#2980B9', '#16A085', '#F59E0B'] },
  { value: 'contrast', label: 'Contrast', colors: ['#111827', '#7C3AED', '#06B6D4', '#F97316'] },
  { value: 'quiet', label: 'Quiet', colors: ['#475569', '#64748B', '#94A3B8', '#CBD5E1'] },
]

function nestedValue(record: Record<string, unknown> | null, key: string): unknown {
  return record?.[key]
}

function textOrEmpty(value: string | null | undefined): string {
  return value ?? ''
}

function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function listToLines(value: string[] | null | undefined): string {
  return Array.isArray(value) ? value.join('\n') : ''
}

function getOverride(overrides: TemplateOverrides, slideIndex: number, overrideKey: string): TemplateModeOverride {
  return asRecord(overrides[String(slideIndex)]?.[overrideKey]) ?? {}
}

function elementIcon(element: TemplateModeElement | null) {
  const atomType = element?.atomType.toUpperCase() ?? ''
  if (atomType.includes('IMAGE')) return <ImageIcon className="h-4 w-4 text-slate-500" />
  if (atomType.includes('CHART')) return <LineChart className="h-4 w-4 text-slate-500" />
  if (atomType.includes('INFOGRAPHIC')) return <Shapes className="h-4 w-4 text-slate-500" />
  return <TextCursorInput className="h-4 w-4 text-slate-500" />
}

function TextField({
  label,
  value,
  onChange,
  rows = 2,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  disabled?: boolean
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs leading-relaxed text-slate-800 shadow-sm",
          "focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100",
          "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-950",
          disabled && "cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-500"
        )}
      />
    </label>
  )
}

function TextInputField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-sm",
          "focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100",
          "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-950"
        )}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  onValueChange,
  disabled = false,
}: {
  label: string
  value?: string
  placeholder: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function V1ElementControls({
  element,
  override,
  onPatch,
}: {
  element: TemplateModeElement
  override: TemplateModeOverride
  onPatch: (patch: TemplateModeOverride) => void
}) {
  const atomType = element.atomType.toUpperCase()
  const styleHints = asRecord(override.style_hints) ?? element.styleHints
  const imageHints = asRecord(element.renderSpec.image_hints)
  const chartHints = asRecord(element.renderSpec.chart_hints)
  const infographicHints = asRecord(element.renderSpec.infographic_hints)
  const imageMode = String(override.image_mode ?? imageHints?.image_mode ?? 'locked')
  const isTextLike = atomType.includes('TEXT') || atomType.includes('METRICS')

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {elementIcon(element)}
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {element.role}
            </h4>
            <p className="truncate text-xs text-slate-500">
              {element.atomType} - key {element.overrideKey}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {atomType.includes('IMAGE') && (
          <>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Image
              </span>
              <div className="mt-1 grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 text-xs dark:border-slate-800">
                {(['locked', 'regenerate'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onPatch({ image_mode: mode })}
                    className={cn(
                      "px-2 py-2 font-medium transition",
                      imageMode === mode
                        ? "bg-violet-600 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                    )}
                  >
                    {mode === 'locked' ? 'Keep locked' : 'Regenerate'}
                  </button>
                ))}
              </div>
            </div>

            <SelectField
              label="Image style"
              value={String(asRecord(override.image_hints)?.image_style ?? imageHints?.image_style ?? 'realistic')}
              placeholder="Image style"
              options={[
                { value: 'realistic', label: 'Realistic' },
                { value: 'illustration', label: 'Illustration' },
                { value: 'abstract', label: 'Abstract' },
                { value: 'brand_graphic', label: 'Brand graphic' },
                { value: 'flat_vector', label: 'Flat vector' },
              ]}
              onValueChange={(value) => onPatch({ image_hints: { image_style: value } })}
            />
          </>
        )}

        {!atomType.includes('IMAGE') && (
          <>
            <SelectField
              label="Role treatment"
              value={String(nestedValue(styleHints, 'visual_strategy') ?? 'quiet_support')}
              placeholder="Role treatment"
              options={VISUAL_STRATEGY_OPTIONS}
              onValueChange={(value) => onPatch({ style_hints: { visual_strategy: value } })}
            />
            <SelectField
              label="Color slot"
              value={String(nestedValue(styleHints, 'color_slot') ?? 'neutral')}
              placeholder="Color slot"
              options={COLOR_SLOT_OPTIONS}
              onValueChange={(value) => onPatch({ style_hints: { color_slot: value } })}
            />
          </>
        )}

        {isTextLike && (
          <SelectField
            label="Box fill"
            value={String(nestedValue(styleHints, 'box_fill') ?? 'transparent')}
            placeholder="Box fill"
            options={[
              { value: 'transparent', label: 'Transparent' },
              { value: 'soft_tint', label: 'Soft tint' },
              { value: 'colored', label: 'Colored' },
            ]}
            onValueChange={(value) => onPatch({ style_hints: { box_fill: value } })}
          />
        )}

        {atomType.includes('CHART') && (
          <>
            <SelectField
              label="Chart type"
              value={String(asRecord(override.chart_hints)?.chart_type ?? chartHints?.chart_type ?? 'line')}
              placeholder="Chart type"
              options={CHART_TYPE_OPTIONS.map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
              onValueChange={(value) => onPatch({ chart_hints: { chart_type: value } })}
            />
            <SelectField
              label="Chart colors"
              value={String(asRecord(override.chart_hints)?.color_family ?? 'brand')}
              placeholder="Chart colors"
              options={CHART_COLOR_OPTIONS.map(({ value, label }) => ({ value, label }))}
              onValueChange={(value) => {
                const option = CHART_COLOR_OPTIONS.find((item) => item.value === value)
                onPatch({ chart_hints: { color_family: value, colors: option?.colors ?? [] } })
              }}
            />
            <label className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
              <span className="font-medium text-slate-600 dark:text-slate-300">Show title</span>
              <Switch
                checked={Boolean(asRecord(override.chart_hints)?.show_title ?? chartHints?.show_title ?? false)}
                onCheckedChange={(checked) => onPatch({ chart_hints: { show_title: checked } })}
              />
            </label>
          </>
        )}

        {atomType.includes('INFOGRAPHIC') && (
          <>
            <SelectField
              label="Segments"
              value={String(asRecord(override.infographic_hints)?.segment_count ?? infographicHints?.segment_count ?? 4)}
              placeholder="Segments"
              options={[2, 3, 4, 5, 6].map((value) => ({ value: String(value), label: `${value}` }))}
              onValueChange={(value) => onPatch({ infographic_hints: { segment_count: Number(value) } })}
            />
            <SelectField
              label="Segment colors"
              value={String(asRecord(override.infographic_hints)?.color_family ?? 'brand')}
              placeholder="Segment colors"
              options={INFOGRAPHIC_COLOR_OPTIONS.map(({ value, label }) => ({ value, label }))}
              onValueChange={(value) => {
                const option = INFOGRAPHIC_COLOR_OPTIONS.find((item) => item.value === value)
                onPatch({ infographic_hints: { color_family: value, segment_colors: option?.colors ?? [] } })
              }}
            />
            <label className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
              <span className="font-medium text-slate-600 dark:text-slate-300">Show icons</span>
              <Switch
                checked={Boolean(asRecord(override.infographic_hints)?.show_icons ?? infographicHints?.show_icons ?? true)}
                onCheckedChange={(checked) => onPatch({ infographic_hints: { show_icons: checked } })}
              />
            </label>
          </>
        )}
      </div>
    </section>
  )
}

function updateBlueprint(
  blueprint: TemplateBlueprint,
  patch: Partial<TemplateBlueprint>,
): TemplateBlueprint {
  return { ...blueprint, ...patch }
}

function updateSlide(
  blueprint: TemplateBlueprint,
  slideIndex: number,
  patch: Partial<TemplateBlueprintSlide>,
): TemplateBlueprint {
  return {
    ...blueprint,
    slides: blueprint.slides.map((slide) => (
      Number(slide.slide_index) === slideIndex ? { ...slide, ...patch } : slide
    )),
  }
}

export function updateElement(
  blueprint: TemplateBlueprint,
  slideIndex: number,
  elementKey: string,
  patch: Partial<TemplateBlueprintElement>,
): TemplateBlueprint {
  return {
    ...blueprint,
    slides: blueprint.slides.map((slide) => {
      if (Number(slide.slide_index) !== slideIndex) return slide
      return {
        ...slide,
        elements: slide.elements.map((element) => (
          element.element_key === elementKey ? { ...element, ...patch } : element
        )),
      }
    }),
  }
}

function patchElementContract(
  blueprint: TemplateBlueprint,
  slideIndex: number,
  element: TemplateBlueprintElement,
  patch: Partial<TemplateAtomContract>,
): TemplateBlueprint {
  const current = element.atom_contract ?? { kind: 'unknown' as const }
  return updateElement(blueprint, slideIndex, element.element_key, {
    atom_contract: {
      ...current,
      ...patch,
    },
  })
}

function scopeValue(scope: TemplateBlueprintScope | null | undefined, inherited = 'inherit'): string {
  return scope?.level ?? inherited
}

function optionalScopeFromValue(value: string): TemplateBlueprintScope | null {
  return value === 'inherit' ? null : { level: value as TemplateBlueprintScopeLevel }
}

function BlueprintElementControls({
  blueprint,
  slideIndex,
  element,
  blueprintElement,
  override,
  onPatch,
  onBlueprintChange,
}: {
  blueprint: TemplateBlueprint
  slideIndex: number
  element: TemplateModeElement
  blueprintElement: TemplateBlueprintElement
  override: TemplateModeOverride
  onPatch: (patch: TemplateModeOverride) => void
  onBlueprintChange: (blueprint: TemplateBlueprint) => void
}) {
  const atomType = element.atomType.toUpperCase()
  const imageHints = asRecord(element.renderSpec.image_hints)
  const imageMode = String(override.image_mode ?? imageHints?.image_mode ?? (
    blueprintElement.fixedness === 'locked_media' ? 'locked' : 'regenerate'
  ))
  const contract = blueprintElement.atom_contract ?? { kind: 'unknown' as const }
  const lockPolicy = blueprintElement.lock_policy
    ?? (blueprintElement.fixedness === 'locked_media' || blueprintElement.fixedness === 'constant'
      ? 'lock_exact'
      : 'regenerate')
  const dataPolicy = contract.missing_data_policy ?? 'ask_user'
  const dataBearing = ['metric', 'chart', 'table', 'kanban', 'diagram'].includes(contract.kind)
  const locked = lockPolicy === 'lock_exact'

  const patchBlueprintElement = (patch: Partial<TemplateBlueprintElement>) => {
    onBlueprintChange(updateElement(blueprint, slideIndex, blueprintElement.element_key, patch))
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 flex items-start gap-2">
        {elementIcon(element)}
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            Element details
          </h4>
          <p className="truncate text-xs text-slate-500">
            {element.role} - {element.atomType}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <SelectField
          label="Template from"
          value={lockPolicy}
          placeholder="Template from"
          options={LOCK_POLICY_OPTIONS}
          onValueChange={(value) => {
            const next = value as TemplateBlueprintLockPolicy
            patchBlueprintElement({
              lock_policy: next,
              fixedness: next === 'lock_exact'
                ? (atomType.includes('IMAGE') ? 'locked_media' : 'constant')
                : 'variable',
            })
            if (atomType.includes('IMAGE')) {
              onPatch({ image_mode: next === 'lock_exact' ? 'locked' : 'regenerate' })
            }
          }}
        />
        <TextField
          label="Why it is on this slide"
          value={textOrEmpty(blueprintElement.storyline_link)}
          rows={3}
          onChange={(value) => patchBlueprintElement({ storyline_link: value })}
        />
        <TextField
          label="Reusable role"
          value={textOrEmpty(blueprintElement.purpose)}
          rows={3}
          onChange={(value) => patchBlueprintElement({ purpose: value })}
        />
        {dataBearing && (
          <div className={cn("space-y-3", locked && "rounded-md border border-slate-200 bg-slate-50 p-3 opacity-60 dark:border-slate-800 dark:bg-slate-900/60")}>
            <SelectField
              label="If data missing"
              value={dataPolicy}
              placeholder="If data missing"
              options={MISSING_DATA_POLICY_OPTIONS}
              onValueChange={(value) => onBlueprintChange(patchElementContract(
                blueprint,
                slideIndex,
                blueprintElement,
                { missing_data_policy: value as TemplateBlueprintMissingDataPolicy },
              ))}
              disabled={locked}
            />
            <TextField
              label="Data needed"
              value={listToLines(contract.required_data)}
              rows={3}
              onChange={(value) => onBlueprintChange(patchElementContract(
                blueprint,
                slideIndex,
                blueprintElement,
                { required_data: linesToList(value) },
              ))}
              disabled={locked}
            />
            {locked && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exact Content reuses the source element, so missing-data choices do not apply.
              </p>
            )}
          </div>
        )}

        {atomType.includes('IMAGE') && (
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Image
            </span>
            <div className="mt-1 grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 text-xs dark:border-slate-800">
              {(['locked', 'regenerate'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    patchBlueprintElement({
                      fixedness: mode === 'locked' ? 'locked_media' : 'variable',
                      lock_policy: mode === 'locked' ? 'lock_exact' : 'regenerate',
                    })
                    onPatch({ image_mode: mode })
                  }}
                  className={cn(
                    "px-2 py-2 font-medium transition",
                    imageMode === mode
                      ? "bg-violet-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                  )}
                >
                  {mode === 'locked' ? 'Keep locked' : 'Regenerate'}
                </button>
              ))}
            </div>
          </div>
        )}

        {atomType.includes('IMAGE') && (
          <TextField
            label="Image treatment"
            value={textOrEmpty(contract.abstraction_instruction)}
            rows={3}
            onChange={(value) => onBlueprintChange(patchElementContract(
              blueprint,
              slideIndex,
              blueprintElement,
              { abstraction_instruction: value },
            ))}
          />
        )}
      </div>
    </section>
  )
}

export function TemplateParamsPanel({
  isOpen,
  width,
  collapsed = false,
  snapshot,
  currentSlideIndex,
  overrides,
  selectedElementId,
  loading,
  blueprintEditorV2Enabled = false,
  blueprintDirty,
  blueprintSaving,
  onClose,
  onCollapsedChange,
  onResizeStart,
  onOverrideChange,
  onBlueprintChange,
  onSaveBlueprint,
}: TemplateParamsPanelProps) {
  const blueprint = getTemplateBlueprint(snapshot)
  const slide = getBlueprintSlide(snapshot, currentSlideIndex)
  const elements = getTemplateModeElements(snapshot, currentSlideIndex)
  const selectedElement = selectedElementId
    ? elements.find((element) => element.overrideKey === selectedElementId) ?? null
    : null
  const selectedBlueprintElement = selectedElement?.blueprintElement ?? null
  const selectedSlideIntent = selectedElementId === `${currentSlideIndex}:title`
    ? 'title'
    : selectedElementId === `${currentSlideIndex}:subtitle`
      ? 'subtitle'
      : null
  const focusedPanelTitle = blueprintEditorV2Enabled
    ? selectedSlideIntent
      ? selectedSlideIntent === 'title' ? 'Title intent' : 'Subtitle intent'
      : selectedElement
        ? 'Element details'
        : 'Slide details'
    : 'Template params'
  const focusedPanelSubtitle = blueprintEditorV2Enabled
    ? selectedElement
      ? `${selectedElement.role}${selectedElement.atomType ? ` - ${selectedElement.atomType}` : ''}`
      : `Slide ${currentSlideIndex + 1}`
    : `Slide ${currentSlideIndex + 1}`

  const patchBlueprint = (patch: Partial<TemplateBlueprint>) => {
    if (!blueprint || !onBlueprintChange) return
    onBlueprintChange(updateBlueprint(blueprint, patch))
  }

  const patchSlide = (patch: Partial<TemplateBlueprintSlide>) => {
    if (!blueprint || !onBlueprintChange) return
    onBlueprintChange(updateSlide(blueprint, currentSlideIndex, patch))
  }

  return (
    <div
      className={cn(
        "absolute inset-y-0 left-0 z-[70] ease-out",
        "transition-[transform,width] duration-300",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
      style={{ width: collapsed ? TEMPLATE_PANEL_COLLAPSED_WIDTH : width, pointerEvents: isOpen ? 'auto' : 'none' }}
    >
      {collapsed ? (
        <button
          type="button"
          className="absolute inset-y-0 left-0 flex w-7 flex-col items-center justify-center gap-2 border-r border-violet-200 bg-violet-50 text-violet-700 shadow-lg hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200 dark:hover:bg-violet-900/70"
          onClick={() => onCollapsedChange?.(false)}
          title="Expand template details"
          aria-label="Expand template details"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="[writing-mode:vertical-rl] text-[10px] font-semibold uppercase tracking-wider">
            Template
          </span>
        </button>
      ) : (
      <div className="absolute inset-y-0 left-0 flex max-h-screen flex-col overflow-hidden border-r border-violet-200 bg-white text-slate-900 shadow-xl dark:border-violet-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-violet-50 px-4 py-3 dark:border-slate-800 dark:bg-violet-950/40">
          <div className="flex min-w-0 items-center gap-2">
            <Palette className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">
                {focusedPanelTitle}
              </h3>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {focusedPanelSubtitle}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {blueprintEditorV2Enabled && (
              <Button
                variant={blueprintDirty ? 'default' : 'outline'}
                size="sm"
                onClick={() => void onSaveBlueprint?.()}
                disabled={!blueprint || !blueprintDirty || blueprintSaving}
                className="h-8 gap-1.5 px-2.5 text-xs"
              >
                <Save className="h-3.5 w-3.5" />
                {blueprintSaving ? 'Saving' : 'Save template changes'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCollapsedChange?.(true)}
              className="h-8 w-8 p-0"
              title="Collapse template details"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 max-h-[calc(100vh-5rem)] space-y-3 overflow-y-auto p-4">
          {loading ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              Loading template snapshot...
            </div>
          ) : !snapshot ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              Select an available template to edit its reusable parameters.
            </div>
          ) : blueprintEditorV2Enabled && (!blueprint || !slide) ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              This template is loading its semantic blueprint.
            </div>
          ) : blueprintEditorV2Enabled && blueprint && slide ? (
            <>
              {!selectedElement && !selectedSlideIntent && (
                <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Deck details</h4>
                    <p className="text-xs text-slate-500">{blueprint.generation_method}</p>
                  </div>
                  <div className="space-y-3">
                    <SelectField
                      label="Deck scope"
                      value={scopeValue(blueprint.abstraction_scope, 'period')}
                      placeholder="Deck scope"
                      options={SCOPE_OPTIONS}
                      onValueChange={(value) => patchBlueprint({ abstraction_scope: { level: value as TemplateBlueprintScopeLevel } })}
                    />
                    <TextInputField
                      label="Scope label"
                      value={textOrEmpty(blueprint.abstraction_scope?.label)}
                      onChange={(value) => patchBlueprint({
                        abstraction_scope: {
                          level: blueprint.abstraction_scope?.level ?? 'period',
                          label: value || null,
                        },
                      })}
                    />
                    <TextField
                      label="Deck purpose"
                      value={textOrEmpty(blueprint.deck_purpose)}
                      rows={2}
                      onChange={(value) => patchBlueprint({ deck_purpose: value })}
                    />
                    <TextField
                      label="Deck reuse instruction"
                      value={textOrEmpty(blueprint.deck_reuse_instruction)}
                      rows={3}
                      onChange={(value) => patchBlueprint({ deck_reuse_instruction: value })}
                    />
                  </div>
                </section>
              )}

              {selectedSlideIntent ? (
                <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {selectedSlideIntent === 'title' ? 'Title intent' : 'Subtitle intent'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Edit only the selected slide heading abstraction.
                    </p>
                  </div>
                  <TextField
                    label={selectedSlideIntent === 'title' ? 'Title intent' : 'Subtitle intent'}
                    value={textOrEmpty(selectedSlideIntent === 'title' ? slide.title_intent : slide.subtitle_intent)}
                    rows={5}
                    onChange={(value) => patchSlide(
                      selectedSlideIntent === 'title'
                        ? { title_intent: value }
                        : { subtitle_intent: value }
                    )}
                  />
                </section>
              ) : !selectedElement ? (
                <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Slide details</h4>
                    <p className="text-xs text-slate-500">
                      {slide.narrative_role ?? slide.slide_title ?? 'Reusable slide role'}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <SelectField
                      label="Slide scope"
                      value={scopeValue(slide.abstraction_scope)}
                      placeholder="Slide scope"
                      options={OPTIONAL_SCOPE_OPTIONS}
                      onValueChange={(value) => patchSlide({ abstraction_scope: optionalScopeFromValue(value) })}
                    />
                    <TextField
                      label="Purpose"
                      value={textOrEmpty(slide.purpose)}
                      rows={3}
                      onChange={(value) => patchSlide({ purpose: value })}
                    />
                    <TextField
                      label="Storyline"
                      value={textOrEmpty(slide.storyline)}
                      rows={3}
                      onChange={(value) => patchSlide({ storyline: value })}
                    />
                    <TextField
                      label="Proof goal"
                      value={textOrEmpty(slide.proof_goal)}
                      rows={2}
                      onChange={(value) => patchSlide({ proof_goal: value })}
                    />
                    <TextField
                      label="Title intent"
                      value={textOrEmpty(slide.title_intent)}
                      rows={2}
                      onChange={(value) => patchSlide({ title_intent: value })}
                    />
                    <TextField
                      label="Subtitle intent"
                      value={textOrEmpty(slide.subtitle_intent)}
                      rows={2}
                      onChange={(value) => patchSlide({ subtitle_intent: value })}
                    />
                    <TextField
                      label="Reuse instruction"
                      value={textOrEmpty(slide.reuse_instruction)}
                      rows={3}
                      onChange={(value) => patchSlide({ reuse_instruction: value })}
                    />
                    <TextField
                      label="Required inputs"
                      value={listToLines(slide.required_inputs)}
                      rows={3}
                      onChange={(value) => patchSlide({ required_inputs: linesToList(value) })}
                    />
                    <SelectField
                      label="Population policy"
                      value={slide.population_policy}
                      placeholder="Population policy"
                      options={[
                        { value: 'flexible', label: 'Flexible' },
                        { value: 'strict', label: 'Strict' },
                      ]}
                      onValueChange={(value) => patchSlide({ population_policy: value as TemplateBlueprintSlide['population_policy'] })}
                    />
                  </div>
                </section>
              ) : null}

              {selectedElement && selectedBlueprintElement ? (
                <BlueprintElementControls
                  blueprint={blueprint}
                  slideIndex={currentSlideIndex}
                  element={selectedElement}
                  blueprintElement={selectedBlueprintElement}
                  override={getOverride(overrides, currentSlideIndex, selectedElement.overrideKey)}
                  onPatch={(patch) => onOverrideChange(currentSlideIndex, selectedElement.overrideKey, patch)}
                  onBlueprintChange={(next) => onBlueprintChange?.(next)}
                />
              ) : selectedElement ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  This selected element does not have an editable blueprint entry yet.
                </div>
              ) : null}
            </>
          ) : selectedElement ? (
            <V1ElementControls
              element={selectedElement}
              override={getOverride(overrides, currentSlideIndex, selectedElement.overrideKey)}
              onPatch={(patch) => onOverrideChange(currentSlideIndex, selectedElement.overrideKey, patch)}
            />
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              Select an element box on the deck to edit image and style parameters.
            </div>
          )}
        </div>
        {onResizeStart && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize template details panel"
            title="Drag to resize template details"
            onMouseDown={onResizeStart}
            className="absolute inset-y-0 right-[-4px] z-10 flex w-2 cursor-col-resize items-center justify-center text-violet-400 hover:bg-violet-200/60 hover:text-violet-700 dark:hover:bg-violet-900/40"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
      </div>
      )}
    </div>
  )
}

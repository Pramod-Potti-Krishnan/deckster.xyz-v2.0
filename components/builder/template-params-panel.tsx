"use client"

import { Image as ImageIcon, LineChart, Palette, Shapes, TextCursorInput, X } from 'lucide-react'
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
import type { TemplateSnapshot } from '@/hooks/use-templates'
import {
  asRecord,
  getTemplateModeElements,
  type TemplateModeElement,
  type TemplateModeOverride,
  type TemplateOverrides,
} from '@/lib/template-mode'

interface TemplateParamsPanelProps {
  isOpen: boolean
  width: number
  snapshot: TemplateSnapshot | null
  currentSlideIndex: number
  overrides: TemplateOverrides
  loading?: boolean
  onClose: () => void
  onOverrideChange: (slideIndex: number, overrideKey: string, patch: TemplateModeOverride) => void
}

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

const CONTENT_INTENT_OPTIONS = [
  { value: 'main_content', label: 'Main body' },
  { value: 'thesis', label: 'Framing / intro' },
  { value: 'metrics', label: 'Metrics' },
  { value: 'takeaway', label: 'Callout / takeaway' },
  { value: 'source', label: 'Sources' },
]

const ABSTRACT_INTENT_OPTIONS = [
  { value: 'Frame the topic and orient the audience.', label: 'Frame topic' },
  { value: 'Summarize the key performance signals.', label: 'Summarize signals' },
  { value: 'Compare changes against the prior period.', label: 'Compare period' },
  { value: 'Highlight risks, blockers, and decisions.', label: 'Risks / decisions' },
  { value: 'Show recommendations and next actions.', label: 'Recommendations' },
  { value: 'Support the main narrative with evidence.', label: 'Evidence support' },
]

const KEY_MESSAGE_OPTIONS = [
  { value: 'Emphasize the strongest new-period headline.', label: 'New-period headline' },
  { value: 'Emphasize the most important change since the prior period.', label: 'Period change' },
  { value: 'Emphasize the decision or tradeoff the audience must make.', label: 'Decision focus' },
  { value: 'Emphasize the primary risk and its mitigation.', label: 'Risk focus' },
  { value: 'Emphasize the recommended next action.', label: 'Next action' },
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

function getOverride(overrides: TemplateOverrides, slideIndex: number, overrideKey: string): TemplateModeOverride {
  return asRecord(overrides[String(slideIndex)]?.[overrideKey]) ?? {}
}

function selectValue(
  value: unknown,
  options: Array<{ value: string; label: string }>,
  fallback: string,
): string {
  const text = typeof value === 'string' ? value.trim() : ''
  return options.some((option) => option.value === text) ? text : fallback
}

function inferContentIntentValue(value: unknown): string {
  const text = typeof value === 'string' ? value.toLowerCase() : ''
  if (text.includes('metric') || text.includes('quantitative')) return 'metrics'
  if (text.includes('thesis') || text.includes('intro') || text.includes('framing') || text.includes('context')) {
    return 'thesis'
  }
  if (text.includes('callout') || text.includes('takeaway') || text.includes('quote') || text.includes('decision')) {
    return 'takeaway'
  }
  if (text.includes('source') || text.includes('citation') || text.includes('reference')) return 'source'
  return 'main_content'
}

function elementIcon(element: TemplateModeElement) {
  const atomType = element.atomType.toUpperCase()
  if (atomType.includes('IMAGE')) return <ImageIcon className="h-4 w-4 text-slate-500" />
  if (atomType.includes('CHART')) return <LineChart className="h-4 w-4 text-slate-500" />
  if (atomType.includes('INFOGRAPHIC')) return <Shapes className="h-4 w-4 text-slate-500" />
  return <TextCursorInput className="h-4 w-4 text-slate-500" />
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  onValueChange,
}: {
  label: string
  value?: string
  placeholder: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <Select value={value} onValueChange={onValueChange}>
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

function ElementControls({
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
  const textMode = override.regenerate_text === false ? 'locked' : 'refresh'
  const contentIntent = String(override.content_intent ?? inferContentIntentValue(element.contentIntent))
  const abstractIntent = selectValue(
    override.abstract_intent,
    ABSTRACT_INTENT_OPTIONS,
    ABSTRACT_INTENT_OPTIONS[0].value,
  )
  const keyMessage = selectValue(
    override.key_message,
    KEY_MESSAGE_OPTIONS,
    KEY_MESSAGE_OPTIONS[0].value,
  )

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
          <>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Wording
              </span>
              <div className="mt-1 grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 text-xs dark:border-slate-800">
                {(['refresh', 'locked'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onPatch({
                      regenerate_text: mode === 'refresh',
                      text_mode: mode,
                      locked: mode === 'locked',
                    })}
                    className={cn(
                      "px-2 py-2 font-medium transition",
                      textMode === mode
                        ? "bg-violet-600 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                    )}
                  >
                    {mode === 'refresh' ? 'Refresh' : 'Keep wording'}
                  </button>
                ))}
              </div>
            </div>

            <SelectField
              label="Content source"
              value={selectValue(contentIntent, CONTENT_INTENT_OPTIONS, 'main_content')}
              placeholder="Content source"
              options={CONTENT_INTENT_OPTIONS}
              onValueChange={(value) => onPatch({ content_intent: value })}
            />
            <SelectField
              label="Slide intent"
              value={abstractIntent}
              placeholder="Slide intent"
              options={ABSTRACT_INTENT_OPTIONS}
              onValueChange={(value) => onPatch({ abstract_intent: value })}
            />
            <SelectField
              label="Key message"
              value={keyMessage}
              placeholder="Key message"
              options={KEY_MESSAGE_OPTIONS}
              onValueChange={(value) => onPatch({ key_message: value })}
            />
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
          </>
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

export function TemplateParamsPanel({
  isOpen,
  width,
  snapshot,
  currentSlideIndex,
  overrides,
  loading,
  onClose,
  onOverrideChange,
}: TemplateParamsPanelProps) {
  const elements = getTemplateModeElements(snapshot, currentSlideIndex)

  return (
    <div
      className={cn(
        "absolute inset-y-0 left-0 z-[70] ease-out",
        "transition-transform duration-300",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
      style={{ width, pointerEvents: isOpen ? 'auto' : 'none' }}
    >
      <div className="absolute inset-y-0 left-0 flex flex-col overflow-hidden border-r border-violet-200 bg-white text-slate-900 shadow-xl dark:border-violet-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 bg-violet-50 px-4 py-3 dark:border-slate-800 dark:bg-violet-950/40">
          <div className="flex min-w-0 items-center gap-2">
            <Palette className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">Template params</h3>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                Slide {currentSlideIndex + 1}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {loading ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              Loading template snapshot...
            </div>
          ) : !snapshot ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              Select an available template to edit its reusable parameters.
            </div>
          ) : elements.length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              Hero design is locked for this slide; the title regenerates with the next deck.
            </div>
          ) : (
            elements.map((element) => (
              <ElementControls
                key={element.overrideKey}
                element={element}
                override={getOverride(overrides, currentSlideIndex, element.overrideKey)}
                onPatch={(patch) => onOverrideChange(currentSlideIndex, element.overrideKey, patch)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

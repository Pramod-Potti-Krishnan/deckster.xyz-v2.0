'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import type {
  MetricsConfig,
  MetricsFitMode,
  MetricsFormData,
  MetricsManualOverrides,
  TextLabsPositionConfig,
} from '@/types/textlabs'
import { TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import type { ElementContext, MandatoryConfig } from '../types'
import { CollapsibleSection } from '../shared/collapsible-section'
import { PositionPresets } from '../shared/position-presets'
import { ZIndexInput } from '../shared/z-index-input'
import {
  isMetricsLayoutViable,
  resolveMetricsLayout,
  type MetricsLayoutChoice,
} from '@/lib/metrics-layout'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.METRICS
const SURFACES: Array<{ value: '' | MetricsConfig['color_scheme']; label: string }> = [
  { value: '', label: 'Auto' },
  { value: 'solid', label: 'Filled' },
  { value: 'accent', label: 'Pastel' },
  { value: 'transparent', label: 'Clear' },
  { value: 'bordered', label: 'Outline' },
]
const COLORS = ['', 'purple', 'blue', 'green', 'red', 'cyan', 'orange', 'pink', 'gold', 'teal', 'indigo']
const FONT_SIZES = ['', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '40px', '48px']
const FONT_FAMILIES = ['', 'Poppins', 'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Source Sans Pro']

const TYPOGRAPHY_VISUAL_FIELDS: Array<keyof MetricsConfig> = [
  'value_font_color', 'value_font_family', 'value_bold', 'value_italic', 'value_allcaps',
  'label_font_color', 'label_font_family', 'label_bold', 'label_italic', 'label_allcaps',
  'desc_font_color', 'desc_font_family', 'desc_bold', 'desc_italic', 'desc_allcaps',
]

interface MetricsFormProps {
  onSubmit: (formData: MetricsFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  presentationId?: string | null
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig | null) => void
  researchControls?: ReactNode
}

function OptionalNumberInput({
  label,
  value,
  disabled,
  min = 0,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value?: number
  disabled: boolean
  min?: number
  max?: number
  step?: number
  onChange: (value: number | undefined) => void
}) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        placeholder="Auto"
        onChange={event => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900"
      />
    </label>
  )
}

function TriStateStyleButton({
  label,
  fieldLabel,
  value,
  disabled,
  onChange,
}: {
  label: string
  fieldLabel: string
  value?: boolean | null
  disabled: boolean
  onChange: (value: boolean | undefined) => void
}) {
  const stateLabel = value === undefined || value === null ? 'Auto' : value ? 'On' : 'Off'
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${fieldLabel}: ${stateLabel}. Activate to change.`}
      onClick={() => onChange(value === undefined || value === null ? true : value ? false : undefined)}
      className={`h-6 min-w-7 rounded border px-1 text-[9px] font-semibold disabled:cursor-not-allowed ${
        value === true
          ? 'border-primary bg-primary text-white'
          : value === false
            ? 'border-slate-300 bg-white text-slate-400 line-through dark:border-slate-600 dark:bg-slate-800'
            : 'border-dashed border-slate-300 bg-transparent text-slate-400 dark:border-slate-600'
      }`}
      title={`${fieldLabel}: ${stateLabel}`}
    >
      {label}
    </button>
  )
}

export function MetricsForm({
  onSubmit,
  registerSubmit,
  isGenerating,
  presentationId,
  elementContext,
  prompt,
  showAdvanced,
  registerMandatoryConfig,
  researchControls,
}: MetricsFormProps) {
  const [count, setCount] = useState(1)
  const [layoutChoice, setLayoutChoice] = useState<MetricsLayoutChoice>('auto')
  const [visualOverrides, setVisualOverrides] = useState<Partial<MetricsConfig>>({})
  const [fitMode, setFitMode] = useState<MetricsFitMode>('AUTO')
  const [manualOverrides, setManualOverrides] = useState<MetricsManualOverrides>({})
  const [positionModified, setPositionModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)
  const [showContentFit, setShowContentFit] = useState(false)
  const [showTypography, setShowTypography] = useState(false)
  const [showSpacing, setShowSpacing] = useState(false)
  const [showPositioning, setShowPositioning] = useState(false)
  const [positionConfig, setPositionConfig] = useState<TextLabsPositionConfig>({
    start_col: 2,
    start_row: 4,
    position_width: DEFAULTS.width,
    position_height: DEFAULTS.height,
    auto_position: false,
  })

  useEffect(() => {
    registerMandatoryConfig(null)
  }, [registerMandatoryConfig])

  useEffect(() => {
    if (!elementContext) return
    setPositionConfig(previous => ({
      ...previous,
      start_col: elementContext.startCol,
      start_row: elementContext.startRow,
      position_width: elementContext.width,
      position_height: elementContext.height,
    }))
  }, [elementContext])

  const area = useMemo(() => ({
    start_col: positionConfig.start_col,
    start_row: positionConfig.start_row,
    position_width: positionConfig.position_width,
    position_height: positionConfig.position_height,
  }), [positionConfig])
  const resolvedLayout = useMemo(
    () => resolveMetricsLayout(area, count, layoutChoice),
    [area, count, layoutChoice],
  )

  useEffect(() => {
    if (count === 1 && layoutChoice !== 'auto') setLayoutChoice('auto')
  }, [count, layoutChoice])

  const updateVisualOverride = useCallback(<K extends keyof MetricsConfig>(field: K, value: MetricsConfig[K] | undefined) => {
    setVisualOverrides(previous => {
      const next = { ...previous }
      if (value === undefined) delete next[field]
      else next[field] = value
      return next
    })
  }, [])

  const updateManualOverride = useCallback(<K extends keyof MetricsManualOverrides>(field: K, value: MetricsManualOverrides[K] | undefined) => {
    setManualOverrides(previous => {
      const next = { ...previous }
      if (value === undefined) delete next[field]
      else next[field] = value
      return next
    })
  }, [])

  const surfaceValue = visualOverrides.color_scheme ?? ''
  const cornersValue = visualOverrides.corners ?? ''
  const borderValue = visualOverrides.border === undefined ? '' : visualOverrides.border ? 'on' : 'off'
  const fitIsManual = fitMode === 'MANUAL'

  const handleSubmit = useCallback(() => {
    const metricsConfig: Partial<MetricsConfig> = {
      ...visualOverrides,
      // Text Labs owns no parallel layout resolver; its compose geometry reads
      // this explicit structural field from the sparse metrics config.
      layout: resolvedLayout.layout,
    }
    if (fitMode === 'AUTO') {
      for (const field of TYPOGRAPHY_VISUAL_FIELDS) delete metricsConfig[field]
    }
    if (!metricsConfig.color_scheme) delete metricsConfig.color_variant

    const formData: MetricsFormData = {
      componentType: 'METRICS',
      prompt,
      count,
      // The backend receives the resolved structural arrangement. "Auto" is a
      // panel decision, never a second content-fit formula.
      layout: resolvedLayout.layout,
      advancedModified: positionModified
        || Object.keys(visualOverrides).length > 0
        || fitMode === 'MANUAL',
      z_index: zIndex,
      presentationId,
      useDeckTheme: Boolean(presentationId),
      themeOverrides: null,
      metricsFitMode: fitMode,
      metricsLayoutChoice: layoutChoice,
      // MANUAL is an explicit ownership handoff. An empty object is meaningful
      // when the user changed only visual typography fields.
      manualMetricsOverrides: fitIsManual ? manualOverrides : undefined,
      metricsConfig,
      compose: count > 1,
      elements: count > 1
        ? resolvedLayout.boxes.map(grid_position => ({ grid_position }))
        : undefined,
      positionConfig,
    }
    onSubmit(formData)
  }, [count, fitIsManual, fitMode, manualOverrides, onSubmit, positionConfig, positionModified, presentationId, prompt, resolvedLayout, visualOverrides, zIndex])

  useEffect(() => registerSubmit(handleSubmit), [handleSubmit, registerSubmit])

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
        <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-2">
          <label className="space-y-1">
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Count</span>
            <select
              aria-label="Metric count"
              value={count}
              disabled={isGenerating}
              onChange={event => setCount(Number(event.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
            >
              {[1, 2, 3, 4].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <div className="min-w-0 space-y-1">
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Layout</span>
            <div className="grid grid-cols-4 gap-1" role="group" aria-label="Metric layout">
              {([
                ['auto', 'Auto'],
                ['horizontal', 'H'],
                ['vertical', 'V'],
                ['grid', 'Grid'],
              ] as const).map(([value, label]) => {
                const unavailable = value !== 'auto' && (
                  count === 1 || !isMetricsLayoutViable(area, count, value)
                )
                return (
                  <button
                    key={value}
                    type="button"
                    title={unavailable ? 'Resize the placeholder to make this layout viable.' : label}
                    disabled={isGenerating || unavailable}
                    aria-pressed={layoutChoice === value}
                    onClick={() => setLayoutChoice(value)}
                    className={`rounded-md border px-1 py-1.5 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                      layoutChoice === value
                        ? 'border-primary bg-primary text-white'
                        : 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <p className={`mt-1.5 text-[9px] ${resolvedLayout.viable ? 'text-slate-400' : 'font-medium text-amber-600 dark:text-amber-400'}`}>
          {count === 1
            ? 'One card uses the full live placeholder.'
            : resolvedLayout.viable
              ? `${layoutChoice === 'auto' ? 'Auto resolves' : 'Layout resolves'} to ${resolvedLayout.layout} for this ${area.position_width}×${area.position_height} area.`
              : 'This area is too small for viable metric cards. Resize the placeholder before generating.'}
        </p>
      </section>

      {researchControls}

      <section className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200">Appearance</div>
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1">
            <span className="text-[10px] text-slate-500">Surface</span>
            <select
              aria-label="Metric surface"
              value={surfaceValue}
              onChange={event => {
                const value = event.target.value as '' | MetricsConfig['color_scheme']
                updateVisualOverride('color_scheme', value || undefined)
                if (!value) updateVisualOverride('color_variant', undefined)
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-1.5 py-1.5 text-[10px] dark:border-slate-600 dark:bg-slate-800"
            >
              {SURFACES.map(option => <option key={option.value || 'auto'} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] text-slate-500">Corners</span>
            <select aria-label="Metric corners" value={cornersValue} onChange={event => updateVisualOverride('corners', event.target.value ? event.target.value as MetricsConfig['corners'] : undefined)} className="w-full rounded-md border border-slate-300 bg-white px-1.5 py-1.5 text-[10px] dark:border-slate-600 dark:bg-slate-800">
              <option value="">Auto</option><option value="rounded">Rounded</option><option value="square">Square</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] text-slate-500">Border</span>
            <select aria-label="Metric border" value={borderValue} onChange={event => updateVisualOverride('border', event.target.value === '' ? undefined : event.target.value === 'on')} className="w-full rounded-md border border-slate-300 bg-white px-1.5 py-1.5 text-[10px] dark:border-slate-600 dark:bg-slate-800">
              <option value="">Auto</option><option value="on">On</option><option value="off">Off</option>
            </select>
          </label>
        </div>
        <p className="mt-1.5 text-[9px] leading-4 text-slate-400">Auto uses the presentation theme contract when available, otherwise the Metrics renderer default.</p>
      </section>

      {showAdvanced && (
        <section className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Advanced</div>
              <div className="text-[9px] text-slate-500">Auto fit is resolved by Text Service from each card.</div>
            </div>
            <select aria-label="Metrics fit mode" value={fitMode} onChange={event => setFitMode(event.target.value as MetricsFitMode)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold dark:border-slate-600 dark:bg-slate-800">
              <option value="AUTO">Auto fit</option><option value="MANUAL">Manual fit</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] text-slate-500">Alignment</span>
              <select value={visualOverrides.alignment ?? ''} onChange={event => updateVisualOverride('alignment', event.target.value ? event.target.value as MetricsConfig['alignment'] : undefined)} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800">
                <option value="">Auto</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-500">Trend</span>
              <select value={visualOverrides.trend ?? ''} onChange={event => updateVisualOverride('trend', event.target.value ? event.target.value as MetricsConfig['trend'] : undefined)} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800">
                <option value="">Auto</option><option value="arrow">Arrow</option><option value="pill">Pill</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-500">Surface color</span>
              <select disabled={!surfaceValue} value={visualOverrides.color_variant ?? ''} onChange={event => updateVisualOverride('color_variant', event.target.value || undefined)} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:disabled:bg-slate-900">
                {COLORS.map(color => <option key={color || 'auto'} value={color}>{color ? color[0].toUpperCase() + color.slice(1) : 'Auto'}</option>)}
              </select>
            </label>
          </div>

          <CollapsibleSection title="Content fit" isOpen={showContentFit} onToggle={() => setShowContentFit(value => !value)}>
            <fieldset disabled={!fitIsManual} className="grid grid-cols-2 gap-2 disabled:opacity-45">
              <OptionalNumberInput label="Value min chars" value={manualOverrides.value_min_chars} disabled={!fitIsManual} min={1} onChange={value => updateManualOverride('value_min_chars', value)} />
              <OptionalNumberInput label="Value max chars" value={manualOverrides.value_max_chars} disabled={!fitIsManual} min={1} onChange={value => updateManualOverride('value_max_chars', value)} />
              <OptionalNumberInput label="Label min chars" value={manualOverrides.label_min_chars} disabled={!fitIsManual} min={1} onChange={value => updateManualOverride('label_min_chars', value)} />
              <OptionalNumberInput label="Label max chars" value={manualOverrides.label_max_chars} disabled={!fitIsManual} min={1} onChange={value => updateManualOverride('label_max_chars', value)} />
              <OptionalNumberInput label="Description min" value={manualOverrides.description_min_chars} disabled={!fitIsManual} min={1} onChange={value => updateManualOverride('description_min_chars', value)} />
              <OptionalNumberInput label="Description max" value={manualOverrides.description_max_chars} disabled={!fitIsManual} min={1} onChange={value => updateManualOverride('description_max_chars', value)} />
            </fieldset>
          </CollapsibleSection>

          <CollapsibleSection title="Typography" isOpen={showTypography} onToggle={() => setShowTypography(value => !value)}>
            <fieldset disabled={!fitIsManual} className="space-y-2 disabled:opacity-45">
              {(['value', 'label', 'desc'] as const).map(prefix => (
                <div key={prefix} className="space-y-1.5 rounded-md border border-slate-200 p-1.5 dark:border-slate-700">
                  <div className="grid grid-cols-3 gap-1.5">
                    <label className="space-y-1"><span className="text-[9px] capitalize text-slate-500">{prefix === 'desc' ? 'Description' : prefix} size</span><select disabled={!fitIsManual} value={manualOverrides[`${prefix}_font_size`]} onChange={event => updateManualOverride(`${prefix}_font_size`, event.target.value || undefined)} className="w-full rounded border border-slate-300 bg-white px-1 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800">{FONT_SIZES.map(size => <option key={size || 'auto'} value={size}>{size || 'Auto'}</option>)}</select></label>
                    <label className="space-y-1"><span className="text-[9px] text-slate-500">Family</span><select disabled={!fitIsManual} value={(visualOverrides[`${prefix}_font_family`] as string | null | undefined) ?? ''} onChange={event => updateVisualOverride(`${prefix}_font_family`, event.target.value || undefined)} className="w-full rounded border border-slate-300 bg-white px-1 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800">{FONT_FAMILIES.map(family => <option key={family || 'auto'} value={family}>{family || 'Auto'}</option>)}</select></label>
                    <label className="space-y-1"><span className="text-[9px] text-slate-500">Color</span><input disabled={!fitIsManual} type="text" placeholder="Auto" value={(visualOverrides[`${prefix}_font_color`] as string | null | undefined) ?? ''} onChange={event => updateVisualOverride(`${prefix}_font_color`, event.target.value || undefined)} className="w-full rounded border border-slate-300 bg-white px-1 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800" /></label>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="mr-auto text-[9px] capitalize text-slate-400">{prefix === 'desc' ? 'Description' : prefix} style</span>
                    <TriStateStyleButton label="B" fieldLabel={`${prefix} bold`} value={visualOverrides[`${prefix}_bold`] as boolean | null | undefined} disabled={!fitIsManual} onChange={value => updateVisualOverride(`${prefix}_bold`, value)} />
                    <TriStateStyleButton label="I" fieldLabel={`${prefix} italic`} value={visualOverrides[`${prefix}_italic`] as boolean | null | undefined} disabled={!fitIsManual} onChange={value => updateVisualOverride(`${prefix}_italic`, value)} />
                    <TriStateStyleButton label="AA" fieldLabel={`${prefix} uppercase`} value={visualOverrides[`${prefix}_allcaps`] as boolean | null | undefined} disabled={!fitIsManual} onChange={value => updateVisualOverride(`${prefix}_allcaps`, value)} />
                  </div>
                </div>
              ))}
            </fieldset>
          </CollapsibleSection>

          <CollapsibleSection title="Spacing & padding" isOpen={showSpacing} onToggle={() => setShowSpacing(value => !value)}>
            <fieldset disabled={!fitIsManual} className="grid grid-cols-3 gap-2 disabled:opacity-45">
              <OptionalNumberInput label="Padding (px)" value={manualOverrides.padding_px} disabled={!fitIsManual} onChange={value => updateManualOverride('padding_px', value)} />
              <OptionalNumberInput label="Value gap (px)" value={manualOverrides.value_margin_bottom_px} disabled={!fitIsManual} onChange={value => updateManualOverride('value_margin_bottom_px', value)} />
              <OptionalNumberInput label="Label gap (px)" value={manualOverrides.label_margin_bottom_px} disabled={!fitIsManual} onChange={value => updateManualOverride('label_margin_bottom_px', value)} />
            </fieldset>
          </CollapsibleSection>

          <CollapsibleSection title="Positioning" isOpen={showPositioning} onToggle={() => setShowPositioning(value => !value)}>
            <div className="space-y-2">
              <PositionPresets positionConfig={positionConfig} onChange={setPositionConfig} elementType="METRICS" onAdvancedModified={() => setPositionModified(true)} />
              <ZIndexInput value={zIndex} onChange={setZIndex} onAdvancedModified={() => setPositionModified(true)} />
            </div>
          </CollapsibleSection>
        </section>
      )}
    </div>
  )
}

MetricsForm.displayName = 'MetricsForm'

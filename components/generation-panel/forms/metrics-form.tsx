'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import type {
  MetricsConfig,
  MetricsFitMode,
  MetricsFormData,
  MetricsManualOverrides,
  TextLabsPaddingConfig,
  TextLabsPositionConfig,
} from '@/types/textlabs'
import { TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import type { ElementContext, MandatoryConfig } from '../types'
import { CollapsibleSection } from '../shared/collapsible-section'
import { PaddingControl } from '../shared/padding-control'
import { PositionPresets } from '../shared/position-presets'
import { ToggleRow } from '../shared/toggle-row'
import { ZIndexInput } from '../shared/z-index-input'
import {
  isMetricsLayoutViable,
  resolveMetricsLayout,
  type MetricsLayoutChoice,
} from '@/lib/metrics-layout'
import {
  METRICS_CARD_COLOR_PRESETS,
  resolveMetricsCardColorPatch,
  type MetricsCardColorChoice,
} from '@/lib/metrics-card-design'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.METRICS
const PRIMARY_SURFACES: Array<{ value: '' | MetricsConfig['color_scheme']; label: string }> = [
  { value: '', label: 'Auto' },
  { value: 'solid', label: 'Filled' },
  { value: 'accent', label: 'Pastel' },
  { value: 'transparent', label: 'Clear' },
  { value: 'bordered', label: 'Outline' },
]
const ADVANCED_SURFACES: Array<{ value: '' | MetricsConfig['color_scheme']; label: string }> = [
  ...PRIMARY_SURFACES,
  { value: 'gradient', label: 'Gradient' },
]
const FONT_SIZES = ['', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '40px', '48px']
const FONT_FAMILIES = ['', 'Poppins', 'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Source Sans Pro']
const LIGHT_FONT_COLORS = [
  { value: undefined, label: 'Auto', hex: undefined },
  { value: '#FFFFFF', label: 'White', hex: '#FFFFFF' },
  { value: '#E5E7EB', label: 'Light Gray', hex: '#E5E7EB' },
  { value: '#C4B5FD', label: 'Lavender', hex: '#C4B5FD' },
  { value: '#93C5FD', label: 'Sky', hex: '#93C5FD' },
  { value: '#FDE68A', label: 'Gold', hex: '#FDE68A' },
  { value: '#FCA5A5', label: 'Rose', hex: '#FCA5A5' },
] as const
const DARK_FONT_COLORS = [
  { value: undefined, label: 'Auto', hex: undefined },
  { value: '#1F2937', label: 'Dark', hex: '#1F2937' },
  { value: '#374151', label: 'Gray', hex: '#374151' },
  { value: '#5B21B6', label: 'Purple', hex: '#5B21B6' },
  { value: '#1D4ED8', label: 'Blue', hex: '#1D4ED8' },
  { value: '#D97706', label: 'Amber', hex: '#D97706' },
  { value: '#BE185D', label: 'Pink', hex: '#BE185D' },
] as const

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
  const [multiBoxColorMode, setMultiBoxColorMode] = useState<NonNullable<MetricsFormData['multiBoxColorMode']>>('SAME')
  const [visualOverrides, setVisualOverrides] = useState<Partial<MetricsConfig>>({})
  const [fitMode, setFitMode] = useState<MetricsFitMode>('AUTO')
  const [manualOverrides, setManualOverrides] = useState<MetricsManualOverrides>({})
  const [positionModified, setPositionModified] = useState(false)
  const [paddingModified, setPaddingModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)
  const [showInstances, setShowInstances] = useState(false)
  const [showCardDesign, setShowCardDesign] = useState(false)
  const [showValue, setShowValue] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  const [showDescription, setShowDescription] = useState(false)
  const [showSpacing, setShowSpacing] = useState(false)
  const [showPositioning, setShowPositioning] = useState(false)
  const [showPadding, setShowPadding] = useState(false)
  const [positionConfig, setPositionConfig] = useState<TextLabsPositionConfig>({
    start_col: 2,
    start_row: 4,
    position_width: DEFAULTS.width,
    position_height: DEFAULTS.height,
    auto_position: false,
  })
  const [paddingConfig, setPaddingConfig] = useState<TextLabsPaddingConfig>({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
  const primarySurfaceValue = surfaceValue === 'gradient' ? '__advanced' : surfaceValue
  const cornersValue = visualOverrides.corners ?? ''
  const borderValue = visualOverrides.border === undefined ? '' : visualOverrides.border ? 'on' : 'off'
  const fitIsManual = fitMode === 'MANUAL'
  const fontColorPresets = surfaceValue === 'accent' ? DARK_FONT_COLORS : LIGHT_FONT_COLORS
  const cardColorIsAuto = !visualOverrides.color_variant && surfaceValue !== 'transparent'

  const updateSurface = useCallback((value: '' | MetricsConfig['color_scheme']) => {
    updateVisualOverride('color_scheme', value || undefined)
    if (!value) updateVisualOverride('color_variant', undefined)
  }, [updateVisualOverride])

  const selectCardColor = useCallback((value: MetricsCardColorChoice) => {
    const patch = resolveMetricsCardColorPatch(surfaceValue || undefined, value)
    updateVisualOverride('color_scheme', patch.color_scheme)
    updateVisualOverride('color_variant', patch.color_variant)
  }, [surfaceValue, updateVisualOverride])

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
    const hasEffectiveVisualOverrides = Object.keys(metricsConfig).some(field => field !== 'layout')
    const hasContainerPadding = Object.values(paddingConfig).some(value => value > 0)

    const formData: MetricsFormData = {
      componentType: 'METRICS',
      prompt,
      count,
      // The backend receives the resolved structural arrangement. "Auto" is a
      // panel decision, never a second content-fit formula.
      layout: resolvedLayout.layout,
      advancedModified: positionModified
        || (paddingModified && hasContainerPadding)
        || hasEffectiveVisualOverrides
        || fitMode === 'MANUAL',
      z_index: zIndex,
      presentationId,
      useDeckTheme: Boolean(presentationId),
      themeOverrides: null,
      metricsFitMode: fitMode,
      multiBoxColorMode: count > 1 ? multiBoxColorMode : undefined,
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
      paddingConfig,
    }
    onSubmit(formData)
  }, [count, fitIsManual, fitMode, layoutChoice, manualOverrides, multiBoxColorMode, onSubmit, paddingConfig, paddingModified, positionConfig, positionModified, presentationId, prompt, resolvedLayout, visualOverrides, zIndex])

  useEffect(() => registerSubmit(handleSubmit), [handleSubmit, registerSubmit])

  const renderCountLayoutControls = (advanced = false) => (
    <>
      <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-2">
        <label className="space-y-1">
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Count</span>
          <select
            aria-label={advanced ? 'Advanced metric count' : 'Metric count'}
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
          <div className="grid grid-cols-4 gap-1" role="group" aria-label={advanced ? 'Advanced metric layout' : 'Metric layout'}>
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
      {count > 1 && (
        <label className="mt-2 block space-y-1">
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Card colors</span>
          <select
            aria-label={advanced ? 'Advanced metric card color pattern' : 'Metric card color pattern'}
            value={multiBoxColorMode}
            disabled={isGenerating}
            onChange={event => setMultiBoxColorMode(event.target.value as NonNullable<MetricsFormData['multiBoxColorMode']>)}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="SAME">Same color — default</option>
            <option value="ALTERNATING">Alternating theme colors</option>
            <option value="PRIMARY_ACCENTS">Primary color accents</option>
            <option value="THEME_SEQUENCE">Different theme colors</option>
          </select>
        </label>
      )}
      <p className={`mt-1.5 text-[9px] ${resolvedLayout.viable ? 'text-slate-400' : 'font-medium text-amber-600 dark:text-amber-400'}`}>
        {count === 1
          ? 'One card uses the full live placeholder.'
          : resolvedLayout.viable
            ? `${layoutChoice === 'auto' ? 'Auto resolves' : 'Layout resolves'} to ${resolvedLayout.layout} for this ${area.position_width}×${area.position_height} area.`
            : 'This area is too small for viable metric cards. Resize the placeholder before generating.'}
      </p>
    </>
  )

  const renderMetricTextControls = (prefix: 'value' | 'label' | 'desc') => {
    const title = prefix === 'desc' ? 'Description' : prefix[0].toUpperCase() + prefix.slice(1)
    const minField = (prefix === 'desc' ? 'description_min_chars' : `${prefix}_min_chars`) as keyof MetricsManualOverrides
    const maxField = (prefix === 'desc' ? 'description_max_chars' : `${prefix}_max_chars`) as keyof MetricsManualOverrides
    const sizeField = `${prefix}_font_size` as keyof MetricsManualOverrides
    const familyField = `${prefix}_font_family` as keyof MetricsConfig
    const colorField = `${prefix}_font_color` as keyof MetricsConfig
    const boldField = `${prefix}_bold` as keyof MetricsConfig
    const italicField = `${prefix}_italic` as keyof MetricsConfig
    const allcapsField = `${prefix}_allcaps` as keyof MetricsConfig

    return (
      <fieldset disabled={!fitIsManual} className="space-y-2 disabled:opacity-45">
        <p className="text-[9px] leading-4 text-slate-400">
          {fitIsManual ? `${title} overrides are sparse; blank fields remain service-owned.` : 'Select Manual fit above to override service-resolved content and typography.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <OptionalNumberInput
            label={`${title} min chars`}
            value={manualOverrides[minField] as number | undefined}
            disabled={!fitIsManual}
            min={1}
            max={manualOverrides[maxField] as number | undefined}
            onChange={value => updateManualOverride(minField, value)}
          />
          <OptionalNumberInput
            label={`${title} max chars`}
            value={manualOverrides[maxField] as number | undefined}
            disabled={!fitIsManual}
            min={(manualOverrides[minField] as number | undefined) ?? 1}
            max={prefix === 'value' ? 20 : prefix === 'label' ? 50 : 200}
            onChange={value => updateManualOverride(maxField, value)}
          />
        </div>
        <div className="space-y-1.5 rounded-md border border-slate-200 p-1.5 dark:border-slate-700">
          <div className="grid grid-cols-3 gap-1.5">
            <label className="space-y-1">
              <span className="text-[9px] text-slate-500">Size</span>
              <select
                disabled={!fitIsManual}
                value={(manualOverrides[sizeField] as string | undefined) ?? ''}
                onChange={event => updateManualOverride(sizeField, event.target.value || undefined)}
                className="w-full rounded border border-slate-300 bg-white px-1 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800"
              >
                {FONT_SIZES.map(size => <option key={size || 'auto'} value={size}>{size || 'Auto'}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[9px] text-slate-500">Family</span>
              <select
                disabled={!fitIsManual}
                value={(visualOverrides[familyField] as string | null | undefined) ?? ''}
                onChange={event => updateVisualOverride(familyField, event.target.value || undefined)}
                className="w-full rounded border border-slate-300 bg-white px-1 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800"
              >
                {FONT_FAMILIES.map(family => <option key={family || 'auto'} value={family}>{family || 'Auto'}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[9px] text-slate-500">Color</span>
              <input
                disabled={!fitIsManual}
                type="text"
                placeholder="Auto"
                value={(visualOverrides[colorField] as string | null | undefined) ?? ''}
                onChange={event => updateVisualOverride(colorField, event.target.value || undefined)}
                className="w-full rounded border border-slate-300 bg-white px-1 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[9px] text-slate-400">Color presets</span>
            {fontColorPresets.map(preset => (
              <button
                key={preset.label}
                type="button"
                disabled={!fitIsManual}
                aria-label={`${title} font color: ${preset.label}`}
                aria-pressed={(visualOverrides[colorField] ?? undefined) === preset.value}
                title={preset.label}
                onClick={() => updateVisualOverride(colorField, preset.value)}
                style={preset.hex ? { backgroundColor: preset.hex } : undefined}
                className={`h-5 w-5 rounded-full border transition-transform disabled:cursor-not-allowed ${
                  (visualOverrides[colorField] ?? undefined) === preset.value
                    ? 'ring-2 ring-primary ring-offset-1'
                    : 'hover:scale-110'
                } ${preset.hex ? 'border-slate-300 dark:border-slate-600' : 'border-slate-300 bg-gradient-to-br from-purple-400 via-blue-400 to-green-400 dark:border-slate-600'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-auto text-[9px] text-slate-400">{title} style</span>
            <TriStateStyleButton label="B" fieldLabel={`${title} bold`} value={visualOverrides[boldField] as boolean | null | undefined} disabled={!fitIsManual} onChange={value => updateVisualOverride(boldField, value)} />
            <TriStateStyleButton label="I" fieldLabel={`${title} italic`} value={visualOverrides[italicField] as boolean | null | undefined} disabled={!fitIsManual} onChange={value => updateVisualOverride(italicField, value)} />
            <TriStateStyleButton label="AA" fieldLabel={`${title} uppercase`} value={visualOverrides[allcapsField] as boolean | null | undefined} disabled={!fitIsManual} onChange={value => updateVisualOverride(allcapsField, value)} />
          </div>
        </div>
      </fieldset>
    )
  }

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
        {renderCountLayoutControls()}
      </section>

      {researchControls}

      <section className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200">Appearance</div>
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1">
            <span className="text-[10px] text-slate-500">Surface</span>
            <select
              aria-label="Metric surface"
              value={primarySurfaceValue}
              onChange={event => {
                const value = event.target.value as '' | MetricsConfig['color_scheme']
                updateSurface(value)
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-1.5 py-1.5 text-[10px] dark:border-slate-600 dark:bg-slate-800"
            >
              {primarySurfaceValue === '__advanced' && <option value="__advanced" disabled>Custom</option>}
              {PRIMARY_SURFACES.map(option => <option key={option.value || 'auto'} value={option.value}>{option.label}</option>)}
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

          <CollapsibleSection title="Instances" isOpen={showInstances} onToggle={() => setShowInstances(value => !value)}>
            {renderCountLayoutControls(true)}
          </CollapsibleSection>

          <CollapsibleSection title="Card Design" isOpen={showCardDesign} onToggle={() => setShowCardDesign(value => !value)}>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="metrics-advanced-surface" className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Surface</label>
                <select
                  id="metrics-advanced-surface"
                  aria-label="Advanced metric surface"
                  value={surfaceValue}
                  onChange={event => updateSurface(event.target.value as '' | MetricsConfig['color_scheme'])}
                  className="min-w-36 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                >
                  {ADVANCED_SURFACES.map(option => <option key={option.value || 'auto'} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <ToggleRow
                label="Corners"
                field="corners"
                value={cornersValue || 'auto'}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'rounded', label: 'Rnd' },
                  { value: 'square', label: 'Sqr' },
                ]}
                onChange={(_field, value) => updateVisualOverride('corners', value === 'auto' ? undefined : value as MetricsConfig['corners'])}
              />
              <ToggleRow
                label="Border"
                field="border"
                value={borderValue || 'auto'}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'on', label: 'On' },
                  { value: 'off', label: 'Off' },
                ]}
                onChange={(_field, value) => updateVisualOverride('border', value === 'auto' ? undefined : value === 'on')}
              />
              <ToggleRow
                label="Alignment"
                field="alignment"
                value={visualOverrides.alignment ?? 'auto'}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'left', label: 'L' },
                  { value: 'center', label: 'C' },
                  { value: 'right', label: 'R' },
                ]}
                onChange={(_field, value) => updateVisualOverride('alignment', value === 'auto' ? undefined : value as MetricsConfig['alignment'])}
              />
              <ToggleRow
                label="Trend"
                field="trend"
                value={visualOverrides.trend ?? 'auto'}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'arrow', label: 'Arrow' },
                  { value: 'pill', label: 'Pill' },
                ]}
                onChange={(_field, value) => updateVisualOverride('trend', value === 'auto' ? undefined : value as MetricsConfig['trend'])}
              />
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Card Color</div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Metric card color">
                  <button
                    type="button"
                    aria-label="Card color: Auto"
                    aria-pressed={cardColorIsAuto}
                    onClick={() => selectCardColor('auto')}
                    className={`h-6 w-6 rounded-full border border-gray-300 bg-gradient-to-br from-purple-400 via-blue-400 to-green-400 transition-all dark:border-slate-600 ${
                      cardColorIsAuto ? 'ring-2 ring-primary ring-offset-1' : 'hover:scale-110'
                    }`}
                    title="Auto"
                  />
                  <button
                    type="button"
                    aria-label="Card color: Transparent"
                    aria-pressed={surfaceValue === 'transparent'}
                    onClick={() => selectCardColor('transparent')}
                    className={`h-6 w-6 rounded-full border border-slate-400 transition-all dark:border-slate-500 ${
                      surfaceValue === 'transparent' ? 'ring-2 ring-primary ring-offset-1' : 'hover:scale-110'
                    }`}
                    style={{
                      backgroundColor: 'transparent',
                      backgroundImage: 'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)',
                      backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
                      backgroundSize: '8px 8px',
                    }}
                    title="Transparent"
                  />
                  {METRICS_CARD_COLOR_PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      aria-label={`Card color: ${preset.label}`}
                      aria-pressed={visualOverrides.color_variant === preset.name}
                      onClick={() => selectCardColor(preset.name)}
                      style={{ backgroundColor: surfaceValue === 'accent' ? preset.pastelHex : preset.hex }}
                      className={`h-6 w-6 rounded-full border border-gray-200 transition-all dark:border-slate-700 ${
                        visualOverrides.color_variant === preset.name
                          ? 'ring-2 ring-primary ring-offset-1'
                          : 'hover:scale-110'
                      }`}
                      title={preset.label}
                    />
                  ))}
                </div>
              </div>
              <p className="text-[9px] leading-4 text-slate-400">Selecting a color makes the surface Filled when needed. Transparent creates a clear card. Gradient remains an explicit Advanced override.</p>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Value" isOpen={showValue} onToggle={() => setShowValue(value => !value)}>
            {renderMetricTextControls('value')}
          </CollapsibleSection>

          <CollapsibleSection title="Label" isOpen={showLabel} onToggle={() => setShowLabel(value => !value)}>
            {renderMetricTextControls('label')}
          </CollapsibleSection>

          <CollapsibleSection title="Description" isOpen={showDescription} onToggle={() => setShowDescription(value => !value)}>
            {renderMetricTextControls('desc')}
          </CollapsibleSection>

          <CollapsibleSection title="Spacing & padding" isOpen={showSpacing} onToggle={() => setShowSpacing(value => !value)}>
            <div className="space-y-1.5">
              <p className="text-[9px] leading-4 text-slate-400">Per-card spacing is owned by Auto fit until Manual fit is selected.</p>
              <fieldset disabled={!fitIsManual} className="grid grid-cols-3 gap-2 disabled:opacity-45">
                <OptionalNumberInput label="Card padding (px)" value={manualOverrides.padding_px} disabled={!fitIsManual} onChange={value => updateManualOverride('padding_px', value)} />
                <OptionalNumberInput label="Value gap (px)" value={manualOverrides.value_margin_bottom_px} disabled={!fitIsManual} onChange={value => updateManualOverride('value_margin_bottom_px', value)} />
                <OptionalNumberInput label="Label gap (px)" value={manualOverrides.label_margin_bottom_px} disabled={!fitIsManual} onChange={value => updateManualOverride('label_margin_bottom_px', value)} />
              </fieldset>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Positioning" isOpen={showPositioning} onToggle={() => setShowPositioning(value => !value)}>
            <div className="space-y-2">
              <PositionPresets positionConfig={positionConfig} onChange={setPositionConfig} elementType="METRICS" onAdvancedModified={() => setPositionModified(true)} />
              <ZIndexInput value={zIndex} onChange={setZIndex} onAdvancedModified={() => setPositionModified(true)} />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Container Padding" isOpen={showPadding} onToggle={() => setShowPadding(value => !value)}>
            <div className="space-y-1.5">
              <p className="text-[9px] leading-4 text-slate-400">Adds outer padding around the generated Metrics element, independently of per-card fit.</p>
              <PaddingControl paddingConfig={paddingConfig} onChange={setPaddingConfig} onAdvancedModified={() => setPaddingModified(true)} />
            </div>
          </CollapsibleSection>
        </section>
      )}
    </div>
  )
}

MetricsForm.displayName = 'MetricsForm'

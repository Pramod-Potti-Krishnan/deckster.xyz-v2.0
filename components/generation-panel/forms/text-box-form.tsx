'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  type TemplateSlotCatalog,
  type ImageFormData,
  type TextBoxConfig,
  type TextBoxFormData,
  type TextBoxStructure,
  type TextBoxTitleStyle,
  type TextLabsPositionConfig,
  type TextLabsFormData,
  type TextManualGeometryOverrides,
  type TextSemanticRole,
  type TextSlotKind,
  TEXT_LABS_ELEMENT_DEFAULTS,
} from '@/types/textlabs'
import { type ElementContext, type MandatoryConfig } from '../types'
import { CollapsibleSection } from '../shared/collapsible-section'
import { PositionPresets } from '../shared/position-presets'
import { ZIndexInput } from '../shared/z-index-input'
import { splitGridArea } from '@/lib/grid-splitter'
import {
  BODY_TEXT_AUTO_SLOT,
  findSelectedSlot,
  selectionForExistingTarget,
  slotMetadataForRequest,
  slotSelectionValue,
} from '@/lib/text-slot-catalog'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.TEXT_BOX

const STRUCTURE_OPTIONS: Array<{ value: TextBoxStructure; label: string }> = [
  { value: 'classic', label: 'Classic' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'simple', label: 'Simple' },
  { value: 'SEQUENTIAL', label: 'Sequential' },
  { value: 'COMPARISON', label: 'Compare' },
  { value: 'SECTIONS', label: 'Sections' },
  { value: 'CALLOUT', label: 'Callout' },
  { value: 'TEXT_BULLETS', label: 'Bullets' },
  { value: 'BULLET_BOX', label: 'Bullet Box' },
  { value: 'NUMBERED_LIST', label: 'Numbered' },
]

const TITLE_STYLE_OPTIONS: Array<{ value: TextBoxTitleStyle; label: string }> = [
  { value: 'plain', label: 'Plain' },
  { value: 'highlighted', label: 'Caps' },
  { value: 'colored-bg', label: 'Badge' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'light-bg', label: 'Light surface' },
  { value: 'light-bg-dark', label: 'Dark surface' },
  { value: 'underline', label: 'Rule' },
  { value: 'colored_underline', label: 'Accent rule' },
]

const COLOR_VARIANTS = [
  { value: 'purple', label: 'Purple' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'red', label: 'Red' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'orange', label: 'Orange' },
  { value: 'pink', label: 'Pink' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'teal', label: 'Teal' },
  { value: 'indigo', label: 'Indigo' },
]

interface ExistingTextTarget {
  semanticRole?: TextSemanticRole | null
  slotName?: string | null
  slotKind?: TextSlotKind | null
  accessoryType?: string | null
}

interface TextBoxFormProps {
  onSubmit: (formData: TextLabsFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  presentationId?: string | null
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig) => void
  researchControls?: ReactNode
  slotCatalog: TemplateSlotCatalog
  slotCatalogLoading: boolean
  slotCatalogError?: string | null
  existingTextTarget?: ExistingTextTarget | null
}

function buildComposeElements(
  positionConfig: TextLabsPositionConfig,
  count: number,
  layout: 'horizontal' | 'vertical' | 'grid',
  gridCols: number,
): TextBoxFormData['elements'] {
  if (count <= 1) return undefined
  return splitGridArea({
    start_col: positionConfig.start_col,
    start_row: positionConfig.start_row,
    position_width: positionConfig.position_width,
    position_height: positionConfig.position_height,
  }, count, layout, gridCols).map(grid_position => ({ grid_position }))
}

function roleLabel(role?: TextSemanticRole | null): string {
  if (!role) return 'Text'
  return role.toLowerCase().split('_').map(word => `${word[0].toUpperCase()}${word.slice(1)}`).join(' ')
}

function OptionalNumberInput({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        placeholder="Auto"
        onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
    </label>
  )
}

export function TextBoxForm({
  onSubmit,
  registerSubmit,
  presentationId,
  elementContext,
  prompt,
  showAdvanced,
  registerMandatoryConfig,
  researchControls,
  slotCatalog,
  slotCatalogLoading,
  slotCatalogError,
  existingTextTarget,
}: TextBoxFormProps) {
  const [targetValue, setTargetValue] = useState(BODY_TEXT_AUTO_SLOT)
  const [structure, setStructure] = useState<'auto' | TextBoxStructure>('auto')
  const [count, setCount] = useState(1)
  const [layout, setLayout] = useState<'horizontal' | 'vertical' | 'grid'>('horizontal')
  const [gridCols, setGridCols] = useState(2)
  const [textboxOverrides, setTextboxOverrides] = useState<Partial<TextBoxConfig>>({})
  const [geometryMode, setGeometryMode] = useState<'AUTO' | 'MANUAL'>('AUTO')
  const [manualGeometryOverrides, setManualGeometryOverrides] = useState<TextManualGeometryOverrides>({})
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)
  const [positionModified, setPositionModified] = useState(false)
  const [showInstances, setShowInstances] = useState(false)
  const [showTypography, setShowTypography] = useState(false)
  const [showSpacing, setShowSpacing] = useState(false)
  const [showPosition, setShowPosition] = useState(false)
  const [showEffects, setShowEffects] = useState(false)
  const [positionConfig, setPositionConfig] = useState<TextLabsPositionConfig>({
    start_col: 2,
    start_row: 4,
    position_width: DEFAULTS.width,
    position_height: DEFAULTS.height,
    auto_position: false,
  })

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

  const effectiveCatalog = useMemo<TemplateSlotCatalog>(() => {
    if (!existingTextTarget?.slotName || slotCatalog.slots.some(slot => slot.slot_name === existingTextTarget.slotName)) {
      return slotCatalog
    }
    const role = existingTextTarget.semanticRole ?? null
    const kind = existingTextTarget.slotKind
      ?? (existingTextTarget.accessoryType ? 'accessory' : role === 'BODY_TEXT' ? 'body' : 'structural')
    return {
      ...slotCatalog,
      slots: [...slotCatalog.slots, {
        slot_name: existingTextTarget.slotName,
        label: `Current ${existingTextTarget.accessoryType === 'LOGO' ? 'Logo' : roleLabel(role)}`,
        role,
        kind,
        accessory_type: existingTextTarget.accessoryType ?? null,
        supported: true,
        single_instance: kind !== 'body',
        system_managed: kind === 'system',
      }],
    }
  }, [existingTextTarget?.accessoryType, existingTextTarget?.semanticRole, existingTextTarget?.slotKind, existingTextTarget?.slotName, slotCatalog])

  useEffect(() => {
    setTargetValue(selectionForExistingTarget(effectiveCatalog, existingTextTarget))
  }, [
    effectiveCatalog,
    existingTextTarget?.accessoryType,
    existingTextTarget?.semanticRole,
    existingTextTarget?.slotName,
  ])

  const selectedSlot = useMemo(
    () => findSelectedSlot(effectiveCatalog, targetValue),
    [effectiveCatalog, targetValue],
  )
  const semanticRole = selectedSlot?.role ?? 'BODY_TEXT'
  const slotKind = selectedSlot?.kind ?? 'body'
  const isBodyText = semanticRole === 'BODY_TEXT' && slotKind === 'body'
  const isSystemManaged = Boolean(selectedSlot?.system_managed || slotKind === 'system')
  const isAccessory = slotKind === 'accessory'

  const updateTextboxOverride = useCallback(<K extends keyof TextBoxConfig>(field: K, value: TextBoxConfig[K] | undefined) => {
    setTextboxOverrides(previous => {
      const next = { ...previous }
      if (value === undefined) delete next[field]
      else next[field] = value
      return next
    })
  }, [])

  const updateManualOverride = useCallback(<K extends keyof TextManualGeometryOverrides>(
    field: K,
    value: TextManualGeometryOverrides[K] | undefined,
  ) => {
    setManualGeometryOverrides(previous => {
      const next = { ...previous }
      if (value === undefined) delete next[field]
      else next[field] = value
      return next
    })
  }, [])

  const roleOptions = useMemo(() => [
    { value: BODY_TEXT_AUTO_SLOT, label: 'Auto (Body text)' },
    ...effectiveCatalog.slots.map(slot => ({
      value: slotSelectionValue(slot),
      label: slot.accessory_type === 'LOGO'
        ? `Logo (${slot.label})`
        : `${slot.label || roleLabel(slot.role)}${slot.optional ? ' (optional)' : ''}`,
    })),
  ], [effectiveCatalog.slots])

  useEffect(() => {
    const selected = roleOptions.find(option => option.value === targetValue) ?? roleOptions[0]
    registerMandatoryConfig({
      fieldLabel: 'Role',
      displayLabel: selected.label,
      options: roleOptions,
      onChange: setTargetValue,
      promptPlaceholder: isAccessory
        ? 'Describe the logo or brand mark to use'
        : isSystemManaged
          ? 'Describe the sources or footer treatment'
          : 'Describe the message this text should communicate',
    })
  }, [isAccessory, isSystemManaged, registerMandatoryConfig, roleOptions, targetValue])

  const advancedModified = positionModified
    || structure !== 'auto'
    || Object.keys(textboxOverrides).length > 0
    || geometryMode === 'MANUAL'

  const handleSubmit = useCallback(() => {
    const bodyCount = isBodyText ? count : 1
    const slotMetadata = slotMetadataForRequest(selectedSlot)
    if (isAccessory && selectedSlot?.accessory_type === 'LOGO') {
      const logoFormData: ImageFormData = {
        componentType: 'IMAGE',
        prompt,
        count: 1,
        layout: 'horizontal',
        advancedModified: false,
        z_index: zIndex,
        presentationId,
        useDeckTheme: Boolean(presentationId),
        themeOverrides: null,
        slotName: selectedSlot.slot_name,
        slotKind: 'accessory',
        accessoryType: 'LOGO',
        slotMetadata,
        imageConfig: {
          style: 'brand_graphic',
          quality: 'high',
          corners: 'square',
          border: false,
          placeholder_mode: false,
          auto_position: true,
        },
      }
      onSubmit(logoFormData)
      return
    }
    const formData: TextBoxFormData = {
      componentType: 'TEXT_BOX',
      prompt,
      count: bodyCount,
      layout,
      advancedModified,
      z_index: zIndex,
      presentationId,
      useDeckTheme: Boolean(presentationId),
      themeOverrides: null,
      semanticRole,
      slotName: selectedSlot?.slot_name ?? null,
      slotKind,
      accessoryType: selectedSlot?.accessory_type ?? null,
      slotMetadata,
      geometryMode,
      manualGeometryOverrides: geometryMode === 'MANUAL' && Object.keys(manualGeometryOverrides).length
        ? manualGeometryOverrides
        : undefined,
      structure: isBodyText && structure !== 'auto' ? structure : undefined,
      compose: isBodyText && bodyCount > 1,
      elements: isBodyText && bodyCount > 1
        ? buildComposeElements(positionConfig, bodyCount, layout, gridCols)
        : undefined,
      textboxConfig: textboxOverrides,
      // Layout owns fixed template-slot geometry. BODY_TEXT keeps its live canvas
      // placement, while Text Service owns all automatic internal geometry.
      positionConfig: isBodyText ? positionConfig : undefined,
    }
    onSubmit(formData)
  }, [
    advancedModified,
    count,
    geometryMode,
    gridCols,
    isBodyText,
    isAccessory,
    layout,
    manualGeometryOverrides,
    onSubmit,
    positionConfig,
    presentationId,
    prompt,
    selectedSlot,
    semanticRole,
    slotKind,
    structure,
    textboxOverrides,
    zIndex,
  ])

  useEffect(() => registerSubmit(handleSubmit), [handleSubmit, registerSubmit])

  const showTitleValue = textboxOverrides.show_title === undefined
    ? 'auto'
    : textboxOverrides.show_title ? 'show' : 'hide'
  const backgroundValue = textboxOverrides.background ?? 'auto'
  const cornersValue = textboxOverrides.corners ?? 'auto'

  return (
    <div className="space-y-3">
      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="textbox-role" className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            Semantic role
          </label>
          {slotCatalog.canvas_type && (
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
              {slotCatalog.canvas_type}
            </span>
          )}
        </div>
        <select
          id="textbox-role"
          value={targetValue}
          disabled={slotCatalogLoading}
          onChange={event => setTargetValue(event.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {roleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {slotCatalogLoading && <p className="text-[10px] text-slate-500">Loading roles from the active template…</p>}
        {slotCatalogError && <p className="text-[10px] text-amber-600 dark:text-amber-400">{slotCatalogError}</p>}
        {selectedSlot && (
          <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">
            Uses template slot <span className="font-mono">{selectedSlot.slot_name}</span>.
            {selectedSlot.single_instance ? ' Repeated generation replaces this slot.' : ''}
            {isSystemManaged ? ' Layout manages this slide-global element.' : ''}
          </p>
        )}
      </section>

      {isBodyText && (
        <section className="space-y-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Body structure</label>
          <select
            value={structure}
            onChange={event => setStructure(event.target.value as 'auto' | TextBoxStructure)}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="auto">Auto</option>
            {STRUCTURE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </section>
      )}

      {!isAccessory && !isSystemManaged && (
        <section className="space-y-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Title</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] text-slate-500">Visibility</span>
              <select
                value={showTitleValue}
                onChange={event => updateTextboxOverride(
                  'show_title',
                  event.target.value === 'auto' ? undefined : event.target.value === 'show',
                )}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="auto">Auto</option>
                <option value="show">Show</option>
                <option value="hide">Hide</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-500">Style</span>
              <select
                value={textboxOverrides.title_style ?? 'auto'}
                onChange={event => updateTextboxOverride(
                  'title_style',
                  event.target.value === 'auto' ? undefined : event.target.value as TextBoxTitleStyle,
                )}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="auto">Auto</option>
                {TITLE_STYLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
        </section>
      )}

      {researchControls}

      {!isSystemManaged && !isAccessory && (
        <section className="space-y-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Surface</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] text-slate-500">Box</span>
              <select
                value={backgroundValue}
                onChange={event => updateTextboxOverride(
                  'background',
                  event.target.value === 'auto' ? undefined : event.target.value as TextBoxConfig['background'],
                )}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="auto">Auto</option>
                <option value="colored">Color</option>
                <option value="transparent">Transparent</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-500">Corners</span>
              <select
                value={cornersValue}
                onChange={event => updateTextboxOverride(
                  'corners',
                  event.target.value === 'auto' ? undefined : event.target.value as TextBoxConfig['corners'],
                )}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="auto">Auto</option>
                <option value="rounded">Rounded</option>
                <option value="square">Square</option>
              </select>
            </label>
          </div>
          {backgroundValue === 'colored' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] text-slate-500">Color</span>
                <select
                  value={textboxOverrides.color_variant ?? 'auto'}
                  onChange={event => updateTextboxOverride('color_variant', event.target.value === 'auto' ? undefined : event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value="auto">Auto</option>
                  {COLOR_VARIANTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-slate-500">Opacity</span>
                <select
                  value={textboxOverrides.opacity ?? 'auto'}
                  onChange={event => updateTextboxOverride('opacity', event.target.value === 'auto' ? undefined : Number(event.target.value))}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value="auto">Auto</option>
                  <option value="1">100%</option>
                  <option value="0.8">80%</option>
                  <option value="0.6">60%</option>
                  <option value="0.4">40%</option>
                  <option value="0.2">20%</option>
                </select>
              </label>
            </div>
          )}
        </section>
      )}

      {showAdvanced && !isAccessory && (
        <section className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Advanced</div>
              <div className="text-[10px] text-slate-500">Automatic geometry uses Platinum defaults.</div>
            </div>
            <select
              aria-label="Geometry mode"
              value={geometryMode}
              onChange={event => setGeometryMode(event.target.value as 'AUTO' | 'MANUAL')}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="AUTO">Auto</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>

          {geometryMode === 'MANUAL' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/20">
              <p className="mb-2 text-[10px] leading-4 text-amber-700 dark:text-amber-300">
                Only fields you set are sent. Blank fields continue to use the resolved profile.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {isBodyText && (
                  <OptionalNumberInput label="Items per box" min={1} max={14} value={manualGeometryOverrides.items_per_box} onChange={value => updateManualOverride('items_per_box', value)} />
                )}
                <OptionalNumberInput label="Title min chars" value={manualGeometryOverrides.title_min_chars} onChange={value => updateManualOverride('title_min_chars', value)} />
                <OptionalNumberInput label="Title max chars" value={manualGeometryOverrides.title_max_chars} onChange={value => updateManualOverride('title_max_chars', value)} />
                {isBodyText && <OptionalNumberInput label="Item min chars" value={manualGeometryOverrides.item_min_chars} onChange={value => updateManualOverride('item_min_chars', value)} />}
                {isBodyText && <OptionalNumberInput label="Item max chars" value={manualGeometryOverrides.item_max_chars} onChange={value => updateManualOverride('item_max_chars', value)} />}
                <OptionalNumberInput label="Max lines" min={1} value={manualGeometryOverrides.max_lines} onChange={value => updateManualOverride('max_lines', value)} />
                <OptionalNumberInput label="Max chars" min={1} value={manualGeometryOverrides.max_chars} onChange={value => updateManualOverride('max_chars', value)} />
              </div>
            </div>
          )}

          {isBodyText && (
            <CollapsibleSection title="Instances" isOpen={showInstances} onToggle={() => setShowInstances(value => !value)}>
              <div className="grid grid-cols-2 gap-2">
                <OptionalNumberInput label="Count" min={1} max={6} value={count} onChange={value => setCount(value ?? 1)} />
                <label className="space-y-1">
                  <span className="text-[10px] text-slate-500">Arrangement</span>
                  <select value={layout} onChange={event => setLayout(event.target.value as typeof layout)} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800">
                    <option value="horizontal">Horizontal</option>
                    <option value="vertical">Vertical</option>
                    <option value="grid">Grid</option>
                  </select>
                </label>
                {layout === 'grid' && <OptionalNumberInput label="Grid columns" min={2} max={6} value={gridCols} onChange={value => setGridCols(value ?? 2)} />}
              </div>
            </CollapsibleSection>
          )}

          {geometryMode === 'MANUAL' && (<>
            <CollapsibleSection title="Typography" isOpen={showTypography} onToggle={() => setShowTypography(value => !value)}>
              <div className="grid grid-cols-2 gap-2">
                <OptionalNumberInput label="Heading size (px)" min={1} value={manualGeometryOverrides.heading_font_size_px} onChange={value => updateManualOverride('heading_font_size_px', value)} />
                <OptionalNumberInput label="Content size (px)" min={1} value={manualGeometryOverrides.content_font_size_px} onChange={value => updateManualOverride('content_font_size_px', value)} />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Spacing" isOpen={showSpacing} onToggle={() => setShowSpacing(value => !value)}>
              <div className="grid grid-cols-2 gap-2">
                <OptionalNumberInput label="Line height" min={0.5} step={0.1} value={manualGeometryOverrides.line_height} onChange={value => updateManualOverride('line_height', value)} />
                <OptionalNumberInput label="Bullet gap (px)" value={manualGeometryOverrides.bullet_gap_px} onChange={value => updateManualOverride('bullet_gap_px', value)} />
                <OptionalNumberInput label="Padding (px)" value={typeof manualGeometryOverrides.padding_px === 'number' ? manualGeometryOverrides.padding_px : undefined} onChange={value => updateManualOverride('padding_px', value)} />
              </div>
            </CollapsibleSection>
          </>)}

          {!isSystemManaged && (
            <CollapsibleSection title="Border & shadow" isOpen={showEffects} onToggle={() => setShowEffects(value => !value)}>
              <div className="grid grid-cols-2 gap-2">
                {(['border', 'shadow'] as const).map(field => (
                  <label key={field} className="space-y-1">
                    <span className="text-[10px] capitalize text-slate-500">{field}</span>
                    <select
                      value={textboxOverrides[field] === undefined ? 'auto' : textboxOverrides[field] ? 'on' : 'off'}
                      onChange={event => updateTextboxOverride(field, event.target.value === 'auto' ? undefined : event.target.value === 'on')}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                    >
                      <option value="auto">Auto</option>
                      <option value="on">On</option>
                      <option value="off">Off</option>
                    </select>
                  </label>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {isBodyText && (
            <CollapsibleSection title="Position" isOpen={showPosition} onToggle={() => setShowPosition(value => !value)}>
              <div className="space-y-2">
                <PositionPresets positionConfig={positionConfig} onChange={setPositionConfig} elementType="TEXT_BOX" onAdvancedModified={() => setPositionModified(true)} />
                <ZIndexInput value={zIndex} onChange={setZIndex} onAdvancedModified={() => setPositionModified(true)} />
              </div>
            </CollapsibleSection>
          )}
        </section>
      )}
    </div>
  )
}

TextBoxForm.displayName = 'TextBoxForm'

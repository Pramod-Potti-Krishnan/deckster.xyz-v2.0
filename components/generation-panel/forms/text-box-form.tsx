'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type TemplateSlotCatalog,
  type ImageFormData,
  type TextBoxConfig,
  type TextBoxFormData,
  type TextBoxStructure,
  type TextBoxTitleStyle,
  type TextLabsPositionConfig,
  type TextLabsPaddingConfig,
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
import { FontOverrideSection } from '../shared/font-override-section'
import { PaddingControl } from '../shared/padding-control'
import { ToggleRow } from '../shared/toggle-row'
import { useDeckThemePalette } from '@/hooks/use-deck-theme-palette'
import { effectiveTextGeometry } from '@/lib/textbox-geometry-mode'
import {
  isTextBoxCountViable,
  isTextBoxLayoutViable,
  resolveTextBoxLayout,
  textBoxGridDimensions,
  type TextBoxLayoutChoice,
} from '@/lib/textbox-layout'
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
  elementId?: string | null
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
  const [layoutChoice, setLayoutChoice] = useState<TextBoxLayoutChoice>('auto')
  const [gridCols, setGridCols] = useState(2)
  const [multiBoxColorMode, setMultiBoxColorMode] = useState<NonNullable<TextBoxFormData['multiBoxColorMode']>>('SAME')
  const [textboxOverrides, setTextboxOverrides] = useState<Partial<TextBoxConfig>>({})
  const [geometryMode, setGeometryMode] = useState<'AUTO' | 'MANUAL'>('AUTO')
  const [manualGeometryOverrides, setManualGeometryOverrides] = useState<TextManualGeometryOverrides>({})
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)
  const [positionModified, setPositionModified] = useState(false)
  const [paddingModified, setPaddingModified] = useState(false)
  const [paddingConfig, setPaddingConfig] = useState<TextLabsPaddingConfig>({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  })
  const [showInstances, setShowInstances] = useState(false)
  const [showBoxDesign, setShowBoxDesign] = useState(false)
  const [showHeading, setShowHeading] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const [showPositioning, setShowPositioning] = useState(false)
  const [showPadding, setShowPadding] = useState(false)
  const [positionConfig, setPositionConfig] = useState<TextLabsPositionConfig>({
    start_col: 2,
    start_row: 4,
    position_width: DEFAULTS.width,
    position_height: DEFAULTS.height,
    auto_position: false,
  })
  const previousTargetIdentity = useRef<string | null>(null)
  const { tokens: themeTokens, loading: themeLoading, error: themeError } = useDeckThemePalette(presentationId)

  const targetIdentity = elementContext?.elementId
    ?? existingTextTarget?.elementId
    ?? (existingTextTarget?.slotName ? `slot:${existingTextTarget.slotName}` : null)

  useEffect(() => {
    if (previousTargetIdentity.current !== targetIdentity) {
      setStructure('auto')
      setCount(1)
      setLayoutChoice('auto')
      setGridCols(2)
      setMultiBoxColorMode('SAME')
      setTextboxOverrides({})
      setGeometryMode('AUTO')
      setManualGeometryOverrides({})
      setZIndex(DEFAULTS.zIndex)
      setPositionModified(false)
      setPaddingModified(false)
      setPaddingConfig({ top: 0, right: 0, bottom: 0, left: 0 })
      setShowInstances(false)
      setShowBoxDesign(false)
      setShowHeading(false)
      setShowContent(false)
      setShowPositioning(false)
      setShowPadding(false)
    }
    previousTargetIdentity.current = targetIdentity
  }, [targetIdentity])

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
    () => resolveTextBoxLayout(area, count, layoutChoice, gridCols),
    [area, count, gridCols, layoutChoice],
  )
  const gridDimensions = useMemo(() => textBoxGridDimensions(count), [count])
  const feasibleCounts = useMemo(
    () => Array.from({ length: 6 }, (_, index) => index + 1)
      .filter(value => value === 1 || isTextBoxCountViable(area, value)),
    [area],
  )
  const viableGridDimensions = useMemo(
    () => gridDimensions.filter(item => isTextBoxLayoutViable(area, count, 'grid', item.columns)),
    [area, count, gridDimensions],
  )

  useEffect(() => {
    if (count > 1 && !feasibleCounts.includes(count)) {
      setCount(feasibleCounts[feasibleCounts.length - 1] ?? 1)
      setLayoutChoice('auto')
    }
  }, [count, feasibleCounts])

  useEffect(() => {
    if (layoutChoice === 'grid' && !gridDimensions.some(item => item.columns === gridCols)) {
      setGridCols(gridDimensions[0]?.columns ?? 2)
      if (gridDimensions.length === 0) setLayoutChoice('auto')
    }
  }, [gridCols, gridDimensions, layoutChoice])

  useEffect(() => {
    if (
      geometryMode === 'MANUAL'
      && Object.keys(manualGeometryOverrides).length === 0
      && !paddingModified
    ) {
      setGeometryMode('AUTO')
    }
  }, [geometryMode, manualGeometryOverrides, paddingModified])

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
  const isStructuralText = !isBodyText && !isSystemManaged && !isAccessory

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

  const updateExplicitManualOverride = useCallback(<K extends keyof TextManualGeometryOverrides>(
    field: K,
    value: TextManualGeometryOverrides[K] | undefined,
  ) => {
    if (value !== undefined) setGeometryMode('MANUAL')
    updateManualOverride(field, value)
  }, [updateManualOverride])

  const updateDetailedTextboxOverride = useCallback((field: string, value: unknown) => {
    if (field === 'heading_font_size' || field === 'content_font_size') {
      const parsed = typeof value === 'string' ? Number.parseFloat(value) : undefined
      updateExplicitManualOverride(
        field === 'heading_font_size' ? 'heading_font_size_px' : 'content_font_size_px',
        Number.isFinite(parsed) ? parsed : undefined,
      )
      return
    }
    updateTextboxOverride(
      field as keyof TextBoxConfig,
      (value === null ? undefined : value) as TextBoxConfig[keyof TextBoxConfig] | undefined,
    )
  }, [updateExplicitManualOverride, updateTextboxOverride])

  const detailedFontConfig = useMemo<Record<string, unknown>>(() => ({
    ...textboxOverrides,
    heading_font_size: manualGeometryOverrides.heading_font_size_px
      ? `${manualGeometryOverrides.heading_font_size_px}px`
      : null,
    content_font_size: manualGeometryOverrides.content_font_size_px
      ? `${manualGeometryOverrides.content_font_size_px}px`
      : null,
  }), [manualGeometryOverrides.content_font_size_px, manualGeometryOverrides.heading_font_size_px, textboxOverrides])

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

  const effectiveGeometry = useMemo(
    () => effectiveTextGeometry(geometryMode, manualGeometryOverrides),
    [geometryMode, manualGeometryOverrides],
  )

  const advancedModified = positionModified
    || paddingModified
    || structure !== 'auto'
    || Object.keys(textboxOverrides).length > 0
    || effectiveGeometry.geometryMode === 'MANUAL'

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
      layout: resolvedLayout.layout,
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
      geometryMode: effectiveGeometry.geometryMode,
      manualGeometryOverrides: effectiveGeometry.manualGeometryOverrides,
      structure: isBodyText && structure !== 'auto' ? structure : undefined,
      compose: isBodyText && bodyCount > 1,
      multiBoxColorMode: isBodyText && bodyCount > 1 ? multiBoxColorMode : undefined,
      elements: isBodyText && bodyCount > 1
        ? resolvedLayout.boxes.map(grid_position => ({ grid_position }))
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
    effectiveGeometry,
    isBodyText,
    isAccessory,
    multiBoxColorMode,
    onSubmit,
    positionConfig,
    presentationId,
    prompt,
    resolvedLayout,
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
          {structure === 'simple' && (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] text-slate-500">Simple Type</span>
                <select
                  value={textboxOverrides.simple_subtype ?? 'auto'}
                  onChange={event => updateTextboxOverride(
                    'simple_subtype',
                    event.target.value === 'auto'
                      ? undefined
                      : event.target.value as NonNullable<TextBoxConfig['simple_subtype']>,
                  )}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value="auto">Auto</option>
                  <option value="char">Char</option>
                  <option value="word">Word</option>
                  <option value="phrase">Phrase</option>
                </select>
              </label>
              <OptionalNumberInput
                label="Target Chars"
                min={1}
                max={240}
                value={textboxOverrides.target_char_count ?? undefined}
                onChange={value => updateTextboxOverride('target_char_count', value)}
              />
            </div>
          )}
        </section>
      )}

      {isBodyText && (
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

      {(isBodyText || isSystemManaged) && researchControls}

      {isBodyText && (
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

      {showAdvanced && !isAccessory && !isSystemManaged && (
        <section className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Advanced</div>
              <div className="text-[10px] text-slate-500">Automatic geometry uses Platinum defaults.</div>
            </div>
            <select
              aria-label="Geometry mode"
              value={geometryMode}
              onChange={event => {
                const nextMode = event.target.value as 'AUTO' | 'MANUAL'
                setGeometryMode(nextMode)
                if (nextMode === 'AUTO') {
                  setManualGeometryOverrides({})
                  setPaddingModified(false)
                  setPaddingConfig({ top: 0, right: 0, bottom: 0, left: 0 })
                }
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="AUTO">Auto</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>

          {geometryMode === 'MANUAL' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/20">
              <p className="text-[10px] leading-4 text-amber-700 dark:text-amber-300">
                Only controls with an explicit value are sent. Every control still showing Auto continues to use the resolved Platinum profile.
              </p>
            </div>
          )}

          {isStructuralText && (
            <CollapsibleSection title="Template Text" isOpen={showHeading} onToggle={() => setShowHeading(value => !value)}>
              <div className="space-y-2.5">
                <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                  Font, weight, color, case, and spacing use the active template and deck theme in Auto.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <OptionalNumberInput
                    label="Max chars"
                    min={1}
                    value={geometryMode === 'MANUAL' ? manualGeometryOverrides.max_chars : undefined}
                    onChange={value => updateExplicitManualOverride('max_chars', value)}
                  />
                  <OptionalNumberInput
                    label="Max lines"
                    min={1}
                    value={geometryMode === 'MANUAL' ? manualGeometryOverrides.max_lines : undefined}
                    onChange={value => updateExplicitManualOverride('max_lines', value)}
                  />
                </div>
                <FontOverrideSection
                  label="Text Font"
                  prefix="content"
                  config={detailedFontConfig}
                  onChange={updateDetailedTextboxOverride}
                  thirdToggle="underline"
                />
              </div>
            </CollapsibleSection>
          )}

          {isBodyText && (
            <CollapsibleSection title="Instances" isOpen={showInstances} onToggle={() => setShowInstances(value => !value)}>
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-500">Count</span>
                    <select
                      aria-label="Text box count"
                      value={count}
                      onChange={event => {
                        setCount(Number(event.target.value))
                        setLayoutChoice('auto')
                      }}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                    >
                      {Array.from({ length: 6 }, (_, index) => index + 1).map(value => (
                        <option key={value} value={value} disabled={!feasibleCounts.includes(value)}>
                          {value}{!feasibleCounts.includes(value) ? ' — resize needed' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-500">Arrangement</span>
                    <select
                      value={layoutChoice}
                      onChange={event => setLayoutChoice(event.target.value as TextBoxLayoutChoice)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                    >
                      <option value="auto">Auto — best fit</option>
                      <option
                        value="horizontal"
                        disabled={count === 1 || !isTextBoxLayoutViable(area, count, 'horizontal')}
                      >
                        Horizontal
                      </option>
                      <option
                        value="vertical"
                        disabled={count === 1 || !isTextBoxLayoutViable(area, count, 'vertical')}
                      >
                        Vertical
                      </option>
                      <option value="grid" disabled={count === 1 || viableGridDimensions.length === 0}>
                        Grid
                      </option>
                    </select>
                  </label>
                </div>

                {layoutChoice === 'grid' && viableGridDimensions.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10px] text-slate-500">Grid columns</span>
                      <select
                        value={gridCols}
                        onChange={event => setGridCols(Number(event.target.value))}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                      >
                        {viableGridDimensions.map(item => (
                          <option key={`${item.columns}x${item.rows}`} value={item.columns}>{item.columns}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] text-slate-500">Grid rows</span>
                      <select
                        value={viableGridDimensions.find(item => item.columns === gridCols)?.rows ?? viableGridDimensions[0].rows}
                        onChange={event => {
                          const selected = viableGridDimensions.find(item => item.rows === Number(event.target.value))
                          if (selected) setGridCols(selected.columns)
                        }}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                      >
                        {viableGridDimensions.map(item => (
                          <option key={`${item.rows}x${item.columns}`} value={item.rows}>{item.rows}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {count > 1 && (
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-500">Multi-box color style</span>
                    <select
                      value={multiBoxColorMode}
                      onChange={event => setMultiBoxColorMode(event.target.value as NonNullable<TextBoxFormData['multiBoxColorMode']>)}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                    >
                      <option value="SAME">Same color</option>
                      <option value="ALTERNATING">Alternating theme colors</option>
                      <option value="PRIMARY_ACCENTS">Primary color accents</option>
                      <option value="THEME_SEQUENCE">Different theme colors</option>
                    </select>
                  </label>
                )}

                <p className="text-[9px] leading-4 text-slate-400">
                  Feasible choices use the live {area.position_width}×{area.position_height} container. Auto resolves to {resolvedLayout.layout}
                  {resolvedLayout.layout === 'grid' ? ` (${resolvedLayout.gridColumns}×${resolvedLayout.gridRows})` : ''}.
                </p>
              </div>
            </CollapsibleSection>
          )}

          {isBodyText && !isSystemManaged && (
            <CollapsibleSection title="Box Design" isOpen={showBoxDesign} onToggle={() => setShowBoxDesign(value => !value)}>
              <div className="space-y-2.5">
                <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Deck theme</div>
                      <div className="text-[9px] text-slate-400">
                        {themeLoading ? 'Loading palette…' : themeError ? 'Palette temporarily unavailable' : 'Applied to Auto controls'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1" aria-label="Applied deck theme colors">
                      {themeTokens.slice(0, 5).map(token => (
                        <span
                          key={token.id}
                          title={`${token.label}: ${token.color}`}
                          className="h-4 w-4 rounded-full border border-white shadow-sm ring-1 ring-slate-200"
                          style={{ backgroundColor: token.color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Box Color</span>
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Box color">
                    <button
                      type="button"
                      onClick={() => {
                        updateTextboxOverride('background', undefined)
                        updateTextboxOverride('color_variant', undefined)
                      }}
                      aria-pressed={backgroundValue === 'auto'}
                      className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${
                        backgroundValue === 'auto'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-slate-300 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      Auto
                    </button>
                    {themeTokens.slice(0, 5).map(token => (
                      <button
                        type="button"
                        key={`box-${token.id}`}
                        title={`${token.label}: ${token.color}`}
                        aria-label={`Use ${token.label} for box color`}
                        aria-pressed={textboxOverrides.color_variant === token.color}
                        onClick={() => {
                          updateTextboxOverride('background', 'colored')
                          updateTextboxOverride('color_variant', token.color)
                        }}
                        className={`h-7 w-7 rounded-full border-2 ${
                          textboxOverrides.color_variant === token.color ? 'border-primary ring-2 ring-primary/20' : 'border-white ring-1 ring-slate-300'
                        }`}
                        style={{ backgroundColor: token.color }}
                      />
                    ))}
                    {themeTokens.length === 0 && COLOR_VARIANTS.slice(0, 6).map(option => (
                      <button
                        type="button"
                        key={`box-${option.value}`}
                        title={option.label}
                        aria-label={`Use ${option.label} for box color`}
                        aria-pressed={textboxOverrides.color_variant === option.value}
                        onClick={() => {
                          updateTextboxOverride('background', 'colored')
                          updateTextboxOverride('color_variant', option.value)
                        }}
                        className={`h-7 w-7 rounded-full border-2 ${
                          textboxOverrides.color_variant === option.value ? 'border-primary ring-2 ring-primary/20' : 'border-white ring-1 ring-slate-300'
                        }`}
                        style={{ backgroundColor: option.value }}
                      />
                    ))}
                    <button
                      type="button"
                      title="Transparent"
                      aria-label="Use transparent box color"
                      aria-pressed={backgroundValue === 'transparent'}
                      onClick={() => {
                        updateTextboxOverride('background', 'transparent')
                        updateTextboxOverride('color_variant', undefined)
                      }}
                      className={`h-7 w-7 rounded-full border-2 bg-[linear-gradient(45deg,#d1d5db_25%,transparent_25%),linear-gradient(-45deg,#d1d5db_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d1d5db_75%),linear-gradient(-45deg,transparent_75%,#d1d5db_75%)] bg-[length:8px_8px] bg-[position:0_0,0_4px,4px_-4px,-4px_0px] ${
                        backgroundValue === 'transparent' ? 'border-primary ring-2 ring-primary/20' : 'border-white ring-1 ring-slate-300'
                      }`}
                    />
                    <label className="relative h-7 w-7 cursor-pointer rounded-full border border-slate-300 bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]" title="Custom color">
                      <span className="sr-only">Custom box color</span>
                      <input
                        type="color"
                        value={typeof textboxOverrides.color_variant === 'string' && textboxOverrides.color_variant.startsWith('#')
                          ? textboxOverrides.color_variant
                          : '#7c3aed'}
                        onChange={event => {
                          updateTextboxOverride('background', 'colored')
                          updateTextboxOverride('color_variant', event.target.value)
                        }}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
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
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-500">Opacity</span>
                    <select
                      value={textboxOverrides.opacity ?? 'auto'}
                      disabled={backgroundValue !== 'colored'}
                      onChange={event => updateTextboxOverride('opacity', event.target.value === 'auto' ? undefined : Number(event.target.value))}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:disabled:bg-slate-900"
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

                <div className="grid grid-cols-2 gap-2">
                  {(['shadow', 'border'] as const).map(field => (
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
              </div>
            </CollapsibleSection>
          )}

          {isBodyText && (
            <CollapsibleSection title="Heading" isOpen={showHeading} onToggle={() => setShowHeading(value => !value)}>
              <div className="space-y-2.5">
                <ToggleRow
                  label="Show Title"
                  field="show_title"
                  value={showTitleValue}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'show', label: 'Yes' },
                    { value: 'hide', label: 'No' },
                  ]}
                  onChange={(_, value) => updateTextboxOverride(
                    'show_title',
                    value === 'auto' ? undefined : value === 'show',
                  )}
                />
                <label className="space-y-1">
                  <span className="text-[10px] text-slate-500">Title Style</span>
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
                <ToggleRow
                  label="Title Rule"
                  field="title_underline"
                  value={textboxOverrides.title_underline === undefined ? 'auto' : textboxOverrides.title_underline ? 'on' : 'off'}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'off', label: 'Off' },
                    { value: 'on', label: 'On' },
                  ]}
                  onChange={(_, value) => updateTextboxOverride('title_underline', value === 'auto' ? undefined : value === 'on')}
                />
                <ToggleRow
                  label="Heading Align"
                  field="heading_align"
                  value={textboxOverrides.heading_align ?? 'auto'}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'left', label: 'L' },
                    { value: 'center', label: 'C' },
                    { value: 'right', label: 'R' },
                  ]}
                  onChange={(_, value) => updateTextboxOverride(
                    'heading_align',
                    value === 'auto' ? undefined : value as TextBoxConfig['heading_align'],
                  )}
                />
                <ToggleRow
                  label="Head Indent"
                  field="heading_indent"
                  value={textboxOverrides.heading_indent === undefined ? 'auto' : String(textboxOverrides.heading_indent)}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: '0', label: '0' },
                    { value: '1', label: '1' },
                    { value: '2', label: '2' },
                    { value: '3', label: '3' },
                  ]}
                  onChange={(_, value) => updateTextboxOverride('heading_indent', value === 'auto' ? undefined : Number(value))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <OptionalNumberInput
                    label="Title min chars"
                    value={geometryMode === 'MANUAL' ? manualGeometryOverrides.title_min_chars : undefined}
                    onChange={value => updateExplicitManualOverride('title_min_chars', value)}
                  />
                  <OptionalNumberInput
                    label="Title max chars"
                    value={geometryMode === 'MANUAL' ? manualGeometryOverrides.title_max_chars : undefined}
                    onChange={value => updateExplicitManualOverride('title_max_chars', value)}
                  />
                </div>
                <FontOverrideSection
                  label="Heading Font"
                  prefix="heading"
                  config={detailedFontConfig}
                  onChange={updateDetailedTextboxOverride}
                  thirdToggle="underline"
                />
              </div>
            </CollapsibleSection>
          )}

          {isBodyText && !isSystemManaged && (
            <CollapsibleSection title="Content" isOpen={showContent} onToggle={() => setShowContent(value => !value)}>
              <div className="space-y-2.5">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Items / Box</span>
                  <select
                    aria-label="Items per box"
                    value={geometryMode === 'MANUAL' && manualGeometryOverrides.items_per_box
                      ? String(manualGeometryOverrides.items_per_box)
                      : 'auto'}
                    onChange={event => updateExplicitManualOverride(
                      'items_per_box',
                      event.target.value === 'auto' ? undefined : Number(event.target.value),
                    )}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                  >
                    <option value="auto">Auto — Platinum fit</option>
                    {Array.from({ length: 14 }, (_, index) => index + 1).map(value => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <ToggleRow
                  label="List Style"
                  field="list_style"
                  value={textboxOverrides.list_style ?? 'auto'}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'bullets', label: 'Bullets' },
                    { value: 'numbered', label: 'Numbers' },
                    { value: 'plain', label: 'Plain' },
                  ]}
                  onChange={(_, value) => updateTextboxOverride(
                    'list_style',
                    value === 'auto' ? undefined : value as TextBoxConfig['list_style'],
                  )}
                />
                <ToggleRow
                  label="Content Align"
                  field="content_align"
                  value={textboxOverrides.content_align ?? 'auto'}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'left', label: 'L' },
                    { value: 'center', label: 'C' },
                    { value: 'right', label: 'R' },
                  ]}
                  onChange={(_, value) => updateTextboxOverride(
                    'content_align',
                    value === 'auto' ? undefined : value as TextBoxConfig['content_align'],
                  )}
                />
                <ToggleRow
                  label="Content Indent"
                  field="content_indent"
                  value={textboxOverrides.content_indent === undefined ? 'auto' : String(textboxOverrides.content_indent)}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: '0', label: '0' },
                    { value: '1', label: '1' },
                    { value: '2', label: '2' },
                    { value: '3', label: '3' },
                  ]}
                  onChange={(_, value) => updateTextboxOverride('content_indent', value === 'auto' ? undefined : Number(value))}
                />
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Line Spacing</span>
                  <select
                    value={geometryMode === 'MANUAL' && manualGeometryOverrides.line_height !== undefined
                      ? String(manualGeometryOverrides.line_height)
                      : 'auto'}
                    onChange={event => updateExplicitManualOverride(
                      'line_height',
                      event.target.value === 'auto' ? undefined : Number(event.target.value),
                    )}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                  >
                    <option value="auto">Auto</option>
                    {['1.0', '1.2', '1.4', '1.5', '1.6', '1.8', '2.0', '2.2', '2.5'].map(value => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <OptionalNumberInput
                    label="Item min chars"
                    value={geometryMode === 'MANUAL' ? manualGeometryOverrides.item_min_chars : undefined}
                    onChange={value => updateExplicitManualOverride('item_min_chars', value)}
                  />
                  <OptionalNumberInput
                    label="Item max chars"
                    value={geometryMode === 'MANUAL' ? manualGeometryOverrides.item_max_chars : undefined}
                    onChange={value => updateExplicitManualOverride('item_max_chars', value)}
                  />
                  <OptionalNumberInput
                    label="Max lines"
                    min={1}
                    value={geometryMode === 'MANUAL' ? manualGeometryOverrides.max_lines : undefined}
                    onChange={value => updateExplicitManualOverride('max_lines', value)}
                  />
                  <OptionalNumberInput
                    label="Max chars"
                    min={1}
                    value={geometryMode === 'MANUAL' ? manualGeometryOverrides.max_chars : undefined}
                    onChange={value => updateExplicitManualOverride('max_chars', value)}
                  />
                  <OptionalNumberInput
                    label="Bullet gap (px)"
                    value={geometryMode === 'MANUAL' ? manualGeometryOverrides.bullet_gap_px : undefined}
                    onChange={value => updateExplicitManualOverride('bullet_gap_px', value)}
                  />
                </div>
                <FontOverrideSection
                  label="Content Font"
                  prefix="content"
                  config={detailedFontConfig}
                  onChange={updateDetailedTextboxOverride}
                  thirdToggle="underline"
                />
              </div>
            </CollapsibleSection>
          )}

          {isBodyText && (
            <CollapsibleSection title="Positioning" isOpen={showPositioning} onToggle={() => setShowPositioning(value => !value)}>
              <div className="space-y-2">
                <PositionPresets positionConfig={positionConfig} onChange={setPositionConfig} elementType="TEXT_BOX" onAdvancedModified={() => setPositionModified(true)} />
                <ZIndexInput value={zIndex} onChange={setZIndex} onAdvancedModified={() => setPositionModified(true)} />
              </div>
            </CollapsibleSection>
          )}

          {isBodyText && (
            <CollapsibleSection title="Container Padding" isOpen={showPadding} onToggle={() => setShowPadding(value => !value)}>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500">
                    {paddingModified ? 'Explicit manual padding' : 'Auto padding'}
                  </span>
                  {paddingModified && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaddingModified(false)
                        setPaddingConfig({ top: 0, right: 0, bottom: 0, left: 0 })
                        updateManualOverride('padding_px', undefined)
                      }}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                    >
                      Use Auto
                    </button>
                  )}
                </div>
                <PaddingControl
                  paddingConfig={paddingConfig}
                  onChange={(value) => {
                    setPaddingConfig(value)
                    setPaddingModified(true)
                    setGeometryMode('MANUAL')
                    updateManualOverride('padding_px', value)
                  }}
                  onAdvancedModified={() => {
                    setPaddingModified(true)
                    setGeometryMode('MANUAL')
                  }}
                />
              </div>
            </CollapsibleSection>
          )}
        </section>
      )}
    </div>
  )
}

TextBoxForm.displayName = 'TextBoxForm'

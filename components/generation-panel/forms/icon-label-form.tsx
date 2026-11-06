'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { IconLabelFormData, IconLabelConfig, TextLabsPaddingConfig, TextLabsPositionConfig, TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import { ElementContext, GenerationPanelDraft, MandatoryConfig } from '../types'
import { ToggleRow } from '../shared/toggle-row'
import { ZIndexInput } from '../shared/z-index-input'
import { ThemeSourceSelector } from '../shared/theme-source-selector'
import { useThemeSourceState } from '../shared/use-theme-source-state'
import { PaddingControl } from '../shared/padding-control'
import { CollapsibleSection } from '../shared/collapsible-section'
import { resolveDraftThemeSource } from '@/lib/visual-form-draft'
import './studio-shape-icon.css'

const STUDIO_VISUAL_FORMS = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.ICON_LABEL
type IconOverrideField = 'size' | 'style' | 'font' | 'color' | 'stroke' | 'background' | 'exclusions' | 'position' | 'padding'

// Backend-aligned icon styles
const ICON_STYLES: { value: IconLabelConfig['style']; label: string }[] = [
  { value: 'flat', label: 'Flat' },
  { value: 'pastel', label: 'Pastel' },
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'circle-outline', label: 'Circle Outline' },
  { value: 'square-outline', label: 'Square Outline' },
]

const LABEL_FONTS: { value: IconLabelConfig['font']; label: string }[] = [
  { value: 'poppins', label: 'Poppins' },
  { value: 'inter', label: 'Inter' },
  { value: 'playfair', label: 'Playfair' },
  { value: 'roboto_mono', label: 'Roboto Mono' },
]

function getDefaultColor(mode: 'icon' | 'label', style: IconLabelConfig['style']): string {
  if (mode === 'label') return '#1F2937'
  if (style === 'circle' || style === 'square') return '#3B82F6'
  return '#1F2937'
}

export interface IconLabelControlsDraft {
  count: number
  mode: 'icon' | 'label'
  size: IconLabelConfig['size']
  style: IconLabelConfig['style']
  font: IconLabelConfig['font']
  color: string | null
  strokeWidth: number
  operation: 'generate' | 'restyle' | 'replace'
  targetBackground: string
  excludeIconsInput: string
  advancedModified: boolean
  explicitFields: IconOverrideField[]
  zIndex: number
  showPosition: boolean
  showPadding: boolean
  positionConfig: TextLabsPositionConfig
  paddingConfig: TextLabsPaddingConfig
  themeSource: ReturnType<typeof useThemeSourceState>['themeSource']
  geometryEdited: boolean
  geometryContext: ElementContext | null
}

interface IconLabelFormProps {
  onSubmit: (formData: IconLabelFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  presentationId?: string | null
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig | MandatoryConfig[]) => void
  initialDraft?: GenerationPanelDraft | null
  onDraftChange?: (draft: Partial<GenerationPanelDraft>) => void
  targetElementId?: string | null
  panelMode: 'generate' | 'edit' | 'refine'
}

export function IconLabelForm({ onSubmit, registerSubmit, isGenerating, presentationId, elementContext, prompt, showAdvanced, registerMandatoryConfig, initialDraft, panelMode, onDraftChange, targetElementId }: IconLabelFormProps) {
  const controlsDraft = STUDIO_VISUAL_FORMS ? initialDraft?.iconLabelControls : null
  const initialFormData = initialDraft?.formData?.componentType === 'ICON_LABEL'
    ? initialDraft.formData
    : null
  const initialConfig = initialFormData?.iconLabelConfig || {}
  const initialExplicitFields = new Set<IconOverrideField>([
    ...('size' in initialConfig ? ['size' as const] : []),
    ...('style' in initialConfig ? ['style' as const] : []),
    ...('font' in initialConfig ? ['font' as const] : []),
    ...('color' in initialConfig ? ['color' as const] : []),
    ...('stroke_width' in initialConfig ? ['stroke' as const] : []),
    ...('target_background' in initialConfig ? ['background' as const] : []),
    ...('exclude_icons' in initialConfig ? ['exclusions' as const] : []),
  ])
  const [count, setCount] = useState(controlsDraft?.count ?? initialFormData?.count ?? 1)
  const [mode, setMode] = useState<'icon' | 'label'>(controlsDraft?.mode ?? (initialConfig.mode || 'icon'))
  const [size, setSize] = useState<IconLabelConfig['size']>(controlsDraft?.size ?? (initialConfig.size || 'medium'))
  const [style, setStyle] = useState<IconLabelConfig['style']>(controlsDraft?.style ?? (initialConfig.style || 'circle'))
  const [font, setFont] = useState<IconLabelConfig['font']>(controlsDraft?.font ?? (initialConfig.font || 'poppins'))
  const [color, setColor] = useState<string | null>(controlsDraft ? controlsDraft.color : initialConfig.color ?? null)
  const [strokeWidth, setStrokeWidth] = useState(controlsDraft?.strokeWidth ?? initialConfig.stroke_width ?? 2)
  const [operation, setOperation] = useState<'generate' | 'restyle' | 'replace'>(() => (
    controlsDraft?.operation ?? (panelMode === 'refine'
      ? initialConfig.operation === 'replace' ? 'replace' : 'restyle'
      : 'generate')
  ))
  const [targetBackground, setTargetBackground] = useState(controlsDraft?.targetBackground ?? (initialConfig.target_background || 'light'))
  const [excludeIconsInput, setExcludeIconsInput] = useState(controlsDraft?.excludeIconsInput ?? (initialConfig.exclude_icons || []).join(', '))
  const [advancedModified, setAdvancedModified] = useState(controlsDraft?.advancedModified ?? Boolean(initialFormData?.advancedModified))
  const [explicitFields, setExplicitFields] = useState<Set<IconOverrideField>>(() => controlsDraft ? new Set(controlsDraft.explicitFields) : initialExplicitFields)
  const [zIndex, setZIndex] = useState(controlsDraft?.zIndex ?? initialFormData?.z_index ?? DEFAULTS.zIndex)
  const [showPosition, setShowPosition] = useState(controlsDraft?.showPosition ?? false)
  const [showPadding, setShowPadding] = useState(controlsDraft?.showPadding ?? false)
  const [positionConfig, setPositionConfig] = useState<TextLabsPositionConfig>(controlsDraft?.positionConfig ?? initialFormData?.positionConfig ?? {
    start_col: 2,
    start_row: 4,
    position_width: DEFAULTS.width,
    position_height: DEFAULTS.height,
    auto_position: false,
  })
  const [paddingConfig, setPaddingConfig] = useState<TextLabsPaddingConfig>(controlsDraft?.paddingConfig ?? initialFormData?.paddingConfig ?? {
    top: 0, right: 0, bottom: 0, left: 0,
  })
  const { themeSource, updateThemeSource, useDeckTheme, themeOverrides } = useThemeSourceState(
    presentationId,
    controlsDraft?.themeSource ?? (initialFormData ? resolveDraftThemeSource(presentationId, initialFormData) : null),
  )

  const [geometryEdited, setGeometryEdited] = useState(controlsDraft?.geometryEdited ?? false)
  const geometryContextRef = useRef<ElementContext | null>(controlsDraft?.geometryContext ?? null)

  useEffect(() => {
    if (!elementContext) return
    if (STUDIO_VISUAL_FORMS) {
      if (targetElementId && elementContext.elementId && targetElementId !== elementContext.elementId) return
      const previous = geometryContextRef.current
      const sameOwner = !previous?.elementId || !elementContext.elementId || previous.elementId === elementContext.elementId
      const sameBounds = previous?.startCol === elementContext.startCol && previous?.startRow === elementContext.startRow
        && previous?.width === elementContext.width && previous?.height === elementContext.height
      geometryContextRef.current = { ...elementContext }
      if (geometryEdited && sameOwner && sameBounds) return
      setGeometryEdited(false)
    }
    setPositionConfig({
      start_col: elementContext.startCol,
      start_row: elementContext.startRow,
      position_width: elementContext.width,
      position_height: elementContext.height,
      auto_position: false,
    })
  }, [elementContext, STUDIO_VISUAL_FORMS ? targetElementId : null])

  const markExplicit = useCallback((field: IconOverrideField) => {
    if (STUDIO_VISUAL_FORMS && field === 'position') setGeometryEdited(true)
    setExplicitFields(previous => new Set(previous).add(field))
    setAdvancedModified(true)
  }, [])

  const clearExplicit = useCallback((field: IconOverrideField) => {
    setExplicitFields(previous => {
      const next = new Set(previous)
      next.delete(field)
      return next
    })
  }, [])

  const resetToAuto = useCallback(() => {
    if (STUDIO_VISUAL_FORMS) setGeometryEdited(false)
    setCount(1)
    setSize('medium')
    setStyle('circle')
    setFont('poppins')
    setColor(null)
    setStrokeWidth(2)
    setTargetBackground('light')
    setExcludeIconsInput('')
    setPositionConfig({
      start_col: elementContext?.startCol ?? 2,
      start_row: elementContext?.startRow ?? 4,
      position_width: elementContext?.width ?? DEFAULTS.width,
      position_height: elementContext?.height ?? DEFAULTS.height,
      auto_position: false,
    })
    setPaddingConfig({ top: 0, right: 0, bottom: 0, left: 0 })
    setZIndex(DEFAULTS.zIndex)
    updateThemeSource({ mode: presentationId ? 'deck' : 'none', overrides: null })
    setExplicitFields(new Set())
    setAdvancedModified(false)
  }, [elementContext, presentationId, updateThemeSource])

  useEffect(() => {
    setOperation(previous => {
      if (panelMode !== 'refine') return 'generate'
      return previous === 'generate' ? 'restyle' : previous
    })
  }, [panelMode])

  // Register mandatory config — Mode
  useEffect(() => {
    const configs: MandatoryConfig[] = [{
      fieldLabel: 'Mode',
      displayLabel: mode === 'icon' ? 'Icon' : 'Label',
      selectedValue: mode,
      options: [
        { value: 'icon', label: 'Icon' },
        { value: 'label', label: 'Label' },
      ],
      onChange: (value) => {
        const nextMode = value as 'icon' | 'label'
        setMode(nextMode)
        if (nextMode === 'label') clearExplicit('style')
      },
      promptPlaceholder: mode === 'icon' ? 'e.g., shopping cart icon, checkmark' : "e.g., Label 'IV', 'A+', 'Step 1'",
    }]

    if (panelMode === 'refine' && mode === 'icon') {
      configs.push({
        fieldLabel: 'Icon operation',
        displayLabel: operation === 'replace' ? 'Choose new icon' : 'Edit current',
        selectedValue: operation,
        options: [
          { value: 'restyle', label: 'Edit current' },
          { value: 'replace', label: 'Choose new icon' },
        ],
        onChange: value => setOperation(value === 'replace' ? 'replace' : 'restyle'),
      })
    }

    if (mode === 'icon') {
      const selectedStyle = ICON_STYLES.find(option => option.value === style)
      configs.push({
        fieldLabel: 'Style',
        displayLabel: explicitFields.has('style') ? selectedStyle?.label || 'Custom' : 'Auto',
        selectedValue: explicitFields.has('style') ? style : 'auto',
        options: [
          { value: 'auto', label: 'Auto' },
          ...ICON_STYLES,
        ],
        onChange: (value) => {
          if (value === 'auto') {
            clearExplicit('style')
            return
          }
          setStyle(value as IconLabelConfig['style'])
          markExplicit('style')
        },
      })
    }

    registerMandatoryConfig(configs)
  }, [clearExplicit, explicitFields, markExplicit, mode, operation, panelMode, registerMandatoryConfig, style])

  useEffect(() => {
    if (!STUDIO_VISUAL_FORMS || !onDraftChange) return
    onDraftChange({
      prompt, showAdvanced,
      iconLabelControls: {
        count, mode, size, style, font, color, strokeWidth, operation, targetBackground,
        excludeIconsInput, advancedModified, explicitFields: [...explicitFields], zIndex,
        showPosition, showPadding, positionConfig, paddingConfig, themeSource,
        geometryEdited, geometryContext: geometryContextRef.current,
      },
    })
  }, [onDraftChange, prompt, showAdvanced, count, mode, size, style, font, color, strokeWidth,
    operation, targetBackground, excludeIconsInput, advancedModified, explicitFields, zIndex,
    showPosition, showPadding, positionConfig, paddingConfig, themeSource, geometryEdited, elementContext])

  const handleSubmit = useCallback(() => {
    const defaultPrompt = mode === 'icon' ? 'shopping cart icon' : 'Label I'

    const formData: IconLabelFormData = {
      componentType: 'ICON_LABEL',
      prompt: prompt || defaultPrompt,
      count,
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      presentationId,
      useDeckTheme,
      themeOverrides,
      iconLabelConfig: {
        operation: STUDIO_VISUAL_FORMS && mode === 'label' ? 'generate' : operation,
        mode,
        ...(explicitFields.has('size') ? { size } : {}),
        ...(explicitFields.has('style') ? { style } : {}),
        ...(explicitFields.has('font') ? { font } : {}),
        ...(explicitFields.has('color') ? { color } : {}),
        ...(explicitFields.has('stroke') && mode === 'icon' ? { stroke_width: strokeWidth } : {}),
        ...(explicitFields.has('background') ? { target_background: targetBackground } : {}),
        ...(explicitFields.has('exclusions') ? {
          exclude_icons: excludeIconsInput.split(',').map(item => item.trim()).filter(Boolean),
        } : {}),
      },
      positionConfig,
      paddingConfig,
    }
    onSubmit(formData)
  }, [prompt, count, operation, mode, size, style, font, color, strokeWidth, targetBackground, excludeIconsInput, explicitFields, advancedModified, zIndex, presentationId, useDeckTheme, themeOverrides, positionConfig, paddingConfig, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  return (
    <div data-studio-v4-shell={STUDIO_VISUAL_FORMS ? 'true' : undefined} data-studio-visual-form={STUDIO_VISUAL_FORMS ? 'icon-label' : undefined} className="space-y-2.5">
      {showAdvanced && (<>
      <div data-studio-visual-summary={STUDIO_VISUAL_FORMS ? 'true' : undefined} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/60">
        <div>
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Automatic details</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Only changed fields override Illustrator defaults.</div>
        </div>
        <button type="button" onClick={resetToAuto} disabled={explicitFields.size === 0 && !advancedModified}
          className="rounded-md border border-slate-300 px-2 py-1 text-[10px] text-slate-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300">
          Reset to Auto
        </button>
      </div>
      <ThemeSourceSelector
        presentationId={presentationId}
        value={themeSource}
        onChange={selection => {
          updateThemeSource(selection)
          setAdvancedModified(true)
        }}
      />

      {/* Count */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Count</label>
        <select
          aria-label={STUDIO_VISUAL_FORMS ? 'Count' : undefined}
          value={count}
          onChange={(e) => { setCount(Number(e.target.value)); setAdvancedModified(true) }}
          className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {[1, 2, 3, 4, 5, 6].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {mode === 'icon' && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Stroke Width</label>
          <select
            aria-label={STUDIO_VISUAL_FORMS ? 'Stroke Width' : undefined}
            value={explicitFields.has('stroke') ? strokeWidth : ''}
            onChange={(event) => {
              if (!event.target.value) {
                clearExplicit('stroke')
                return
              }
              setStrokeWidth(Number(event.target.value))
              markExplicit('stroke')
            }}
            className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
          >
            <option value="">Auto</option>
            <option value="1">Thin</option>
            <option value="2">Regular</option>
            <option value="3">Thick</option>
            <option value="4">Extra thick</option>
          </select>
        </div>
      )}

      {/* Size */}
      <ToggleRow
        label="Size"
        field="size"
        value={size}
        options={[
          { value: 'xs', label: 'XS' },
          { value: 'small', label: 'S' },
          { value: 'medium', label: 'M' },
          { value: 'large', label: 'L' },
        ]}
        onChange={(_, v) => {
          setSize(v as IconLabelConfig['size'])
          markExplicit('size')
        }}
      />

      {/* Style (icon mode only) */}
      {mode === 'icon' && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Style</label>
          <select
            aria-label={STUDIO_VISUAL_FORMS ? 'Style' : undefined}
            value={explicitFields.has('style') ? style : ''}
            onChange={(e) => {
              if (!e.target.value) {
                clearExplicit('style')
                return
              }
              setStyle(e.target.value as IconLabelConfig['style'])
              markExplicit('style')
            }}
            className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Auto</option>
            {ICON_STYLES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Font (label mode only) */}
      {mode === 'label' && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Font</label>
          <select
            aria-label={STUDIO_VISUAL_FORMS ? 'Font' : undefined}
            value={font}
            onChange={(e) => {
              setFont(e.target.value as IconLabelConfig['font'])
              markExplicit('font')
            }}
            className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {LABEL_FONTS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Color */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Color</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            aria-label={STUDIO_VISUAL_FORMS ? 'Color' : undefined}
            value={color || getDefaultColor(mode, style)}
            onChange={(e) => {
              setColor(e.target.value)
              markExplicit('color')
            }}
            className="h-6 w-6 rounded border border-gray-300 dark:border-slate-600 cursor-pointer"
          />
          <span className="text-[10px] text-gray-400 dark:text-slate-500">{color || 'Auto'}</span>
          {color && (
            <button
              onClick={() => {
                setColor(null)
                setExplicitFields(previous => {
                  const next = new Set(previous)
                  next.delete('color')
                  return next
                })
              }}
              className="text-[10px] text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:text-slate-200"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <ToggleRow
        label="Background"
        field="target_background"
        value={targetBackground}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onChange={(_, v) => {
          setTargetBackground(v)
          markExplicit('background')
        }}
      />

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Exclude Icons</label>
        <input
          type="text"
          aria-label={STUDIO_VISUAL_FORMS ? 'Exclude Icons' : undefined}
          value={excludeIconsInput}
          onChange={(e) => {
            setExcludeIconsInput(e.target.value)
            markExplicit('exclusions')
          }}
          placeholder="e.g., star, circle-dot"
          className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Z-Index */}
      <ZIndexInput
        value={zIndex}
        onChange={setZIndex}
        onAdvancedModified={() => setAdvancedModified(true)}
      />

      <CollapsibleSection title="Position & Size" isOpen={showPosition} onToggle={() => setShowPosition(!showPosition)}>
        <div data-studio-visual-pair={STUDIO_VISUAL_FORMS ? 'true' : undefined} className="grid grid-cols-2 gap-2">
          {([
            ['Col', 'start_col', 1, 32],
            ['Row', 'start_row', 1, 18],
            ['Width', 'position_width', 1, 32],
            ['Height', 'position_height', 1, 18],
          ] as const).map(([label, field, min, max]) => (
            <label key={field} className="space-y-1">
              <span className="text-[10px] text-gray-500 dark:text-slate-400">{label}</span>
              <input type="number" min={min} max={max} value={positionConfig[field]}
                onChange={event => {
                  setPositionConfig(previous => ({ ...previous, [field]: Number(event.target.value) }))
                  markExplicit('position')
                }}
                className="w-full rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800" />
            </label>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Container Padding" isOpen={showPadding} onToggle={() => setShowPadding(!showPadding)}>
        <PaddingControl
          paddingConfig={paddingConfig}
          onChange={setPaddingConfig}
          onAdvancedModified={() => markExplicit('padding')}
        />
      </CollapsibleSection>
      </>)}
    </div>
  )
}

IconLabelForm.displayName = 'IconLabelForm'

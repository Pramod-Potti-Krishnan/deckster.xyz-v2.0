'use client'

import { useState, useCallback, useEffect } from 'react'
import { ImageFormData, ImageConfig, TextLabsImageStyle, TextLabsPaddingConfig, TEXT_LABS_ELEMENT_DEFAULTS, GRID_CELL_SIZE, IMAGE_POSITION_PRESETS } from '@/types/textlabs'
import { ElementContext, GenerationPanelDraft, MandatoryConfig } from '../types'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'
import { PaddingControl } from '../shared/padding-control'
import { ZIndexInput } from '../shared/z-index-input'
import { ThemeSourceSelector } from '../shared/theme-source-selector'
import { useThemeSourceState } from '../shared/use-theme-source-state'
import { resolveDraftThemeSource } from '@/lib/visual-form-draft'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.IMAGE
type ImageOverrideField = 'style' | 'quality' | 'corners' | 'border' | 'position' | 'aspectRatio'

// Backend-aligned image styles (8 values matching ImageStyle Literal)
const IMAGE_STYLE_GROUPS: { category: string; styles: { value: TextLabsImageStyle; label: string }[] }[] = [
  {
    category: 'Photography',
    styles: [
      { value: 'realistic', label: 'Realistic' },
      { value: 'photo', label: 'Corporate Photo' },
    ],
  },
  {
    category: 'Illustration',
    styles: [
      { value: 'illustration', label: 'Digital Illustration' },
      { value: 'brand_graphic', label: 'Brand Graphic' },
      { value: 'flat_vector', label: 'Flat Vector' },
      { value: 'isometric', label: 'Isometric' },
    ],
  },
  {
    category: 'Design',
    styles: [
      { value: 'minimal', label: 'Minimalist' },
      { value: 'abstract', label: 'Abstract' },
    ],
  },
]

// Maximum grid dimensions for scale-to-fit
const MAX_WIDTH = 28
const MAX_HEIGHT = 14

// Aspect ratio presets with scale-to-fit centering
const ASPECT_RATIO_PRESETS: { label: string; ratioW: number; ratioH: number }[] = [
  { label: '16:9', ratioW: 16, ratioH: 9 },
  { label: '4:3', ratioW: 4, ratioH: 3 },
  { label: '1:1', ratioW: 1, ratioH: 1 },
  { label: '9:16', ratioW: 9, ratioH: 16 },
  { label: '3:2', ratioW: 3, ratioH: 2 },
]

function calculateGCD(a: number, b: number): number {
  return b === 0 ? a : calculateGCD(b, a % b)
}

function reducedRatio(width: number, height: number): string {
  const scaledWidth = Math.round(width * 1000)
  const scaledHeight = Math.round(height * 1000)
  const gcd = calculateGCD(scaledWidth, scaledHeight)
  return `${scaledWidth / gcd}:${scaledHeight / gcd}`
}

/** Scale-to-fit: maximize dimensions within maxW x maxH while preserving aspect ratio, then center */
function scaleToFitAndCenter(ratioW: number, ratioH: number): { width: number; height: number; startCol: number; startRow: number } {
  // Scale up to fill max area while keeping ratio
  const scaleW = MAX_WIDTH / ratioW
  const scaleH = MAX_HEIGHT / ratioH
  const scale = Math.min(scaleW, scaleH)
  const width = Math.floor(ratioW * scale)
  const height = Math.floor(ratioH * scale)
  // Center on the content area (cols 2-31, rows 4-17)
  const startCol = Math.max(2, Math.floor(2 + (30 - width) / 2))
  const startRow = Math.max(4, Math.floor(4 + (14 - height) / 2))
  return { width, height, startCol, startRow }
}

interface ImageFormProps {
  onSubmit: (formData: ImageFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  presentationId?: string | null
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig | MandatoryConfig[]) => void
  initialDraft?: GenerationPanelDraft | null
  panelMode: 'generate' | 'edit' | 'refine'
}

export function ImageForm({ onSubmit, registerSubmit, isGenerating, presentationId, elementContext, prompt, showAdvanced, registerMandatoryConfig, initialDraft, panelMode }: ImageFormProps) {
  const initialFormData = initialDraft?.formData?.componentType === 'IMAGE'
    ? initialDraft.formData
    : null
  const initialConfig = initialFormData?.imageConfig || {}
  const initialExplicitFields = new Set<ImageOverrideField>([
    ...('style' in initialConfig ? ['style' as const] : []),
    ...('quality' in initialConfig ? ['quality' as const] : []),
    ...('corners' in initialConfig ? ['corners' as const] : []),
    ...('border' in initialConfig ? ['border' as const] : []),
    ...('auto_position' in initialConfig ? ['position' as const] : []),
    ...('aspect_ratio' in initialConfig ? ['aspectRatio' as const] : []),
  ])
  // Image config
  const [style, setStyle] = useState<TextLabsImageStyle>(initialConfig.style || 'realistic')
  const [quality, setQuality] = useState<ImageConfig['quality']>(initialConfig.quality || 'standard')
  const [corners, setCorners] = useState<'square' | 'rounded'>(initialConfig.corners || 'square')
  const [border, setBorder] = useState(initialConfig.border || false)
  const [startCol, setStartCol] = useState(initialConfig.start_col || 2)
  const [startRow, setStartRow] = useState(initialConfig.start_row || 4)
  const [width, setWidth] = useState(initialConfig.width || DEFAULTS.width)
  const [height, setHeight] = useState(initialConfig.height || DEFAULTS.height)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(initialConfig.aspect_ratio || '16:9')
  const [selectedPositionPreset, setSelectedPositionPreset] = useState<string | null>(null)
  const [operation, setOperation] = useState<'generate' | 'edit' | 'variation'>(() => (
    panelMode === 'refine'
      ? initialConfig.operation === 'variation' ? 'variation' : 'edit'
      : 'generate'
  ))
  const [advancedModified, setAdvancedModified] = useState(Boolean(initialFormData?.advancedModified))
  const [explicitFields, setExplicitFields] = useState<Set<ImageOverrideField>>(() => initialExplicitFields)
  const [zIndex, setZIndex] = useState(initialFormData?.z_index ?? DEFAULTS.zIndex)
  const { themeSource, updateThemeSource, useDeckTheme, themeOverrides } = useThemeSourceState(
    presentationId,
    initialFormData ? resolveDraftThemeSource(presentationId, initialFormData) : null,
  )

  // Section visibility
  const [showStyle, setShowStyle] = useState(false)
  const [showPosition, setShowPosition] = useState(false)
  const [showPadding, setShowPadding] = useState(false)

  // Padding
  const [paddingConfig, setPaddingConfig] = useState<TextLabsPaddingConfig>(
    initialFormData?.paddingConfig || { top: 0, right: 0, bottom: 0, left: 0 },
  )

  const markExplicit = useCallback((...fields: ImageOverrideField[]) => {
    setExplicitFields(previous => {
      const next = new Set(previous)
      fields.forEach(field => next.add(field))
      return next
    })
    setAdvancedModified(true)
  }, [])

  const clearExplicit = useCallback((field: ImageOverrideField) => {
    setExplicitFields(previous => {
      const next = new Set(previous)
      next.delete(field)
      return next
    })
  }, [])

  const resetToAuto = useCallback(() => {
    setStyle('realistic')
    setQuality('standard')
    setCorners('square')
    setBorder(false)
    setStartCol(elementContext?.startCol ?? 2)
    setStartRow(elementContext?.startRow ?? 4)
    setWidth(elementContext?.width ?? DEFAULTS.width)
    setHeight(elementContext?.height ?? DEFAULTS.height)
    setSelectedAspectRatio(elementContext ? 'custom' : '16:9')
    setSelectedPositionPreset(null)
    setPaddingConfig({ top: 0, right: 0, bottom: 0, left: 0 })
    setZIndex(DEFAULTS.zIndex)
    updateThemeSource({ mode: presentationId ? 'deck' : 'none', overrides: null })
    setExplicitFields(new Set())
    setAdvancedModified(false)
  }, [elementContext, presentationId, updateThemeSource])

  // Initialize position from canvas context
  useEffect(() => {
    if (elementContext) {
      setStartCol(elementContext.startCol)
      setStartRow(elementContext.startRow)
      setWidth(elementContext.width)
      setHeight(elementContext.height)
      setSelectedAspectRatio('custom')
      setSelectedPositionPreset(null)
    }
  }, [elementContext])

  // A generated placeholder becomes an existing image without remounting this
  // form. Move it onto image-aware editing at that transition, while retaining
  // a user's explicit "Create new variation" choice during later submissions.
  useEffect(() => {
    setOperation(previous => {
      if (panelMode !== 'refine') return 'generate'
      return previous === 'generate' ? 'edit' : previous
    })
  }, [panelMode])

  const applyAspectRatio = useCallback((preset: typeof ASPECT_RATIO_PRESETS[0]) => {
    const fit = scaleToFitAndCenter(preset.ratioW, preset.ratioH)
    setWidth(fit.width)
    setHeight(fit.height)
    setStartCol(fit.startCol)
    setStartRow(fit.startRow)
    setSelectedAspectRatio(preset.label)
    setSelectedPositionPreset(null) // Clear position preset when aspect ratio changes
    markExplicit('position', 'aspectRatio')
  }, [markExplicit])

  const applyPositionPreset = useCallback((key: string) => {
    const preset = IMAGE_POSITION_PRESETS[key]
    if (!preset) return
    setStartCol(preset.start_col)
    setStartRow(preset.start_row)
    setWidth(preset.width)
    setHeight(preset.height)
    setSelectedPositionPreset(key)
    setSelectedAspectRatio('custom') // Position preset dimensions may not match any ratio
    markExplicit('position', 'aspectRatio')
  }, [markExplicit])

  useEffect(() => {
    const selectedStyle = IMAGE_STYLE_GROUPS
      .flatMap(group => group.styles)
      .find(option => option.value === style)
    const styleConfig: MandatoryConfig = {
      fieldLabel: 'Image style',
      displayLabel: explicitFields.has('style') ? selectedStyle?.label || 'Custom' : 'Auto',
      selectedValue: explicitFields.has('style') ? style : 'auto',
      optionGroups: [
        {
          group: 'Automatic',
          options: [{ value: 'auto', label: 'Auto' }],
        },
        ...IMAGE_STYLE_GROUPS.map(group => ({
          group: group.category,
          options: group.styles,
        })),
      ],
      onChange: (value) => {
        if (value === 'auto') {
          clearExplicit('style')
          return
        }
        setStyle(value as TextLabsImageStyle)
        markExplicit('style')
      },
      promptPlaceholder: 'e.g., Modern office space with team collaboration',
    }
    if (panelMode !== 'refine') {
      registerMandatoryConfig(styleConfig)
      return
    }
    registerMandatoryConfig([
      {
        fieldLabel: 'Image operation',
        displayLabel: operation === 'edit' ? 'Edit current' : 'Create new variation',
        selectedValue: operation,
        nativeSelect: true,
        options: [
          { value: 'edit', label: 'Edit current' },
          { value: 'variation', label: 'Create new variation' },
        ],
        onChange: (value: string) => setOperation(value === 'variation' ? 'variation' : 'edit'),
      },
      styleConfig,
    ])
  }, [clearExplicit, explicitFields, markExplicit, operation, panelMode, registerMandatoryConfig, style])

  const handleSubmit = useCallback(() => {
    const aspectRatio = selectedAspectRatio === 'custom'
      ? reducedRatio(width, height)
      : selectedAspectRatio
    const gridRow = `${startRow}/${startRow + height}`
    const gridColumn = `${startCol}/${startCol + width}`

    const imageConfig: Partial<ImageConfig> = {
      operation,
      placeholder_mode: false,
      start_col: startCol,
      start_row: startRow,
      width,
      height,
      grid_row: gridRow,
      grid_column: gridColumn,
      ...(explicitFields.has('style') ? { style } : {}),
      ...(explicitFields.has('quality') ? { quality } : {}),
      ...(explicitFields.has('corners') ? { corners } : {}),
      ...(explicitFields.has('border') ? { border } : {}),
      ...(explicitFields.has('position') ? { auto_position: false } : {}),
      ...(explicitFields.has('aspectRatio') ? { aspect_ratio: aspectRatio } : {}),
    }

    const formData: ImageFormData = {
      componentType: 'IMAGE',
      prompt,
      count: 1,
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      presentationId,
      useDeckTheme,
      themeOverrides,
      imageConfig,
      paddingConfig,
    }
    onSubmit(formData)
  }, [prompt, operation, style, quality, corners, border, startCol, startRow, width, height, selectedAspectRatio, explicitFields, advancedModified, zIndex, presentationId, useDeckTheme, themeOverrides, paddingConfig, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  // Pixel + aspect ratio display
  const pixelWidth = width * GRID_CELL_SIZE
  const pixelHeight = height * GRID_CELL_SIZE
  const displayAspect = reducedRatio(pixelWidth, pixelHeight)

  return (
    <div className="space-y-2.5">
      {showAdvanced && (<>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/60">
        <div>
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Automatic</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Uses the live canvas geometry and service defaults.</div>
        </div>
        <button
          type="button"
          onClick={resetToAuto}
          disabled={explicitFields.size === 0 && !advancedModified}
          className="rounded-md border border-slate-300 px-2 py-1 text-[10px] text-slate-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300"
        >
          Reset to Auto
        </button>
      </div>
      {/* Style Options */}
      <CollapsibleSection title="Style" isOpen={showStyle} onToggle={() => setShowStyle(!showStyle)}>
        <div className="space-y-2">
          <ThemeSourceSelector
            presentationId={presentationId}
            value={themeSource}
            onChange={selection => {
              updateThemeSource(selection)
              setAdvancedModified(true)
            }}
          />

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Image Style</label>
            <select
              value={explicitFields.has('style') ? style : ''}
              onChange={(event) => {
                if (!event.target.value) {
                  clearExplicit('style')
                  return
                }
                setStyle(event.target.value as TextLabsImageStyle)
                markExplicit('style')
              }}
              className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
            >
              <option value="">Auto</option>
              {IMAGE_STYLE_GROUPS.flatMap(group => group.styles).map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* Quality */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Quality</label>
            <select
              value={explicitFields.has('quality') ? quality : ''}
              onChange={(e) => {
                if (!e.target.value) {
                  setExplicitFields(previous => {
                    const next = new Set(previous)
                    next.delete('quality')
                    return next
                  })
                  return
                }
                setQuality(e.target.value as ImageConfig['quality'])
                markExplicit('quality')
              }}
              className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Auto</option>
              <option value="draft">Draft</option>
              <option value="standard">Standard</option>
              <option value="high">High</option>
              <option value="ultra">Ultra</option>
            </select>
          </div>

          {/* Corners */}
          <ToggleRow
            label="Corners"
            field="corners"
            value={corners}
            options={[
              { value: 'square', label: 'Square' },
              { value: 'rounded', label: 'Rounded' },
            ]}
            onChange={(_, v) => {
              setCorners(v as 'square' | 'rounded')
              markExplicit('corners')
            }}
          />

          {/* Border */}
          <ToggleRow
            label="Border"
            field="border"
            value={border ? 'true' : 'false'}
            options={[
              { value: 'true', label: 'On' },
              { value: 'false', label: 'Off' },
            ]}
            onChange={(_, v) => {
              setBorder(v === 'true')
              markExplicit('border')
            }}
          />
        </div>
      </CollapsibleSection>

      {/* Position & Aspect Ratio */}
      <CollapsibleSection title="Position & Size" isOpen={showPosition} onToggle={() => setShowPosition(!showPosition)}>
        <div className="space-y-2">
          {/* Aspect Ratio Presets */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Aspect Ratio</label>
            <div className="grid grid-cols-3 gap-1">
              {ASPECT_RATIO_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => applyAspectRatio(preset)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    selectedAspectRatio === preset.label
                      ? 'bg-primary text-white border border-primary'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 border border-gray-300 dark:border-slate-600 hover:bg-gray-200 dark:hover:bg-slate-700 dark:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setSelectedAspectRatio('custom')
                  markExplicit('aspectRatio')
                }}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  selectedAspectRatio === 'custom'
                    ? 'bg-primary text-white border border-primary'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 border border-gray-300 dark:border-slate-600 hover:bg-gray-200 dark:hover:bg-slate-700 dark:bg-slate-700'
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Size info with aspect ratio */}
          <div className="text-[10px] text-gray-400 dark:text-slate-500">
            Size: {width} x {height} grid ({pixelWidth} x {pixelHeight}px) &mdash; Aspect: {displayAspect}
          </div>

          {/* Auto/Manual Positioning */}
          <ToggleRow
            label="Positioning"
            field="auto_position"
            value={explicitFields.has('position') ? 'manual' : 'auto'}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'manual', label: 'Manual' },
            ]}
            onChange={(_, v) => {
              if (v === 'auto') {
                setStartCol(elementContext?.startCol ?? 2)
                setStartRow(elementContext?.startRow ?? 4)
                setWidth(elementContext?.width ?? DEFAULTS.width)
                setHeight(elementContext?.height ?? DEFAULTS.height)
                setSelectedAspectRatio(elementContext ? 'custom' : '16:9')
                setSelectedPositionPreset(null)
                setExplicitFields(previous => {
                  const next = new Set(previous)
                  next.delete('position')
                  next.delete('aspectRatio')
                  return next
                })
              } else {
                markExplicit('position')
              }
            }}
          />

          {explicitFields.has('position') && (
            <>
              {/* Position Presets */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 dark:text-slate-500">Position Presets</label>
                <div className="grid grid-cols-3 gap-1">
                  {Object.entries(IMAGE_POSITION_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => applyPositionPreset(key)}
                      className={`px-1.5 py-1 rounded text-[10px] transition-colors ${
                        selectedPositionPreset === key
                          ? 'bg-primary text-white border border-primary'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 border border-gray-300 dark:border-slate-600 hover:bg-gray-200 dark:hover:bg-slate-700 dark:bg-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Col/Row Inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 dark:text-slate-500">Col</label>
                  <input type="number" value={startCol} min={1} max={32} step={0.2}
                    onChange={(e) => { setStartCol(Number(e.target.value)); setSelectedPositionPreset(null); markExplicit('position') }}
                    className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 dark:text-slate-500">Row</label>
                  <input type="number" value={startRow} min={1} max={18} step={0.2}
                    onChange={(e) => { setStartRow(Number(e.target.value)); setSelectedPositionPreset(null); markExplicit('position') }}
                    className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100" />
                </div>
              </div>
            </>
          )}

          {/* Width/Height always visible */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 dark:text-slate-500">Width</label>
              <input type="number" value={width} min={0.2} max={32} step={0.2}
                onChange={(e) => { setWidth(Number(e.target.value)); setSelectedAspectRatio('custom'); setSelectedPositionPreset(null); markExplicit('position', 'aspectRatio') }}
                className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 dark:text-slate-500">Height</label>
              <input type="number" value={height} min={0.2} max={18} step={0.2}
                onChange={(e) => { setHeight(Number(e.target.value)); setSelectedAspectRatio('custom'); setSelectedPositionPreset(null); markExplicit('position', 'aspectRatio') }}
                className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100" />
            </div>
          </div>

          <ZIndexInput
            value={zIndex}
            onChange={setZIndex}
            onAdvancedModified={() => setAdvancedModified(true)}
          />
        </div>
      </CollapsibleSection>

      {/* Container Padding */}
      <CollapsibleSection title="Container Padding" isOpen={showPadding} onToggle={() => setShowPadding(!showPadding)}>
        <PaddingControl
          paddingConfig={paddingConfig}
          onChange={setPaddingConfig}
          onAdvancedModified={() => setAdvancedModified(true)}
        />
      </CollapsibleSection>
      </>)}
    </div>
  )
}

ImageForm.displayName = 'ImageForm'

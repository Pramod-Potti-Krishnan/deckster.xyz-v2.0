'use client'

import { useState, useCallback, useEffect } from 'react'
import { ImageFormData, ImageConfig, TextLabsImageStyle, TextLabsPaddingConfig, TEXT_LABS_ELEMENT_DEFAULTS, GRID_CELL_SIZE, IMAGE_POSITION_PRESETS } from '@/types/textlabs'
import { ElementContext } from '../types'
import { PromptInput } from '../shared/prompt-input'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'
import { PaddingControl } from '../shared/padding-control'
import { ZIndexInput } from '../shared/z-index-input'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.IMAGE

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
  elementContext?: ElementContext | null
}

export function ImageForm({ onSubmit, registerSubmit, isGenerating, elementContext }: ImageFormProps) {
  const [prompt, setPrompt] = useState('')

  // Image config
  const [style, setStyle] = useState<TextLabsImageStyle>('realistic')
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard')
  const [corners, setCorners] = useState<'square' | 'rounded'>('square')
  const [border, setBorder] = useState(false)
  const [autoPosition, setAutoPosition] = useState(false)
  const [startCol, setStartCol] = useState(2)
  const [startRow, setStartRow] = useState(4)
  const [width, setWidth] = useState(DEFAULTS.width)
  const [height, setHeight] = useState(DEFAULTS.height)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('16:9')
  const [selectedPositionPreset, setSelectedPositionPreset] = useState<string | null>(null)
  const [advancedModified, setAdvancedModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)

  // Section visibility
  const [showStyle, setShowStyle] = useState(false)
  const [showPosition, setShowPosition] = useState(false)
  const [showPadding, setShowPadding] = useState(false)

  // Padding
  const [paddingConfig, setPaddingConfig] = useState<TextLabsPaddingConfig>({
    top: 0, right: 0, bottom: 0, left: 0,
  })

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

  const applyAspectRatio = useCallback((preset: typeof ASPECT_RATIO_PRESETS[0]) => {
    const fit = scaleToFitAndCenter(preset.ratioW, preset.ratioH)
    setWidth(fit.width)
    setHeight(fit.height)
    setStartCol(fit.startCol)
    setStartRow(fit.startRow)
    setSelectedAspectRatio(preset.label)
    setSelectedPositionPreset(null) // Clear position preset when aspect ratio changes
    setAdvancedModified(true)
  }, [])

  const applyPositionPreset = useCallback((key: string) => {
    const preset = IMAGE_POSITION_PRESETS[key]
    if (!preset) return
    setStartCol(preset.start_col)
    setStartRow(preset.start_row)
    setWidth(preset.width)
    setHeight(preset.height)
    setSelectedPositionPreset(key)
    setSelectedAspectRatio('custom') // Position preset dimensions may not match any ratio
    setAutoPosition(false)
    setAdvancedModified(true)
  }, [])

  const handleSubmit = useCallback(() => {
    const gcd = calculateGCD(width, height)
    const aspectRatio = `${width / gcd}:${height / gcd}`
    const gridRow = `${startRow}/${startRow + height}`
    const gridColumn = `${startCol}/${startCol + width}`

    const imageConfig: Partial<ImageConfig> = {
      style,
      quality,
      corners,
      border,
      placeholder_mode: false,
      auto_position: autoPosition,
      start_col: startCol,
      start_row: startRow,
      width,
      height,
      grid_row: gridRow,
      grid_column: gridColumn,
      aspect_ratio: aspectRatio,
    }

    const formData: ImageFormData = {
      componentType: 'IMAGE',
      prompt,
      count: 1,
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      imageConfig,
      paddingConfig,
    }
    onSubmit(formData)
  }, [prompt, style, quality, corners, border, autoPosition, startCol, startRow, width, height, advancedModified, zIndex, paddingConfig, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  // Pixel + aspect ratio display
  const pixelWidth = width * GRID_CELL_SIZE
  const pixelHeight = height * GRID_CELL_SIZE
  const gcd = calculateGCD(pixelWidth, pixelHeight)
  const displayAspect = `${pixelWidth / gcd}:${pixelHeight / gcd}`

  return (
    <div className="space-y-2.5">
      {/* Prompt */}
      <PromptInput
        value={prompt}
        onChange={setPrompt}
        placeholder="e.g., Modern office space with team collaboration, or a city skyline at sunset"
        disabled={isGenerating}
      />

      {/* Image Style (grouped dropdown — 8 backend-supported styles) */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-gray-600">Image Style</label>
        <select
          value={style}
          onChange={(e) => {
            setStyle(e.target.value as TextLabsImageStyle)
            setAdvancedModified(true)
          }}
          className="w-full px-2 py-1 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {IMAGE_STYLE_GROUPS.map(group => (
            <optgroup key={group.category} label={group.category}>
              {group.styles.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Style Options */}
      <CollapsibleSection title="Style" isOpen={showStyle} onToggle={() => setShowStyle(!showStyle)}>
        <div className="space-y-2">
          {/* Quality */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600">Quality</label>
            <select
              value={quality}
              onChange={(e) => {
                setQuality(e.target.value as 'standard' | 'hd')
                setAdvancedModified(true)
              }}
              className="w-full px-2 py-1 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="standard">Standard</option>
              <option value="hd">HD</option>
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
              setAdvancedModified(true)
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
              setAdvancedModified(true)
            }}
          />
        </div>
      </CollapsibleSection>

      {/* Position & Aspect Ratio */}
      <CollapsibleSection title="Position & Size" isOpen={showPosition} onToggle={() => setShowPosition(!showPosition)}>
        <div className="space-y-2">
          {/* Aspect Ratio Presets */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600">Aspect Ratio</label>
            <div className="grid grid-cols-3 gap-1">
              {ASPECT_RATIO_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => applyAspectRatio(preset)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    selectedAspectRatio === preset.label
                      ? 'bg-primary text-white border border-primary'
                      : 'bg-gray-100 text-gray-400 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setSelectedAspectRatio('custom')
                  setAdvancedModified(true)
                }}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  selectedAspectRatio === 'custom'
                    ? 'bg-primary text-white border border-primary'
                    : 'bg-gray-100 text-gray-400 border border-gray-300 hover:bg-gray-200'
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Size info with aspect ratio */}
          <div className="text-[10px] text-gray-400">
            Size: {width} x {height} grid ({pixelWidth} x {pixelHeight}px) &mdash; Aspect: {displayAspect}
          </div>

          {/* Auto/Manual Positioning */}
          <ToggleRow
            label="Positioning"
            field="auto_position"
            value={autoPosition ? 'auto' : 'manual'}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'manual', label: 'Manual' },
            ]}
            onChange={(_, v) => {
              setAutoPosition(v === 'auto')
              setAdvancedModified(true)
            }}
          />

          {!autoPosition && (
            <>
              {/* Position Presets */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Position Presets</label>
                <div className="grid grid-cols-3 gap-1">
                  {Object.entries(IMAGE_POSITION_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => applyPositionPreset(key)}
                      className={`px-1.5 py-1 rounded text-[10px] transition-colors ${
                        selectedPositionPreset === key
                          ? 'bg-primary text-white border border-primary'
                          : 'bg-gray-100 text-gray-400 border border-gray-300 hover:bg-gray-200'
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
                  <label className="text-[10px] text-gray-400">Col</label>
                  <input type="number" value={startCol} min={1} max={32}
                    onChange={(e) => { setStartCol(Number(e.target.value)); setSelectedPositionPreset(null); setAdvancedModified(true) }}
                    className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400">Row</label>
                  <input type="number" value={startRow} min={1} max={18}
                    onChange={(e) => { setStartRow(Number(e.target.value)); setSelectedPositionPreset(null); setAdvancedModified(true) }}
                    className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900" />
                </div>
              </div>
            </>
          )}

          {/* Width/Height always visible */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400">Width</label>
              <input type="number" value={width} min={1} max={32}
                onChange={(e) => { setWidth(Number(e.target.value)); setSelectedAspectRatio('custom'); setSelectedPositionPreset(null); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400">Height</label>
              <input type="number" value={height} min={1} max={18}
                onChange={(e) => { setHeight(Number(e.target.value)); setSelectedAspectRatio('custom'); setSelectedPositionPreset(null); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900" />
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
    </div>
  )
}

ImageForm.displayName = 'ImageForm'

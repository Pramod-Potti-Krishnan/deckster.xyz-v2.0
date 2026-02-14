'use client'

import { useState, useCallback, useEffect } from 'react'
import { ImageFormData, ImageConfig, TextLabsImageStyle, TextLabsPaddingConfig, TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import { PromptInput } from '../shared/prompt-input'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'
import { PaddingControl } from '../shared/padding-control'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.IMAGE

// Image style options
const IMAGE_STYLES: { value: TextLabsImageStyle; label: string }[] = [
  { value: 'realistic', label: 'Realistic' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: '3d_render', label: '3D Render' },
  { value: 'flat_design', label: 'Flat Design' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'abstract', label: 'Abstract' },
  { value: 'photographic', label: 'Photographic' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'artistic', label: 'Artistic' },
]

// Aspect ratio presets
const ASPECT_RATIO_PRESETS: { label: string; width: number; height: number }[] = [
  { label: '16:9', width: 16, height: 9 },
  { label: '4:3', width: 16, height: 12 },
  { label: '1:1', width: 14, height: 14 },
  { label: '9:16', width: 9, height: 16 },
  { label: '3:2', width: 18, height: 12 },
]

function calculateGCD(a: number, b: number): number {
  return b === 0 ? a : calculateGCD(b, a % b)
}

const DEFAULT_IMAGE_CONFIG = {
  style: 'realistic' as TextLabsImageStyle,
  quality: 'standard' as const,
  corners: 'square' as const,
  border: false,
  placeholder_mode: false,
  auto_position: true,
  start_col: 2,
  start_row: 4,
  width: DEFAULTS.width,
  height: DEFAULTS.height,
}

interface ImageFormProps {
  onSubmit: (formData: ImageFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
}

export function ImageForm({ onSubmit, registerSubmit, isGenerating }: ImageFormProps) {
  // Basic fields
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(1)
  const [contentSource, setContentSource] = useState<'ai' | 'placeholder'>('ai')

  // Image config
  const [style, setStyle] = useState<TextLabsImageStyle>('realistic')
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard')
  const [corners, setCorners] = useState<'square' | 'rounded' | 'pill'>('square')
  const [border, setBorder] = useState(false)
  const [autoPosition, setAutoPosition] = useState(true)
  const [startCol, setStartCol] = useState(2)
  const [startRow, setStartRow] = useState(4)
  const [width, setWidth] = useState(DEFAULTS.width)
  const [height, setHeight] = useState(DEFAULTS.height)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('16:9')
  const [advancedModified, setAdvancedModified] = useState(false)

  // Section visibility
  const [showStyle, setShowStyle] = useState(false)
  const [showPosition, setShowPosition] = useState(false)
  const [showPadding, setShowPadding] = useState(false)

  // Padding
  const [paddingConfig, setPaddingConfig] = useState<TextLabsPaddingConfig>({
    top: 0, right: 0, bottom: 0, left: 0,
  })

  const applyAspectRatio = useCallback((preset: typeof ASPECT_RATIO_PRESETS[0]) => {
    setWidth(preset.width)
    setHeight(preset.height)
    setSelectedAspectRatio(preset.label)
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
      placeholder_mode: contentSource === 'placeholder',
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
      prompt: contentSource === 'placeholder' ? (prompt || 'Generate a placeholder image') : prompt,
      count,
      layout: 'horizontal',
      advancedModified,
      z_index: DEFAULTS.zIndex,
      imageConfig,
      paddingConfig,
    }
    onSubmit(formData)
  }, [prompt, count, contentSource, style, quality, corners, border, autoPosition, startCol, startRow, width, height, advancedModified, paddingConfig, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  // Calculate pixel dimensions for display
  const pixelWidth = width * 60
  const pixelHeight = height * 60

  return (
    <div className="space-y-4">
      {/* Prompt */}
      {contentSource === 'ai' && (
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          placeholder="e.g., Modern office space with team collaboration, or a city skyline at sunset"
          disabled={isGenerating}
        />
      )}

      {/* Content Source Toggle */}
      <ToggleRow
        label="Content Source"
        field="contentSource"
        value={contentSource}
        options={[
          { value: 'ai', label: 'AI Generated' },
          { value: 'placeholder', label: 'Placeholder' },
        ]}
        onChange={(_, v) => setContentSource(v as 'ai' | 'placeholder')}
      />

      {/* Count */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-300">Count</label>
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-full px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          {[1, 2, 3, 4].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Style Section */}
      <CollapsibleSection title="Style" isOpen={showStyle} onToggle={() => setShowStyle(!showStyle)}>
        <div className="space-y-3">
          {/* Style */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Image Style</label>
            <select
              value={style}
              onChange={(e) => {
                setStyle(e.target.value as TextLabsImageStyle)
                setAdvancedModified(true)
              }}
              className="w-full px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {IMAGE_STYLES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Quality */}
          <ToggleRow
            label="Quality"
            field="quality"
            value={quality}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'hd', label: 'HD' },
            ]}
            onChange={(_, v) => {
              setQuality(v as 'standard' | 'hd')
              setAdvancedModified(true)
            }}
          />

          {/* Corners */}
          <ToggleRow
            label="Corners"
            field="corners"
            value={corners}
            options={[
              { value: 'square', label: 'Square' },
              { value: 'rounded', label: 'Rounded' },
              { value: 'pill', label: 'Pill' },
            ]}
            onChange={(_, v) => {
              setCorners(v as 'square' | 'rounded' | 'pill')
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
        <div className="space-y-3">
          {/* Aspect Ratio Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Aspect Ratio</label>
            <div className="grid grid-cols-3 gap-1">
              {ASPECT_RATIO_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => applyAspectRatio(preset)}
                  className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                    selectedAspectRatio === preset.label
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
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
                className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  selectedAspectRatio === 'custom'
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                    : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Size info */}
          <div className="text-[10px] text-gray-500">
            Size: {width} x {height} grid ({pixelWidth} x {pixelHeight}px)
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
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Col</label>
                <input
                  type="number"
                  value={startCol}
                  min={1}
                  max={32}
                  onChange={(e) => { setStartCol(Number(e.target.value)); setAdvancedModified(true) }}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Row</label>
                <input
                  type="number"
                  value={startRow}
                  min={1}
                  max={18}
                  onChange={(e) => { setStartRow(Number(e.target.value)); setAdvancedModified(true) }}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Width</label>
                <input
                  type="number"
                  value={width}
                  min={1}
                  max={32}
                  onChange={(e) => {
                    setWidth(Number(e.target.value))
                    setSelectedAspectRatio('custom')
                    setAdvancedModified(true)
                  }}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Height</label>
                <input
                  type="number"
                  value={height}
                  min={1}
                  max={18}
                  onChange={(e) => {
                    setHeight(Number(e.target.value))
                    setSelectedAspectRatio('custom')
                    setAdvancedModified(true)
                  }}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Padding */}
      <CollapsibleSection title="Padding" isOpen={showPadding} onToggle={() => setShowPadding(!showPadding)}>
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

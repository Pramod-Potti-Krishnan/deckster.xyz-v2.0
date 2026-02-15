'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { InfographicFormData, InfographicConfig, TEXT_LABS_ELEMENT_DEFAULTS, POSITION_PRESETS, GRID_CELL_SIZE } from '@/types/textlabs'
import { ElementContext, MandatoryConfig } from '../types'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'
import { ZIndexInput } from '../shared/z-index-input'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.INFOGRAPHIC

function calculateGCD(a: number, b: number): number {
  return b === 0 ? a : calculateGCD(b, a % b)
}

interface InfographicFormProps {
  onSubmit: (formData: InfographicFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig) => void
}

export function InfographicForm({ onSubmit, registerSubmit, isGenerating, elementContext, prompt, showAdvanced, registerMandatoryConfig }: InfographicFormProps) {
  const [contentSource, setContentSource] = useState<'ai' | 'placeholder'>('ai')
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [advancedModified, setAdvancedModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)

  // Config
  const [aspectRatio, setAspectRatio] = useState<InfographicConfig['aspect_ratio']>('auto')
  const [segments, setSegments] = useState<InfographicConfig['segments']>('auto')
  const [cropMode, setCropMode] = useState<InfographicConfig['crop_mode']>('shape')
  const [targetBackground, setTargetBackground] = useState<InfographicConfig['target_background']>('light')
  const [fillInternal, setFillInternal] = useState(false)

  // Position (with preset support)
  const [positionPreset, setPositionPreset] = useState('full')
  const [startCol, setStartCol] = useState(2)
  const [startRow, setStartRow] = useState(4)
  const [width, setWidth] = useState(DEFAULTS.width)
  const [height, setHeight] = useState(DEFAULTS.height)

  // Initialize position from canvas context
  useEffect(() => {
    if (elementContext) {
      setStartCol(elementContext.startCol)
      setStartRow(elementContext.startRow)
      setWidth(elementContext.width)
      setHeight(elementContext.height)
      setPositionPreset('custom')
    }
  }, [elementContext])

  const [showContent, setShowContent] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showPosition, setShowPosition] = useState(false)

  const applyPositionPreset = useCallback((key: string) => {
    const preset = POSITION_PRESETS[key]
    if (!preset) return
    setPositionPreset(key)
    setStartCol(preset.start_col)
    setStartRow(preset.start_row)
    setWidth(preset.width)
    setHeight(preset.height)
    setAdvancedModified(true)
  }, [])

  // Register mandatory config — Content Source
  useEffect(() => {
    registerMandatoryConfig({
      fieldLabel: 'Content',
      displayLabel: contentSource === 'ai' ? 'AI Generated' : 'Placeholder',
      options: [
        { value: 'ai', label: 'AI Generated' },
        { value: 'placeholder', label: 'Placeholder' },
      ],
      onChange: (v) => setContentSource(v as 'ai' | 'placeholder'),
      promptPlaceholder: 'e.g., A 5-step sales funnel showing leads to conversion',
    })
  }, [contentSource, registerMandatoryConfig])

  const handleSubmit = useCallback(() => {
    const gridRow = `${startRow}/${startRow + height}`
    const gridColumn = `${startCol}/${startCol + width}`

    let defaultPrompt = 'Generate an infographic'
    if (contentSource === 'placeholder') defaultPrompt = 'Add placeholder infographic'
    if (referenceImage) defaultPrompt = 'Recreate infographic from reference image'

    const infographicConfig: Partial<InfographicConfig> = {
      aspect_ratio: aspectRatio,
      segments,
      crop_mode: cropMode,
      target_background: targetBackground,
      fill_internal: fillInternal,
      placeholder_mode: contentSource === 'placeholder',
      grid_row: gridRow,
      grid_column: gridColumn,
      start_col: startCol,
      start_row: startRow,
      width,
      height,
    }

    const formData: InfographicFormData = {
      componentType: 'INFOGRAPHIC',
      prompt: prompt || defaultPrompt,
      count: 1, // Backend hides count for INFOGRAPHIC
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      infographicConfig,
      referenceImage,
    }
    onSubmit(formData)
  }, [prompt, contentSource, referenceImage, aspectRatio, segments, cropMode, targetBackground, fillInternal, startCol, startRow, width, height, advancedModified, zIndex, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  // Pixel + aspect ratio display
  const pixelW = width * GRID_CELL_SIZE
  const pixelH = height * GRID_CELL_SIZE
  const gcd = calculateGCD(pixelW, pixelH)
  const displayAspect = `${pixelW / gcd}:${pixelH / gcd}`

  return (
    <div className="space-y-2.5">
      {showAdvanced && (<>
      {/* Content */}
      <CollapsibleSection title="Content" isOpen={showContent} onToggle={() => setShowContent(!showContent)}>
        <div className="space-y-2">
          {/* Reference Image Upload */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600">Reference Image (optional)</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
                className="px-3 py-1 rounded text-xs font-medium bg-gray-50 text-gray-700 border border-gray-300 hover:bg-gray-100 disabled:opacity-40 transition-colors"
              >
                {referenceImage ? 'Change' : 'Upload'}
              </button>
              {referenceImage && (
                <>
                  <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{referenceImage.name}</span>
                  <button
                    onClick={() => setReferenceImage(null)}
                    className="text-[10px] text-gray-400 hover:text-gray-700"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setReferenceImage(e.target.files?.[0] || null)}
              className="hidden"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Options */}
      <CollapsibleSection title="Options" isOpen={showOptions} onToggle={() => setShowOptions(!showOptions)}>
        <div className="space-y-2">
          {/* Aspect Ratio (with 9:16) */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600">Aspect Ratio</label>
            <select
              value={aspectRatio}
              onChange={(e) => { setAspectRatio(e.target.value as InfographicConfig['aspect_ratio']); setAdvancedModified(true) }}
              className="w-full px-2 py-1 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="auto">Auto</option>
              <option value="16:9">16:9</option>
              <option value="4:3">4:3</option>
              <option value="1:1">1:1</option>
              <option value="3:2">3:2</option>
              <option value="9:16">9:16</option>
            </select>
          </div>

          {/* Segments (1-8) */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600">Segments</label>
            <select
              value={segments}
              onChange={(e) => { setSegments(e.target.value as InfographicConfig['segments']); setAdvancedModified(true) }}
              className="w-full px-2 py-1 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="auto">Auto</option>
              {['1', '2', '3', '4', '5', '6', '7', '8'].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Crop Mode (shape/rectangle) */}
          <ToggleRow
            label="Crop Mode"
            field="crop_mode"
            value={cropMode}
            options={[
              { value: 'shape', label: 'Shape' },
              { value: 'rectangle', label: 'Rectangle' },
            ]}
            onChange={(_, v) => { setCropMode(v as InfographicConfig['crop_mode']); setAdvancedModified(true) }}
          />

          {/* Target Background */}
          <ToggleRow
            label="Background"
            field="target_background"
            value={targetBackground}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={(_, v) => { setTargetBackground(v as InfographicConfig['target_background']); setAdvancedModified(true) }}
          />

          {/* Fill Internal */}
          <ToggleRow
            label="Fill Internal"
            field="fill_internal"
            value={fillInternal ? 'true' : 'false'}
            options={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
            onChange={(_, v) => { setFillInternal(v === 'true'); setAdvancedModified(true) }}
          />
        </div>
      </CollapsibleSection>

      {/* Position */}
      <CollapsibleSection title="Position" isOpen={showPosition} onToggle={() => setShowPosition(!showPosition)}>
        <div className="space-y-2">
          {/* 9 Position Presets */}
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400">Presets</label>
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(POSITION_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPositionPreset(key)}
                  className={`px-1.5 py-1 rounded text-[10px] transition-colors ${
                    positionPreset === key
                      ? 'bg-primary text-white border border-primary'
                      : 'bg-gray-100 text-gray-400 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size display */}
          <div className="text-[10px] text-gray-400">
            Size: {width} x {height} grid ({pixelW} x {pixelH}px) &mdash; Aspect: {displayAspect}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Col', value: startCol, setter: setStartCol, min: 1, max: 32 },
              { label: 'Row', value: startRow, setter: setStartRow, min: 1, max: 18 },
              { label: 'Width', value: width, setter: setWidth, min: 1, max: 32 },
              { label: 'Height', value: height, setter: setHeight, min: 1, max: 18 },
            ].map(({ label, value, setter, min, max }) => (
              <div key={label} className="space-y-1">
                <label className="text-[10px] text-gray-400">{label}</label>
                <input
                  type="number"
                  value={value}
                  min={min}
                  max={max}
                  onChange={(e) => { setter(Number(e.target.value)); setPositionPreset('custom'); setAdvancedModified(true) }}
                  className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
                />
              </div>
            ))}
          </div>

          <ZIndexInput
            value={zIndex}
            onChange={setZIndex}
            onAdvancedModified={() => setAdvancedModified(true)}
          />
        </div>
      </CollapsibleSection>
      </>)}
    </div>
  )
}

InfographicForm.displayName = 'InfographicForm'

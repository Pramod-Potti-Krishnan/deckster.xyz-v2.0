'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Upload } from 'lucide-react'
import { InfographicFormData, InfographicConfig, InfographicSegmentCount, InfographicV2Segment, TEXT_LABS_ELEMENT_DEFAULTS, POSITION_PRESETS, GRID_CELL_SIZE } from '@/types/textlabs'
import { ElementContext, MandatoryConfig } from '../types'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'
import { ZIndexInput } from '../shared/z-index-input'
import { ThemeSourceSelector } from '../shared/theme-source-selector'
import { useThemeSourceState } from '../shared/use-theme-source-state'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.INFOGRAPHIC

function calculateGCD(a: number, b: number): number {
  return b === 0 ? a : calculateGCD(b, a % b)
}

interface InfographicFormProps {
  onSubmit: (formData: InfographicFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  presentationId?: string | null
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig) => void
}

export function InfographicForm({ onSubmit, registerSubmit, isGenerating, presentationId, elementContext, prompt, showAdvanced, registerMandatoryConfig }: InfographicFormProps) {
  const [contentSource, setContentSource] = useState<'ai' | 'placeholder'>('ai')
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [advancedModified, setAdvancedModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)
  const { themeSource, updateThemeSource, useDeckTheme, themeOverrides } = useThemeSourceState(presentationId)

  // Config
  const [mode, setMode] = useState<InfographicConfig['mode']>('v1')
  const [aspectRatio, setAspectRatio] = useState<InfographicConfig['aspect_ratio']>('auto')
  const [segments, setSegments] = useState<InfographicSegmentCount>('auto')
  const [cropMode, setCropMode] = useState<InfographicConfig['crop_mode']>('shape')
  const [targetBackground, setTargetBackground] = useState<InfographicConfig['target_background']>('light')
  const [fillInternal, setFillInternal] = useState(false)
  const [layoutFamily, setLayoutFamily] = useState<NonNullable<InfographicConfig['layout_family']>>('horizontal_center')
  const [templateId, setTemplateId] = useState('')
  const [segmentRows, setSegmentRows] = useState<InfographicV2Segment[]>([
    { label: 'Segment 1', sublabel: '', description: '', icon_hint: '', color: '' },
    { label: 'Segment 2', sublabel: '', description: '', icon_hint: '', color: '' },
    { label: 'Segment 3', sublabel: '', description: '', icon_hint: '', color: '' },
  ])
  const [segmentColorsInput, setSegmentColorsInput] = useState('')
  const [textMode, setTextMode] = useState<NonNullable<InfographicConfig['text_mode']>>('heading_sublabel')
  const [showIcons, setShowIcons] = useState(true)

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

  const updateSegment = useCallback((index: number, field: keyof InfographicV2Segment, value: string) => {
    setSegmentRows(prev => prev.map((segment, idx) => idx === index ? { ...segment, [field]: value } : segment))
    setAdvancedModified(true)
  }, [])

  const addSegment = useCallback(() => {
    setSegmentRows(prev => prev.length >= 8 ? prev : [
      ...prev,
      { label: `Segment ${prev.length + 1}`, sublabel: '', description: '', icon_hint: '', color: '' },
    ])
    setAdvancedModified(true)
  }, [])

  const removeSegment = useCallback((index: number) => {
    setSegmentRows(prev => prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== index))
    setAdvancedModified(true)
  }, [])

  // Register mandatory config — Reference Image upload chip
  useEffect(() => {
    registerMandatoryConfig({
      fieldLabel: 'Reference',
      displayLabel: referenceImage ? referenceImage.name : 'No image',
      onChange: () => {},
      promptPlaceholder: 'e.g., A 5-step sales funnel showing leads to conversion',
      customRender: (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700 dark:bg-slate-700 text-xs text-gray-700 dark:text-slate-200 transition-colors"
          >
            <Upload className="h-3 w-3 text-gray-400 dark:text-slate-500" />
            {referenceImage ? (
              <span className="truncate max-w-[100px]">{referenceImage.name}</span>
            ) : (
              <span>Ref. Image</span>
            )}
          </button>
          {referenceImage && (
            <button
              type="button"
              onClick={() => setReferenceImage(null)}
              className="text-[10px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-300"
            >
              &times;
            </button>
          )}
        </div>
      ),
    })
  }, [referenceImage, registerMandatoryConfig])

  const handleSubmit = useCallback(() => {
    const gridRow = `${startRow}/${startRow + height}`
    const gridColumn = `${startCol}/${startCol + width}`

    let defaultPrompt = 'Generate an infographic'
    if (contentSource === 'placeholder') defaultPrompt = 'Add placeholder infographic'
    if (referenceImage) defaultPrompt = 'Recreate infographic from reference image'

    const normalizedV2Segments = segmentRows
      .map(segment => ({
        label: segment.label.trim(),
        sublabel: segment.sublabel?.trim() || undefined,
        description: segment.description?.trim() || undefined,
        icon_hint: segment.icon_hint?.trim() || undefined,
        color: segment.color?.trim() || undefined,
      }))
      .filter(segment => segment.label)
      .slice(0, 8)
    const safeV2Segments = normalizedV2Segments.length >= 2
      ? normalizedV2Segments
      : [{ label: 'Segment 1' }, { label: 'Segment 2' }]

    const infographicConfig: Partial<InfographicConfig> = {
      mode,
      aspect_ratio: aspectRatio,
      segments: mode === 'v2' ? safeV2Segments : segments,
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
      layout_family: mode === 'v2' ? layoutFamily : undefined,
      template_id: mode === 'v2' && templateId.trim() ? templateId.trim() : undefined,
      segment_colors: mode === 'v2'
        ? segmentColorsInput.split(',').map(item => item.trim()).filter(Boolean)
        : undefined,
      text_mode: mode === 'v2' ? textMode : undefined,
      show_icons: mode === 'v2' ? showIcons : undefined,
    }

    const formData: InfographicFormData = {
      componentType: 'INFOGRAPHIC',
      prompt: prompt || defaultPrompt,
      count: 1, // Backend hides count for INFOGRAPHIC
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      presentationId,
      useDeckTheme,
      themeOverrides,
      infographicConfig,
      referenceImage,
    }
    onSubmit(formData)
  }, [prompt, contentSource, referenceImage, mode, aspectRatio, segments, cropMode, targetBackground, fillInternal, layoutFamily, templateId, segmentRows, segmentColorsInput, textMode, showIcons, startCol, startRow, width, height, advancedModified, zIndex, presentationId, useDeckTheme, themeOverrides, onSubmit])

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
      {/* Hidden file input for reference image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => setReferenceImage(e.target.files?.[0] || null)}
        className="hidden"
      />

      {showAdvanced && (<>
      {/* Options */}
      <CollapsibleSection title="Options" isOpen={showOptions} onToggle={() => setShowOptions(!showOptions)}>
        <div className="space-y-2">
          <ThemeSourceSelector
            presentationId={presentationId}
            value={themeSource}
            onChange={updateThemeSource}
          />

          <ToggleRow
            label="Design"
            field="mode"
            value={mode}
            options={[
              { value: 'v1', label: 'Creative design' },
              { value: 'v2', label: 'Structured design' },
            ]}
            onChange={(_, v) => { setMode(v as InfographicConfig['mode']); setAdvancedModified(true) }}
          />

          {/* Aspect Ratio (with 9:16) */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Aspect Ratio</label>
            <select
              value={aspectRatio}
              onChange={(e) => { setAspectRatio(e.target.value as InfographicConfig['aspect_ratio']); setAdvancedModified(true) }}
              className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
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
            <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Segments</label>
            <select
              value={segments}
              onChange={(e) => { setSegments(e.target.value as InfographicSegmentCount); setAdvancedModified(true) }}
              className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
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

          {mode === 'v2' && (
            <div className="space-y-2 rounded-md border border-gray-200 dark:border-slate-700 p-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Layout</label>
                  <select
                    value={layoutFamily}
                    onChange={(e) => { setLayoutFamily(e.target.value as NonNullable<InfographicConfig['layout_family']>); setAdvancedModified(true) }}
                    className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="horizontal_top">Horizontal Top</option>
                    <option value="horizontal_center">Horizontal Center</option>
                    <option value="vertical_left">Vertical Left</option>
                    <option value="vertical_center">Vertical Center</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Text</label>
                  <select
                    value={textMode}
                    onChange={(e) => { setTextMode(e.target.value as NonNullable<InfographicConfig['text_mode']>); setAdvancedModified(true) }}
                    className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="none">None</option>
                    <option value="heading">Heading</option>
                    <option value="heading_sublabel">Heading + Sublabel</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Template ID</label>
                <input
                  value={templateId}
                  onChange={(e) => { setTemplateId(e.target.value); setAdvancedModified(true) }}
                  placeholder="optional"
                  className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Segments</label>
                <div className="space-y-2">
                  {segmentRows.map((segment, index) => (
                    <div key={index} className="space-y-1 rounded border border-gray-200 p-2 dark:border-slate-700">
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          value={segment.label}
                          onChange={(e) => updateSegment(index, 'label', e.target.value)}
                          placeholder="Label"
                          className="px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
                        />
                        <input
                          value={segment.sublabel || ''}
                          onChange={(e) => updateSegment(index, 'sublabel', e.target.value)}
                          placeholder="Sublabel"
                          className="px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
                        />
                        <input
                          value={segment.icon_hint || ''}
                          onChange={(e) => updateSegment(index, 'icon_hint', e.target.value)}
                          placeholder="Icon hint"
                          className="px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
                        />
                        <input
                          value={segment.color || ''}
                          onChange={(e) => updateSegment(index, 'color', e.target.value)}
                          placeholder="#2563eb"
                          className="px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
                        />
                      </div>
                      <textarea
                        value={segment.description || ''}
                        onChange={(e) => updateSegment(index, 'description', e.target.value)}
                        rows={2}
                        placeholder="Description"
                        className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => removeSegment(index)}
                        disabled={segmentRows.length <= 2}
                        className="text-[10px] text-gray-500 hover:text-gray-700 disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addSegment}
                    disabled={segmentRows.length >= 8}
                    className="px-2 py-1 rounded border border-gray-300 text-[11px] text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Add Segment
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Segment Colors</label>
                <input
                  value={segmentColorsInput}
                  onChange={(e) => { setSegmentColorsInput(e.target.value); setAdvancedModified(true) }}
                  placeholder="#2563eb, #14b8a6"
                  className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <ToggleRow
                label="Icons"
                field="show_icons"
                value={showIcons ? 'true' : 'false'}
                options={[
                  { value: 'true', label: 'On' },
                  { value: 'false', label: 'Off' },
                ]}
                onChange={(_, v) => { setShowIcons(v === 'true'); setAdvancedModified(true) }}
              />
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Position */}
      <CollapsibleSection title="Position" isOpen={showPosition} onToggle={() => setShowPosition(!showPosition)}>
        <div className="space-y-2">
          {/* 9 Position Presets */}
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 dark:text-slate-500">Presets</label>
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(POSITION_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPositionPreset(key)}
                  className={`px-1.5 py-1 rounded text-[10px] transition-colors ${
                    positionPreset === key
                      ? 'bg-primary text-white border border-primary'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 border border-gray-300 dark:border-slate-600 hover:bg-gray-200 dark:hover:bg-slate-700 dark:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size display */}
          <div className="text-[10px] text-gray-400 dark:text-slate-500">
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
                <label className="text-[10px] text-gray-400 dark:text-slate-500">{label}</label>
                <input
                  type="number"
                  value={value}
                  min={min}
                  max={max}
                  onChange={(e) => { setter(Number(e.target.value)); setPositionPreset('custom'); setAdvancedModified(true) }}
                  className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
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

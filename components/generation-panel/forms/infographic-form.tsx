'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { InfographicFormData, InfographicConfig, TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import { PromptInput } from '../shared/prompt-input'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.INFOGRAPHIC

interface InfographicFormProps {
  onSubmit: (formData: InfographicFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
}

export function InfographicForm({ onSubmit, registerSubmit, isGenerating }: InfographicFormProps) {
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(1)
  const [contentSource, setContentSource] = useState<'ai' | 'placeholder'>('ai')
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [advancedModified, setAdvancedModified] = useState(false)

  // Config
  const [aspectRatio, setAspectRatio] = useState<InfographicConfig['aspect_ratio']>('auto')
  const [segments, setSegments] = useState<InfographicConfig['segments']>('auto')
  const [cropMode, setCropMode] = useState<InfographicConfig['crop_mode']>('shape')
  const [targetBackground, setTargetBackground] = useState<InfographicConfig['target_background']>('light')
  const [fillInternal, setFillInternal] = useState(false)

  // Position
  const [startCol, setStartCol] = useState(2)
  const [startRow, setStartRow] = useState(4)
  const [width, setWidth] = useState(DEFAULTS.width)
  const [height, setHeight] = useState(DEFAULTS.height)

  const [showOptions, setShowOptions] = useState(false)
  const [showPosition, setShowPosition] = useState(false)

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
      count,
      layout: 'horizontal',
      advancedModified,
      z_index: DEFAULTS.zIndex,
      infographicConfig,
      referenceImage,
    }
    onSubmit(formData)
  }, [prompt, count, contentSource, referenceImage, aspectRatio, segments, cropMode, targetBackground, fillInternal, startCol, startRow, width, height, advancedModified, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  return (
    <div className="space-y-4">
      {/* Prompt */}
      {contentSource === 'ai' && (
        <PromptInput
          value={prompt}
          onChange={setPrompt}
          placeholder="e.g., A 5-step sales funnel showing leads to conversion, or a cycle diagram for PDCA process"
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

      {/* Reference Image Upload */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-300">Reference Image (optional)</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating}
            className="px-3 py-1.5 rounded text-xs font-medium bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {referenceImage ? 'Change' : 'Upload'}
          </button>
          {referenceImage && (
            <>
              <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{referenceImage.name}</span>
              <button
                onClick={() => setReferenceImage(null)}
                className="text-[10px] text-gray-500 hover:text-gray-300"
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

      {/* Count */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-300">Count</label>
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-full px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          {[1, 2].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Options */}
      <CollapsibleSection title="Options" isOpen={showOptions} onToggle={() => setShowOptions(!showOptions)}>
        <div className="space-y-3">
          {/* Aspect Ratio */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Aspect Ratio</label>
            <select
              value={aspectRatio}
              onChange={(e) => { setAspectRatio(e.target.value as InfographicConfig['aspect_ratio']); setAdvancedModified(true) }}
              className="w-full px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="auto">Auto</option>
              <option value="16:9">16:9</option>
              <option value="4:3">4:3</option>
              <option value="1:1">1:1</option>
              <option value="3:2">3:2</option>
            </select>
          </div>

          {/* Segments */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Segments</label>
            <select
              value={segments}
              onChange={(e) => { setSegments(e.target.value as InfographicConfig['segments']); setAdvancedModified(true) }}
              className="w-full px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="auto">Auto</option>
              {['3', '4', '5', '6', '7', '8'].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Crop Mode */}
          <ToggleRow
            label="Crop Mode"
            field="crop_mode"
            value={cropMode}
            options={[
              { value: 'shape', label: 'Shape' },
              { value: 'full', label: 'Full' },
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
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Col', value: startCol, setter: setStartCol, min: 1, max: 32 },
            { label: 'Row', value: startRow, setter: setStartRow, min: 1, max: 18 },
            { label: 'Width', value: width, setter: setWidth, min: 1, max: 32 },
            { label: 'Height', value: height, setter: setHeight, min: 1, max: 18 },
          ].map(({ label, value, setter, min, max }) => (
            <div key={label} className="space-y-1">
              <label className="text-[10px] text-gray-500">{label}</label>
              <input
                type="number"
                value={value}
                min={min}
                max={max}
                onChange={(e) => { setter(Number(e.target.value)); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  )
}

InfographicForm.displayName = 'InfographicForm'

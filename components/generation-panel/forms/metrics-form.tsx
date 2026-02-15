'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { MetricsFormData, MetricsConfig, TextLabsPositionConfig, TextLabsPaddingConfig, TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import { ElementContext } from '../types'
import { PromptInput } from '../shared/prompt-input'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'
import { FontOverrideSection } from '../shared/font-override-section'
import { PositionPresets } from '../shared/position-presets'
import { PaddingControl } from '../shared/padding-control'
import { ZIndexInput } from '../shared/z-index-input'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.METRICS

const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  corners: 'rounded',
  border: false,
  alignment: 'center',
  color_scheme: 'gradient',
  color_variant: null,
  placeholder_mode: false,
  value_min_chars: 2,
  value_max_chars: 6,
  label_min_chars: 6,
  label_max_chars: 18,
  description_min_chars: 60,
  description_max_chars: 90,
  value_font_color: null,
  value_font_size: null,
  value_font_family: null,
  value_bold: null,
  value_italic: null,
  value_allcaps: null,
  label_font_color: null,
  label_font_size: null,
  label_font_family: null,
  label_bold: null,
  label_italic: null,
  label_allcaps: null,
  desc_font_color: null,
  desc_font_size: null,
  desc_font_family: null,
  desc_bold: null,
  desc_italic: null,
  desc_allcaps: null,
}

interface MetricsFormProps {
  onSubmit: (formData: MetricsFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  elementContext?: ElementContext | null
}

export function MetricsForm({ onSubmit, registerSubmit, isGenerating, elementContext }: MetricsFormProps) {
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(1)
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal')
  const [contentSource, setContentSource] = useState<'ai' | 'placeholder'>('ai')
  const [config, setConfig] = useState<MetricsConfig>({ ...DEFAULT_METRICS_CONFIG })
  const [advancedModified, setAdvancedModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)

  // Section visibility
  const [showInstances, setShowInstances] = useState(false)
  const [showCardDesign, setShowCardDesign] = useState(false)
  const [showValue, setShowValue] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  const [showDescription, setShowDescription] = useState(false)
  const [showPositioning, setShowPositioning] = useState(false)

  // Position
  const [positionConfig, setPositionConfig] = useState<TextLabsPositionConfig>({
    start_col: 2,
    start_row: 4,
    position_width: DEFAULTS.width,
    position_height: DEFAULTS.height,
    auto_position: false,
  })

  // Padding
  const [paddingConfig, setPaddingConfig] = useState<TextLabsPaddingConfig>({
    top: 0, right: 0, bottom: 0, left: 0,
  })

  // Initialize position from canvas context
  useEffect(() => {
    if (elementContext) {
      setPositionConfig(prev => ({
        ...prev,
        start_col: elementContext.startCol,
        start_row: elementContext.startRow,
        position_width: elementContext.width,
        position_height: elementContext.height,
      }))
    }
  }, [elementContext])

  const updateConfig = useCallback((field: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [field]: value }))
    setAdvancedModified(true)
  }, [])

  // Auto-update font colors when color scheme changes (only null/auto colors)
  const prevSchemeRef = useRef(config.color_scheme)
  useEffect(() => {
    if (prevSchemeRef.current === config.color_scheme) return
    prevSchemeRef.current = config.color_scheme
    const isDarkBg = config.color_scheme === 'gradient' || config.color_scheme === 'solid'
    const autoColor = isDarkBg ? '#FFFFFF' : '#1F2937'
    setConfig(prev => ({
      ...prev,
      value_font_color: prev.value_font_color === null ? autoColor : prev.value_font_color,
      label_font_color: prev.label_font_color === null ? autoColor : prev.label_font_color,
      desc_font_color: prev.desc_font_color === null ? autoColor : prev.desc_font_color,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.color_scheme])

  const handleSubmit = useCallback(() => {
    const formData: MetricsFormData = {
      componentType: 'METRICS',
      prompt: contentSource === 'placeholder' ? (prompt || 'Generate placeholder metrics') : prompt,
      count,
      layout,
      advancedModified,
      z_index: zIndex,
      metricsConfig: {
        ...config,
        placeholder_mode: contentSource === 'placeholder',
      },
      positionConfig: positionConfig.auto_position ? undefined : positionConfig,
      paddingConfig,
    }
    onSubmit(formData)
  }, [prompt, count, layout, contentSource, config, advancedModified, zIndex, positionConfig, paddingConfig, onSubmit])

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
          placeholder="e.g., Key financial metrics for Q4 2024 including revenue, growth, and profit margin"
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

      {/* Section 1: Instances */}
      <CollapsibleSection title="Instances" isOpen={showInstances} onToggle={() => setShowInstances(!showInstances)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Count</label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {[1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Layout</label>
              <div className="flex gap-1">
                {[
                  { value: 'horizontal', label: 'Horiz' },
                  { value: 'vertical', label: 'Vert' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setLayout(option.value as 'horizontal' | 'vertical')}
                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      layout === option.value
                        ? 'bg-purple-600 text-white border border-purple-600'
                        : 'bg-gray-100 text-gray-400 border border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 2: Card Design */}
      <CollapsibleSection title="Card Design" isOpen={showCardDesign} onToggle={() => setShowCardDesign(!showCardDesign)}>
        <div className="space-y-3">
          <ToggleRow
            label="Corners"
            field="corners"
            value={config.corners}
            options={[
              { value: 'rounded', label: 'Rounded' },
              { value: 'square', label: 'Square' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />
          <ToggleRow
            label="Border"
            field="border"
            value={config.border ? 'true' : 'false'}
            options={[
              { value: 'true', label: 'On' },
              { value: 'false', label: 'Off' },
            ]}
            onChange={(f, v) => updateConfig(f, v === 'true')}
          />
          <ToggleRow
            label="Alignment"
            field="alignment"
            value={config.alignment}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />
          <ToggleRow
            label="Color Scheme"
            field="color_scheme"
            value={config.color_scheme}
            options={[
              { value: 'gradient', label: 'Gradient' },
              { value: 'solid', label: 'Solid' },
              { value: 'accent', label: 'Accent' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />
          {/* Card Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Card Color</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={config.color_variant || '#3B82F6'}
                onChange={(e) => updateConfig('color_variant', e.target.value)}
                className="h-7 w-7 rounded border border-gray-300 cursor-pointer"
              />
              <span className="text-[10px] text-gray-400">{config.color_variant || 'Auto'}</span>
              {config.color_variant && (
                <button
                  onClick={() => updateConfig('color_variant', null)}
                  className="text-[10px] text-gray-400 hover:text-gray-700"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 3: Value */}
      <CollapsibleSection title="Value" isOpen={showValue} onToggle={() => setShowValue(!showValue)}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 font-medium">Value Char Limits</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Min</label>
                <input
                  type="number"
                  value={config.value_min_chars}
                  min={1}
                  max={config.value_max_chars}
                  onChange={(e) => updateConfig('value_min_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Max</label>
                <input
                  type="number"
                  value={config.value_max_chars}
                  min={config.value_min_chars}
                  max={20}
                  onChange={(e) => updateConfig('value_max_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
                />
              </div>
            </div>
          </div>
          <FontOverrideSection
            label="Value Font"
            prefix="value"
            config={config as unknown as Record<string, unknown>}
            onChange={updateConfig}
            thirdToggle="allcaps"
          />
        </div>
      </CollapsibleSection>

      {/* Section 4: Label */}
      <CollapsibleSection title="Label" isOpen={showLabel} onToggle={() => setShowLabel(!showLabel)}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 font-medium">Label Char Limits</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Min</label>
                <input
                  type="number"
                  value={config.label_min_chars}
                  min={1}
                  max={config.label_max_chars}
                  onChange={(e) => updateConfig('label_min_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Max</label>
                <input
                  type="number"
                  value={config.label_max_chars}
                  min={config.label_min_chars}
                  max={50}
                  onChange={(e) => updateConfig('label_max_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
                />
              </div>
            </div>
          </div>
          <FontOverrideSection
            label="Label Font"
            prefix="label"
            config={config as unknown as Record<string, unknown>}
            onChange={updateConfig}
            thirdToggle="allcaps"
          />
        </div>
      </CollapsibleSection>

      {/* Section 5: Description */}
      <CollapsibleSection title="Description" isOpen={showDescription} onToggle={() => setShowDescription(!showDescription)}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 font-medium">Description Char Limits</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Min</label>
                <input
                  type="number"
                  value={config.description_min_chars}
                  min={1}
                  max={config.description_max_chars}
                  onChange={(e) => updateConfig('description_min_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Max</label>
                <input
                  type="number"
                  value={config.description_max_chars}
                  min={config.description_min_chars}
                  max={200}
                  onChange={(e) => updateConfig('description_max_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
                />
              </div>
            </div>
          </div>
          <FontOverrideSection
            label="Description Font"
            prefix="desc"
            config={config as unknown as Record<string, unknown>}
            onChange={updateConfig}
            thirdToggle="allcaps"
          />
        </div>
      </CollapsibleSection>

      {/* Section 6: Positioning */}
      <CollapsibleSection title="Positioning" isOpen={showPositioning} onToggle={() => setShowPositioning(!showPositioning)}>
        <div className="space-y-4">
          <PositionPresets
            positionConfig={positionConfig}
            onChange={setPositionConfig}
            elementType="METRICS"
            onAdvancedModified={() => setAdvancedModified(true)}
          />
          <PaddingControl
            paddingConfig={paddingConfig}
            onChange={setPaddingConfig}
            onAdvancedModified={() => setAdvancedModified(true)}
          />
          <ZIndexInput
            value={zIndex}
            onChange={setZIndex}
            onAdvancedModified={() => setAdvancedModified(true)}
          />
        </div>
      </CollapsibleSection>
    </div>
  )
}

MetricsForm.displayName = 'MetricsForm'

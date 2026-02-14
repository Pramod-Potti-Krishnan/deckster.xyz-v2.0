'use client'

import { useState, useCallback, useEffect } from 'react'
import { MetricsFormData, MetricsConfig, TextLabsPositionConfig, TextLabsPaddingConfig, TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import { PromptInput } from '../shared/prompt-input'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'
import { FontOverrideSection } from '../shared/font-override-section'
import { PositionPresets } from '../shared/position-presets'
import { PaddingControl } from '../shared/padding-control'

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
  // Value font overrides
  value_font_color: null,
  value_font_size: null,
  value_font_family: null,
  value_bold: null,
  value_italic: null,
  value_allcaps: null,
  // Label font overrides
  label_font_color: null,
  label_font_size: null,
  label_font_family: null,
  label_bold: null,
  label_italic: null,
  label_allcaps: null,
  // Description font overrides
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
}

export function MetricsForm({ onSubmit, registerSubmit, isGenerating }: MetricsFormProps) {
  // Basic fields
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(1)
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal')
  const [contentSource, setContentSource] = useState<'ai' | 'placeholder'>('ai')

  // Advanced config
  const [config, setConfig] = useState<MetricsConfig>({ ...DEFAULT_METRICS_CONFIG })
  const [advancedModified, setAdvancedModified] = useState(false)

  // Section visibility
  const [showStyle, setShowStyle] = useState(false)
  const [showCharLimits, setShowCharLimits] = useState(false)
  const [showFontOverrides, setShowFontOverrides] = useState(false)
  const [showPosition, setShowPosition] = useState(false)
  const [showPadding, setShowPadding] = useState(false)

  // Position
  const [positionConfig, setPositionConfig] = useState<TextLabsPositionConfig>({
    start_col: 2,
    start_row: 4,
    position_width: DEFAULTS.width,
    position_height: DEFAULTS.height,
    auto_position: true,
  })

  // Padding
  const [paddingConfig, setPaddingConfig] = useState<TextLabsPaddingConfig>({
    top: 0, right: 0, bottom: 0, left: 0,
  })

  const updateConfig = useCallback((field: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [field]: value }))
    setAdvancedModified(true)
  }, [])

  const handleSubmit = useCallback(() => {
    const formData: MetricsFormData = {
      componentType: 'METRICS',
      prompt: contentSource === 'placeholder' ? (prompt || 'Generate placeholder metrics') : prompt,
      count,
      layout,
      advancedModified,
      z_index: DEFAULTS.zIndex,
      metricsConfig: {
        ...config,
        placeholder_mode: contentSource === 'placeholder',
      },
      positionConfig: positionConfig.auto_position ? undefined : positionConfig,
      paddingConfig,
    }
    onSubmit(formData)
  }, [prompt, count, layout, contentSource, config, advancedModified, positionConfig, paddingConfig, onSubmit])

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

      {/* Basic Config */}
      <div className="grid grid-cols-2 gap-3">
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

        {/* Layout */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-300">Layout</label>
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
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                    : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Style Section */}
      <CollapsibleSection title="Style" isOpen={showStyle} onToggle={() => setShowStyle(!showStyle)}>
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
              { value: 'outline', label: 'Outline' },
              { value: 'accent', label: 'Accent' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />
        </div>
      </CollapsibleSection>

      {/* Character Limits */}
      <CollapsibleSection title="Character Limits" isOpen={showCharLimits} onToggle={() => setShowCharLimits(!showCharLimits)}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 font-medium">Value</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Min</label>
                <input
                  type="number"
                  value={config.value_min_chars}
                  min={1}
                  max={config.value_max_chars}
                  onChange={(e) => updateConfig('value_min_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Max</label>
                <input
                  type="number"
                  value={config.value_max_chars}
                  min={config.value_min_chars}
                  max={20}
                  onChange={(e) => updateConfig('value_max_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 font-medium">Label</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Min</label>
                <input
                  type="number"
                  value={config.label_min_chars}
                  min={1}
                  max={config.label_max_chars}
                  onChange={(e) => updateConfig('label_min_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Max</label>
                <input
                  type="number"
                  value={config.label_max_chars}
                  min={config.label_min_chars}
                  max={50}
                  onChange={(e) => updateConfig('label_max_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 font-medium">Description</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Min</label>
                <input
                  type="number"
                  value={config.description_min_chars}
                  min={1}
                  max={config.description_max_chars}
                  onChange={(e) => updateConfig('description_min_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Max</label>
                <input
                  type="number"
                  value={config.description_max_chars}
                  min={config.description_min_chars}
                  max={200}
                  onChange={(e) => updateConfig('description_max_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Font Overrides */}
      <CollapsibleSection title="Font Overrides" isOpen={showFontOverrides} onToggle={() => setShowFontOverrides(!showFontOverrides)}>
        <div className="space-y-4">
          <p className="text-[10px] text-gray-500">Leave as default to use theme fonts</p>
          <FontOverrideSection
            label="Value Font"
            prefix="value"
            config={config as unknown as Record<string, unknown>}
            onChange={updateConfig}
            thirdToggle="allcaps"
          />
          <FontOverrideSection
            label="Label Font"
            prefix="label"
            config={config as unknown as Record<string, unknown>}
            onChange={updateConfig}
            thirdToggle="allcaps"
          />
          <FontOverrideSection
            label="Description Font"
            prefix="desc"
            config={config as unknown as Record<string, unknown>}
            onChange={updateConfig}
            thirdToggle="allcaps"
          />
        </div>
      </CollapsibleSection>

      {/* Position */}
      <CollapsibleSection title="Position" isOpen={showPosition} onToggle={() => setShowPosition(!showPosition)}>
        <PositionPresets
          positionConfig={positionConfig}
          onChange={setPositionConfig}
          elementType="METRICS"
          onAdvancedModified={() => setAdvancedModified(true)}
        />
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

MetricsForm.displayName = 'MetricsForm'

'use client'

import { useState, useCallback, useEffect } from 'react'
import { TextBoxFormData, TextBoxConfig, TextLabsPositionConfig, TextLabsPaddingConfig, TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import { PromptInput } from '../shared/prompt-input'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.TEXT_BOX

const DEFAULT_TEXTBOX_CONFIG: TextBoxConfig = {
  background: 'colored',
  shadow: true,
  corners: 'rounded',
  border: false,
  show_title: true,
  title_style: 'plain',
  list_style: 'bullets',
  color_scheme: 'accent',
  layout: 'horizontal',
  heading_align: 'left',
  content_align: 'left',
  placeholder_mode: false,
  title_min_chars: 20,
  title_max_chars: 30,
  item_min_chars: 30,
  item_max_chars: 40,
  items_per_instance: 3,
  theme_mode: 'light',
  color_variant: null,
  grid_cols: null,
  heading_font_color: null,
  heading_font_size: null,
  heading_font_family: null,
  heading_bold: null,
  heading_italic: null,
  heading_underline: null,
  heading_indent: 0,
  content_font_color: null,
  content_font_size: null,
  content_font_family: null,
  content_bold: null,
  content_italic: null,
  content_underline: null,
  content_indent: 0,
  content_line_height: null,
}

interface TextBoxFormProps {
  onSubmit: (formData: TextBoxFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
}

export function TextBoxForm({ onSubmit, registerSubmit, isGenerating }: TextBoxFormProps) {
  // Basic fields
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(1)
  const [itemsPerInstance, setItemsPerInstance] = useState(3)
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal')
  const [contentSource, setContentSource] = useState<'ai' | 'placeholder'>('ai')

  // Advanced config
  const [config, setConfig] = useState<TextBoxConfig>({ ...DEFAULT_TEXTBOX_CONFIG })
  const [advancedModified, setAdvancedModified] = useState(false)

  // Section visibility
  const [showEssential, setShowEssential] = useState(false)
  const [showFontOverrides, setShowFontOverrides] = useState(false)
  const [showPosition, setShowPosition] = useState(false)

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
    const formData: TextBoxFormData = {
      componentType: 'TEXT_BOX',
      prompt: contentSource === 'placeholder' ? (prompt || 'Generate placeholder text boxes') : prompt,
      count,
      layout,
      advancedModified,
      z_index: DEFAULTS.zIndex,
      itemsPerInstance,
      textboxConfig: {
        ...config,
        placeholder_mode: contentSource === 'placeholder',
        layout,
        items_per_instance: itemsPerInstance,
      },
      positionConfig: positionConfig.auto_position ? undefined : positionConfig,
      paddingConfig,
    }
    onSubmit(formData)
  }, [prompt, count, layout, contentSource, config, advancedModified, itemsPerInstance, positionConfig, paddingConfig, onSubmit])

  // Register submit function with parent so footer Generate button can trigger it
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
          placeholder="e.g., 3 key benefits of cloud computing with icons and descriptions"
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
            {[1, 2, 3, 4, 5, 6].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Items per box */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-300">Items/Box</label>
          <select
            value={itemsPerInstance}
            onChange={(e) => { setItemsPerInstance(Number(e.target.value)); setAdvancedModified(true) }}
            className="w-full px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {Array.from({ length: 14 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Layout */}
      <ToggleRow
        label="Layout"
        field="layout"
        value={layout}
        options={[
          { value: 'horizontal', label: 'Horizontal' },
          { value: 'vertical', label: 'Vertical' },
        ]}
        onChange={(_, v) => setLayout(v as 'horizontal' | 'vertical')}
      />

      {/* Advanced: Essential */}
      <CollapsibleSection
        title="Style"
        isOpen={showEssential}
        onToggle={() => setShowEssential(!showEssential)}
      >
        <div className="space-y-3">
          <ToggleRow
            label="Background"
            field="background"
            value={config.background}
            options={[
              { value: 'colored', label: 'Colored' },
              { value: 'white', label: 'White' },
              { value: 'transparent', label: 'None' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />
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
          <div className="grid grid-cols-2 gap-3">
            <ToggleRow
              label="Shadow"
              field="shadow"
              value={config.shadow ? 'true' : 'false'}
              options={[
                { value: 'true', label: 'On' },
                { value: 'false', label: 'Off' },
              ]}
              onChange={(f, v) => updateConfig(f, v === 'true')}
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
          </div>
          <ToggleRow
            label="Show Title"
            field="show_title"
            value={config.show_title ? 'true' : 'false'}
            options={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
            onChange={(f, v) => updateConfig(f, v === 'true')}
          />
          {config.show_title && (
            <ToggleRow
              label="Title Style"
              field="title_style"
              value={config.title_style}
              options={[
                { value: 'plain', label: 'Plain' },
                { value: 'underline', label: 'Underline' },
                { value: 'bold-line', label: 'Bold Line' },
              ]}
              onChange={(f, v) => updateConfig(f, v)}
            />
          )}
          <ToggleRow
            label="List Style"
            field="list_style"
            value={config.list_style}
            options={[
              { value: 'bullets', label: 'Bullets' },
              { value: 'numbered', label: 'Numbers' },
              { value: 'dashes', label: 'Dashes' },
              { value: 'none', label: 'None' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />
          <ToggleRow
            label="Theme"
            field="theme_mode"
            value={config.theme_mode}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />
          <div className="grid grid-cols-2 gap-3">
            <ToggleRow
              label="Heading Align"
              field="heading_align"
              value={config.heading_align}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' },
              ]}
              onChange={(f, v) => updateConfig(f, v)}
            />
            <ToggleRow
              label="Content Align"
              field="content_align"
              value={config.content_align}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' },
              ]}
              onChange={(f, v) => updateConfig(f, v)}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Advanced: Font Overrides */}
      <CollapsibleSection
        title="Font Overrides"
        isOpen={showFontOverrides}
        onToggle={() => setShowFontOverrides(!showFontOverrides)}
      >
        <div className="space-y-3">
          <p className="text-[10px] text-gray-500">Leave as default to use theme fonts</p>

          {/* Heading Font */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400">Heading Font</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Size</label>
                <select
                  value={config.heading_font_size || ''}
                  onChange={(e) => updateConfig('heading_font_size', e.target.value || null)}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                >
                  <option value="">Auto</option>
                  {['14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '40px', '48px'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Family</label>
                <select
                  value={config.heading_font_family || ''}
                  onChange={(e) => updateConfig('heading_font_family', e.target.value || null)}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                >
                  <option value="">Auto</option>
                  {['Poppins', 'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Source Sans Pro'].map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <label className="text-[10px] text-gray-500">Color</label>
              <input
                type="color"
                value={config.heading_font_color || '#333333'}
                onChange={(e) => updateConfig('heading_font_color', e.target.value)}
                className="h-6 w-6 rounded border border-gray-600 cursor-pointer"
              />
              {config.heading_font_color && (
                <button
                  onClick={() => updateConfig('heading_font_color', null)}
                  className="text-[10px] text-gray-500 hover:text-gray-300"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {[
                { field: 'heading_bold', label: 'B', style: 'font-bold' },
                { field: 'heading_italic', label: 'I', style: 'italic' },
                { field: 'heading_underline', label: 'U', style: 'underline' },
              ].map(({ field, label, style }) => (
                <button
                  key={field}
                  onClick={() => updateConfig(field, config[field as keyof TextBoxConfig] ? null : true)}
                  className={`w-7 h-7 rounded text-xs ${style} transition-colors ${
                    config[field as keyof TextBoxConfig]
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Font */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400">Content Font</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Size</label>
                <select
                  value={config.content_font_size || ''}
                  onChange={(e) => updateConfig('content_font_size', e.target.value || null)}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                >
                  <option value="">Auto</option>
                  {['12px', '14px', '16px', '18px', '20px', '24px', '28px'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Family</label>
                <select
                  value={config.content_font_family || ''}
                  onChange={(e) => updateConfig('content_font_family', e.target.value || null)}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                >
                  <option value="">Auto</option>
                  {['Poppins', 'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Source Sans Pro'].map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <label className="text-[10px] text-gray-500">Color</label>
              <input
                type="color"
                value={config.content_font_color || '#666666'}
                onChange={(e) => updateConfig('content_font_color', e.target.value)}
                className="h-6 w-6 rounded border border-gray-600 cursor-pointer"
              />
              {config.content_font_color && (
                <button
                  onClick={() => updateConfig('content_font_color', null)}
                  className="text-[10px] text-gray-500 hover:text-gray-300"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {[
                { field: 'content_bold', label: 'B', style: 'font-bold' },
                { field: 'content_italic', label: 'I', style: 'italic' },
                { field: 'content_underline', label: 'U', style: 'underline' },
              ].map(({ field, label, style }) => (
                <button
                  key={field}
                  onClick={() => updateConfig(field, config[field as keyof TextBoxConfig] ? null : true)}
                  className={`w-7 h-7 rounded text-xs ${style} transition-colors ${
                    config[field as keyof TextBoxConfig]
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Advanced: Position */}
      <CollapsibleSection
        title="Position"
        isOpen={showPosition}
        onToggle={() => setShowPosition(!showPosition)}
      >
        <div className="space-y-3">
          <ToggleRow
            label="Positioning"
            field="auto_position"
            value={positionConfig.auto_position ? 'auto' : 'manual'}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'manual', label: 'Manual' },
            ]}
            onChange={(_, v) => {
              setPositionConfig(prev => ({ ...prev, auto_position: v === 'auto' }))
              setAdvancedModified(true)
            }}
          />
          {!positionConfig.auto_position && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Col', field: 'start_col' as const, min: 1, max: 32 },
                { label: 'Row', field: 'start_row' as const, min: 1, max: 18 },
                { label: 'Width', field: 'position_width' as const, min: 1, max: 32 },
                { label: 'Height', field: 'position_height' as const, min: 1, max: 18 },
              ].map(({ label, field, min, max }) => (
                <div key={field} className="space-y-1">
                  <label className="text-[10px] text-gray-500">{label}</label>
                  <input
                    type="number"
                    value={positionConfig[field]}
                    min={min}
                    max={max}
                    onChange={(e) => {
                      setPositionConfig(prev => ({ ...prev, [field]: Number(e.target.value) }))
                      setAdvancedModified(true)
                    }}
                    className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  )
}

TextBoxForm.displayName = 'TextBoxForm'

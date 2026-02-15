'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { TextBoxFormData, TextBoxConfig, TextLabsPositionConfig, TextLabsPaddingConfig, TEXT_LABS_ELEMENT_DEFAULTS, recalcTextBoxLimits } from '@/types/textlabs'
import { ElementContext } from '../types'
import { PromptInput } from '../shared/prompt-input'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'
import { FontOverrideSection } from '../shared/font-override-section'
import { PositionPresets } from '../shared/position-presets'
import { PaddingControl } from '../shared/padding-control'
import { ZIndexInput } from '../shared/z-index-input'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.TEXT_BOX

const COLOR_VARIANT_PRESETS = [
  { name: 'purple', label: 'Purple', hex: '#E8D7F1' },
  { name: 'blue', label: 'Blue', hex: '#B4DCFF' },
  { name: 'green', label: 'Green', hex: '#B4F5D2' },
  { name: 'red', label: 'Red', hex: '#FFC8C3' },
  { name: 'cyan', label: 'Cyan', hex: '#B2EBF2' },
  { name: 'orange', label: 'Orange', hex: '#FFCCBC' },
  { name: 'pink', label: 'Pink', hex: '#F8BBD9' },
  { name: 'yellow', label: 'Yellow', hex: '#FFF0BE' },
  { name: 'teal', label: 'Teal', hex: '#B2DFDB' },
  { name: 'indigo', label: 'Indigo', hex: '#D1D9FF' },
] as const

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
  elementContext?: ElementContext | null
}

export function TextBoxForm({ onSubmit, registerSubmit, isGenerating, elementContext }: TextBoxFormProps) {
  // Basic fields
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(1)
  const [layout, setLayout] = useState<'horizontal' | 'vertical' | 'grid'>('horizontal')
  const [gridCols, setGridCols] = useState(2)
  const [contentSource, setContentSource] = useState<'ai' | 'placeholder'>('ai')

  // Advanced config
  const [config, setConfig] = useState<TextBoxConfig>({ ...DEFAULT_TEXTBOX_CONFIG })
  const [advancedModified, setAdvancedModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)

  // Section visibility
  const [showInstances, setShowInstances] = useState(false)
  const [showBoxDesign, setShowBoxDesign] = useState(false)
  const [showHeading, setShowHeading] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const [showPositioning, setShowPositioning] = useState(false)
  const [showPadding, setShowPadding] = useState(false)

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

  // Computed text box limits
  const calcLimits = useMemo(() => recalcTextBoxLimits({
    position_width: positionConfig.position_width,
    position_height: positionConfig.position_height,
    count,
    layout,
    grid_cols: layout === 'grid' ? gridCols : null,
    padding_left: paddingConfig.left,
    padding_right: paddingConfig.right,
    padding_top: paddingConfig.top,
    padding_bottom: paddingConfig.bottom,
    heading_font_size: config.heading_font_size,
    content_font_size: config.content_font_size,
    heading_indent: config.heading_indent,
    content_indent: config.content_indent,
    content_line_height: config.content_line_height,
  }), [positionConfig.position_width, positionConfig.position_height, count, layout, gridCols, paddingConfig, config.heading_font_size, config.content_font_size, config.heading_indent, config.content_indent, config.content_line_height])

  // Sync calculated limits into config
  useEffect(() => {
    setConfig(prev => ({
      ...prev,
      title_min_chars: calcLimits.title_min_chars,
      title_max_chars: calcLimits.title_max_chars,
      item_min_chars: calcLimits.item_min_chars,
      item_max_chars: calcLimits.item_max_chars,
      items_per_instance: calcLimits.items_per_instance,
    }))
  }, [calcLimits])

  const handleSubmit = useCallback(() => {
    const formData: TextBoxFormData = {
      componentType: 'TEXT_BOX',
      prompt: contentSource === 'placeholder' ? (prompt || 'Generate placeholder text boxes') : prompt,
      count,
      layout,
      advancedModified,
      z_index: zIndex,
      itemsPerInstance: config.items_per_instance,
      textboxConfig: {
        ...config,
        placeholder_mode: contentSource === 'placeholder',
        layout,
        items_per_instance: config.items_per_instance,
        grid_cols: layout === 'grid' ? gridCols : null,
      },
      positionConfig: positionConfig.auto_position ? undefined : positionConfig,
      paddingConfig,
    }
    onSubmit(formData)
  }, [prompt, count, layout, gridCols, contentSource, config, advancedModified, zIndex, positionConfig, paddingConfig, onSubmit])

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

      {/* Section 1: Instances */}
      <CollapsibleSection
        title="Instances"
        isOpen={showInstances}
        onToggle={() => setShowInstances(!showInstances)}
      >
        <div className="space-y-3">
          {/* Count */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Count</label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {[1, 2, 3, 4, 5, 6].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Layout */}
          <ToggleRow
            label="Layout"
            field="layout"
            value={layout}
            options={[
              { value: 'horizontal', label: 'H' },
              { value: 'vertical', label: 'V' },
              { value: 'grid', label: 'G' },
            ]}
            onChange={(_, v) => setLayout(v as 'horizontal' | 'vertical' | 'grid')}
          />

          {/* Grid Columns (visible when layout=grid) */}
          {layout === 'grid' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Grid Columns</label>
              <select
                value={gridCols}
                onChange={(e) => { setGridCols(Number(e.target.value)); setAdvancedModified(true) }}
                className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {[2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 2: Box Design */}
      <CollapsibleSection
        title="Box Design"
        isOpen={showBoxDesign}
        onToggle={() => setShowBoxDesign(!showBoxDesign)}
      >
        <div className="space-y-3">
          <ToggleRow
            label="Background"
            field="background"
            value={config.background}
            options={[
              { value: 'colored', label: 'Pastel' },
              { value: 'transparent', label: 'Trans' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />

          {/* Color Variant (disabled when bg=transparent) */}
          {config.background === 'colored' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Box Color</label>
              <div className="flex flex-wrap gap-1.5">
                {/* Auto swatch — rainbow gradient */}
                <button
                  onClick={() => updateConfig('color_variant', null)}
                  style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
                  className={`h-7 w-7 rounded-full border transition-all ${
                    config.color_variant === null
                      ? 'ring-2 ring-purple-500 ring-offset-1'
                      : 'border-gray-200 hover:scale-110'
                  }`}
                  title="Auto"
                />
                {/* 10 named preset swatches */}
                {COLOR_VARIANT_PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => updateConfig('color_variant', preset.name)}
                    style={{ backgroundColor: preset.hex }}
                    className={`h-7 w-7 rounded-full border transition-all ${
                      config.color_variant === preset.name
                        ? 'ring-2 ring-purple-500 ring-offset-1'
                        : 'border-gray-200 hover:scale-110'
                    }`}
                    title={preset.label}
                  />
                ))}
              </div>
              {config.color_variant && (
                <span className="text-[10px] text-gray-400 capitalize">{config.color_variant}</span>
              )}
            </div>
          )}

          <ToggleRow
            label="Corners"
            field="corners"
            value={config.corners}
            options={[
              { value: 'rounded', label: 'Rnd' },
              { value: 'square', label: 'Sqr' },
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
            label="Theme"
            field="theme_mode"
            value={config.theme_mode}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />
        </div>
      </CollapsibleSection>

      {/* Section 3: Heading */}
      <CollapsibleSection
        title="Heading"
        isOpen={showHeading}
        onToggle={() => setShowHeading(!showHeading)}
      >
        <div className="space-y-3">
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
            <>
              <ToggleRow
                label="Title Style"
                field="title_style"
                value={config.title_style}
                options={[
                  { value: 'plain', label: 'Plain' },
                  { value: 'underline', label: 'Underline' },
                ]}
                onChange={(f, v) => updateConfig(f, v)}
              />
              <ToggleRow
                label="Heading Align"
                field="heading_align"
                value={config.heading_align}
                options={[
                  { value: 'left', label: 'L' },
                  { value: 'center', label: 'C' },
                  { value: 'right', label: 'R' },
                ]}
                onChange={(f, v) => updateConfig(f, v)}
              />
              {/* Heading Indent */}
              <ToggleRow
                label="Head Indent"
                field="heading_indent"
                value={String(config.heading_indent)}
                options={[
                  { value: '0', label: '0' },
                  { value: '1', label: '1' },
                  { value: '2', label: '2' },
                  { value: '3', label: '3' },
                ]}
                onChange={(_, v) => updateConfig('heading_indent', Number(v))}
              />
              {/* Title Char Limits (auto-calculated) */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-medium">Title Char Limits (auto-calculated)</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400">Min</label>
                    <input
                      type="number"
                      value={config.title_min_chars}
                      readOnly
                      className="w-full px-2 py-1 rounded bg-gray-100 border border-gray-200 text-xs text-gray-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400">Max</label>
                    <input
                      type="number"
                      value={config.title_max_chars}
                      readOnly
                      className="w-full px-2 py-1 rounded bg-gray-100 border border-gray-200 text-xs text-gray-500"
                    />
                  </div>
                </div>
              </div>
              {/* Heading Font Overrides */}
              <FontOverrideSection
                label="Heading Font"
                prefix="heading"
                config={config as unknown as Record<string, unknown>}
                onChange={updateConfig}
                thirdToggle="underline"
              />
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 4: Content */}
      <CollapsibleSection
        title="Content"
        isOpen={showContent}
        onToggle={() => setShowContent(!showContent)}
      >
        <div className="space-y-3">
          {/* Items per box */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Items/Box (auto: {calcLimits.items_per_instance})</label>
            <select
              value={config.items_per_instance}
              onChange={(e) => updateConfig('items_per_instance', Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {Array.from({ length: 14 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <ToggleRow
            label="List Style"
            field="list_style"
            value={config.list_style}
            options={[
              { value: 'bullets', label: 'Bullets' },
              { value: 'numbered', label: 'Numbers' },
              { value: 'plain', label: 'Plain' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />

          <ToggleRow
            label="Content Align"
            field="content_align"
            value={config.content_align}
            options={[
              { value: 'left', label: 'L' },
              { value: 'center', label: 'C' },
              { value: 'right', label: 'R' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />

          {/* Content Indent */}
          <ToggleRow
            label="Content Indent"
            field="content_indent"
            value={String(config.content_indent)}
            options={[
              { value: '0', label: '0' },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
            onChange={(_, v) => updateConfig('content_indent', Number(v))}
          />

          {/* Line Spacing */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Line Spacing</label>
            <select
              value={config.content_line_height || 'auto'}
              onChange={(e) => updateConfig('content_line_height', e.target.value === 'auto' ? null : e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="auto">Auto</option>
              {['1.0', '1.2', '1.4', '1.5', '1.6', '1.8', '2.0', '2.2', '2.5'].map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Item Char Limits (auto-calculated) */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 font-medium">Item Char Limits (auto-calculated)</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Min</label>
                <input
                  type="number"
                  value={config.item_min_chars}
                  readOnly
                  className="w-full px-2 py-1 rounded bg-gray-100 border border-gray-200 text-xs text-gray-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Max</label>
                <input
                  type="number"
                  value={config.item_max_chars}
                  readOnly
                  className="w-full px-2 py-1 rounded bg-gray-100 border border-gray-200 text-xs text-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Content Font Overrides */}
          <FontOverrideSection
            label="Content Font"
            prefix="content"
            config={config as unknown as Record<string, unknown>}
            onChange={updateConfig}
            thirdToggle="underline"
          />
        </div>
      </CollapsibleSection>

      {/* Section 5: Positioning */}
      <CollapsibleSection
        title="Positioning"
        isOpen={showPositioning}
        onToggle={() => setShowPositioning(!showPositioning)}
      >
        <div className="space-y-4">
          <PositionPresets
            positionConfig={positionConfig}
            onChange={setPositionConfig}
            elementType="TEXT_BOX"
            onAdvancedModified={() => setAdvancedModified(true)}
          />

          <ZIndexInput
            value={zIndex}
            onChange={setZIndex}
            onAdvancedModified={() => setAdvancedModified(true)}
          />
        </div>
      </CollapsibleSection>

      {/* Section 6: Container Padding */}
      <CollapsibleSection
        title="Container Padding"
        isOpen={showPadding}
        onToggle={() => setShowPadding(!showPadding)}
      >
        <PaddingControl
          paddingConfig={paddingConfig}
          onChange={setPaddingConfig}
          onAdvancedModified={() => setAdvancedModified(true)}
        />
      </CollapsibleSection>
    </div>
  )
}

TextBoxForm.displayName = 'TextBoxForm'

'use client'

import { useState, useCallback, useEffect } from 'react'
import { TableFormData, TableConfig, TextLabsPositionConfig, TextLabsPaddingConfig, TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import { PromptInput } from '../shared/prompt-input'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'
import { FontOverrideSection } from '../shared/font-override-section'
import { PositionPresets } from '../shared/position-presets'
import { PaddingControl } from '../shared/padding-control'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.TABLE

const DEFAULT_TABLE_CONFIG: TableConfig = {
  columns: 4,
  rows: 5,
  stripe_rows: true,
  corners: 'square',
  header_style: 'solid',
  alignment: 'left',
  border_style: 'light',
  header_color: null,
  first_column_bold: false,
  last_column_bold: false,
  show_total_row: false,
  col_balance: 'descriptive',
  placeholder_mode: false,
  header_min_chars: 5,
  header_max_chars: 25,
  cell_min_chars: 10,
  cell_max_chars: 50,
  // Header font overrides
  header_font_color: null,
  header_font_size: null,
  header_font_family: null,
  header_bold: null,
  header_italic: null,
  header_allcaps: null,
  // Cell font overrides
  cell_font_color: null,
  cell_font_size: null,
  cell_font_family: null,
  cell_bold: null,
  cell_italic: null,
  cell_allcaps: null,
}

interface TableFormProps {
  onSubmit: (formData: TableFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
}

export function TableForm({ onSubmit, registerSubmit, isGenerating }: TableFormProps) {
  // Basic fields
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(1)
  const [columns, setColumns] = useState(4)
  const [rows, setRows] = useState(5)
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal')
  const [contentSource, setContentSource] = useState<'ai' | 'placeholder'>('ai')

  // Advanced config
  const [config, setConfig] = useState<TableConfig>({ ...DEFAULT_TABLE_CONFIG })
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
    const formData: TableFormData = {
      componentType: 'TABLE',
      prompt: contentSource === 'placeholder' ? (prompt || 'Generate a placeholder table') : prompt,
      count,
      layout,
      advancedModified,
      z_index: DEFAULTS.zIndex,
      tableConfig: {
        ...config,
        columns,
        rows,
        placeholder_mode: contentSource === 'placeholder',
      },
      positionConfig: positionConfig.auto_position ? undefined : positionConfig,
      paddingConfig,
    }
    onSubmit(formData)
  }, [prompt, count, columns, rows, layout, contentSource, config, advancedModified, positionConfig, paddingConfig, onSubmit])

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
          placeholder="e.g., Comparison table of cloud providers AWS, Azure, GCP across pricing, features, and support"
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
            {[1, 2].map(n => (
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

      {/* Columns & Rows */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-300">Columns</label>
          <select
            value={columns}
            onChange={(e) => { setColumns(Number(e.target.value)); setAdvancedModified(true) }}
            className="w-full px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {[2, 3, 4, 5, 6].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-300">Rows</label>
          <select
            value={rows}
            onChange={(e) => { setRows(Number(e.target.value)); setAdvancedModified(true) }}
            className="w-full px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Style Section */}
      <CollapsibleSection title="Style" isOpen={showStyle} onToggle={() => setShowStyle(!showStyle)}>
        <div className="space-y-3">
          <ToggleRow
            label="Stripe Rows"
            field="stripe_rows"
            value={config.stripe_rows ? 'true' : 'false'}
            options={[
              { value: 'true', label: 'On' },
              { value: 'false', label: 'Off' },
            ]}
            onChange={(f, v) => updateConfig(f, v === 'true')}
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
          <ToggleRow
            label="Header Style"
            field="header_style"
            value={config.header_style}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'gradient', label: 'Gradient' },
              { value: 'outline', label: 'Outline' },
              { value: 'minimal', label: 'Minimal' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
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
            label="Border Style"
            field="border_style"
            value={config.border_style}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'medium', label: 'Medium' },
              { value: 'heavy', label: 'Heavy' },
              { value: 'none', label: 'None' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />
          <ToggleRow
            label="Column Balance"
            field="col_balance"
            value={config.col_balance}
            options={[
              { value: 'descriptive', label: 'Descriptive' },
              { value: 'equal', label: 'Equal' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />

          {/* Header Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Header Color</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={config.header_color || '#4A5568'}
                onChange={(e) => updateConfig('header_color', e.target.value)}
                className="h-7 w-7 rounded border border-gray-600 cursor-pointer"
              />
              <span className="text-[10px] text-gray-500">{config.header_color || 'Auto'}</span>
              {config.header_color && (
                <button
                  onClick={() => updateConfig('header_color', null)}
                  className="text-[10px] text-gray-500 hover:text-gray-300"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Boolean toggles */}
          <div className="grid grid-cols-2 gap-3">
            <ToggleRow
              label="First Col Bold"
              field="first_column_bold"
              value={config.first_column_bold ? 'true' : 'false'}
              options={[
                { value: 'true', label: 'On' },
                { value: 'false', label: 'Off' },
              ]}
              onChange={(f, v) => updateConfig(f, v === 'true')}
            />
            <ToggleRow
              label="Last Col Bold"
              field="last_column_bold"
              value={config.last_column_bold ? 'true' : 'false'}
              options={[
                { value: 'true', label: 'On' },
                { value: 'false', label: 'Off' },
              ]}
              onChange={(f, v) => updateConfig(f, v === 'true')}
            />
          </div>
          <ToggleRow
            label="Total Row"
            field="show_total_row"
            value={config.show_total_row ? 'true' : 'false'}
            options={[
              { value: 'true', label: 'Show' },
              { value: 'false', label: 'Hide' },
            ]}
            onChange={(f, v) => updateConfig(f, v === 'true')}
          />
        </div>
      </CollapsibleSection>

      {/* Character Limits */}
      <CollapsibleSection title="Character Limits" isOpen={showCharLimits} onToggle={() => setShowCharLimits(!showCharLimits)}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 font-medium">Header</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Min</label>
                <input
                  type="number"
                  value={config.header_min_chars}
                  min={1}
                  max={config.header_max_chars}
                  onChange={(e) => updateConfig('header_min_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Max</label>
                <input
                  type="number"
                  value={config.header_max_chars}
                  min={config.header_min_chars}
                  max={60}
                  onChange={(e) => updateConfig('header_max_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 font-medium">Cell</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Min</label>
                <input
                  type="number"
                  value={config.cell_min_chars}
                  min={1}
                  max={config.cell_max_chars}
                  onChange={(e) => updateConfig('cell_min_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500">Max</label>
                <input
                  type="number"
                  value={config.cell_max_chars}
                  min={config.cell_min_chars}
                  max={100}
                  onChange={(e) => updateConfig('cell_max_chars', Number(e.target.value))}
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
            label="Header Font"
            prefix="header"
            config={config as unknown as Record<string, unknown>}
            onChange={updateConfig}
            thirdToggle="allcaps"
          />
          <FontOverrideSection
            label="Cell Font"
            prefix="cell"
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
          elementType="TABLE"
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

TableForm.displayName = 'TableForm'

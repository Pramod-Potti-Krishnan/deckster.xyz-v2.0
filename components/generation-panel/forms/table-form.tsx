'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { TableFormData, TableConfig, TextLabsPositionConfig, TextLabsPaddingConfig, TEXT_LABS_ELEMENT_DEFAULTS, GRID_CELL_SIZE } from '@/types/textlabs'
import { ElementContext, MandatoryConfig } from '../types'
import { ToggleRow } from '../shared/toggle-row'
import { CollapsibleSection } from '../shared/collapsible-section'
import { FontOverrideSection } from '../shared/font-override-section'
import { PositionPresets } from '../shared/position-presets'
import { PaddingControl } from '../shared/padding-control'
import { ZIndexInput } from '../shared/z-index-input'

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
  column_widths: [],
  placeholder_mode: false,
  header_min_chars: 5,
  header_max_chars: 25,
  cell_min_chars: 10,
  cell_max_chars: 50,
  header_font_color: null,
  header_font_size: null,
  header_font_family: null,
  header_bold: null,
  header_italic: null,
  header_allcaps: null,
  cell_font_color: null,
  cell_font_size: null,
  cell_font_family: null,
  cell_bold: null,
  cell_italic: null,
  cell_allcaps: null,
}

/**
 * Rebuild column width inputs: distribute available width among columns.
 * descriptive = first col gets more, data = equal distribution.
 */
function rebuildColumnWidths(
  columns: number,
  positionWidth: number,
  colBalance: 'descriptive' | 'data'
): number[] {
  const totalPx = positionWidth * GRID_CELL_SIZE
  if (colBalance === 'data') {
    const minFirstPct = Math.max(10, Math.floor(100 / (columns * 2)))
    const restPct = Math.floor((100 - minFirstPct) / Math.max(1, columns - 1))
    const widths = [minFirstPct]
    for (let i = 1; i < columns; i++) widths.push(restPct)
    widths[widths.length - 1] += 100 - widths.reduce((a, b) => a + b, 0)
    return widths
  }
  // descriptive: first column gets 40%, rest split evenly
  const firstPct = Math.min(40, Math.floor(100 * 0.4))
  const restPct = Math.floor((100 - firstPct) / Math.max(1, columns - 1))
  const widths = [firstPct]
  for (let i = 1; i < columns; i++) {
    widths.push(restPct)
  }
  // absorb remainder into last column
  const sum = widths.reduce((a, b) => a + b, 0)
  widths[widths.length - 1] += 100 - sum
  return widths
}

interface TableFormProps {
  onSubmit: (formData: TableFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig) => void
}

export function TableForm({ onSubmit, registerSubmit, isGenerating, elementContext, prompt, showAdvanced, registerMandatoryConfig }: TableFormProps) {
  const [count, setCount] = useState(1)
  const [columns, setColumns] = useState(4)
  const [rows, setRows] = useState(5)
  const [contentSource, setContentSource] = useState<'ai' | 'placeholder'>('ai')

  const [config, setConfig] = useState<TableConfig>({ ...DEFAULT_TABLE_CONFIG })
  const [advancedModified, setAdvancedModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)

  // Section visibility
  const [showStructure, setShowStructure] = useState(false)
  const [showStyling, setShowStyling] = useState(false)
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

  // Column widths (auto-distributed)
  const [columnWidths, setColumnWidths] = useState<number[]>(() =>
    rebuildColumnWidths(4, DEFAULTS.width, 'descriptive')
  )

  // Recalculate column widths when columns/position/balance changes
  const autoWidths = useMemo(() =>
    rebuildColumnWidths(columns, positionConfig.position_width, config.col_balance as 'descriptive' | 'data'),
    [columns, positionConfig.position_width, config.col_balance]
  )

  useEffect(() => {
    setColumnWidths(autoWidths)
  }, [autoWidths])

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

  // Register mandatory config — Header Style
  const headerStyleLabel = { solid: 'Solid', minimal: 'Minimal', accent: 'Accent' }[config.header_style] || 'Solid'

  useEffect(() => {
    registerMandatoryConfig({
      fieldLabel: 'Header Style',
      displayLabel: headerStyleLabel,
      options: [
        { value: 'solid', label: 'Solid' },
        { value: 'minimal', label: 'Minimal' },
        { value: 'accent', label: 'Accent' },
      ],
      onChange: (v) => updateConfig('header_style', v),
      promptPlaceholder: 'e.g., Comparison table of cloud providers AWS, Azure, GCP across pricing, features, and support',
    })
  }, [config.header_style, headerStyleLabel, registerMandatoryConfig, updateConfig])

  const handleSubmit = useCallback(() => {
    const formData: TableFormData = {
      componentType: 'TABLE',
      prompt: contentSource === 'placeholder' ? (prompt || 'Generate a placeholder table') : prompt,
      count,
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      tableConfig: {
        ...config,
        columns,
        rows,
        column_widths: columnWidths,
        placeholder_mode: contentSource === 'placeholder',
      },
      positionConfig: positionConfig.auto_position ? undefined : positionConfig,
      paddingConfig,
    }
    onSubmit(formData)
  }, [prompt, count, columns, rows, contentSource, config, columnWidths, advancedModified, zIndex, positionConfig, paddingConfig, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  return (
    <div className="space-y-2.5">
      {showAdvanced && (<>
      {/* Section 1: Structure */}
      <CollapsibleSection title="Structure" isOpen={showStructure} onToggle={() => setShowStructure(!showStructure)}>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-600">Columns</label>
              <select
                value={columns}
                onChange={(e) => { setColumns(Number(e.target.value)); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-600">Rows</label>
              <select
                value={rows}
                onChange={(e) => { setRows(Number(e.target.value)); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-600">Count</label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full px-2 py-1 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[1, 2].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <ToggleRow
            label="Column Balance"
            field="col_balance"
            value={config.col_balance}
            options={[
              { value: 'descriptive', label: 'Descriptive' },
              { value: 'data', label: 'Data' },
            ]}
            onChange={(f, v) => updateConfig(f, v)}
          />

          {/* Column Widths */}
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 font-medium">Column Widths (%)</label>
            <div className="grid grid-cols-3 gap-1">
              {columnWidths.map((w, i) => (
                <div key={i} className="space-y-0.5">
                  <label className="text-[9px] text-gray-600">Col {i + 1}</label>
                  <input
                    type="number"
                    value={w}
                    min={5}
                    max={80}
                    onChange={(e) => {
                      const newWidths = [...columnWidths]
                      newWidths[i] = Number(e.target.value)
                      setColumnWidths(newWidths)
                      setAdvancedModified(true)
                    }}
                    className="w-full px-1.5 py-0.5 rounded bg-gray-50 border border-gray-300 text-[10px] text-gray-900"
                  />
                </div>
              ))}
            </div>
            <div className="text-[10px] text-gray-400">
              Total: {columnWidths.reduce((a, b) => a + b, 0)}% / {positionConfig.position_width} grids
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
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

      {/* Section 2: Styling */}
      <CollapsibleSection title="Styling" isOpen={showStyling} onToggle={() => setShowStyling(!showStyling)}>
        <div className="space-y-2">
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

          {/* Header Color */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600">Header Color</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={config.header_color || '#4A5568'}
                onChange={(e) => updateConfig('header_color', e.target.value)}
                className="h-6 w-6 rounded border border-gray-300 cursor-pointer"
              />
              <span className="text-[10px] text-gray-400">{config.header_color || 'Auto'}</span>
              {config.header_color && (
                <button
                  onClick={() => updateConfig('header_color', null)}
                  className="text-[10px] text-gray-400 hover:text-gray-700"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Header char limits + font */}
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 font-medium">Header Char Limits</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Min</label>
                <input type="number" value={config.header_min_chars} min={1} max={config.header_max_chars}
                  onChange={(e) => updateConfig('header_min_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Max</label>
                <input type="number" value={config.header_max_chars} min={config.header_min_chars} max={60}
                  onChange={(e) => updateConfig('header_max_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900" />
              </div>
            </div>
          </div>
          <FontOverrideSection label="Header Font" prefix="header" config={config as unknown as Record<string, unknown>} onChange={updateConfig} thirdToggle="allcaps" />

          {/* Cell char limits + font */}
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 font-medium">Cell Char Limits</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Min</label>
                <input type="number" value={config.cell_min_chars} min={1} max={config.cell_max_chars}
                  onChange={(e) => updateConfig('cell_min_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400">Max</label>
                <input type="number" value={config.cell_max_chars} min={config.cell_min_chars} max={100}
                  onChange={(e) => updateConfig('cell_max_chars', Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900" />
              </div>
            </div>
          </div>
          <FontOverrideSection label="Cell Font" prefix="cell" config={config as unknown as Record<string, unknown>} onChange={updateConfig} thirdToggle="allcaps" />
        </div>
      </CollapsibleSection>

      {/* Section 3: Positioning */}
      <CollapsibleSection title="Positioning" isOpen={showPositioning} onToggle={() => setShowPositioning(!showPositioning)}>
        <div className="space-y-2.5">
          <PositionPresets
            positionConfig={positionConfig}
            onChange={setPositionConfig}
            elementType="TABLE"
            onAdvancedModified={() => setAdvancedModified(true)}
          />
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
      </>)}
    </div>
  )
}

TableForm.displayName = 'TableForm'

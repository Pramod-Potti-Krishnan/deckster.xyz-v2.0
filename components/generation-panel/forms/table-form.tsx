'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import type {
  TableCellMark,
  TableColumnBrief,
  TableColumnConfig,
  TableColumnKind,
  TableConfig,
  TableFormData,
  TableStructureMode,
  TextLabsPaddingConfig,
  TextLabsPositionConfig,
} from '@/types/textlabs'
import { TEXT_LABS_ELEMENT_DEFAULTS } from '@/types/textlabs'
import type { ElementContext, GenerationPanelDraft, MandatoryConfig } from '../types'
import { CollapsibleSection } from '../shared/collapsible-section'
import { PositionPresets } from '../shared/position-presets'
import { PaddingControl } from '../shared/padding-control'
import { ZIndexInput } from '../shared/z-index-input'
import { ThemeSourceSelector } from '../shared/theme-source-selector'
import { useThemeSourceState } from '../shared/use-theme-source-state'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.TABLE
const COLUMN_KINDS: TableColumnKind[] = [
  'label', 'tag', 'numeric', 'currency', 'percent', 'status', 'single_line', 'multi_line', 'bullets',
]

interface TableFormProps {
  onSubmit: (formData: TableFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  presentationId?: string | null
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig | null) => void
  researchControls?: ReactNode
  initialDraft?: GenerationPanelDraft | null
  onDraftChange?: (draft: Partial<GenerationPanelDraft>) => void
}

function OptionalSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string | undefined) => void
}) {
  return (
    <label className="min-w-0 space-y-1">
      <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={event => onChange(event.target.value || undefined)}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        <option value="">Auto</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function OptionalTextInput({
  label,
  value,
  placeholder = 'Auto',
  onChange,
}: {
  label: string
  value?: string | null
  placeholder?: string
  onChange: (value: string | undefined) => void
}) {
  return (
    <label className="min-w-0 space-y-1">
      <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <input
        value={value ?? ''}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value || undefined)}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
    </label>
  )
}

function OptionalBooleanSelect({
  label,
  value,
  onChange,
  onLabel = 'On',
  offLabel = 'Off',
}: {
  label: string
  value?: boolean | null
  onChange: (value: boolean | undefined) => void
  onLabel?: string
  offLabel?: string
}) {
  return (
    <OptionalSelect
      label={label}
      value={value === undefined || value === null ? '' : value ? 'on' : 'off'}
      onChange={next => onChange(next === undefined ? undefined : next === 'on')}
      options={[{ value: 'on', label: onLabel }, { value: 'off', label: offLabel }]}
    />
  )
}

function OptionalNumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value?: number
  min: number
  max: number
  onChange: (value: number | undefined) => void
}) {
  return (
    <label className="min-w-0 space-y-1">
      <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        placeholder="Auto"
        onChange={event => onChange(event.target.value ? Number(event.target.value) : undefined)}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
    </label>
  )
}

function makeColumnBrief(index: number): TableColumnBrief {
  return {
    index,
    name: `Column ${index}`,
    kind: index === 1 ? 'label' : 'single_line',
    detail: index === 1 ? 'Concise row label' : 'One grounded value per row',
    target_len: index === 1 ? 'short' : 'medium',
  }
}

function makeColumnConfig(col: number): TableColumnConfig {
  return { col }
}

export function TableForm({
  onSubmit,
  registerSubmit,
  isGenerating,
  presentationId,
  elementContext,
  prompt,
  showAdvanced,
  registerMandatoryConfig,
  researchControls,
  initialDraft,
  onDraftChange,
}: TableFormProps) {
  const initialTableFormData = initialDraft?.formData?.componentType === 'TABLE' ? initialDraft.formData : null
  const initialTableConfig: Partial<TableConfig> = initialTableFormData?.tableConfig ?? {}
  const initialPatch = useMemo<Partial<TableConfig>>(() => {
    const {
      structure_mode: _structureMode,
      rows: _rows,
      columns: _columns,
      column_brief: _columnBrief,
      cell_marks: _cellMarks,
      ...rest
    } = initialTableConfig
    return { ...rest }
  }, [initialTableConfig])
  const [structureMode, setStructureMode] = useState<TableStructureMode>(() => initialTableConfig.structure_mode ?? (initialTableConfig.rows || initialTableConfig.columns ? 'MANUAL' : 'AUTO'))
  const [rows, setRows] = useState(() => initialTableConfig.rows ?? 5)
  const [columns, setColumns] = useState(() => initialTableConfig.columns ?? 4)
  const [count, setCount] = useState(() => initialTableFormData?.count ?? 1)
  const [patch, setPatch] = useState<Partial<TableConfig>>(() => initialPatch)
  const [columnBrief, setColumnBrief] = useState<TableColumnBrief[]>(() => initialTableConfig.column_brief ?? [])
  const [cellMarks, setCellMarks] = useState<TableCellMark[]>(() => initialTableConfig.cell_marks ?? [])
  const [markDraft, setMarkDraft] = useState<TableCellMark>({ row: 1, col: 1, mark: 'highlight', style: 'chip' })
  const [zIndex, setZIndex] = useState(() => initialTableFormData?.z_index ?? DEFAULTS.zIndex)
  const [zIndexModified, setZIndexModified] = useState(() => initialTableFormData?.z_index !== undefined)
  const [positionModified, setPositionModified] = useState(() => Boolean(initialTableFormData?.positionConfig))
  const [paddingModified, setPaddingModified] = useState(() => Boolean(initialTableFormData?.paddingConfig))
  const [showSchema, setShowSchema] = useState(false)
  const [showBehavior, setShowBehavior] = useState(false)
  const [showTypography, setShowTypography] = useState(false)
  const [showPositioning, setShowPositioning] = useState(false)
  const [showPadding, setShowPadding] = useState(false)
  const { themeSource, updateThemeSource, useDeckTheme, themeOverrides } = useThemeSourceState(presentationId)

  const [positionConfig, setPositionConfig] = useState<TextLabsPositionConfig>(() => initialTableFormData?.positionConfig ?? {
    start_col: 2,
    start_row: 4,
    position_width: DEFAULTS.width,
    position_height: DEFAULTS.height,
    auto_position: false,
  })
  const [paddingConfig, setPaddingConfig] = useState<TextLabsPaddingConfig>(() => initialTableFormData?.paddingConfig ?? { top: 0, right: 0, bottom: 0, left: 0 })

  useEffect(() => registerMandatoryConfig(null), [registerMandatoryConfig])

  useEffect(() => {
    if (!elementContext) return
    setPositionConfig(previous => ({
      ...previous,
      start_col: elementContext.startCol,
      start_row: elementContext.startRow,
      position_width: elementContext.width,
      position_height: elementContext.height,
    }))
  }, [elementContext])

  const updatePatch = useCallback(<K extends keyof TableConfig>(field: K, value: TableConfig[K] | undefined) => {
    setPatch(previous => {
      const next = { ...previous }
      if (value === undefined || value === null || value === '') delete next[field]
      else next[field] = value
      return next
    })
  }, [])

  const updateBrief = useCallback((index: number, updates: Partial<TableColumnBrief>) => {
    setColumnBrief(previous => previous.map(column => column.index === index ? { ...column, ...updates } : column))
  }, [])

  const updateColumnConfig = useCallback((col: number, updates: Partial<TableColumnConfig>) => {
    setPatch(previous => {
      const current = previous.column_config?.length
        ? previous.column_config
        : Array.from({ length: columns }, (_, index) => makeColumnConfig(index + 1))
      const next = current
        .filter(config => config.col <= columns)
        .map(config => config.col === col ? { ...config, ...updates } : config)
      return { ...previous, column_config: next }
    })
  }, [columns])

  const ensureColumnConfig = useCallback(() => {
    setPatch(previous => previous.column_config?.length
      ? previous
      : { ...previous, column_config: Array.from({ length: columns }, (_, index) => makeColumnConfig(index + 1)) })
  }, [columns])

  const ensureBrief = useCallback(() => {
    setColumnBrief(previous => previous.length
      ? previous.slice(0, columns)
      : Array.from({ length: columns }, (_, index) => makeColumnBrief(index + 1)))
  }, [columns])

  useEffect(() => {
    setColumnBrief(previous => previous.filter(column => column.index <= columns))
    setCellMarks(previous => previous.filter(mark => mark.row <= rows && mark.col <= columns))
    setMarkDraft(previous => ({ ...previous, row: Math.min(previous.row, rows), col: Math.min(previous.col, columns) }))
    setPatch(previous => previous.column_config?.some(config => config.col > columns)
      ? { ...previous, column_config: previous.column_config.filter(config => config.col <= columns) }
      : previous)
  }, [columns, rows])

  const status = structureMode === 'AUTO' ? 'Auto' : `Manual · ${rows} rows × ${columns} columns`
  const advancedModified = structureMode === 'MANUAL'
    || count !== 1
    || Object.keys(patch).length > 0
    || columnBrief.length > 0
    || cellMarks.length > 0
    || positionModified
    || paddingModified
    || zIndexModified
  const tableConfig = useMemo<Partial<TableConfig>>(() => {
    const next: Partial<TableConfig> = { ...patch, structure_mode: structureMode }
    if (structureMode === 'MANUAL') {
      next.rows = rows
      next.columns = columns
      if (columnBrief.length) next.column_brief = columnBrief
      if (cellMarks.length) next.cell_marks = cellMarks
    } else {
      delete next.rows
      delete next.columns
      delete next.column_widths
      delete next.header_min_chars
      delete next.header_max_chars
      delete next.cell_min_chars
      delete next.cell_max_chars
      delete next.header_font_color
      delete next.header_font_size
      delete next.header_font_family
      delete next.header_bold
      delete next.header_italic
      delete next.header_allcaps
      delete next.cell_font_color
      delete next.cell_font_size
      delete next.cell_font_family
      delete next.cell_bold
      delete next.cell_italic
      delete next.cell_allcaps
      if (columnBrief.length) {
        next.column_brief = columnBrief.map(({ width_share: _widthShare, ...column }) => column)
      }
    }
    return next
  }, [cellMarks, columnBrief, columns, patch, rows, structureMode])
  const generationConfig = useMemo<Record<string, unknown>>(() => ({
    version: 1,
    componentType: 'TABLE',
    prompt,
    showAdvanced,
    count,
    advancedModified,
    tableConfig,
    positionConfig: positionModified ? positionConfig : undefined,
    paddingConfig: paddingModified ? paddingConfig : undefined,
    z_index: zIndexModified ? zIndex : undefined,
    useDeckTheme,
    themeOverrides,
  }), [
    advancedModified,
    count,
    paddingConfig,
    paddingModified,
    positionConfig,
    positionModified,
    prompt,
    showAdvanced,
    tableConfig,
    themeOverrides,
    useDeckTheme,
    zIndex,
    zIndexModified,
  ])

  const handleSubmit = useCallback(() => {
    onSubmit({
      componentType: 'TABLE',
      prompt,
      count,
      layout: 'horizontal',
      advancedModified,
      z_index: zIndexModified ? zIndex : undefined,
      presentationId,
      useDeckTheme,
      themeOverrides,
      generationConfig,
      tableConfig,
      positionConfig: positionModified ? positionConfig : undefined,
      paddingConfig: paddingModified ? paddingConfig : undefined,
    })
  }, [advancedModified, count, generationConfig, onSubmit, paddingConfig, paddingModified, positionConfig, positionModified, presentationId, prompt, tableConfig, themeOverrides, useDeckTheme, zIndex, zIndexModified])

  useEffect(() => {
    onDraftChange?.({
      formData: {
        componentType: 'TABLE',
        prompt,
        count,
        layout: 'horizontal',
        advancedModified,
        z_index: zIndexModified ? zIndex : undefined,
        presentationId,
        useDeckTheme,
        themeOverrides,
        generationConfig,
        tableConfig,
        positionConfig: positionModified ? positionConfig : undefined,
        paddingConfig: paddingModified ? paddingConfig : undefined,
      },
    })
  }, [advancedModified, count, generationConfig, onDraftChange, paddingConfig, paddingModified, positionConfig, positionModified, presentationId, prompt, tableConfig, themeOverrides, useDeckTheme, zIndex, zIndexModified])

  useEffect(() => registerSubmit(handleSubmit), [handleSubmit, registerSubmit])

  return (
    <div className="space-y-2.5">
      <section aria-labelledby="table-structure-heading" className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div id="table-structure-heading" className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Table structure</div>
            <div data-testid="table-structure-status" className="truncate text-[10px] text-slate-500 dark:text-slate-400">{status}</div>
          </div>
          <div className="inline-flex rounded-md border border-slate-300 p-0.5 dark:border-slate-600" role="group" aria-label="Table structure mode">
            {(['AUTO', 'MANUAL'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                aria-pressed={structureMode === mode}
                disabled={isGenerating}
                onClick={() => setStructureMode(mode)}
                className={`rounded px-2 py-1 text-[10px] font-semibold ${structureMode === mode ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
              >
                {mode === 'AUTO' ? 'Auto' : 'Manual'}
              </button>
            ))}
          </div>
        </div>
        {structureMode === 'MANUAL' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="space-y-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Rows
              <select aria-label="Manual table rows" value={rows} onChange={event => setRows(Number(event.target.value))} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                {Array.from({ length: 10 }, (_, index) => index + 1).map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Columns
              <select aria-label="Manual table columns" value={columns} onChange={event => setColumns(Number(event.target.value))} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                {Array.from({ length: 5 }, (_, index) => index + 2).map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2" aria-label="Table appearance controls">
        <OptionalSelect label="Header" value={patch.header_style ?? ''} onChange={value => updatePatch('header_style', value as TableConfig['header_style'])} options={[{ value: 'solid', label: 'Solid' }, { value: 'pastel', label: 'Pastel' }, { value: 'minimal', label: 'Minimal' }]} />
        <OptionalSelect label="Stripe" value={patch.stripe_rows === undefined ? '' : patch.stripe_rows ? 'on' : 'off'} onChange={value => updatePatch('stripe_rows', value === undefined ? undefined : value === 'on')} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
        <OptionalSelect label="Corners" value={patch.corners ?? ''} onChange={value => updatePatch('corners', value as TableConfig['corners'])} options={[{ value: 'rounded', label: 'Rounded' }, { value: 'square', label: 'Square' }]} />
        <OptionalSelect label="Border" value={patch.border_style ?? ''} onChange={value => updatePatch('border_style', value as TableConfig['border_style'])} options={[{ value: 'light', label: 'Light' }, { value: 'medium', label: 'Medium' }, { value: 'heavy', label: 'Heavy' }, { value: 'none', label: 'None' }]} />
      </div>

      {researchControls}

      {showAdvanced && (
        <div className="space-y-2">
          <label className="block space-y-1 rounded-lg border border-slate-200 px-2.5 py-2 dark:border-slate-700">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Table count</span>
            <select aria-label="Table count" value={count} onChange={event => setCount(Number(event.target.value))} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>

          <CollapsibleSection title="Columns & semantics" isOpen={showSchema} onToggle={() => setShowSchema(!showSchema)}>
            <div className="space-y-2">
              <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">Optional grounded column instructions. Widths remain Auto unless Manual structure is selected.</p>
              {!columnBrief.length && <button type="button" onClick={ensureBrief} className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Define column semantics</button>}
              {columnBrief.map(column => (
                <div key={column.index} className="grid grid-cols-12 gap-1.5 rounded-md border border-slate-200 p-2 dark:border-slate-700">
                  <input aria-label={`Column ${column.index} name`} value={column.name} onChange={event => updateBrief(column.index, { name: event.target.value })} className="col-span-5 rounded border border-slate-300 px-1.5 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800" />
                  <select aria-label={`Column ${column.index} kind`} value={column.kind} onChange={event => updateBrief(column.index, { kind: event.target.value as TableColumnKind })} className="col-span-4 rounded border border-slate-300 px-1 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800">
                    {COLUMN_KINDS.map(kind => <option key={kind} value={kind}>{kind.replace('_', ' ')}</option>)}
                  </select>
                  <select aria-label={`Column ${column.index} target length`} value={column.target_len} onChange={event => updateBrief(column.index, { target_len: event.target.value as TableColumnBrief['target_len'] })} className="col-span-3 rounded border border-slate-300 px-1 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800">
                    <option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option>
                  </select>
                  <input aria-label={`Column ${column.index} detail`} value={column.detail} maxLength={120} onChange={event => updateBrief(column.index, { detail: event.target.value })} className="col-span-9 rounded border border-slate-300 px-1.5 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800" />
                  <input aria-label={`Column ${column.index} width share`} type="number" min={0.05} max={1} step={0.05} disabled={structureMode !== 'MANUAL'} value={column.width_share ?? ''} placeholder="Auto" onChange={event => updateBrief(column.index, { width_share: event.target.value ? Number(event.target.value) : undefined })} className="col-span-3 rounded border border-slate-300 px-1 py-1 text-[10px] disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:disabled:bg-slate-900" />
                </div>
              ))}
              {columnBrief.length > 0 && <button type="button" onClick={() => setColumnBrief([])} className="text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400">Reset semantics to Auto</button>}
              <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Column rendering</span>
                  {!patch.column_config?.length && <button type="button" onClick={ensureColumnConfig} className="rounded border border-slate-300 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Customize</button>}
                </div>
                {patch.column_config?.length ? (
                  <div className="space-y-1.5">
                    {patch.column_config.map(config => (
                      <div key={config.col} className="grid grid-cols-12 gap-1">
                        <div className="col-span-1 self-center text-[10px] font-semibold text-slate-500">C{config.col}</div>
                        <select aria-label={`Column ${config.col} alignment`} value={config.alignment ?? ''} onChange={event => updateColumnConfig(config.col, { alignment: event.target.value ? event.target.value as TableColumnConfig['alignment'] : undefined })} className="col-span-2 rounded border border-slate-300 px-1 py-1 text-[9px] dark:border-slate-600 dark:bg-slate-800"><option value="">Align</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
                        <select aria-label={`Column ${config.col} emphasis`} value={config.emphasis ?? ''} onChange={event => updateColumnConfig(config.col, { emphasis: event.target.value ? event.target.value as TableColumnConfig['emphasis'] : undefined })} className="col-span-2 rounded border border-slate-300 px-1 py-1 text-[9px] dark:border-slate-600 dark:bg-slate-800"><option value="">Weight</option><option value="normal">Normal</option><option value="bold">Bold</option></select>
                        <select aria-label={`Column ${config.col} format`} value={config.format ?? ''} onChange={event => updateColumnConfig(config.col, { format: event.target.value ? event.target.value as TableColumnConfig['format'] : undefined })} className="col-span-2 rounded border border-slate-300 px-1 py-1 text-[9px] dark:border-slate-600 dark:bg-slate-800"><option value="">Format</option><option value="text">Text</option><option value="number">Number</option><option value="percent">Percent</option><option value="currency">Currency</option><option value="boolean">Boolean</option></select>
                        <select aria-label={`Column ${config.col} content kind`} value={config.content_kind ?? ''} onChange={event => updateColumnConfig(config.col, { content_kind: event.target.value ? event.target.value as TableColumnConfig['content_kind'] : undefined })} className="col-span-3 rounded border border-slate-300 px-1 py-1 text-[9px] dark:border-slate-600 dark:bg-slate-800"><option value="">Kind</option>{COLUMN_KINDS.filter(kind => !['currency', 'percent', 'status'].includes(kind)).map(kind => <option key={kind} value={kind}>{kind.replace('_', ' ')}</option>)}</select>
                        <input aria-label={`Column ${config.col} max chars`} type="number" min={5} max={400} value={config.cell_max_chars ?? ''} placeholder="Max" onChange={event => updateColumnConfig(config.col, { cell_max_chars: event.target.value ? Number(event.target.value) : undefined })} className="col-span-2 rounded border border-slate-300 px-1 py-1 text-[9px] dark:border-slate-600 dark:bg-slate-800" />
                      </div>
                    ))}
                    <button type="button" onClick={() => updatePatch('column_config', undefined)} className="text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400">Reset column rendering to Auto</button>
                  </div>
                ) : (
                  <p className="text-[10px] leading-4 text-slate-500 dark:text-slate-400">Optional per-column alignment, emphasis, format, content kind, and max character hints.</p>
                )}
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Totals, alignment & cell marks" isOpen={showBehavior} onToggle={() => setShowBehavior(!showBehavior)}>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <OptionalSelect label="Totals" value={patch.show_total_row === undefined ? '' : patch.show_total_row ? 'on' : 'off'} onChange={value => updatePatch('show_total_row', value === undefined ? undefined : value === 'on')} options={[{ value: 'on', label: 'Show' }, { value: 'off', label: 'Hide' }]} />
                <OptionalSelect label="Total style" value={patch.total_row_style ?? ''} onChange={value => updatePatch('total_row_style', value as TableConfig['total_row_style'])} options={[{ value: 'bold', label: 'Bold' }, { value: 'filled', label: 'Filled' }]} />
                <OptionalSelect label="Alignment" value={patch.alignment ?? ''} onChange={value => updatePatch('alignment', value as TableConfig['alignment'])} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} />
                <OptionalSelect label="Density" value={patch.density ?? ''} onChange={value => updatePatch('density', value as TableConfig['density'])} options={[{ value: 'compact', label: 'Compact' }, { value: 'regular', label: 'Regular' }, { value: 'spacious', label: 'Spacious' }]} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <OptionalTextInput label="Total fill" value={patch.total_row_fill} placeholder="Auto, e.g. #EEF2FF" onChange={value => updatePatch('total_row_fill', value)} />
                <OptionalTextInput label="Total rule" value={patch.total_row_rule_color} placeholder="Auto, e.g. #4F46E5" onChange={value => updatePatch('total_row_rule_color', value)} />
                <OptionalBooleanSelect label="First col bold" value={patch.first_column_bold} onChange={value => updatePatch('first_column_bold', value)} />
                <OptionalBooleanSelect label="Last col bold" value={patch.last_column_bold} onChange={value => updatePatch('last_column_bold', value)} />
                <OptionalBooleanSelect label="Mark legend" value={patch.show_mark_legend} onChange={value => updatePatch('show_mark_legend', value)} onLabel="Show" offLabel="Hide" />
              </div>
              <div className="grid grid-cols-5 gap-1.5 rounded-md border border-slate-200 p-2 dark:border-slate-700">
                <select aria-label="Cell mark row" disabled={structureMode !== 'MANUAL'} value={markDraft.row} onChange={event => setMarkDraft(previous => ({ ...previous, row: Number(event.target.value) }))} className="rounded border border-slate-300 px-1 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800">{Array.from({ length: rows }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select>
                <select aria-label="Cell mark column" disabled={structureMode !== 'MANUAL'} value={markDraft.col} onChange={event => setMarkDraft(previous => ({ ...previous, col: Number(event.target.value) }))} className="rounded border border-slate-300 px-1 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800">{Array.from({ length: columns }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select>
                <select aria-label="Cell mark" disabled={structureMode !== 'MANUAL'} value={markDraft.mark} onChange={event => setMarkDraft(previous => ({ ...previous, mark: event.target.value as TableCellMark['mark'] }))} className="rounded border border-slate-300 px-1 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800"><option value="highlight">Highlight</option><option value="good">Good</option><option value="bad">Bad</option><option value="warn">Warn</option><option value="trend_up">Up</option><option value="trend_down">Down</option><option value="flat">Flat</option></select>
                <select aria-label="Cell mark style" disabled={structureMode !== 'MANUAL'} value={markDraft.style} onChange={event => setMarkDraft(previous => ({ ...previous, style: event.target.value as TableCellMark['style'] }))} className="rounded border border-slate-300 px-1 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800"><option value="chip">Chip</option><option value="pill">Pill</option><option value="tint">Tint</option><option value="arrow">Arrow</option></select>
                <button type="button" disabled={structureMode !== 'MANUAL'} onClick={() => setCellMarks(previous => [...previous.filter(mark => mark.row !== markDraft.row || mark.col !== markDraft.col), markDraft])} className="rounded bg-slate-800 px-1 py-1 text-[10px] font-semibold text-white disabled:bg-slate-300 dark:bg-slate-200 dark:text-slate-900">Add mark</button>
              </div>
              {cellMarks.length > 0 && <div className="flex flex-wrap gap-1">{cellMarks.map(mark => <button type="button" key={`${mark.row}-${mark.col}`} title="Remove mark" onClick={() => setCellMarks(previous => previous.filter(item => item !== mark))} className="rounded bg-slate-100 px-1.5 py-1 text-[9px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">R{mark.row} C{mark.col}: {mark.mark} ×</button>)}</div>}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Theme & typography" isOpen={showTypography} onToggle={() => setShowTypography(!showTypography)}>
            <div className="space-y-2">
              <ThemeSourceSelector presentationId={presentationId} value={themeSource} onChange={updateThemeSource} />
              <div className="grid grid-cols-2 gap-2">
                <OptionalTextInput label="Header color" value={patch.header_color} placeholder="Auto, e.g. purple or #4F46E5" onChange={value => updatePatch('header_color', value)} />
                <OptionalTextInput label="Header text" value={patch.header_font_color} placeholder="Auto, e.g. #FFFFFF" onChange={value => updatePatch('header_font_color', value)} />
                <OptionalTextInput label="Cell text" value={patch.cell_font_color} placeholder="Auto, e.g. #334155" onChange={value => updatePatch('cell_font_color', value)} />
                <OptionalTextInput label="Row bg" value={patch.row_background} placeholder="Auto, e.g. #FFFFFF" onChange={value => updatePatch('row_background', value)} />
                <OptionalTextInput label="Alt row bg" value={patch.row_alt_background} placeholder="Auto, e.g. #F8FAFC" onChange={value => updatePatch('row_alt_background', value)} />
                <OptionalBooleanSelect label="Header bold" value={patch.header_bold} onChange={value => updatePatch('header_bold', value)} />
                <OptionalBooleanSelect label="Header italic" value={patch.header_italic} onChange={value => updatePatch('header_italic', value)} />
                <OptionalBooleanSelect label="Header caps" value={patch.header_allcaps} onChange={value => updatePatch('header_allcaps', value)} onLabel="Caps" offLabel="Normal" />
                <OptionalBooleanSelect label="Cell bold" value={patch.cell_bold} onChange={value => updatePatch('cell_bold', value)} />
                <OptionalBooleanSelect label="Cell italic" value={patch.cell_italic} onChange={value => updatePatch('cell_italic', value)} />
                <OptionalBooleanSelect label="Cell caps" value={patch.cell_allcaps} onChange={value => updatePatch('cell_allcaps', value)} onLabel="Caps" offLabel="Normal" />
                <OptionalTextInput label="Header font" value={patch.header_font_family} onChange={value => updatePatch('header_font_family', value)} />
                <OptionalTextInput label="Header size" value={patch.header_font_size} placeholder="Auto, e.g. 14px" onChange={value => updatePatch('header_font_size', value)} />
                <OptionalTextInput label="Cell font" value={patch.cell_font_family} onChange={value => updatePatch('cell_font_family', value)} />
                <OptionalTextInput label="Cell size" value={patch.cell_font_size} placeholder="Auto, e.g. 13px" onChange={value => updatePatch('cell_font_size', value)} />
                <OptionalNumberInput label="Header min chars" value={patch.header_min_chars} min={5} max={60} onChange={value => updatePatch('header_min_chars', value)} />
                <OptionalNumberInput label="Header max chars" value={patch.header_max_chars} min={5} max={80} onChange={value => updatePatch('header_max_chars', value)} />
                <OptionalNumberInput label="Cell min chars" value={patch.cell_min_chars} min={5} max={200} onChange={value => updatePatch('cell_min_chars', value)} />
                <OptionalNumberInput label="Cell max chars" value={patch.cell_max_chars} min={5} max={400} onChange={value => updatePatch('cell_max_chars', value)} />
                <OptionalSelect label="Fit" value={patch.fit_mode ?? ''} onChange={value => updatePatch('fit_mode', value as TableConfig['fit_mode'])} options={[{ value: 'fill', label: 'Fill' }, { value: 'natural', label: 'Natural' }]} />
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Positioning" isOpen={showPositioning} onToggle={() => setShowPositioning(!showPositioning)}>
            <div className="space-y-2.5">
              <PositionPresets positionConfig={positionConfig} onChange={setPositionConfig} elementType="TABLE" onAdvancedModified={() => setPositionModified(true)} />
              <ZIndexInput value={zIndex} onChange={setZIndex} onAdvancedModified={() => setZIndexModified(true)} />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Container padding" isOpen={showPadding} onToggle={() => setShowPadding(!showPadding)}>
            <PaddingControl paddingConfig={paddingConfig} onChange={setPaddingConfig} onAdvancedModified={() => setPaddingModified(true)} />
          </CollapsibleSection>
        </div>
      )}
    </div>
  )
}

TableForm.displayName = 'TableForm'

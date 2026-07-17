'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { MandatoryConfig } from '../types'
import {
  type ChevronConfig,
  type CloudArchitectureConfig,
  type CodeDisplayConfig,
  type CustomDiagramConfig,
  type DataArchitectureConfig,
  type DiagramThemePalette,
  type DiagramFormData,
  type DiagramGenerationConfig,
  type GanttConfig,
  type IdeaBoardConfig,
  type KanbanConfig,
  type LogicalArchitectureConfig,
  type TextLabsDiagramSubtype,
  TEXT_LABS_ELEMENT_DEFAULTS,
} from '@/types/textlabs'
import {
  catalogType,
  DIAGRAM_CATALOG_FALLBACK,
  fetchDiagramCatalog,
  type DiagramCatalog,
  type DiagramCatalogField,
} from '@/lib/diagram-catalog'
import { ToggleRow } from '../shared/toggle-row'
import { ZIndexInput } from '../shared/z-index-input'
import { ThemeSourceSelector } from '../shared/theme-source-selector'
import { useThemeSourceState } from '../shared/use-theme-source-state'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.DIAGRAM

const PROMPT_PLACEHOLDERS: Record<TextLabsDiagramSubtype, string> = {
  CODE_DISPLAY: 'e.g., Python function to calculate a Fibonacci sequence',
  KANBAN_BOARD: 'e.g., Sprint board for mobile app development with tasks',
  GANTT_CHART: 'e.g., Product launch plan using the uploaded schedule',
  CHEVRON_MATURITY: 'e.g., Digital maturity roadmap from current to target state',
  IDEA_BOARD: 'e.g., Prioritize product opportunities by value and effort',
  CLOUD_ARCHITECTURE: 'e.g., Event-driven order processing with managed cloud services',
  LOGICAL_ARCHITECTURE: 'e.g., E-commerce system with checkout and payment processing',
  DATA_ARCHITECTURE: 'e.g., User management database with roles and permissions',
  CUSTOM: 'e.g., Map policy stakeholders, decisions, and escalation paths',
}

const LABELS: Record<string, string> = {
  github_light: 'GitHub Light',
  github_dark: 'GitHub Dark',
  monokai: 'Monokai',
  solarized_dark: 'Solarized Dark',
  dracula: 'Dracula',
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'Azure',
  generic: 'Generic',
  auto: 'Auto',
  default: 'Default',
  ocean: 'Ocean',
  forest: 'Forest',
  emerald: 'Emerald',
  purple: 'Purple',
  minimal: 'Minimal',
  dark: 'Dark',
}

export interface ExistingDiagramTarget {
  subtype?: TextLabsDiagramSubtype | null
  generationConfig?: DiagramGenerationConfig | null
}

interface DiagramFormProps {
  onSubmit: (formData: DiagramFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  presentationId?: string | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig) => void
  researchControls?: ReactNode
  existingDiagramTarget?: ExistingDiagramTarget | null
}

type ProviderSelection = 'auto' | NonNullable<CloudArchitectureConfig['provider']>
type LeafTheme = 'auto' | 'default' | 'dark' | 'minimal' | 'ocean' | 'forest' | 'emerald' | 'purple'

function strings(field: DiagramCatalogField | undefined, fallback: string[]): string[] {
  const values = field?.enum?.filter((value): value is string => typeof value === 'string')
  return values?.length ? values : fallback
}

function numbers(field: DiagramCatalogField | undefined, fallback: number[]): number[] {
  const values = field?.enum?.filter((value): value is number => typeof value === 'number')
  if (values?.length) return values
  if (typeof field?.min === 'number' && typeof field.max === 'number') {
    return Array.from({ length: field.max - field.min + 1 }, (_, index) => field.min! + index)
  }
  return fallback
}

function humanize(value: string): string {
  return LABELS[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function promptProvider(prompt: string): Exclude<ProviderSelection, 'auto' | 'generic'> | null {
  const normalized = prompt.toLowerCase()
  if (/\b(amazon web services|aws)\b/.test(normalized)) return 'aws'
  if (/\b(google cloud platform|google cloud|gcp)\b/.test(normalized)) return 'gcp'
  if (/\b(microsoft azure|azure)\b/.test(normalized)) return 'azure'
  return null
}

function completeDiagramPalette(
  palette: NonNullable<ReturnType<typeof useThemeSourceState>['themeOverrides']>,
): DiagramThemePalette {
  const dark = palette.mode === 'dark'
  const background = palette.background ?? (dark ? '#111827' : '#FFFFFF')
  const surface = palette.surface ?? palette.secondary ?? (dark ? '#1F2937' : '#F8FAFC')
  const text = palette.text ?? (dark ? '#F9FAFB' : '#111827')
  const border = palette.border ?? palette.secondary ?? (dark ? '#4B5563' : '#D1D5DB')
  const accents = [
    ...(palette.accents ?? []),
    palette.primary,
    palette.secondary,
    '#2563EB',
  ].filter((value, index, values): value is string => (
    typeof value === 'string'
    && /^#[0-9a-fA-F]{6}$/.test(value)
    && values.findIndex(candidate => (
      typeof candidate === 'string' && candidate.toLowerCase() === value.toLowerCase()
    )) === index
  ))
  return { background, surface, text, border, accents }
}

export function DiagramForm({
  onSubmit,
  registerSubmit,
  isGenerating,
  presentationId,
  prompt,
  showAdvanced,
  registerMandatoryConfig,
  researchControls,
  existingDiagramTarget,
}: DiagramFormProps) {
  const [catalog, setCatalog] = useState<DiagramCatalog>(DIAGRAM_CATALOG_FALLBACK)
  const [subtype, setSubtype] = useState<TextLabsDiagramSubtype>('CODE_DISPLAY')
  const [advancedModified, setAdvancedModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)
  const { themeSource, updateThemeSource, useDeckTheme, themeOverrides } = useThemeSourceState(presentationId)

  const [language, setLanguage] = useState('python')
  const [colorTheme, setColorTheme] = useState<CodeDisplayConfig['color_theme']>('github_dark')
  const [textSize, setTextSize] = useState<CodeDisplayConfig['text_size']>('medium')
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [showCopyButton, setShowCopyButton] = useState(true)
  const [cornerStyle, setCornerStyle] = useState<CodeDisplayConfig['corner_style']>('rounded')

  const [columnCount, setColumnCount] = useState(4)
  const [ganttTimeUnit, setGanttTimeUnit] = useState<GanttConfig['time_unit']>('weeks')
  const [numStages, setNumStages] = useState(5)
  const [chevronTimeUnit, setChevronTimeUnit] = useState<ChevronConfig['time_unit']>('stages')
  const [axisPreset, setAxisPreset] = useState<IdeaBoardConfig['axis_preset']>('impact_urgency')
  const [provider, setProvider] = useState<ProviderSelection>('auto')
  const [providerConflictConfirmed, setProviderConflictConfirmed] = useState(false)
  const [showLayers, setShowLayers] = useState(true)
  const [showDataTypes, setShowDataTypes] = useState(true)
  const [showNullable, setShowNullable] = useState(true)
  const [layoutHint, setLayoutHint] = useState<NonNullable<CustomDiagramConfig['layout_hint']>>('auto')
  const [leafTheme, setLeafTheme] = useState<LeafTheme>('auto')
  const [positionPreset, setPositionPreset] = useState('auto')

  useEffect(() => {
    const controller = new AbortController()
    void fetchDiagramCatalog(undefined, controller.signal).then(setCatalog).catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const generationConfig = existingDiagramTarget?.generationConfig
    const hydratedSubtype = generationConfig?.diagram_type ?? existingDiagramTarget?.subtype
    if (hydratedSubtype) setSubtype(hydratedSubtype)
    const settings = generationConfig?.settings
    if (generationConfig?.theme_source) {
      updateThemeSource({
        mode: generationConfig.theme_source,
        overrides: generationConfig.theme_source === 'another' && generationConfig.theme_palette
          ? {
              primary: generationConfig.theme_palette.accents?.[0],
              secondary: generationConfig.theme_palette.surface,
              surface: generationConfig.theme_palette.surface,
              border: generationConfig.theme_palette.border,
              accents: generationConfig.theme_palette.accents,
              text: generationConfig.theme_palette.text,
              background: generationConfig.theme_palette.background,
            }
          : null,
      })
    }
    if (!settings) return

    if (typeof settings.language === 'string') setLanguage(settings.language)
    if (typeof settings.color_theme === 'string') setColorTheme(settings.color_theme as CodeDisplayConfig['color_theme'])
    if (typeof settings.text_size === 'string') setTextSize(settings.text_size as CodeDisplayConfig['text_size'])
    if (typeof settings.show_line_numbers === 'boolean') setShowLineNumbers(settings.show_line_numbers)
    if (typeof settings.show_copy_button === 'boolean') setShowCopyButton(settings.show_copy_button)
    if (typeof settings.corner_style === 'string') setCornerStyle(settings.corner_style as CodeDisplayConfig['corner_style'])
    if (typeof settings.column_count === 'number') setColumnCount(settings.column_count)
    if (typeof settings.time_unit === 'string') {
      if (hydratedSubtype === 'GANTT_CHART') setGanttTimeUnit(settings.time_unit as GanttConfig['time_unit'])
      if (hydratedSubtype === 'CHEVRON_MATURITY') setChevronTimeUnit(settings.time_unit as ChevronConfig['time_unit'])
    }
    if (typeof settings.num_stages === 'number') setNumStages(settings.num_stages)
    if (typeof settings.axis_preset === 'string') setAxisPreset(settings.axis_preset as IdeaBoardConfig['axis_preset'])
    if (typeof settings.show_layers === 'boolean') setShowLayers(settings.show_layers)
    if (typeof settings.show_data_types === 'boolean') setShowDataTypes(settings.show_data_types)
    if (typeof settings.show_nullable === 'boolean') setShowNullable(settings.show_nullable)
    if (typeof settings.layout_hint === 'string') setLayoutHint(settings.layout_hint as NonNullable<CustomDiagramConfig['layout_hint']>)
    if (typeof settings.theme === 'string') setLeafTheme(settings.theme as LeafTheme)
    if (typeof settings.position_preset === 'string') setPositionPreset(settings.position_preset)

    const providerSelection = generationConfig?.provider_selection
    if (providerSelection?.mode === 'manual' && providerSelection.provider) {
      setProvider(providerSelection.provider)
      setProviderConflictConfirmed(providerSelection.conflict_confirmed === true)
    } else {
      setProvider('auto')
      setProviderConflictConfirmed(false)
    }
    setAdvancedModified(false)
  }, [
    existingDiagramTarget?.generationConfig,
    existingDiagramTarget?.subtype,
    updateThemeSource,
  ])

  const subtypeCatalog = useMemo(() => catalogType(catalog, subtype), [catalog, subtype])
  const subtypeLabel = `${subtypeCatalog.label}${subtypeCatalog.experimental ? ' · Experimental' : ''}`
  const selectSubtype = useCallback((value: TextLabsDiagramSubtype) => {
    setSubtype(value)
    setLeafTheme('auto')
    setPositionPreset('auto')
    setProviderConflictConfirmed(false)
    setAdvancedModified(true)
  }, [])

  useEffect(() => {
    registerMandatoryConfig({
      fieldLabel: 'Type',
      displayLabel: subtypeLabel,
      options: catalog.types.map(item => ({
        value: item.type,
        label: `${item.label}${item.experimental ? ' · Experimental' : ''}`,
      })),
      onChange: value => selectSubtype(value as TextLabsDiagramSubtype),
      promptPlaceholder: PROMPT_PLACEHOLDERS[subtype],
      customRender: (
        <select
          aria-label="Diagram type"
          value={subtype}
          onChange={event => {
            selectSubtype(event.target.value as TextLabsDiagramSubtype)
          }}
          className="max-w-[190px] rounded-lg border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 outline-none transition-colors hover:bg-gray-200 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          disabled={isGenerating}
        >
          {catalog.types.map(option => (
            <option key={option.type} value={option.type}>
              {option.label}{option.experimental ? ' — Experimental' : ''}
            </option>
          ))}
        </select>
      ),
    })
  }, [catalog.types, isGenerating, registerMandatoryConfig, selectSubtype, subtype, subtypeLabel])

  const buildDiagramConfig = useCallback((): Record<string, unknown> => {
    const shared = {
      ...(leafTheme !== 'auto' ? { theme: leafTheme } : {}),
      ...(positionPreset !== 'auto' ? { position_preset: positionPreset } : {}),
    }
    switch (subtype) {
      case 'CODE_DISPLAY':
        return {
          language,
          color_theme: colorTheme,
          text_size: textSize,
          show_line_numbers: showLineNumbers,
          show_copy_button: showCopyButton,
          corner_style: cornerStyle,
          ...shared,
        }
      case 'KANBAN_BOARD':
        return { column_count: columnCount, ...shared }
      case 'GANTT_CHART':
        return { time_unit: ganttTimeUnit, ...shared }
      case 'CHEVRON_MATURITY':
        return { num_stages: numStages, time_unit: chevronTimeUnit, ...shared }
      case 'IDEA_BOARD':
        return { axis_preset: axisPreset, ...shared }
      case 'CLOUD_ARCHITECTURE':
        return { ...(provider !== 'auto' ? { provider } : {}), show_layers: showLayers, ...shared }
      case 'LOGICAL_ARCHITECTURE':
        return shared
      case 'DATA_ARCHITECTURE':
        return { show_data_types: showDataTypes, show_nullable: showNullable, ...shared }
      case 'CUSTOM':
        return { ...(layoutHint !== 'auto' ? { layout_hint: layoutHint } : {}), ...shared }
    }
  }, [
    axisPreset, chevronTimeUnit, colorTheme, columnCount, cornerStyle, ganttTimeUnit,
    language, layoutHint, leafTheme, numStages, positionPreset, provider, showCopyButton,
    showDataTypes, showLayers, showLineNumbers, showNullable, subtype, textSize,
  ])

  const detectedProvider = subtype === 'CLOUD_ARCHITECTURE' ? promptProvider(prompt) : null
  const providerConflict = provider !== 'auto'
    && detectedProvider !== null
    && detectedProvider !== provider

  const handleSubmit = useCallback(() => {
    if (providerConflict && !providerConflictConfirmed) return
    const settings = buildDiagramConfig()
    const clearedSettings = [
      ...(leafTheme === 'auto' && subtypeCatalog.config.theme ? ['theme'] : []),
      ...(positionPreset === 'auto' ? ['position_preset'] : []),
      ...(subtype === 'CUSTOM' && layoutHint === 'auto' ? ['layout_hint'] : []),
    ]
    const generationConfig: DiagramGenerationConfig = {
      version: 'diagram_generation_config_v1',
      diagram_type: subtype,
      settings,
      ...(clearedSettings.length ? { cleared_settings: clearedSettings } : {}),
      theme_source: themeSource.mode,
      ...(themeOverrides ? {
        theme_palette: completeDiagramPalette(themeOverrides),
      } : {}),
      ...(subtype === 'CLOUD_ARCHITECTURE' ? {
        provider_selection: provider === 'auto'
          ? { mode: 'auto' }
          : { mode: 'manual', provider, conflict_confirmed: providerConflictConfirmed },
      } : {}),
    }
    onSubmit({
      componentType: subtype,
      prompt: prompt || `Generate a ${subtype.toLowerCase().replace(/_/g, ' ')}`,
      count: 1,
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      presentationId,
      useDeckTheme,
      themeOverrides,
      diagramConfig: settings,
      generationConfig,
    })
  }, [
    advancedModified, buildDiagramConfig, onSubmit, presentationId, prompt, provider,
    layoutHint, leafTheme, positionPreset, providerConflict, providerConflictConfirmed,
    subtype, subtypeCatalog.config.theme, themeOverrides, themeSource.mode, useDeckTheme, zIndex,
  ])

  useEffect(() => registerSubmit(handleSubmit), [handleSubmit, registerSubmit])

  const codeThemeValues = strings(
    catalogType(catalog, 'CODE_DISPLAY').config.color_theme,
    ['github_light', 'github_dark', 'monokai', 'solarized_dark', 'dracula'],
  ) as CodeDisplayConfig['color_theme'][]
  const codeLanguageValues = strings(
    catalogType(catalog, 'CODE_DISPLAY').config.language,
    ['python', 'javascript', 'typescript', 'java', 'go', 'rust', 'sql', 'bash'],
  )

  const markPrimaryModified = () => setAdvancedModified(true)

  return (
    <div className="space-y-2.5">
      {subtype === 'CODE_DISPLAY' ? (
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Code theme"
            value={colorTheme}
            options={codeThemeValues}
            onChange={value => { setColorTheme(value as CodeDisplayConfig['color_theme']); markPrimaryModified() }}
          />
          <SelectField
            label="Language"
            value={language}
            options={codeLanguageValues}
            onChange={value => { setLanguage(value); markPrimaryModified() }}
          />
        </div>
      ) : (
        <>
          {subtypeCatalog.research_capable && researchControls}
          {subtype === 'KANBAN_BOARD' && (
            <SelectField
              label="Columns"
              value={String(columnCount)}
              options={numbers(subtypeCatalog.config.column_count, [3, 4, 5]).map(String)}
              onChange={value => { setColumnCount(Number(value)); markPrimaryModified() }}
            />
          )}
          {subtype === 'GANTT_CHART' && (
            <SelectField
              label="Time unit"
              value={ganttTimeUnit}
              options={strings(subtypeCatalog.config.time_unit, ['days', 'weeks', 'months'])}
              onChange={value => { setGanttTimeUnit(value as GanttConfig['time_unit']); markPrimaryModified() }}
            />
          )}
          {subtype === 'CHEVRON_MATURITY' && (
            <div className="grid grid-cols-2 gap-2">
              <SelectField
                label="Stages"
                value={String(numStages)}
                options={numbers(subtypeCatalog.config.num_stages, [3, 4, 5, 6]).map(String)}
                onChange={value => { setNumStages(Number(value)); markPrimaryModified() }}
              />
              <SelectField
                label="Timeline"
                value={chevronTimeUnit}
                options={strings(subtypeCatalog.config.time_unit, ['stages', 'quarters', 'months', 'years'])}
                onChange={value => { setChevronTimeUnit(value as ChevronConfig['time_unit']); markPrimaryModified() }}
              />
            </div>
          )}
          {subtype === 'IDEA_BOARD' && (
            <SelectField
              label="Axes"
              value={axisPreset}
              options={strings(subtypeCatalog.config.axis_preset, ['impact_urgency', 'effort_value', 'risk_reward'])}
              onChange={value => { setAxisPreset(value as IdeaBoardConfig['axis_preset']); markPrimaryModified() }}
            />
          )}
          {subtype === 'CLOUD_ARCHITECTURE' && (
            <>
              <SelectField
                label="Provider"
                value={provider}
                options={strings(subtypeCatalog.config.provider, ['auto', 'aws', 'gcp', 'azure', 'generic'])}
                onChange={value => {
                  setProvider(value as ProviderSelection)
                  setProviderConflictConfirmed(false)
                  markPrimaryModified()
                }}
              />
              {providerConflict && (
                <label className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] leading-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                  <input
                    type="checkbox"
                    checked={providerConflictConfirmed}
                    onChange={event => setProviderConflictConfirmed(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    The prompt names {humanize(detectedProvider!)}, but {humanize(provider)} is selected.
                    Confirm the manual override before generating.
                  </span>
                </label>
              )}
            </>
          )}
          {subtype === 'CUSTOM' && (
            <div className="space-y-2">
              <div className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1.5 text-[11px] text-violet-800 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-200">
                Experimental: uses a validated diagram model and a deterministic safe renderer.
              </div>
              <SelectField
                label="Layout"
                value={layoutHint}
                options={strings(subtypeCatalog.config.layout_hint, ['auto', 'flow', 'hierarchy', 'radial', 'matrix', 'network'])}
                onChange={value => { setLayoutHint(value as NonNullable<CustomDiagramConfig['layout_hint']>); markPrimaryModified() }}
              />
            </div>
          )}
        </>
      )}

      {showAdvanced && (
        <div className="space-y-2 border-t border-slate-200 pt-2 dark:border-slate-700">
          <ThemeSourceSelector
            presentationId={presentationId}
            value={themeSource}
            onChange={updateThemeSource}
          />

          {subtype === 'CODE_DISPLAY' && (
            <>
              <ToggleRow
                label="Text Size"
                field="text_size"
                value={textSize}
                options={['small', 'medium', 'large'].map(value => ({ value, label: humanize(value) }))}
                onChange={(_, value) => { setTextSize(value as CodeDisplayConfig['text_size']); setAdvancedModified(true) }}
              />
              <div className="grid grid-cols-2 gap-2">
                <ToggleRow
                  label="Line Numbers"
                  field="show_line_numbers"
                  value={showLineNumbers ? 'true' : 'false'}
                  options={[{ value: 'true', label: 'Show' }, { value: 'false', label: 'Hide' }]}
                  onChange={(_, value) => { setShowLineNumbers(value === 'true'); setAdvancedModified(true) }}
                />
                <ToggleRow
                  label="Copy Button"
                  field="show_copy_button"
                  value={showCopyButton ? 'true' : 'false'}
                  options={[{ value: 'true', label: 'Show' }, { value: 'false', label: 'Hide' }]}
                  onChange={(_, value) => { setShowCopyButton(value === 'true'); setAdvancedModified(true) }}
                />
              </div>
              <ToggleRow
                label="Corners"
                field="corner_style"
                value={cornerStyle}
                options={[{ value: 'rounded', label: 'Rounded' }, { value: 'square', label: 'Square' }]}
                onChange={(_, value) => { setCornerStyle(value as CodeDisplayConfig['corner_style']); setAdvancedModified(true) }}
              />
            </>
          )}

          {subtype !== 'CODE_DISPLAY' && subtypeCatalog.config.theme?.enum && (
            <SelectField
              label="Named renderer theme"
              value={leafTheme}
              options={Array.from(new Set(['auto', ...strings(subtypeCatalog.config.theme, [])]))}
              onChange={value => { setLeafTheme(value as LeafTheme); setAdvancedModified(true) }}
              autoLabel="Auto (Deck Theme)"
            />
          )}

          {subtype === 'CLOUD_ARCHITECTURE' && (
            <ToggleRow
              label="Show Layers"
              field="show_layers"
              value={showLayers ? 'true' : 'false'}
              options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
              onChange={(_, value) => { setShowLayers(value === 'true'); setAdvancedModified(true) }}
            />
          )}
          {subtype === 'DATA_ARCHITECTURE' && (
            <div className="grid grid-cols-2 gap-2">
              <ToggleRow
                label="Data Types"
                field="show_data_types"
                value={showDataTypes ? 'true' : 'false'}
                options={[{ value: 'true', label: 'Show' }, { value: 'false', label: 'Hide' }]}
                onChange={(_, value) => { setShowDataTypes(value === 'true'); setAdvancedModified(true) }}
              />
              <ToggleRow
                label="Nullable"
                field="show_nullable"
                value={showNullable ? 'true' : 'false'}
                options={[{ value: 'true', label: 'Show' }, { value: 'false', label: 'Hide' }]}
                onChange={(_, value) => { setShowNullable(value === 'true'); setAdvancedModified(true) }}
              />
            </div>
          )}

          <SelectField
            label="Position"
            value={positionPreset}
            options={Array.from(new Set([
              'auto',
              ...strings(subtypeCatalog.config.position_preset, []),
            ]))}
            onChange={value => { setPositionPreset(value); setAdvancedModified(true) }}
          />
          <ZIndexInput
            value={zIndex}
            onChange={setZIndex}
            onAdvancedModified={() => setAdvancedModified(true)}
          />
        </div>
      )}
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
  autoLabel,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  autoLabel?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">{label}</label>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        {options.map(option => (
          <option key={option} value={option}>
            {option === 'auto' && autoLabel ? autoLabel : humanize(option)}
          </option>
        ))}
      </select>
    </div>
  )
}

DiagramForm.displayName = 'DiagramForm'

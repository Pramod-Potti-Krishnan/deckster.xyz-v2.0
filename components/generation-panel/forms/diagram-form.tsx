'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GenerationPanelDraft, MandatoryConfig } from '../types'
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
  type TextLabsDiagramRequestType,
  TEXT_LABS_ELEMENT_DEFAULTS,
} from '@/types/textlabs'
import {
  catalogType,
  DIAGRAM_CATALOG_FALLBACK,
  fetchDiagramCatalog,
  normalizePersistedDiagramSubtype,
  normalizePersistedDiagramSettings,
  type DiagramCatalog,
  type DiagramCatalogField,
} from '@/lib/diagram-catalog'
import { ToggleRow } from '../shared/toggle-row'
import { ZIndexInput } from '../shared/z-index-input'
import { ThemeSourceSelector } from '../shared/theme-source-selector'
import { useThemeSourceState } from '../shared/use-theme-source-state'
import {
  CUSTOM_DIAGRAM_PROMPT_MAX_LENGTH,
  elementPromptLengthState,
} from '@/lib/element-prompt-limit'

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
const AUTO_PROMPT_PLACEHOLDER = 'e.g., Show the best diagram for this system, plan, or relationship'

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
  zIndex?: number | null
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
  initialDraft?: GenerationPanelDraft | null
}

type ProviderSelection = 'auto' | NonNullable<CloudArchitectureConfig['provider']>
type ManualProviderSelection = Exclude<ProviderSelection, 'auto'>
type PromptProviderSelection = Exclude<ManualProviderSelection, 'generic'>
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

function hydratedCatalogString(
  field: DiagramCatalogField | undefined,
  value: unknown,
  fallback: string,
  aliases: Record<string, string> = {},
): string {
  if (typeof value !== 'string') return fallback
  const mapped = aliases[value.trim().toLowerCase()] ?? value.trim().toLowerCase()
  const allowed = strings(field, [])
  return allowed.includes(mapped) ? mapped : fallback
}

function hydratedCatalogNumber(
  field: DiagramCatalogField | undefined,
  value: unknown,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const allowed = numbers(field, [])
  if (allowed.length) {
    return allowed.reduce((closest, candidate) => (
      Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest
    ), allowed[0])
  }
  return Math.round(Math.min(field?.max ?? value, Math.max(field?.min ?? value, value)))
}

function hydratedOptionalCatalogNumber(
  field: DiagramCatalogField | undefined,
  value: unknown,
): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? hydratedCatalogNumber(field, value, value)
    : null
}

function humanize(value: string): string {
  return LABELS[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function promptProvider(prompt: string): PromptProviderSelection | null {
  const normalized = prompt.toLowerCase()
  if (/\b(amazon web services|aws)\b/.test(normalized)) return 'aws'
  if (/\b(google cloud platform|google cloud|gcp)\b/.test(normalized)) return 'gcp'
  if (/\b(microsoft azure|azure)\b/.test(normalized)) return 'azure'
  return null
}

export function providerConflictConfirmationKey(
  manualProvider: ProviderSelection,
  detectedPromptProvider: PromptProviderSelection | null,
): string | null {
  if (
    manualProvider === 'auto'
    || detectedPromptProvider === null
    || manualProvider === detectedPromptProvider
  ) {
    return null
  }
  return `${manualProvider}:${detectedPromptProvider}`
}

export function isProviderConflictConfirmationCurrent(
  confirmedKey: string | null,
  manualProvider: ProviderSelection,
  detectedPromptProvider: PromptProviderSelection | null,
): boolean {
  const currentKey = providerConflictConfirmationKey(
    manualProvider,
    detectedPromptProvider,
  )
  return currentKey !== null && confirmedKey === currentKey
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

interface DiagramFormHydration {
  hasSource: boolean
  generationConfig: DiagramGenerationConfig | null
  subtype: TextLabsDiagramSubtype
  selectionMode: 'auto' | 'manual'
  resolvedType: TextLabsDiagramSubtype | null
  advancedModified: boolean
  zIndex: number
  language: string
  languageSelectionMode: 'auto' | 'manual'
  resolvedLanguage: string | null
  colorTheme: CodeDisplayConfig['color_theme']
  textSize: CodeDisplayConfig['text_size']
  showLineNumbers: boolean
  showCopyButton: boolean
  cornerStyle: CodeDisplayConfig['corner_style']
  columnCount: number | null
  ganttTimeUnit: GanttConfig['time_unit']
  taskColumnWidthPx: number | null
  numStages: number | null
  chevronTimeUnit: ChevronConfig['time_unit']
  rowLabelWidthPx: number | null
  axisPreset: IdeaBoardConfig['axis_preset']
  provider: ProviderSelection
  providerConflictConfirmed: boolean
  providerConflictConfirmationKey: string | null
  showLayers: boolean
  showDataTypes: boolean
  showNullable: boolean
  layoutHint: NonNullable<CustomDiagramConfig['layout_hint']>
  leafTheme: LeafTheme
  positionPreset: string
}

function draftDiagramFormData(draft: GenerationPanelDraft | null | undefined): DiagramFormData | null {
  const formData = draft?.formData
  return formData && (
    formData.componentType === 'DIAGRAM_AUTO'
    || normalizePersistedDiagramSubtype(formData.componentType)
  )
    ? formData as DiagramFormData
    : null
}

export function resolveDiagramFormHydration(
  catalog: DiagramCatalog,
  existingDiagramTarget: ExistingDiagramTarget | null | undefined,
  initialDraft: GenerationPanelDraft | null | undefined,
): DiagramFormHydration {
  const draftFormData = draftDiagramFormData(initialDraft)
  const generationConfig = existingDiagramTarget?.generationConfig
    ?? draftFormData?.generationConfig
    ?? null
  const requestedType = generationConfig?.diagram_type
    ?? existingDiagramTarget?.subtype
    ?? draftFormData?.componentType
  const selectionMode = generationConfig?.selection_mode === 'auto'
    ? 'auto'
    : generationConfig?.selection_mode === 'manual'
      ? 'manual'
      : requestedType === 'DIAGRAM_AUTO'
        || draftFormData?.componentType === 'DIAGRAM_AUTO'
        ? 'auto'
        : normalizePersistedDiagramSubtype(requestedType)
          ? 'manual'
          : 'auto'
  const resolvedType = normalizePersistedDiagramSubtype(generationConfig?.resolved_type)
    ?? (selectionMode === 'auto'
      ? normalizePersistedDiagramSubtype(existingDiagramTarget?.subtype)
      : null)
  const hydratedSubtype = resolvedType
    ?? normalizePersistedDiagramSubtype(requestedType)
    ?? normalizePersistedDiagramSubtype(existingDiagramTarget?.subtype)
    ?? 'CODE_DISPLAY'
  const hydratedCatalog = catalogType(catalog, hydratedSubtype)
  const rawSettings = generationConfig?.settings ?? draftFormData?.diagramConfig
  const settings = rawSettings
    ? normalizePersistedDiagramSettings(catalog, hydratedSubtype, rawSettings)
    : {}

  const providerSelection = generationConfig?.provider_selection
  const languageSelection = generationConfig?.language_selection
  const settingsProvider = hydratedCatalogString(
    hydratedCatalog.config.provider,
    providerSelection?.provider ?? settings.provider,
    'auto',
  ) as ProviderSelection
  const providerWasManual = providerSelection
    ? providerSelection.mode === 'manual'
    : settingsProvider !== 'auto'
  const provider = providerWasManual && settingsProvider !== 'auto'
    ? settingsProvider
    : 'auto'
  const confirmedPromptProvider = (
    providerSelection?.confirmed_prompt_provider === 'aws'
    || providerSelection?.confirmed_prompt_provider === 'gcp'
    || providerSelection?.confirmed_prompt_provider === 'azure'
  )
    ? providerSelection.confirmed_prompt_provider
    : null
  const persistedProviderConflictConfirmationKey = (
    providerSelection?.conflict_confirmed === true
    && provider !== 'auto'
    && providerSelection.confirmed_manual_provider === provider
  )
    ? providerConflictConfirmationKey(provider, confirmedPromptProvider)
    : null

  return {
    hasSource: Boolean(
      generationConfig
      || existingDiagramTarget?.subtype
      || draftFormData,
    ),
    generationConfig,
    subtype: hydratedSubtype,
    selectionMode,
    resolvedType,
    advancedModified: Boolean(draftFormData?.advancedModified),
    zIndex: (
      typeof existingDiagramTarget?.zIndex === 'number'
      && Number.isFinite(existingDiagramTarget.zIndex)
    )
      ? existingDiagramTarget.zIndex
      : (
        typeof draftFormData?.z_index === 'number'
        && Number.isFinite(draftFormData.z_index)
      )
        ? draftFormData.z_index
        : DEFAULTS.zIndex,
    language: hydratedCatalogString(
      hydratedCatalog.config.language,
      languageSelection?.language ?? generationConfig?.resolved_language ?? settings.language,
      'python',
    ),
    languageSelectionMode: languageSelection?.mode
      ?? (typeof settings.language === 'string' ? 'manual' : 'auto'),
    resolvedLanguage: typeof generationConfig?.resolved_language === 'string'
      ? generationConfig.resolved_language
      : null,
    colorTheme: hydratedCatalogString(
      hydratedCatalog.config.color_theme,
      settings.color_theme,
      'github_dark',
    ) as CodeDisplayConfig['color_theme'],
    textSize: ['small', 'medium', 'large'].includes(String(settings.text_size))
      ? settings.text_size as CodeDisplayConfig['text_size']
      : 'medium',
    showLineNumbers: typeof settings.show_line_numbers === 'boolean'
      ? settings.show_line_numbers
      : true,
    showCopyButton: typeof settings.show_copy_button === 'boolean'
      ? settings.show_copy_button
      : true,
    cornerStyle: settings.corner_style === 'square' ? 'square' : 'rounded',
    columnCount: hydratedOptionalCatalogNumber(
      hydratedCatalog.config.column_count,
      settings.column_count,
    ),
    ganttTimeUnit: hydratedSubtype === 'GANTT_CHART'
      ? hydratedCatalogString(
          hydratedCatalog.config.time_unit,
          settings.time_unit,
          'weeks',
        ) as GanttConfig['time_unit']
      : 'weeks',
    taskColumnWidthPx: hydratedOptionalCatalogNumber(
      hydratedCatalog.config.task_column_width_px,
      settings.task_column_width_px ?? generationConfig?.task_column_width_px,
    ),
    numStages: hydratedOptionalCatalogNumber(
      hydratedCatalog.config.num_stages,
      settings.num_stages,
    ),
    chevronTimeUnit: hydratedSubtype === 'CHEVRON_MATURITY'
      ? hydratedCatalogString(
          hydratedCatalog.config.time_unit,
          settings.time_unit,
          'stages',
        ) as ChevronConfig['time_unit']
      : 'stages',
    rowLabelWidthPx: hydratedOptionalCatalogNumber(
      hydratedCatalog.config.row_label_width_px,
      settings.row_label_width_px ?? generationConfig?.row_label_width_px,
    ),
    axisPreset: hydratedCatalogString(
      hydratedCatalog.config.axis_preset,
      settings.axis_preset,
      'impact_urgency',
    ) as IdeaBoardConfig['axis_preset'],
    provider,
    providerConflictConfirmed: persistedProviderConflictConfirmationKey !== null,
    providerConflictConfirmationKey: persistedProviderConflictConfirmationKey,
    showLayers: typeof settings.show_layers === 'boolean' ? settings.show_layers : true,
    showDataTypes: typeof settings.show_data_types === 'boolean' ? settings.show_data_types : true,
    showNullable: typeof settings.show_nullable === 'boolean' ? settings.show_nullable : true,
    layoutHint: hydratedCatalogString(
      hydratedCatalog.config.layout_hint,
      settings.layout_hint,
      'auto',
    ) as NonNullable<CustomDiagramConfig['layout_hint']>,
    leafTheme: hydratedCatalogString(
      hydratedCatalog.config.theme,
      settings.theme,
      'auto',
    ) as LeafTheme,
    positionPreset: hydratedCatalogString(
      hydratedCatalog.config.position_preset,
      settings.position_preset,
      'auto',
    ),
  }
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
  initialDraft,
}: DiagramFormProps) {
  // A draft is an activation snapshot. Keep it stable while the parent updates
  // the prompt draft on every keystroke, otherwise catalog hydration could
  // replay stale settings over the user's current controls.
  const initialDraftRef = useRef(initialDraft)
  const initialHydrationRef = useRef(
    resolveDiagramFormHydration(
      DIAGRAM_CATALOG_FALLBACK,
      existingDiagramTarget,
      initialDraftRef.current,
    ),
  )
  const initialHydration = initialHydrationRef.current
  const [catalog, setCatalog] = useState<DiagramCatalog>(DIAGRAM_CATALOG_FALLBACK)
  const [subtype, setSubtype] = useState<TextLabsDiagramSubtype>(initialHydration.subtype)
  const [selectionMode, setSelectionMode] = useState<'auto' | 'manual'>(
    initialHydration.selectionMode,
  )
  const [autoResolvedType, setAutoResolvedType] = useState<TextLabsDiagramSubtype | null>(
    initialHydration.resolvedType,
  )
  const [advancedModified, setAdvancedModified] = useState(initialHydration.advancedModified)
  const [zIndex, setZIndex] = useState(initialHydration.zIndex)
  const { themeSource, updateThemeSource, useDeckTheme, themeOverrides } = useThemeSourceState(presentationId)

  const [language, setLanguage] = useState(initialHydration.language)
  const [languageSelectionMode, setLanguageSelectionMode] = useState<'auto' | 'manual'>(
    initialHydration.languageSelectionMode,
  )
  const [resolvedLanguage, setResolvedLanguage] = useState<string | null>(
    initialHydration.resolvedLanguage,
  )
  const [persistedSourceCode, setPersistedSourceCode] = useState<string | null>(
    typeof initialHydration.generationConfig?.source_code === 'string'
      ? initialHydration.generationConfig.source_code
      : null,
  )
  const [colorTheme, setColorTheme] = useState<CodeDisplayConfig['color_theme']>(initialHydration.colorTheme)
  const [textSize, setTextSize] = useState<CodeDisplayConfig['text_size']>(initialHydration.textSize)
  const [showLineNumbers, setShowLineNumbers] = useState(initialHydration.showLineNumbers)
  const [showCopyButton, setShowCopyButton] = useState(initialHydration.showCopyButton)
  const [cornerStyle, setCornerStyle] = useState<CodeDisplayConfig['corner_style']>(initialHydration.cornerStyle)

  const [columnCount, setColumnCount] = useState(initialHydration.columnCount)
  const [ganttTimeUnit, setGanttTimeUnit] = useState<GanttConfig['time_unit']>(initialHydration.ganttTimeUnit)
  const [taskColumnWidthPx, setTaskColumnWidthPx] = useState(initialHydration.taskColumnWidthPx)
  const [numStages, setNumStages] = useState(initialHydration.numStages)
  const [chevronTimeUnit, setChevronTimeUnit] = useState<ChevronConfig['time_unit']>(initialHydration.chevronTimeUnit)
  const [rowLabelWidthPx, setRowLabelWidthPx] = useState(initialHydration.rowLabelWidthPx)
  const [axisPreset, setAxisPreset] = useState<IdeaBoardConfig['axis_preset']>(initialHydration.axisPreset)
  const [provider, setProvider] = useState<ProviderSelection>(initialHydration.provider)
  const [confirmedProviderConflictKey, setConfirmedProviderConflictKey] = useState(
    initialHydration.providerConflictConfirmationKey,
  )
  const [showLayers, setShowLayers] = useState(initialHydration.showLayers)
  const [showDataTypes, setShowDataTypes] = useState(initialHydration.showDataTypes)
  const [showNullable, setShowNullable] = useState(initialHydration.showNullable)
  const [layoutHint, setLayoutHint] = useState<NonNullable<CustomDiagramConfig['layout_hint']>>(
    initialHydration.layoutHint,
  )
  const [leafTheme, setLeafTheme] = useState<LeafTheme>(initialHydration.leafTheme)
  const [positionPreset, setPositionPreset] = useState(initialHydration.positionPreset)
  const controlsTouchedRef = useRef(false)
  const markControlsModified = useCallback(() => {
    controlsTouchedRef.current = true
    setAdvancedModified(true)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void fetchDiagramCatalog(undefined, controller.signal).then(setCatalog).catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const hydration = resolveDiagramFormHydration(
      catalog,
      existingDiagramTarget,
      initialDraftRef.current,
    )
    // The rendered source is continuity data, not a user-editable control.
    // Always accept a newly persisted source after replacement so a second
    // refine in the same open panel builds on the immediately preceding code.
    if (hydration.hasSource) {
      setPersistedSourceCode(
        typeof hydration.generationConfig?.source_code === 'string'
          ? hydration.generationConfig.source_code
          : null,
      )
    }
    // Fresh generation has no persisted target to hydrate. In particular, a
    // late catalog response must not reset an already selected subtype.
    if (!hydration.hasSource || controlsTouchedRef.current) return

    setSubtype(hydration.subtype)
    setSelectionMode(hydration.selectionMode)
    setAutoResolvedType(hydration.resolvedType)
    setLanguage(hydration.language)
    setLanguageSelectionMode(hydration.languageSelectionMode)
    setResolvedLanguage(hydration.resolvedLanguage)
    setColorTheme(hydration.colorTheme)
    setTextSize(hydration.textSize)
    setShowLineNumbers(hydration.showLineNumbers)
    setShowCopyButton(hydration.showCopyButton)
    setCornerStyle(hydration.cornerStyle)
    setColumnCount(hydration.columnCount)
    setGanttTimeUnit(hydration.ganttTimeUnit)
    setTaskColumnWidthPx(hydration.taskColumnWidthPx)
    setNumStages(hydration.numStages)
    setChevronTimeUnit(hydration.chevronTimeUnit)
    setRowLabelWidthPx(hydration.rowLabelWidthPx)
    setAxisPreset(hydration.axisPreset)
    setShowLayers(hydration.showLayers)
    setShowDataTypes(hydration.showDataTypes)
    setShowNullable(hydration.showNullable)
    setLayoutHint(hydration.layoutHint)
    setLeafTheme(hydration.leafTheme)
    setPositionPreset(hydration.positionPreset)
    setZIndex(hydration.zIndex)
    setProvider(hydration.provider)
    setConfirmedProviderConflictKey(hydration.providerConflictConfirmationKey)
    setAdvancedModified(hydration.advancedModified)

    const generationConfig = hydration.generationConfig
    updateThemeSource({
      mode: generationConfig?.theme_source ?? 'deck',
      overrides: generationConfig?.theme_source === 'another' && generationConfig.theme_palette
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
  }, [
    catalog,
    existingDiagramTarget?.generationConfig,
    existingDiagramTarget?.subtype,
    existingDiagramTarget?.zIndex,
    updateThemeSource,
  ])

  const controlsSubtype = selectionMode === 'manual' ? subtype : autoResolvedType
  const subtypeCatalog = useMemo(
    () => catalogType(catalog, controlsSubtype ?? subtype),
    [catalog, controlsSubtype, subtype],
  )
  const leafSubtypeLabel = `${subtypeCatalog.label}${subtypeCatalog.experimental ? ' · Experimental' : ''}`
  const subtypeLabel = selectionMode === 'auto'
    ? `Auto${autoResolvedType ? ` → ${leafSubtypeLabel}` : ''}`
    : leafSubtypeLabel
  const selectSubtype = useCallback((value: TextLabsDiagramRequestType) => {
    if (value === 'DIAGRAM_AUTO') {
      setSelectionMode('auto')
      setAutoResolvedType(null)
    } else {
      setSelectionMode('manual')
      setSubtype(value)
      setAutoResolvedType(null)
    }
    setLeafTheme('auto')
    setPositionPreset('auto')
    setConfirmedProviderConflictKey(null)
    markControlsModified()
  }, [markControlsModified])

  useEffect(() => {
    registerMandatoryConfig({
      fieldLabel: 'Type',
      displayLabel: subtypeLabel,
      options: [
        { value: 'DIAGRAM_AUTO', label: 'Auto' },
        ...catalog.types.map(item => ({
          value: item.type,
          label: `${item.label}${item.experimental ? ' · Experimental' : ''}`,
        })),
      ],
      onChange: value => selectSubtype(value as TextLabsDiagramRequestType),
      promptPlaceholder: selectionMode === 'auto'
        ? AUTO_PROMPT_PLACEHOLDER
        : PROMPT_PLACEHOLDERS[subtype],
      promptMaxLength: selectionMode === 'manual' && subtype === 'CUSTOM'
        ? CUSTOM_DIAGRAM_PROMPT_MAX_LENGTH
        : undefined,
      promptLimitLabel: selectionMode === 'manual' && subtype === 'CUSTOM'
        ? 'CUSTOM prompt'
        : undefined,
      customRender: (
        <select
          aria-label="Diagram type"
          value={selectionMode === 'auto' ? 'DIAGRAM_AUTO' : subtype}
          onChange={event => {
            selectSubtype(event.target.value as TextLabsDiagramRequestType)
          }}
          className="max-w-[190px] rounded-lg border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 outline-none transition-colors hover:bg-gray-200 focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          disabled={isGenerating}
        >
          <option value="DIAGRAM_AUTO">Auto</option>
          {catalog.types.map(option => (
            <option key={option.type} value={option.type}>
              {option.label}{option.experimental ? ' — Experimental' : ''}
            </option>
          ))}
        </select>
      ),
    })
  }, [
    catalog.types,
    isGenerating,
    registerMandatoryConfig,
    selectSubtype,
    selectionMode,
    subtype,
    subtypeLabel,
  ])

  const buildDiagramConfig = useCallback((): Record<string, unknown> => {
    if (!controlsSubtype) return {}
    const shared = {
      ...(leafTheme !== 'auto' ? { theme: leafTheme } : {}),
      ...(positionPreset !== 'auto' ? { position_preset: positionPreset } : {}),
    }
    switch (controlsSubtype) {
      case 'CODE_DISPLAY':
        return {
          ...(languageSelectionMode === 'manual' ? { language } : {}),
          color_theme: colorTheme,
          text_size: textSize,
          show_line_numbers: showLineNumbers,
          show_copy_button: showCopyButton,
          corner_style: cornerStyle,
          ...shared,
        }
      case 'KANBAN_BOARD':
        return { ...(columnCount !== null ? { column_count: columnCount } : {}), ...shared }
      case 'GANTT_CHART':
        return {
          time_unit: ganttTimeUnit,
          ...(taskColumnWidthPx !== null ? { task_column_width_px: taskColumnWidthPx } : {}),
          ...shared,
        }
      case 'CHEVRON_MATURITY':
        return {
          ...(numStages !== null ? { num_stages: numStages } : {}),
          time_unit: chevronTimeUnit,
          ...(rowLabelWidthPx !== null ? { row_label_width_px: rowLabelWidthPx } : {}),
          ...shared,
        }
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
    controlsSubtype, language, languageSelectionMode, layoutHint, leafTheme, numStages,
    positionPreset, provider, showCopyButton, showDataTypes, showLayers, showLineNumbers,
    showNullable, taskColumnWidthPx, rowLabelWidthPx, textSize,
  ])

  const detectedProvider = controlsSubtype === 'CLOUD_ARCHITECTURE' ? promptProvider(prompt) : null
  const providerConflict = provider !== 'auto'
    && detectedProvider !== null
    && detectedProvider !== provider
  const currentProviderConflictKey = providerConflictConfirmationKey(
    provider,
    detectedProvider,
  )
  // Confirmation is bound to the exact manual-provider/prompt-provider pair.
  // Re-rendering with an edited prompt invalidates it synchronously, without
  // waiting for an effect that could race the Generate button.
  const providerConflictConfirmed = isProviderConflictConfirmationCurrent(
    confirmedProviderConflictKey,
    provider,
    detectedProvider,
  )

  const handleSubmit = useCallback(() => {
    if (providerConflict && !providerConflictConfirmed) return
    if (
      selectionMode === 'manual'
      && subtype === 'CUSTOM'
      && elementPromptLengthState(
        prompt,
        CUSTOM_DIAGRAM_PROMPT_MAX_LENGTH,
      ).overLimit
    ) return
    const settings = buildDiagramConfig()
    // When global Auto is selected, controlsSubtype is intentionally unresolved.
    // Use the last selected/hydrated leaf solely to tombstone any persisted
    // renderer-owned overrides; otherwise Text Labs would merge them back in.
    const settingsOwnerSubtype = controlsSubtype ?? subtype
    const clearedSettings = [
      ...(leafTheme === 'auto' && subtypeCatalog.config.theme ? ['theme'] : []),
      ...(positionPreset === 'auto' ? ['position_preset'] : []),
      ...(settingsOwnerSubtype === 'KANBAN_BOARD' && (selectionMode === 'auto' || columnCount === null)
        ? ['column_count']
        : []),
      ...(settingsOwnerSubtype === 'CHEVRON_MATURITY' && (selectionMode === 'auto' || numStages === null)
        ? ['num_stages']
        : []),
      ...(settingsOwnerSubtype === 'CUSTOM' && layoutHint === 'auto' ? ['layout_hint'] : []),
    ]
    const generationConfig: DiagramGenerationConfig = {
      version: 'diagram_generation_config_v1',
      diagram_type: selectionMode === 'auto' ? 'DIAGRAM_AUTO' : subtype,
      selection_mode: selectionMode,
      ...(selectionMode === 'auto' && autoResolvedType
        ? { resolved_type: autoResolvedType }
        : {}),
      settings,
      ...(clearedSettings.length ? { cleared_settings: clearedSettings } : {}),
      theme_source: controlsSubtype === 'CODE_DISPLAY' ? 'none' : themeSource.mode,
      ...(controlsSubtype !== 'CODE_DISPLAY' && themeOverrides ? {
        theme_palette: completeDiagramPalette(themeOverrides),
      } : {}),
      ...(controlsSubtype === 'CLOUD_ARCHITECTURE' ? {
        provider_selection: provider === 'auto'
          ? { mode: 'auto' }
          : {
              mode: 'manual',
              provider,
              conflict_confirmed: providerConflictConfirmed,
              ...(providerConflictConfirmed && detectedProvider ? {
                confirmed_manual_provider: provider,
                confirmed_prompt_provider: detectedProvider,
              } : {}),
            },
      } : {}),
      ...(controlsSubtype === 'CODE_DISPLAY' ? {
        language_selection: languageSelectionMode === 'auto'
          ? { mode: 'auto' }
          : { mode: 'manual', language },
        ...(languageSelectionMode === 'auto' && resolvedLanguage
          ? { resolved_language: resolvedLanguage }
          : {}),
        ...(persistedSourceCode ? { source_code: persistedSourceCode } : {}),
      } : {}),
    }
    onSubmit({
      componentType: selectionMode === 'auto' ? 'DIAGRAM_AUTO' : subtype,
      prompt: prompt || (
        selectionMode === 'auto'
          ? 'Choose and generate the most appropriate diagram'
          : `Generate a ${subtype.toLowerCase().replace(/_/g, ' ')}`
      ),
      count: 1,
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      presentationId,
      useDeckTheme: controlsSubtype === 'CODE_DISPLAY' ? false : useDeckTheme,
      themeOverrides: controlsSubtype === 'CODE_DISPLAY' ? null : themeOverrides,
      diagramConfig: settings,
      generationConfig,
      diagramSelection: selectionMode === 'auto'
        ? {
            mode: 'auto',
            ...(autoResolvedType ? { resolved_type: autoResolvedType } : {}),
          }
        : { mode: 'manual', requested_type: subtype },
      ...(controlsSubtype === 'CODE_DISPLAY' ? {
        languageSelection: languageSelectionMode === 'auto'
          ? { mode: 'auto' }
          : { mode: 'manual', language },
      } : {}),
    })
  }, [
    advancedModified, buildDiagramConfig, onSubmit, presentationId, prompt, provider,
    autoResolvedType, controlsSubtype, language, languageSelectionMode, layoutHint, leafTheme,
    positionPreset, providerConflict, providerConflictConfirmed, resolvedLanguage, selectionMode,
    persistedSourceCode, subtype, subtypeCatalog.config.theme, themeOverrides, themeSource.mode,
    useDeckTheme, zIndex,
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

  const markPrimaryModified = markControlsModified

  return (
    <fieldset className="space-y-2.5 border-0 p-0" disabled={isGenerating} aria-busy={isGenerating}>
      {selectionMode === 'auto' && !autoResolvedType && (
        <div className="space-y-2">
          <div className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-[11px] leading-4 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">
            Auto chooses the most suitable specialized renderer. You can override it at any time.
          </div>
          {researchControls}
        </div>
      )}

      {controlsSubtype === 'CODE_DISPLAY' ? (
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Code theme"
            value={colorTheme}
            options={codeThemeValues}
            onChange={value => { setColorTheme(value as CodeDisplayConfig['color_theme']); markPrimaryModified() }}
          />
          <SelectField
            label="Language"
            value={languageSelectionMode === 'auto' ? 'auto' : language}
            options={['auto', ...codeLanguageValues]}
            onChange={value => {
              if (value === 'auto') {
                setLanguageSelectionMode('auto')
              } else {
                setLanguageSelectionMode('manual')
                setLanguage(value)
                setResolvedLanguage(null)
              }
              markPrimaryModified()
            }}
            autoLabel={resolvedLanguage
              ? `Auto (last: ${humanize(resolvedLanguage)})`
              : 'Auto (from prompt)'}
          />
        </div>
      ) : controlsSubtype ? (
        <>
          {subtypeCatalog.research_capable && researchControls}
          {controlsSubtype === 'KANBAN_BOARD' && (
            <SelectField
              label="Columns"
              value={columnCount === null ? 'auto' : String(columnCount)}
              options={['auto', ...numbers(subtypeCatalog.config.column_count, [3, 4, 5]).map(String)]}
              onChange={value => {
                setColumnCount(value === 'auto' ? null : Number(value))
                markPrimaryModified()
              }}
              autoLabel="Auto (from prompt)"
            />
          )}
          {controlsSubtype === 'GANTT_CHART' && (
            <SelectField
              label="Time unit"
              value={ganttTimeUnit}
              options={strings(subtypeCatalog.config.time_unit, ['days', 'weeks', 'months'])}
              onChange={value => { setGanttTimeUnit(value as GanttConfig['time_unit']); markPrimaryModified() }}
            />
          )}
          {controlsSubtype === 'CHEVRON_MATURITY' && (
            <div className="grid grid-cols-2 gap-2">
              <SelectField
                label="Stages"
                value={numStages === null ? 'auto' : String(numStages)}
                options={['auto', ...numbers(subtypeCatalog.config.num_stages, [3, 4, 5, 6]).map(String)]}
                onChange={value => {
                  setNumStages(value === 'auto' ? null : Number(value))
                  markPrimaryModified()
                }}
                autoLabel="Auto (from prompt)"
              />
              <SelectField
                label="Timeline"
                value={chevronTimeUnit}
                options={strings(subtypeCatalog.config.time_unit, ['stages', 'quarters', 'months', 'years'])}
                onChange={value => { setChevronTimeUnit(value as ChevronConfig['time_unit']); markPrimaryModified() }}
              />
            </div>
          )}
          {controlsSubtype === 'IDEA_BOARD' && (
            <SelectField
              label="Axes"
              value={axisPreset}
              options={strings(subtypeCatalog.config.axis_preset, ['impact_urgency', 'effort_value', 'risk_reward'])}
              onChange={value => { setAxisPreset(value as IdeaBoardConfig['axis_preset']); markPrimaryModified() }}
            />
          )}
          {controlsSubtype === 'CLOUD_ARCHITECTURE' && (
            <>
              <SelectField
                label="Provider"
                value={provider}
                options={strings(subtypeCatalog.config.provider, ['auto', 'aws', 'gcp', 'azure', 'generic'])}
                onChange={value => {
                  setProvider(value as ProviderSelection)
                  setConfirmedProviderConflictKey(null)
                  markPrimaryModified()
                }}
              />
              {providerConflict && (
                <label className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] leading-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                  <input
                    type="checkbox"
                    checked={providerConflictConfirmed}
                    onChange={event => setConfirmedProviderConflictKey(
                      event.target.checked ? currentProviderConflictKey : null,
                    )}
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
          {controlsSubtype === 'CUSTOM' && (
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
      ) : null}

      {showAdvanced && (
        <div className="space-y-2 border-t border-slate-200 pt-2 dark:border-slate-700">
          {controlsSubtype !== 'CODE_DISPLAY' && (
            <ThemeSourceSelector
              presentationId={presentationId}
              value={themeSource}
              onChange={value => {
                markControlsModified()
                updateThemeSource(value)
              }}
            />
          )}

          {controlsSubtype === 'CODE_DISPLAY' && (
            <>
              <ToggleRow
                label="Text Size"
                field="text_size"
                value={textSize}
                options={['small', 'medium', 'large'].map(value => ({ value, label: humanize(value) }))}
                onChange={(_, value) => { setTextSize(value as CodeDisplayConfig['text_size']); markControlsModified() }}
              />
              <div className="grid grid-cols-2 gap-2">
                <ToggleRow
                  label="Line Numbers"
                  field="show_line_numbers"
                  value={showLineNumbers ? 'true' : 'false'}
                  options={[{ value: 'true', label: 'Show' }, { value: 'false', label: 'Hide' }]}
                  onChange={(_, value) => { setShowLineNumbers(value === 'true'); markControlsModified() }}
                />
                <ToggleRow
                  label="Copy Button"
                  field="show_copy_button"
                  value={showCopyButton ? 'true' : 'false'}
                  options={[{ value: 'true', label: 'Show' }, { value: 'false', label: 'Hide' }]}
                  onChange={(_, value) => { setShowCopyButton(value === 'true'); markControlsModified() }}
                />
              </div>
              <ToggleRow
                label="Corners"
                field="corner_style"
                value={cornerStyle}
                options={[{ value: 'rounded', label: 'Rounded' }, { value: 'square', label: 'Square' }]}
                onChange={(_, value) => { setCornerStyle(value as CodeDisplayConfig['corner_style']); markControlsModified() }}
              />
            </>
          )}

          {controlsSubtype && controlsSubtype !== 'CODE_DISPLAY' && subtypeCatalog.config.theme?.enum && (
            <SelectField
              label="Named renderer theme"
              value={leafTheme}
              options={Array.from(new Set(['auto', ...strings(subtypeCatalog.config.theme, [])]))}
              onChange={value => { setLeafTheme(value as LeafTheme); markControlsModified() }}
              autoLabel="Auto (Deck Theme)"
            />
          )}

          {controlsSubtype === 'CLOUD_ARCHITECTURE' && (
            <ToggleRow
              label="Show Layers"
              field="show_layers"
              value={showLayers ? 'true' : 'false'}
              options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
              onChange={(_, value) => { setShowLayers(value === 'true'); markControlsModified() }}
            />
          )}
          {controlsSubtype === 'DATA_ARCHITECTURE' && (
            <div className="grid grid-cols-2 gap-2">
              <ToggleRow
                label="Data Types"
                field="show_data_types"
                value={showDataTypes ? 'true' : 'false'}
                options={[{ value: 'true', label: 'Show' }, { value: 'false', label: 'Hide' }]}
                onChange={(_, value) => { setShowDataTypes(value === 'true'); markControlsModified() }}
              />
              <ToggleRow
                label="Nullable"
                field="show_nullable"
                value={showNullable ? 'true' : 'false'}
                options={[{ value: 'true', label: 'Show' }, { value: 'false', label: 'Hide' }]}
                onChange={(_, value) => { setShowNullable(value === 'true'); markControlsModified() }}
              />
            </div>
          )}

          {controlsSubtype && (
            <SelectField
              label="Position"
              value={positionPreset}
              options={Array.from(new Set([
                'auto',
                ...strings(subtypeCatalog.config.position_preset, []),
              ]))}
              onChange={value => { setPositionPreset(value); markControlsModified() }}
            />
          )}
          <ZIndexInput
            value={zIndex}
            onChange={setZIndex}
            onAdvancedModified={markControlsModified}
          />
        </div>
      )}
    </fieldset>
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

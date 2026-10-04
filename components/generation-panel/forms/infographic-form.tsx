'use client'

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Plus, RotateCcw, Trash2, Upload } from 'lucide-react'
import type {
  InfographicConfig,
  InfographicFormData,
  InfographicMode,
  InfographicSegmentCount,
  InfographicV2Segment,
} from '@/types/textlabs'
import {
  GRID_CELL_SIZE,
  POSITION_PRESETS,
  TEXT_LABS_ELEMENT_DEFAULTS,
} from '@/types/textlabs'
import {
  buildSparseInfographicConfig,
  inferExistingInfographicMode,
  isInfographicDesignPathLocked,
  resolveInfographicDesignMode,
  validateManualInfographicSegments,
} from '@/lib/infographic-config'
import type {
  ElementContext,
  GenerationPanelDraft,
  GenerationPanelProps,
  MandatoryConfig,
} from '../types'
import { CollapsibleSection } from '../shared/collapsible-section'
import { ZIndexInput } from '../shared/z-index-input'
import { ThemeSourceSelector } from '../shared/theme-source-selector'
import { useThemeSourceState } from '../shared/use-theme-source-state'

import './studio-content-fields.css'

const STUDIO_CONTENT_FIELDS = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.INFOGRAPHIC
const INFOGRAPHIC_OVERRIDE_KEYS = [
  'aspect_ratio',
  'crop_mode',
  'target_background',
  'fill_internal',
  'layout_family',
  'template_id',
  'text_mode',
  'show_icons',
] as const

type InfographicOverrides = Partial<Pick<
  InfographicConfig,
  | 'aspect_ratio'
  | 'crop_mode'
  | 'target_background'
  | 'fill_internal'
  | 'layout_family'
  | 'template_id'
  | 'segment_colors'
  | 'text_mode'
  | 'show_icons'
>>

// Keep raw local edits and File identity outside the normalized submit envelope.
export interface InfographicControlsDraft {
  referenceImage: File | null
  operation: 'generate' | 'edit' | 'variation'
  mode: InfographicMode
  segmentCount?: InfographicSegmentCount
  contentMode: 'automatic' | 'manual'
  segmentRows: InfographicV2Segment[]
  manualContentError: string | null
  overrides: InfographicOverrides
  segmentColorsInput: string
  positionModified: boolean
  geometryEdited?: boolean
  geometryContext?: ElementContext | null
  zIndex: number
  themeSource: ReturnType<typeof useThemeSourceState>['themeSource']
  positionPreset: string
  startCol: number
  startRow: number
  width: number
  height: number
  showPosition: boolean
}

interface InfographicFormProps {
  onSubmit: (formData: InfographicFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  presentationId?: string | null
  elementContext?: ElementContext | null
  targetElementId?: string | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig | MandatoryConfig[]) => void
  initialDraft?: GenerationPanelDraft | null
  onDraftChange?: (draft: Partial<GenerationPanelDraft>) => void
  panelMode: GenerationPanelProps['mode']
  existingTarget?: GenerationPanelProps['existingInfographicTarget']
}

function calculateGCD(a: number, b: number): number {
  return b === 0 ? a : calculateGCD(b, a % b)
}

function studioSegmentField(label: string, control: ReactNode): ReactNode {
  return STUDIO_CONTENT_FIELDS ? (
    <label data-studio-content-field="segment">
      <span>{label}</span>
      {control}
    </label>
  ) : control
}

function emptySegment(): InfographicV2Segment {
  return { label: '', sublabel: '', description: '', icon_hint: '' }
}

export function InfographicForm({
  onSubmit,
  registerSubmit,
  isGenerating,
  presentationId,
  elementContext,
  targetElementId,
  prompt,
  showAdvanced,
  registerMandatoryConfig,
  initialDraft,
  onDraftChange,
  panelMode,
  existingTarget,
}: InfographicFormProps) {
  const controlsDraftRef = useRef(STUDIO_CONTENT_FIELDS ? initialDraft?.infographicControls : undefined)
  const controlsDraft = controlsDraftRef.current
  const [referenceImage, setReferenceImage] = useState<File | null>(controlsDraft?.referenceImage ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hydratedTargetRef = useRef(false)
  const draftFormData = initialDraft?.formData?.componentType === 'INFOGRAPHIC'
    ? initialDraft.formData
    : null
  const draftInfographicConfig = draftFormData?.infographicConfig
  const [operation, setOperation] = useState<'generate' | 'edit' | 'variation'>(() => controlsDraft?.operation ?? (
    panelMode === 'refine'
      ? draftInfographicConfig?.operation === 'variation' ? 'variation' : 'edit'
      : 'generate'
  ))
  const [mode, setMode] = useState<InfographicMode>(controlsDraft?.mode ?? 'v1')
  const [segmentCount, setSegmentCount] = useState<InfographicSegmentCount | undefined>(controlsDraft?.segmentCount)
  const [contentMode, setContentMode] = useState<'automatic' | 'manual'>(controlsDraft?.contentMode ?? 'automatic')
  const [segmentRows, setSegmentRows] = useState<InfographicV2Segment[]>(controlsDraft?.segmentRows ?? [])
  const [manualContentError, setManualContentError] = useState<string | null>(controlsDraft?.manualContentError ?? null)
  const [overrides, setOverrides] = useState<InfographicOverrides>(controlsDraft?.overrides ?? {})
  const [segmentColorsInput, setSegmentColorsInput] = useState(controlsDraft?.segmentColorsInput ?? '')
  const [positionModified, setPositionModified] = useState(controlsDraft?.positionModified ?? false)
  const [geometryEdited, setGeometryEdited] = useState(
    controlsDraft?.geometryEdited ?? controlsDraft?.positionModified ?? false,
  )
  const geometryContextRef = useRef<ElementContext | null>(controlsDraft?.geometryContext ?? null)
  const geometryContextInitializedRef = useRef(false)
  const [zIndex, setZIndex] = useState(controlsDraft?.zIndex ?? DEFAULTS.zIndex)
  const { themeSource, updateThemeSource, useDeckTheme, themeOverrides } = useThemeSourceState(presentationId, controlsDraft?.themeSource)

  const [positionPreset, setPositionPreset] = useState(controlsDraft?.positionPreset ?? 'custom')
  const [startCol, setStartCol] = useState(controlsDraft?.startCol ?? 2)
  const [startRow, setStartRow] = useState(controlsDraft?.startRow ?? 4)
  const [width, setWidth] = useState(controlsDraft?.width ?? DEFAULTS.width)
  const [height, setHeight] = useState(controlsDraft?.height ?? DEFAULTS.height)
  const [showPosition, setShowPosition] = useState(controlsDraft?.showPosition ?? false)
  const existingMode = inferExistingInfographicMode(existingTarget)
  const designPathLocked = isInfographicDesignPathLocked({ panelMode, operation })
  const canUseReferenceImage = !designPathLocked || existingMode === 'v1'

  useEffect(() => {
    if (!elementContext) return
    if (STUDIO_CONTENT_FIELDS) {
      // Blank tracking updates after panel activation. Ignore another target's
      // transient context until the active draft's native identity arrives.
      if (targetElementId && elementContext.elementId && targetElementId !== elementContext.elementId) return
      const previous = geometryContextRef.current
      const firstContext = !geometryContextInitializedRef.current
      const sameOwner = !previous?.elementId || !elementContext.elementId
        || previous.elementId === elementContext.elementId
      const sameBounds = previous?.startCol === elementContext.startCol
        && previous?.startRow === elementContext.startRow
        && previous?.width === elementContext.width
        && previous?.height === elementContext.height
      geometryContextInitializedRef.current = true
      geometryContextRef.current = {
        elementId: elementContext.elementId,
        startCol: elementContext.startCol, startRow: elementContext.startRow,
        width: elementContext.width, height: elementContext.height,
      }
      // A target-local unsent override wins over an unchanged native context.
      // A real move/replacement owns new bounds. Older in-memory drafts have no
      // context witness, so retain their explicit geometry on the first handoff.
      if (geometryEdited && sameOwner && (sameBounds || (firstContext && !previous))) return
      setGeometryEdited(false)
    }
    setStartCol(elementContext.startCol)
    setStartRow(elementContext.startRow)
    setWidth(elementContext.width)
    setHeight(elementContext.height)
    setPositionPreset('custom')
  }, [elementContext, STUDIO_CONTENT_FIELDS ? targetElementId : null])

  // A refine target can be a raster V1 image or V2 HTML persisted through the
  // diagram renderer. Preserve that path instead of silently reverting V2 to V1.
  // New target activations remount the form through FormRouter's activation
  // key; a same-target close/reopen intentionally retains the live UAT draft.
  useEffect(() => {
    if (hydratedTargetRef.current) return
    hydratedTargetRef.current = true
    if (controlsDraft) return

    const draftConfig = draftInfographicConfig
    if (draftFormData && draftConfig) {
      const draftMode = draftConfig.mode === 'v2' ? 'v2' : 'v1'
      const draftSegments = Array.isArray(draftConfig.segments)
        ? draftConfig.segments.map(segment => ({ ...segment }))
        : []
      const draftOverrides: InfographicOverrides = {}
      for (const key of INFOGRAPHIC_OVERRIDE_KEYS) {
        const value = draftConfig[key]
        if (value !== undefined && value !== null) {
          ;(draftOverrides as Record<string, unknown>)[key] = value
        }
      }

      setMode(draftMode)
      setOperation(
        panelMode === 'refine'
          ? draftConfig.operation === 'variation' ? 'variation' : 'edit'
          : 'generate',
      )
      setReferenceImage(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setSegmentCount(
        typeof draftConfig.segment_count === 'number'
          ? draftConfig.segment_count
          : undefined,
      )
      setContentMode(
        draftConfig.content_mode === 'manual' || draftSegments.length > 0
          ? 'manual'
          : 'automatic',
      )
      setSegmentRows(draftSegments)
      setManualContentError(null)
      setOverrides(draftOverrides)
      setSegmentColorsInput(
        Array.isArray(draftConfig.segment_colors)
          ? draftConfig.segment_colors.join(', ')
          : '',
      )
      setStartCol(draftConfig.start_col ?? elementContext?.startCol ?? 2)
      setStartRow(draftConfig.start_row ?? elementContext?.startRow ?? 4)
      setWidth(draftConfig.width ?? elementContext?.width ?? DEFAULTS.width)
      setHeight(draftConfig.height ?? elementContext?.height ?? DEFAULTS.height)
      setPositionPreset('custom')
      setPositionModified(Boolean(draftFormData.advancedModified))
      setZIndex(draftFormData.z_index ?? DEFAULTS.zIndex)
      setShowPosition(false)
      updateThemeSource(
        draftFormData.useDeckTheme
          ? { mode: 'deck', overrides: null }
          : draftFormData.themeOverrides
            ? { mode: 'another', overrides: draftFormData.themeOverrides }
            : { mode: 'none', overrides: null },
      )
      return
    }

    if (panelMode === 'refine') {
      setMode(existingMode)
      setOperation('edit')
    } else {
      setMode('v1')
      setOperation('generate')
    }
    setReferenceImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setSegmentCount(undefined)
    setContentMode('automatic')
    setSegmentRows([])
    setManualContentError(null)
    setOverrides({})
    setSegmentColorsInput('')
    setPositionModified(false)
    setZIndex(DEFAULTS.zIndex)
    setShowPosition(false)
  }, [
    draftFormData,
    draftInfographicConfig,
    elementContext?.height,
    elementContext?.startCol,
    elementContext?.startRow,
    elementContext?.width,
    existingMode,
    panelMode,
    updateThemeSource,
  ])

  // A generated placeholder can transition into refinement without remounting
  // this form. Default that transition to source-aware editing while retaining
  // an explicit Create new variation choice on subsequent submissions.
  useEffect(() => {
    setOperation(previous => {
      if (panelMode !== 'refine') return 'generate'
      return previous === 'generate' ? 'edit' : previous
    })
  }, [panelMode])

  const clearReferenceImage = useCallback(() => {
    setReferenceImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const selectDesign = useCallback((nextMode: InfographicMode) => {
    const resolvedMode = resolveInfographicDesignMode({
      panelMode,
      operation,
      existingMode,
      requestedMode: nextMode,
    })
    setMode(resolvedMode)
    setManualContentError(null)
    if (resolvedMode === 'v2') clearReferenceImage()
  }, [clearReferenceImage, existingMode, operation, panelMode])

  const selectOperation = useCallback((value: string) => {
    const nextOperation = value === 'variation' ? 'variation' : 'edit'
    setOperation(nextOperation)
    if (nextOperation !== 'edit') return

    setMode(existingMode)
    setManualContentError(null)
    if (existingMode === 'v2') clearReferenceImage()
  }, [clearReferenceImage, existingMode])

  // Edit current is a minimum-delta operation on the existing renderer. Keep
  // the generation path source-aware even when a stale draft or a prior
  // Create-new selection tries to restore an incompatible mode.
  useEffect(() => {
    const resolvedMode = resolveInfographicDesignMode({
      panelMode,
      operation,
      existingMode,
      requestedMode: mode,
    })
    if (resolvedMode !== mode) setMode(resolvedMode)
    if (designPathLocked && existingMode === 'v2') clearReferenceImage()
  }, [
    clearReferenceImage,
    designPathLocked,
    existingMode,
    mode,
    operation,
    panelMode,
  ])

  useEffect(() => {
    const referenceConfig: MandatoryConfig = {
      fieldLabel: 'Reference',
      displayLabel: referenceImage ? referenceImage.name : 'No image',
      onChange: () => {},
      promptPlaceholder: 'e.g., A five-stage process from hypothesis to publication',
      customRender: (
        <div data-studio-content-reference={STUDIO_CONTENT_FIELDS ? 'true' : undefined} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating}
            title="Reference images use Creative design"
            className="flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200"
          >
            <Upload className="h-3 w-3 text-gray-400 dark:text-slate-500" />
            <span className="max-w-[100px] truncate">
              {referenceImage ? referenceImage.name : 'Ref. Image'}
            </span>
          </button>
          {referenceImage && (
            <button
              type="button"
              aria-label={STUDIO_CONTENT_FIELDS ? 'Remove infographic reference image' : undefined}
              onClick={clearReferenceImage}
              className="text-[10px] text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              &times;
            </button>
          )}
        </div>
      ),
    }
    if (panelMode !== 'refine') {
      registerMandatoryConfig(referenceConfig)
      return
    }
    const operationConfig: MandatoryConfig = {
      fieldLabel: 'Infographic operation',
      displayLabel: operation === 'edit' ? 'Edit current' : 'Create new variation',
      selectedValue: operation,
      nativeSelect: true,
      options: [
        { value: 'edit', label: 'Edit current' },
        { value: 'variation', label: 'Create new variation' },
      ],
      onChange: selectOperation,
    }
    registerMandatoryConfig(
      canUseReferenceImage ? [operationConfig, referenceConfig] : operationConfig,
    )
  }, [
    canUseReferenceImage,
    clearReferenceImage,
    isGenerating,
    operation,
    panelMode,
    referenceImage,
    registerMandatoryConfig,
    selectOperation,
  ])

  const updateOverride = useCallback(<K extends keyof InfographicOverrides>(
    field: K,
    value: InfographicOverrides[K] | undefined,
  ) => {
    setOverrides(previous => {
      const next = { ...previous }
      if (value === undefined || value === null || value === '') delete next[field]
      else next[field] = value
      return next
    })
  }, [])

  const resetOptionsToAuto = useCallback(() => {
    setSegmentCount(undefined)
    setContentMode('automatic')
    setSegmentRows([])
    setManualContentError(null)
    setOverrides({})
    setSegmentColorsInput('')
  }, [])

  const setManualMode = useCallback(() => {
    setSegmentCount(undefined)
    setContentMode('manual')
    setSegmentRows(previous => previous.length >= 2 ? previous : [emptySegment(), emptySegment()])
    setManualContentError(null)
  }, [])

  const updateSegment = useCallback((
    index: number,
    field: keyof InfographicV2Segment,
    value: string,
  ) => {
    setSegmentRows(previous => previous.map((segment, rowIndex) => (
      rowIndex === index ? { ...segment, [field]: value } : segment
    )))
    setManualContentError(null)
  }, [])

  const applyPositionPreset = useCallback((key: string) => {
    const preset = POSITION_PRESETS[key]
    if (!preset) return
    setPositionPreset(key)
    setStartCol(preset.start_col)
    setStartRow(preset.start_row)
    setWidth(preset.width)
    setHeight(preset.height)
    setPositionModified(true)
    if (STUDIO_CONTENT_FIELDS) setGeometryEdited(true)
  }, [])

  useEffect(() => {
    if (!STUDIO_CONTENT_FIELDS || !onDraftChange) return
    onDraftChange({
      prompt, showAdvanced,
      infographicControls: {
        referenceImage, operation, mode, segmentCount, contentMode, segmentRows,
        manualContentError, overrides, segmentColorsInput, positionModified, zIndex,
        geometryEdited, geometryContext: geometryContextRef.current,
        themeSource, positionPreset, startCol, startRow, width, height, showPosition,
      },
    })
  }, [
    onDraftChange, prompt, showAdvanced, referenceImage, operation, mode, segmentCount, contentMode, segmentRows,
    manualContentError, overrides, segmentColorsInput, positionModified, zIndex,
    geometryEdited, elementContext, themeSource, positionPreset, startCol, startRow, width, height, showPosition,
  ])

  const handleSubmit = useCallback(() => {
    const submitMode = resolveInfographicDesignMode({
      panelMode,
      operation,
      existingMode,
      requestedMode: mode,
    })
    if (submitMode === 'v2' && contentMode === 'manual') {
      const error = validateManualInfographicSegments(segmentRows)
      if (error) {
        setManualContentError(error)
        return
      }
    }

    const segmentColors = segmentColorsInput.split(',').map(value => value.trim()).filter(Boolean)
    const sparseOverrides: InfographicOverrides = {
      ...overrides,
      segment_colors: segmentColors.length ? segmentColors : undefined,
    }
    const infographicConfig = buildSparseInfographicConfig({
      mode: submitMode,
      operation: panelMode === 'refine'
        ? operation === 'variation' ? 'variation' : 'edit'
        : undefined,
      geometry: { start_col: startCol, start_row: startRow, width, height },
      segmentCount,
      contentMode: submitMode === 'v2' ? contentMode : 'automatic',
      manualSegments: submitMode === 'v2' && contentMode === 'manual' ? segmentRows : undefined,
      overrides: sparseOverrides,
    })
    const advancedModified = segmentCount !== undefined
      || contentMode === 'manual'
      || Object.keys(sparseOverrides).some(key => sparseOverrides[key as keyof InfographicOverrides] !== undefined)
      || positionModified
      || zIndex !== DEFAULTS.zIndex

    onSubmit({
      componentType: 'INFOGRAPHIC',
      prompt: prompt.trim() || (referenceImage
        ? 'Recreate infographic from reference image'
        : 'Generate an infographic'),
      count: 1,
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      presentationId,
      useDeckTheme,
      themeOverrides,
      infographicConfig,
      referenceImage: submitMode === 'v1' ? referenceImage : null,
    })
  }, [
    contentMode,
    existingMode,
    height,
    mode,
    onSubmit,
    operation,
    overrides,
    positionModified,
    panelMode,
    presentationId,
    prompt,
    referenceImage,
    segmentColorsInput,
    segmentCount,
    segmentRows,
    startCol,
    startRow,
    themeOverrides,
    useDeckTheme,
    width,
    zIndex,
  ])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [handleSubmit, registerSubmit])

  const pixelW = width * GRID_CELL_SIZE
  const pixelH = height * GRID_CELL_SIZE
  const gcd = calculateGCD(Math.round(pixelW * 10), Math.round(pixelH * 10))
  const displayAspect = `${Math.round(pixelW * 10) / gcd}:${Math.round(pixelH * 10) / gcd}`

  return (
    <div data-studio-content-form={STUDIO_CONTENT_FIELDS ? 'infographic' : undefined} className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={event => {
          if (!canUseReferenceImage) {
            event.currentTarget.value = ''
            return
          }
          const file = event.target.files?.[0] ?? null
          setReferenceImage(file)
          if (file) {
            setMode('v1')
            setContentMode('automatic')
            setSegmentRows([])
            setManualContentError(null)
          }
        }}
        className="hidden"
      />

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="mb-2">
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Design</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            {designPathLocked
              ? 'Edit current keeps the existing generation path.'
              : 'Choose the generation path. Creative is the default.'}
          </div>
        </div>
        {designPathLocked ? (
          <div
            role="status"
            data-studio-content-design={STUDIO_CONTENT_FIELDS ? 'locked' : undefined}
            aria-label="Locked infographic design"
            className="rounded-md border border-primary bg-primary px-2 py-2 text-left text-white"
          >
            <span className="block text-[11px] font-semibold">
              {existingMode === 'v2' ? 'Structured' : 'Creative'}
            </span>
            <span className="mt-0.5 block text-[9px] leading-3.5 text-white/80">
              {existingMode === 'v2'
                ? 'Editing ordered content with its deterministic layout.'
                : 'Editing the existing AI-designed image.'}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Infographic design">
            {([
              ['v1', 'Creative', 'AI-designed image; supports a reference image.'],
              ['v2', 'Structured', 'Ordered, editable process content with deterministic layout.'],
            ] as const).map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                disabled={isGenerating}
                data-studio-content-design={STUDIO_CONTENT_FIELDS ? 'choice' : undefined}
                aria-pressed={mode === value}
                onClick={() => selectDesign(value)}
                className={`rounded-md border px-2 py-2 text-left transition-colors disabled:opacity-50 ${
                  mode === value
                    ? 'border-primary bg-primary text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                <span className="block text-[11px] font-semibold">{label}</span>
                <span className={`mt-0.5 block text-[9px] leading-3.5 ${
                  mode === value ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {description}
                </span>
              </button>
            ))}
          </div>
        )}
        {referenceImage && (
          <p className="mt-1.5 text-[9px] text-slate-500 dark:text-slate-400">
            The attached reference keeps Creative selected. Choosing Structured removes it.
          </p>
        )}
      </section>

      {showAdvanced && (
        <>
          <section className="space-y-2.5 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Advanced</div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400">
                  Automatic unless you explicitly override a field.
                </div>
              </div>
              <button
                type="button"
                onClick={resetOptionsToAuto}
                className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80"
              >
                <RotateCcw className="h-3 w-3" />
                Reset to Auto
              </button>
            </div>

            <ThemeSourceSelector
              presentationId={presentationId}
              value={themeSource}
              onChange={updateThemeSource}
            />

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Aspect Ratio</span>
                <select
                  value={overrides.aspect_ratio ?? ''}
                  onChange={event => updateOverride(
                    'aspect_ratio',
                    event.target.value
                      ? event.target.value as NonNullable<InfographicConfig['aspect_ratio']>
                      : undefined,
                  )}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value="">Auto</option>
                  {['16:9', '4:3', '1:1', '3:2', '9:16'].map(value => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Segment Count</span>
                <select
                  value={segmentCount ?? ''}
                  disabled={mode === 'v2' && contentMode === 'manual'}
                  onChange={event => setSegmentCount(
                    event.target.value
                      ? Number(event.target.value) as InfographicSegmentCount
                      : undefined,
                  )}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value="">Auto</option>
                  {[2, 3, 4, 5, 6, 7, 8].map(value => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Crop</span>
                <select
                  value={overrides.crop_mode ?? ''}
                  onChange={event => updateOverride(
                    'crop_mode',
                    event.target.value
                      ? event.target.value as NonNullable<InfographicConfig['crop_mode']>
                      : undefined,
                  )}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value="">Auto</option>
                  <option value="shape">Shape</option>
                  <option value="content">Content</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Background</span>
                <select
                  value={overrides.target_background ?? ''}
                  onChange={event => updateOverride(
                    'target_background',
                    event.target.value
                      ? event.target.value as NonNullable<InfographicConfig['target_background']>
                      : undefined,
                  )}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value="">Auto</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Fill Internal</span>
                <select
                  value={overrides.fill_internal === undefined ? '' : String(overrides.fill_internal)}
                  onChange={event => updateOverride(
                    'fill_internal',
                    event.target.value === '' ? undefined : event.target.value === 'true',
                  )}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                >
                  <option value="">Auto</option>
                  <option value="true">On</option>
                  <option value="false">Off</option>
                </select>
              </label>
            </div>

            {mode === 'v2' && (
              <div className="space-y-2.5 rounded-md border border-slate-200 p-2 dark:border-slate-700">
                <div className="space-y-1">
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Content</div>
                  <div className="grid grid-cols-2 gap-1" role="group" aria-label="Structured content mode">
                    <button
                      type="button"
                      aria-pressed={contentMode === 'automatic'}
                      onClick={() => {
                        setContentMode('automatic')
                        setSegmentRows([])
                        setManualContentError(null)
                      }}
                      className={`rounded border px-2 py-1 text-[10px] font-medium ${
                        contentMode === 'automatic'
                          ? 'border-primary bg-primary text-white'
                          : 'border-slate-300 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      Automatic
                    </button>
                    <button
                      type="button"
                      aria-pressed={contentMode === 'manual'}
                      onClick={setManualMode}
                      className={`rounded border px-2 py-1 text-[10px] font-medium ${
                        contentMode === 'manual'
                          ? 'border-primary bg-primary text-white'
                          : 'border-slate-300 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      Manual rows
                    </button>
                  </div>
                  <p className="text-[9px] leading-3.5 text-slate-500 dark:text-slate-400">
                    Automatic plans meaningful rows from your prompt and slide context. Manual rows are authoritative.
                  </p>
                </div>

                {contentMode === 'manual' && (
                  <div className="space-y-2">
                    {segmentRows.map((segment, index) => (
                      <div data-studio-content-part={STUDIO_CONTENT_FIELDS ? 'manual-row' : undefined} key={index} className="space-y-1.5 rounded border border-slate-200 p-2 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                            Row {index + 1}
                          </span>
                          <button
                            type="button"
                            disabled={segmentRows.length <= 2}
                            onClick={() => setSegmentRows(previous => previous.filter((_, row) => row !== index))}
                            aria-label={`Remove row ${index + 1}`}
                            className="text-slate-400 hover:text-red-500 disabled:opacity-30"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <div data-studio-content-part={STUDIO_CONTENT_FIELDS ? 'row-pair' : undefined} className="grid grid-cols-2 gap-1.5">
                          {studioSegmentField('Heading', (
                            <input
                              aria-label={STUDIO_CONTENT_FIELDS ? `Row ${index + 1} heading` : undefined}
                              value={segment.label}
                              onChange={event => updateSegment(index, 'label', event.target.value)}
                              placeholder="Heading"
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                            />
                          ))}
                          {studioSegmentField('Short explanatory line', (
                            <input
                              aria-label={STUDIO_CONTENT_FIELDS ? `Row ${index + 1} short explanatory line` : undefined}
                              value={segment.sublabel ?? ''}
                              onChange={event => updateSegment(index, 'sublabel', event.target.value)}
                              placeholder="Short explanatory line"
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                            />
                          ))}
                        </div>
                        {studioSegmentField('Relevant icon hint', (
                          <input
                            aria-label={STUDIO_CONTENT_FIELDS ? `Row ${index + 1} relevant icon hint` : undefined}
                            value={segment.icon_hint ?? ''}
                            onChange={event => updateSegment(index, 'icon_hint', event.target.value)}
                            placeholder="Relevant icon hint"
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                          />
                        ))}
                        {studioSegmentField('Supporting description', (
                          <textarea
                            aria-label={STUDIO_CONTENT_FIELDS ? `Row ${index + 1} supporting description` : undefined}
                            value={segment.description ?? ''}
                            onChange={event => updateSegment(index, 'description', event.target.value)}
                            rows={2}
                            placeholder="Supporting description"
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                          />
                        ))}
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={segmentRows.length >= 8}
                      onClick={() => setSegmentRows(previous => [...previous, emptySegment()])}
                      className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Plus className="h-3 w-3" />
                      Add row
                    </button>
                    {manualContentError && (
                      <p data-studio-content-notice={STUDIO_CONTENT_FIELDS ? 'error' : undefined} role={STUDIO_CONTENT_FIELDS ? 'alert' : undefined} className="text-[10px] leading-4 text-red-500">{manualContentError}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-500">Layout</span>
                    <select
                      value={overrides.layout_family ?? ''}
                      onChange={event => updateOverride(
                        'layout_family',
                        event.target.value
                          ? event.target.value as NonNullable<InfographicConfig['layout_family']>
                          : undefined,
                      )}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                    >
                      <option value="">Auto</option>
                      <option value="horizontal_top">Horizontal Top</option>
                      <option value="horizontal_center">Horizontal Center</option>
                      <option value="vertical_left">Vertical Left</option>
                      <option value="vertical_center">Vertical Center</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-500">Text</span>
                    <select
                      value={overrides.text_mode ?? ''}
                      onChange={event => updateOverride(
                        'text_mode',
                        event.target.value
                          ? event.target.value as NonNullable<InfographicConfig['text_mode']>
                          : undefined,
                      )}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                    >
                      <option value="">Auto</option>
                      <option value="none">None</option>
                      <option value="heading">Heading</option>
                      <option value="heading_sublabel">Heading + Sublabel</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-500">Icons</span>
                    <select
                      value={overrides.show_icons === undefined ? '' : String(overrides.show_icons)}
                      onChange={event => updateOverride(
                        'show_icons',
                        event.target.value === '' ? undefined : event.target.value === 'true',
                      )}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                    >
                      <option value="">Auto</option>
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-500">Template ID</span>
                    <input
                      value={overrides.template_id ?? ''}
                      onChange={event => updateOverride('template_id', event.target.value || undefined)}
                      placeholder="Auto"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                    />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-[10px] text-slate-500">Segment Colors</span>
                  <input
                    value={segmentColorsInput}
                    onChange={event => setSegmentColorsInput(event.target.value)}
                    placeholder="Auto, or #2563eb, #14b8a6"
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                  />
                </label>
              </div>
            )}
          </section>

          <CollapsibleSection
            title="Position"
            isOpen={showPosition}
            onToggle={() => setShowPosition(previous => !previous)}
          >
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1">
                {Object.entries(POSITION_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPositionPreset(key)}
                    className={`rounded border px-1.5 py-1 text-[10px] transition-colors ${
                      positionPreset === key
                        ? 'border-primary bg-primary text-white'
                        : 'border-slate-300 bg-slate-100 text-slate-500 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                Size: {width} × {height} grid ({pixelW} × {pixelH}px) — Aspect: {displayAspect}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Col', value: startCol, setter: setStartCol, min: 1, max: 32 },
                  { label: 'Row', value: startRow, setter: setStartRow, min: 1, max: 18 },
                  { label: 'Width', value: width, setter: setWidth, min: 0.2, max: 32 },
                  { label: 'Height', value: height, setter: setHeight, min: 0.2, max: 18 },
                ].map(({ label, value, setter, min, max }) => (
                  <label key={label} className="space-y-1">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{label}</span>
                    <input
                      type="number"
                      value={value}
                      min={min}
                      max={max}
                      step={0.2}
                      onChange={event => {
                        setter(Number(event.target.value))
                        setPositionPreset('custom')
                        setPositionModified(true)
                        if (STUDIO_CONTENT_FIELDS) setGeometryEdited(true)
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                    />
                  </label>
                ))}
              </div>
              <ZIndexInput
                value={zIndex}
                onChange={setZIndex}
                onAdvancedModified={() => setPositionModified(true)}
              />
            </div>
          </CollapsibleSection>
        </>
      )}
    </div>
  )
}

InfographicForm.displayName = 'InfographicForm'

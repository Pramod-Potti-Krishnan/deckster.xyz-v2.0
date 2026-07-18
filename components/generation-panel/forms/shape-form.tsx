'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { ShapeFormData, ShapeConfig, TextLabsShapeType, TextLabsPaddingConfig, TEXT_LABS_ELEMENT_DEFAULTS, GRID_CELL_SIZE } from '@/types/textlabs'
import { ElementContext, GenerationPanelDraft, MandatoryConfig, MandatoryFieldOption } from '../types'
import { CollapsibleSection } from '../shared/collapsible-section'
import { PaddingControl } from '../shared/padding-control'
import { ZIndexInput } from '../shared/z-index-input'
import { ThemeSourceSelector } from '../shared/theme-source-selector'
import { useThemeSourceState } from '../shared/use-theme-source-state'
import { useDeckThemePalette } from '@/hooks/use-deck-theme-palette'
import { resolveDraftThemeSource } from '@/lib/visual-form-draft'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.SHAPE
type ShapeOverrideField =
  | 'sides'
  | 'fill'
  | 'stroke'
  | 'strokeWidth'
  | 'opacity'
  | 'rotation'
  | 'size'
  | 'background'
  | 'position'
  | 'padding'

// Backend-aligned: Illustrator currently exposes 24 direct shape types plus custom.
const SHAPE_TYPE_GROUPS: { group: string; types: { value: TextLabsShapeType; label: string }[] }[] = [
  { group: 'Core', types: [
    { value: 'circle', label: 'Circle' },
    { value: 'ellipse', label: 'Ellipse' },
    { value: 'square', label: 'Square' },
    { value: 'rectangle', label: 'Rectangle' },
    { value: 'triangle', label: 'Triangle' },
  ] },
  { group: 'Polygons', types: [
    { value: 'pentagon', label: 'Pentagon' },
    { value: 'hexagon', label: 'Hexagon' },
    { value: 'heptagon', label: 'Heptagon' },
    { value: 'octagon', label: 'Octagon' },
    { value: 'polygon', label: 'N-sided Polygon' },
  ] },
  { group: 'Quadrilaterals', types: [
    { value: 'rhombus', label: 'Rhombus' },
    { value: 'parallelogram', label: 'Parallelogram' },
    { value: 'trapezoid', label: 'Trapezoid' },
    { value: 'kite', label: 'Kite' },
  ] },
  { group: 'Lines', types: [
    { value: 'line-horizontal', label: 'Horizontal Line' },
    { value: 'line-vertical', label: 'Vertical Line' },
    { value: 'line-diagonal', label: 'Diagonal Line' },
  ] },
  { group: 'Special', types: [
    { value: 'star', label: 'Star' },
    { value: 'cross', label: 'Cross' },
    { value: 'arrow', label: 'Arrow' },
    { value: 'doughnut', label: 'Doughnut' },
    { value: 'cloud', label: 'Cloud' },
    { value: 'heart', label: 'Heart' },
    { value: 'crescent', label: 'Crescent' },
    { value: 'custom', label: 'Custom' },
  ] },
]

const SHAPE_COLOR_PRESETS: MandatoryFieldOption[] = [
  { value: '#3B82F6', label: 'Blue', color: '#3B82F6' },
  { value: '#7C3AED', label: 'Purple', color: '#7C3AED' },
  { value: '#0D9488', label: 'Teal', color: '#0D9488' },
  { value: '#16A34A', label: 'Green', color: '#16A34A' },
  { value: '#EA580C', label: 'Orange', color: '#EA580C' },
  { value: '#334155', label: 'Slate', color: '#334155' },
]

/** Pixel to grid conversion */
function pxToGrid(px: number): number {
  return Math.max(1, Math.round(px / GRID_CELL_SIZE))
}

/** Grid to pixel conversion */
function gridToPx(grid: number): number {
  return grid * GRID_CELL_SIZE
}

interface ShapeFormProps {
  onSubmit: (formData: ShapeFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  presentationId?: string | null
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig | MandatoryConfig[]) => void
  initialDraft?: GenerationPanelDraft | null
}

export function ShapeForm({ onSubmit, registerSubmit, isGenerating, presentationId, elementContext, prompt, showAdvanced, registerMandatoryConfig, initialDraft }: ShapeFormProps) {
  const initialFormData = initialDraft?.formData?.componentType === 'SHAPE'
    ? initialDraft.formData
    : null
  const initialConfig = initialFormData?.shapeConfig || {}
  const initialExplicitFields = new Set<ShapeOverrideField>([
    ...('sides' in initialConfig ? ['sides' as const] : []),
    ...('fill_color' in initialConfig ? ['fill' as const] : []),
    ...('stroke_color' in initialConfig ? ['stroke' as const] : []),
    ...('stroke_width' in initialConfig ? ['strokeWidth' as const] : []),
    ...('opacity' in initialConfig ? ['opacity' as const] : []),
    ...('rotation' in initialConfig ? ['rotation' as const] : []),
    ...('size' in initialConfig ? ['size' as const] : []),
    ...('target_background' in initialConfig ? ['background' as const] : []),
  ])
  const [count, setCount] = useState(initialFormData?.count ?? 1)
  const [shapeType, setShapeType] = useState<TextLabsShapeType>(initialConfig.shape_type || 'custom')
  const [sides, setSides] = useState(initialConfig.sides || 6)
  const [fillColor, setFillColor] = useState(initialConfig.fill_color || '#3B82F6')
  const [strokeColor, setStrokeColor] = useState(initialConfig.stroke_color || '#1E40AF')
  const [strokeWidth, setStrokeWidth] = useState(initialConfig.stroke_width ?? 2)
  const [opacity, setOpacity] = useState(initialConfig.opacity ?? 1.0)
  const [rotation, setRotation] = useState(initialConfig.rotation ?? 0)
  const [size, setSize] = useState<'small' | 'medium' | 'large'>(initialConfig.size || 'medium')
  const [targetBackground, setTargetBackground] = useState(initialConfig.target_background || 'light')
  const [advancedModified, setAdvancedModified] = useState(Boolean(initialFormData?.advancedModified))
  const [explicitFields, setExplicitFields] = useState<Set<ShapeOverrideField>>(() => initialExplicitFields)
  const [zIndex, setZIndex] = useState(initialFormData?.z_index ?? DEFAULTS.zIndex)
  const { themeSource, updateThemeSource, useDeckTheme, themeOverrides } = useThemeSourceState(
    presentationId,
    initialFormData ? resolveDraftThemeSource(presentationId, initialFormData) : null,
  )
  const { tokens: themeTokens } = useDeckThemePalette(presentationId)

  // Pixel-based position (primary)
  const [x, setX] = useState(initialConfig.x ?? 60)       // px, 0-1919
  const [y, setY] = useState(initialConfig.y ?? 180)      // px, 0-1079
  const [widthPx, setWidthPx] = useState(initialConfig.width_px ?? gridToPx(DEFAULTS.width))  // px, 1-1920
  const [heightPx, setHeightPx] = useState(initialConfig.height_px ?? gridToPx(DEFAULTS.height)) // px, 1-1080

  // Initialize from canvas context (grid→pixel)
  useEffect(() => {
    if (elementContext) {
      setX((elementContext.startCol - 1) * GRID_CELL_SIZE)
      setY((elementContext.startRow - 1) * GRID_CELL_SIZE)
      setWidthPx(elementContext.width * GRID_CELL_SIZE)
      setHeightPx(elementContext.height * GRID_CELL_SIZE)
    }
  }, [elementContext])

  // Padding
  const [paddingConfig, setPaddingConfig] = useState<TextLabsPaddingConfig>(initialFormData?.paddingConfig || {
    top: 0, right: 0, bottom: 0, left: 0,
  })
  const [showStyling, setShowStyling] = useState(false)
  const [showPosition, setShowPosition] = useState(false)
  const [showPadding, setShowPadding] = useState(false)

  const markExplicit = useCallback((...fields: ShapeOverrideField[]) => {
    setExplicitFields(previous => {
      const next = new Set(previous)
      fields.forEach(field => next.add(field))
      return next
    })
    setAdvancedModified(true)
  }, [])

  const clearExplicit = useCallback((field: ShapeOverrideField) => {
    setExplicitFields(previous => {
      const next = new Set(previous)
      next.delete(field)
      return next
    })
  }, [])

  const resetToAuto = useCallback(() => {
    setCount(1)
    setSides(6)
    setFillColor('#3B82F6')
    setStrokeColor('#1E40AF')
    setStrokeWidth(2)
    setOpacity(1)
    setRotation(0)
    setSize('medium')
    setTargetBackground('light')
    setX(elementContext ? (elementContext.startCol - 1) * GRID_CELL_SIZE : 60)
    setY(elementContext ? (elementContext.startRow - 1) * GRID_CELL_SIZE : 180)
    setWidthPx(gridToPx(elementContext?.width ?? DEFAULTS.width))
    setHeightPx(gridToPx(elementContext?.height ?? DEFAULTS.height))
    setPaddingConfig({ top: 0, right: 0, bottom: 0, left: 0 })
    setZIndex(DEFAULTS.zIndex)
    updateThemeSource({ mode: presentationId ? 'deck' : 'none', overrides: null })
    setExplicitFields(new Set())
    setAdvancedModified(false)
  }, [elementContext, presentationId, updateThemeSource])

  // Derived grid values (for display and API)
  const gridW = pxToGrid(widthPx)
  const gridH = pxToGrid(heightPx)
  const startCol = Math.max(1, Math.round(x / GRID_CELL_SIZE) + 1)
  const startRow = Math.max(1, Math.round(y / GRID_CELL_SIZE) + 1)

  // Register mandatory config — Shape Type
  const shapeLabel = SHAPE_TYPE_GROUPS.flatMap(group => group.types).find(t => t.value === shapeType)?.label || 'Custom'
  const colorOptions = useMemo(() => {
    const options: MandatoryFieldOption[] = [
      { value: 'theme', label: 'Theme', color: 'hsl(var(--primary))' },
      ...themeTokens.map(token => ({
        value: token.color,
        label: token.label,
        color: token.color,
      })),
      ...SHAPE_COLOR_PRESETS,
    ]
    const seen = new Set<string>()
    return options.filter(option => {
      const key = option.value.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [themeTokens])

  useEffect(() => {
    const colorLabel = (field: 'fill' | 'stroke', color: string) => {
      if (!explicitFields.has(field)) return 'Theme'
      return colorOptions.find(option => option.value.toLowerCase() === color.toLowerCase())?.label || 'Custom'
    }
    const colorConfig = (
      field: 'fill' | 'stroke',
      label: 'Fill' | 'Border',
      color: string,
      setColor: (value: string) => void,
    ): MandatoryConfig => {
      const selectedLabel = colorLabel(field, color)
      return {
        fieldLabel: `${label} color`,
        displayLabel: `${label}: ${selectedLabel}`,
        selectedValue: explicitFields.has(field) ? color : 'theme',
        options: colorOptions,
        onChange: (value) => {
          if (value === 'theme') {
            clearExplicit(field)
            return
          }
          setColor(value)
          markExplicit(field)
        },
      }
    }

    registerMandatoryConfig([
      {
        fieldLabel: 'Shape',
        displayLabel: shapeLabel,
        selectedValue: shapeType,
        optionGroups: SHAPE_TYPE_GROUPS.map(group => ({
          group: group.group,
          options: group.types.map(t => ({ value: t.value, label: t.label })),
        })),
        onChange: (value) => { setShapeType(value as TextLabsShapeType) },
        promptPlaceholder: shapeType === 'custom' ? 'e.g., three concentric circles' : 'e.g., a red star',
      },
      colorConfig('fill', 'Fill', fillColor, setFillColor),
      colorConfig('stroke', 'Border', strokeColor, setStrokeColor),
    ])
  }, [
    clearExplicit,
    colorOptions,
    explicitFields,
    fillColor,
    markExplicit,
    registerMandatoryConfig,
    shapeLabel,
    shapeType,
    strokeColor,
  ])

  const handleSubmit = useCallback(() => {
    const isCustom = shapeType === 'custom'
    const defaultPrompt = isCustom ? 'custom shape' : `blue ${shapeType}`

    const shapeConfig: Partial<ShapeConfig> = {
      shape_type: isCustom ? null : shapeType,
      prompt: isCustom ? (prompt || null) : null,
      ...(shapeType === 'polygon' && explicitFields.has('sides') ? { sides } : {}),
      ...(explicitFields.has('fill') ? { fill_color: fillColor } : {}),
      ...(explicitFields.has('stroke') ? { stroke_color: strokeColor } : {}),
      ...(explicitFields.has('strokeWidth') ? { stroke_width: strokeWidth } : {}),
      ...(explicitFields.has('opacity') ? { opacity } : {}),
      ...(explicitFields.has('rotation') ? { rotation } : {}),
      ...(explicitFields.has('size') ? { size } : {}),
      ...(explicitFields.has('background') ? { target_background: targetBackground } : {}),
      x,
      y,
      width_px: widthPx,
      height_px: heightPx,
      start_col: startCol,
      start_row: startRow,
      position_width: gridW,
      position_height: gridH,
    }

    const formData: ShapeFormData = {
      componentType: 'SHAPE',
      prompt: prompt || defaultPrompt,
      count,
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      presentationId,
      useDeckTheme,
      themeOverrides,
      shapeConfig,
      positionConfig: {
        start_col: startCol,
        start_row: startRow,
        position_width: gridW,
        position_height: gridH,
        auto_position: false,
      },
      paddingConfig,
    }
    onSubmit(formData)
  }, [prompt, count, shapeType, sides, fillColor, strokeColor, strokeWidth, opacity, rotation, size, targetBackground, x, y, widthPx, heightPx, startCol, startRow, gridW, gridH, explicitFields, advancedModified, zIndex, presentationId, useDeckTheme, themeOverrides, paddingConfig, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  return (
    <div className="space-y-2.5">
      {showAdvanced && (<>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/60">
        <div>
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Automatic details</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">Only changed fields override Illustrator defaults.</div>
        </div>
        <button type="button" onClick={resetToAuto} disabled={explicitFields.size === 0 && !advancedModified}
          className="rounded-md border border-slate-300 px-2 py-1 text-[10px] text-slate-600 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300">
          Reset to Auto
        </button>
      </div>
      {/* Section 1: Styling */}
      <CollapsibleSection title="Styling" isOpen={showStyling} onToggle={() => setShowStyling(!showStyling)}>
        <div className="space-y-2">
          <ThemeSourceSelector
            presentationId={presentationId}
            value={themeSource}
            onChange={selection => {
              updateThemeSource(selection)
              setAdvancedModified(true)
            }}
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Fill</label>
              <input
                type="color"
                value={fillColor}
                onChange={(e) => { setFillColor(e.target.value); markExplicit('fill') }}
                className="h-7 w-full rounded border border-gray-300 dark:border-slate-600 cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Border Color</label>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => { setStrokeColor(e.target.value); markExplicit('stroke') }}
                className="h-7 w-full rounded border border-gray-300 dark:border-slate-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Stroke Width</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={10}
                value={strokeWidth}
                onChange={(e) => { setStrokeWidth(Number(e.target.value)); markExplicit('strokeWidth') }}
                className="flex-1"
                style={{ accentColor: 'hsl(var(--primary))' }}
              />
              <span className="text-xs text-gray-400 dark:text-slate-500 w-8 text-right">{strokeWidth}px</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Target Background</label>
            <select
              value={targetBackground}
              onChange={(e) => { setTargetBackground(e.target.value); markExplicit('background') }}
              className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Opacity</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(e) => { setOpacity(Number(e.target.value) / 100); markExplicit('opacity') }}
                className="flex-1"
                style={{ accentColor: 'hsl(var(--primary))' }}
              />
              <span className="text-xs text-gray-400 dark:text-slate-500 w-8 text-right">{Math.round(opacity * 100)}%</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Rotation</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={359}
                value={rotation}
                onChange={(e) => { setRotation(Number(e.target.value)); markExplicit('rotation') }}
                className="flex-1"
                style={{ accentColor: 'hsl(var(--primary))' }}
              />
              <span className="text-xs text-gray-400 dark:text-slate-500 w-10 text-right">{rotation}&deg;</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Size</label>
            <div className="flex gap-1">
              {(['small', 'medium', 'large'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setSize(s)
                    // Size preset drives the shape's width/height (square-ish grid boxes).
                    const cells = s === 'small' ? 3 : s === 'large' ? 8 : 5
                    setWidthPx(gridToPx(cells))
                    setHeightPx(gridToPx(cells))
                    markExplicit('size', 'position')
                  }}
                  className={`flex-1 px-2 py-1 rounded text-xs font-medium capitalize transition-colors ${
                    size === s
                      ? 'bg-primary text-white border border-primary'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 border border-gray-300 dark:border-slate-600 hover:bg-gray-200 dark:hover:bg-slate-700 dark:bg-slate-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Count</label>
            <select
              value={count}
              onChange={(e) => { setCount(Number(e.target.value)); setAdvancedModified(true) }}
              className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {[1, 2, 3, 4, 5, 6].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Polygon Sides (conditional) */}
          {shapeType === 'polygon' && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-600 dark:text-slate-300">Number of Sides</label>
              <select
                value={sides}
                onChange={(e) => { setSides(Number(e.target.value)); markExplicit('sides') }}
                className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Array.from({ length: 10 }, (_, i) => i + 3).map(n => (
                  <option key={n} value={n}>{n} sides</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 2: Position */}
      <CollapsibleSection title="Position" isOpen={showPosition} onToggle={() => setShowPosition(!showPosition)}>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 dark:text-slate-500">X (px)</label>
              <input
                type="number"
                value={x}
                min={0}
                max={1919}
                onChange={(e) => { setX(Number(e.target.value)); markExplicit('position') }}
                className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 dark:text-slate-500">Y (px)</label>
              <input
                type="number"
                value={y}
                min={0}
                max={1079}
                onChange={(e) => { setY(Number(e.target.value)); markExplicit('position') }}
                className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 dark:text-slate-500">Width (px)</label>
              <input
                type="number"
                value={widthPx}
                min={1}
                max={1920}
                onChange={(e) => { setWidthPx(Number(e.target.value)); markExplicit('position') }}
                className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 dark:text-slate-500">Height (px)</label>
              <input
                type="number"
                value={heightPx}
                min={1}
                max={1080}
                onChange={(e) => { setHeightPx(Number(e.target.value)); markExplicit('position') }}
                className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Grid inputs (bidirectional sync with pixel) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 dark:text-slate-500">Col (grid)</label>
              <input
                type="number"
                value={startCol}
                min={1}
                max={32}
                step={0.2}
                onChange={(e) => { setX((Number(e.target.value) - 1) * GRID_CELL_SIZE); markExplicit('position') }}
                className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 dark:text-slate-500">Row (grid)</label>
              <input
                type="number"
                value={startRow}
                min={1}
                max={18}
                step={0.2}
                onChange={(e) => { setY((Number(e.target.value) - 1) * GRID_CELL_SIZE); markExplicit('position') }}
                className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 dark:text-slate-500">Width (grid)</label>
              <input
                type="number"
                value={gridW}
                min={0.2}
                max={32}
                step={0.2}
                onChange={(e) => { setWidthPx(Number(e.target.value) * GRID_CELL_SIZE); markExplicit('position') }}
                className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 dark:text-slate-500">Height (grid)</label>
              <input
                type="number"
                value={gridH}
                min={0.2}
                max={18}
                step={0.2}
                onChange={(e) => { setHeightPx(Number(e.target.value) * GRID_CELL_SIZE); markExplicit('position') }}
                className="w-full px-2 py-1 rounded bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100"
              />
            </div>
          </div>

          <ZIndexInput
            value={zIndex}
            onChange={setZIndex}
            onAdvancedModified={() => setAdvancedModified(true)}
          />
        </div>
      </CollapsibleSection>

      {/* Section 3: Container Padding */}
      <CollapsibleSection title="Container Padding" isOpen={showPadding} onToggle={() => setShowPadding(!showPadding)}>
        <PaddingControl
          paddingConfig={paddingConfig}
          onChange={setPaddingConfig}
          onAdvancedModified={() => markExplicit('padding')}
        />
      </CollapsibleSection>
      </>)}
    </div>
  )
}

ShapeForm.displayName = 'ShapeForm'

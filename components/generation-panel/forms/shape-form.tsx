'use client'

import { useState, useCallback, useEffect } from 'react'
import { ShapeFormData, ShapeConfig, TextLabsShapeType, TextLabsPaddingConfig, TEXT_LABS_ELEMENT_DEFAULTS, GRID_CELL_SIZE } from '@/types/textlabs'
import { ElementContext, MandatoryConfig } from '../types'
import { CollapsibleSection } from '../shared/collapsible-section'
import { PaddingControl } from '../shared/padding-control'
import { ZIndexInput } from '../shared/z-index-input'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.SHAPE

// Backend-aligned: 8 shape types
const SHAPE_TYPES: { value: TextLabsShapeType; label: string }[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'star', label: 'Star' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'custom', label: 'Custom (describe in prompt)' },
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
  elementContext?: ElementContext | null
  prompt: string
  showAdvanced: boolean
  registerMandatoryConfig: (config: MandatoryConfig) => void
}

export function ShapeForm({ onSubmit, registerSubmit, isGenerating, elementContext, prompt, showAdvanced, registerMandatoryConfig }: ShapeFormProps) {
  const [count, setCount] = useState(1)
  const [shapeType, setShapeType] = useState<TextLabsShapeType>('custom')
  const [sides, setSides] = useState(6)
  const [fillColor, setFillColor] = useState('#3B82F6')
  const [strokeColor, setStrokeColor] = useState('#1E40AF')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [opacity, setOpacity] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [advancedModified, setAdvancedModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)

  // Pixel-based position (primary)
  const [x, setX] = useState(60)       // px, 0-1919
  const [y, setY] = useState(180)      // px, 0-1079
  const [widthPx, setWidthPx] = useState(gridToPx(DEFAULTS.width))  // px, 1-1920
  const [heightPx, setHeightPx] = useState(gridToPx(DEFAULTS.height)) // px, 1-1080

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
  const [paddingConfig, setPaddingConfig] = useState<TextLabsPaddingConfig>({
    top: 0, right: 0, bottom: 0, left: 0,
  })
  const [showStyling, setShowStyling] = useState(false)
  const [showPosition, setShowPosition] = useState(false)
  const [showPadding, setShowPadding] = useState(false)

  // Derived grid values (for display and API)
  const gridW = pxToGrid(widthPx)
  const gridH = pxToGrid(heightPx)
  const startCol = Math.max(1, Math.round(x / GRID_CELL_SIZE) + 1)
  const startRow = Math.max(1, Math.round(y / GRID_CELL_SIZE) + 1)

  // Register mandatory config — Shape Type
  const shapeLabel = SHAPE_TYPES.find(t => t.value === shapeType)?.label || 'Circle'

  useEffect(() => {
    registerMandatoryConfig({
      fieldLabel: 'Shape',
      displayLabel: shapeLabel,
      options: SHAPE_TYPES.map(t => ({ value: t.value, label: t.label })),
      onChange: (v) => { setShapeType(v as TextLabsShapeType); setAdvancedModified(true) },
      promptPlaceholder: shapeType === 'custom' ? 'e.g., three concentric circles' : 'e.g., a red star',
    })
  }, [shapeType, shapeLabel, registerMandatoryConfig])

  const handleSubmit = useCallback(() => {
    const isCustom = shapeType === 'custom'
    const defaultPrompt = isCustom ? 'custom shape' : `blue ${shapeType}`

    const shapeConfig: Partial<ShapeConfig> = {
      shape_type: isCustom ? null : shapeType,
      prompt: isCustom ? (prompt || null) : null,
      sides: shapeType === 'polygon' ? sides : null,
      fill_color: fillColor,
      stroke_color: strokeColor,
      stroke_width: strokeWidth,
      opacity,
      rotation,
      size,
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
  }, [prompt, count, shapeType, sides, fillColor, strokeColor, strokeWidth, opacity, rotation, size, x, y, widthPx, heightPx, startCol, startRow, gridW, gridH, advancedModified, zIndex, paddingConfig, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  return (
    <div className="space-y-2.5">
      {showAdvanced && (<>
      {/* Section 1: Styling */}
      <CollapsibleSection title="Styling" isOpen={showStyling} onToggle={() => setShowStyling(!showStyling)}>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-600">Fill</label>
              <input
                type="color"
                value={fillColor}
                onChange={(e) => { setFillColor(e.target.value); setAdvancedModified(true) }}
                className="h-7 w-full rounded border border-gray-300 cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-600">Stroke</label>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => { setStrokeColor(e.target.value); setAdvancedModified(true) }}
                className="h-7 w-full rounded border border-gray-300 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600">Stroke Width</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={20}
                value={strokeWidth}
                onChange={(e) => { setStrokeWidth(Number(e.target.value)); setAdvancedModified(true) }}
                className="flex-1"
                style={{ accentColor: 'hsl(var(--primary))' }}
              />
              <span className="text-xs text-gray-400 w-8 text-right">{strokeWidth}px</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600">Opacity</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(e) => { setOpacity(Number(e.target.value) / 100); setAdvancedModified(true) }}
                className="flex-1"
                style={{ accentColor: 'hsl(var(--primary))' }}
              />
              <span className="text-xs text-gray-400 w-8 text-right">{Math.round(opacity * 100)}%</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600">Rotation</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={359}
                value={rotation}
                onChange={(e) => { setRotation(Number(e.target.value)); setAdvancedModified(true) }}
                className="flex-1"
                style={{ accentColor: 'hsl(var(--primary))' }}
              />
              <span className="text-xs text-gray-400 w-10 text-right">{rotation}&deg;</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600">Size</label>
            <div className="flex gap-1">
              {(['small', 'medium', 'large'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => { setSize(s); setAdvancedModified(true) }}
                  className={`flex-1 px-2 py-1 rounded text-xs font-medium capitalize transition-colors ${
                    size === s
                      ? 'bg-primary text-white border border-primary'
                      : 'bg-gray-100 text-gray-400 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-600">Count</label>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full px-2 py-1 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {[1, 2, 3, 4, 5, 6].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Polygon Sides (conditional) */}
          {shapeType === 'polygon' && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-600">Number of Sides</label>
              <select
                value={sides}
                onChange={(e) => { setSides(Number(e.target.value)); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded-md bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary"
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
              <label className="text-[10px] text-gray-400">X (px)</label>
              <input
                type="number"
                value={x}
                min={0}
                max={1919}
                onChange={(e) => { setX(Number(e.target.value)); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400">Y (px)</label>
              <input
                type="number"
                value={y}
                min={0}
                max={1079}
                onChange={(e) => { setY(Number(e.target.value)); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400">Width (px)</label>
              <input
                type="number"
                value={widthPx}
                min={1}
                max={1920}
                onChange={(e) => { setWidthPx(Number(e.target.value)); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400">Height (px)</label>
              <input
                type="number"
                value={heightPx}
                min={1}
                max={1080}
                onChange={(e) => { setHeightPx(Number(e.target.value)); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
              />
            </div>
          </div>

          {/* Grid inputs (bidirectional sync with pixel) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400">Col (grid)</label>
              <input
                type="number"
                value={startCol}
                min={1}
                max={32}
                onChange={(e) => { setX((Number(e.target.value) - 1) * GRID_CELL_SIZE); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400">Row (grid)</label>
              <input
                type="number"
                value={startRow}
                min={1}
                max={18}
                onChange={(e) => { setY((Number(e.target.value) - 1) * GRID_CELL_SIZE); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400">Width (grid)</label>
              <input
                type="number"
                value={gridW}
                min={1}
                max={32}
                onChange={(e) => { setWidthPx(Number(e.target.value) * GRID_CELL_SIZE); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400">Height (grid)</label>
              <input
                type="number"
                value={gridH}
                min={1}
                max={18}
                onChange={(e) => { setHeightPx(Number(e.target.value) * GRID_CELL_SIZE); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-50 border border-gray-300 text-xs text-gray-900"
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
          onAdvancedModified={() => setAdvancedModified(true)}
        />
      </CollapsibleSection>
      </>)}
    </div>
  )
}

ShapeForm.displayName = 'ShapeForm'

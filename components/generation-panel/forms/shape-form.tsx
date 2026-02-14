'use client'

import { useState, useCallback, useEffect } from 'react'
import { ShapeFormData, ShapeConfig, TextLabsShapeType, TextLabsPaddingConfig, TEXT_LABS_ELEMENT_DEFAULTS, GRID_CELL_SIZE } from '@/types/textlabs'
import { PromptInput } from '../shared/prompt-input'
import { CollapsibleSection } from '../shared/collapsible-section'
import { PaddingControl } from '../shared/padding-control'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.SHAPE

// Shape type groupings
const SHAPE_TYPE_GROUPS: { group: string; types: { value: TextLabsShapeType; label: string }[] }[] = [
  {
    group: 'Basic',
    types: [
      { value: 'circle', label: 'Circle' },
      { value: 'ellipse', label: 'Ellipse' },
      { value: 'square', label: 'Square' },
      { value: 'rectangle', label: 'Rectangle' },
      { value: 'triangle', label: 'Triangle' },
    ],
  },
  {
    group: 'Polygons',
    types: [
      { value: 'pentagon', label: 'Pentagon' },
      { value: 'hexagon', label: 'Hexagon' },
      { value: 'heptagon', label: 'Heptagon' },
      { value: 'octagon', label: 'Octagon' },
      { value: 'polygon', label: 'N-sided Polygon' },
    ],
  },
  {
    group: 'Quadrilaterals',
    types: [
      { value: 'rhombus', label: 'Diamond' },
      { value: 'parallelogram', label: 'Parallelogram' },
      { value: 'trapezoid', label: 'Trapezoid' },
      { value: 'kite', label: 'Kite' },
    ],
  },
  {
    group: 'Special',
    types: [
      { value: 'star', label: 'Star' },
      { value: 'cross', label: 'Plus / Cross' },
      { value: 'arrow', label: 'Arrow' },
      { value: 'heart', label: 'Heart' },
      { value: 'cloud', label: 'Cloud' },
      { value: 'crescent', label: 'Crescent' },
      { value: 'doughnut', label: 'Ring' },
    ],
  },
  {
    group: 'Lines',
    types: [
      { value: 'line-horizontal', label: 'Horizontal Line' },
      { value: 'line-vertical', label: 'Vertical Line' },
      { value: 'line-diagonal', label: 'Diagonal Line' },
    ],
  },
  {
    group: 'AI Generated',
    types: [
      { value: 'custom', label: 'Custom (describe in prompt)' },
    ],
  },
]

interface ShapeFormProps {
  onSubmit: (formData: ShapeFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
}

export function ShapeForm({ onSubmit, registerSubmit, isGenerating }: ShapeFormProps) {
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(1)
  const [shapeType, setShapeType] = useState<TextLabsShapeType>('circle')
  const [sides, setSides] = useState(6)
  const [fillColor, setFillColor] = useState('#3B82F6')
  const [strokeColor, setStrokeColor] = useState('#1E40AF')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [opacity, setOpacity] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [advancedModified, setAdvancedModified] = useState(false)

  // Grid position
  const [startCol, setStartCol] = useState(2)
  const [startRow, setStartRow] = useState(4)
  const [posWidth, setPosWidth] = useState(DEFAULTS.width)
  const [posHeight, setPosHeight] = useState(DEFAULTS.height)

  // Sections
  const [showStyling, setShowStyling] = useState(false)
  const [showPosition, setShowPosition] = useState(false)
  const [showPadding, setShowPadding] = useState(false)

  // Padding
  const [paddingConfig, setPaddingConfig] = useState<TextLabsPaddingConfig>({
    top: 0, right: 0, bottom: 0, left: 0,
  })

  // Pixel calculations
  const x = (startCol - 1) * GRID_CELL_SIZE
  const y = (startRow - 1) * GRID_CELL_SIZE
  const widthPx = posWidth * GRID_CELL_SIZE
  const heightPx = posHeight * GRID_CELL_SIZE

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
      start_col: startCol,
      start_row: startRow,
      position_width: posWidth,
      position_height: posHeight,
      x,
      y,
      width_px: widthPx,
      height_px: heightPx,
    }

    const formData: ShapeFormData = {
      componentType: 'SHAPE',
      prompt: prompt || defaultPrompt,
      count,
      layout: 'horizontal',
      advancedModified,
      z_index: DEFAULTS.zIndex,
      shapeConfig,
      positionConfig: {
        start_col: startCol,
        start_row: startRow,
        position_width: posWidth,
        position_height: posHeight,
        auto_position: false,
      },
      paddingConfig,
    }
    onSubmit(formData)
  }, [prompt, count, shapeType, sides, fillColor, strokeColor, strokeWidth, opacity, rotation, size, startCol, startRow, posWidth, posHeight, x, y, widthPx, heightPx, advancedModified, paddingConfig, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  return (
    <div className="space-y-4">
      {/* Prompt */}
      <PromptInput
        value={prompt}
        onChange={setPrompt}
        placeholder={shapeType === 'custom'
          ? 'e.g., three concentric circles in blue tones'
          : 'e.g., a red star, or select a shape type above'
        }
        disabled={isGenerating}
      />

      {/* Shape Type */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-300">Shape Type</label>
        <select
          value={shapeType}
          onChange={(e) => {
            setShapeType(e.target.value as TextLabsShapeType)
            setAdvancedModified(true)
          }}
          className="w-full px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          {SHAPE_TYPE_GROUPS.map(group => (
            <optgroup key={group.group} label={group.group}>
              {group.types.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Polygon Sides (conditional) */}
      {shapeType === 'polygon' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-300">Number of Sides</label>
          <select
            value={sides}
            onChange={(e) => { setSides(Number(e.target.value)); setAdvancedModified(true) }}
            className="w-full px-2.5 py-1.5 rounded-md bg-gray-700/50 border border-gray-600 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {Array.from({ length: 10 }, (_, i) => i + 3).map(n => (
              <option key={n} value={n}>{n} sides</option>
            ))}
          </select>
        </div>
      )}

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

      {/* SVG Styling */}
      <CollapsibleSection title="SVG Styling" isOpen={showStyling} onToggle={() => setShowStyling(!showStyling)}>
        <div className="space-y-3">
          {/* Colors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Fill</label>
              <input
                type="color"
                value={fillColor}
                onChange={(e) => { setFillColor(e.target.value); setAdvancedModified(true) }}
                className="h-8 w-full rounded border border-gray-600 cursor-pointer"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Stroke</label>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => { setStrokeColor(e.target.value); setAdvancedModified(true) }}
                className="h-8 w-full rounded border border-gray-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Stroke Width */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Stroke Width</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={10}
                value={strokeWidth}
                onChange={(e) => { setStrokeWidth(Number(e.target.value)); setAdvancedModified(true) }}
                className="flex-1 accent-purple-500"
              />
              <span className="text-xs text-gray-400 w-8 text-right">{strokeWidth}px</span>
            </div>
          </div>

          {/* Opacity */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Opacity</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(e) => { setOpacity(Number(e.target.value) / 100); setAdvancedModified(true) }}
                className="flex-1 accent-purple-500"
              />
              <span className="text-xs text-gray-400 w-8 text-right">{Math.round(opacity * 100)}%</span>
            </div>
          </div>

          {/* Rotation */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Rotation</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={360}
                value={rotation}
                onChange={(e) => { setRotation(Number(e.target.value)); setAdvancedModified(true) }}
                className="flex-1 accent-purple-500"
              />
              <span className="text-xs text-gray-400 w-10 text-right">{rotation}&deg;</span>
            </div>
          </div>

          {/* Size */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-300">Size</label>
            <div className="flex gap-1">
              {(['small', 'medium', 'large'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => { setSize(s); setAdvancedModified(true) }}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
                    size === s
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Position */}
      <CollapsibleSection title="Position" isOpen={showPosition} onToggle={() => setShowPosition(!showPosition)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500">Col</label>
              <input
                type="number"
                value={startCol}
                min={1}
                max={32}
                onChange={(e) => { setStartCol(Number(e.target.value)); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500">Row</label>
              <input
                type="number"
                value={startRow}
                min={1}
                max={18}
                onChange={(e) => { setStartRow(Number(e.target.value)); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500">Width</label>
              <input
                type="number"
                value={posWidth}
                min={1}
                max={32}
                onChange={(e) => { setPosWidth(Number(e.target.value)); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500">Height</label>
              <input
                type="number"
                value={posHeight}
                min={1}
                max={18}
                onChange={(e) => { setPosHeight(Number(e.target.value)); setAdvancedModified(true) }}
                className="w-full px-2 py-1 rounded bg-gray-700/50 border border-gray-600 text-xs text-gray-100"
              />
            </div>
          </div>
          <div className="text-[10px] text-gray-500">
            Pixel: {x}x{y} / {widthPx}x{heightPx}px
          </div>
        </div>
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

ShapeForm.displayName = 'ShapeForm'

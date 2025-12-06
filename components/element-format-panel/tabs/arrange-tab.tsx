"use client"

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Minus, Plus, Lock, Unlock, Layers, FlipHorizontal, FlipVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { CSSClassesInput } from '@/components/ui/css-classes-input'
import { ArrangeTabProps, ALIGN_OPTIONS, DISTRIBUTE_OPTIONS } from '../types'

export function ArrangeTab({ properties, onSendCommand, isApplying, elementId }: ArrangeTabProps) {
  // Order/Z-index state (visual only)
  const [zIndex, setZIndex] = useState(properties?.zIndex ?? 0)

  // Size state
  const [width, setWidth] = useState(String(properties?.size?.width ?? 400))
  const [height, setHeight] = useState(String(properties?.size?.height ?? 300))
  const [constrainProportions, setConstrainProportions] = useState(false)
  const [aspectRatio, setAspectRatio] = useState(1)

  // Position state
  const [posX, setPosX] = useState(String(properties?.position?.x ?? 0))
  const [posY, setPosY] = useState(String(properties?.position?.y ?? 0))

  // Rotation state
  const [isRotateOpen, setIsRotateOpen] = useState(false)
  const [angle, setAngle] = useState(String(properties?.rotation ?? 0))
  const [flippedH, setFlippedH] = useState(properties?.flipped?.horizontal ?? false)
  const [flippedV, setFlippedV] = useState(properties?.flipped?.vertical ?? false)

  // Lock state
  const [isLocked, setIsLocked] = useState(properties?.locked ?? false)

  // CSS classes state
  const [cssClasses, setCssClasses] = useState<string[]>(properties?.cssClasses ?? [])

  // Update local state when properties change
  useEffect(() => {
    if (properties) {
      setZIndex(properties.zIndex ?? 0)
      setWidth(String(properties.size?.width ?? 400))
      setHeight(String(properties.size?.height ?? 300))
      setPosX(String(properties.position?.x ?? 0))
      setPosY(String(properties.position?.y ?? 0))
      setAngle(String(properties.rotation ?? 0))
      setIsLocked(properties.locked ?? false)
      setFlippedH(properties.flipped?.horizontal ?? false)
      setFlippedV(properties.flipped?.vertical ?? false)
      setCssClasses(properties.cssClasses ?? [])
      // Calculate initial aspect ratio
      if (properties.size?.width && properties.size?.height) {
        setAspectRatio(properties.size.width / properties.size.height)
      }
    }
  }, [properties])

  // Order handlers
  const handleBringToFront = async () => {
    await onSendCommand('bringToFront', { elementId })
  }

  const handleSendToBack = async () => {
    await onSendCommand('sendToBack', { elementId })
  }

  const handleBringForward = async () => {
    await onSendCommand('bringForward', { elementId })
  }

  const handleSendBackward = async () => {
    await onSendCommand('sendBackward', { elementId })
  }

  // Align handler
  const handleAlign = async (alignment: string) => {
    const horizontal = ['left', 'center', 'right'].includes(alignment) ? alignment : undefined
    const vertical = ['top', 'middle', 'bottom'].includes(alignment) ? alignment : undefined
    await onSendCommand('alignElement', { elementId, horizontal, vertical })
  }

  // Size handlers
  const handleWidthChange = async (newWidth: string) => {
    setWidth(newWidth)
    const w = parseFloat(newWidth)
    if (isNaN(w)) return

    if (constrainProportions) {
      const newHeight = Math.round(w / aspectRatio)
      setHeight(String(newHeight))
      await onSendCommand('resizeElement', { elementId, width: w, height: newHeight, maintainAspectRatio: true })
    } else {
      await onSendCommand('resizeElement', { elementId, width: w })
    }
  }

  const handleHeightChange = async (newHeight: string) => {
    setHeight(newHeight)
    const h = parseFloat(newHeight)
    if (isNaN(h)) return

    if (constrainProportions) {
      const newWidth = Math.round(h * aspectRatio)
      setWidth(String(newWidth))
      await onSendCommand('resizeElement', { elementId, width: newWidth, height: h, maintainAspectRatio: true })
    } else {
      await onSendCommand('resizeElement', { elementId, height: h })
    }
  }

  const toggleConstrainProportions = () => {
    if (!constrainProportions) {
      // Calculate and store current aspect ratio
      const w = parseFloat(width)
      const h = parseFloat(height)
      if (!isNaN(w) && !isNaN(h) && h !== 0) {
        setAspectRatio(w / h)
      }
    }
    setConstrainProportions(!constrainProportions)
  }

  // Position handlers
  const handlePositionChange = async (axis: 'x' | 'y', value: string) => {
    if (axis === 'x') setPosX(value)
    else setPosY(value)

    const x = axis === 'x' ? parseFloat(value) : parseFloat(posX)
    const y = axis === 'y' ? parseFloat(value) : parseFloat(posY)

    if (!isNaN(x) && !isNaN(y)) {
      await onSendCommand('positionElement', { elementId, x, y })
    }
  }

  // Rotation handler
  const handleAngleChange = async (newAngle: string) => {
    setAngle(newAngle)
    const a = parseFloat(newAngle)
    if (!isNaN(a)) {
      await onSendCommand('rotateElement', { elementId, angle: a })
    }
  }

  // Flip handlers
  const handleFlipHorizontal = async () => {
    const newFlipped = !flippedH
    setFlippedH(newFlipped)
    await onSendCommand('flipElement', { elementId, direction: 'horizontal' })
  }

  const handleFlipVertical = async () => {
    const newFlipped = !flippedV
    setFlippedV(newFlipped)
    await onSendCommand('flipElement', { elementId, direction: 'vertical' })
  }

  // Lock handler
  const handleLockToggle = async () => {
    const newLocked = !isLocked
    setIsLocked(newLocked)
    await onSendCommand('lockElement', { elementId, locked: newLocked })
  }

  // Group handlers (for future multi-select)
  const handleGroup = async () => {
    // TODO: Implement when multi-select is available
    await onSendCommand('groupElements', { elementIds: [elementId] })
  }

  const handleUngroup = async () => {
    await onSendCommand('ungroupElements', { groupId: elementId })
  }

  // CSS classes handler
  const handleCssClassesChange = async (classes: string[]) => {
    setCssClasses(classes)
    await onSendCommand('setElementClasses', { elementId, classes })
  }

  return (
    <div className="p-3 space-y-4">
      {/* Order Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-300">Order</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleSendToBack}
            disabled={isApplying || isLocked}
            className={cn(
              "flex-1 py-1.5 bg-gray-800 rounded-l-lg text-xs font-medium transition-colors",
              "hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            Back
          </button>
          <button
            onClick={handleBringToFront}
            disabled={isApplying || isLocked}
            className={cn(
              "flex-1 py-1.5 bg-gray-800 text-xs font-medium transition-colors",
              "hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            Front
          </button>
          <button
            onClick={handleSendBackward}
            disabled={isApplying || isLocked}
            className={cn(
              "flex-1 py-1.5 bg-gray-800 text-xs font-medium transition-colors",
              "hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            Backward
          </button>
          <button
            onClick={handleBringForward}
            disabled={isApplying || isLocked}
            className={cn(
              "flex-1 py-1.5 bg-gray-800 rounded-r-lg text-xs font-medium transition-colors",
              "hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            Forward
          </button>
        </div>
      </div>

      {/* Align & Distribute */}
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-gray-400">Align</label>
          <select
            onChange={(e) => handleAlign(e.target.value)}
            disabled={isApplying || isLocked}
            className="w-full px-2 py-1.5 bg-gray-800 rounded text-xs text-white focus:outline-none"
            defaultValue=""
          >
            <option value="" disabled>Select...</option>
            {ALIGN_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs text-gray-400">Distribute</label>
          <select
            disabled={isApplying || isLocked}
            className="w-full px-2 py-1.5 bg-gray-800 rounded text-xs text-white focus:outline-none opacity-50"
            defaultValue=""
          >
            <option value="" disabled>Select...</option>
            {DISTRIBUTE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Size Section */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Size</label>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 w-10">Width</span>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                onBlur={() => handleWidthChange(width)}
                disabled={isApplying || isLocked}
                className="flex-1 px-2 py-1 bg-gray-800 rounded text-xs text-white text-right focus:outline-none"
              />
              <span className="text-xs text-gray-500">pt</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 w-10">Height</span>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                onBlur={() => handleHeightChange(height)}
                disabled={isApplying || isLocked}
                className="flex-1 px-2 py-1 bg-gray-800 rounded text-xs text-white text-right focus:outline-none"
              />
              <span className="text-xs text-gray-500">pt</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleConstrainProportions}
            disabled={isApplying || isLocked}
            className={cn(
              "w-4 h-4 rounded border flex items-center justify-center transition-colors",
              constrainProportions ? "bg-blue-600 border-blue-600" : "border-gray-500"
            )}
          >
            {constrainProportions && <span className="text-white text-xs">&#10003;</span>}
          </button>
          <span className="text-xs text-gray-400">Constrain proportions</span>
        </div>
      </div>

      {/* Position Section */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400 uppercase tracking-wide">Position</label>
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 w-6">X</span>
              <input
                type="number"
                value={posX}
                onChange={(e) => setPosX(e.target.value)}
                onBlur={() => handlePositionChange('x', posX)}
                disabled={isApplying || isLocked}
                className="flex-1 px-2 py-1 bg-gray-800 rounded text-xs text-white text-right focus:outline-none"
              />
              <span className="text-xs text-gray-500">pt</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 w-6">Y</span>
              <input
                type="number"
                value={posY}
                onChange={(e) => setPosY(e.target.value)}
                onBlur={() => handlePositionChange('y', posY)}
                disabled={isApplying || isLocked}
                className="flex-1 px-2 py-1 bg-gray-800 rounded text-xs text-white text-right focus:outline-none"
              />
              <span className="text-xs text-gray-500">pt</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rotate Section (Collapsible) */}
      <Collapsible open={isRotateOpen} onOpenChange={setIsRotateOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 text-xs text-gray-400 uppercase tracking-wide hover:text-white transition-colors">
          <span>Rotate</span>
          {isRotateOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Angle */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-gray-600 relative">
              <div
                className="absolute w-1 h-3 bg-blue-500 rounded-full top-0 left-1/2 -translate-x-1/2 origin-bottom"
                style={{ transform: `translateX(-50%) rotate(${parseFloat(angle) || 0}deg)` }}
              />
            </div>
            <span className="text-xs text-gray-400">Angle</span>
            <input
              type="number"
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              onBlur={() => handleAngleChange(angle)}
              disabled={isApplying || isLocked}
              min="0"
              max="360"
              className="w-16 px-2 py-1 bg-gray-800 rounded text-xs text-white text-right focus:outline-none"
            />
            <span className="text-xs text-gray-500">&deg;</span>
          </div>

          {/* Flip */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Flip</span>
            <button
              onClick={handleFlipHorizontal}
              disabled={isApplying || isLocked}
              className={cn(
                "p-1.5 rounded transition-colors",
                flippedH ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="Flip Horizontal"
            >
              <FlipHorizontal className="h-4 w-4" />
            </button>
            <button
              onClick={handleFlipVertical}
              disabled={isApplying || isLocked}
              className={cn(
                "p-1.5 rounded transition-colors",
                flippedV ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="Flip Vertical"
            >
              <FlipVertical className="h-4 w-4" />
            </button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Lock & Group Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={handleLockToggle}
          disabled={isApplying}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors",
            isLocked
              ? "bg-amber-600/20 text-amber-400 border border-amber-600"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          )}
        >
          {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          {isLocked ? 'Unlock' : 'Lock'}
        </button>
        <button
          onClick={handleGroup}
          disabled={isApplying || isLocked}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors",
            "bg-gray-800 text-gray-300 hover:bg-gray-700",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          Group
        </button>
      </div>

      {/* CSS Classes Section */}
      <div className="space-y-2 pt-3 border-t border-gray-700 mt-3">
        <label className="text-xs text-gray-400 uppercase tracking-wide">CSS Classes</label>
        <CSSClassesInput
          value={cssClasses}
          onChange={handleCssClassesChange}
          disabled={isApplying || isLocked}
          placeholder="Add class name..."
        />
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from 'react'
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ArrowDown,
  ArrowUp,
  FlipHorizontal,
  FlipVertical,
  Lock,
  Unlock,
  Link,
  Link2Off,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CSSClassesInput } from '@/components/ui/css-classes-input'
import { ArrangeTabProps, ALIGN_OPTIONS, DISTRIBUTE_OPTIONS } from '../types'
import {
  PanelSection,
  ControlRow,
  PanelInput,
  PanelSelect,
  Divider,
} from '@/components/ui/panel'

export function ArrangeTab({ properties, onSendCommand, isApplying, elementId }: ArrangeTabProps) {
  // Size state
  const [width, setWidth] = useState(String(properties?.size?.width ?? 400))
  const [height, setHeight] = useState(String(properties?.size?.height ?? 300))
  const [constrainProportions, setConstrainProportions] = useState(false)
  const [aspectRatio, setAspectRatio] = useState(1)

  // Position state
  const [posX, setPosX] = useState(String(properties?.position?.x ?? 0))
  const [posY, setPosY] = useState(String(properties?.position?.y ?? 0))

  // Rotation state
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
      setWidth(String(properties.size?.width ?? 400))
      setHeight(String(properties.size?.height ?? 300))
      setPosX(String(properties.position?.x ?? 0))
      setPosY(String(properties.position?.y ?? 0))
      setAngle(String(properties.rotation ?? 0))
      setIsLocked(properties.locked ?? false)
      setFlippedH(properties.flipped?.horizontal ?? false)
      setFlippedV(properties.flipped?.vertical ?? false)
      setCssClasses(properties.cssClasses ?? [])
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

  // CSS classes handler
  const handleCssClassesChange = async (classes: string[]) => {
    setCssClasses(classes)
    await onSendCommand('setElementClasses', { elementId, classes })
  }

  return (
    <div className="p-4 space-y-5">
      {/* Order Section */}
      <PanelSection title="Order">
        <div className="flex gap-1">
          <button
            onClick={handleSendToBack}
            disabled={isApplying || isLocked}
            title="Send to Back"
            className={cn(
              "flex-1 flex items-center justify-center gap-1 h-8",
              "bg-gray-800/60 rounded-l-md",
              "text-[10px] text-gray-300 hover:text-white hover:bg-gray-700/50",
              "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <ArrowDownToLine className="h-3 w-3" />
            Back
          </button>
          <button
            onClick={handleSendBackward}
            disabled={isApplying || isLocked}
            title="Send Backward"
            className={cn(
              "flex-1 flex items-center justify-center gap-1 h-8",
              "bg-gray-800/60",
              "text-[10px] text-gray-300 hover:text-white hover:bg-gray-700/50",
              "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <ArrowDown className="h-3 w-3" />
          </button>
          <button
            onClick={handleBringForward}
            disabled={isApplying || isLocked}
            title="Bring Forward"
            className={cn(
              "flex-1 flex items-center justify-center gap-1 h-8",
              "bg-gray-800/60",
              "text-[10px] text-gray-300 hover:text-white hover:bg-gray-700/50",
              "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            onClick={handleBringToFront}
            disabled={isApplying || isLocked}
            title="Bring to Front"
            className={cn(
              "flex-1 flex items-center justify-center gap-1 h-8",
              "bg-gray-800/60 rounded-r-md",
              "text-[10px] text-gray-300 hover:text-white hover:bg-gray-700/50",
              "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <ArrowUpToLine className="h-3 w-3" />
            Front
          </button>
        </div>
      </PanelSection>

      <Divider />

      {/* Align Section */}
      <PanelSection title="Align">
        <div className="flex gap-2">
          <div className="flex-1">
            <PanelSelect
              options={ALIGN_OPTIONS.filter(o => ['left', 'center', 'right'].includes(o.value))}
              value=""
              onChange={handleAlign}
              disabled={isApplying || isLocked}
              placeholder="Horizontal"
            />
          </div>
          <div className="flex-1">
            <PanelSelect
              options={ALIGN_OPTIONS.filter(o => ['top', 'middle', 'bottom'].includes(o.value))}
              value=""
              onChange={handleAlign}
              disabled={isApplying || isLocked}
              placeholder="Vertical"
            />
          </div>
        </div>
      </PanelSection>

      <Divider />

      {/* Size Section */}
      <PanelSection title="Size">
        <div className="flex items-center gap-2">
          <ControlRow label="W" labelWidth="sm" className="flex-1">
            <PanelInput
              type="number"
              value={width}
              onChange={setWidth}
              onBlur={() => handleWidthChange(width)}
              suffix="pt"
              disabled={isApplying || isLocked}
            />
          </ControlRow>

          <button
            onClick={toggleConstrainProportions}
            disabled={isApplying || isLocked}
            title={constrainProportions ? "Proportions linked" : "Proportions unlinked"}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-md mt-1",
              constrainProportions
                ? "text-blue-400 hover:text-blue-300"
                : "text-gray-500 hover:text-gray-300",
              "transition-colors disabled:opacity-50"
            )}
          >
            {constrainProportions ? (
              <Link className="h-3.5 w-3.5" />
            ) : (
              <Link2Off className="h-3.5 w-3.5" />
            )}
          </button>

          <ControlRow label="H" labelWidth="sm" className="flex-1">
            <PanelInput
              type="number"
              value={height}
              onChange={setHeight}
              onBlur={() => handleHeightChange(height)}
              suffix="pt"
              disabled={isApplying || isLocked}
            />
          </ControlRow>
        </div>
      </PanelSection>

      <Divider />

      {/* Position Section */}
      <PanelSection title="Position">
        <div className="flex gap-2">
          <ControlRow label="X" labelWidth="sm" className="flex-1">
            <PanelInput
              type="number"
              value={posX}
              onChange={setPosX}
              onBlur={() => handlePositionChange('x', posX)}
              suffix="pt"
              disabled={isApplying || isLocked}
            />
          </ControlRow>
          <ControlRow label="Y" labelWidth="sm" className="flex-1">
            <PanelInput
              type="number"
              value={posY}
              onChange={setPosY}
              onBlur={() => handlePositionChange('y', posY)}
              suffix="pt"
              disabled={isApplying || isLocked}
            />
          </ControlRow>
        </div>
      </PanelSection>

      <Divider />

      {/* Rotate & Flip Section (Collapsible) */}
      <PanelSection title="Rotate & Flip" collapsible defaultOpen={false}>
        <ControlRow label="Angle" labelWidth="md">
          <PanelInput
            type="number"
            value={angle}
            onChange={setAngle}
            onBlur={() => handleAngleChange(angle)}
            suffix="°"
            min={0}
            max={360}
            disabled={isApplying || isLocked}
            className="w-20"
          />
        </ControlRow>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleFlipHorizontal}
            disabled={isApplying || isLocked}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 h-8",
              "rounded-md transition-all",
              flippedH
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "bg-gray-800/60 text-gray-300 hover:text-white hover:bg-gray-700/50"
            )}
          >
            <FlipHorizontal className="h-3.5 w-3.5" />
            <span className="text-[10px]">Horizontal</span>
          </button>
          <button
            onClick={handleFlipVertical}
            disabled={isApplying || isLocked}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 h-8",
              "rounded-md transition-all",
              flippedV
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "bg-gray-800/60 text-gray-300 hover:text-white hover:bg-gray-700/50"
            )}
          >
            <FlipVertical className="h-3.5 w-3.5" />
            <span className="text-[10px]">Vertical</span>
          </button>
        </div>
      </PanelSection>

      <Divider />

      {/* Lock Section */}
      <PanelSection title="Lock">
        <button
          onClick={handleLockToggle}
          disabled={isApplying}
          className={cn(
            "w-full flex items-center justify-center gap-2 h-9",
            "rounded-lg transition-all",
            isLocked
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              : "bg-gray-800/60 text-gray-300 hover:text-white hover:bg-gray-700/50"
          )}
        >
          {isLocked ? (
            <>
              <Lock className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">Locked</span>
            </>
          ) : (
            <>
              <Unlock className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">Click to Lock</span>
            </>
          )}
        </button>
      </PanelSection>

      <Divider />

      {/* CSS Classes Section (Collapsible) */}
      <PanelSection title="CSS Classes" collapsible defaultOpen={false}>
        <CSSClassesInput
          value={cssClasses}
          onChange={handleCssClassesChange}
          disabled={isApplying || isLocked}
          placeholder="Add class..."
        />
      </PanelSection>
    </div>
  )
}

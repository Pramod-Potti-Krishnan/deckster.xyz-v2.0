"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import { Trash2, Image, Table, BarChart3, LayoutGrid, GitBranch, Type, Layout } from 'lucide-react'
import { cn } from '@/lib/utils'
import '@/components/builder/studio-panels.css'
import '@/components/builder/studio-format-failures.css'
import { ElementFormatPanelProps } from './types'
import { ElementType, ELEMENT_INFO } from '@/types/elements'
import { ArrangeTab } from './tabs/arrange-tab'
import { SlideFormatPanel } from './slide-format-panel'

// Map element types to their icons
const ELEMENT_ICONS: Record<ElementType, React.ComponentType<{ className?: string }>> = {
  image: Image,
  table: Table,
  chart: BarChart3,
  infographic: LayoutGrid,
  diagram: GitBranch,
  text: Type,
  hero: Layout,
}

// Map element types to their accent colors
const ELEMENT_ACCENT_COLORS: Record<ElementType, string> = {
  image: 'text-green-400',
  table: 'text-blue-400',
  chart: 'text-amber-400',
  infographic: 'text-purple-400',
  diagram: 'text-pink-400',
  text: 'text-indigo-400',
  hero: 'text-teal-400',
}


const STUDIO_FORMAT_FAILURES = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

// Scope local feedback to the currently mounted target. It never acknowledges,
// retries or rolls back a command, and stale completions cannot affect a new target.
function useStudioFormatFeedback(targetKey: string, send: (action: string, params: Record<string, any>) => Promise<any>) {
  const mounted = useRef(false)
  const scopeRef = useRef({ key: targetKey })
  if (scopeRef.current.key !== targetKey) scopeRef.current = { key: targetKey }
  const scope = scopeRef.current
  const requestRef = useRef<{ scope: object; request: object } | null>(null)
  const [pending, setPending] = useState<{ scope: object; request: object } | null>(null)
  const [feedback, setFeedback] = useState<{ scope: object; message: string } | null>(null)

  useEffect(() => {
    if (!STUDIO_FORMAT_FAILURES) return
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const run = useCallback(async (action: string, params: Record<string, any>, nativeRejection = false) => {
    if (!mounted.current || scopeRef.current !== scope) {
      return { success: false, error: 'Formatting target changed.' }
    }
    if (requestRef.current?.scope === scope) {
      return { success: false, error: 'A formatting change is already pending.' }
    }
    const request = {}
    requestRef.current = { scope, request }
    setPending({ scope, request })
    setFeedback(null)
    const current = () => mounted.current && scopeRef.current === scope && requestRef.current?.request === request
    const reason = (error: unknown) => {
      if (error instanceof Error && error.message) return error.message
      if (typeof error === 'string' && error) return error
      return 'Formatting command failed.'
    }
    try {
      const result = await send(action, params)
      if (!nativeRejection && result?.success === false && current()) {
        setFeedback({ scope, message: reason(result.error) })
      }
      return result
    } catch (error) {
      const message = reason(error)
      if (!nativeRejection && current()) setFeedback({ scope, message })
      if (nativeRejection) throw error
      // Native style/arrange handlers do not catch rejected commands. Returning
      // the failure prevents an unhandled rejection without implying success.
      return { success: false, error: message }
    } finally {
      if (current()) {
        requestRef.current = null
        setPending(null)
      }
    }
  }, [scope, send])

  return {
    run,
    runNative: (action: string, params: Record<string, any>) => run(action, params, true),
    isFormatting: pending?.scope === scope,
    failure: feedback?.scope === scope ? feedback.message : null,
  }
}

export function ElementFormatPanel({
  isOpen,
  onClose,
  elementId,
  elementType,
  properties,
  onSendCommand,
  onDelete,
  presentationId,
  slideIndex = 0,
}: ElementFormatPanelProps) {
  const [isApplying, setIsApplying] = useState(false)

  const formatTargetKey = JSON.stringify([isOpen, presentationId, elementId, elementType, slideIndex])
  const formatFeedback = useStudioFormatFeedback(formatTargetKey, onSendCommand)
  const applying = isApplying || (STUDIO_FORMAT_FAILURES && formatFeedback.isFormatting)

  // Wrapper for sending commands with loading state
  const handleSendCommand = useCallback(async (action: string, params: Record<string, unknown>) => {
    setIsApplying(true)
    try {
      const result = await onSendCommand(action, { ...params, elementId })
      return result
    } finally {
      setIsApplying(false)
    }
  }, [onSendCommand, elementId])

  // Wrapper for slide commands (no elementId needed)
  const handleSlideCommand = useCallback(async (action: string, params: Record<string, unknown>) => {
    setIsApplying(true)
    try {
      const result = await onSendCommand(action, params)
      return result
    } finally {
      setIsApplying(false)
    }
  }, [onSendCommand])

  // Don't render if not open
  if (!isOpen) return null

  // Check if no element is selected - show SlideFormatPanel instead
  const showSlidePanel = !elementId || !elementType

  // Get element info for display
  const elementInfo = elementType ? ELEMENT_INFO[elementType] : null
  const ElementIcon = elementType ? ELEMENT_ICONS[elementType] : null
  const accentColor = elementType ? ELEMENT_ACCENT_COLORS[elementType] : 'text-gray-400 dark:text-slate-500'

  // Render SlideFormatPanel when no element selected
  if (showSlidePanel) {
    return (
      <div
        data-studio-v4-panel="slide-format"
        className={cn(
          "absolute inset-0 bg-gray-900 dark:bg-slate-600 text-white shadow-2xl z-20 flex flex-col"
        )}
      >
        <SlideFormatPanel
          slideIndex={slideIndex}
          presentationId={presentationId || ''}
          onSendCommand={handleSlideCommand}
          isApplying={isApplying}
        />

        {/* Applying indicator - refined */}
        {isApplying && (
          <div className={cn(
            "absolute bottom-4 left-1/2 -translate-x-1/2",
            "px-4 py-2 bg-teal-600 rounded-full",
            "text-[11px] font-medium text-white shadow-lg"
          )}>
            Applying...
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      data-studio-v4-panel="element-format"
      className={cn(
        "absolute inset-0 bg-gray-900 dark:bg-slate-600 text-white shadow-2xl z-20 flex flex-col"
      )}
    >
      {/* Header - Refined with icon and better spacing */}
      <div data-studio-v4-panel-header className="flex items-center justify-between h-11 px-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          {ElementIcon && (
            <ElementIcon className={cn("h-4 w-4", accentColor)} />
          )}
          <h2 className="text-[13px] font-medium text-white">
            {elementInfo?.label || 'Element'}
          </h2>
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-md",
              "text-gray-500 dark:text-slate-400 hover:text-red-400 hover:bg-red-500/10",
              "transition-colors"
            )}
            title="Delete element"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {STUDIO_FORMAT_FAILURES && formatFeedback.failure !== null && (
          <div data-studio-format-failure="true" role="alert" tabIndex={0} aria-label="Formatting change not confirmed">
            <strong>Formatting change not confirmed</strong>
            <p>{formatFeedback.failure}</p>
            <small>Controls may show attempted values. These values do not confirm that the slide changed.</small>
          </div>
        )}

      {/* Arrange Content */}
      <div data-studio-v4-panel-fields className="flex-1 overflow-y-auto">
        {properties && (
          <ArrangeTab
            key={STUDIO_FORMAT_FAILURES ? formatTargetKey : undefined}
            properties={properties}
            onSendCommand={STUDIO_FORMAT_FAILURES ? (action, params) => formatFeedback.run(action, { ...params, elementId }) : handleSendCommand}
            isApplying={applying}
            elementId={elementId || ''}
          />
        )}
      </div>

      {/* Applying indicator - refined */}
      {applying && (
        <div className={cn(
          "absolute bottom-4 left-1/2 -translate-x-1/2",
          "px-4 py-2 bg-blue-600 rounded-full",
          "text-[11px] font-medium text-white shadow-lg"
        )}>
          Applying...
        </div>
      )}
    </div>
  )
}

export * from './types'

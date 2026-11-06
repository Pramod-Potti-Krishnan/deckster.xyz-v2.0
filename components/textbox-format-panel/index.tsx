"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import { Trash2, Type } from 'lucide-react'
import { TextBoxFormatting } from '@/components/presentation-viewer'
import { StyleTab } from './style-tab'
import { AITab } from './ai-tab'
import { cn } from '@/lib/utils'
import '@/components/builder/studio-panels.css'
import '@/components/builder/studio-format-failures.css'

export interface TextBoxFormatPanelProps {
  isOpen: boolean
  onClose: () => void
  elementId: string | null
  formatting: TextBoxFormatting | null
  onSendCommand: (action: string, params: Record<string, any>) => Promise<any>
  onDelete?: () => void
  presentationId?: string | null
  slideIndex?: number
  sessionId?: string | null  // For AI chat functionality
  onGetElementHtml?: () => Promise<string>  // Get current element HTML for AI context
}

type TabType = 'style' | 'ai'


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

export function TextBoxFormatPanel({
  isOpen,
  onClose,
  elementId,
  formatting,
  onSendCommand,
  onDelete,
  presentationId,
  slideIndex = 0,
  sessionId,
  onGetElementHtml,
}: TextBoxFormatPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('style')
  const [isApplying, setIsApplying] = useState(false)

  const formatTargetKey = JSON.stringify([isOpen, presentationId, elementId, slideIndex, sessionId])
  const formatFeedback = useStudioFormatFeedback(formatTargetKey, onSendCommand)
  const applying = isApplying || (STUDIO_FORMAT_FAILURES && formatFeedback.isFormatting)

  // Wrapper for sending commands with loading state
  const handleSendCommand = useCallback(async (action: string, params: Record<string, any>) => {
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

  return (
      <div
        data-studio-v4-panel="text-format"
        className={cn(
          "absolute inset-0 bg-gray-900 dark:bg-slate-600 text-white shadow-2xl z-20 flex flex-col"
        )}
      >
        {/* Header - Refined with icon and better spacing */}
        <div data-studio-v4-panel-header className="flex items-center justify-between h-11 px-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-indigo-400" />
            <h2 className="text-[13px] font-medium text-white">Text</h2>
          </div>
          {onDelete && (
            <button
              onClick={onDelete}
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-md",
                "text-gray-500 dark:text-slate-400 hover:text-red-400 hover:bg-red-500/10",
                "transition-colors"
              )}
              title="Delete text box"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tab Switcher - Keynote-style segmented control */}
        <div data-studio-v4-panel-tabs className="px-4 pt-3">
          <div className="flex h-8 bg-gray-800 dark:bg-slate-700/50 rounded-lg p-[3px]">
            <button
              onClick={() => setActiveTab('style')}
              className={cn(
                "flex-1 flex items-center justify-center rounded-md",
                "text-[11px] font-medium transition-all duration-150",
                activeTab === 'style'
                  ? "bg-gray-700 text-white shadow-sm"
                  : "text-gray-400 dark:text-slate-500 hover:text-gray-200"
              )}
            >
              Style
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={cn(
                "flex-1 flex items-center justify-center rounded-md",
                "text-[11px] font-medium transition-all duration-150",
                activeTab === 'ai'
                  ? "bg-gray-700 text-white shadow-sm"
                  : "text-gray-400 dark:text-slate-500 hover:text-gray-200"
              )}
            >
              AI
            </button>
          </div>
        </div>

        {STUDIO_FORMAT_FAILURES && formatFeedback.failure !== null && (
          <div data-studio-format-failure="true" role="alert" tabIndex={0} aria-label="Formatting change not confirmed">
            <strong>Formatting change not confirmed</strong>
            <p>{formatFeedback.failure}</p>
            <small>Controls may show attempted values. These values do not confirm that the slide changed.</small>
          </div>
        )}

        {/* Tab Content */}
        <div data-studio-v4-panel-fields className="flex-1 overflow-y-auto">
          {activeTab === 'style' && (
            <StyleTab
              key={STUDIO_FORMAT_FAILURES ? formatTargetKey : elementId || 'no-selection'}
              formatting={formatting}
              onSendCommand={STUDIO_FORMAT_FAILURES ? formatFeedback.run : handleSendCommand}
              isApplying={applying}
              elementId={elementId || ''}
              presentationId={presentationId}
            />
          )}
          {activeTab === 'ai' && (
            <AITab
              key={STUDIO_FORMAT_FAILURES ? formatTargetKey : undefined}
              onSendCommand={STUDIO_FORMAT_FAILURES ? formatFeedback.runNative : handleSendCommand}
              isApplying={applying}
              elementId={elementId || ''}
              presentationId={presentationId}
              slideIndex={slideIndex}
            />
          )}
        </div>

        {/* Applying indicator - refined */}
        {applying && (
          <div className={cn(
            "absolute bottom-4 left-1/2 -translate-x-1/2",
            "px-4 py-2 bg-indigo-600 rounded-full",
            "text-[11px] font-medium text-white shadow-lg"
          )}>
            Applying...
          </div>
        )}
      </div>
  )
}

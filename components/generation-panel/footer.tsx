'use client'

import { Sparkles, Loader2, AlertCircle, RotateCcw } from 'lucide-react'

interface GenerationPanelFooterProps {
  onGenerate: () => void
  isGenerating: boolean
  error: string | null
  disabled?: boolean
}

export function GenerationPanelFooter({
  onGenerate,
  isGenerating,
  error,
  disabled = false,
}: GenerationPanelFooterProps) {
  return (
    <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 space-y-2">
      {/* Error display with retry */}
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-red-50 border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-600 break-words">{error}</p>
            <button
              onClick={onGenerate}
              className="mt-1.5 flex items-center gap-1 text-[10px] text-red-500 hover:text-red-600 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={isGenerating || disabled}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            <span>Generate</span>
            <kbd className="ml-1 text-[10px] text-primary-foreground/50 font-mono">&#8984;&#9166;</kbd>
          </>
        )}
      </button>
    </div>
  )
}

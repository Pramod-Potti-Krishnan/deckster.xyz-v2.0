'use client'

import { Sparkles, Loader2, AlertCircle } from 'lucide-react'

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
    <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/50 space-y-2">
      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-red-900/30 border border-red-800/50">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-300 break-words">{error}</p>
          </div>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={isGenerating || disabled}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
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
          </>
        )}
      </button>
    </div>
  )
}

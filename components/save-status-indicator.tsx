"use client"

import { Loader2, Check, AlertCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error'

interface SaveStatusIndicatorProps {
  status: SaveStatus
  onRetry?: () => void
  className?: string
}

/**
 * SaveStatusIndicator Component
 *
 * Displays the current save status of the presentation.
 * - saved: Green checkmark - all changes saved
 * - unsaved: Yellow pulse - pending changes
 * - saving: Blue spinner - save in progress
 * - error: Red alert - save failed (click to retry)
 */
export function SaveStatusIndicator({
  status,
  onRetry,
  className
}: SaveStatusIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md",
        status === 'error' && onRetry && "cursor-pointer hover:bg-red-100",
        className
      )}
      onClick={status === 'error' && onRetry ? onRetry : undefined}
      title={status === 'error' && onRetry ? "Click to retry" : undefined}
    >
      {status === 'saved' && (
        <>
          <Check className="h-3 w-3 text-green-600" />
          <span className="text-green-700 font-medium">Saved</span>
        </>
      )}

      {status === 'unsaved' && (
        <>
          <Circle className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500 animate-pulse" />
          <span className="text-yellow-700 font-medium">Unsaved</span>
        </>
      )}

      {status === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
          <span className="text-blue-700 font-medium">Saving...</span>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="h-3 w-3 text-red-600" />
          <span className="text-red-700 font-medium">
            {onRetry ? "Save failed - Click to retry" : "Save failed"}
          </span>
        </>
      )}
    </div>
  )
}

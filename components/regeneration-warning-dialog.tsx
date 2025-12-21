"use client"

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { ContentContext, ContentContextSummary } from '@/components/content-context-form'
import { cn } from '@/lib/utils'

// ============================================================================
// Type Definitions
// ============================================================================

export interface RegenerationWarningDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  currentContext: ContentContext
  newContext: ContentContext
  isRegenerating?: boolean
}

// ============================================================================
// Helper Functions
// ============================================================================

function getChangedFields(
  current: ContentContext,
  updated: ContentContext
): string[] {
  const changes: string[] = []

  if (current.audience_type !== updated.audience_type) {
    changes.push('Audience')
  }
  if (current.purpose_type !== updated.purpose_type) {
    changes.push('Purpose')
  }
  if (current.duration_minutes !== updated.duration_minutes) {
    changes.push('Duration')
  }

  return changes
}

// ============================================================================
// Main Component
// ============================================================================

export function RegenerationWarningDialog({
  isOpen,
  onClose,
  onConfirm,
  currentContext,
  newContext,
  isRegenerating = false,
}: RegenerationWarningDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const changedFields = getChangedFields(currentContext, newContext)

  const handleConfirm = async () => {
    setIsProcessing(true)
    try {
      await onConfirm()
    } finally {
      setIsProcessing(false)
    }
  }

  const isLoading = isProcessing || isRegenerating

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-lg">
              Regenerate All Content?
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-4 space-y-4">
            <p>
              Changing {changedFields.length === 1 ? 'the' : 'these'}{' '}
              <span className="font-medium text-gray-700">
                {changedFields.join(', ')}
              </span>{' '}
              setting{changedFields.length > 1 ? 's' : ''} will regenerate all slides
              with new content optimized for your updated preferences.
            </p>

            {/* Current vs New comparison */}
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-200 bg-gray-50">
              <div className="p-3">
                <div className="text-xs font-medium text-gray-500 mb-1">Current Settings</div>
                <ContentContextSummary
                  context={currentContext}
                  className="text-gray-700"
                />
              </div>
              <div className="p-3">
                <div className="text-xs font-medium text-gray-500 mb-1">New Settings</div>
                <ContentContextSummary
                  context={newContext}
                  className="text-blue-700 font-medium"
                />
              </div>
            </div>

            <p className="text-amber-700 bg-amber-50 rounded-md p-3 text-sm">
              <strong>Note:</strong> This will replace all existing content.
              Your current presentation cannot be recovered after regeneration.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel
            disabled={isLoading}
            className="mt-0"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
              isLoading && "opacity-80"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate Content
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ============================================================================
// Hook for managing dialog state
// ============================================================================

interface UseRegenerationWarningOptions {
  currentContext: ContentContext
  onRegenerate: (newContext: ContentContext) => void | Promise<void>
}

export function useRegenerationWarning({
  currentContext,
  onRegenerate,
}: UseRegenerationWarningOptions) {
  const [isOpen, setIsOpen] = useState(false)
  const [pendingContext, setPendingContext] = useState<ContentContext | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const showWarning = (newContext: ContentContext) => {
    // Check if anything actually changed
    if (
      newContext.audience_type === currentContext.audience_type &&
      newContext.purpose_type === currentContext.purpose_type &&
      newContext.duration_minutes === currentContext.duration_minutes
    ) {
      return // No changes, don't show dialog
    }

    setPendingContext(newContext)
    setIsOpen(true)
  }

  const handleClose = () => {
    setIsOpen(false)
    setPendingContext(null)
  }

  const handleConfirm = async () => {
    if (!pendingContext) return

    setIsRegenerating(true)
    try {
      await onRegenerate(pendingContext)
      handleClose()
    } finally {
      setIsRegenerating(false)
    }
  }

  return {
    isOpen,
    pendingContext,
    isRegenerating,
    showWarning,
    handleClose,
    handleConfirm,
    dialogProps: {
      isOpen,
      onClose: handleClose,
      onConfirm: handleConfirm,
      currentContext,
      newContext: pendingContext || currentContext,
      isRegenerating,
    },
  }
}

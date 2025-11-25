"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle } from "lucide-react"

interface DeleteConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title?: string
  sessionTitles?: string[]
  isDeleting?: boolean
}

export function DeleteConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  title,
  sessionTitles = [],
  isDeleting = false
}: DeleteConfirmModalProps) {
  const count = sessionTitles.length
  const isBulk = count > 1

  // Format session titles for display (show max 3, then "+ N more")
  const displayTitles = sessionTitles.slice(0, 3)
  const remainingCount = Math.max(0, count - 3)

  const handleConfirm = () => {
    onConfirm()
    // Don't close modal here - let parent component handle it after deletion completes
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-left">
                {isBulk ? `Delete ${count} Sessions?` : `Delete Session?`}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left mt-2">
                {isBulk ? (
                  <>
                    <p className="mb-2">Are you sure you want to delete these sessions?</p>
                    <ul className="list-disc list-inside space-y-1 text-sm mb-2">
                      {displayTitles.map((title, index) => (
                        <li key={index} className="truncate">
                          {title || 'Untitled Session'}
                        </li>
                      ))}
                      {remainingCount > 0 && (
                        <li className="text-muted-foreground italic">
                          + {remainingCount} more session{remainingCount > 1 ? 's' : ''}
                        </li>
                      )}
                    </ul>
                  </>
                ) : (
                  <p>
                    Are you sure you want to delete{' '}
                    <span className="font-medium text-foreground">
                      "{title || sessionTitles[0] || 'Untitled Session'}"
                    </span>
                    ?
                  </p>
                )}
                <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-500">
                  This action cannot be undone.
                </p>
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Deleting...
              </span>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

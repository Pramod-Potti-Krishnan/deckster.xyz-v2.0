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
} from '@/components/ui/alert-dialog'

interface DeleteSlideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slideNumber: number
  onConfirm: () => void
  isDeleting?: boolean
}

/**
 * DeleteSlideDialog Component
 *
 * Confirmation dialog for slide deletion.
 * Shows slide number and requires explicit confirmation.
 */
export function DeleteSlideDialog({
  open,
  onOpenChange,
  slideNumber,
  onConfirm,
  isDeleting = false
}: DeleteSlideDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Slide {slideNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The slide and all its content will be permanently removed from the presentation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? 'Deleting...' : 'Delete Slide'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

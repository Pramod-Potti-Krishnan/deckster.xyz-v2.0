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
import './studio-slide-delete.css'

interface DeleteSlideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slideNumbers: number[]  // Array of 1-indexed slide numbers to delete
  onConfirm: () => void
  isDeleting?: boolean
}

/**
 * DeleteSlideDialog Component
 *
 * Confirmation dialog for slide deletion.
 * Supports both single and multiple slide deletion.
 * Shows slide number(s) and requires explicit confirmation.
 */
export function DeleteSlideDialog({
  open,
  onOpenChange,
  slideNumbers,
  onConfirm,
  isDeleting = false
}: DeleteSlideDialogProps) {
  const studio = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  const count = slideNumbers.length
  const isSingle = count === 1

  // Format slide numbers for display
  const slideListText = isSingle
    ? `Slide ${slideNumbers[0]}`
    : count <= 5
    ? `Slides ${slideNumbers.sort((a, b) => a - b).join(', ')}`
    : `${count} slides`

  const title = isSingle
    ? `Delete Slide ${slideNumbers[0]}?`
    : `Delete ${count} Slides?`

  const description = isSingle
    ? 'This action cannot be undone. The slide and all its content will be permanently removed from the presentation.'
    : `This action cannot be undone. ${slideListText} and all their content will be permanently removed from the presentation.`

  const buttonText = isDeleting
    ? 'Deleting...'
    : isSingle
    ? 'Delete Slide'
    : `Delete ${count} Slides`

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-studio-slide-delete={studio ? 'true' : undefined} aria-busy={studio ? isDeleting : undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {studio && count > 0 && (
          <div data-studio-slide-delete-part="targets" aria-label="Slides selected for deletion">
            <span>{isSingle ? 'Selected slide' : `${count} selected slides`}</span>
            <p>{[...slideNumbers].sort((a, b) => a - b).map(number => `Slide ${number}`).join(' · ')}</p>
          </div>
        )}
        {studio && isDeleting && <p data-studio-slide-delete-part="busy" role="status">Deleting selected slides…</p>}
        <AlertDialogFooter>
          <AlertDialogCancel data-studio-slide-delete-part={studio ? 'cancel' : undefined} disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-studio-slide-delete-part={studio ? 'confirm' : undefined}
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {buttonText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

"use client"

// NEXT_PUBLIC_STUDIO_PASS3_POLISH (PR B, audit #7): the Studio dialog that asks "Discard all changes?" where the viewer's edit mode used to call the browser's confirm(). Same look as the slide-delete dialog
// (it carries that dialog's data attribute, so components/studio-slide-delete.css styles it: panel, text, danger-red confirm, dark mode, the 100dvh cap). The viewer mounts it only with the flag on.
// Nothing is decided here: Cancel, Escape and "Keep editing" close it and discard nothing; only the confirm button calls onConfirm.
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
import '@/components/studio-slide-delete.css'
import { STUDIO_POLISH_COPY } from '@/lib/studio-pass3-polish-b'

interface StudioDiscardEditsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function StudioDiscardEditsDialog({ open, onOpenChange, onConfirm }: StudioDiscardEditsDialogProps) {
  const copy = STUDIO_POLISH_COPY.discard
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-studio-slide-delete="true" data-studio-discard-edits="true">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-studio-slide-delete-part="cancel">{copy.keep}</AlertDialogCancel>
          <AlertDialogAction data-studio-slide-delete-part="confirm" onClick={onConfirm} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">{copy.confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

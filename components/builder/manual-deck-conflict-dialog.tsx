"use client"

import { History, Layers3, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ManualDeckSummary } from '@/lib/manual-deck-workflow'

interface ManualDeckConflictDialogProps {
  open: boolean
  summary: ManualDeckSummary | null
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onPrependGenerated: () => void
  onStartNewSession: () => void
}

export function ManualDeckConflictDialog({
  open,
  summary,
  busy = false,
  error,
  onCancel,
  onPrependGenerated,
  onStartNewSession,
}: ManualDeckConflictDialogProps) {
  const slideCount = summary?.slide_count ?? 0
  const elementCount = summary?.element_count ?? 0

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Keep your customized slides?</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">
            This deck has {slideCount} customized {slideCount === 1 ? 'slide' : 'slides'}
            {elementCount > 0 ? ` and ${elementCount} added ${elementCount === 1 ? 'element' : 'elements'}` : ''}.
            Choose how to continue before Director builds the new deck.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3">
          <Button
            type="button"
            className="h-auto justify-start gap-3 whitespace-normal px-4 py-4 text-left"
            onClick={onPrependGenerated}
            disabled={busy}
            autoFocus
          >
            <Layers3 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>
              <span className="block font-semibold">Add generated slides above my slides</span>
              <span className="mt-1 block text-xs font-normal opacity-80">
                Builds separately, then combines the generated slides first and keeps your slides unchanged afterward.
              </span>
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-3 whitespace-normal px-4 py-4 text-left"
            onClick={onStartNewSession}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <History className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span>
              <span className="block font-semibold">Save this as previous and build in a new session</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Keeps this deck in session history and carries a structured summary into a clean Director session.
              </span>
            </span>
          </Button>
        </div>

        {error ? (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

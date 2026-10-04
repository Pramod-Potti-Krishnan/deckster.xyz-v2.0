"use client"

import { useRef } from 'react'
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
import './studio-manual-deck-conflict.css'

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
  const studio = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
  const contentRef = useRef<HTMLDivElement | null>(null)
  const openedContentRef = useRef<HTMLDivElement | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const slideCount = summary?.slide_count ?? 0
  const elementCount = summary?.element_count ?? 0

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <AlertDialogContent
        ref={studio ? contentRef : undefined}
        onOpenAutoFocus={studio ? () => {
          openedContentRef.current = contentRef.current
          const active = document.activeElement
          openerRef.current = active instanceof HTMLElement && active.isConnected && active !== document.body && !contentRef.current?.contains(active) ? active : null
          // Radix retains its native Cancel autofocus after this capture.
        } : undefined}
        onCloseAutoFocus={studio ? (event) => {
          const opener = openerRef.current
          const closingContent = openedContentRef.current
          openerRef.current = null
          openedContentRef.current = null
          const active = document.activeElement
          const anotherDialog = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')).some(dialog => dialog !== closingContent)
          if (opener?.isConnected && opener.ownerDocument === document && !anotherDialog && (!active || active === document.body || closingContent?.contains(active))) {
            event.preventDefault()
            opener.focus({ preventScroll: true })
          }
        } : undefined}
        data-studio-manual-deck-conflict={studio ? 'true' : undefined} aria-busy={studio ? busy : undefined} className="max-w-xl">
        <AlertDialogHeader data-studio-manual-conflict-part={studio ? 'header' : undefined}>
          <AlertDialogTitle>Keep your customized slides?</AlertDialogTitle>
          <AlertDialogDescription data-studio-manual-conflict-part={studio ? 'description' : undefined} className="leading-6">
            This deck has {slideCount} customized {slideCount === 1 ? 'slide' : 'slides'}
            {elementCount > 0 ? ` and ${elementCount} added ${elementCount === 1 ? 'element' : 'elements'}` : ''}.
            Choose how to continue before Director builds the new deck.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div data-studio-manual-conflict-part={studio ? 'choices' : undefined} className="grid gap-3">
          <Button
            type="button"
            className="h-auto justify-start gap-3 whitespace-normal px-4 py-4 text-left"
            data-studio-manual-conflict-choice={studio ? 'prepend' : undefined}
            onClick={onPrependGenerated}
            disabled={busy}
            autoFocus={studio ? undefined : true}
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
            data-studio-manual-conflict-choice={studio ? 'new-session' : undefined}
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
          <p data-studio-manual-conflict-part={studio ? 'error' : undefined} tabIndex={studio ? 0 : undefined} role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div data-studio-manual-conflict-part={studio ? 'footer' : undefined} className="flex justify-end">
          <AlertDialogCancel data-studio-manual-conflict-part={studio ? 'cancel' : undefined} disabled={busy}>Cancel</AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

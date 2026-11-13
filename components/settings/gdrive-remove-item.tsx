"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
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
import { Button, buttonVariants } from "@/components/ui/button"
import { REMOVE_CONFIRM_LABEL, REMOVE_DIALOG_BULLETS, REMOVE_DIALOG_WARNING, removeDialogTitle } from "@/lib/connectors-gdrive-remove"

/** D6b body: what the real erase deletes and what it leaves alone. Exported on its own so the copy can be rendered without the portal. */
export function DriveRemoveCopy() {
  const [copy, unlink, untouched] = REMOVE_DIALOG_BULLETS
  return (
    <>
      <ul className="list-disc space-y-1 pl-5">
        <li>{copy}</li>
        <li>{unlink}</li>
        <li><strong>{untouched}</strong></li>
      </ul>
      <p className="text-xs text-slate-500">{REMOVE_DIALOG_WARNING}</p>
    </>
  )
}

/**
 * P4-15 piece C (DARK, rendered only by the Drive Settings card, which is a 404 unless NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED is "true").
 * "Remove from library" never starts on a single click: the request runs only from the confirm button. While it runs the dialog stays open
 * and cannot be dismissed; the caller's onConfirm reports the outcome (toast on success, alert on failure) and the dialog closes after.
 */
export function DriveRemoveButton({ title, disabled, onConfirm }: { title?: string | null; disabled?: boolean; onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const confirm = async () => {
    setPending(true)
    try { await onConfirm() } finally { setPending(false); setOpen(false) }
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        data-connectors-gdrive-role="remove"
        aria-label={`Remove ${title || "Untitled"} from library`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
        Remove from library
      </Button>
      <AlertDialog open={open} onOpenChange={next => { if (!pending) setOpen(next) }}>
        <AlertDialogContent data-connectors-gdrive-role="remove-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{removeDialogTitle(title)}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm"><DriveRemoveCopy /></div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className={buttonVariants({ variant: "destructive" })}
              onClick={e => { e.preventDefault(); void confirm() }}
            >
              {pending ? "Removing..." : REMOVE_CONFIRM_LABEL}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

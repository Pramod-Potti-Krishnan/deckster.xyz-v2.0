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

/**
 * J6 pass-2 safety: "Import past sessions" POSTs /api/knowledge-graph/backfill, which writes entities, relations and evidence into the
 * person's real (saved) knowledge graph. Behind NEXT_PUBLIC_STUDIO_KNOWLEDGE_FIXES it never starts on a single click: this dialog names
 * what will be written and the import starts only from its confirm button. Cancel, Escape and a click outside close it without a request.
 */
export function KnowledgeImportConfirm({
  open,
  warning,
  onCancel,
  onConfirm,
}: {
  open: boolean
  /** Shown when another import may still be running (a reload, or a second tab). */
  warning: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={next => { if (!next) onCancel() }}>
      <AlertDialogContent data-studio-knowledge-role="import-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>Add your past sessions to your knowledge graph?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Deckster will read your past sessions that have uploads, research or a finished deck, and write what it finds into your
                saved knowledge graph:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>entities: the people, organizations, products and ideas it recognizes</li>
                <li>relations: how those entities connect</li>
                <li>evidence: short source snippets that back each entity</li>
              </ul>
              <p>
                This is your real graph, not a practice copy. Sessions already in your graph are skipped. Up to 50 sessions are
                processed, a few at a time, and it can take a few minutes. Keep this page open until it finishes. You can delete
                Knowledge data later in Knowledge settings.
              </p>
              {warning && (
                <p data-studio-knowledge-role="import-confirm-warning" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  {warning}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm()}>Import sessions</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

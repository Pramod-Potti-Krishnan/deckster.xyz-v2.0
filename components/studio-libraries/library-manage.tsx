"use client"

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Loader2, MoreVertical } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import { LIBRARY_NAME_MAX, UNEXPECTED_TEXT, deleteDialogCopy, libraryNameProblem, type LibraryKind, type ManageResult } from '@/lib/studio-library-manage'
import './library-manage.css'

export type ManagedRowChild = ReactNode

// FRONTEND-2 Pass 3 track 4 (NEXT_PUBLIC_STUDIO_THEME_LIBRARY_MANAGE / NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE, default off). One library row with a ⋮ menu (the Decks list's menu: the same
// DropdownMenu, "Manage <name>" label, red Delete) and, for a theme, an inline Rename. Delete asks first in Studio's own AlertDialog (never window.confirm). The workspace passes in the row's
// normal button as `children` and does the state work (lib/studio-library-manage.ts); this component only draws the menu, the edit field and the dialog, and reports a failure as a toast.
export function ManagedLibraryRow({ kind, name, isStandard = false, disabled = false, deleteBlockedReason, otherNames = [], onRename, onDelete, children }: {
  kind: LibraryKind
  name: string
  isStandard?: boolean
  disabled?: boolean
  /** When set, Delete is shown disabled with this one line under it (the Decks list's pattern for an action that is not connected), and no delete can start. */
  deleteBlockedReason?: string
  /** Names of the library's other items, for the duplicate check while typing (only a rename uses it). */
  otherNames?: readonly string[]
  /** Absent for a template: Director has no template rename route, so the menu then holds Delete only. */
  onRename?: (name: string) => Promise<ManageResult>
  onDelete: () => Promise<ManageResult>
  children: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [problem, setProblem] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const row = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  const alive = useRef(true)
  const problemId = useId()
  const noteId = useId()
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (editing) { field.current?.focus(); field.current?.select() }
    else if (wasEditing.current) trigger.current?.focus()
    wasEditing.current = editing
  }, [editing])

  const startRename = () => { setDraft(name); setProblem(''); setEditing(true) }
  const cancelRename = () => { setEditing(false); setProblem('') }
  const submitRename = (event: FormEvent) => {
    event.preventDefault()
    if (!onRename) return
    if (draft.trim() === name) { cancelRename(); return }
    const issue = libraryNameProblem(kind, draft, otherNames)
    if (issue) { setProblem(issue); field.current?.focus(); return }
    // Optimistic: the field closes at once and the row already shows the new name; a refused save puts the old one back and says so.
    setEditing(false); setProblem('')
    void onRename(draft).then(result => {
      if (!result.ok && !result.stale && result.message) toast({ variant: 'destructive', title: 'Rename not saved', description: result.message })
    }, () => toast({ variant: 'destructive', title: 'Rename not saved', description: UNEXPECTED_TEXT }))
  }
  const renameKey = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelRename() } }

  const confirmDelete = async () => {
    if (deleting || deleteBlockedReason) return
    const list = row.current?.closest('.sl-library-list') ?? null
    setDeleting(true); setDeleteError('')
    let result: ManageResult
    try { result = await onDelete() } catch { result = { ok: false, message: UNEXPECTED_TEXT } }
    if (result.ok) {
      // The row is gone; Studio's dialog would hand focus back to a button that no longer exists, so the list's own selected row gets it.
      requestAnimationFrame(() => (list?.querySelector<HTMLElement>('.sl-record[aria-pressed="true"]') ?? list?.querySelector<HTMLElement>('.sl-record'))?.focus())
      return
    }
    if (result.stale) return
    if (alive.current) { setDeleting(false); setDeleteError(result.message) }
    toast({ variant: 'destructive', title: `${kind === 'theme' ? 'Theme' : 'Template'} not deleted`, description: result.message })
  }

  const copy = deleteDialogCopy(kind, name, isStandard)
  return <div ref={row} className="sl-record-row" data-studio-library-row={kind} data-editing={editing ? 'true' : undefined}>
    {editing && <form className="sl-rename" data-studio-library-rename-form="true" onSubmit={submitRename} noValidate>
      <label className="sl-field">Rename {kind}
        <input ref={field} value={draft} maxLength={LIBRARY_NAME_MAX} spellCheck={false} aria-invalid={problem ? true : undefined} aria-describedby={problem ? problemId : undefined}
          onChange={event => { setDraft(event.target.value); if (problem) setProblem('') }} onKeyDown={renameKey} />
      </label>
      {problem && <p id={problemId} className="sl-field-error" role="alert" data-studio-library-rename-problem="true">{problem}</p>}
      <div className="sl-rename-actions"><button type="button" className="sl-button" onClick={cancelRename}>Cancel</button><button type="submit" className="sl-primary">Save name</button></div>
    </form>}
    {children}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button ref={trigger} type="button" className="sl-row-menu" aria-label={`Manage ${name}`} disabled={disabled} data-studio-library-menu={kind}><MoreVertical size={16} aria-hidden="true" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-studio-library-menu-content={kind} onCloseAutoFocus={event => { if (field.current) event.preventDefault() }}>
        {onRename && <DropdownMenuItem data-studio-library-rename="true" onSelect={startRename}>Rename</DropdownMenuItem>}
        <DropdownMenuItem data-studio-library-delete="true" className="text-red-600" disabled={Boolean(deleteBlockedReason)} aria-describedby={deleteBlockedReason ? noteId : undefined} onSelect={() => { if (deleteBlockedReason) return; setDeleteError(''); setConfirming(true) }}>Delete…</DropdownMenuItem>
        {deleteBlockedReason && <p id={noteId} className="max-w-56 px-2 py-2 text-xs text-muted-foreground" data-studio-library-delete-note="true">{deleteBlockedReason}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={confirming} onOpenChange={open => { if (!open && !deleting) { setConfirming(false); setDeleteError('') } }}>
      <AlertDialogContent data-studio-library-delete-dialog={kind} aria-busy={deleting} onEscapeKeyDown={event => { if (deleting) event.preventDefault() }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription data-studio-library-delete-description="true">{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        {deleteError && <p role="alert" className="text-sm text-red-600" data-studio-library-delete-error="true">{deleteError}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction data-studio-library-delete-confirm="true" disabled={deleting} onClick={event => { event.preventDefault(); void confirmDelete() }}>
            {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</> : deleteError ? 'Try again' : `Delete ${kind}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}

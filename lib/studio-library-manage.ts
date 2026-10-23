// FRONTEND-2 Pass 3, track 4 (NEXT_PUBLIC_STUDIO_THEME_LIBRARY_MANAGE and NEXT_PUBLIC_STUDIO_TEMPLATE_LIBRARY_MANAGE, each exact "true", default off): rename and delete on the
// user's own saved themes and templates in the Studio libraries. Import-free on purpose, so the pins can run it as it is and the two workspaces only pass it their state.
//
// What Director allows (backend/director main.py on origin/uat):
//   theme    PATCH  /api/users/{uid}/themes/{id}     body { name } (name/description/theme/is_standard are all optional; an empty name is NOT refused there, so the guard is here)
//            DELETE /api/users/{uid}/themes/{id}     200 { status: "deleted", id } (also when the row is already gone)
//   template DELETE /api/users/{uid}/templates/{id}  200 { status: "deleted", id }
//            PATCH  /api/users/{uid}/templates/{id}  body { name } (1-150 characters, trimmed): 200 the list-row summary; 404 { detail: "template not found" }; 409 a name the person already has; 422 a refused name;
//                   405 Allow: GET while Director's DIRECTOR_TEMPLATE_RENAME_ENABLED is off (its default). The old PATCH .../blueprint replaces the blueprint and is not a rename.
// Both tables have UNIQUE (user_id, name) (case-sensitive in the database; the check below is case-insensitive, like the create form's). A rename onto a taken name comes back
// as a generic 500 from Director's PATCH (only the POST maps a duplicate to 409), so a failed rename says "another one may use that name" instead of naming a cause it cannot know.
//
// A deck never points at a saved theme or template: a build copies the theme selection into the session (desired/applied theme state) and Layout keeps a per-presentation
// render snapshot, so deleting a saved theme leaves every built deck as it is. A template is read when a reuse build runs (session.active_template_id), so only a Studio session
// that is still rebuilding from it is affected ("I couldn't rebuild from that template"). The delete dialogs say both in plain words.

export type LibraryKind = 'theme' | 'template'
export interface LibraryItem { id: string; name: string }

export const LIBRARY_NAME_MAX = 150

/** Why `raw` cannot be the name of a saved theme/template, or null when it can. `otherNames` are the names of the OTHER items in the library. */
export function libraryNameProblem(kind: LibraryKind, raw: string, otherNames: readonly string[]): string | null {
  const name = raw.trim()
  if (!name) return 'Enter a name.'
  if (name.length > LIBRARY_NAME_MAX) return `Use ${LIBRARY_NAME_MAX} characters or fewer.`
  if (otherNames.some(other => other.trim().toLowerCase() === name.toLowerCase())) return `A saved ${kind} has this name. Choose a different name.`
  return null
}

// Director lists only the signed-in user's own rows today, so every row qualifies. This keeps a row Director ever marks as built in or Deckster's own from getting a menu.
const BUILT_IN_FLAGS = ['is_builtin', 'is_built_in', 'builtin', 'built_in', 'is_system', 'is_deckster', 'is_default_library'] as const
const BUILT_IN_OWNERS = ['deckster', 'system', 'builtin', 'built-in', 'built_in'] as const
const OWNER_FIELDS = ['owner', 'user_id', 'source', 'origin', 'created_by'] as const

/** True for a row the person owns (the only rows that get Rename / Delete). A row with no id, or one marked built in / owned by Deckster, is not. */
export function isUserOwnedLibraryItem(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false
  const row = item as Record<string, unknown>
  if (typeof row.id !== 'string' || !row.id) return false
  if (BUILT_IN_FLAGS.some(key => row[key] === true)) return false
  return !OWNER_FIELDS.some(key => typeof row[key] === 'string' && (BUILT_IN_OWNERS as readonly string[]).includes((row[key] as string).trim().toLowerCase()))
}

export function renamedItems<T extends LibraryItem>(items: T[] | null, id: string, name: string): T[] | null {
  return items ? items.map(item => item.id === id ? { ...item, name } : item) : items
}

export function withoutItem<T extends LibraryItem>(items: T[] | null, id: string): T[] | null {
  return items ? items.filter(item => item.id !== id) : items
}

/** The selection once `removedId` is gone from `items` (the list as it was): unchanged unless it was the removed one, then its neighbour below, else above, else none. */
export function selectionAfterRemoval<T extends LibraryItem>(items: readonly T[], removedId: string, selectedId: string | null): string | null {
  if (selectedId !== removedId) return selectedId
  const index = items.findIndex(item => item.id === removedId)
  if (index < 0) return items[0]?.id ?? null
  return items[index + 1]?.id ?? items[index - 1]?.id ?? null
}

// ---- plain-words copy -------------------------------------------------------------------------------------------------------------------------------------------------------------

export function renameFailedText(kind: LibraryKind, previousName: string): string {
  return `“${previousName}” was not renamed and keeps its old name. Another ${kind} may already use that name; try a different one, or refresh the library.`
}

export function deleteFailedText(kind: LibraryKind, name: string): string {
  return `“${name}” was not deleted and is still in your library. Try again, or refresh the library to check.`
}

export function deleteDialogCopy(kind: LibraryKind, name: string, isStandard = false): { title: string; body: string } {
  if (kind === 'theme') {
    return {
      title: 'Delete this theme?',
      body: `“${name}” is removed from your library. Presentations already built with it keep their look, because each keeps its own copy of the colors and fonts.${isStandard ? ' It is your standard theme, so new presentations go back to the session default.' : ''} There is no undo.`,
    }
  }
  return {
    title: 'Delete this template?',
    body: `“${name}” is removed from your templates. Presentations already built from it are not changed. A Studio session that is still rebuilding from it cannot continue with it. There is no undo.`,
  }
}

export const STALE_TEXT = ''
export const BUSY_TEXT = 'Another library action is still running. Try again in a moment.'
// A Composer (stage-carrier) template: Director's DELETE removes only its template_configs row and leaves the carrier bytes and the "uses" rows orphaned, and those belong to Composer, so v1 does not delete them from here.
export const COMPOSER_TEMPLATE_DELETE_REASON = "Composer templates can't be deleted here yet."
export const UNEXPECTED_TEXT = 'Something went wrong and nothing was changed. Refresh the library to check, then try again.'
export const GONE_TEXT = 'This item is no longer in your library. Refresh the library to see its current state.'

// ---- template rename: Director's answers in plain words ---------------------------------------------------------------------------------------------------------------------------
// hooks/use-templates.ts reads Director's answer as one of these reasons (templateRenameFailure); this turns a reason into the sentence the person sees. A Composer (stage-carrier) template renames like any other:
// only its name changes (COMPOSER-2), unlike delete.
export type TemplateRenameReason = 'gone' | 'taken' | 'invalid' | 'unavailable' | 'sign_in' | 'failed'
export const TEMPLATE_RENAME_UNAVAILABLE_REASON = "Renaming templates isn't available yet."

export function templateRenameRefusal(failure: { reason: TemplateRenameReason; detail?: string }, previousName: string): RenameRefusal {
  switch (failure.reason) {
    case 'gone': return { refused: true, message: `“${previousName}” is no longer available, so it was not renamed. Refresh the library to see your current templates.` }
    case 'taken': return { refused: true, field: true, message: 'A template with that name already exists. Choose a different name.' }
    case 'invalid': return { refused: true, field: true, message: failure.detail || `Use 1 to ${LIBRARY_NAME_MAX} characters.` }
    case 'unavailable': return { refused: true, message: `${TEMPLATE_RENAME_UNAVAILABLE_REASON} “${previousName}” keeps its name.` }
    case 'sign_in': return { refused: true, message: `We couldn't confirm your sign-in for this change, so “${previousName}” was not renamed. Reload the page and try again.` }
    default: return { refused: true, message: `“${previousName}” was not renamed and keeps its old name. Try again, or refresh the library to check.` }
  }
}

// ---- the two operations -----------------------------------------------------------------------------------------------------------------------------------------------------------

// `field`: the message is about the name itself (a name Director refused or one the person already has), so the row puts it under the name field and keeps what was typed, instead of a toast.
export type ManageResult = { ok: true; name: string } | { ok: false; message: string; stale?: true; field?: true }

/** What a rename's `commit` may resolve to instead of a saved item: Director said no, and why (see templateRenameRefusal). */
export interface RenameRefusal { refused: true; message: string; field?: true }

export interface ManageDeps<T extends LibraryItem> {
  /** The list as the page holds it right now (null before it has loaded). */
  getItems: () => T[] | null
  /** Replaces the page's list through an updater (the page's setState). */
  setItems: (update: (items: T[] | null) => T[] | null) => void
  /** False once the page or the signed-in account has changed since the action started: nothing more is touched and nothing is reported. */
  isCurrent: () => boolean
}

/**
 * Rename with an optimistic update. The list shows the new name at once; Director's answer either confirms it (its spelling wins) or the old name comes back.
 * `commit` resolves to the saved item, or null when the save was not confirmed.
 */
export async function runLibraryRename<T extends LibraryItem>(
  kind: LibraryKind,
  deps: ManageDeps<T> & { commit: (id: string, name: string) => Promise<{ id?: string; name?: string } | RenameRefusal | null> },
  id: string,
  rawName: string,
): Promise<ManageResult> {
  const items = deps.getItems()
  const item = items?.find(candidate => candidate.id === id)
  if (!items || !item) return { ok: false, message: GONE_TEXT }
  const name = rawName.trim()
  if (name === item.name) return { ok: true, name }
  const problem = libraryNameProblem(kind, rawName, items.filter(candidate => candidate.id !== id).map(candidate => candidate.name))
  if (problem) return { ok: false, message: problem }
  const previous = item.name
  deps.setItems(list => renamedItems(list, id, name))
  let saved: { id?: string; name?: string } | RenameRefusal | null = null
  try { saved = await deps.commit(id, name) } catch { saved = null }
  if (!deps.isCurrent()) return { ok: false, message: STALE_TEXT, stale: true }
  if (saved && 'refused' in saved) {
    // Director refused and said why (gone, a taken name, a refused name, the route off): the old name comes back, and the reason is the message.
    deps.setItems(list => list ? list.map(candidate => candidate.id === id && candidate.name === name ? { ...candidate, name: previous } : candidate) : list)
    return { ok: false, message: saved.message, ...(saved.field ? { field: true as const } : {}) }
  }
  if (!saved || saved.id !== id) {
    // Only an item that still wears the optimistic name goes back: a later change of its name (a refresh, another action) is not undone.
    deps.setItems(list => list ? list.map(candidate => candidate.id === id && candidate.name === name ? { ...candidate, name: previous } : candidate) : list)
    return { ok: false, message: renameFailedText(kind, previous) }
  }
  const confirmed = typeof saved.name === 'string' && saved.name ? saved.name : name
  if (confirmed !== name) deps.setItems(list => list ? list.map(candidate => candidate.id === id && candidate.name === name ? { ...candidate, name: confirmed } : candidate) : list)
  return { ok: true, name: confirmed }
}

/** Delete: the item leaves the list only after Director confirms. `commit` resolves to true when it did. */
export async function runLibraryDelete<T extends LibraryItem>(
  kind: LibraryKind,
  deps: ManageDeps<T> & { commit: (id: string) => Promise<boolean> },
  id: string,
): Promise<ManageResult> {
  const item = deps.getItems()?.find(candidate => candidate.id === id)
  if (!item) return { ok: false, message: GONE_TEXT }
  let deleted = false
  try { deleted = (await deps.commit(id)) === true } catch { deleted = false }
  if (!deps.isCurrent()) return { ok: false, message: STALE_TEXT, stale: true }
  if (!deleted) return { ok: false, message: deleteFailedText(kind, item.name) }
  deps.setItems(list => withoutItem(list, id))
  return { ok: true, name: item.name }
}

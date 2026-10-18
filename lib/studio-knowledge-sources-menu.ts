/**
 * KNOWLEDGE-HEADER-ACTIONS (flag NEXT_PUBLIC_STUDIO_KNOWLEDGE_HEADER_ACTIONS, exact "true", default off; Studio shell only). Card PASS2-J6-FINDINGS, finding L5
 * "header actions (Sources dropdown, one search field)"; KNOWLEDGE-2 run 0109439e, streams/ops/PASS2/J6/RUN.md section 2.
 *
 * The Second Brain header gave its prime spot to maintenance (Refresh, Import past sessions, the settings gear) and kept the search inside the map card.
 * The accepted mock (design/studio-v4-mockup/components/workspace.tsx, `ws-brain-bar`) puts ONE "Sources N" dropdown and ONE search field there.
 *
 * What this does, with the page's own handlers and numbers:
 *  - a "Sources" button with the number of deck sessions that contribute knowledge (stats.sessions_consolidated; no number until the stats are loaded), opening a
 *    menu of the three maintenance actions the header used to show: Import past sessions, Refresh, Knowledge settings;
 *  - the search field moves up into the header, unchanged (same box, same results, same handlers).
 * "Import past sessions" still goes wherever it went (the confirm dialog with NEXT_PUBLIC_STUDIO_KNOWLEDGE_FIXES on, the import itself with it off); the menu
 * never starts anything by opening. The busy rules are the header buttons' own: Import is off while an import runs, Refresh while the page loads or imports.
 *
 * Pure, no imports: the test loads this file on its own. The flag is read in app/(app)/knowledge/page.tsx (exact "true", Studio shell only); with it off
 * nothing in this file runs.
 */
export const SOURCES_LABEL = 'Sources'

export type SourcesAction = 'import' | 'refresh' | 'settings'

export interface SourcesMenuItem {
  action: SourcesAction
  label: string
  hint: string
  disabled: boolean
}

/** The number on the button: a whole number >= 0, or null while there is none to show. */
export function sourcesCount(sessions: unknown): number | null {
  return typeof sessions === 'number' && Number.isFinite(sessions) && sessions >= 0 ? Math.floor(sessions) : null
}

/** What a screen reader hears for the button ("Sources" when there is no number). */
export function sourcesButtonLabel(sessions: unknown): string {
  const count = sourcesCount(sessions)
  if (count === null) return SOURCES_LABEL
  return `${SOURCES_LABEL}, ${count} ${count === 1 ? 'session contributes' : 'sessions contribute'} to your knowledge`
}

/** The menu, in order, with the busy rules the header buttons had. */
export function sourcesMenuItems(state: { importing: boolean; loading: boolean }): SourcesMenuItem[] {
  const { importing, loading } = state
  return [
    { action: 'import', label: importing ? 'Importing…' : 'Import past sessions', hint: 'Add eligible past sessions to your knowledge', disabled: importing },
    { action: 'refresh', label: loading ? 'Refreshing…' : 'Refresh', hint: 'Reload the map and the counts', disabled: loading || importing },
    { action: 'settings', label: 'Knowledge settings', hint: 'Turn Knowledge on or off, or delete what it holds', disabled: false },
  ]
}

/** Arrow-key movement over the enabled items (`enabled` = their indexes in order). Down/Up wrap; Home/End jump; null for any other key or no item. */
export function nextMenuIndex(current: number, key: string, enabled: readonly number[]): number | null {
  if (enabled.length === 0) return null
  const at = enabled.indexOf(current)
  if (key === 'Home') return enabled[0]
  if (key === 'End') return enabled[enabled.length - 1]
  if (key === 'ArrowDown') return enabled[at < 0 || at === enabled.length - 1 ? 0 : at + 1]
  if (key === 'ArrowUp') return enabled[at <= 0 ? enabled.length - 1 : at - 1]
  return null
}

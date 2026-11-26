// PL-62 STUDIO-TICKET-READY (Platform card, 26 Nov 2026): with the Layout viewer ticket on, the editing frame's `src` carries ?t=<ticket>, and its load handler compared that src to the approved URL with `===`.
// This change makes the compare ignore ONLY the t parameter (lib/studio-layout-viewer-ticket.ts viewerSrcMatchesApproved), behind NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED. Stacked on PL-60 (claude/pl60-view-tickets).
// The only existing file whose older lines it touches is components/presentation-viewer.tsx: two pure insertions and two whole-line replacements, every one carrying the marker LAYOUT-TICKET-READY.
// Strip them (the inserted lines out, the replaced lines back) and the file is its base, byte for byte. Plain node, nothing is read from disk or git here.

export const PL62_BASE_COMMIT = 'a6fd96cc63' // origin/claude/pl60-view-tickets, the commit this change is cut from
export const PL62_COMMIT_SUBJECT = /^PL-62:/
export const PL62_MARKER_RE = /(?<![\w-])LAYOUT-TICKET-READY(?![\w-])/
export const PL62_VIEWER = 'components/presentation-viewer.tsx'

/** Whole lines this change inserts into the viewer (they come out). */
export const PL62_INSERTED_LINES = [
  "import { viewerSrcMatchesApproved } from '@/lib/studio-layout-viewer-ticket' // LAYOUT-TICKET-READY (PL-62): with ticketing on, the frame's src carries ?t=<ticket>; the load check ignores only that parameter",
  "    loadedUrl = approvedIframeNavigationUrl // LAYOUT-TICKET-READY (PL-62): what readiness and the native frame's source compare is the approved URL, not the ticketed src",
]
/** Whole lines this change rewrites: [line now, line before]. */
export const PL62_REPLACED_LINES = [
  ["    let loadedUrl = event.currentTarget.src // LAYOUT-TICKET-READY (PL-62)", "    const loadedUrl = event.currentTarget.src"],
  ["    if (!approvedIframeNavigationUrl || !viewerSrcMatchesApproved(loadedUrl, approvedIframeNavigationUrl)) { // LAYOUT-TICKET-READY (PL-62)", "    if (!approvedIframeNavigationUrl || loadedUrl !== approvedIframeNavigationUrl) {"],
]

/** The viewer without this change's lines; every other file (and a viewer that does not carry them) comes back untouched. */
export function stripPl62TicketReady(rel, text) {
  if (rel !== PL62_VIEWER) return text
  const replaced = new Map(PL62_REPLACED_LINES)
  return text.split('\n').filter(line => !PL62_INSERTED_LINES.includes(line)).map(line => replaced.get(line) ?? line).join('\n')
}

/** Every file this change's commits touch: what the older scope checks skip once the registry names it. */
export const PL62_SCOPE_FILES = new Set([
  "components/presentation-viewer.tsx",
  "lib/studio-layout-viewer-ticket.ts",
  "scripts/test-studio-pl62-ticket-ready.mjs",
  "scripts/studio-pl62-ticket-ready-strip.mjs",
  "scripts/studio-later-changes.mjs"
])

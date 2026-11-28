// PL-61 STUDIO-DASHBOARD-THUMBNAIL (Platform card, 26 Nov 2026; ARCH-PLATFORM ruling 14:44Z, option 3): with NEXT_PUBLIC_STUDIO_LAYOUT_TICKET_ENABLED on, a Decks-page card uses the EXISTING first-slide thumbnail
// (DECK-CARD-THUMBNAIL) and never a live Layout viewer (no ticket mint per card). Stacked on PL-62 (claude/pl62-ticket-ready-compare, 4acaa1820a).
// Two existing files get marked lines: app/(app)/dashboard/page.tsx (two insertions and one whole-line rewrite) and hooks/use-studio-deck-card-thumbnail.tsx (one insertion and one whole-line rewrite), each carrying LAYOUT-TICKET-DASHBOARD.
// (The library lib/studio-deck-card-thumbnail.ts is NOT touched: its own proof pins that it reads no flag but its own.)
// Strip them (the inserted lines out, the rewritten lines back) and each file is its base, byte for byte. Plain node, nothing is read from disk or git here.

export const PL61_BASE_COMMIT = '4acaa1820a' // origin/claude/pl62-ticket-ready-compare, the commit this change is cut from
export const PL61_COMMIT_SUBJECT = /^PL-61:/
export const PL61_MARKER_RE = /(?<![\w-])LAYOUT-TICKET-DASHBOARD(?![\w-])/
export const PL61_PAGE = 'app/(app)/dashboard/page.tsx'
export const PL61_HOOK = 'hooks/use-studio-deck-card-thumbnail.tsx'

/** Whole lines this change inserts, per file (they come out). */
export const PL61_INSERTED_LINES = {
  [PL61_PAGE]: [
    'import { isStudioLayoutTicketEnabled } from "@/lib/studio-layout-viewer-ticket" // LAYOUT-TICKET-DASHBOARD (PL-61): with Layout viewer tickets on, a deck card never draws a live viewer',
    "  const liveFrameAllowed = !isStudioLayoutTicketEnabled() // LAYOUT-TICKET-DASHBOARD (PL-61): flag on, a card whose thumbnail is unavailable shows the placeholder, never a live viewer",
  ],
  [PL61_HOOK]: [
    "import { isStudioLayoutTicketEnabled } from '@/lib/studio-layout-viewer-ticket' // LAYOUT-TICKET-DASHBOARD (PL-61): with Layout viewer tickets on, the Decks page draws first-slide images, never a live viewer (no ticket mint per card)",
  ],
}
/** Whole lines this change rewrites, per file: [line now, line before]. */
export const PL61_REPLACED_LINES = {
  [PL61_PAGE]: [
    ["  if (decision.status === 'allowed' && liveFrameAllowed) { // LAYOUT-TICKET-DASHBOARD (PL-61)", "  if (decision.status === 'allowed') {"],
  ],
  [PL61_HOOK]: [
    ["  const id = STUDIO_DECK_CARD_THUMBNAILS_ENABLED || isStudioLayoutTicketEnabled() /* LAYOUT-TICKET-DASHBOARD (PL-61) */ ? deckCardThumbnailTarget(decision, LAYOUT_VIEWER_URL_POLICY.configuredOrigin)?.presentationId ?? null : null", "  const id = STUDIO_DECK_CARD_THUMBNAILS_ENABLED ? deckCardThumbnailTarget(decision, LAYOUT_VIEWER_URL_POLICY.configuredOrigin)?.presentationId ?? null : null"],
  ],
}

/** The reverse hunks of the eight older proofs this change teaches: [text as it stands now, text as it was before], generated from the diff against the PL-62 head (4acaa1820a) (not retyped). */
export const PL61_REVERSE_HUNKS = {
  "scripts/test-studio-create-word.mjs": [
    [
      "import { stripPl61DashboardThumbnail } from './studio-pl61-dashboard-thumbnail-strip.mjs' // LATER-CHANGES: registry read (PL-61): the Decks page's marked lines come out first\nconst read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, stripLaterChanges(rel, stripPl61DashboardThumbnail(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))))) // DECK-CARD-THUMBNAIL: its lines out first // LATER-CHANGES: registry read (RESTACK-UX-PC): the later changes' lines are read out first, innermost; PL-61's before them (registry read)\n",
      "const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))) // DECK-CARD-THUMBNAIL: its lines out first // LATER-CHANGES: registry read (RESTACK-UX-PC): the later changes' lines are read out first, innermost\n"
    ],
    [
      "  '@/lib/studio-layout-viewer-ticket': { isStudioLayoutTicketEnabled: () => false }, // LATER-CHANGES: registry read (PL-61): the Decks page asks whether Layout viewer tickets are on; flag off here\n",
      ""
    ]
  ],
  "scripts/test-studio-deck-card-count.mjs": [
    [
      "    '@/lib/studio-layout-viewer-ticket': { isStudioLayoutTicketEnabled: () => false }, // LATER-CHANGES: registry read (PL-61): the Decks page asks whether Layout viewer tickets are on; flag off here\n",
      ""
    ]
  ],
  "scripts/test-studio-deck-card-thumbnail.mjs": [
    [
      "import { stripPl61DashboardThumbnail } from './studio-pl61-dashboard-thumbnail-strip.mjs' // LATER-CHANGES: registry read (PL-61): the Decks page's marked lines come out first\n",
      ""
    ],
    [
      "const pageText = stripAuditConsole(DASHBOARD_PAGE, stripAuditPreviews(DASHBOARD_PAGE, stripPl61DashboardThumbnail(DASHBOARD_PAGE, read(DASHBOARD_PAGE)))) // LATER-CHANGES: registry read (AUDIT-CONSOLE); LATER-CHANGES: registry read (AUDIT-PREVIEWS); LATER-CHANGES: registry read (PL-61): the Decks page's marked lines come out first\n",
      "const pageText = stripAuditConsole(DASHBOARD_PAGE, stripAuditPreviews(DASHBOARD_PAGE, read(DASHBOARD_PAGE))) // LATER-CHANGES: registry read (AUDIT-CONSOLE); LATER-CHANGES: registry read (AUDIT-PREVIEWS): this change's lines come out first\n"
    ]
  ],
  "scripts/test-studio-deck-cards-v2.mjs": [
    [
      "    '@/lib/studio-layout-viewer-ticket': { isStudioLayoutTicketEnabled: () => false }, // LATER-CHANGES: registry read (PL-61): the Decks page asks whether Layout viewer tickets are on; flag off here\n",
      ""
    ]
  ],
  "scripts/test-studio-deck-grid-4.mjs": [
    [
      "import { stripPl61DashboardThumbnail } from './studio-pl61-dashboard-thumbnail-strip.mjs' // LATER-CHANGES: registry read (PL-61): the Decks page's marked lines come out first\nconst read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, stripPl61DashboardThumbnail(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))) // DECK-CARD-THUMBNAIL: its lines out first; PL-61's before them (registry read)\n",
      "const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) // DECK-CARD-THUMBNAIL: its lines out first\n"
    ],
    [
      "  '@/lib/studio-layout-viewer-ticket': { isStudioLayoutTicketEnabled: () => false }, // LATER-CHANGES: registry read (PL-61): the Decks page asks whether Layout viewer tickets are on; flag off here\n",
      ""
    ]
  ],
  "scripts/test-studio-deck-title.mjs": [
    [
      "    '@/lib/studio-layout-viewer-ticket': { isStudioLayoutTicketEnabled: () => false }, // LATER-CHANGES: registry read (PL-61): the Decks page asks whether Layout viewer tickets are on; flag off here\n",
      ""
    ]
  ],
  "scripts/test-studio-launch-wording.mjs": [
    [
      "import { stripPl61DashboardThumbnail } from './studio-pl61-dashboard-thumbnail-strip.mjs' // LATER-CHANGES: registry read (PL-61)\n",
      ""
    ],
    [
      "  heads = Object.fromEntries(Object.entries(heads).map(([rel, text]) => [rel, stripPl61DashboardThumbnail(rel, text)])) // LATER-CHANGES: registry read (PL-61): the Decks page's marked lines come out first\n",
      ""
    ]
  ],
  "scripts/test-studio-plain-nav-labels.mjs": [
    [
      "import { stripPl61DashboardThumbnail } from './studio-pl61-dashboard-thumbnail-strip.mjs' // LATER-CHANGES: registry read (PL-61)\n",
      ""
    ],
    [
      "  page = stripPl61DashboardThumbnail('app/(app)/dashboard/page.tsx', page) // LATER-CHANGES: registry read (PL-61): the Decks page's marked lines come out first\n",
      ""
    ]
  ]
}

/** The page and the hook without this change's lines, and each taught proof with its taught lines put back; every other file comes back untouched. */
export function stripPl61DashboardThumbnail(rel, text) {
  const hunks = PL61_REVERSE_HUNKS[rel]
  if (hunks) { let out = text; for (const [now, before] of hunks) { const at = out.indexOf(now); if (at >= 0) out = out.slice(0, at) + before + out.slice(at + now.length) } return out }
  const inserted = PL61_INSERTED_LINES[rel] ?? [], replaced = new Map(PL61_REPLACED_LINES[rel] ?? [])
  if (!inserted.length && !replaced.size) return text
  return text.split('\n').filter(line => !inserted.includes(line)).map(line => replaced.get(line) ?? line).join('\n')
}

/** Every file this change's commits touch: what the older scope checks skip once the registry names it. */
export const PL61_SCOPE_FILES = new Set([
  "app/(app)/dashboard/page.tsx",
  "hooks/use-studio-deck-card-thumbnail.tsx",
  "scripts/test-studio-create-word.mjs",
  "scripts/test-studio-deck-card-count.mjs",
  "scripts/test-studio-deck-card-thumbnail.mjs",
  "scripts/test-studio-deck-cards-v2.mjs",
  "scripts/test-studio-deck-grid-4.mjs",
  "scripts/test-studio-deck-title.mjs",
  "scripts/test-studio-launch-wording.mjs",
  "scripts/test-studio-plain-nav-labels.mjs",
  "scripts/test-studio-pl61-dashboard-thumbnail.mjs",
  "scripts/studio-pl61-dashboard-thumbnail-strip.mjs",
  "scripts/studio-later-changes.mjs"
])

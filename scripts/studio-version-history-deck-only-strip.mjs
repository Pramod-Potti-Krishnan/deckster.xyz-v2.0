// FRONTEND-2: the profile menu's Version history row shows only while a deck is on stage (NEXT_PUBLIC_STUDIO_VERSION_HISTORY_DECK_ONLY, default off).
// The exact text this change adds to or swaps in the files it touches, so a pin that holds one of them to an earlier commit can first put the base text
// back (stripVersionHistoryDeckOnly(rel, text)), the way the other *-strip.mjs files do. scripts/test-studio-version-history-deck-only.mjs proves that
// stripping gives back BASE_COMMIT's file byte for byte. Every piece is a context-free [text this change has, text the base has] pair whose first
// text is a literal that occurs once in the file (a pure insertion has '' as its second), .env.example's block included.
// New files (no base text to put back): VERSION_HISTORY_DECK_ONLY_NEW_FILES below.

export const BASE_COMMIT = '380a5caaa8a088f7cda27c464aa961a57b6276e5'

const ENV_BLOCK = `# VERSION HISTORY, DECK ONLY (FRONTEND-2, the Builder's profile menu; design #456). On for the exact value "true"; default off, and then
# nothing changes. Build-time value: change it on Vercel and redeploy. It matters only with NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2 on. On: the
# menu's "Version history" row is there only while a deck is on stage. On a new session the welcome is on stage with a blank deck behind it, so
# the row showed on the empty Builder and, when chosen, did nothing; with this on it is gone until a deck is on stage (a generated or
# authored deck, or the blank canvas once it is chosen). A session that has a deck, and every other page, is unchanged. Off: the row shows
# as before.
NEXT_PUBLIC_STUDIO_VERSION_HISTORY_DECK_ONLY="false"

`

const PAGE_IMPORT = `// NEXT_PUBLIC_STUDIO_VERSION_HISTORY_DECK_ONLY (default off): the profile menu's Version history row shows only while a deck is on stage, not under the welcome (hooks/use-studio-version-history-deck-only.ts).
import { useStudioVersionHistoryDeckOnly } from '@/hooks/use-studio-version-history-deck-only'
`

const PAGE_CALL = `  // NEXT_PUBLIC_STUDIO_VERSION_HISTORY_DECK_ONLY (default off): while the welcome is on stage no deck is, so the profile menu's Version history row waits for one.
  useStudioVersionHistoryDeckOnly(studioWelcome)
`

const LIB_INTERFACE = `  /** NEXT_PUBLIC_STUDIO_VERSION_HISTORY_DECK_ONLY: the stage is showing the welcome, not a deck (the viewer can sit under it with a blank deck). While covered there is no deck on screen: isAvailable() is false and open() refuses. Only that flag's hook calls it. */
  setCovered(covered: boolean): void
`
const LIB_LET = `  let covered = false // NEXT_PUBLIC_STUDIO_VERSION_HISTORY_DECK_ONLY: the welcome is on stage
`
const LIB_OPEN = `      if (covered) return false
`
const LIB_SET_COVERED = `    setCovered(next) {
      if (covered === next) return
      covered = next
      notify()
    },
`
const LIB_AVAILABLE = '    isAvailable: () => opener !== null && !covered,\n'
const LIB_AVAILABLE_BASE = '    isAvailable: () => opener !== null,\n'

// [text this change has, text the base has]; each first text is a literal that occurs once in the file.
const CHANGES = {
  '.env.example': [[ENV_BLOCK, '']],
  'app/builder/page.tsx': [[PAGE_IMPORT, ''], [PAGE_CALL, '']],
  'lib/studio-version-history-v2.ts': [[LIB_INTERFACE, ''], [LIB_LET, ''], [LIB_OPEN, ''], [LIB_SET_COVERED, ''], [LIB_AVAILABLE, LIB_AVAILABLE_BASE]],
}

export const VERSION_HISTORY_DECK_ONLY_FILES = Object.keys(CHANGES)
export const VERSION_HISTORY_DECK_ONLY_NEW_FILES = ['hooks/use-studio-version-history-deck-only.ts',
  'scripts/studio-version-history-deck-only-strip.mjs', 'scripts/test-studio-version-history-deck-only.mjs']
export const VERSION_HISTORY_DECK_ONLY_CHANGES = CHANGES

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripVersionHistoryDeckOnly(rel, text) {
  const table = CHANGES[rel]
  if (!table) return text
  return table.reduce((out, [added, original]) => out.replace(added, () => original), text)
}

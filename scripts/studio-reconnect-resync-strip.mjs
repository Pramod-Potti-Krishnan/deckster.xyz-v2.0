// FRONTEND-2 P3-4 slice A: a resync after Director's socket reconnects (NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC, default off). The exact text
// this change adds to the files it touches, so a pin that holds one of them to an earlier commit can first put the base text back
// (stripReconnectResync(rel, text)), the way the other *-strip.mjs files do. scripts/test-studio-reconnect-resync.mjs proves that stripping
// gives back BASE_COMMIT's file byte for byte. New files (no base text to put back): this file and scripts/test-studio-reconnect-resync.mjs.

export const BASE_COMMIT = 'de4d8e3efdd15594a8be84422c0a9494842b6264'

const LIB_FLAG = `/** P3-4 (flag NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC, exact "true", default off; acts only with the notice flag on): after Director's
 * socket reconnects, the tab reads the slide inventory once and, when the deck differs from what it shows, reloads it (no unsaved
 * edits) or shows the notice (unsaved edits: the user decides). Off: resyncAfterReconnect is never called. */
export const STUDIO_RECONNECT_RESYNC_ENABLED = process.env.NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC === 'true'
/** At most one reconnect resync read per this gap (a reconnect loop, or two tabs fighting over one session, cannot hammer Layout). */
export const RECONNECT_RESYNC_MIN_GAP_MS = 10_000
`

const LIB_DEPS = `  /** P3-4 reconnect resync: the page's deck reload, run when a reconnect finds the deck changed and the viewer has no unsaved edits. */
  onResync?: () => void
  /** Minimum gap between two reconnect resync reads (RECONNECT_RESYNC_MIN_GAP_MS). */
  reconnectMinGapMs?: number
`

const LIB_API = `  /** P3-4: Director's socket reconnected. Read the inventory once; a changed deck is reloaded (onResync, no unsaved edits) or noticed. */
  resyncAfterReconnect(): Promise<'reloaded' | 'notice' | 'same' | 'skipped'>
`

const LIB_STATE = `  const reconnectMinGapMs = deps.reconnectMinGapMs ?? RECONNECT_RESYNC_MIN_GAP_MS
  let nextReconnectAt = 0
`

const LIB_METHOD = `    async resyncAfterReconnect() {
      if (disposed || checking) return 'skipped'
      // A hidden tab waits: its visibility check reads the inventory when the user comes back.
      if (deps.doc && deps.doc.visibilityState && deps.doc.visibilityState !== 'visible') return 'skipped'
      const t = now()
      if (t < nextReconnectAt || t < ownChangeQuietUntil) return 'skipped'
      nextReconnectAt = t + reconnectMinGapMs
      checking = true
      try {
        const read = await readOnce()
        if (!read || disposed) return 'skipped'
        if (now() < ownChangeQuietUntil) return 'skipped' // this tab changed the deck while the read was in flight
        const viewer = deps.getViewerState()
        const previous = knownSignature
        knownSignature = read.signature
        if (viewer.presentationId !== deps.presentationId) return 'skipped'
        if (!inventoryDiffers({ viewerSlideCount: viewer.slideCount, readCount: read.count, readSignature: read.signature, knownSignature: previous })) return 'same'
        if (notice) return 'notice' // a notice is already up: the user decides
        if (viewer.unsaved || !deps.onResync) { show('reconnect', null); return 'notice' }
        api.markReloaded()
        deps.onResync()
        return 'reloaded'
      } finally {
        checking = false
      }
    },
`

const HOOK_DOC = ` * P3-4 (NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC): \`connectionGeneration\` is Director's socket counter (+1 per successful open). A rise
 * for the same session and deck is a reconnect: one inventory read, then a reload when the deck changed and nothing is unsaved.
`

const HOOK_EFFECT = `  // P3-4: the first generation seen for a session + deck is its page-load connection, not a reconnect.
  const generationSeenRef = useRef<{ key: string; generation: number } | null>(null)
  useEffect(() => {
    if (!STUDIO_RECONNECT_RESYNC_ENABLED || !active || typeof connectionGeneration !== 'number') return
    const key = \`\${sessionId}|\${presentationId}\`
    const seen = generationSeenRef.current
    generationSeenRef.current = { key, generation: connectionGeneration }
    if (!seen || seen.key !== key || connectionGeneration <= seen.generation) return
    void controllerRef.current?.resyncAfterReconnect()
  }, [active, sessionId, presentationId, connectionGeneration])

`

const ENV_BLOCK = `# P3-4 RESYNC AFTER A RECONNECT (FRONTEND-2, Studio side of P3-4; the Builder only). On for the exact value "true"; default off, and then
# nothing changes. Build-time value: change it on Vercel and redeploy. Works only with NEXT_PUBLIC_STUDIO_DECK_CHANGED_NOTICE "true" (it reuses
# that notice's inventory read and its deck reload). On: when Director's socket reconnects for the same session and deck (not the first
# connection of a page load), the tab reads the deck's slide inventory once (at most once per 10 s; a hidden tab waits for its own visibility
# read) and, if the deck differs from what it shows, reloads the deck itself when the canvas has no unsaved edits, or else shows the calm
# strip "This deck changed while you were reconnecting · Reload deck" so the user decides. An unchanged deck does nothing. No frame, request
# body, endpoint or saved field changes.
NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC="false"

`

// [text this change has, text the base has]; each `added` is a literal that occurs once in the file.
const CHANGES = {
  '.env.example': [[ENV_BLOCK, '']],
  'app/builder/page.tsx': [
    ['    connectionGeneration, // P3-4 NEXT_PUBLIC_STUDIO_RECONNECT_RESYNC: a reconnect resyncs the shown deck (the hook ignores it with the flag off)\n', ''],
  ],
  'components/builder/studio-deck-changed-notice.tsx': [
    ["{notice.source === 'reconnect' ? 'This deck changed while you were reconnecting' : 'This deck changed in another tab'}", 'This deck changed in another tab'],
  ],
  'hooks/use-deck-changed-notice.ts': [
    ['  STUDIO_RECONNECT_RESYNC_ENABLED,\n  createDeckChangedController,', '  createDeckChangedController,'],
    [HOOK_DOC, ''],
    ['  onReload,\n  connectionGeneration,\n}: {', '  onReload,\n}: {'],
    ['  onReload: () => void\n  connectionGeneration?: number\n}', '  onReload: () => void\n}'],
    ['      ...(STUDIO_RECONNECT_RESYNC_ENABLED && { onResync: () => onReloadRef.current() }),\n', ''],
    [HOOK_EFFECT, ''],
  ],
  'lib/studio-deck-changed-notice.ts': [
    ["export type DeckChangedNoticeSource = 'broadcast' | 'visibility' | 'focus' | 'reconnect'", "export type DeckChangedNoticeSource = 'broadcast' | 'visibility' | 'focus'"],
    [LIB_FLAG, ''],
    [LIB_DEPS, ''],
    [LIB_API, ''],
    [LIB_STATE, ''],
    [LIB_METHOD, ''],
  ],
}

export const RECONNECT_RESYNC_FILES = Object.keys(CHANGES)

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripReconnectResync(rel, text) {
  const table = CHANGES[rel]
  if (!table) return text
  return table.reduce((out, [added, original]) => out.replace(added, () => original), text)
}

// COMPOSER-2 (FUTURE-OPS-2 section 3, row 4 "first paint", Studio half; flag NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED, default off): the exact text this change adds to the files it touches, so a pin
// that holds one of them to an earlier commit can first put the base text back (stripFirstPaint(rel, text)), the way scripts/studio-launch-wording-strip.mjs and the other *-strip.mjs files do.
// scripts/test-studio-first-paint-viewer.mjs proves that stripping gives back the base commit's file byte for byte, and that every changed or added viewer line carries the marker STUDIO-FIRST-PAINT.
// Every piece is context-free (its text occurs once and needs no neighbour). Each entry is [text this change has, text the base has]. Every viewer piece is an insertion: no base line is changed or removed (the poll's own
// `const interval = setInterval(async () => {` line stays as it is; the two marked lines above it give that effect a local setInterval, the global one itself with the flag off).
// New files (no base text to put back): FIRST_PAINT_NEW_FILES below.

export const FIRST_PAINT_MARKER = 'STUDIO-FIRST-PAINT'
/** The viewer, before this change (studio dev when it branched). */
export const FIRST_PAINT_BASE_COMMIT = 'f9218b4f466a18eff3b7a81bdab8a5cf28350e96'

/**
 * The .env.example block (appended after the PASS2 ADMIN block). It is registered in scripts/studio-later-changes.mjs (LATER_ENV_BLOCKS), which takes it out for the pins
 * that hold .env.example to an earlier commit, so stripFirstPaint itself leaves .env.example alone.
 */
export const FIRST_PAINT_ENV_BLOCK = `
# STUDIO FIRST PAINT (COMPOSER-2, FUTURE-OPS-2 section 3 row 4). On for the exact value "true"; default off, and then nothing changes: no connection is
# opened early and the viewer polls exactly as before. Build-time value: change it on Vercel and redeploy. On: (1) the viewer asks React 19 to open connections early (preconnect and dns-prefetch links, hoisted into <head>) to the Layout service
# (NEXT_PUBLIC_LAYOUT_SERVICE_URL) and to the four hosts Layout's viewer page loads from: cdn.jsdelivr.net, cdn.tailwindcss.com, fonts.googleapis.com and fonts.gstatic.com (the last one cross-origin, as fonts are); (2) the viewer's slide-info poll,
# which sends getCurrentSlideInfo (composeGetState while a compose job runs) to the Layout frame every 3 s and so waited 3 s after the frame loaded, also sends ONE at once when it starts for a frame that has just loaded. That first poll is a head start:
# when it gets no usable answer (the frame's scripts are not ready, a timeout, an error) it counts nothing against the polling backoff, and the interval ticks are the same as before; while it is in flight the interval ticks wait, so two polls never
# overlap. No new request type, no write, no change to a request body.
NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED="false"
`

const VIEWER_IMPORT = `import { warmStudioFirstPaintConnections, studioSlideInfoPollWiring, isUsableFirstPollAnswer } from '@/lib/studio-first-paint' // STUDIO-FIRST-PAINT
`

const VIEWER_WARM = `  warmStudioFirstPaintConnections(VIEWER_ORIGIN) // STUDIO-FIRST-PAINT (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED, default off): React hoists the preconnects for Layout and its CDNs into <head>; nothing with the flag off
`

// the poll's wiring: two lines just above the base's own `const interval = setInterval(async () => {` line, which stays as it is
const VIEWER_WIRING = `    const firstPaintPoll = studioSlideInfoPollWiring(iframeRef.current, approvedIframeNavigationUrl) // STUDIO-FIRST-PAINT (NEXT_PUBLIC_STUDIO_FIRST_PAINT_ENABLED, default off): the poll's timer and its head-start marker
    const setInterval = firstPaintPoll.setInterval // STUDIO-FIRST-PAINT: flag off = the global setInterval itself (the same function); on = one head-start tick now (one retry 500 ms later), then the interval ticks; a const of this effect only
`

// the tick's first statement (it reads the head-start marker before any await)
const VIEWER_FIRST_TICK = `      const firstTick = firstPaintPoll.firstTick() // STUDIO-FIRST-PAINT: true only in the head-start tick and its one retry; read before the first await
`

const VIEWER_DROP = `        if (firstTick && !isUsableFirstPollAnswer(result)) return false // STUDIO-FIRST-PAINT: a hollow answer from a viewer that has not drawn its slides yet is dropped (the interval ticks carry on); false = one retry
`

const VIEWER_CATCH = `        if (firstTick) { debugLog('⏸️ First poll got no usable answer; not counted'); return false } // STUDIO-FIRST-PAINT: the head-start tick never counts a failure or starts a backoff; false = one retry
`

const CHANGES = {
  'components/presentation-viewer.tsx': [
    [VIEWER_IMPORT, ''],
    [VIEWER_WARM, ''],
    [VIEWER_WIRING, ''],
    [VIEWER_FIRST_TICK, ''],
    [VIEWER_DROP, ''],
    [VIEWER_CATCH, ''],
  ],
}

export const FIRST_PAINT_FILES = Object.keys(CHANGES)
export const FIRST_PAINT_NEW_FILES = ['lib/studio-first-paint.ts', 'scripts/studio-first-paint-strip.mjs', 'scripts/test-studio-first-paint.mjs', 'scripts/test-studio-first-paint-viewer.mjs']
/** The earlier tests this change teaches about its strip (tests only): the viewer pins that hold a file to an earlier commit through a strip chain. */
export const FIRST_PAINT_PIN_FILES = ['scripts/test-studio-deck-mutation-dedupe.mjs', 'scripts/test-studio-rail-add-slide.mjs', 'scripts/test-studio-chat-element-refine.mjs', 'scripts/test-studio-chat-theme-export.mjs',
  'scripts/test-studio-version-history-v2.mjs', 'scripts/studio-library-manage-harness.mjs']
export const FIRST_PAINT_CHANGES = CHANGES
/**
 * Every file this change's commit touches: the pins that read a COMMITTED diff for their own scope (test-studio-payments-open-soon.mjs) leave these out, the way they leave out any other
 * stacked change's files. (Scope pins that list their own allowed files cannot know a change that came after them.)
 */
export const FIRST_PAINT_SCOPE_FILES = new Set([...FIRST_PAINT_FILES, ...FIRST_PAINT_NEW_FILES, ...FIRST_PAINT_PIN_FILES, 'package.json', 'lib/studio-first-paint.ts'])

/** True for a diff line of this change: every one of its lines carries the marker (it removes no base line), so the diff-reading pins skip exactly those. */
export function belongsToFirstPaint(line) {
  return line.includes(FIRST_PAINT_MARKER)
}

/** The file without this change's lines. Any other file (or a file that no longer carries them) is returned as it is. */
export function stripFirstPaint(rel, text) {
  const table = CHANGES[rel]
  if (!table) return text
  return table.reduce((out, [added, original]) => out.replace(added, () => original), text)
}

// FRONTEND-2 (SPEED + ROUTER ACCELERATION, 25 Oct; streams/frontend/pass3/speed/STUDIO-WAITS.md rows 1-2). Flag NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED (exact "true", default off, build-time): the user's typed message
// shows at once as a quiet "Sending…" echo until the page commits the real bubble (lib/studio-speed-perceived.ts, hooks/use-studio-speed-perceived-echo.ts, components/builder/studio-speed-echo.tsx and its stylesheet).
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker SPEED-PERCEIVED (matched as a whole token): five in app/builder/page.tsx (two imports, the hook call after
// handleSendMessage, the echo drawn right after <MessageList />, one spread on <ChatInput>) and the chat harness's opt-in wiring (scripts/studio-chat-harness/page-sources.mjs, transcript.mjs: they run the
// page's own hook call only when this run's flag is "true"). MessageList is NOT changed. Strip those lines and each file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). The chat harness parses the page through the registry, so its
// page-region anchors (scripts/fixtures/director-chat/baselines/_sources.json) stay the base's; this change's proof takes the strip out in its own process to run the page with its lines. Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'fe1bf8147ed70d476f4cddbcdefd1e1cdbf8db37' // PR 2's head (frontend2/phone-shell-builder-top, the top of the phone shell stack, itself stacked on Pass 3 polish G and D1 on the studio head fc97f2d5), the branch this change is stacked on (it was cut at 15e2d90f, #512)
export const SPEED_PERCEIVED_FLAG = 'NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED'
export const SPEED_PERCEIVED_MARKER = 'SPEED-PERCEIVED'
/** The marker as a WHOLE token: SPEED-PERCEIVED-X or X-SPEED-PERCEIVED are not this change's. */
export const SPEED_PERCEIVED_MARKER_RE = /(?<![\w-])SPEED-PERCEIVED(?![\w-])/

/** Existing files that get marked lines (pure insertions only). */
export const SPEED_PERCEIVED_FILES = [
  'app/builder/page.tsx',
  'scripts/studio-chat-harness/page-sources.mjs',
  'scripts/studio-chat-harness/transcript.mjs',
]

/** New files (no base text to put back). */
export const SPEED_PERCEIVED_NEW_FILES = [
  'lib/studio-speed-perceived.ts',
  'hooks/use-studio-speed-perceived-echo.ts',
  'components/builder/studio-speed-echo.tsx',
  'components/builder/studio-speed-perceived.css',
  'scripts/studio-speed-perceived-strip.mjs',
  'scripts/test-studio-speed-perceived.mjs',
]

/** Files this change edits that are neither app code with marked lines nor new: its .env.example block and the registry (three lines). STACK: the two FRONTEND-2 proofs it used to edit (the polish F proof's
 *  assertion, the legal short links proof's GOOD_PROOF_DIFFS line) are no longer edited by it: phone shell 1 (below it in the stack) teaches both the same way (the registry read, the diff against the legal change's
 *  own newest commit), and the more general form stays. */
export const SPEED_PERCEIVED_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const SPEED_PERCEIVED_SCOPE_FILES = new Set([...SPEED_PERCEIVED_FILES, ...SPEED_PERCEIVED_NEW_FILES, ...SPEED_PERCEIVED_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const SPEED_PERCEIVED_ENV_BLOCK = `# STUDIO SPEED PERCEIVED (FRONTEND-2; SPEED + ROUTER ACCELERATION, 25 Oct). On for the exact value "true"; default off, and then the chat and the composer get exactly the props they get today. Build-time value: change it on Vercel and redeploy.
# On: a message typed in the composer shows in the chat at once as a quiet "Sending…" echo while the first save of a new deck (the session row, and the blank-canvas check with Layout when there is one: 0.5-1.6 s today)
# and a reconnect in flight finish; a socket already closed before Enter is refused in both builds (the existing "Reconnecting" toast keeps the draft). The page still sends, commits and persists exactly as before: the echo leaves
# in the render where the real bubble appears. A send that settles within 80 ms never shows one. When a send fails (the existing toast says why and keeps the draft), the echo reads "Not sent. Your message is still in the box."
# until the draft changes or 6 s pass. No Director change.
NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripSpeedPerceived(rel, text) {
  if (!SPEED_PERCEIVED_FILES.includes(rel) || typeof text !== 'string') return text
  return text.split('\n').filter(line => !SPEED_PERCEIVED_MARKER_RE.test(line)).join('\n')
}

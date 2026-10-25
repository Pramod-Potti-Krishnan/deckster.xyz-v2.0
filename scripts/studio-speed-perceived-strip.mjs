// FRONTEND-2 (SPEED + ROUTER ACCELERATION, 25 Oct; streams/frontend/pass3/speed/STUDIO-WAITS.md rows 1-2). Flag NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED (exact "true", default off, build-time): the user's typed message
// shows at once as a quiet "Sending…" echo until the page commits the real bubble (lib/studio-speed-perceived.ts, hooks/use-studio-speed-perceived-echo.ts, components/builder/studio-speed-echo.tsx and its stylesheet).
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker SPEED-PERCEIVED (matched as a whole token): five in app/builder/page.tsx (two imports, the hook call after
// handleSendMessage, the echo drawn right after <MessageList />, one spread on <ChatInput>) and the chat harness's opt-in wiring (scripts/studio-chat-harness/page-sources.mjs, transcript.mjs: they run the
// page's own hook call only when this run's flag is "true"). MessageList is NOT changed. Strip those lines and each file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). The chat harness parses the page through the registry, so its
// page-region anchors (scripts/fixtures/director-chat/baselines/_sources.json) stay the base's; this change's proof takes the strip out in its own process to run the page with its lines. Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '15e2d90f1f9e6a876c2147ec002c076408e419cc' // studio-v4-dev-preparation-code at #512 (legal short links), the branch this change is cut from
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

/** Files this change edits that are neither app code with marked lines nor new: its .env.example block, the registry (three lines) and those two proofs (one line each). */
/** The one older proof this change edits, FRONTEND-2's own (not FRONTEND-1's): it held app/builder/page.tsx to its base byte for byte, so any later change to the page broke it. One assertion: it now takes the
 *  registered later changes' marked lines out first (its own strip excepted), as the legal-short-links change taught its scope check. */
export const SPEED_PERCEIVED_POLISH_F_PROOF = 'scripts/test-studio-pass3-polish-f.mjs'
/** And the proof that taught it first (legal short links): its control built "the committed diff" of those proofs from the WORKING TREE, so a later change's edit of the polish F proof read as its own. One line:
 *  it now diffs the base against its own newest commit (the working tree only before that commit exists). */
export const SPEED_PERCEIVED_LEGAL_PROOF = 'scripts/test-studio-legal-short-links.mjs'
export const SPEED_PERCEIVED_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', SPEED_PERCEIVED_POLISH_F_PROOF, SPEED_PERCEIVED_LEGAL_PROOF]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const SPEED_PERCEIVED_SCOPE_FILES = new Set([...SPEED_PERCEIVED_FILES, ...SPEED_PERCEIVED_NEW_FILES, ...SPEED_PERCEIVED_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const SPEED_PERCEIVED_ENV_BLOCK = `# STUDIO SPEED PERCEIVED (FRONTEND-2; SPEED + ROUTER ACCELERATION, 25 Oct). On for the exact value "true"; default off, and then the chat and the composer get exactly the props they get today. Build-time value: change it on Vercel and redeploy.
# On: a message typed in the composer shows in the chat at once as a quiet "Sending…" echo, instead of only after Studio has created the session row, checked a blank canvas with Layout and put the bytes on the socket (the first
# message of a new deck waits 0.5-1.6 s for that today; a send on a reconnecting socket up to 12 s). The page still sends, commits and persists exactly as before: the echo leaves in the render where the real bubble appears. A send
# that settles within 80 ms never shows one. When a send fails (the existing toast says why and keeps the draft), the echo reads "Not sent. Your message is still in the box." until the draft changes or 6 s pass. No Director change.
NEXT_PUBLIC_STUDIO_SPEED_PERCEIVED="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripSpeedPerceived(rel, text) {
  if (!SPEED_PERCEIVED_FILES.includes(rel) || typeof text !== 'string') return text
  return text.split('\n').filter(line => !SPEED_PERCEIVED_MARKER_RE.test(line)).join('\n')
}

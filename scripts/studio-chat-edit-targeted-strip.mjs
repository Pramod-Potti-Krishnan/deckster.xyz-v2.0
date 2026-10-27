// FRONTEND-2 (B33, 27 Oct; PK 18:19Z: chat element edits touch only the target element and never trigger Edit Mode's whole-deck autosave). Flag NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE (exact "true", default off,
// build-time; it acts only with NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT on): #522's chat element edit saves through Layout's targeted save (layout-builder frontend2/layout-targeted-save, LAYOUT_CHAT_TARGETED_SAVE_ENABLED) instead of
// the viewer's whole-deck Save. Stacked on #538 (frontend2/chat-element-edit-2 @ 7a67ff6d).
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-EDIT-TARGETED (a whole token): lib/chat-element-edit.ts (one import, the targeted branch of step 6) and #522's Layout harness
// scripts/studio-chat-element-edit-layout.mjs (the `targeted` page and script). Strip those lines and each file is its base, byte for byte. The new file lib/chat-edit-targeted.ts holds the flag and the targeted steps.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '7a67ff6d9062cd8272a3ca7bc7e1977760465c48' // #538's head (frontend2/chat-element-edit-2), which this change is stacked on
export const CHAT_EDIT_TARGETED_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE'
export const CHAT_EDIT_TARGETED_MARKER = 'CHAT-EDIT-TARGETED'
/** The marker as a WHOLE token. */
export const CHAT_EDIT_TARGETED_MARKER_RE = /(?<![\w-])CHAT-EDIT-TARGETED(?![\w-])/
/** The subject prefix of this change's own commits (not "Chat element edit": #522's and #538's scope checks grep for that). */
export const CHAT_EDIT_TARGETED_SUBJECT = 'Targeted chat edit:'

/** Existing files that get marked lines (pure insertions only). */
export const CHAT_EDIT_TARGETED_FILES = [
  'lib/chat-element-edit.ts',
  'scripts/studio-chat-element-edit-layout.mjs',
]

/** New files (no base text to put back). */
export const CHAT_EDIT_TARGETED_NEW_FILES = [
  'lib/chat-edit-targeted.ts',
  'scripts/studio-chat-edit-targeted-strip.mjs',
  'scripts/test-studio-chat-edit-targeted.mjs',
  'scripts/fixtures/chat-edit-targeted/layout-transcripts.json',
]

export const CHAT_EDIT_TARGETED_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs']

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_EDIT_TARGETED_SCOPE_FILES = new Set([...CHAT_EDIT_TARGETED_FILES, ...CHAT_EDIT_TARGETED_NEW_FILES, ...CHAT_EDIT_TARGETED_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const CHAT_EDIT_TARGETED_ENV_BLOCK = `# STUDIO TARGETED CHAT EDIT (FRONTEND-2, B33; PK 27 Oct 18:19Z: chat element edits touch only the target element and never trigger Edit Mode's whole-deck autosave). On for the exact value "true"; default off, and then chat element edit
# (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT) saves exactly as today. It acts only with NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT on. Build-time value: change it on Vercel and redeploy.
# On, a chat element edit (move, resize, delete, z-order, style) is saved through Layout's targeted save: Layout stores that one element and nothing else (no "Auto-save from editor" whole-deck save, so no other slide's layout text
# becomes text boxes). NEEDS Layout's LAYOUT_CHAT_TARGETED_SAVE_ENABLED on: without it every chat element edit is refused (UNSUPPORTED_OP) before anything changes. Turn Layout's flag on first. A manual Edit Mode change is not touched.
NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripChatEditTargeted(rel, text) {
  if (typeof text !== 'string') return text
  if (!CHAT_EDIT_TARGETED_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_EDIT_TARGETED_MARKER_RE.test(line)).join('\n')
}

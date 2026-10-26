// FRONTEND-2 (P3-1 A, chat parity, 26 Oct; the Studio side of DIRECTOR-2's DIRECTOR_MDC_ELEMENT_EDIT_ENABLED). Flag NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT (exact "true", default off, build-time): Director's element_edit
// {op: delete | order | place | style} runs through the presentation viewer's own element commands and is answered once, ok:true only after the autosave acknowledged it; deck_mutation notes_updated refreshes the Notes panel
// (lib/chat-element-edit-wire.ts, lib/chat-element-edit-save.ts, lib/chat-element-edit.ts).
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-ELEMENT-EDIT (matched as a whole token): app/builder/page.tsx (imports, refs, the hook options, the runner after the theme / export
// runner, OUTSIDE the region scripts/test-studio-chat-theme-export.mjs checks beside the K5 add runner), hooks/use-deckster-websocket-v2.ts (an import, two option types, two routes, the caps line, the result sender), components/presentation-viewer.tsx
// (two imports, the save-ack publish, the edit-mode registration) and components/slide-notes-panel.tsx (an import and the notes_updated listener). Strip those lines and each file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '875334faa648ed72e63b260457ca2fc0a2020c0c' // origin/studio-v4-dev-preparation-code at #518 (frontend2/speed-perceived), the branch this change starts from
export const CHAT_ELEMENT_EDIT_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT'
export const CHAT_ELEMENT_EDIT_MARKER = 'CHAT-ELEMENT-EDIT'
/** The marker as a WHOLE token: CHAT-ELEMENT-EDIT-X or X-CHAT-ELEMENT-EDIT are not this change's. */
export const CHAT_ELEMENT_EDIT_MARKER_RE = /(?<![\w-])CHAT-ELEMENT-EDIT(?![\w-])/

/** Existing files that get marked lines (pure insertions only). */
export const CHAT_ELEMENT_EDIT_FILES = [
  'app/builder/page.tsx',
  'hooks/use-deckster-websocket-v2.ts',
  'components/presentation-viewer.tsx',
  'components/slide-notes-panel.tsx',
]

/** New files (no base text to put back). */
export const CHAT_ELEMENT_EDIT_NEW_FILES = [
  'lib/chat-element-edit-wire.ts',
  'lib/chat-element-edit-save.ts',
  'lib/chat-element-edit.ts',
  'scripts/studio-chat-element-edit-strip.mjs',
  'scripts/studio-chat-element-edit-layout.mjs',
  'scripts/test-studio-chat-element-edit.mjs',
  'scripts/fixtures/chat-element-edit/director-frames/contract-envelope.json',
  'scripts/fixtures/chat-element-edit/layout-transcripts.json',
]

/** The older files this change teaches (FRONTEND-2's own; never FRONTEND-1's or COMPOSER-2's): [text the file has now, text it had before] per edit, whole lines, so putting them back gives dev's file byte for byte. Every line the file has now carries
 *  CHAT_ELEMENT_EDIT_PIN_MARK. Idempotent: a line that is not there is not put back.
 *  - scripts/test-studio-chat-theme-export.mjs measured what sits between the K5 add runner and its own runner by offsets from the page's AST (parsed through the registry, so with every registered later change's marked lines taken out) in the
 *    page's text (read without the registry): a later change's marked lines before the add runner moved that window. It now reads the text the AST was parsed from.
 *  - scripts/studio-pass3-polish-b-strip.mjs is what COMPOSER-2's first-paint pin reads the viewer through: its strip takes the marked lines of the changes registered after it out first (Arrange's, #523), so it takes this change's out too,
 *    the way #523 did. COMPOSER-2's test is not edited. */
export const CHAT_ELEMENT_EDIT_PIN_MARK = '// LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT)'
export const CHAT_ELEMENT_EDIT_PIN_EDITS = {
  'scripts/test-studio-chat-theme-export.mjs': [
    ["import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT)\n", ''],
    ["const pageText = stripLaterChanges(PAGE, read(PAGE)) // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT): the page text is the text pageAst was parsed from (extract.parseSource reads through the registry), so the offsets between the two agree\n", 'const pageText = read(PAGE)\n'],
  ],
  'scripts/studio-pass3-polish-b-strip.mjs': [
    ["import { stripChatElementEdit } from './studio-chat-element-edit-strip.mjs' // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT): #522 adds marked lines to the viewer, so they come out first, as #523's do, and the viewer read through this strip is its base again\n", ''],
    ["  if (rel === PASS3_POLISH_B_VIEWER) text = stripChatElementEdit(rel, text) // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT)\n", ''],
  ],
}

/** The file without this change's edits (the previous file). */
export function putBackPin(rel, text) {
  return (CHAT_ELEMENT_EDIT_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const CHAT_ELEMENT_EDIT_PIN_FILES = Object.keys(CHAT_ELEMENT_EDIT_PIN_EDITS)

/** The other files this change edits: its .env.example block, the registry (three lines) and the older proofs it teaches. */
export const CHAT_ELEMENT_EDIT_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_ELEMENT_EDIT_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_ELEMENT_EDIT_SCOPE_FILES = new Set([...CHAT_ELEMENT_EDIT_FILES, ...CHAT_ELEMENT_EDIT_NEW_FILES, ...CHAT_ELEMENT_EDIT_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const CHAT_ELEMENT_EDIT_ENV_BLOCK = `# STUDIO CHAT ELEMENT EDIT (FRONTEND-2, P3-1 A chat parity; the Studio side of DIRECTOR-2's DIRECTOR_MDC_ELEMENT_EDIT_ENABLED, contract: streams/director2/element-edit/CONTRACT.md). On for the exact value "true"; default off, and then nothing changes: no cap is sent,
# no frame is looked at, and the Notes panel listens for nothing. Build-time value: change it on Vercel and redeploy. On: every send also carries client_caps "element_edit1" and "notes1" (after mdc1 and the other caps). Director's element_edit
# {payload:{op: delete | order | place | style, ...}} runs through the presentation viewer's own element commands (deleteElement, bringTextBoxToFront / sendTextBoxToBack, resizeTextBox, setTextBoxFontWeight / FontSize / Color / Alignment, and Layout's Arrange commands
# bringToFront / sendToBack / bringForward / sendBackward / alignElement, always with intent "arrange"; those pair with Layout's LAYOUT_ARRANGE_COMMANDS_ENABLED, !260 / !261, and without it the viewer answers "Unknown action" = UNSUPPORTED_OP), never a server PATCH, and is
# answered ONCE with element_edit_result {payload:{directive_id, ok, error_code}}: ok:true only after the viewer's autosave acknowledged the change (Studio enters edit mode the way selecting an element does and flushes with the viewer's own Save). What the viewer cannot do
# (italic, style on anything but a text box, an element type Arrange refuses) is UNSUPPORTED_OP, never faked. A stale socket or owner sends nothing; a second edit while one runs is BUSY. deck_mutation payload.mutation "notes_updated" makes the Notes panel read the deck
# again, so Director's notes show; every other deck_mutation is untouched. No Director change: Director needs its own flag on.
NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripChatElementEdit(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_ELEMENT_EDIT_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text, so a proof that holds it byte for byte reads it as it was
  if (!CHAT_ELEMENT_EDIT_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_ELEMENT_EDIT_MARKER_RE.test(line)).join('\n')
}

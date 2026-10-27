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
  'lib/studio-bulk-edit-wire.ts',
]

/** New files (no base text to put back). */
export const CHAT_ELEMENT_EDIT_NEW_FILES = [
  'lib/chat-element-edit-wire.ts',
  'lib/chat-element-edit-save.ts',
  'lib/chat-element-edit.ts',
  'scripts/studio-chat-element-edit-strip.mjs',
  'scripts/studio-chat-element-edit-layout.mjs',
  'scripts/test-studio-chat-element-edit.mjs',
  'scripts/fixtures/chat-element-edit/layout-transcripts.json',
  // DIRECTOR-2's recorded frames (!566, workspace main 5319954f streams/director2/element-edit/examples/), copied byte for byte, sha256-pinned in SHA256SUMS and in the proof
  'scripts/fixtures/chat-element-edit/director-frames/01-delete-ok.json',
  'scripts/fixtures/chat-element-edit/director-frames/02-order-front-ok.json',
  'scripts/fixtures/chat-element-edit/director-frames/03-place-ok.json',
  'scripts/fixtures/chat-element-edit/director-frames/04-style-ok.json',
  'scripts/fixtures/chat-element-edit/director-frames/10-ELEMENT_NOT_FOUND.json',
  'scripts/fixtures/chat-element-edit/director-frames/11-SLIDE_CHANGED.json',
  'scripts/fixtures/chat-element-edit/director-frames/12-UNSUPPORTED_OP.json',
  'scripts/fixtures/chat-element-edit/director-frames/13-INVALID_VALUE.json',
  'scripts/fixtures/chat-element-edit/director-frames/14-ELEMENT_LOCKED.json',
  'scripts/fixtures/chat-element-edit/director-frames/15-VIEWER_NOT_READY.json',
  'scripts/fixtures/chat-element-edit/director-frames/16-BUSY.json',
  'scripts/fixtures/chat-element-edit/director-frames/17-SAVE_FAILED.json',
  'scripts/fixtures/chat-element-edit/director-frames/18-TIMEOUT.json',
  'scripts/fixtures/chat-element-edit/director-frames/20-no-cap.json',
  'scripts/fixtures/chat-element-edit/director-frames/21-which-element.json',
  'scripts/fixtures/chat-element-edit/director-frames/22-unknown-colour.json',
  'scripts/fixtures/chat-element-edit/director-frames/30-notes-ok.json',
  'scripts/fixtures/chat-element-edit/director-frames/31-notes-no-cap.json',
  'scripts/fixtures/chat-element-edit/director-frames/SHA256SUMS',
]

/** The older files this change teaches (FRONTEND-2's own; never FRONTEND-1's or COMPOSER-2's): [text the file has now, text it had before] per edit, whole lines, so putting them back gives dev's file byte for byte. Every line the file has now carries
 *  CHAT_ELEMENT_EDIT_PIN_MARK. Idempotent: a line that is not there is not put back.
 *  - scripts/test-studio-chat-theme-export.mjs measured what sits between the K5 add runner and its own runner by offsets from the page's AST (parsed through the registry, so with every registered later change's marked lines taken out) in the
 *    page's text (read without the registry): a later change's marked lines before the add runner moved that window. It now reads the text the AST was parsed from.
 *  - scripts/studio-pass3-polish-b-strip.mjs is what COMPOSER-2's first-paint pin reads the viewer through: its strip takes the marked lines of the changes registered after it out first (Arrange's, #523), so it takes this change's out too,
 *    the way #523 did. COMPOSER-2's test is not edited.
 *  - scripts/test-studio-rail-add-slide.mjs counts what the viewer gains (its `changed` filter lists the marked lines of the changes it knows); scripts/test-studio-arrange.mjs compares the viewer and the Builder page with its base byte for byte (its `read`):
 *    both skip this change's marked lines now, as #523 taught the first. FRONTEND-2's own proofs. The rail line is one #523 edited too: its put-back goes to the line before BOTH edits
 *    (registered strips run in registry order, #523's first, so a put-back to #523's line would leave #523's own put-back nothing to do); #523's put-back of that file is then a no-op.
 *  - scripts/test-studio-chat-undo-v2.mjs: a file a later change registered and retired (the envelope fixture this change replaced), deleted in a commit that also touches the wire the undo proofs own, is not an undo deletion (its additions already were not strays).
 *  - scripts/test-studio-bulk-edit-prompt-text.mjs compares the wire with its own base byte for byte: it reads the wire past this change's marked lines (the change_recorded kinds), as the registry-reading pins do.
 * (scripts/test-studio-model-choice.mjs is no longer taught: #530's .env.example check there accepts any later block.) All FRONTEND-2's own proofs; each edit is marked and put back here. */
export const CHAT_ELEMENT_EDIT_PIN_MARK = '// LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT)'
export const CHAT_ELEMENT_EDIT_PIN_EDITS = {
  'scripts/test-studio-chat-theme-export.mjs': [
    ["import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT), stacked after #475\n", ''],
    ["  const pageText = stripLaterChanges(PAGE, read(PAGE)) // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT), stacked after #475: the page text here is the text pageAst was parsed from (extract.parseSource reads through the registry), so the offsets between the two agree\n", ''],
  ],
  // #522's caps line sits in the hook's buildUserMessage, which this proof runs in a sandbox of its own: the flag is named there, off
  'scripts/test-theme-font-selection.mjs': [
    ["  context.CHAT_ELEMENT_EDIT_ENABLED = false // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT), stacked after #475: NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT's one flag-gated caps line in buildUserMessage (#522), off here like the other flags\n", ''],
  ],
  'scripts/test-studio-rail-add-slide.mjs': [
    ["    const changed = (rel, base) => git(['diff', '--no-color', '-U0', BASE_COMMIT, '--', rel]).split('\\n').filter(line => /^[+-](?![+-])/.test(line) && !line.includes('PASS2D B4') && !line.includes('SLIDE-OPS-VIA-VIEWER') && !line.includes('INSERT-PERSIST') && !line.includes('STUDIO_LAUNCH_WORDING') && !line.includes('VERSION-HISTORY-V2') && !line.includes('NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD') && !belongsToRailBuildCount(line) && !/(?<![\\w-])STUDIO-ARRANGE(?![\\w-])/.test(line) && !/(?<![\\w-])CHAT-ELEMENT-EDIT(?![\\w-])/.test(line)) // LATER-CHANGES: registry read (STUDIO-ARRANGE): its marked viewer lines; scripts/test-studio-arrange.mjs pins them. LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT): and #522's, which scripts/test-studio-chat-element-edit.mjs pins\n", "    const changed = (rel, base) => git(['diff', '--no-color', '-U0', BASE_COMMIT, '--', rel]).split('\\n').filter(line => /^[+-](?![+-])/.test(line) && !line.includes('PASS2D B4') && !line.includes('SLIDE-OPS-VIA-VIEWER') && !line.includes('INSERT-PERSIST') && !line.includes('STUDIO_LAUNCH_WORDING') && !line.includes('VERSION-HISTORY-V2') && !line.includes('NEXT_PUBLIC_STUDIO_THUMBNAIL_LAST_GOOD') && !belongsToRailBuildCount(line))\n"],
  ],
  'scripts/test-studio-arrange.mjs': [
    ["const { stripChatElementEdit } = await import('./studio-chat-element-edit-strip.mjs') // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT): #522 marks lines in the viewer and the Builder page too; every file is read past them, so what is left is this change's and the base's\n", ""],
    ["const read = rel => stripChatElementEdit(rel, fs.readFileSync(path.join(root, rel), 'utf8')) // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT)\n", "const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')\n"],
  ],
  'scripts/test-studio-chat-undo-v2.mjs': [
    ["const ownDeleted = own => { const deleted = history ? null : firstParentDeleted(); return ownCommits(own).flatMap(commit => (deleted ? deleted.get(commit.id) : commit.deleted) ?? []).filter(rel => own.has(rel) || !LATER_CHANGE_FILES.has(rel)) } // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT): a file a LATER change registered and then retired (the fixture it replaced, deleted in a commit that also touches one of this change's files) is that change's deletion, as its additions already are (scopeStray)\n", "const ownDeleted = own => { const deleted = history ? null : firstParentDeleted(); return ownCommits(own).flatMap(commit => (deleted ? deleted.get(commit.id) : commit.deleted) ?? []) }\n"],
    ["    try { history = [{ id: 'l', files: [aFile], deleted: [laterFile] }]; assert.deepEqual(ownDeleted(own), [], 'a REGISTERED later change\\'s file retired in a commit that also touches this change\\'s file is not this change\\'s deletion'); history = [{ id: 'm', files: [aFile], deleted: [unregistered] }]; assert.deepEqual(ownDeleted(own), [unregistered], 'an unregistered file deleted in this change\\'s commit is') } finally { history = before } // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT)\n", ''],
  ],
  'scripts/test-studio-bulk-edit-prompt-text.mjs': [
    ["import { stripChatElementEdit } from './studio-chat-element-edit-strip.mjs' // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT): #522 marks lines in the wire; the pin below reads the file past them\n", ''],
    ["const read = rel => (rel in overrides ? overrides[rel] : stripChatElementEdit(rel, fs.readFileSync(path.join(root, rel), 'utf8'))) // LATER-CHANGES: registry read (CHAT-ELEMENT-EDIT): the wire carries #522's marked lines too (change_recorded kinds); this proof compares it with its own base, so it reads it past them\n", "const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))\n"],
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

/** Files an earlier commit of this branch touched that the tree no longer has (renamed when CONTRACT.md landed): the committed-diff scope checks of older proofs list every file the branch's commits touched. */
export const CHAT_ELEMENT_EDIT_RETIRED_FILES = [
  'scripts/fixtures/chat-element-edit/director-frames/agreed-envelope.json', // the 26 Oct envelope
  'scripts/fixtures/chat-element-edit/director-frames/contract-envelope.json', // built from CONTRACT.md before the recordings landed
]

/** The other files this change edits: its .env.example block, the registry (three lines) and the older proofs it teaches. */
export const CHAT_ELEMENT_EDIT_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_ELEMENT_EDIT_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_ELEMENT_EDIT_SCOPE_FILES = new Set([...CHAT_ELEMENT_EDIT_FILES, ...CHAT_ELEMENT_EDIT_NEW_FILES, ...CHAT_ELEMENT_EDIT_OWN_EDITS, ...CHAT_ELEMENT_EDIT_RETIRED_FILES])

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

// FRONTEND-2 (B33, 27 Oct; PK 18:19Z: chat element edits touch only the target element and never trigger Edit Mode's whole-deck autosave). Flag NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE (exact "true", default off,
// build-time; it acts only with NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT on): #522's chat element edit saves through Layout's targeted save (layout-builder frontend2/layout-targeted-save, LAYOUT_CHAT_TARGETED_SAVE_ENABLED) instead of
// the viewer's whole-deck Save. Stacked on #538 (frontend2/chat-element-edit-2 @ 7a67ff6d), now merged into dev (ffaf5a7e).
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-EDIT-TARGETED (a whole token): lib/chat-element-edit.ts (one import, the targeted branch of step 6) and #522's Layout harness
// scripts/studio-chat-element-edit-layout.mjs (the `targeted` page and script). Strip those lines and each file is its base, byte for byte. The new file lib/chat-edit-targeted.ts holds the flag and the targeted steps.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'ffaf5a7eb883b35bf8ff4806a4a3b1b9c13cefe5' // studio-v4-dev-preparation-code with #538 (chat element edit 2, head 7a67ff6d) merged: dev, which this change is merged with (it was stacked on #538's head)
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
  'scripts/studio-chat-edit-targeted-reload.mjs',
  'scripts/fixtures/chat-edit-targeted/layout-transcripts.json',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries CHAT_EDIT_TARGETED_PIN_MARK. */
export const CHAT_EDIT_TARGETED_PIN_MARK = '// LATER-CHANGES: registry read (CHAT-EDIT-TARGETED)'
export const CHAT_EDIT_TARGETED_PIN_EDITS = {
  "scripts/test-studio-chat-element-edit-2.mjs": [
    ["const targetedStrip = await import('./studio-chat-edit-targeted-strip.mjs') // LATER-CHANGES: registry read (CHAT-EDIT-TARGETED): the targeted chat edit stacked after this change\nconst read = rel => targetedStrip.stripChatEditTargeted(rel, fs.readFileSync(path.join(repo, rel), 'utf8')) // LATER-CHANGES: registry read (CHAT-EDIT-TARGETED): its marked lines come out before this change's pins\n",
     "const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8')\n"],
    ["const own = git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..HEAD`).split('\\n').filter(Boolean).filter(c => !git('log', '-1', '--format=%s', c).startsWith(targetedStrip.CHAT_EDIT_TARGETED_SUBJECT)) // LATER-CHANGES: registry read (CHAT-EDIT-TARGETED): the stacked change's commits are its own\n",
     "const own = git('rev-list', '--first-parent', '--no-merges', `${BASE_COMMIT}..HEAD`).split('\\n').filter(Boolean)\n"],
    ["    const diff = git('diff', '-U0', BASE_COMMIT, 'HEAD', '--', rel).split('\\n').filter(line => /^[+-]/.test(line) && !/^(\\+\\+\\+|---) /.test(line)).filter(line => !targetedStrip.CHAT_EDIT_TARGETED_MARKER_RE.test(line)) // LATER-CHANGES: registry read (CHAT-EDIT-TARGETED)\n",
     "    const diff = git('diff', '-U0', BASE_COMMIT, 'HEAD', '--', rel).split('\\n').filter(line => /^[+-]/.test(line) && !/^(\\+\\+\\+|---) /.test(line))\n"],
    ["    assert.equal(stripChatElementEdit2(rel, targetedStrip.stripChatEditTargeted(rel, git('show', `HEAD:${rel}`))), baseFile(rel), `${rel}: without its marked lines the file is the base's, byte for byte`) // LATER-CHANGES: registry read (CHAT-EDIT-TARGETED)\n",
     "    assert.equal(stripChatElementEdit2(rel, git('show', `HEAD:${rel}`)), baseFile(rel), `${rel}: without its marked lines the file is the base's, byte for byte`)\n"],
    ["  const diff = git('diff', '-U0', BASE_COMMIT, 'HEAD', '--', 'scripts/studio-later-changes.mjs').split('\\n').filter(line => /^[+-]/.test(line) && !/^(\\+\\+\\+|---) /.test(line)).filter(line => !line.includes('studio-chat-edit-targeted-strip.mjs')) // LATER-CHANGES: registry read (CHAT-EDIT-TARGETED)\n",
     "  const diff = git('diff', '-U0', BASE_COMMIT, 'HEAD', '--', 'scripts/studio-later-changes.mjs').split('\\n').filter(line => /^[+-]/.test(line) && !/^(\\+\\+\\+|---) /.test(line))\n"],
  ],
}

/** The proof without this change's edits (the previous file). */
export function putBackPin(rel, text) {
  return (CHAT_EDIT_TARGETED_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

export const CHAT_EDIT_TARGETED_PIN_FILES = Object.keys(CHAT_EDIT_TARGETED_PIN_EDITS)

export const CHAT_EDIT_TARGETED_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_EDIT_TARGETED_PIN_FILES]

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
  if (rel in CHAT_EDIT_TARGETED_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!CHAT_EDIT_TARGETED_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_EDIT_TARGETED_MARKER_RE.test(line)).join('\n')
}

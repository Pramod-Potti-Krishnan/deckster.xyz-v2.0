// FRONTEND-1 (overnight chat parity, 11 Nov 2026), the WORKSPACE half, stacked on the viewer half (PR #611, head 99e02976, on dev 2f06e51e). Flag NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (the string "true", default off, build-time; it already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell):
// the composer's "/" menu gains a "Workspace" group: /kg on|off, /template <name> | clear | stop, /template-mode on|off, /notes show|hide, /dark /light /system, /intro, /pane chat|slides|inspector, /history. Each calls the handler the matching button calls
// (lib/studio-chat-parity-workspace.ts lists them), through ONE small bus in PARTS that the Builder page, the viewer, the notes panel and the introduction register on in gated effects (the shape of the viewer half's bus). No new flag, no .env.example block, no backend, no Director change.
// lib/studio-chat-parity-workspace.ts decides (the rows, what cannot run and why, the words, the bus), components/builder/chat/studio-chat-parity-workspace.tsx is the composer's glue (appearance, history, the saved templates), and the viewer half's menu draws the group.
// Every line this change adds to an EXISTING file carries the marker CHAT-PARITY-WORKSPACE (matched as a whole token; CHAT-PARITY-VIEWER is the viewer half's and CHAT-PARITY is another change's). All are pure insertions (CHAT_PARITY_WORKSPACE_EDITS is empty: another change's strip never meets one of its lines changed). Take the marked lines out and each file is the viewer half's head, byte for byte.
// The base is the viewer half's head, not the commit under it: for a file the viewer half touched that is its text; for a file it left alone the two commits agree (BASE_TOUCHED says which is which: the proof reads each from its own commit and checks the list against git).
// How the older pins reach it: this change REGISTERS its files and this strip (scripts/studio-later-changes.mjs, two lines; no .env.example block), and teaches the older proofs that read files this change touched without going through the registry (the chat element edit proof: one inserted line, its two lines kept as they were).
// Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '99e029760c06800fd1186bda60592404a7ba569a' // origin/frontend1/chat-parity-viewer (#611's head, on dev 2f06e51e); the tree diff from it to this change's newest commit is this change
export const BASE_UNDER_COMMIT = '2f06e51ec807d4ecd5cd00edc9bfd0005a5fd0b8' // origin/studio-v4-dev-preparation-code (#621 merged): what a file the viewer half left alone is, in either commit
export const CHAT_PARITY_WORKSPACE_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_COMMANDS'
export const CHAT_PARITY_WORKSPACE_MARKER = 'CHAT-PARITY-WORKSPACE'
/** The marker as a WHOLE token: CHAT-PARITY-WORKSPACE-X and X-CHAT-PARITY-WORKSPACE are not this change's (CHAT-PARITY-VIEWER is the viewer half's, CHAT-PARITY is chat parity's, studio_action). */
export const CHAT_PARITY_WORKSPACE_MARKER_RE = /(?<![\w-])CHAT-PARITY-WORKSPACE(?![\w-])/
/** The subject prefix of this change's own commits (the proof reads these, not a merge of dev that this branch may need). */
export const CHAT_PARITY_WORKSPACE_SUBJECT = 'Chat parity workspace:'

/** Existing files that get marked lines (the last two are the viewer half's own new files: they exist at the base, so they are put back like the others). */
export const CHAT_PARITY_WORKSPACE_FILES = [
  "app/builder/page.tsx",
  "components/presentation-viewer.tsx",
  "components/slide-notes-panel.tsx",
  "components/builder/studio-introduction.tsx",
  "components/builder/chat/studio-chat-commands.tsx",
  "lib/studio-chat-commands.ts",
  "lib/studio-chat-parity-viewer.ts",
  "components/builder/chat/studio-chat-parity-viewer-menu.tsx",
]

/** The changed lines: [line now, line before] per edit, whole lines; every line now carries the marker and occurs once in its file. None: every line this change adds to an existing file is a pure insertion (the viewer half's own lib and menu included), so another change's strip never meets one of its lines changed. */
export const CHAT_PARITY_WORKSPACE_EDITS = {}

/** The files of this change that the viewer half touched too (the proof reads the base of each of these from the viewer half's head, every other file of this change from the commit under it: the two agree for those). */
export const BASE_TOUCHED = [
  "app/builder/page.tsx",
  "components/presentation-viewer.tsx",
  "components/builder/chat/studio-chat-commands.tsx",
  "lib/studio-chat-commands.ts",
  "lib/studio-chat-parity-viewer.ts",
  "components/builder/chat/studio-chat-parity-viewer-menu.tsx",
]

/** New files (no base text to put back). */
export const CHAT_PARITY_WORKSPACE_NEW_FILES = [
  "lib/studio-chat-parity-workspace.ts",
  "components/builder/chat/studio-chat-parity-workspace.tsx",
  "components/builder/chat/studio-chat-parity-workspace-icons.ts",
  "scripts/studio-chat-parity-workspace-strip.mjs",
  "scripts/test-studio-chat-parity-workspace.mjs",
]

/**
 * The older proofs this change teaches: [line now, line before] per edit, whole lines (a line now carries "registry read (CHAT-PARITY-WORKSPACE)" and occurs once in its file). The viewer half's own proof and the chat commands proof
 * are put back to the viewer half's lines (its strip never reads the first, and only drops marked lines of the second); test-studio-chat-parity.mjs was changed by the viewer half too, so its line goes back to the line BEFORE the
 * viewer half: the two strips then agree whichever runs first. The chat element edit proof's two Notes-panel lines are NOT rewritten (chat parity's strip pins the second): one marked line in front of them runs both checks, and returns before they run.
 */
export const CHAT_PARITY_WORKSPACE_PIN_EDITS = {
  "scripts/test-studio-chat-parity-viewer.mjs": [
    ["const stripWorkspace = await import('./studio-chat-parity-workspace-strip.mjs') // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): the workspace slash commands (stacked after this change) add marked lines to files this proof reads and to the viewer half's own lib and menu; it reads them as this change left them\n",
     ""],
    ["const read = rel => stripWorkspace.stripChatParityWorkspace(rel, fs.readFileSync(path.join(root, rel), 'utf8')) // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): every read is the file without the workspace commands' lines (stripWorkspace is bound below: a read is only made later)\n",
     "const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')\n"],
    ["const addedLines = (rel, from = strip.BASE_COMMIT) => git('diff', '--no-color', '-U0', from, '--', rel).split('\\n').filter(line => /^\\+(?!\\+\\+)/.test(line)).map(line => line.slice(1)).filter(line => !stripWorkspace.CHAT_PARITY_WORKSPACE_MARKER_RE.test(line)) // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): the workspace commands' marked lines are a later change's\n",
     "const addedLines = (rel, from = strip.BASE_COMMIT) => git('diff', '--no-color', '-U0', from, '--', rel).split('\\n').filter(line => /^\\+(?!\\+\\+)/.test(line)).map(line => line.slice(1))\n"],
    ["  ok(registry.LATER_STRIPS.includes(strip.stripChatParityViewer) && registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(strip.stripChatParityViewer) + 1).every(later => /^stripChatParity/.test(later.name)), 'registry: the strip is registered, last but for the chat parity changes stacked on it') // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE)\n",
     "  ok(registry.LATER_STRIPS.includes(strip.stripChatParityViewer) && registry.LATER_STRIPS[registry.LATER_STRIPS.length - 1] === strip.stripChatParityViewer, 'registry: the strip is registered, last')\n"]
  ],
  "scripts/test-studio-chat-commands.mjs": [
    ["import { stripChatParityWorkspace, CHAT_PARITY_WORKSPACE_FILES } from './studio-chat-parity-workspace-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): the workspace slash commands (stacked after the viewer's) add rows and lines to files this proof reads; it reads them as the viewer's commands left them, then as chat commands had them\n",
     ""],
    ["{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && CHAT_PARITY_WORKSPACE_FILES.includes(rel) ? stripChatParityWorkspace(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): every read of a file that change touched (the module loader's too) is the file as the viewer's commands left it (each of the two hooks only drops its own marked lines, so the order they are installed in does not matter)\n",
     ""]
  ],
  "scripts/test-studio-chat-element-edit.mjs": [
    ["  assert.equal(stripPeers(rel, stripChatElementEdit(rel, read(rel))), stripPeers(rel, baseFile(rel))); for (const line of git('diff', '-U0', BASE_COMMIT, '--', rel).split('\\n').filter(l => l.startsWith('+') && !l.startsWith('+++') && !/(?<![\\w-])CHAT-PARITY(?![\\w-])/.test(l) && !/(?<![\\w-])CHAT-PARITY-WORKSPACE(?![\\w-])/.test(l))) assert.match(line, CHAT_ELEMENT_EDIT_MARKER_RE); return // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): the workspace slash commands add marked lines to this panel (the Notes bar's handler for /notes): the panel is read as every other later change leaves it, and chat parity's and the workspace's marked lines are not this change's; the two lines below are the base's own, kept as they were (another change's strip pins the second) and never run\n",
     ""]
  ],
  "scripts/test-studio-chat-parity.mjs": [
    ["const OWN = (() => { try { return git('log', '--format=%H%x09%s', '-E', '--grep=^Chat parity', 'HEAD').split('\\n').filter(Boolean).map(line => line.split('\\t')).find(([, subject]) => !subject.startsWith('Chat parity viewer:') && !subject.startsWith('Chat parity workspace:'))?.[0] || null } catch { return null } })() // a merge of dev into this branch is this change's commit too (its subject starts the same way) // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): the viewer's slash commands (commits \"Chat parity viewer: ...\") are a later change's, not this one's // LATER-CHANGES: registry read (CHAT-PARITY-WORKSPACE): so are the workspace commands (commits \"Chat parity workspace: ...\")\n",
     "const OWN = (() => { try { return git('log', '-1', '--format=%H', '-E', '--grep=^Chat parity', 'HEAD').trim() || null } catch { return null } })() // a merge of dev into this branch is this change's commit too (its subject starts the same way)\n"]
  ]
}
export const CHAT_PARITY_WORKSPACE_PIN_FILES = Object.keys(CHAT_PARITY_WORKSPACE_PIN_EDITS)
/** Files this change edits that are neither marked app code nor new: the registry (two lines) and the older proofs it teaches. No package.json script: run the proof with `node scripts/test-studio-chat-parity-workspace.mjs`. */
export const CHAT_PARITY_WORKSPACE_OWN_EDITS = ['scripts/studio-later-changes.mjs', ...CHAT_PARITY_WORKSPACE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_PARITY_WORKSPACE_SCOPE_FILES = new Set([...CHAT_PARITY_WORKSPACE_FILES, ...CHAT_PARITY_WORKSPACE_NEW_FILES, ...CHAT_PARITY_WORKSPACE_OWN_EDITS])

/** The registry text carries this change's two lines; they name this module. */
export const CHAT_PARITY_WORKSPACE_REGISTRY_MARK = "./studio-chat-parity-workspace-strip.mjs')"

/** An older proof without this change's edits (the previous file). */
export function putBackChatParityWorkspaceEdits(rel, text) {
  return (CHAT_PARITY_WORKSPACE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/**
 * The file without this change's lines: the changed lines go back to what they were, then every line that carries the marker (as a whole token) is taken out; every other byte stays. The registry loses its two lines;
 * a taught proof gets its previous lines back. Any other file is returned as it is.
 */
export function stripChatParityWorkspace(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === 'scripts/studio-later-changes.mjs') return text.split('\n').filter(line => !line.includes(CHAT_PARITY_WORKSPACE_REGISTRY_MARK)).join('\n')
  if (rel in CHAT_PARITY_WORKSPACE_PIN_EDITS) return putBackChatParityWorkspaceEdits(rel, text)
  if (!CHAT_PARITY_WORKSPACE_FILES.includes(rel)) return text
  const swapped = (CHAT_PARITY_WORKSPACE_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
  return swapped.split('\n').filter(line => !CHAT_PARITY_WORKSPACE_MARKER_RE.test(line)).join('\n')
}

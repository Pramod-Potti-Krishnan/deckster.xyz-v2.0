// FRONTEND-1 (overnight chat parity, 10 Nov 2026), the VIEWER half. Flag NEXT_PUBLIC_STUDIO_CHAT_PARITY_COMMANDS (the string "true", default off, build-time; REVIEW-1's finding 1: the chain has a switch of its own) on top of NEXT_PUBLIC_STUDIO_CHAT_COMMANDS, which already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell: the composer's "/" menu
// gains the viewer commands (/goto, /next, /prev, /blank-slide, /layout, /present, /edit, /view, /rail, /grid, /borders, /save, /discard, /version, /canvas) and "/theme <preset>". Each calls the handler the matching button calls (lib/studio-chat-parity-viewer.ts
// lists them), through ONE small bus the viewer registers on in a gated effect (the shape of the Master opener on chatParityBus). One new flag with its .env.example block, no backend, no Director change. Flag off, the composer is the commands flag's own: no several-word trigger, no viewer row, nothing registers on the viewer, no note function reaches the composer.
// lib/studio-chat-parity-viewer.ts decides (the rows, what cannot run and why, the words, the bus), components/builder/chat/studio-chat-parity-viewer-menu.tsx draws the three groups (Slides, View, Deck), components/builder/studio-chat-parity-viewer.css
// says how a row that cannot run reads. A command says what it SAW in the viewer afterwards, as one short note in the thread (chat clean's own note style, one more note kind: command).
// Every line this change adds to an EXISTING file carries the marker CHAT-PARITY-VIEWER (matched as a whole token; CHAT-PARITY is another change's). Most are pure insertions. 10 are CHANGED lines: CHAT_PARITY_VIEWER_EDITS holds
// [line now, line before] for each, whole lines. Put the changed lines back, then take the marked lines out, and each file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '2f06e51ec807d4ecd5cd00edc9bfd0005a5fd0b8' // origin/studio-v4-dev-preparation-code (#621 merged); the tree diff from it to this change's newest commit is this change
export const CHAT_PARITY_VIEWER_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_COMMANDS'
/** The flag of the whole chat parity chain (the viewer commands here, the workspace and the remaining commands stacked on them): the string "true", default off, build-time. It is required on top of NEXT_PUBLIC_STUDIO_CHAT_COMMANDS, NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell. */
export const CHAT_PARITY_COMMANDS_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_PARITY_COMMANDS'
export const CHAT_PARITY_VIEWER_MARKER = 'CHAT-PARITY-VIEWER'
/** The marker as a WHOLE token: CHAT-PARITY-VIEWER-X and X-CHAT-PARITY-VIEWER are not this change's (CHAT-PARITY is chat parity's, studio_action). */
export const CHAT_PARITY_VIEWER_MARKER_RE = /(?<![\w-])CHAT-PARITY-VIEWER(?![\w-])/
/** The subject prefix of this change's own commits (the proof reads these, not a merge of dev that this branch may need). */
export const CHAT_PARITY_VIEWER_SUBJECT = 'Chat parity viewer:'

/** Existing files that get marked lines. */
export const CHAT_PARITY_VIEWER_FILES = [
  "components/presentation-viewer.tsx",
  "components/builder/chat-input.tsx",
  "components/builder/chat/studio-chat-commands.tsx",
  "components/builder/chat/studio-chat-clean.tsx",
  "lib/studio-chat-commands.ts",
  "lib/studio-chat-clean.ts",
  "app/builder/page.tsx",
]

/** The exact text of the chain's .env.example block (the registry takes it out, with the blank line that separates it, for the older pins). One block for the one flag; the workspace and the remaining commands, stacked on this change, sit under the same flag. */
export const CHAT_PARITY_COMMANDS_ENV_BLOCK = `# STUDIO CHAT PARITY COMMANDS (FRONTEND-1; REVIEW-1's finding 1 on the chat parity chain, 13 Nov: the chain had no switch of its own). On for the exact value "true"; default off, and then the composer, the Builder, the viewer and the other pages are exactly what NEXT_PUBLIC_STUDIO_CHAT_COMMANDS alone gives (its twelve commands and the "@" mentions): no new command row, no new trigger, no hand-off, /publish still answers with its note and the Open Publish button, and a picked @template is still written into the message. Build-time value: change it on Vercel and redeploy.
# It needs NEXT_PUBLIC_STUDIO_CHAT_COMMANDS, NEXT_PUBLIC_STUDIO_CHAT_CLEAN and NEXT_PUBLIC_STUDIO_V4_SHELL too (the menus live in the v3.1 composer); without them it does nothing. Do not read it as one of the NEXT_PUBLIC_STUDIO_CHAT_PARITY_* flags of Director's studio_action: it only widens what the person's own typing can do.
# On: the "/" menu gains the viewer commands (/goto, /next, /prev, /blank-slide, /layout, /present, /edit, /view, /rail, /grid, /borders, /save, /discard, /version, /canvas and /theme <preset>), the Workspace group (/kg, /template <name>, /template-mode, /notes, /dark, /light, /system, /intro, /pane, /history) and the rest (/delete-theme, /delete-template, /kg-search, /ask, /model <choice>, /switch-template).
# Each calls the handler the matching button calls; a command runs only from what the person types and picks, and a delete still ends in the page's own confirmation click. The several-word commands (/layout, /theme, /template, /model, /ask, /kg-search, /delete-theme, /delete-template, /switch-template) take their words only when the draft STARTS with the command.
# Also on: /publish presses the Publish button (the wizard opens; publishing stays a click inside it), a picked @template is CHOSEN, as the toolbar's Template picker chooses it, and /delete-theme, /delete-template, /kg-search and /ask hand their words to the page they open through this browser's local storage (one entry, two minutes, taken once, and only by the account that wrote it). No backend, no Director change, nothing new on the wire.
NEXT_PUBLIC_STUDIO_CHAT_PARITY_COMMANDS="false"
`

/** The changed lines: [line now, line before] per edit, whole lines; every line now carries the marker and occurs once in its file. */
export const CHAT_PARITY_VIEWER_EDITS = {
  "components/builder/chat/studio-chat-commands.tsx": [
    ["  const trigger = enabled ? detectTrigger(input.text, parityOn) : null // CHAT-PARITY-VIEWER",
     "  const trigger = enabled ? detectTrigger(input.text) : null"],
    ["  const count = trigger?.kind === 'command' ? rows.length + parity.length : mention ? mention.items.length : 0 // CHAT-PARITY-VIEWER",
     "  const count = trigger?.kind === 'command' ? rows.length : mention ? mention.items.length : 0"],
    ["  const menuOpen = Boolean(enabled && trigger && dismissed !== key && (trigger.kind === 'command' ? rows.length + parity.length > 0 : mention && (mention.items.length > 0 || mention.empty))) // CHAT-PARITY-VIEWER",
     "  const menuOpen = Boolean(enabled && trigger && dismissed !== key && (trigger.kind === 'command' ? rows.length > 0 : mention && (mention.items.length > 0 || mention.empty)))"],
    ["    if (trigger?.kind === 'command') { if (rows[index]) pickCommand(rows[index]); else if (parity[index - rows.length]) pickParity(parity[index - rows.length]) } else if (mention?.items[index]) pickMention(mention.items[index]) // CHAT-PARITY-VIEWER",
     "    if (trigger?.kind === 'command') { if (rows[index]) pickCommand(rows[index]) } else if (mention?.items[index]) pickMention(mention.items[index])"],
    ["    ? <ChatCommandsMenu kind={trigger.kind} rows={rows} parity={parity} mention={mention} active={active} onPick={pickAt} onHover={index => setCursor({ sig, index })} /> // CHAT-PARITY-VIEWER",
     "    ? <ChatCommandsMenu kind={trigger.kind} rows={rows} mention={mention} active={active} onPick={pickAt} onHover={index => setCursor({ sig, index })} />"],
    ["export function ChatCommandsMenu({ kind, rows, parity, mention, active, onPick, onHover }: ChatCommandsMenuProps) { // CHAT-PARITY-VIEWER",
     "export function ChatCommandsMenu({ kind, rows, mention, active, onPick, onHover }: ChatCommandsMenuProps) {"],
    ["        {rows.length > 0 && <p role=\"presentation\" data-studio-v4-type-role=\"mention-heading\" data-studio-chat-commands-heading=\"commands\" className={HEADING}>{W.commandsHeading}</p>}{/* CHAT-PARITY-VIEWER */}",
     "        <p role=\"presentation\" data-studio-v4-type-role=\"mention-heading\" data-studio-chat-commands-heading=\"commands\" className={HEADING}>{W.commandsHeading}</p>"]
  ],
  "lib/studio-chat-commands.ts": [
    ["export function detectTrigger(text: string, parity = false): MenuTrigger | null { // CHAT-PARITY-VIEWER",
     "export function detectTrigger(text: string): MenuTrigger | null {"]
  ],
  "components/builder/chat/studio-chat-clean.tsx": [
    ["  return { notes: enabled ? notes : NO_NOTES, addDirections, addNote, ack: enabled && ackNow ? ackNow : NO_ACK } // CHAT-PARITY-VIEWER",
     "  return { notes: enabled ? notes : NO_NOTES, addDirections, ack: enabled && ackNow ? ackNow : NO_ACK }"]
  ],
  "lib/studio-chat-clean.ts": [
    ["export type ChatCleanNoteKind = 'stopped' | 'paused' | 'resumed' | 'applied' | 'not_applied' | 'directions' | 'command' // CHAT-PARITY-VIEWER: chat parity, viewer commands: a quiet one-line note of what a \"/\" command did",
     "export type ChatCleanNoteKind = 'stopped' | 'paused' | 'resumed' | 'applied' | 'not_applied' | 'directions'"]
  ]
}

/** New files (no base text to put back). */
export const CHAT_PARITY_VIEWER_NEW_FILES = [
  "lib/studio-chat-parity-viewer.ts",
  "components/builder/chat/studio-chat-parity-viewer-menu.tsx",
  "components/builder/studio-chat-parity-viewer.css",
  "scripts/studio-chat-parity-viewer-strip.mjs",
  "scripts/test-studio-chat-parity-viewer.mjs",
  "scripts/studio-chat-harness/composer-mount.mjs",
  "scripts/studio-chat-harness/later-reader.mjs",
]

/** The older proofs this change teaches: [line now, line before] per edit, whole lines (a line now carries "registry read (CHAT-PARITY-VIEWER)" and occurs once in its file; a line before of "" is an inserted line). Arrange, first paint's viewer proof and the two phone proofs read the viewer (and the page) raw: one import and one read hook each, this strip only, never the registry. The phone proofs' scope check also drops the viewer, which a later change marks, from the files an own commit touched. Structural decline's commit-subject check skips this chain's subjects. */
export const CHAT_PARITY_VIEWER_PIN_EDITS = {
  "scripts/test-studio-audit-present-exit.mjs": [
    ["    const hook = lines.findIndex(line => line.includes('fs.readFileSync = ') && line.includes('stripAuditPresentExit(rel, out)')) // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): a later change (this one) adds its own read hook to the same proofs, so the mutant edits the hook that is this change's, not the first hook in the file\n",
     "    const hook = lines.findIndex(line => line.includes('fs.readFileSync = '))\n"]
  ],
  "scripts/test-studio-chat-commands.mjs": [
    ["import { stripChatParityViewer, CHAT_PARITY_VIEWER_FILES } from './studio-chat-parity-viewer-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): the viewer's slash commands (stacked after chat commands) add rows and lines to files this proof reads; it reads them as chat commands had them\n",
     ""],
    ["{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && CHAT_PARITY_VIEWER_FILES.includes(rel) ? stripChatParityViewer(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): every read of a file that change touched (the module loader's too) is the file as chat commands had it\n",
     ""]
  ],
  "scripts/test-studio-chat-parity.mjs": [
    ["const OWN = (() => { try { return git('log', '--format=%H%x09%s', '-E', '--grep=^Chat parity', 'HEAD').split('\\n').filter(Boolean).map(line => line.split('\\t')).find(([, subject]) => !subject.startsWith('Chat parity viewer:'))?.[0] || null } catch { return null } })() // a merge of dev into this branch is this change's commit too (its subject starts the same way) // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): the viewer's slash commands (commits \"Chat parity viewer: ...\") are a later change's, not this one's",
     "const OWN = (() => { try { return git('log', '-1', '--format=%H', '-E', '--grep=^Chat parity', 'HEAD').trim() || null } catch { return null } })() // a merge of dev into this branch is this change's commit too (its subject starts the same way)"]
  ],
  "scripts/test-studio-arrange.mjs": [
    ["import { stripChatParityViewer, CHAT_PARITY_VIEWER_FILES } from './studio-chat-parity-viewer-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): the viewer's slash commands (stacked after this change) mark lines in the viewer and the page; this proof reads them as the change before the viewer's left them\n",
     ""],
    ["{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && CHAT_PARITY_VIEWER_FILES.includes(rel) ? stripChatParityViewer(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): every read of a file the viewer's change touched is the file without its marked lines (the viewer's own strip, never the registry: this proof's own lines stay visible to its pins)\n",
     ""]
  ],
  "scripts/test-studio-first-paint-viewer.mjs": [
    ["import { stripChatParityViewer, CHAT_PARITY_VIEWER_FILES } from './studio-chat-parity-viewer-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): the viewer's slash commands (stacked after this change) mark lines in the viewer and the page; this proof reads them as the change before the viewer's left them\n",
     ""],
    ["{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && CHAT_PARITY_VIEWER_FILES.includes(rel) ? stripChatParityViewer(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): every read of a file the viewer's change touched is the file without its marked lines (the viewer's own strip, never the registry: this proof's own lines stay visible to its pins)\n",
     ""]
  ],
  "scripts/test-studio-phone-hints.mjs": [
    ["import { stripChatParityViewer, CHAT_PARITY_VIEWER_FILES } from './studio-chat-parity-viewer-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): the viewer's slash commands (stacked after this change) mark lines in the viewer and the page; this proof reads them as the change before the viewer's left them\n",
     ""],
    ["{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && CHAT_PARITY_VIEWER_FILES.includes(rel) ? stripChatParityViewer(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): every read of a file the viewer's change touched is the file without its marked lines (the viewer's own strip, never the registry: this proof's own lines stay visible to its pins)\n",
     ""],
    ["  for (const rel of [...touched]) if (!PHONE_HINTS_SCOPE_FILES.has(rel) && (() => { try { return registry.stripLaterChanges(rel, git('show', `${head}:${rel}`)) === registry.stripLaterChanges(rel, git('show', `${BASE_COMMIT}:${rel}`)) } catch { return false } })()) touched.delete(rel) // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): a file this change did not take (the viewer) that a later change marks is touched by no net change of this one's once every registered change strips its own lines; any other foreign file still counts\n",
     ""]
  ],
  "scripts/test-studio-phone-landscape.mjs": [
    ["import { stripChatParityViewer, CHAT_PARITY_VIEWER_FILES } from './studio-chat-parity-viewer-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): the viewer's slash commands (stacked after this change) mark lines in the viewer and the page; this proof reads them as the change before the viewer's left them\n",
     ""],
    ["{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && CHAT_PARITY_VIEWER_FILES.includes(rel) ? stripChatParityViewer(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): every read of a file the viewer's change touched is the file without its marked lines (the viewer's own strip, never the registry: this proof's own lines stay visible to its pins)\n",
     ""],
    ["  for (const rel of [...touched]) if (!PHONE_LANDSCAPE_SCOPE_FILES.has(rel) && (() => { try { return registry.stripLaterChanges(rel, git('show', `${head}:${rel}`)) === registry.stripLaterChanges(rel, git('show', `${BASE_COMMIT}:${rel}`)) } catch { return false } })()) touched.delete(rel) // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): a file this change did not take (the viewer) that a later change marks is touched by no net change of this one's once every registered change strips its own lines; any other foreign file still counts\n",
     ""]
  ],
  "scripts/test-studio-chat-refine-structural-decline.mjs": [
    ["  for (const c of git('rev-list', '--no-merges', `${BASE_COMMIT}..${head}`).split('\\n').filter(Boolean).filter(c => !/^Chat parity (viewer|workspace|more):/.test(subjectOf(c)))) assert.doesNotMatch(subjectOf(c), OLDER_SUBJECTS, `${c.slice(0, 8)} would be taken for an older change's own commit`); return own // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): the chat parity changes stacked after this one (commits \"Chat parity viewer: / workspace: / more: ...\") are later changes', not an older change's own commits: they are skipped here, the same check runs over every other commit\n",
     ""]
  ]
}
export const CHAT_PARITY_VIEWER_PIN_FILES = Object.keys(CHAT_PARITY_VIEWER_PIN_EDITS)
/** Files this change edits that are neither marked app code nor new: .env.example (its block), the registry (three lines), the composer harness and the older proofs it teaches. No package.json script: run the proof with `node scripts/test-studio-chat-parity-viewer.mjs`. */
export const CHAT_PARITY_VIEWER_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_PARITY_VIEWER_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_PARITY_VIEWER_SCOPE_FILES = new Set([...CHAT_PARITY_VIEWER_FILES, ...CHAT_PARITY_VIEWER_NEW_FILES, ...CHAT_PARITY_VIEWER_OWN_EDITS])

/** The registry text carries this change's three lines (files, .env.example block, strip); they name this module. */
export const CHAT_PARITY_VIEWER_REGISTRY_MARK = "./studio-chat-parity-viewer-strip.mjs')"

/** An older proof without this change's edits (the previous file). */
export function putBackChatParityViewerEdits(rel, text) {
  return (CHAT_PARITY_VIEWER_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/**
 * The file without this change's lines: the changed lines go back to what they were, then every line that carries the marker (as a whole token) is taken out; every other byte stays. The registry loses its two lines;
 * a taught proof gets its previous lines back. Any other file is returned as it is.
 */
export function stripChatParityViewer(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === 'scripts/studio-later-changes.mjs') return text.split('\n').filter(line => !line.includes(CHAT_PARITY_VIEWER_REGISTRY_MARK)).join('\n')
  if (rel in CHAT_PARITY_VIEWER_PIN_EDITS) return putBackChatParityViewerEdits(rel, text)
  if (!CHAT_PARITY_VIEWER_FILES.includes(rel)) return text
  const swapped = (CHAT_PARITY_VIEWER_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
  return swapped.split('\n').filter(line => !CHAT_PARITY_VIEWER_MARKER_RE.test(line)).join('\n')
}
